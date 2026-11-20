//! Army browser behavior. Original HTML, localized copy and artwork remain authoritative assets.
mod access;
mod admin;
mod client;
mod gate;
mod public;
use crate::{language, ui};
use client::*;
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc, sync::OnceLock};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{HtmlElement, HtmlFormElement, HtmlInputElement, HtmlSelectElement};
fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
fn string(v: &Value) -> String {
    if v.is_null() {
        String::new()
    } else {
        v.as_f64()
            .map(|n| n.to_string())
            .unwrap_or_else(|| corvus_core::impact::string(v))
    }
}
fn arr(v: &Value, k: &str) -> Vec<Value> {
    v[k].as_array().cloned().unwrap_or_default()
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
fn query(p: &HtmlElement, s: &str) -> Result<HtmlElement, JsValue> {
    p.query_selector(s)?
        .ok_or_else(|| JsValue::from_str("Missing Army control"))?
        .dyn_into()
        .map_err(Into::into)
}
fn input(id: &str) -> Result<HtmlInputElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
fn select(id: &str) -> Result<HtmlSelectElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
fn form(id: &str) -> Result<HtmlFormElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
fn disabled(e: &HtmlElement, b: bool) {
    let _ = js_sys::Reflect::set(e, &"disabled".into(), &b.into());
}
fn enc(v: &str) -> String {
    js_sys::encode_uri_component(v).into()
}
fn report(r: Result<(), JsValue>) {
    if let Err(e) = r {
        web_sys::console::error_1(&e);
    }
}
fn copy_data() -> &'static Value {
    static V: OnceLock<Value> = OnceLock::new();
    V.get_or_init(|| {
        serde_json::from_str(include_str!("../../../migration/army-locales.json"))
            .unwrap_or(Value::Null)
    })
}
fn t(key: &str) -> String {
    tf(key, &Value::Null)
}
fn tf(key: &str, values: &Value) -> String {
    let l = language::get_language();
    let all = &copy_data()["army"];
    let raw = all[&l][key]
        .as_str()
        .or_else(|| all["en"][key].as_str())
        .unwrap_or(key);
    let re = regex::Regex::new(r"\{(\w+)\}").expect("fixed pattern");
    re.replace_all(raw, |c: &regex::Captures<'_>| string(&values[&c[1]]))
        .into_owned()
}
fn translate() -> Result<(), JsValue> {
    let d = ui::doc()?;
    for (attr, label) in [("data-army", false), ("data-army-label", true)] {
        let all = d.query_selector_all(&format!("[{attr}]"))?;
        for i in 0..all.length() {
            if let Some(e) = all
                .item(i)
                .and_then(|e| e.dyn_into::<web_sys::Element>().ok())
            {
                let s = t(&e.get_attribute(attr).unwrap_or_default());
                if label {
                    e.set_attribute("aria-label", &s)?;
                } else {
                    e.set_text_content(Some(&s));
                }
            }
        }
    }
    Ok(())
}
fn init(update: impl Fn() -> Result<(), JsValue> + 'static) -> Result<(), JsValue> {
    translate()?;
    ui::listen(
        web_sys::window().ok_or(JsValue::NULL)?.as_ref(),
        "corvus-language-change",
        move |_| {
            report(translate().and_then(|_| update()));
        },
    )
}
fn once(key: &str) -> Result<bool, JsValue> {
    let b = ui::doc()?.body().ok_or(JsValue::NULL)?;
    let key = format!("data-rust-army-{key}");
    if b.has_attribute(&key) {
        return Ok(false);
    }
    b.set_attribute(&key, "")?;
    Ok(true)
}
fn ready(key: &str) {
    if let Some(b) = ui::doc().ok().and_then(|d| d.body()) {
        let _ = b.set_attribute(&format!("data-rust-army-{key}-ready"), "");
    }
}
