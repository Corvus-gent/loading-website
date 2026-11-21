//! Existing functional opt-out preference. Never use it as an analytics identifier.
use crate::{privacy, ui};
use serde_json::{Value, json};
use std::cell::RefCell;
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, spawn_local};
thread_local! {static MEMORY:RefCell<Option<Value>>=const{RefCell::new(None)};static STARTED:RefCell<bool>=const{RefCell::new(false)};}
fn get(target: &JsValue, key: &str) -> JsValue {
    js_sys::Reflect::get(target, &JsValue::from_str(key)).unwrap_or(JsValue::UNDEFINED)
}
#[wasm_bindgen]
pub fn privacy_signal() -> bool {
    let Some(w) = web_sys::window() else {
        return false;
    };
    let n = w.navigator();
    get(n.as_ref(), "globalPrivacyControl") == JsValue::TRUE
        || get(n.as_ref(), "doNotTrack")
            .as_string()
            .is_some_and(|v| v == "1")
        || get(w.as_ref(), "doNotTrack")
            .as_string()
            .is_some_and(|v| v == "1")
}
pub fn choice() -> Value {
    if let Some(value) = MEMORY.with_borrow(Clone::clone) {
        return value;
    }
    let result = (|| -> Result<Value, JsValue> {
        let storage = web_sys::window()
            .and_then(|w| w.local_storage().ok().flatten())
            .ok_or(JsValue::NULL)?;
        let raw = storage
            .get_item("privacy-choice")?
            .unwrap_or_else(|| "null".into());
        let saved: Value = serde_json::from_str(&raw).map_err(|_| JsValue::NULL)?;
        if saved["choice"] == "allow" || saved["choice"] == "deny" {
            return Ok(saved);
        }
        let old: Value = serde_json::from_str(
            &storage
                .get_item("analytics-consent")?
                .unwrap_or_else(|| "null".into()),
        )
        .map_err(|_| JsValue::NULL)?;
        if old["choice"] == "deny"
            && old["expires"]
                .as_f64()
                .or_else(|| old["expires"].as_str().and_then(|s| s.parse().ok()))
                .is_some_and(|v| v > js_sys::Date::now())
        {
            return Ok(json!({"choice":"deny","legacy":true}));
        }
        Ok(Value::Null)
    })();
    result.unwrap_or(Value::Null)
}
#[wasm_bindgen]
pub fn consent_choice() -> JsValue {
    js_sys::JSON::parse(&choice().to_string()).unwrap_or(JsValue::NULL)
}
#[wasm_bindgen]
pub fn analytics_allowed() -> bool {
    !privacy_signal() && choice()["choice"] != "deny"
}
#[wasm_bindgen]
pub fn notice_dismissed() -> bool {
    let value = choice();
    value["choice"] == "deny" || value["version"] == privacy::data()["version"]
}
fn event(name: &str) {
    if let Some(w) = web_sys::window()
        && let Ok(e) = web_sys::Event::new(name)
    {
        let _ = w.dispatch_event(&e);
    }
}
fn brussels_day() -> Result<String, JsValue> {
    let locales = js_sys::Array::of1(&JsValue::from_str("sv-SE"));
    let options = js_sys::Object::new();
    js_sys::Reflect::set(
        &options,
        &JsValue::from_str("timeZone"),
        &JsValue::from_str("Europe/Brussels"),
    )?;
    js_sys::Intl::DateTimeFormat::new(&locales, &options)
        .format()
        .call1(&JsValue::UNDEFINED, &js_sys::Date::new_0())
        .map(|v| v.as_string().unwrap_or_default())
}
fn acknowledge() {
    spawn_local(async {
        let result = async {
            let day = brussels_day()?;
            let opts = web_sys::RequestInit::new();
            opts.set_method("POST");
            opts.set_credentials(web_sys::RequestCredentials::Omit);
            opts.set_referrer_policy(web_sys::ReferrerPolicy::NoReferrer);
            js_sys::Reflect::set(&opts, &JsValue::from_str("keepalive"), &JsValue::TRUE)?;
            opts.set_body(&JsValue::from_str(&json!({"day":day}).to_string()));
            let request = web_sys::Request::new_with_str_and_init("/api/notice-ok", &opts)?;
            request.headers().set("Content-Type", "application/json")?;
            if let Some(w) = web_sys::window() {
                JsFuture::from(w.fetch_with_request(&request)).await?;
            }
            Ok::<(), JsValue>(())
        }
        .await;
        let _ = result;
    });
}
#[wasm_bindgen]
pub fn choose_analytics(selected: &str) {
    if !["allow", "deny"].contains(&selected) {
        return;
    }
    let previous = choice();
    let soldier = match &previous["soldier"] {
        Value::Null => false,
        Value::Bool(v) => *v,
        Value::Number(n) => n.as_f64().is_some_and(|n| n != 0.0),
        Value::String(s) => !s.is_empty(),
        _ => true,
    };
    let first = selected == "allow" && !soldier;
    let value =
        json!({"choice":selected,"version":privacy::data()["version"],"soldier":soldier||first});
    MEMORY.with_borrow_mut(|m| *m = Some(value.clone()));
    if let Some(storage) = web_sys::window().and_then(|w| w.local_storage().ok().flatten()) {
        // Preserve the old all-or-nothing exception boundary if storage is blocked.
        if storage
            .set_item("privacy-choice", &value.to_string())
            .is_ok()
            && storage.remove_item("analytics-consent").is_ok()
        {
            let _ = storage.remove_item("privacy-notice");
        }
    }
    event("analytics-consent-change");
    if first {
        acknowledge();
        event("notice-ok");
    }
}
#[wasm_bindgen]
pub fn start_consent() -> Result<(), JsValue> {
    if STARTED.with_borrow(|s| *s) {
        return Ok(());
    }
    STARTED.with_borrow_mut(|s| *s = true);
    if let Some(w) = web_sys::window() {
        ui::listen(w.as_ref(), "storage", |e| {
            if let Some(e) = e.dyn_ref::<web_sys::StorageEvent>()
                && e.key()
                    .is_none_or(|k| ["privacy-choice", "analytics-consent"].contains(&k.as_str()))
            {
                MEMORY.with_borrow_mut(|m| *m = None);
                event("analytics-consent-change");
            }
        })?;
    }
    Ok(())
}
