use super::*;
use std::{cell::RefCell, rc::Rc};
#[derive(Default)]
struct Public {
    members: Vec<Value>,
    claim: String,
}
type State = Rc<RefCell<Public>>;
fn reveal(hash: &str) -> Result<(), JsValue> {
    let mut el = ui::doc()?.get_element_by_id(hash.trim_start_matches('#'));
    while let Some(e) = el {
        if let Some(d) = e.dyn_ref::<web_sys::HtmlDetailsElement>() {
            d.set_open(true);
        }
        el = e.parent_element();
    }
    Ok(())
}
fn wall(s: &State) -> Result<(), JsValue> {
    let Ok(root) = ui::element("member-wall") else {
        return Ok(());
    };
    let q = ui::element("member-search")?
        .dyn_into::<HtmlInputElement>()?
        .value()
        .trim()
        .to_lowercase();
    let state = s.borrow();
    let members = state
        .members
        .iter()
        .filter(|m| {
            format!(
                "{} {} {}",
                text(m, "name"),
                text(m, "handle"),
                text(m, "rank")
            )
            .to_lowercase()
            .contains(&q)
        })
        .collect::<Vec<_>>();
    root.set_text_content(None);
    for m in &members {
        let c = node("article", "", "site-card member-card")?;
        append(&c, &node("b", text(m, "name"), "")?)?;
        append(
            &c,
            &node(
                "small",
                &format!(
                    "{}{}",
                    text(m, "rank"),
                    if text(m, "title").is_empty() {
                        String::new()
                    } else {
                        format!(" · {}", text(m, "title"))
                    }
                ),
                "site-tag",
            )?,
        )?;
        append(
            &c,
            &node(
                "p",
                &format!(
                    "since {}",
                    text(m, "joined_at").chars().take(10).collect::<String>()
                ),
                "site-fine",
            )?,
        )?;
        if !text(m, "spotlight_slug").is_empty() {
            let a = node("a", &format!("meet {} →", text(m, "name")), "")?;
            a.set_attribute(
                "href",
                &format!("/legion/senate/{}", text(m, "spotlight_slug")),
            )?;
            append(&c, &a)?;
        }
        append(&root, &c)?;
    }
    ui::text(
        "member-status",
        &if state.members.is_empty() {
            "The wall is waiting for its next name.".into()
        } else {
            format!("{} soldiers. Different worlds.", members.len())
        },
    );
    Ok(())
}
#[wasm_bindgen]
pub fn start_legion() -> Result<(), JsValue> {
    let doc = ui::doc()?;
    let Some(body) = doc.body() else {
        return Ok(());
    };
    if body.has_attribute("data-rust-legion") {
        return Ok(());
    }
    body.set_attribute("data-rust-legion", "")?;
    let links = doc.query_selector_all("a[href^='#']")?;
    for i in 0..links.length() {
        if let Some(a) = links.item(i).and_then(|n| n.dyn_into::<HtmlElement>().ok()) {
            let a2 = a.clone();
            ui::listen(a.as_ref(), "click", move |_| {
                report(reveal(&a2.get_attribute("href").unwrap_or_default()));
            })?;
        }
    }
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    ui::listen(w.as_ref(), "hashchange", move |_| {
        if let Some(w) = web_sys::window() {
            report(reveal(&w.location().hash().unwrap_or_default()));
        }
    })?;
    reveal(&w.location().hash()?)?;
    let state = State::default();
    if ui::element("member-wall").is_ok() {
        let s = state.clone();
        ui::listen(ui::element("member-search")?.as_ref(), "input", move |_| {
            report(wall(&s))
        })?;
        let s = state.clone();
        spawn_local(async move {
            let r = async {
                s.borrow_mut().members = rows(&api(None, "", false).await?, "members");
                wall(&s)
            }
            .await;
            if let Err(e) = r {
                ui::text("member-status", &ui::message(&e));
            }
        });
    }
    if let Ok(f) = form("tiro-form") {
        let form = f.clone();
        ui::listen(f.as_ref(), "submit", move |e| {
            e.prevent_default();
            if !form.report_validity() {
                return;
            }
            let Ok(b) = query(form.as_ref(), "button") else {
                return;
            };
            if b.has_attribute("disabled") {
                return;
            }
            disabled(&b, true);
            let f = form.clone();
            spawn_local(async move {
                let r=async{query(f.as_ref(),"[role=status]")?.set_text_content(Some("opening secure checkout…"));let d=api(Some(json!({"action":"checkout","email":get(&f,"email")?,"handle":get(&f,"handle")?})),"",false).await?;let url=url::Url::parse(text(&d,"url")).map_err(|_|JsValue::from_str("Checkout is reconnecting."))?;if url.scheme()!="https"||url.host_str()!=Some("buy.stripe.com")||!url.username().is_empty()||url.password().is_some(){return Err(JsValue::from_str("Checkout is reconnecting."));}web_sys::window().ok_or(JsValue::NULL)?.location().assign(url.as_str())}.await;
                if let Err(e) = r {
                    if let Ok(status) = query(f.as_ref(), "[role=status]") {
                        status.set_text_content(Some(&ui::message(&e)));
                    }
                    disabled(&b, false);
                }
            });
        })?;
    }
    if let Ok(f) = form("application-form") {
        let form = f.clone();
        let s = state.clone();
        ui::listen(f.as_ref(), "submit", move |e| {
            e.prevent_default();
            if !form.report_validity() {
                return;
            }
            let Ok(b) = query(form.as_ref(), "button") else {
                return;
            };
            if b.has_attribute("disabled") {
                return;
            }
            disabled(&b, true);
            let f = form.clone();
            let s = s.clone();
            spawn_local(async move {
                let r = async {
                    let mut body = admin::form_data(&f)?;
                    body["action"] = json!("apply");
                    body["claim"] = json!(s.borrow().claim);
                    let d = api(Some(body), "", false).await?;
                    query(f.as_ref(), "[role=status]")?.set_text_content(Some(text(&d, "message")));
                    f.reset();
                    Ok::<(), JsValue>(())
                }
                .await;
                if let Err(e) = r
                    && let Ok(status) = query(f.as_ref(), "[role=status]")
                {
                    status.set_text_content(Some(&ui::message(&e)));
                }
                disabled(&b, false);
            });
        })?;
    }
    if let Ok(b) = ui::element("claim-call") {
        ui::listen(b.as_ref(), "click", move |_| {
            report((|| {
                let f = form("application-form")?;
                set(&f, "source", "call")?;
                query(f.as_ref(), "button")?.set_text_content(Some("Send my call claim →"));
                field(&f, "why")?
                    .set_attribute("placeholder", "When did we speak, and what came out of it?")?;
                let reduced = web_sys::window()
                    .and_then(|w| {
                        w.match_media("(prefers-reduced-motion: reduce)")
                            .ok()
                            .flatten()
                    })
                    .is_some_and(|m| m.matches());
                ui::scroll("application-form", !reduced, false);
                Ok(())
            })());
        })?;
    }
    if let Ok(f) = form("puzzle-form") {
        let form = f.clone();
        let s = state.clone();
        ui::listen(f.as_ref(), "submit", move |e| {
            e.prevent_default();
            let Ok(b) = query(form.as_ref(), "button") else {
                return;
            };
            if b.has_attribute("disabled") {
                return;
            }
            disabled(&b, true);
            let f = form.clone();
            let s = s.clone();
            spawn_local(async move {
                let r = async {
                    let d = api(
                        Some(json!({"action":"puzzle","answer":get(&f,"answer")?})),
                        "",
                        false,
                    )
                    .await?;
                    s.borrow_mut().claim = text(&d, "claim").into();
                    f.set_hidden(true);
                    ui::hidden("hack-claim", false);
                    ui::scroll("hack-claim", false, false);
                    Ok::<(), JsValue>(())
                }
                .await;
                if let Err(e) = r
                    && let Ok(status) = query(f.as_ref(), "[role=status]")
                {
                    status.set_text_content(Some(&ui::message(&e)));
                }
                disabled(&b, false);
            });
        })?;
    }
    let params = web_sys::UrlSearchParams::new_with_str(&w.location().search()?)?;
    if let Some(paid) = params.get("paid").filter(|s| !s.is_empty())
        && let Ok(f) = form("tiro-form")
    {
        w.history()?.replace_state_with_url(
            &JsValue::NULL,
            "",
            Some(&format!("{}#enlist", w.location().pathname()?)),
        )?;
        query(f.as_ref(), "[role=status]")?.set_text_content(Some("checking your payment…"));
        spawn_local(async move {
            for i in 0..15 {
                let result =
                    api(None, &format!("?action=paid&session={}", enc(&paid)), false).await;
                if result.is_ok_and(|d| d["ok"] == true) {
                    let r=async{f.set_text_content(None);append(&f,&node("h2","you’re in. tiro.","")?)?;append(&f,&node("p","Your name is on the wall. Higher ranks start with what you do next.","")?)?;let a=node("a","Meet the legion →","site-button")?;a.set_attribute("href","#wall")?;append(&f,&a)?;state.borrow_mut().members=rows(&api(None,"?action=wall",false).await?,"members");wall(&state)}.await;
                    report(r);
                    return;
                }
                if i < 14 {
                    let _ = ui::sleep(2000).await;
                }
            }
            if let Ok(status) = query(f.as_ref(), "[role=status]") {
                status.set_text_content(Some("Your payment confirmation is taking a moment. Keep your receipt; Gabe can help at gabriel@corvus.gent."));
            }
        });
    }
    Ok(())
}
#[wasm_bindgen]
pub fn start_legion_letters() -> Result<(), JsValue> {
    let b = ui::element("letter-action")?;
    if b.has_attribute("data-rust-letters") {
        return Ok(());
    }
    b.set_attribute("data-rust-letters", "")?;
    let token = web_sys::UrlSearchParams::new_with_str(
        &web_sys::window()
            .ok_or(JsValue::NULL)?
            .location()
            .search()?,
    )?
    .get("token");
    let button = b.clone();
    ui::listen(b.as_ref(), "click", move |_| {
        if button.has_attribute("disabled") {
            return;
        }
        disabled(&button, true);
        let b = button.clone();
        let token = token.clone();
        spawn_local(async move {
            let r = async {
                let d = api(
                    Some(json!({"action":b.get_attribute("data-action"),"token":token})),
                    "",
                    false,
                )
                .await?;
                ui::text("letter-status", text(&d, "message"));
                b.set_hidden(true);
                let w = web_sys::window().ok_or(JsValue::NULL)?;
                w.history()?.replace_state_with_url(
                    &JsValue::NULL,
                    "",
                    Some(&w.location().pathname()?),
                )
            }
            .await;
            if let Err(e) = r {
                ui::text("letter-status", &ui::message(&e));
                disabled(&b, false);
            }
        });
    })
}
