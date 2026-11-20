//! Existing eight-row scorecard administration, rendered using text nodes only.
use crate::ui;
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::spawn_local;
use web_sys::{HtmlButtonElement, HtmlInputElement};
struct Row {
    fighter: &'static str,
    platform: &'static str,
    views: HtmlInputElement,
    link: HtmlInputElement,
}
struct Admin {
    key: String,
    rows: Vec<Row>,
}
type State = Rc<RefCell<Admin>>;
fn input(id: &str) -> Result<HtmlInputElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
fn store(key: &str) {
    if let Some(storage) = web_sys::window().and_then(|w| w.session_storage().ok().flatten()) {
        let _ = storage.set_item("battle.admin", key);
    }
}
async fn api(state: &State, body: Option<Value>) -> Result<Value, JsValue> {
    let key = state.borrow().key.clone();
    let (ok, data) = ui::json("/api/battle?action=admin", body, Some(&key), 10000).await?;
    if !ok {
        return Err(JsValue::from_str(
            data["error"].as_str().unwrap_or("Please try again."),
        ));
    }
    Ok(data)
}
fn load(state: State) {
    spawn_local(async move {
        let result = async {
            let data = api(&state, None).await?;
            ui::hidden("login", true);
            ui::hidden("settings", false);
            input("closed")?.set_checked(data["closed"] == true);
            for row in &state.borrow().rows {
                let old = data["views"].as_array().and_then(|a| {
                    a.iter()
                        .find(|v| v["fighter"] == row.fighter && v["platform"] == row.platform)
                });
                row.views.set_value(
                    &old.and_then(|v| v["views"].as_f64())
                        .unwrap_or(0.0)
                        .to_string(),
                );
                row.link
                    .set_value(old.and_then(|v| v["url"].as_str()).unwrap_or(""));
            }
            ui::text(
                "status",
                &format!(
                    "Connected. {} blind votes.",
                    data["total"].as_u64().unwrap_or(0)
                ),
            );
            store(&state.borrow().key);
            Ok::<(), JsValue>(())
        }
        .await;
        if let Err(e) = result {
            ui::text("status", &ui::message(&e));
            ui::hidden("login", false);
        }
    });
}
#[wasm_bindgen]
pub fn start_battle_admin() -> Result<(), JsValue> {
    let rows_el = ui::element("rows")?;
    if rows_el.has_attribute("data-rust-battle-admin") {
        return Ok(());
    }
    rows_el.set_attribute("data-rust-battle-admin", "")?;
    let w = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
    let mut url =
        url::Url::parse(&w.location().href()?).map_err(|_| JsValue::from_str("Invalid URL"))?;
    let mut key = url
        .query_pairs()
        .find(|(k, _)| k == "key")
        .map(|(_, v)| v.into_owned())
        .unwrap_or_default();
    if url.query_pairs().any(|(k, _)| k == "key") {
        let pairs = url
            .query_pairs()
            .filter(|(k, _)| k != "key")
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect::<Vec<_>>();
        url.set_query(None);
        if !pairs.is_empty() {
            url.query_pairs_mut().extend_pairs(pairs);
        }
        w.history()?
            .replace_state_with_url(&JsValue::NULL, "", Some(url.as_str()))?;
    }
    if let Ok(Some(storage)) = w.session_storage() {
        if key.is_empty() {
            key = storage.get_item("battle.admin")?.unwrap_or_default();
        } else {
            store(&key);
        }
    }
    let doc = ui::doc()?;
    let mut rows = Vec::new();
    for fighter in ["codex", "compound"] {
        for platform in ["tiktok", "instagram", "x", "linkedin"] {
            let id = format!("{fighter}-{platform}");
            let div = doc.create_element("div")?;
            div.set_class_name("admin-row");
            let name = doc.create_element("strong")?;
            name.set_text_content(Some(&format!("{} / {platform}", fighter.to_uppercase())));
            div.append_child(&name)?;
            let vl = doc.create_element("label")?;
            vl.set_text_content(Some("Views"));
            let views = doc
                .create_element("input")?
                .dyn_into::<HtmlInputElement>()?;
            views.set_type("number");
            views.set_min("0");
            views.set_step("1");
            views.set_value("0");
            views.set_id(&format!("{id}-views"));
            views.set_input_mode("numeric");
            vl.append_child(&views)?;
            div.append_child(&vl)?;
            let ul = doc.create_element("label")?;
            ul.set_text_content(Some("Post URL"));
            let link = doc
                .create_element("input")?
                .dyn_into::<HtmlInputElement>()?;
            link.set_type("url");
            link.set_placeholder("https://…");
            link.set_id(&format!("{id}-url"));
            ul.append_child(&link)?;
            div.append_child(&ul)?;
            rows_el.append_child(&div)?;
            rows.push(Row {
                fighter,
                platform,
                views,
                link,
            });
        }
    }
    let state = Rc::new(RefCell::new(Admin { key, rows }));
    let login_state = state.clone();
    ui::listen(ui::element("login")?.as_ref(), "submit", move |e| {
        e.prevent_default();
        if let Ok(key) = input("key") {
            login_state.borrow_mut().key = key.value();
            load(login_state.clone());
        }
    })?;
    let save_state = state.clone();
    ui::listen(ui::element("settings")?.as_ref(), "submit", move |e| {
        e.prevent_default();
        let state = save_state.clone();
        spawn_local(async move {
            let Ok(button) = ui::element("save")
                .and_then(|e| e.dyn_into::<HtmlButtonElement>().map_err(Into::into))
            else {
                return;
            };
            button.set_disabled(true);
            let body = json!({"action":"admin","closed":input("closed").is_ok_and(|v|v.checked()),"views":state.borrow().rows.iter().map(|r|json!({"fighter":r.fighter,"platform":r.platform,"views":r.views.value().parse::<f64>().unwrap_or(0.0),"url":r.link.value().trim()})).collect::<Vec<_>>()});
            match api(&state, Some(body)).await {
                Ok(data) => ui::text(
                    "status",
                    &if data["closed"] == true {
                        format!(
                            "Saved. Winner: {}",
                            data["winner"].as_str().unwrap_or("").to_uppercase()
                        )
                    } else {
                        "Saved. Voting is open.".into()
                    },
                ),
                Err(e) => ui::text("status", &ui::message(&e)),
            };
            button.set_disabled(false);
        });
    })?;
    if !state.borrow().key.is_empty() {
        load(state.clone());
    }
    Ok(())
}
