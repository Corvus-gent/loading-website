//! Private bookings UI. Tokens stay in the existing tab storage; all row content uses text nodes.
use crate::ui;
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::spawn_local;
use web_sys::{HtmlButtonElement, HtmlElement, HtmlInputElement, HtmlSelectElement};
struct Admin {
    key: String,
    offset: u32,
}
type State = Rc<RefCell<Admin>>;
fn store(key: &str) {
    if let Some(storage) = web_sys::window().and_then(|w| w.session_storage().ok().flatten()) {
        let _ = storage.set_item("call.admin", key);
    }
}
fn node(tag: &str, text: &str) -> Result<HtmlElement, JsValue> {
    let e = ui::doc()?.create_element(tag)?.dyn_into::<HtmlElement>()?;
    e.set_text_content(Some(text));
    Ok(e)
}
async fn api(state: State, body: Option<Value>) -> Result<Value, JsValue> {
    let (key, offset) = {
        let s = state.borrow();
        (s.key.clone(), s.offset)
    };
    let (ok, d) = ui::json(
        &format!("/api/support?action=admin&offset={offset}"),
        body,
        Some(&key),
        15000,
    )
    .await?;
    if !ok {
        return Err(JsValue::from_str(
            d["error"].as_str().unwrap_or("Could not load requests."),
        ));
    }
    Ok(d)
}
fn date(value: &str) -> String {
    let d = js_sys::Date::new(&JsValue::from_str(value));
    js_sys::Reflect::get(&d, &JsValue::from_str("toLocaleString"))
        .ok()
        .and_then(|f| f.dyn_into::<js_sys::Function>().ok())
        .and_then(|f| f.call0(&d).ok())
        .and_then(|s| s.as_string())
        .unwrap_or_else(|| value.into())
}
fn render(state: State, row: &Value) -> Result<HtmlElement, JsValue> {
    let text = |key: &str| row[key].as_str().unwrap_or("");
    let card = node("article", "")?;
    card.set_class_name("call-admin-card");
    let label = match text("tier") {
        "quick" => "5 min free",
        "coffee" => "15 min coffee",
        "meet" => "meet in SF",
        _ => "",
    };
    card.append_child(&node("h2", &format!("{} · {label}", text("name")))?.into())?;
    let dl = node("dl", "")?;
    let coffee = if text("tier") == "quick" {
        "not required"
    } else if row["coffeePaid"] == true {
        "self-reported yes · honor system"
    } else {
        "not confirmed"
    };
    let received = date(text("createdAt"));
    for (label, value) in [
        ("contact", text("contact")),
        ("what hurts", text("pain")),
        ("preferred times", text("times")),
        ("coffee", coffee),
        ("received", received.as_str()),
        ("source", text("source")),
    ] {
        dl.append_child(&node("dt", label)?.into())?;
        dl.append_child(&node("dd", value)?.into())?;
    }
    card.append_child(&dl)?;
    let select = ui::doc()?
        .create_element("select")?
        .dyn_into::<HtmlSelectElement>()?;
    select.set_attribute("aria-label", &format!("Status for {}", text("name")))?;
    for status in ["new", "scheduled", "done"] {
        let option = node("option", status)?;
        option.set_attribute("value", status)?;
        select.append_child(&option)?;
    }
    select.set_value(text("status"));
    card.append_child(&select)?;
    let saved = Rc::new(RefCell::new(text("status").to_string()));
    let control = select.clone();
    let s = state.clone();
    let id = text("id").to_string();
    ui::listen(select.as_ref(), "change", move |_| {
        control.set_disabled(true);
        let s = s.clone();
        let id = id.clone();
        let control = control.clone();
        let saved = saved.clone();
        let value = control.value();
        spawn_local(async move {
            match api(s, Some(json!({"id":id,"status":value}))).await {
                Ok(_) => {
                    *saved.borrow_mut() = value;
                    ui::text("admin-status", "status saved");
                }
                Err(e) => {
                    control.set_value(&saved.borrow());
                    ui::text("admin-status", &ui::message(&e));
                }
            }
            control.set_disabled(false);
        });
    })?;
    if row["mailSent"] != true {
        let warning = node("p", "mail pending · request is saved")?;
        warning.set_class_name("mail-pending");
        let retry = node("button", "retry email →")?.dyn_into::<HtmlButtonElement>()?;
        card.append_child(&warning)?;
        card.append_child(&retry)?;
        let button = retry.clone();
        let id = text("id").to_string();
        ui::listen(retry.as_ref(), "click", move |_| {
            button.set_disabled(true);
            let state = state.clone();
            let id = id.clone();
            let button = button.clone();
            let warning = warning.clone();
            spawn_local(async move {
                match api(state, Some(json!({"id":id,"action":"retry-mail"}))).await {
                    Ok(d) => {
                        if d["ok"] == true {
                            warning.set_text_content(Some("email sent"));
                            button.remove();
                        } else {
                            warning.set_text_content(Some("email still pending. retry shortly."));
                        }
                    }
                    Err(e) => warning.set_text_content(Some(&ui::message(&e))),
                }
                button.set_disabled(false);
            });
        })?;
    }
    Ok(card)
}
fn refresh(state: State, append: bool) {
    ui::text("admin-status", "loading…");
    spawn_local(async move {
        let result = async {
            let data = api(state.clone(), None).await?;
            let rows = data["rows"]
                .as_array()
                .ok_or_else(|| JsValue::from_str("Could not load requests."))?;
            ui::hidden("admin-login", true);
            ui::hidden("refresh", false);
            let target = ui::element("requests")?;
            if !append {
                target.set_text_content(None);
            }
            for row in rows {
                target.append_child(&render(state.clone(), row)?.into())?;
            }
            ui::hidden("more", data["more"] != true);
            ui::text(
                "admin-status",
                if target.child_element_count() > 0 {
                    "requests are private · retained for 60 days"
                } else {
                    "no headaches yet."
                },
            );
            Ok::<(), JsValue>(())
        }
        .await;
        if let Err(e) = result {
            ui::text("admin-status", &ui::message(&e));
            ui::hidden("admin-login", false);
        }
    });
}
#[wasm_bindgen]
pub fn start_support_admin() -> Result<(), JsValue> {
    let login = ui::element("admin-login")?;
    if login.has_attribute("data-rust-support-admin") {
        return Ok(());
    }
    login.set_attribute("data-rust-support-admin", "")?;
    let w = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
    let mut url = url::Url::parse(&w.location().href()?)
        .map_err(|_| JsValue::from_str("Invalid page URL"))?;
    let mut key = url
        .query_pairs()
        .find(|(k, _)| k == "key")
        .map(|(_, v)| v.into_owned())
        .unwrap_or_default();
    if !key.is_empty() {
        let pairs = url
            .query_pairs()
            .filter(|(k, _)| k != "key")
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect::<Vec<_>>();
        url.set_query(None);
        if !pairs.is_empty() {
            url.query_pairs_mut().extend_pairs(pairs);
        }
        let target = format!(
            "{}{}",
            url.path(),
            url.query().map(|q| format!("?{q}")).unwrap_or_default()
        );
        w.history()?
            .replace_state_with_url(&JsValue::NULL, "", Some(&target))?;
        store(&key);
    } else if let Some(storage) = w.session_storage().ok().flatten() {
        key = storage
            .get_item("call.admin")
            .ok()
            .flatten()
            .unwrap_or_default();
    }
    let state = Rc::new(RefCell::new(Admin { key, offset: 0 }));
    let s = state.clone();
    ui::listen(login.as_ref(), "submit", move |event| {
        event.prevent_default();
        if let Ok(input) = ui::element("access-key")
            .and_then(|e| e.dyn_into::<HtmlInputElement>().map_err(Into::into))
        {
            let key = input.value().trim().to_string();
            input.set_value("");
            store(&key);
            s.borrow_mut().key = key;
            s.borrow_mut().offset = 0;
            refresh(s.clone(), false);
        }
    })?;
    let s = state.clone();
    ui::listen(ui::element("refresh")?.as_ref(), "click", move |_| {
        s.borrow_mut().offset = 0;
        refresh(s.clone(), false);
    })?;
    let s = state.clone();
    ui::listen(ui::element("more")?.as_ref(), "click", move |_| {
        let next = s.borrow().offset.saturating_add(50);
        s.borrow_mut().offset = next;
        refresh(s.clone(), true);
    })?;
    refresh(state, false);
    Ok(())
}
