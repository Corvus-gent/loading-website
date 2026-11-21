use super::*;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen_futures::spawn_local;
use web_sys::HtmlButtonElement;
#[derive(Default)]
struct Desk {
    admin: bool,
    selected: String,
    data: Option<Value>,
    loading: bool,
    again: bool,
    listeners: Vec<ui::Listener>,
}
type State = Rc<RefCell<Desk>>;
fn status(s: &str) {
    ui::text("status", s)
}
fn button(form: &str) -> Result<HtmlButtonElement, JsValue> {
    ui::element(form)?
        .query_selector("button")?
        .ok_or(JsValue::NULL)?
        .dyn_into()
        .map_err(Into::into)
}
fn fail(e: JsValue) {
    status(&ui::message(&e));
}
fn load(state: &State) {
    let s = state.clone();
    spawn_local(async move {
        refresh(&s).await;
    });
}
async fn refresh(state: &State) {
    {
        let mut s = state.borrow_mut();
        if s.loading {
            s.again = true;
            return;
        }
        s.loading = true;
    }
    let (admin, selected) = {
        let s = state.borrow();
        (s.admin, s.selected.clone())
    };
    let result = async {
        let role = if admin { "&role=admin" } else { "" };
        if api(None, &format!("?session=1{role}")).await?["authorized"] != true {
            ui::hidden("private", true);
            ui::hidden("login", false);
            state.borrow_mut().data = None;
            state.borrow_mut().listeners.clear();
            return Ok(());
        }
        let query = if admin {
            "?private=1&role=admin".into()
        } else {
            format!(
                "?private=1{}",
                if selected.is_empty() {
                    String::new()
                } else {
                    format!("&version={}", js_sys::encode_uri_component(&selected))
                }
            )
        };
        let data = api(None, &query).await?;
        if selected != state.borrow().selected {
            state.borrow_mut().again = true;
            return Ok(());
        }
        state.borrow_mut().listeners.clear();
        if admin {
            render_admin(state, &data)?;
        } else {
            render_stats(state, &data)?;
        }
        state.borrow_mut().data = Some(data);
        Ok::<_, JsValue>(())
    }
    .await;
    if let Err(e) = result {
        fail(e);
    }
    let again = {
        let mut s = state.borrow_mut();
        s.loading = false;
        let again = s.again;
        s.again = false;
        again
    };
    if again {
        load(state);
    }
}
fn scoped(
    state: &State,
    e: &HtmlElement,
    event: &str,
    cb: impl FnMut(web_sys::Event) + 'static,
) -> Result<(), JsValue> {
    state
        .borrow_mut()
        .listeners
        .push(ui::scoped_listener(e.as_ref(), event, cb)?);
    Ok(())
}
fn labels(state: &State) -> Result<(), JsValue> {
    let selected = select("label-version")?.value();
    let d = state.borrow().data.clone().unwrap_or(Value::Null);
    let target = clear("item-labels")?;
    if let Some(v) = rows(&d, "versions")
        .into_iter()
        .find(|v| v["id"] == selected)
    {
        for t in rows(&v, "transitions") {
            let row = node(
                "label",
                &format!("{}s · {}", fixed(num(&t["start"]), 1), text(&t, "id")),
                "",
            )?;
            let e = node("input", "", "")?.dyn_into::<HtmlInputElement>()?;
            e.set_attribute("data-item", text(&t, "id"))?;
            e.set_value(text(&t, "label"));
            e.set_max_length(100);
            e.set_required(true);
            append(&row, &e)?;
            append(&target, &row)?;
        }
    }
    Ok(())
}
fn render_admin(state: &State, d: &Value) -> Result<(), JsValue> {
    let target = clear("admin-feedback")?;
    for note in rows(d, "feedback") {
        let row = node("li", "", "")?;
        let b = node("button", "delete", "button")?.dyn_into::<HtmlButtonElement>()?;
        b.set_type("button");
        append(
            &row,
            &node(
                "strong",
                &format!(
                    "{} · {} · {}",
                    text(&note, "handle"),
                    text(&note, "version"),
                    text(&note, "chip")
                ),
                "",
            )?,
        )?;
        append(
            &row,
            &node(
                "p",
                if text(&note, "text").is_empty() {
                    "one-tap feedback"
                } else {
                    text(&note, "text")
                },
                "",
            )?,
        )?;
        let id = text(&note, "id").to_owned();
        let b2 = b.clone();
        let row2 = row.clone();
        scoped(state, b.as_ref(), "click", move |_| {
            b2.set_disabled(true);
            let b = b2.clone();
            let row = row2.clone();
            let id = id.clone();
            spawn_local(async move {
                match api(Some(json!({"action":"hide_text","id":id})), "").await {
                    Ok(_) => {
                        row.remove();
                        status("removed from the public wall.");
                    }
                    Err(e) => {
                        fail(e);
                        b.set_disabled(false);
                    }
                }
            });
        })?;
        append(&row, &b)?;
        append(&target, &row)?;
    }
    let previous = select("label-version")?.value();
    let target = clear("label-version")?;
    let versions = rows(d, "versions");
    for v in &versions {
        append(
            &target,
            &option(
                &format!("V{} / r{}", value(&v["slot"]), value(&v["iteration"])),
                text(v, "id"),
            )?,
        )?;
    }
    if versions.iter().any(|v| v["id"] == previous) {
        select("label-version")?.set_value(&previous);
    }
    state.borrow_mut().data = Some(d.clone());
    labels(state)?;
    button("labels-form")?.set_disabled(versions.is_empty());
    input("revolut-url")?.set_value(text(&d["fund"], "revolut_url"));
    input("revolut-total")?.set_value(&fixed(num(&d["fund"]["revolut"]) / 100., 2));
    input("revolut-late")?.set_value(&fixed(num(&d["fund"]["revolutLate"]) / 100., 2));
    ui::hidden("login", true);
    ui::hidden("private", false);
    let target = clear("version")?;
    append(&target, &option("all cuts · everyone watching", "all")?)?;
    for v in versions {
        append(
            &target,
            &option(
                &format!(
                    "V{} / r{} · {}",
                    value(&v["slot"]),
                    value(&v["iteration"]),
                    text(&v, "label")
                ),
                text(&v, "id"),
            )?,
        )?;
    }
    button("poll-form")?.set_disabled(rows(d, "versions").is_empty());
    Ok(())
}
fn percent(up: f64, down: f64) -> String {
    if up + down != 0. {
        format!("{}%", (up / (up + down) * 100.).round())
    } else {
        "—".into()
    }
}
fn render_stats(state: &State, d: &Value) -> Result<(), JsValue> {
    ui::hidden("login", true);
    ui::hidden("private", false);
    let target = clear("version")?;
    append(&target, &option("before the first cut", "none")?)?;
    for v in rows(d, "versions") {
        append(
            &target,
            &option(
                &format!(
                    "V{} / r{} · {}",
                    value(&v["slot"]),
                    value(&v["iteration"]),
                    text(&v, "label")
                ),
                text(&v, "id"),
            )?,
        )?;
    }
    let selected = if !text(&d["selected"], "id").is_empty() {
        text(&d["selected"], "id").into()
    } else {
        let s = &state.borrow().selected;
        if s.is_empty() {
            "none".into()
        } else {
            s.clone()
        }
    };
    select("version")?.set_value(&selected);
    state.borrow_mut().selected = selected;
    let s = &d["stats"];
    let target = clear("totals")?;
    for (label, v) in [
        ("views", count(s, "view")),
        ("plays", count(s, "play")),
        (
            "like ratio",
            percent(num(&s["vote:up"]), num(&s["vote:down"])),
        ),
        ("ideas", count(s, "texts")),
        ("100% watched", count(s, "watch:100")),
        (
            "fund",
            format!("€{}", fixed(num(&d["fund"]["total"]) / 100., 2)),
        ),
    ] {
        let e = node("div", label, "")?;
        append(&e, &node("b", &v, "")?)?;
        append(&target, &e)?;
    }
    table(
        "versions",
        &["cut", "plays", "👍", "👎", "like %", "ideas"],
        &rows(d, "perVersion")
            .iter()
            .map(|v| {
                let s = &v["stats"];
                vec![
                    format!(
                        "V{} / r{} ({})",
                        value(&v["slot"]),
                        value(&v["iteration"]),
                        text(v, "id")
                    ),
                    count(s, "play"),
                    count(s, "vote:up"),
                    count(s, "vote:down"),
                    percent(num(&s["vote:up"]), num(&s["vote:down"])),
                    count(s, "texts"),
                ]
            })
            .collect::<Vec<_>>(),
    )?;
    table(
        "transitions",
        &["transition", "time", "👍", "👎", "tags"],
        &rows(&d["selected"], "transitions")
            .iter()
            .map(|t| {
                let id = text(t, "id");
                let prefix = format!("transition:{id}:tag:");
                vec![
                    text(t, "label").into(),
                    format!("{}–{}s", value(&t["start"]), value(&t["end"])),
                    count(s, &format!("transition:{id}:up")),
                    count(s, &format!("transition:{id}:down")),
                    s.as_object()
                        .into_iter()
                        .flatten()
                        .filter_map(|(k, n)| {
                            k.strip_prefix(&prefix)
                                .map(|k| format!("{k} ×{}", value(n)))
                        })
                        .collect::<Vec<_>>()
                        .join(", "),
                ]
            })
            .collect::<Vec<_>>(),
    )?;
    campaigns(d)?;
    table(
        "categories",
        &["category", "👍", "👎"],
        &[
            "Hook",
            "Transitions",
            "Music",
            "Pacing",
            "Story",
            "Humor",
            "Visuals",
            "Ending",
        ]
        .iter()
        .map(|c| {
            vec![
                (*c).into(),
                count(s, &format!("category:{c}:up")),
                count(s, &format!("category:{c}:down")),
            ]
        })
        .collect::<Vec<_>>(),
    )?;
    let duration = if num(&d["selected"]["duration"]) != 0. {
        num(&d["selected"]["duration"])
    } else {
        1.
    };
    let mut bins = vec![(0., 0., Vec::<String>::new()); 30];
    for (k, n) in d["heat"].as_object().into_iter().flatten() {
        let mut parts = k.split(':');
        let time = parts.next().unwrap_or("");
        let kind = parts.next().unwrap_or("");
        let t = time.parse::<f64>().unwrap_or(0.);
        let index = ((t / duration * 30.).floor() as usize).min(29);
        bins[index].0 += num(n);
        if ["cut", "neutral"].contains(&kind) {
            bins[index].1 += num(n);
        }
        bins[index].2.push(format!("{time}s {kind} ×{}", value(n)));
    }
    let max = bins.iter().map(|b| b.0).fold(1., f64::max);
    let target = clear("heat")?;
    for (i, (all, bad, lines)) in bins.into_iter().enumerate() {
        let e = node(
            "button",
            "",
            if bad > all / 2. {
                "cut"
            } else if all != 0. {
                "hot"
            } else {
                ""
            },
        )?;
        if !e.has_attribute("class") {
            e.set_class_name("");
        }
        e.style()
            .set_property("height", &format!("{}px", 8. + all / max * 36.))?;
        let title = format!(
            "{}s · {}",
            (i as f64 / 30. * num(&d["selected"]["duration"])).floor(),
            if lines.is_empty() {
                "no reactions".into()
            } else {
                lines.join(" / ")
            }
        );
        e.set_title(&title);
        e.set_attribute("aria-label", &title)?;
        scoped(state, &e, "click", move |_| ui::text("heat-detail", &title))?;
        append(&target, &e)?;
    }
    let mut watch: Vec<_> = s
        .as_object()
        .into_iter()
        .flatten()
        .filter(|(k, _)| k.starts_with("watch:") || k.starts_with("dropoff:"))
        .map(|(k, n)| vec![k.clone(), value(n)])
        .collect();
    watch.sort();
    table("watch", &["milestone / exit bucket", "events"], &watch)?;
    table(
        "polls",
        &["poll", "option", "answers"],
        &rows(d, "polls")
            .iter()
            .flat_map(|p| {
                rows(p, "options")
                    .iter()
                    .enumerate()
                    .map(|(i, o)| {
                        vec![
                            text(p, "q").into(),
                            value(o),
                            count(s, &format!("poll:{}:{i}", text(p, "id"))),
                        ]
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>(),
    )?;
    table(
        "sources",
        &[
            "source / account",
            "link clicks",
            "visits",
            "engagements",
            "checkout clicks",
            "paid",
            "conversion",
            "total",
        ],
        &sources(d),
    )?;
    let target = clear("texts")?;
    let texts = rows(d, "texts");
    if texts.is_empty() {
        append(&target, &node("p", "no ideas for this cut yet.", "")?)?;
    }
    for t in texts {
        let e = node("article", "", "text-entry")?;
        append(
            &e,
            &node(
                "small",
                &format!(
                    "{} · {} · {}",
                    text(&t, "handle"),
                    text(&t, "category"),
                    ui::date(text(&t, "at"))
                ),
                "",
            )?,
        )?;
        append(&e, &node("p", text(&t, "text"), "")?)?;
        if d["admin"] == true {
            let b = node("button", "hide spam", "")?;
            let id = text(&t, "id").to_owned();
            let state2 = state.clone();
            scoped(state, &b, "click", move |_| {
                let state = state2.clone();
                let id = id.clone();
                spawn_local(async move {
                    match api(Some(json!({"action":"hide_text","id":id})), "").await {
                        Ok(_) => refresh(&state).await,
                        Err(e) => fail(e),
                    }
                });
            })?;
            append(&e, &b)?;
        }
        append(&target, &e)?;
    }
    let date = js_sys::Date::new(&JsValue::from_str(text(d, "updated")));
    let f = js_sys::Reflect::get(&date, &"toLocaleTimeString".into())?
        .dyn_into::<js_sys::Function>()?;
    status(&format!(
        "updated {}",
        f.call0(&date)?.as_string().unwrap_or_default()
    ));
    Ok(())
}
fn campaign_values(r: &Value) -> Vec<String> {
    vec![
        count(r, "visits"),
        format!("{}%", fixed(num(&r["engagementRate"]) * 100., 1)),
        count(r, "votes"),
        if r["avgWatch"].is_null() {
            "—".into()
        } else {
            format!("{}%", fixed(num(&r["avgWatch"]), 1))
        },
        format!("€{}", fixed(num(&r["cents"]) / 100., 2)),
        count(r, "army"),
    ]
}
fn campaigns(d: &Value) -> Result<(), JsValue> {
    let touch = select("touch")?.value();
    let rows = rows(d, "campaigns")
        .into_iter()
        .filter(|r| r["touch"] == touch)
        .collect::<Vec<_>>();
    let mut aggregate: Vec<Value> = Vec::new();
    for r in &rows {
        let id = if text(r, "slug").is_empty() {
            text(r, "source")
        } else {
            text(r, "slug")
        };
        let index = aggregate
            .iter()
            .position(|n| n["id"] == id)
            .unwrap_or_else(|| {
                aggregate.push(json!({"id":id,"slug":r["slug"],"source":r["source"]}));
                aggregate.len() - 1
            });
        let n = &mut aggregate[index];
        for k in [
            "visits",
            "linkedVisits",
            "engaged",
            "votes",
            "watchSum",
            "watchSamples",
            "cents",
            "army",
        ] {
            n[k] = json!(num(&n[k]) + num(&r[k]));
        }
    }
    for r in &mut aggregate {
        r["engagementRate"] = json!(if num(&r["linkedVisits"]) != 0. {
            (num(&r["engaged"]) / num(&r["linkedVisits"])).min(1.)
        } else {
            0.
        });
        r["avgWatch"] = if num(&r["watchSamples"]) != 0. {
            json!(num(&r["watchSum"]) / num(&r["watchSamples"]))
        } else {
            Value::Null
        };
    }
    aggregate.sort_by(|a, b| {
        num(&b["engagementRate"])
            .total_cmp(&num(&a["engagementRate"]))
            .then_with(|| num(&b["engaged"]).total_cmp(&num(&a["engaged"])))
    });
    let label = |r: &Value| {
        if text(r, "slug").is_empty() {
            text(r, "source").to_owned()
        } else {
            format!("/{}", text(r, "slug"))
        }
    };
    table(
        "slug-stats",
        &[
            "slug / source",
            "visits",
            "engagement",
            "votes",
            "avg watch",
            "donations",
            "army clicks",
        ],
        &aggregate
            .iter()
            .map(|r| {
                let mut v = vec![label(r)];
                v.extend(campaign_values(r));
                v
            })
            .collect::<Vec<_>>(),
    )?;
    table(
        "campaigns",
        &[
            "slug / source",
            "content",
            "visits",
            "engagement",
            "votes",
            "avg watch",
            "donations",
            "army clicks",
        ],
        &rows
            .iter()
            .map(|r| {
                let mut v = vec![
                    label(r),
                    if text(r, "content").is_empty() {
                        "—".into()
                    } else {
                        text(r, "content").into()
                    },
                ];
                v.extend(campaign_values(r));
                v
            })
            .collect::<Vec<_>>(),
    )
}
fn sources(d: &Value) -> Vec<Vec<String>> {
    let sources = &d["sources"];
    let donations = &d["donations"];
    let campaigns = rows(d, "campaigns")
        .into_iter()
        .filter(|r| r["touch"] == "last" && r["source"] == "tiktok")
        .collect::<Vec<_>>();
    let fields = [
        "clicks",
        "visits",
        "engaged",
        "donationClicks",
        "donations",
        "cents",
    ];
    let values = |label: &str, n: &Value| {
        vec![
            label.into(),
            count(n, "clicks"),
            count(n, "visits"),
            if n["engaged"] == "—" {
                "—".into()
            } else {
                count(n, "engaged")
            },
            count(n, "donationClicks"),
            count(n, "donations"),
            if num(&n["visits"]) != 0. {
                format!(
                    "{}%",
                    fixed(num(&n["donations"]) / num(&n["visits"]) * 100., 1)
                )
            } else {
                "—".into()
            },
            format!("€{}", fixed(num(&n["cents"]) / 100., 2)),
        ]
    };
    let mut known = json!({});
    let mut accounts = Vec::new();
    for (name, slugs) in [
        ("gabe.maxxing", vec!["tt", "tt-bio"]),
        ("gabinho_bjj", vec!["tt-bjj"]),
        ("gabriellvl", vec!["tt-g"]),
    ] {
        let mut n = json!({});
        for r in campaigns
            .iter()
            .filter(|r| slugs.contains(&text(r, "slug")))
        {
            for k in fields {
                n[k] = json!(num(&n[k]) + num(&r[k]));
            }
        }
        for k in fields {
            known[k] = json!(num(&known[k]) + num(&n[k]));
        }
        accounts.push(values(&format!("tiktok · {name}"), &n));
    }
    let mut names = Vec::new();
    for k in sources
        .as_object()
        .into_iter()
        .flatten()
        .chain(donations.as_object().into_iter().flatten())
        .map(|(k, _)| k.split(':').next().unwrap_or(""))
    {
        if !names.contains(&k) {
            names.push(k);
        }
    }
    let mut out = Vec::new();
    for source in names {
        let engaged: f64 = sources
            .as_object()
            .into_iter()
            .flatten()
            .filter(|(k, _)| {
                k.starts_with(&format!("{source}:"))
                    && !["view", "link_click", "donation_click", "donation_success"]
                        .contains(&k.split(':').nth(1).unwrap_or(""))
            })
            .map(|(_, n)| num(n))
            .sum();
        let mut n = json!({"clicks":num(&sources[format!("{source}:link_click")]),"visits":num(&sources[format!("{source}:view")]),"engaged":engaged,"donationClicks":num(&sources[format!("{source}:donation_click")]),"donations":num(&donations[format!("{source}:payments")]),"cents":num(&donations[format!("{source}:cents")])});
        if source == "tiktok" {
            for k in fields {
                n[k] = json!((num(&n[k]) - num(&known[k])).max(0.));
            }
            n["engaged"] = json!("—");
            if fields.iter().any(|k| *k != "engaged" && num(&n[*k]) != 0.) {
                out.push(values("tiktok · other / older links", &n));
            }
        } else {
            out.push(values(source, &n));
        }
    }
    out.extend(accounts);
    out
}
pub fn start(admin: bool) -> Result<(), JsValue> {
    client::start_compound_client()?;
    let state = Rc::new(RefCell::new(Desk {
        admin,
        ..Default::default()
    }));
    let s = state.clone();
    ui::listen(ui::element("login")?.as_ref(), "submit", move |e| {
        e.prevent_default();
        let s = s.clone();
        spawn_local(async move {
            let result=async{let form=ui::element("login")?.dyn_into::<HtmlFormElement>()?;let f=fields(&form)?;api(Some(json!({"action":"login","role":if admin{"admin"}else{"stats"},"password":f["password"]})),"").await?;form.reset();if admin{status("unlocked.");}refresh(&s).await;Ok::<_,JsValue>(())}.await;
            if let Err(e) = result {
                fail(e);
            }
        });
    })?;
    if admin {
        let s = state.clone();
        ui::listen(
            ui::element("label-version")?.as_ref(),
            "change",
            move |_| {
                if let Err(e) = labels(&s) {
                    fail(e);
                }
            },
        )?;
        let s = state.clone();
        ui::listen(ui::element("labels-form")?.as_ref(), "submit", move |e| {
            e.prevent_default();
            let s = s.clone();
            spawn_local(async move {
                let result=async{button("labels-form")?.set_disabled(true);let inputs=ui::element("item-labels")?.query_selector_all("input")?;let mut labels=Vec::new();for i in 0..inputs.length(){if let Some(e)=inputs.get(i).and_then(|e|e.dyn_into::<HtmlInputElement>().ok()){labels.push(json!({"id":e.get_attribute("data-item"),"label":e.value()}));}}api(Some(json!({"action":"rename_items","version":select("label-version")?.value(),"labels":labels})),"").await?;status("labels saved. viewers update within 30s.");refresh(&s).await;Ok::<_,JsValue>(())}.await;
                if let Ok(b) = button("labels-form") {
                    b.set_disabled(false);
                }
                if let Err(e) = result {
                    fail(e);
                }
            });
        })?;
        ui::listen(ui::element("poll-form")?.as_ref(), "submit", move |e| {
            e.prevent_default();
            spawn_local(async move {
                let result=async{let f=fields(&ui::element("poll-form")?.dyn_into::<HtmlFormElement>()?)?;let options=text(&f,"options").lines().map(corvus_core::impact::trimmed).filter(|s|!s.is_empty()).collect::<Vec<_>>();let r=api(Some(json!({"action":"live_poll","version":f["version"],"q":f["q"],"options":options})),"").await?;status(&format!("live now: {}",text(&r["poll"],"q")));Ok::<_,JsValue>(())}.await;
                if let Err(e) = result {
                    fail(e);
                }
            });
        })?;
        ui::listen(ui::element("revolut-form")?.as_ref(), "submit", move |e| {
            e.prevent_default();
            spawn_local(async move {
                let result=async{button("revolut-form")?.set_disabled(true);let f=fields(&ui::element("revolut-form")?.dyn_into::<HtmlFormElement>()?)?;let links:Value=serde_json::from_str(include_str!("../../../migration/compound-links.json")).map_err(|_|JsValue::NULL)?;let slug=text(&f,"slug");let amount=|key:&str|{let n=js_sys::Number::from(JsValue::from_str(text(&f,key))).value_of();((n*100.)+0.5).floor()};api(Some(json!({"action":"revolut","url":f["url"],"total":amount("total"),"late":amount("late"),"attribution":{"source":links[slug][0].as_str().unwrap_or("other"),"term":slug,"campaign":"compound-1000","content":if text(&f,"content").is_empty(){"manual-revolut"}else{text(&f,"content")}}})),"").await?;status("revolut total updated. the public bar refreshes within 30s.");Ok::<_,JsValue>(())}.await;
                if let Ok(b) = button("revolut-form") {
                    b.set_disabled(false);
                }
                if let Err(e) = result {
                    fail(e);
                }
            });
        })?;
        spawn_local(async move {
            let result = async {
                let w = web_sys::window().ok_or(JsValue::NULL)?;
                let url = web_sys::Url::new(&w.location().href()?)?;
                let q = url.search_params();
                if let Some(key) = q.get("key").filter(|s| !s.is_empty()) {
                    q.delete("key");
                    w.history()?.replace_state_with_url(
                        &JsValue::NULL,
                        "",
                        Some(&format!("{}{}{}", url.pathname(), url.search(), url.hash())),
                    )?;
                    if let Err(e) = api(
                        Some(json!({"action":"login","role":"admin","password":key})),
                        "",
                    )
                    .await
                    {
                        fail(e);
                    }
                }
                refresh(&state).await;
                Ok::<_, JsValue>(())
            }
            .await;
            if let Err(e) = result {
                fail(e);
            }
        });
    } else {
        let s = state.clone();
        ui::listen(ui::element("refresh")?.as_ref(), "click", move |_| load(&s))?;
        let s = state.clone();
        ui::listen(ui::element("version")?.as_ref(), "change", move |_| {
            if let Ok(v) = select("version") {
                s.borrow_mut().selected = v.value();
                load(&s);
            }
        })?;
        let s = state.clone();
        ui::listen(ui::element("touch")?.as_ref(), "change", move |_| {
            if let Some(d) = s.borrow().data.as_ref()
                && let Err(e) = campaigns(d)
            {
                fail(e);
            }
        })?;
        load(&state);
        let tick = Closure::wrap(Box::new(move || {
            if ui::doc().is_ok_and(|d| !d.hidden())
                && ui::element("private").is_ok_and(|e| !e.hidden())
            {
                load(&state);
            }
        }) as Box<dyn FnMut()>);
        web_sys::window()
            .ok_or(JsValue::NULL)?
            .set_interval_with_callback_and_timeout_and_arguments_0(
                tick.as_ref().unchecked_ref(),
                30000,
            )?;
        tick.forget();
    }
    Ok(())
}
