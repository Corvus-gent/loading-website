//! Original three-cut editor: same content, native browser behavior.
mod admin;
mod clock;
mod cut;
mod dom;
mod public;
use crate::{compound_client as client, ui};
use serde_json::{Value, json};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{HtmlElement, HtmlFormElement, HtmlInputElement, HtmlSelectElement};
pub(super) fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
pub(super) fn rows(v: &Value, k: &str) -> Vec<Value> {
    v[k].as_array().cloned().unwrap_or_default()
}
pub(super) fn num(v: &Value) -> f64 {
    v.as_f64().unwrap_or(0.)
}
pub(super) fn fixed(v: f64, d: u8) -> String {
    js_sys::Number::from(v)
        .to_fixed(d)
        .ok()
        .map(String::from)
        .unwrap_or_default()
}
pub(super) fn node(tag: &str, s: &str, class: &str) -> Result<HtmlElement, JsValue> {
    let e = ui::doc()?.create_element(tag)?.dyn_into::<HtmlElement>()?;
    e.set_text_content(Some(s));
    if !class.is_empty() {
        e.set_class_name(class);
    }
    Ok(e)
}
pub(super) fn append(
    p: &impl AsRef<web_sys::Node>,
    c: &impl AsRef<web_sys::Node>,
) -> Result<(), JsValue> {
    p.as_ref().append_child(c.as_ref()).map(|_| ())
}
pub(super) fn clear(id: &str) -> Result<HtmlElement, JsValue> {
    let e = ui::element(id)?;
    e.set_text_content(None);
    Ok(e)
}
pub(super) fn select(id: &str) -> Result<HtmlSelectElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
pub(super) fn input(id: &str) -> Result<HtmlInputElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
pub(super) fn fields(form: &HtmlFormElement) -> Result<Value, JsValue> {
    let data = web_sys::FormData::new_with_form(form)?;
    let mut out = json!({});
    if let Some(iter) = js_sys::try_iter(&data)? {
        for pair in iter {
            let p = js_sys::Array::from(&pair?);
            if let Some(k) = p.get(0).as_string() {
                out[k] = json!(p.get(1).as_string().unwrap_or_default());
            }
        }
    }
    Ok(out)
}
pub(super) async fn api(body: Option<Value>, query: &str) -> Result<Value, JsValue> {
    client::api(body, query, false).await
}
pub(super) fn table(target: &str, heads: &[&str], rows: &[Vec<String>]) -> Result<(), JsValue> {
    let table = node("table", "", "")?;
    let head = node("tr", "", "")?;
    for h in heads {
        append(&head, &node("th", h, "")?)?;
    }
    let thead = node("thead", "", "")?;
    append(&thead, &head)?;
    append(&table, &thead)?;
    let body = node("tbody", "", "")?;
    for row in rows {
        let tr = node("tr", "", "")?;
        for v in row {
            append(&tr, &node("td", v, "")?)?;
        }
        append(&body, &tr)?;
    }
    append(&table, &body)?;
    append(&clear(target)?, &table)
}
pub(super) fn value(v: &Value) -> String {
    if v.is_null() {
        "0".into()
    } else {
        corvus_core::impact::string(v)
    }
}
pub(super) fn count(v: &Value, k: &str) -> String {
    num(&v[k]).to_string()
}
pub(super) fn option(label: &str, value: &str) -> Result<HtmlElement, JsValue> {
    let e = node("option", label, "")?;
    e.set_attribute("value", value)?;
    Ok(e)
}
#[wasm_bindgen]
pub fn start_compound_editor_admin() -> Result<(), JsValue> {
    admin::start(true)
}
#[wasm_bindgen]
pub fn start_compound_editor_stats() -> Result<(), JsValue> {
    admin::start(false)
}

#[wasm_bindgen]
pub fn start_compound_editor() -> Result<(), JsValue> {
    public::start()
}
#[wasm_bindgen]
pub fn start_compound_clock() -> Result<(), JsValue> {
    clock::start()
}
