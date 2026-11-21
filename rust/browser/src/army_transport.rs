//! Shared proof/session transport; no Army profile or administration UI.
use crate::{language, ui};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::cell::RefCell;
use std::collections::HashMap;
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_futures::future_to_promise;
thread_local! {static PROOFS:RefCell<HashMap<String,(f64,js_sys::Promise)>>=RefCell::new(HashMap::new());}
pub(crate) async fn api(body: Option<Value>, query: &str) -> Result<Value, JsValue> {
    let o = web_sys::RequestInit::new();
    o.set_method(if body.is_some() { "POST" } else { "GET" });
    o.set_credentials(web_sys::RequestCredentials::SameOrigin);
    o.set_cache(web_sys::RequestCache::NoStore);
    o.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(18000)));
    if let Some(b) = &body {
        o.set_body(&b.to_string().into());
    }
    let req = web_sys::Request::new_with_str_and_init(&format!("/api/army{query}"), &o)?;
    if body.is_some() {
        req.headers().set("Content-Type", "application/json")?;
    }
    let r = JsFuture::from(
        web_sys::window()
            .ok_or(JsValue::NULL)?
            .fetch_with_request(&req),
    )
    .await?
    .dyn_into::<web_sys::Response>()?;
    let raw = JsFuture::from(r.text()?)
        .await?
        .as_string()
        .unwrap_or_default();
    let v: Value = serde_json::from_str(&raw).map_err(|_| JsValue::from_str("resting"))?;
    if !r.ok() {
        let e = js_sys::Error::new(v["error"].as_str().unwrap_or("resting"));
        js_sys::Reflect::set(&e, &"status".into(), &r.status().into())?;
        return Err(e.into());
    }
    Ok(v)
}
async fn proof(action: &str) -> Result<Value, JsValue> {
    let d = api(Some(json!({"action":"challenge","for":action})), "").await?;
    let c = &d["challenge"];
    let salt = c["salt"]
        .as_str()
        .ok_or_else(|| JsValue::from_str("verification"))?;
    let bits = c["bits"]
        .as_u64()
        .filter(|n| *n <= 32)
        .ok_or_else(|| JsValue::from_str("verification"))? as u32;
    let start = js_sys::Date::now();
    let mut found = None;
    for nonce in 0..20_000_000u32 {
        let hash = Sha256::digest(format!("{salt}:{nonce}").as_bytes());
        let zeros = hash
            .iter()
            .map(|b| b.leading_zeros())
            .scan(false, |done, n| {
                if *done {
                    None
                } else {
                    *done = n < 8;
                    Some(n)
                }
            })
            .sum::<u32>();
        if zeros >= bits {
            found = Some(nonce);
            break;
        }
        if nonce % 1024 == 1023 {
            if js_sys::Date::now() - start > 90000.0 {
                return Err("verification".into());
            }
            ui::sleep(1).await?;
        }
    }
    let nonce = found.ok_or_else(|| JsValue::from_str("verification"))?;
    let wait = c["notBefore"].as_f64().unwrap_or(0.0) - js_sys::Date::now() + 80.0;
    if wait > 0.0 {
        ui::sleep(wait.min(300_000.0) as i32).await?;
    }
    Ok(json!({"challenge":c["id"],"nonce":nonce}))
}
pub(crate) async fn prepare(action: &str) -> Result<Value, JsValue> {
    let now = js_sys::Date::now();
    let cached = PROOFS.with_borrow(|m| {
        m.get(action)
            .filter(|(at, _)| now - at < 240000.0)
            .map(|(_, p)| p.clone())
    });
    let p = if let Some(p) = cached {
        p
    } else {
        let a = action.to_owned();
        let p = future_to_promise(async move { js(&proof(&a).await?) });
        PROOFS.with_borrow_mut(|m| {
            m.insert(action.into(), (now, p.clone()));
        });
        p
    };
    let r = JsFuture::from(p.clone()).await.and_then(|v| val(&v));
    if r.is_err() {
        PROOFS.with_borrow_mut(|m| {
            if m.get(action)
                .is_some_and(|(_, old)| js_sys::Object::is(old, &p))
            {
                m.remove(action);
            }
        });
    }
    r
}
pub(crate) async fn submit(action: &str, mut body: Value) -> Result<Value, JsValue> {
    let result = async {
        let p = prepare(action).await?;
        body["lang"] = json!(language::get_language());
        body["action"] = json!(action);
        body["challenge"] = p["challenge"].clone();
        body["nonce"] = p["nonce"].clone();
        api(Some(body), "").await
    }
    .await;
    PROOFS.with_borrow_mut(|m| {
        m.remove(action);
    });
    result
}
#[wasm_bindgen]
pub async fn army_submit(action: String, body: JsValue) -> Result<JsValue, JsValue> {
    let b = val(&body)?;
    if !b.is_object() {
        return Err("fields".into());
    }
    js(&submit(&action, b).await?)
}

fn js(v: &Value) -> Result<JsValue, JsValue> {
    js_sys::JSON::parse(&v.to_string())
}
fn val(v: &JsValue) -> Result<Value, JsValue> {
    if v.is_null() || v.is_undefined() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&js_sys::JSON::stringify(v)?.as_string().unwrap_or_default())
        .map_err(|_| "fields".into())
}
