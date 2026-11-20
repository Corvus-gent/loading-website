use super::*;
use std::{cell::RefCell, rc::Rc};
use web_sys::{HtmlSelectElement, HtmlTextAreaElement};
#[derive(Default)]
struct Admin {
    data: Option<Value>,
    generation: u64,
    epoch: u64,
    listeners: Vec<ui::Listener>,
    member_listeners: Vec<ui::Listener>,
}
type State = Rc<RefCell<Admin>>;
fn ranks() -> Vec<String> {
    serde_json::from_str::<Value>(include_str!("../../../migration/legion-config.json"))
        .ok()
        .map(|v| {
            rows(&v, "ranks")
                .iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}
fn display(v: &Value) -> String {
    if let Some(s) = v.as_str() {
        s.into()
    } else if v.is_null() {
        String::new()
    } else {
        v.to_string()
    }
}
fn clear(id: &str) -> Result<HtmlElement, JsValue> {
    let e = ui::element(id)?;
    e.set_text_content(None);
    Ok(e)
}
pub(super) fn form_data(f: &HtmlFormElement) -> Result<Value, JsValue> {
    let data = web_sys::FormData::new_with_form(f)?;
    let mut out = serde_json::Map::new();
    if let Some(iter) = js_sys::try_iter(&data)? {
        for p in iter {
            let p = js_sys::Array::from(&p?);
            if let Some(k) = p.get(0).as_string() {
                out.insert(k, json!(p.get(1).as_string().unwrap_or_default()));
            }
        }
    }
    Ok(Value::Object(out))
}
fn sign_out(s: &State) {
    let mut state = s.borrow_mut();
    state.epoch += 1;
    state.generation += 1;
    state.data = None;
    state.listeners.clear();
    state.member_listeners.clear();
    drop(state);
    senate_admin::clear_senate_admin();
    crate::impact::admin::clear_impact_admin();
    for id in [
        "admin-summary",
        "admin-member-rows",
        "invite-list",
        "application-list",
        "partner-rows",
    ] {
        let _ = clear(id);
    }
    for id in ["invite-create", "admin-login"] {
        if let Ok(f) = form(id) {
            f.reset();
        }
    }
    if let Ok(i) = ui::element("created-link")
        .and_then(|e| e.dyn_into::<HtmlInputElement>().map_err(Into::into))
    {
        i.set_value("");
    }
    if let Ok(i) = ui::element("created-dm")
        .and_then(|e| e.dyn_into::<HtmlTextAreaElement>().map_err(Into::into))
    {
        i.set_value("");
    }
    ui::hidden("created-invite", true);
    ui::hidden("admin-content", true);
    ui::hidden("admin-login", false);
}
async fn refresh(s: State) -> Result<(), JsValue> {
    let generation = {
        let mut state = s.borrow_mut();
        state.generation += 1;
        state.generation
    };
    let result = api(None, "?action=admin", false).await;
    if s.borrow().generation != generation {
        return Ok(());
    }
    match result {
        Ok(d) => {
            s.borrow_mut().data = Some(d);
            ui::hidden("admin-login", true);
            ui::hidden("admin-content", false);
            render(&s)?;
            spawn_local(async {
                let _ = crate::impact::admin::mount_impact_admin().await;
            });
            spawn_local(async {
                let _ = senate_admin::render_senate_admin().await;
            });
            Ok(())
        }
        Err(e) => {
            if js_sys::Reflect::get(&e, &"status".into())
                .ok()
                .and_then(|v| v.as_f64())
                == Some(401.)
            {
                sign_out(&s);
            } else {
                ui::text("admin-status", &ui::message(&e));
            }
            Err(e)
        }
    }
}
fn action(s: &State, label: &str, body: Value) -> Result<HtmlElement, JsValue> {
    let b = node("button", label, "site-button secondary")?;
    let button = b.clone();
    let state = s.clone();
    let epoch = s.borrow().epoch;
    let l = ui::scoped_listener(b.as_ref(), "click", move |_| {
        if state.borrow().epoch != epoch || button.has_attribute("disabled") {
            return;
        }
        disabled(&button, true);
        let s = state.clone();
        let b = button.clone();
        let body = body.clone();
        spawn_local(async move {
            let r = api(Some(body), "", false).await;
            if s.borrow().epoch != epoch {
                return;
            }
            match r {
                Ok(_) => {
                    let _ = refresh(s).await;
                }
                Err(e) => {
                    ui::text("admin-status", &ui::message(&e));
                    disabled(&b, false);
                }
            }
        });
    })?;
    s.borrow_mut().listeners.push(l);
    Ok(b)
}
fn locale_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    js_sys::JsString::from(a)
        .locale_compare(b, &js_sys::Array::new(), &js_sys::Object::new())
        .cmp(&0)
}
fn members(s: &State) -> Result<(), JsValue> {
    let Some(d) = s.borrow().data.clone() else {
        return Ok(());
    };
    let q = ui::element("admin-search")?
        .dyn_into::<HtmlInputElement>()?
        .value()
        .to_lowercase();
    let sort = ui::element("admin-sort")?
        .dyn_into::<HtmlSelectElement>()?
        .value();
    let ranks = ranks();
    let mut members = rows(&d, "members")
        .into_iter()
        .filter(|m| {
            m.as_object().is_some_and(|o| {
                o.values()
                    .map(display)
                    .collect::<Vec<_>>()
                    .join(" ")
                    .to_lowercase()
                    .contains(&q)
            })
        })
        .collect::<Vec<_>>();
    members.sort_by(|a, b| match sort.as_str() {
        "name" => locale_cmp(text(a, "name"), text(b, "name")),
        "rank" => {
            let rank = |p: &Value| {
                ranks
                    .iter()
                    .position(|r| r == text(p, "rank"))
                    .map(|i| i as i32)
                    .unwrap_or(-1)
            };
            rank(b).cmp(&rank(a))
        }
        _ => text(b, "joined_at").cmp(text(a, "joined_at")),
    });
    s.borrow_mut().member_listeners.clear();
    let root = clear("admin-member-rows")?;
    for m in members {
        let tr = node("tr", "", "")?;
        append(
            &tr,
            &node(
                "td",
                &format!(
                    "{}{}",
                    text(&m, "name"),
                    if text(&m, "handle").is_empty() {
                        String::new()
                    } else {
                        format!(" · @{}", text(&m, "handle"))
                    }
                ),
                "",
            )?,
        )?;
        append(&tr, &node("td", text(&m, "email"), "")?)?;
        let cell = node("td", "", "")?;
        let select = node("select", "", "")?.dyn_into::<HtmlSelectElement>()?;
        select.set_attribute("aria-label", &format!("Rank for {}", text(&m, "name")))?;
        if !ranks.iter().any(|r| r == text(&m, "rank")) {
            let o = node("option", &format!("{} (existing)", text(&m, "rank")), "")?;
            o.set_attribute("value", text(&m, "rank"))?;
            append(&select, &o)?;
        }
        for rank in &ranks {
            let o = node("option", rank, "")?;
            o.set_attribute("value", rank)?;
            append(&select, &o)?;
        }
        select.set_value(text(&m, "rank"));
        let source = text(&m, "source").to_string();
        let joined = text(&m, "joined_at").chars().take(10).collect::<String>();
        let control = select.clone();
        let state = s.clone();
        let epoch = s.borrow().epoch;
        let l = ui::scoped_listener(select.as_ref(), "change", move |_| {
            if state.borrow().epoch != epoch || control.disabled() {
                return;
            }
            control.set_disabled(true);
            let control = control.clone();
            let state = state.clone();
            let m = m.clone();
            spawn_local(async move {
                let r = api(
                    Some(json!({"action":"rank","id":m["id"],"rank":control.value()})),
                    "",
                    false,
                )
                .await;
                if state.borrow().epoch != epoch {
                    return;
                }
                match r {
                    Ok(_) => {
                        if refresh(state).await.is_ok() {
                            ui::text("admin-status", "Rank updated.");
                        }
                    }
                    Err(e) => {
                        ui::text("admin-status", &ui::message(&e));
                        control.set_value(text(&m, "rank"));
                    }
                }
                control.set_disabled(false);
            });
        })?;
        s.borrow_mut().member_listeners.push(l);
        append(&cell, &select)?;
        append(&tr, &cell)?;
        append(&tr, &node("td", &source, "")?)?;
        append(&tr, &node("td", &joined, "")?)?;
        append(&root, &tr)?;
    }
    Ok(())
}
fn render(s: &State) -> Result<(), JsValue> {
    let Some(d) = s.borrow().data.clone() else {
        return Ok(());
    };
    s.borrow_mut().listeners.clear();
    let summary = &d["summary"];
    let root = clear("admin-summary")?;
    let mut stats = vec![
        ("members".into(), summary["total"].clone()),
        ("new today".into(), summary["new_today"].clone()),
        (
            "emails confirmed".into(),
            summary["emails_confirmed"].clone(),
        ),
        (
            "emails collected".into(),
            summary["emails_collected"].clone(),
        ),
        ("invites created".into(), summary["invites_created"].clone()),
        ("invites opened".into(), summary["invites_opened"].clone()),
        ("invites claimed".into(), summary["invites_claimed"].clone()),
    ];
    if let Some(by) = summary["by_rank"].as_object() {
        stats.extend(by.iter().map(|(k, v)| (k.clone(), v.clone())));
    }
    for (label, value) in stats {
        let card = node("article", "", "site-card")?;
        append(&card, &node("strong", &display(&value), "")?)?;
        append(&card, &node("small", &label, "")?)?;
        append(&root, &card)?;
    }
    members(s)?;
    let root = clear("invite-list")?;
    for i in rows(&d, "invites") {
        let n = node("div", "", "admin-invite-row")?;
        let details = node("div", "", "")?;
        let label = if corvus_core::army::truthy(&i["revoked_at"]) {
            "revoked"
        } else if i["uses"].as_u64().unwrap_or(0) >= i["max_uses"].as_u64().unwrap_or(1) {
            "used"
        } else if js_sys::Date::parse(text(&i, "expires_at")) < js_sys::Date::now() {
            "expired"
        } else if corvus_core::army::truthy(&i["opened_at"]) {
            "opened"
        } else {
            "ready"
        };
        append(
            &details,
            &node(
                "strong",
                &format!(
                    "{} · {}{}",
                    if text(&i, "name").is_empty() {
                        "open invitation"
                    } else {
                        text(&i, "name")
                    },
                    text(&i, "rank"),
                    if text(&i, "title").is_empty() {
                        String::new()
                    } else {
                        format!(": {}", text(&i, "title"))
                    }
                ),
                "",
            )?,
        )?;
        append(
            &details,
            &node(
                "p",
                &format!(
                    "{label} · {}/{} claims · expires {}",
                    display(&i["uses"]),
                    display(&i["max_uses"]),
                    text(&i, "expires_at").chars().take(10).collect::<String>()
                ),
                "",
            )?,
        )?;
        append(&n, &details)?;
        if !corvus_core::army::truthy(&i["revoked_at"]) {
            append(
                &n,
                &action(s, "Revoke", json!({"action":"revoke_invite","id":i["id"]}))?,
            )?;
        }
        append(&root, &n)?;
    }
    let root = clear("application-list")?;
    for a in rows(&d, "applications") {
        let n = node("article", "", "admin-application")?;
        for (tag, label, class) in [
            ("h3", text(&a, "who").into(), ""),
            (
                "span",
                format!(
                    "{} · {} · {}",
                    text(&a, "rank"),
                    text(&a, "source"),
                    text(&a, "status")
                ),
                "site-tag",
            ),
            ("p", format!("Build: {}", text(&a, "build")), ""),
            ("p", format!("Why: {}", text(&a, "why")), ""),
        ] {
            append(&n, &node(tag, &label, class)?)?;
        }
        if a["status"] == "new" {
            let buttons = node("div", "", "site-actions")?;
            for decision in ["approve", "decline"] {
                append(
                    &buttons,
                    &action(
                        s,
                        &if decision == "approve" {
                            format!("Approve → {}", text(&a, "rank"))
                        } else {
                            "Decline".into()
                        },
                        json!({"action":"decide","id":a["id"],"decision":decision}),
                    )?,
                )?;
            }
            append(&n, &buttons)?;
        }
        append(&root, &n)?;
    }
    let root = clear("partner-rows")?;
    for p in rows(&d, "partners") {
        let tr = node("tr", "", "")?;
        let link = node("a", text(&p, "id"), "")?;
        link.set_attribute("href", &format!("/go/{}", text(&p, "id")))?;
        link.set_attribute("target", "_blank")?;
        link.set_attribute("rel", "noopener noreferrer")?;
        let td = node("td", "", "")?;
        append(&td, &link)?;
        if !text(&p, "note").is_empty() {
            append(&td, &node("small", text(&p, "note"), "admin-row-note")?)?;
        }
        let day = node(
            "td",
            &if p["today"].is_null() {
                if p.get("last24h").is_some() {
                    format!("{} (24h)", display(&p["last24h"]))
                } else {
                    "—".into()
                }
            } else {
                display(&p["today"])
            },
            "",
        )?;
        if !text(&p, "timeZone").is_empty() {
            append(
                &day,
                &node("small", text(&p, "timeZone"), "admin-row-note")?,
            )?;
        }
        append(&tr, &td)?;
        append(&tr, &day)?;
        append(
            &tr,
            &node(
                "td",
                &if p["total"].is_null() {
                    "—".into()
                } else {
                    display(&p["total"])
                },
                "",
            )?,
        )?;
        append(&root, &tr)?;
    }
    Ok(())
}
#[wasm_bindgen]
pub fn start_legion_admin() -> Result<(), JsValue> {
    let f = form("admin-login")?;
    if f.has_attribute("data-rust-legion-admin") {
        return Ok(());
    }
    f.set_attribute("data-rust-legion-admin", "")?;
    let state = State::default();
    let s = state.clone();
    let login = f.clone();
    ui::listen(f.as_ref(), "submit", move |e| {
        e.prevent_default();
        let Ok(button) = query(login.as_ref(), "button") else {
            return;
        };
        if button.has_attribute("disabled") {
            return;
        }
        disabled(&button, true);
        s.borrow_mut().generation += 1;
        let epoch = s.borrow().epoch;
        let s = s.clone();
        let login = login.clone();
        spawn_local(async move {
            let r = async {
                api(
                    Some(json!({"action":"login","password":get(&login,"password")?})),
                    "",
                    false,
                )
                .await?;
                if s.borrow().epoch != epoch {
                    return Ok(());
                }
                login.reset();
                refresh(s.clone()).await
            }
            .await;
            if let Err(e) = r
                && let Ok(status) = query(login.as_ref(), "[role=status]")
            {
                status.set_text_content(Some(&ui::message(&e)));
            }
            disabled(&button, false);
        });
    })?;
    let s = state.clone();
    ui::listen(ui::element("admin-logout")?.as_ref(), "click", move |_| {
        sign_out(&s);
        spawn_local(async {
            if let Err(e) = api(Some(json!({"action":"logout"})), "", false).await
                && let Ok(status) =
                    form("admin-login").and_then(|f| query(f.as_ref(), "[role=status]"))
            {
                status.set_text_content(Some(&ui::message(&e)));
            }
        });
    })?;
    let s = state.clone();
    ui::listen(ui::element("admin-refresh")?.as_ref(), "click", move |_| {
        let s = s.clone();
        spawn_local(async move {
            let _ = refresh(s).await;
        });
    })?;
    for (id, event) in [("admin-search", "input"), ("admin-sort", "change")] {
        let s = state.clone();
        ui::listen(ui::element(id)?.as_ref(), event, move |_| {
            report(members(&s))
        })?;
    }
    let invite = form("invite-create")?;
    let f = invite.clone();
    let s = state.clone();
    ui::listen(invite.as_ref(), "submit", move |e| {
        e.prevent_default();
        if !f.report_validity() {
            return;
        }
        let Ok(b) = query(f.as_ref(), "button") else {
            return;
        };
        if b.has_attribute("disabled") {
            return;
        }
        disabled(&b, true);
        let f = f.clone();
        let s = s.clone();
        let epoch = s.borrow().epoch;
        spawn_local(async move {
            let r=async{let mut body=form_data(&f)?;body["action"]=json!("create_invite");let d=api(Some(body),"",false).await?;if s.borrow().epoch!=epoch{return Ok(());}ui::element("created-link")?.dyn_into::<HtmlInputElement>()?.set_value(text(&d,"link"));ui::element("created-dm")?.dyn_into::<HtmlTextAreaElement>()?.set_value(&format!("{}I think you belong in the Corvus legion. Your rank: {}{}. No payment. {}Claim your invitation: {}",if text(&d,"name").is_empty(){String::new()}else{format!("Hey {}, ",text(&d,"name"))},text(&d,"rank"),if text(&d,"title").is_empty(){String::new()}else{format!(": {}",text(&d,"title"))},if text(&d,"note").is_empty(){String::new()}else{format!("{} ",text(&d,"note"))},text(&d,"link")));ui::hidden("created-invite",false);query(f.as_ref(),"[role=status]")?.set_text_content(Some("Created. Copy the link before leaving."));refresh(s.clone()).await?;if s.borrow().epoch==epoch{ui::scroll("created-invite",false,false);}Ok::<(),JsValue>(())}.await;
            if s.borrow().epoch == epoch
                && let Err(e) = r
                && let Ok(status) = query(f.as_ref(), "[role=status]")
            {
                status.set_text_content(Some(&ui::message(&e)));
            }
            disabled(&b, false);
        });
    })?;
    for (id, field) in [("copy-invite", "created-link"), ("copy-dm", "created-dm")] {
        let b = ui::element(id)?;
        let button = b.clone();
        ui::listen(b.as_ref(), "click", move |_| {
            let button = button.clone();
            if let Ok(e) = ui::element(field)
                && let Ok(v) = js_sys::Reflect::get(&e, &"value".into())
                && let Some(v) = v.as_string()
            {
                spawn_local(legion_copy(v, button));
            }
        })?;
    }
    let f = invite.clone();
    ui::listen(field(&invite, "type")?.as_ref(), "change", move |_| {
        report((|| {
            let honorary = get(&f, "type")? == "honorary";
            ui::hidden("honorary-title-field", !honorary);
            ui::hidden("honorary-slug-field", !honorary);
            field(&f, "title")?
                .dyn_into::<HtmlInputElement>()?
                .set_required(honorary);
            if honorary {
                set(&f, "rank", "senator")?;
                set(&f, "max_uses", "1")?;
            }
            Ok(())
        })());
    })?;
    spawn_local(async move {
        let _ = refresh(state).await;
    });
    Ok(())
}
