use super::*;
use std::{cell::RefCell, rc::Rc};
#[derive(Default)]
struct Admin {
    generation: u64,
    listeners: Vec<ui::Listener>,
}
thread_local! {static STATE:Rc<RefCell<Admin>>=Rc::new(RefCell::new(Admin::default()));}
fn action(
    state: Rc<RefCell<Admin>>,
    slug: &str,
    label: &str,
    action: &str,
    value: Value,
    message: &HtmlElement,
) -> Result<HtmlElement, JsValue> {
    let b = node("button", label, "site-button secondary")?;
    let button = b.clone();
    let message = message.clone();
    let slug = slug.to_string();
    let action = action.to_string();
    let generation = state.borrow().generation;
    let s = state.clone();
    let listener = ui::scoped_listener(b.as_ref(), "click", move |_| {
        if s.borrow().generation != generation || button.get_attribute("disabled").is_some() {
            return;
        }
        disabled(&button, true);
        let s = s.clone();
        let message = message.clone();
        let button = button.clone();
        let body = json!({"action":action,"slug":slug,"value":value});
        spawn_local(async move {
            let r = async {
                api(Some(body), "", true).await?;
                if s.borrow().generation == generation {
                    render(s.clone()).await?;
                }
                Ok::<(), JsValue>(())
            }
            .await;
            if s.borrow().generation == generation
                && let Err(e) = r
            {
                message.set_text_content(Some(&ui::message(&e)));
                disabled(&button, false);
            }
        });
    })?;
    state.borrow_mut().listeners.push(listener);
    Ok(b)
}
async fn render(state: Rc<RefCell<Admin>>) -> Result<(), JsValue> {
    let generation = {
        let mut s = state.borrow_mut();
        s.generation += 1;
        s.generation
    };
    let root = if let Ok(r) = ui::element("admin-senate") {
        r
    } else {
        let r = node("section", "", "")?;
        r.set_id("admin-senate");
        ui::element("admin-invites")?.after_with_node_1(&r)?;
        r
    };
    match api(None, "&action=admin", true).await {
        Ok(d) => {
            if state.borrow().generation != generation {
                return Ok(());
            }
            state.borrow_mut().listeners.clear();
            root.set_text_content(None);
            append(&root, &node("h2", "honorary seats.", "")?)?;
            for p in rows(&d, "profiles") {
                let card = node("article", "", "site-card")?;
                let a = node(
                    "a",
                    &format!("{} · Senator: {}", text(&p, "name"), text(&p, "title")),
                    "",
                )?;
                a.set_attribute("href", &format!("/legion/senate/{}", text(&p, "slug")))?;
                a.set_attribute("target", "_blank")?;
                a.set_attribute("rel", "noopener noreferrer")?;
                append(&card, &a)?;
                append(
                    &card,
                    &node(
                        "p",
                        &format!(
                            "{} · edit link {} · {}",
                            text(&p, "status"),
                            text(&p, "edit_status"),
                            if p["locked"] == true {
                                "locked"
                            } else {
                                "editable"
                            }
                        ),
                        "site-fine",
                    )?,
                )?;
                let clicks = p["counts"]
                    .as_object()
                    .map(|m| {
                        m.iter()
                            .filter(|(k, _)| k.as_str() != "view")
                            .map(|(_, v)| v.as_f64().unwrap_or(0.))
                            .sum::<f64>()
                    })
                    .unwrap_or(0.);
                append(
                    &card,
                    &node(
                        "p",
                        &format!(
                            "views: {} · link clicks: {}",
                            p["counts"]["view"].as_f64().unwrap_or(0.),
                            clicks
                        ),
                        "site-fine",
                    )?,
                )?;
                let message = node("p", "", "site-status")?;
                if text(&p, "status") == "active" {
                    append(
                        &card,
                        &action(
                            state.clone(),
                            text(&p, "slug"),
                            if p["locked"] == true {
                                "Unlock editing"
                            } else {
                                "Lock editing"
                            },
                            "lock",
                            json!(p["locked"] != true),
                            &message,
                        )?,
                    )?;
                    if text(&p, "edit_status") == "active" {
                        append(
                            &card,
                            &action(
                                state.clone(),
                                text(&p, "slug"),
                                "Revoke private edit link",
                                "revoke_edit",
                                Value::Null,
                                &message,
                            )?,
                        )?;
                    }
                }
                let versions = rows(&p, "versions");
                let history = node("details", "", "")?;
                append(
                    &history,
                    &node("summary", &format!("Versions · {}", versions.len()), "")?,
                )?;
                for v in versions.iter().rev() {
                    let revision = v["revision"].as_u64().unwrap_or(0);
                    let row = node(
                        "p",
                        &format!(
                            "v{revision} · {} · {} ",
                            text(v, "by"),
                            date(text(v, "at"), "toLocaleString")
                        ),
                        "",
                    )?;
                    if v["revision"] != p["revision"] {
                        append(
                            &row,
                            &action(
                                state.clone(),
                                text(&p, "slug"),
                                &format!("Restore v{revision}"),
                                "revert",
                                v["revision"].clone(),
                                &message,
                            )?,
                        )?;
                    }
                    append(&history, &row)?;
                }
                append(&card, &history)?;
                append(&card, &message)?;
                append(&root, &card)?;
            }
        }
        Err(e) => {
            if state.borrow().generation == generation {
                root.set_text_content(Some(&ui::message(&e)));
            }
            return Err(e);
        }
    }
    Ok(())
}
#[wasm_bindgen]
pub async fn render_senate_admin() -> Result<(), JsValue> {
    let s = STATE.with(Clone::clone);
    render(s).await
}
#[wasm_bindgen]
pub fn clear_senate_admin() {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.generation += 1;
        s.listeners.clear();
    });
    if let Ok(r) = ui::element("admin-senate") {
        r.remove();
    }
}
