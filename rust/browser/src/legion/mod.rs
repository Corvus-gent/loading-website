//! Existing Legion/Senate DOM and copy, running as native Rust browser behavior.
mod admin;
mod editor;
mod invite;
mod public;
mod senate;
mod senate_admin;
use crate::ui;
use serde_json::{Value, json};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{HtmlElement, HtmlFormElement, HtmlInputElement};

fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
fn rows(v: &Value, k: &str) -> Vec<Value> {
    v[k].as_array().cloned().unwrap_or_default()
}
fn js(v: &Value) -> Result<JsValue, JsValue> {
    js_sys::JSON::parse(&v.to_string())
}
fn value(v: &JsValue) -> Result<Value, JsValue> {
    if v.is_null() || v.is_undefined() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&js_sys::JSON::stringify(v)?.as_string().unwrap_or_default())
        .map_err(|_| JsValue::from_str("Invalid page data"))
}
fn node(tag: &str, label: &str, class: &str) -> Result<HtmlElement, JsValue> {
    let e = ui::doc()?.create_element(tag)?.dyn_into::<HtmlElement>()?;
    e.set_text_content(Some(label));
    if !class.is_empty() {
        e.set_class_name(class);
    }
    Ok(e)
}
fn append(p: &impl AsRef<web_sys::Node>, c: &impl AsRef<web_sys::Node>) -> Result<(), JsValue> {
    p.as_ref().append_child(c.as_ref()).map(|_| ())
}
fn field(f: &HtmlFormElement, name: &str) -> Result<HtmlElement, JsValue> {
    f.query_selector(&format!("[name={name}]"))?
        .ok_or_else(|| JsValue::from_str("Missing form control"))?
        .dyn_into()
        .map_err(Into::into)
}
fn get(f: &HtmlFormElement, name: &str) -> Result<String, JsValue> {
    let el = field(f, name)?;
    js_sys::Reflect::get(&el, &"value".into())?
        .as_string()
        .ok_or(JsValue::NULL)
}
fn set(f: &HtmlFormElement, name: &str, s: &str) -> Result<(), JsValue> {
    js_sys::Reflect::set(field(f, name)?.as_ref(), &"value".into(), &s.into()).map(|_| ())
}
fn form(id: &str) -> Result<HtmlFormElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
fn query(root: &HtmlElement, s: &str) -> Result<HtmlElement, JsValue> {
    root.query_selector(s)?
        .ok_or_else(|| JsValue::from_str("Missing page control"))?
        .dyn_into()
        .map_err(Into::into)
}
fn disabled(e: &HtmlElement, yes: bool) {
    let _ = js_sys::Reflect::set(e, &"disabled".into(), &yes.into());
}
fn last_path() -> Result<String, JsValue> {
    let path = web_sys::window()
        .ok_or(JsValue::NULL)?
        .location()
        .pathname()?;
    let part = path
        .trim_end_matches('/')
        .trim_end_matches("/index.html")
        .rsplit('/')
        .next()
        .unwrap_or("");
    js_sys::decode_uri_component(part).map(String::from)
}
fn enc(s: &str) -> String {
    js_sys::encode_uri_component(s).into()
}
fn report(r: Result<(), JsValue>) {
    if let Err(e) = r {
        web_sys::console::error_1(&e);
    }
}
fn date(s: &str, method: &str) -> String {
    let d = js_sys::Date::new(&s.into());
    js_sys::Reflect::get(&d, &method.into())
        .ok()
        .and_then(|f| f.dyn_into::<js_sys::Function>().ok())
        .and_then(|f| f.call0(&d).ok())
        .and_then(|s| s.as_string())
        .unwrap_or_default()
}
async fn api(body: Option<Value>, q: &str, senate: bool) -> Result<Value, JsValue> {
    let opts = web_sys::RequestInit::new();
    opts.set_method(if body.is_some() { "POST" } else { "GET" });
    opts.set_credentials(web_sys::RequestCredentials::SameOrigin);
    opts.set_cache(web_sys::RequestCache::NoStore);
    opts.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(15000)));
    if let Some(b) = &body {
        opts.set_body(&b.to_string().into());
    }
    let req = web_sys::Request::new_with_str_and_init(
        &format!("/api/legion{}{}", if senate { "?senate=1" } else { "" }, q),
        &opts,
    )?;
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
    let data: Value = serde_json::from_str(&raw)
        .map_err(|_| JsValue::from_str("The crow lost its connection. Please retry."))?;
    if !r.ok() {
        let err = js_sys::Error::new(data["error"].as_str().unwrap_or("Please retry."));
        js_sys::Reflect::set(&err, &"status".into(), &r.status().into())?;
        return Err(err.into());
    }
    Ok(data)
}
#[wasm_bindgen]
pub async fn legion_api(body: JsValue, q: String) -> Result<JsValue, JsValue> {
    let b = value(&body)?;
    js(&api(
        (!b.is_null() && b != json!(false) && b != json!(0) && b != json!("")).then_some(b),
        &q,
        false,
    )
    .await?)
}
#[wasm_bindgen]
pub async fn senate_api(body: JsValue, q: String) -> Result<JsValue, JsValue> {
    let b = value(&body)?;
    js(&api((!b.is_null()).then_some(b), &q, true).await?)
}
#[wasm_bindgen]
pub fn legion_node(
    tag: &str,
    label: JsValue,
    class: Option<String>,
) -> Result<HtmlElement, JsValue> {
    let s = if label.is_undefined() {
        String::new()
    } else {
        js_sys::JsString::from(label).into()
    };
    node(tag, &s, class.as_deref().unwrap_or(""))
}
#[wasm_bindgen]
pub async fn legion_copy(s: String, button: HtmlElement) {
    let old = button.text_content().unwrap_or_default();
    if ui::copy(&s).await {
        button.set_text_content(Some("Copied ✓"));
        if ui::sleep(2000).await.is_ok() && button.is_connected() {
            button.set_text_content(Some(&old));
        }
    } else {
        button.set_text_content(Some("Select and copy the text above."));
    }
}
