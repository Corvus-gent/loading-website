//! Impact scorecard browser behavior. The original HTML/CSS and copy stay assets.
pub mod admin;
use crate::ui;
use corvus_core::{army::truthy, impact as core, metrics};
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{HtmlElement, HtmlImageElement, HtmlSelectElement};

#[derive(Default)]
struct State {
    data: Option<Value>,
    loading: bool,
    listeners: Vec<ui::Listener>,
}
fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
fn node(tag: &str, text: &str, class: &str) -> Result<HtmlElement, JsValue> {
    let el = ui::doc()?.create_element(tag)?.dyn_into::<HtmlElement>()?;
    el.set_text_content(Some(text));
    if !class.is_empty() {
        el.set_class_name(class);
    }
    Ok(el)
}
fn append(
    parent: &impl AsRef<web_sys::Node>,
    child: &impl AsRef<web_sys::Node>,
) -> Result<(), JsValue> {
    parent.as_ref().append_child(child.as_ref()).map(|_| ())
}
fn select(id: &str) -> Result<HtmlSelectElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
fn value(id: &str) -> String {
    select(id).map(|e| e.value()).unwrap_or_default()
}
fn name(platform: &str) -> &str {
    core::config()["accounts"][platform]["name"]
        .as_str()
        .unwrap_or("")
}
fn icon(p: &str) -> &str {
    match p {
        "tt" => "♪",
        "ig" => "◎",
        "x" => "𝕏",
        "li" => "in",
        "yt" => "▶",
        "tw" => "▣",
        _ => "",
    }
}
fn label(p: &Value, k: &str) -> String {
    if k == "views" && p["view_metric"] == "impressions" {
        "impressions".into()
    } else {
        core::config()["labels"][text(p, "platform")][k]
            .as_str()
            .unwrap_or(k)
            .into()
    }
}
fn locale(object: &JsValue, method: &str, locale: Option<&str>, options: &Value) -> String {
    let result = (|| -> Result<JsValue, JsValue> {
        let receiver = if object.as_f64().is_some() {
            let constructor = js_sys::Reflect::get(&js_sys::global(), &"Number".into())?;
            js_sys::Reflect::get(&constructor, &"prototype".into())?
        } else {
            object.clone()
        };
        let f = js_sys::Reflect::get(&receiver, &JsValue::from_str(method))?
            .dyn_into::<js_sys::Function>()?;
        f.call2(
            object,
            &locale.map(JsValue::from_str).unwrap_or(JsValue::UNDEFINED),
            &js_sys::JSON::parse(&options.to_string())?,
        )
    })();
    result.ok().and_then(|v| v.as_string()).unwrap_or_default()
}
fn fmt(n: Option<f64>) -> String {
    n.map(|n| {
        locale(
            &js_sys::Number::from(n),
            "toLocaleString",
            Some("en-US"),
            &json!({"maximumFractionDigits":1}),
        )
    })
    .unwrap_or_else(|| "—".into())
}
fn date(raw: &str) -> String {
    if raw.is_empty() {
        "date not recorded".into()
    } else {
        locale(
            &js_sys::Date::new(&raw.into()),
            "toLocaleDateString",
            Some("en-GB"),
            &json!({"day":"numeric","month":"short","year":"numeric"}),
        )
    }
}
fn external(label: &str, href: &str, class: &str) -> Result<HtmlElement, JsValue> {
    let el = node("a", label, class)?;
    el.set_attribute("href", href)?;
    el.set_attribute("target", "_blank")?;
    el.set_attribute("rel", "noopener noreferrer")?;
    Ok(el)
}
fn embed_url(p: &Value) -> Option<String> {
    let u = url::Url::parse(text(p, "post_url")).ok()?;
    let id = u.path().split('/').next_back().unwrap_or("");
    match text(p, "platform") {
        "x" => Some(format!(
            "https://platform.twitter.com/embed/Tweet.html?id={id}&theme=dark"
        )),
        "tt" => Some(format!("https://www.tiktok.com/player/v1/{id}")),
        "ig" => Some(format!(
            "{}{}{}",
            u.origin().ascii_serialization(),
            u.path().trim_end_matches('/'),
            "/embed/"
        )),
        "yt" => Some(format!(
            "https://www.youtube-nocookie.com/embed/{}",
            u.query_pairs()
                .find(|(k, _)| k == "v")
                .map(|(_, v)| v.into_owned())
                .unwrap_or_else(|| "null".into())
        )),
        _ => ["urn:li:activity:", "activity-"].iter().find_map(|prefix| {
            let at = u.path().find(prefix)? + prefix.len();
            let id = u.path()[at..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect::<String>();
            (!id.is_empty())
                .then(|| format!("https://www.linkedin.com/embed/feed/update/urn:li:activity:{id}"))
        }),
    }
}
fn metric(parent: &HtmlElement, name: &str, value: &str, tip: &str) -> Result<(), JsValue> {
    let el = node("div", "", "")?;
    append(&el, &node("strong", value, "")?)?;
    append(&el, &node("span", name, "")?)?;
    if !tip.is_empty() {
        el.set_title(tip);
        el.set_attribute("aria-label", &format!("{name}: {value}. {tip}"))?;
        el.set_tab_index(0);
    }
    append(parent, &el)
}
fn post(
    p: &Value,
    index: usize,
    winner: bool,
    listeners: &mut Vec<ui::Listener>,
) -> Result<HtmlElement, JsValue> {
    let platform = text(p, "platform");
    let article = node(
        "article",
        "",
        if winner {
            "impact-post winner"
        } else {
            "impact-post"
        },
    )?;
    let art = node("div", "", "post-art")?;
    let thumb = external("", text(p, "post_url"), "post-thumb")?;
    if !text(p, "thumbnail_url").is_empty() {
        let img = HtmlImageElement::new()?;
        img.set_src(text(p, "thumbnail_url"));
        img.set_alt(if text(p, "label").is_empty() {
            "Video thumbnail"
        } else {
            text(p, "label")
        });
        img.set_attribute("loading", "lazy")?;
        img.set_referrer_policy("no-referrer");
        let t = thumb.clone();
        let platform = platform.to_owned();
        listeners.push(ui::scoped_listener(img.as_ref(), "error", move |_| {
            t.set_text_content(None);
            if let Ok(n) = node("span", icon(&platform), "") {
                let _ = append(&t, &n);
            }
        })?);
        append(&thumb, &img)?;
    } else {
        append(&thumb, &node("span", icon(platform), "")?)?;
    }
    thumb.set_attribute("aria-label", &format!("Open post on {}", name(platform)))?;
    append(&art, &thumb)?;
    if let Some(src) = embed_url(p) {
        let button = node("button", "load post", "button")?;
        let a = article.clone();
        let b = button.clone();
        let account = text(p, "account").to_owned();
        listeners.push(ui::scoped_listener(button.as_ref(),"click",move |_| {
            let _=(||->Result<(),JsValue>{let wrap=node("div","","post-embed")?;let frame=node("iframe","","")?;for(k,v)in[("src",src.as_str()),("title",&format!("Post by {account}")),("loading","lazy"),("allow","fullscreen"),("referrerpolicy","no-referrer")]{frame.set_attribute(k,v)?;}append(&wrap,&frame)?;append(&wrap,&node("p","External player · the platform may use cookies. If it cannot load, use “open post”.","small muted")?)?;append(&a,&wrap)?;b.set_attribute("disabled","")?;b.set_text_content(Some("loaded"));Ok(())})();
        })?);
        append(&art, &button)?;
    }
    let body = node("div", "", "")?;
    let title = node("div", "", "post-title")?;
    let caption = if text(p, "label").is_empty() {
        format!("a cut from {}", text(p, "account"))
    } else {
        text(p, "label").into()
    };
    append(
        &title,
        &node("h3", &format!("{:02} / {caption}", index + 1), "")?,
    )?;
    if winner {
        append(&title, &node("span", "💎 most viral", "post-badge")?)?;
    }
    append(&body, &title)?;
    append(
        &body,
        &node(
            "p",
            &format!(
                "{} {} · {} · {}",
                icon(platform),
                name(platform),
                if text(p, "account").is_empty() {
                    "account not recorded"
                } else {
                    text(p, "account")
                },
                date(text(p, "posted_at"))
            ),
            "post-meta",
        )?,
    )?;
    let code = if text(p, "vote_code").is_empty() {
        "original video"
    } else {
        text(p, "vote_code")
    };
    let slug = if text(p, "slug").is_empty() {
        String::new()
    } else {
        format!(" · {}", text(p, "slug"))
    };
    append(
        &body,
        &node(
            "p",
            &format!("✨ made with Compound · {code}{slug}"),
            "post-badge",
        )?,
    )?;
    append(
        &body,
        &node(
            "p",
            &format!("{} · {}", text(p, "post_type"), text(p, "media_type")),
            "post-meta",
        )?,
    )?;
    let c = serde_json::from_value::<metrics::Coverage>(p["coverage"].clone())
        .unwrap_or_else(|_| metrics::coverage(p));
    let numbers = node("div", "", "post-numbers")?;
    let mut sources = Vec::new();
    let missing = c
        .missing
        .iter()
        .map(|k| label(p, k))
        .collect::<Vec<_>>()
        .join(", ");
    for &k in metrics::FIELDS {
        let source = p["field_sources"][k]
            .as_str()
            .filter(|s| !s.is_empty())
            .or_else(|| p["metric_source"].as_str().filter(|s| !s.is_empty()))
            .unwrap_or("unknown");
        let kind = core::source_kind(source);
        let source = format!(
            "{} · {source}",
            if kind == "manual" {
                "self-reported (manual)"
            } else {
                kind
            }
        );
        if c.known.iter().any(|v| v == k) && !sources.contains(&source) {
            sources.push(source.clone());
        }
        let unsupported = c.unsupported.iter().any(|v| v == k);
        let value = if unsupported {
            "n/a".into()
        } else {
            fmt(p[k].as_f64())
        };
        let tip = if unsupported {
            format!("not exposed by {}", name(platform))
        } else if p[k].is_null() {
            "No measurement available for this post.".into()
        } else {
            source
        };
        metric(&numbers, &label(p, k), &value, &tip)?;
    }
    metric(
        &numbers,
        if c.partial {
            "score (partial)"
        } else {
            "score"
        },
        &fmt(p["score"].as_f64()),
        &if c.partial {
            format!("Missing: {missing}")
        } else {
            "All applicable metrics measured.".into()
        },
    )?;
    let v = &p["first24_sample"];
    let partial = v["partial"] == true || (!truthy(v) && !p["velocity"].is_null() && c.partial);
    let tip = if p["velocity"].is_null() {
        "No measurement with a verified timestamp in the first 24 hours.".into()
    } else if truthy(v) {
        format!(
            "Measured {}{}",
            ui::date(text(v, "at")),
            if v["partial"] == true {
                format!(
                    "; missing: {}",
                    v["missing"]
                        .as_array()
                        .map(|a| a
                            .iter()
                            .filter_map(Value::as_str)
                            .collect::<Vec<_>>()
                            .join(", "))
                        .unwrap_or_default()
                )
            } else {
                String::new()
            }
        )
    } else {
        "Saved first-day measurement.".into()
    };
    metric(
        &numbers,
        &format!(
            "score / h · first 24h{}",
            if partial { " (partial)" } else { "" }
        ),
        &fmt(p["velocity"].as_f64()),
        &tip,
    )?;
    append(&body, &numbers)?;
    let measured = if !text(p, "measured_date").is_empty() {
        text(p, "measured_date").into()
    } else if !text(p, "metrics_at").is_empty() {
        ui::date(text(p, "metrics_at"))
    } else {
        "not recorded".into()
    };
    append(
        &body,
        &node(
            "p",
            &format!("{} · measured {measured}", sources.join(" / ")),
            "post-bottom",
        )?,
    )?;
    append(
        &body,
        &external("open post ↗", text(p, "post_url"), "small")?,
    )?;
    if c.partial {
        append(
            &body,
            &node(
                "p",
                &format!("Partial score · missing: {missing}."),
                "post-bottom",
            )?,
        )?;
    }
    append(&article, &art)?;
    append(&article, &body)?;
    Ok(article)
}
fn rows(data: &Value) -> &[Value] {
    data["posts"].as_array().map(Vec::as_slice).unwrap_or(&[])
}
fn selected(data: &Value) -> Vec<Value> {
    core::filtered(rows(data), &value("platform"), &value("account"))
}
fn leaderboard(state: &Rc<RefCell<State>>) -> Result<(), JsValue> {
    let mut s = state.borrow_mut();
    let Some(data) = s.data.as_ref() else {
        return Ok(());
    };
    let mut posts = selected(data);
    let sort = value("sort");
    posts.sort_by(|a, b| {
        b[&sort]
            .as_f64()
            .unwrap_or(-1.0)
            .total_cmp(&a[&sort].as_f64().unwrap_or(-1.0))
            .then_with(|| text(a, "id").cmp(text(b, "id")))
    });
    let highest = posts
        .iter()
        .filter_map(|p| p["score"].as_f64())
        .fold(0.0, f64::max);
    let container = ui::element("post-list")?;
    container.set_text_content(None);
    s.listeners.clear();
    for (i, p) in posts.iter().enumerate() {
        append(
            &container,
            &post(
                p,
                i,
                p["score"].as_f64() == Some(highest) && highest > 0.0,
                &mut s.listeners,
            )?,
        )?;
    }
    if posts.is_empty() {
        let empty = match value("platform").as_str() {
            "yt" => "YouTube is coming soon.",
            "li" => {
                "No LinkedIn video URLs have been imported for this account yet. LinkedIn is not connected: the owner adds original video links and self-reported metrics."
            }
            _ => {
                "No verified videos imported for this account yet. This doesn't mean there are no posts on the platform."
            }
        };
        append(&container, &node("p", empty, "small muted")?)?;
    }
    ui::text(
        "list-count",
        &format!(
            "{} published posts · top badge follows the highest reported score",
            posts.len()
        ),
    );
    Ok(())
}
fn total(posts: &[Value], field: &str) -> Option<f64> {
    if posts.is_empty() {
        return Some(0.0);
    }
    let ns = posts
        .iter()
        .filter_map(|p| {
            if field == "engagements" {
                metrics::engagements(p)
            } else {
                p[field].as_f64()
            }
        })
        .collect::<Vec<_>>();
    (!ns.is_empty()).then(|| ns.iter().sum())
}
fn totals(data: &Value) -> Result<(), JsValue> {
    let posts = selected(data);
    let totals = ui::element("impact-totals")?;
    totals.set_text_content(None);
    for (n, label) in [
        (
            total(&posts, "views"),
            if posts.iter().any(|p| p["view_metric"] == "impressions") {
                "reported views / impressions"
            } else {
                "reported views"
            },
        ),
        (total(&posts, "engagements"), "engagements"),
        (Some(posts.len() as f64), "published videos"),
        (
            total(&posts, "score"),
            if posts.iter().any(|p| metrics::coverage(p).partial) {
                "score (partial)"
            } else {
                "viral score"
            },
        ),
    ] {
        metric(&totals, label, &fmt(n), "")?;
    }
    let container = ui::element("platform-totals")?;
    container.set_text_content(None);
    // Preserve the product's configured platform order.
    for id in ["tt", "ig", "x", "li", "tw", "yt"] {
        let posts = rows(data)
            .iter()
            .filter(|p| p["platform"] == id && truthy(&p["made_with_compound"]))
            .cloned()
            .collect::<Vec<_>>();
        let el = node("div", "", "platform-total")?;
        append(&el, &node("b", &format!("{} {}", icon(id), name(id)), "")?)?;
        append(&el, &node("strong", &fmt(total(&posts, "views")), "")?)?;
        append(
            &el,
            &node(
                "span",
                &format!(
                    "{} · {} posts",
                    if posts.iter().any(|p| p["view_metric"] == "impressions") {
                        "reported views / impressions"
                    } else {
                        "reported views"
                    },
                    posts.len()
                ),
                "",
            )?,
        )?;
        append(&el, &node("br", "", "")?)?;
        append(
            &el,
            &node(
                "span",
                &format!("{} engagements", fmt(total(&posts, "engagements"))),
                "",
            )?,
        )?;
        append(&container, &el)?;
    }
    ui::text(
        "click-headline",
        &format!(
            "{} clicks through to Compound.",
            fmt(data["clicks"]["total"].as_f64())
        ),
    );
    let clicks = data["clicks"]["rows"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let max = clicks
        .iter()
        .filter_map(|r| r["total"].as_f64())
        .fold(1.0, f64::max);
    let container = ui::element("click-sources")?;
    container.set_text_content(None);
    for r in clicks {
        let row = node("div", "", "click-row")?;
        let bar = node("span", "", "click-bar")?;
        let fill = node("i", "", "")?;
        fill.style().set_property(
            "width",
            &format!("{}%", r["total"].as_f64().unwrap_or(0.0) / max * 100.0),
        )?;
        append(&bar, &fill)?;
        append(
            &row,
            &node("span", &text(r, "id").replacen("compound-", "", 1), "")?,
        )?;
        append(&row, &bar)?;
        append(&row, &node("b", &fmt(r["total"].as_f64()), "")?)?;
        append(&container, &row)?;
    }
    if clicks.is_empty() {
        append(
            &container,
            &node("p", "First click starts the story.", "small muted")?,
        )?;
    }
    Ok(())
}
fn graph(data: &Value) -> Result<(), JsValue> {
    let rows = data["history"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    let container = ui::element("growth")?;
    container.set_text_content(None);
    if rows.len() < 2 {
        append(
            &container,
            &node(
                "p",
                if rows.is_empty() {
                    "The first saved measurement is on its way. No invented history."
                } else {
                    "First snapshot saved. The next point arrives with a metric edit or the next scheduled check."
                },
                "empty",
            )?,
        )?;
        return Ok(());
    }
    let last = &rows[rows.len() - 1];
    let start = js_sys::Date::parse(text(&rows[0], "at"));
    let duration = (js_sys::Date::parse(text(last, "at")) - start).max(1.0);
    for field in ["views", "score"] {
        let max = rows
            .iter()
            .filter_map(|r| r[field].as_f64())
            .fold(1.0, f64::max);
        let points = rows
            .iter()
            .filter(|r| {
                r[field].as_f64().is_some()
                    && (field != "views"
                        || r["views"].as_f64().unwrap_or(0.0) > 0.0
                        || !r["views_reported"].is_null())
            })
            .map(|r| {
                format!(
                    "{},{}",
                    (js_sys::Date::parse(text(r, "at")) - start) / duration * 440.0 + 10.0,
                    160.0 - r[field].as_f64().unwrap_or(0.0) / max * 135.0
                )
            })
            .collect::<Vec<_>>()
            .join(" ");
        let svg = ui::doc()?.create_element_ns(Some("http://www.w3.org/2000/svg"), "svg")?;
        svg.set_attribute("viewBox", "0 0 460 200")?;
        svg.set_attribute("role", "img")?;
        svg.set_attribute(
            "aria-label",
            &format!("{field} over {} saved measurements", rows.len()),
        )?;
        let path = ui::doc()?.create_element_ns(Some("http://www.w3.org/2000/svg"), "polyline")?;
        for (k, v) in [
            ("points", points.as_str()),
            ("fill", "none"),
            (
                "stroke",
                if field == "views" {
                    "#8bd9ff"
                } else {
                    "#ffd76a"
                },
            ),
            ("stroke-width", "3"),
        ] {
            path.set_attribute(k, v)?;
        }
        append(&svg, &path)?;
        let figure = node("figure", "", "")?;
        append(
            &figure,
            &node(
                "figcaption",
                &format!("{} {field}", fmt(last[field].as_f64())),
                "",
            )?,
        )?;
        append(&figure, &svg)?;
        append(
            &figure,
            &node(
                "p",
                &format!(
                    "{} → {}",
                    ui::date(text(&rows[0], "at")),
                    ui::date(text(last, "at"))
                ),
                "small muted",
            )?,
        )?;
        append(&container, &figure)?;
    }
    Ok(())
}
async fn fetch() -> Result<Value, JsValue> {
    let options = web_sys::RequestInit::new();
    options.set_cache(web_sys::RequestCache::NoStore);
    options.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(12000)));
    let request = web_sys::Request::new_with_str_and_init("/api/compound-v2?impact=1", &options)?;
    let response = JsFuture::from(
        web_sys::window()
            .ok_or(JsValue::NULL)?
            .fetch_with_request(&request),
    )
    .await?
    .dyn_into::<web_sys::Response>()?;
    if !response.ok() {
        return Err(JsValue::NULL);
    }
    let body = JsFuture::from(response.text()?)
        .await?
        .as_string()
        .unwrap_or_default();
    let data: Value = serde_json::from_str(&body).map_err(|_| JsValue::NULL)?;
    if !data["posts"].is_array() || !truthy(&data["totals"]) || !truthy(&data["clicks"]) {
        return Err(JsValue::NULL);
    }
    Ok(data)
}
fn watchdog(loaded: bool) {
    if let Some(w) = web_sys::window() {
        let _ = js_sys::Reflect::set(&w, &"impactLoaded".into(), &JsValue::from_bool(loaded));
        if let Ok(id) = js_sys::Reflect::get(&w, &"impactWatchdog".into())
            && let Some(id) = id.as_f64()
        {
            w.clear_timeout_with_handle(id as i32);
        }
    }
}
fn load(state: Rc<RefCell<State>>) {
    if state.borrow().loading {
        return;
    }
    state.borrow_mut().loading = true;
    spawn_local(async move {
        let result = async {
            let data = fetch().await?;
            totals(&data)?;
            graph(&data)?;
            state.borrow_mut().data = Some(data.clone());
            leaderboard(&state)?;
            watchdog(true);
            ui::text(
                "data-status",
                &format!(
                    "✦ Scorecard checked {} · {}/{} videos have reported views",
                    locale(
                        &js_sys::Date::new_0(),
                        "toLocaleTimeString",
                        None,
                        &json!({})
                    ),
                    rows(&data).iter().filter(|p| !p["views"].is_null()).count(),
                    rows(&data).len()
                ),
            );
            ui::hidden("retry", true);
            Ok::<_, JsValue>(())
        }
        .await;
        if result.is_err() {
            watchdog(state.borrow().data.is_some());
            ui::text(
                "data-status",
                if state.borrow().data.is_some() {
                    "Update unavailable. Showing the last loaded figures."
                } else {
                    "Could not load the figures. Please retry."
                },
            );
            ui::hidden("retry", false);
        }
        state.borrow_mut().loading = false;
    });
}
fn accounts(preferred: &str) -> Result<(), JsValue> {
    let p = value("platform");
    ui::hidden("account-field", p.is_empty());
    let select = select("account")?;
    select.set_text_content(None);
    let option = node("option", "all accounts", "")?;
    option.set_attribute("value", "")?;
    append(&select, &option)?;
    if let Some(handles) = core::config()["accounts"][&p]["handles"].as_array() {
        for h in handles
            .iter()
            .filter_map(Value::as_str)
            .filter(|s| !s.is_empty())
        {
            let opt = node("option", &format!("@{h}"), "")?;
            opt.set_attribute("value", h)?;
            append(&select, &opt)?;
        }
    }
    select.set_value(preferred);
    if select.selected_index() < 0 {
        select.set_value("");
    }
    Ok(())
}
fn refresh(state: &Rc<RefCell<State>>) -> Result<(), JsValue> {
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let url = web_sys::Url::new(&w.location().href()?)?;
    let query = url.search_params();
    let p = value("platform");
    let a = value("account");
    if p.is_empty() {
        query.delete("platform")
    } else {
        query.set(
            "platform",
            core::config()["accounts"][&p]["query"]
                .as_str()
                .unwrap_or(""),
        );
    }
    if p.is_empty() || a.is_empty() {
        query.delete("account")
    } else {
        query.set("account", &a)
    }
    w.history()?
        .replace_state_with_url(&JsValue::NULL, "", Some(&url.href()))?;
    if let Some(data) = &state.borrow().data {
        totals(data)?;
    }
    leaderboard(state)
}
#[wasm_bindgen]
pub fn start_impact() -> Result<(), JsValue> {
    let root = ui::element("post-list")?;
    if root.has_attribute("data-rust-impact") {
        return Ok(());
    }
    root.set_attribute("data-rust-impact", "")?;
    let state = Rc::new(RefCell::new(State::default()));
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let query = web_sys::UrlSearchParams::new_with_str(&w.location().search()?)?;
    let platform = core::platform_id(&json!(query.get("platform").unwrap_or_default()));
    select("platform")?.set_value(&platform);
    accounts(&core::account_handle(
        &platform,
        &json!(query.get("account").unwrap_or_default()),
    ))?;
    for id in ["platform", "account", "sort"] {
        let state = state.clone();
        ui::listen(ui::element(id)?.as_ref(), "change", move |_| {
            if id == "platform" {
                let _ = accounts("");
            }
            let _ = if id == "sort" {
                leaderboard(&state)
            } else {
                refresh(&state)
            };
        })?;
    }
    let retry = state.clone();
    ui::listen(ui::element("retry")?.as_ref(), "click", move |_| {
        load(retry.clone())
    })?;
    ui::text(
        "formula",
        &format!(
            "{} = viral score",
            metrics::FIELDS
                .iter()
                .map(|k| format!("{k} × {}", metrics::weight(k)))
                .collect::<Vec<_>>()
                .join(" + ")
        ),
    );
    load(state.clone());
    let timer = Closure::<dyn FnMut()>::new(move || {
        if ui::doc().is_ok_and(|d| !d.hidden()) {
            load(state.clone());
        }
    });
    w.set_interval_with_callback_and_timeout_and_arguments_0(
        timer.as_ref().unchecked_ref(),
        60000,
    )?;
    timer.forget();
    Ok(())
}
