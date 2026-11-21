//! Owner form behavior in WASM; the unchanged static form is generated from the legacy template.
use super::{append, name, node, text};
use crate::ui;
use corvus_core::{army::truthy, impact::config};
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::spawn_local;
use web_sys::{
    HtmlButtonElement, HtmlElement, HtmlFormElement, HtmlInputElement, HtmlSelectElement,
    HtmlTextAreaElement,
};
#[derive(Default)]
struct Admin {
    generation: u64,
    lifetime: u64,
    form_listeners: Vec<ui::Listener>,
    listeners: Vec<ui::Listener>,
}
type State = Rc<RefCell<Admin>>;
thread_local! { static STATE:State=Rc::new(RefCell::new(Admin::default())); }
fn listen_form(
    state: &State,
    target: &web_sys::EventTarget,
    event: &str,
    callback: impl FnMut(web_sys::Event) + 'static,
) -> Result<(), JsValue> {
    let listener = ui::scoped_listener(target, event, callback)?;
    state.borrow_mut().form_listeners.push(listener);
    Ok(())
}
fn field(form: &str, key: &str) -> Result<web_sys::Element, JsValue> {
    ui::element(form)?
        .query_selector(&format!("[name={key}]"))?
        .ok_or_else(|| JsValue::from_str("Missing field"))
}
fn value(form: &str, key: &str) -> Result<String, JsValue> {
    let e = field(form, key)?;
    Ok(if let Some(e) = e.dyn_ref::<HtmlTextAreaElement>() {
        e.value()
    } else if let Some(e) = e.dyn_ref::<HtmlSelectElement>() {
        e.value()
    } else {
        e.dyn_into::<HtmlInputElement>()?.value()
    })
}
fn set(form: &str, key: &str, v: &str) -> Result<(), JsValue> {
    let e = field(form, key)?;
    if let Some(e) = e.dyn_ref::<HtmlTextAreaElement>() {
        e.set_value(v)
    } else if let Some(e) = e.dyn_ref::<HtmlSelectElement>() {
        e.set_value(v)
    } else {
        e.dyn_into::<HtmlInputElement>()?.set_value(v)
    }
    Ok(())
}
fn checked(form: &str, key: &str) -> Result<bool, JsValue> {
    Ok(field(form, key)?.dyn_into::<HtmlInputElement>()?.checked())
}
fn check(form: &str, key: &str, v: bool) -> Result<(), JsValue> {
    field(form, key)?
        .dyn_into::<HtmlInputElement>()?
        .set_checked(v);
    Ok(())
}
fn fields(form: &str) -> Result<Value, JsValue> {
    let form = ui::element(form)?.dyn_into::<HtmlFormElement>()?;
    let data = web_sys::FormData::new_with_form(&form)?;
    let mut out = serde_json::Map::new();
    if let Some(iter) = js_sys::try_iter(&data)? {
        for pair in iter {
            let pair = js_sys::Array::from(&pair?);
            if let Some(key) = pair.get(0).as_string() {
                out.insert(key, json!(pair.get(1).as_string().unwrap_or_default()));
            }
        }
    }
    Ok(Value::Object(out))
}
async fn request(body: Option<Value>) -> Result<Value, JsValue> {
    let url = if body.is_some() {
        "/api/compound-v2?impact=1"
    } else {
        "/api/compound-v2?impact=1&private=1"
    };
    let (ok, data) = ui::json(url, body, None, 60000).await?;
    if !ok {
        return Err(JsValue::from_str(
            data["error"].as_str().unwrap_or("Request failed."),
        ));
    }
    Ok(data)
}
fn guess(url: &str) -> String {
    let Ok(url) = url::Url::parse(url) else {
        return "paste a post URL".into();
    };
    let host = url.host_str().unwrap_or("").trim_start_matches("www.");
    if host.contains("tiktok") {
        "TikTok"
    } else if host.contains("instagram") {
        "Instagram"
    } else if ["x.com", "twitter.com"].contains(&host) {
        "X"
    } else if host.contains("linkedin") {
        "LinkedIn"
    } else if host.contains("twitch") {
        "Twitch"
    } else if host.contains("youtube") || host.contains("youtu.be") {
        "YouTube"
    } else {
        "unsupported"
    }
    .into()
}
fn display(v: &Value) -> String {
    if v.is_null() {
        String::new()
    } else if let Some(n) = v.as_f64() {
        n.to_string()
    } else {
        corvus_core::impact::string(v)
    }
}
fn edit(p: &Value) -> Result<(), JsValue> {
    let li = p["platform"] == "li" && p["post_type"] == "original" && p["media_type"] == "video";
    let id = if li {
        "impact-linkedin-single"
    } else {
        "impact-edit"
    };
    ui::element(id)?.dyn_into::<HtmlFormElement>()?.reset();
    if !li {
        ui::element("impact-general-edit")?
            .dyn_into::<web_sys::HtmlDetailsElement>()?
            .set_open(true);
    }
    let mut keys = vec![
        "post_url", "account", "views", "likes", "comments", "shares", "saves",
    ];
    if !li {
        keys.extend(["label", "thumbnail_url"])
    }
    for k in keys {
        set(id, k, &display(&p[k]))?;
    }
    if li {
        set(
            id,
            "view_metric",
            if text(p, "view_metric").is_empty() {
                "views"
            } else {
                text(p, "view_metric")
            },
        )?;
        check(id, "original", p["original_by_gabe"] == true)?;
        check(id, "has_video", true)?;
    } else {
        set(
            id,
            "post_type",
            if text(p, "post_type").is_empty() {
                "unknown"
            } else {
                text(p, "post_type")
            },
        )?;
        set(
            id,
            "media_type",
            if text(p, "media_type").is_empty() {
                "unknown"
            } else {
                text(p, "media_type")
            },
        )?;
        check(id, "original_by_gabe", p["original_by_gabe"] == true)?;
        if !text(p, "posted_at").is_empty() {
            let date = js_sys::Date::new(&text(p, "posted_at").into());
            let local = js_sys::Date::new(&JsValue::from_f64(
                date.get_time() - date.get_timezone_offset() * 60000.0,
            ));
            if local.get_time().is_finite() {
                let iso = local.to_iso_string().as_string().unwrap_or_default();
                set(id, "posted_at", iso.get(..16).unwrap_or(""))?;
            }
        }
        ui::text(
            "impact-platform",
            &format!("Platform: {}", guess(text(p, "post_url"))),
        );
    }
    ui::scroll(id, true, false);
    Ok(())
}
fn render(data: &Value, state: &State) -> Result<(), JsValue> {
    ui::element("impact-archives")?
        .dyn_into::<HtmlInputElement>()?
        .set_checked(data["settings"]["include_twitch_archives"] == true);
    let table = node("table", "", "")?;
    let head = node("tr", "", "")?;
    for label in [
        "platform / account",
        "ingested",
        "count as Compound",
        "last check",
        "source / status",
        "last error",
    ] {
        append(&head, &node("th", label, "")?)?;
    }
    append(&table, &head)?;
    for a in data["accounts"].as_array().into_iter().flatten() {
        let tr = node("tr", "", "")?;
        let status = format!(
            "{}{}{}",
            text(a, "mode"),
            if js_sys::Date::parse(text(a, "queued_at")) > js_sys::Date::parse(text(a, "at")) {
                " · browser refresh queued"
            } else {
                ""
            },
            if text(a, "note").is_empty() {
                String::new()
            } else {
                format!(" · {}", text(a, "note"))
            }
        );
        let errors = [text(a, "error"), text(a, "provider_error")]
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join(" · ");
        for v in [
            format!("{} / @{}", name(text(a, "platform")), text(a, "account")),
            display(&a["ingested"]),
            display(&a["counted"]),
            if text(a, "at").is_empty() {
                "not checked".into()
            } else {
                ui::date(text(a, "at"))
            },
            status,
            if errors.is_empty() {
                "—".into()
            } else {
                errors
            },
        ] {
            append(&tr, &node("td", &v, "")?)?;
        }
        append(&table, &tr)?;
    }
    let container = ui::element("impact-account-status")?;
    container.set_text_content(None);
    append(&container, &table)?;
    let status = if truthy(&data["sync"]) {
        data["sync"]["platforms"]
            .as_object()
            .map(|m| {
                m.iter()
                    .map(|(p, v)| format!("{p}: {}", text(v, "note")))
                    .collect::<Vec<_>>()
                    .join(" · ")
            })
            .unwrap_or_default()
    } else {
        "Hourly checks for fresh posts, daily for older posts. Manual entry works now.".into()
    };
    ui::text("impact-sync-status", &status);
    let table = node("table", "", "")?;
    let head = node("tr", "", "")?;
    for t in [
        "post",
        "platform",
        "media_type",
        "post_type",
        "Compound",
        "views / impressions",
        "source",
        "score",
        "edit",
    ] {
        append(&head, &node("th", t, "")?)?;
    }
    append(&table, &head)?;
    state.borrow_mut().listeners.clear();
    for p in data["posts"].as_array().into_iter().flatten() {
        let tr = node("tr", "", "")?;
        for v in [
            if text(p, "label").is_empty() {
                text(p, "post_url").into()
            } else {
                text(p, "label").into()
            },
            display(&p["platform"]),
            display(&p["media_type"]),
            display(&p["post_type"]),
            if truthy(&p["made_with_compound"]) {
                "yes".into()
            } else {
                "no".into()
            },
            if p["views"].is_null() {
                "—".into()
            } else {
                display(&p["views"])
            },
            if p["metric_source"] == "manual" {
                "self-reported".into()
            } else if text(p, "metric_source").is_empty() {
                "not reported".into()
            } else {
                text(p, "metric_source").into()
            },
            display(&p["score"]),
        ] {
            append(&tr, &node("td", &v, "")?)?;
        }
        let cell = node("td", "", "")?;
        let button = node("button", "edit", "button")?;
        let p = p.clone();
        state.borrow_mut().listeners.push(ui::scoped_listener(
            button.as_ref(),
            "click",
            move |_| {
                if let Err(e) = edit(&p) {
                    ui::text("impact-message", &ui::message(&e));
                }
            },
        )?);
        append(&cell, &button)?;
        append(&tr, &cell)?;
        append(&table, &tr)?;
    }
    let container = ui::element("impact-admin-posts")?;
    container.set_text_content(None);
    append(&container, &table)
}
async fn refresh(state: &State) {
    state.borrow_mut().generation += 1;
    let generation = state.borrow().generation;
    let result = request(None).await;
    if state.borrow().generation != generation {
        return;
    }
    let result = result.and_then(|data| render(&data, state));
    if let Err(e) = result {
        ui::text("impact-message", &ui::message(&e));
    }
}
fn body(id: &str) -> Result<Value, JsValue> {
    let mut post = fields(id)?;
    Ok(match id {
        "impact-linkedin-single" => {
            post["original"] = json!(checked(id, "original")?);
            post["has_video"] = json!(checked(id, "has_video")?);
            json!({"action":"linkedin-save","post":post})
        }
        "impact-edit" => {
            post["original_by_gabe"] = json!(checked(id, "original_by_gabe")?);
            post["native_video"] = json!(post["media_type"] == "video");
            let raw = text(&post, "posted_at");
            post["posted_at"] = if raw.is_empty() {
                Value::Null
            } else {
                let d = js_sys::Date::new(&raw.into());
                if !d.get_time().is_finite() {
                    return Err(JsValue::from_str("Invalid posting date."));
                }
                json!(d.to_iso_string().as_string())
            };
            json!({"action":"save","post":post})
        }
        "impact-bulk" => json!({"action":"bulk","text":post["text"]}),
        _ => {
            json!({"action":"linkedin-bulk","text":post["text"],"account":post["account"],"original":checked(id,"original")?,"has_video":checked(id,"has_video")?})
        }
    })
}
fn submit(id: &'static str, state: &State) -> Result<(), JsValue> {
    let form = ui::element(id)?.dyn_into::<HtmlFormElement>()?;
    let state = state.clone();
    let f = form.clone();
    listen_form(&state.clone(), form.as_ref(), "submit", move |event| {
        event.prevent_default();
        let status = if id == "impact-linkedin-single" {
            "impact-linkedin-message"
        } else {
            "impact-message"
        };
        let attempt = (|| -> Result<(), JsValue> {
            let button = f
                .query_selector("button:not([type=button])")?
                .ok_or(JsValue::NULL)?
                .dyn_into::<HtmlButtonElement>()?;
            if button.disabled() {
                return Ok(());
            }
            let payload = body(id)?;
            button.set_disabled(true);
            let state = state.clone();
            let lifetime = state.borrow().lifetime;
            spawn_local(async move {
                let result = request(Some(payload)).await;
                if state.borrow().lifetime != lifetime {
                    return;
                }
                match result {
                    Ok(data) => {
                        let count = data["saved"].as_array().map(Vec::len).unwrap_or(0);
                        ui::text(status,&match id{"impact-linkedin-single"=>"Saved. Original video is on the scorecard. Entered figures are self-reported; missing figures stay unknown.".into(),"impact-edit"=>"Saved. Public totals will refresh within a minute.".into(),"impact-bulk"=>format!("Saved {count} posts."),_=>format!("Imported {count} LinkedIn posts.")});
                        refresh(&state).await;
                    }
                    Err(e) => ui::text(status, &ui::message(&e)),
                }
                button.set_disabled(false);
            });
            Ok(())
        })();
        if let Err(e) = attempt {
            ui::text(status, &ui::message(&e));
        }
    })
}
fn paste_counts() -> Result<(), JsValue> {
    let pasted = ui::element("impact-li-paste")?
        .dyn_into::<HtmlTextAreaElement>()?
        .value();
    let re=regex::Regex::new(r"(?i)(?:^|[^\w.-])([\d,]+)\s*(impressions?|(?:video )?views?|reactions?|comments?|reposts?|saves?)\b").map_err(|_|JsValue::NULL)?;
    let mut found = std::collections::HashSet::new();
    for m in re.captures_iter(&pasted) {
        let Some(number) = m
            .get(1)
            .and_then(|s| s.as_str().replace(',', "").parse::<u64>().ok())
            .filter(|v| *v <= 1_000_000_000_000)
        else {
            continue;
        };
        let unit = m
            .get(2)
            .map(|s| s.as_str().to_lowercase())
            .unwrap_or_default();
        let k = if unit.contains("view") || unit.contains("impression") {
            "views"
        } else if unit.contains("reaction") {
            "likes"
        } else if unit.contains("comment") {
            "comments"
        } else if unit.contains("repost") {
            "shares"
        } else {
            "saves"
        };
        set("impact-linkedin-single", k, &number.to_string())?;
        if k == "views" {
            set(
                "impact-linkedin-single",
                "view_metric",
                if unit.starts_with("impression") {
                    "impressions"
                } else {
                    "views"
                },
            )?;
        }
        found.insert(k);
    }
    ui::text(
        "impact-linkedin-message",
        &if found.is_empty() {
            "Use number + metric, e.g. 1,234 impressions, 0 saves.".into()
        } else {
            format!("{} counts filled. Check them, then save.", found.len())
        },
    );
    Ok(())
}
fn sync_button(
    button: HtmlElement,
    platform: Option<String>,
    state: &State,
) -> Result<(), JsValue> {
    let b = button.clone();
    let state = state.clone();
    listen_form(&state.clone(), button.as_ref(), "click", move |_| {
        let Ok(button) = b.clone().dyn_into::<HtmlButtonElement>() else {
            return;
        };
        if button.disabled() {
            return;
        }
        button.set_disabled(true);
        let state = state.clone();
        let platform = platform.clone();
        let lifetime = state.borrow().lifetime;
        spawn_local(async move {
            let mut body = json!({"action":"sync"});
            if let Some(p) = &platform {
                body["platform"] = json!(p);
            }
            let result = request(Some(body)).await;
            if state.borrow().lifetime != lifetime {
                return;
            }
            match result {
                Ok(_) => {
                    refresh(&state).await;
                    ui::text(
                        "impact-message",
                        &if let Some(p) = platform {
                            format!(
                                "{} check requested. See per-account status below.",
                                name(&p)
                            )
                        } else {
                            "Provider check complete. Missing keys use manual entry.".into()
                        },
                    );
                }
                Err(e) => ui::text("impact-message", &ui::message(&e)),
            }
            button.set_disabled(false);
        });
    })
}
fn mount(state: &State) -> Result<(), JsValue> {
    if ui::doc()?.get_element_by_id("impact-admin").is_some() {
        return Ok(());
    }
    let section = node("section", "", "panel")?;
    section.set_id("impact-admin");
    section.set_inner_html(include_str!("../../../migration/impact-admin.html").trim_end());
    let link = node("link", "", "")?;
    link.set_attribute("rel", "stylesheet")?;
    link.set_attribute("href", "/compound/impact/admin.css?v=20261110linkedin1")?;
    if let Some(head) = ui::doc()?.query_selector("head")? {
        append(&head, &link)?;
    }
    if let Some(anchor) = ui::doc()?
        .get_element_by_id("winner-current")
        .and_then(|e| e.closest("section").ok().flatten())
    {
        if let Some(parent) = anchor.parent_node() {
            parent.insert_before(&section, anchor.next_sibling().as_ref())?;
        }
    } else {
        let target = ui::doc()?
            .get_element_by_id("private")
            .or_else(|| {
                ui::doc()
                    .ok()
                    .and_then(|d| d.get_element_by_id("admin-content"))
            })
            .ok_or(JsValue::NULL)?;
        append(&target, &section)?;
    }
    for id in [
        "impact-linkedin-single",
        "impact-edit",
        "impact-bulk",
        "impact-linkedin",
    ] {
        submit(id, state)?;
    }
    listen_form(
        state,
        ui::element("impact-li-fill")?.as_ref(),
        "click",
        move |_| {
            if let Err(e) = paste_counts() {
                ui::text("impact-linkedin-message", &ui::message(&e));
            }
        },
    )?;
    let input = field("impact-edit", "post_url")?;
    listen_form(state, input.as_ref(), "input", move |_| {
        ui::text(
            "impact-platform",
            &format!(
                "Platform: {}",
                guess(&value("impact-edit", "post_url").unwrap_or_default())
            ),
        );
    })?;
    let input = ui::element("impact-archives")?.dyn_into::<HtmlInputElement>()?;
    let i = input.clone();
    let archive_state = state.clone();
    listen_form(state, input.as_ref(), "change", move |_| {
        let state = archive_state.clone();
        let lifetime = state.borrow().lifetime;
        let input = i.clone();
        let checked = input.checked();
        spawn_local(async move {
            let result = request(Some(
                json!({"action":"settings","include_twitch_archives":checked}),
            ))
            .await;
            if state.borrow().lifetime != lifetime {
                return;
            }
            match result {
                Ok(_) => ui::text("impact-message", "Twitch setting saved."),
                Err(e) => {
                    ui::text("impact-message", &ui::message(&e));
                    input.set_checked(!checked);
                }
            }
        });
    })?;
    if let Some(accounts) = config()["accounts"].as_object() {
        for (p, _) in accounts {
            let b = node(
                "button",
                &format!(
                    "{}{}",
                    name(p),
                    if p == "li" {
                        " · manual"
                    } else if p == "yt" {
                        " · coming soon"
                    } else {
                        " · sync now"
                    }
                ),
                "button",
            )?;
            if p == "li" || p == "yt" {
                b.set_attribute("disabled", "")?;
            }
            sync_button(b.clone(), Some(p.clone()), state)?;
            append(&ui::element("impact-providers")?, &b)?;
        }
    }
    sync_button(ui::element("impact-sync")?, None, state)?;
    Ok(())
}
#[wasm_bindgen]
pub async fn mount_impact_admin() -> Result<(), JsValue> {
    let state = STATE.with(Clone::clone);
    mount(&state)?;
    refresh(&state).await;
    Ok(())
}

/// Remove private data and invalidate pending reads when the owner logs out.
#[wasm_bindgen]
pub fn clear_impact_admin() {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.generation += 1;
        s.lifetime += 1;
        s.listeners.clear();
        s.form_listeners.clear();
    });
    if let Ok(root) = ui::element("impact-admin") {
        root.remove();
    }
}
