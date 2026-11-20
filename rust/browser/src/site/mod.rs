use crate::ui;
use serde_json::{Value, json};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::JsFuture;
mod discovery;
mod inspiration;
mod shell;
pub(super) fn window() -> Result<web_sys::Window, JsValue> {
    web_sys::window().ok_or_else(|| "Window unavailable".into())
}
pub(super) fn nodes(selector: &str) -> Vec<web_sys::Element> {
    ui::doc()
        .ok()
        .and_then(|d| d.query_selector_all(selector).ok())
        .map(|list| {
            (0..list.length())
                .filter_map(|i| list.item(i).and_then(|n| n.dyn_into().ok()))
                .collect()
        })
        .unwrap_or_default()
}
pub(super) fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
pub(super) fn js(v: &Value) -> Result<JsValue, JsValue> {
    js_sys::JSON::parse(&v.to_string())
}
pub(super) fn value(v: &JsValue) -> Value {
    js_sys::JSON::stringify(v)
        .ok()
        .and_then(|v| v.as_string())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Null)
}
pub(super) fn element(
    tag: &str,
    text: Option<&str>,
    class: Option<&str>,
) -> Result<web_sys::Element, JsValue> {
    let e = ui::doc()?.create_element(tag)?;
    e.set_text_content(text);
    if let Some(class) = class {
        e.set_class_name(class);
    }
    Ok(e)
}
pub(super) fn host() -> String {
    if window()
        .ok()
        .and_then(|w| w.location().hostname().ok())
        .as_deref()
        == Some("stats.corvus.gent")
    {
        "https://corvus.gent".into()
    } else {
        String::new()
    }
}
pub(super) fn event(name: &str, detail: &Value) -> Result<(), JsValue> {
    let e = web_sys::CustomEventInit::new();
    e.set_detail(&js(detail)?);
    window()?.dispatch_event(&web_sys::CustomEvent::new_with_event_init_dict(name, &e)?.into())?;
    Ok(())
}
pub(super) async fn get(
    url: &str,
    cache: web_sys::RequestCache,
    timeout: u32,
) -> Result<Value, JsValue> {
    let opt = web_sys::RequestInit::new();
    opt.set_cache(cache);
    opt.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(timeout)));
    opt.set_credentials(web_sys::RequestCredentials::SameOrigin);
    let request = web_sys::Request::new_with_str_and_init(url, &opt)?;
    let response = JsFuture::from(window()?.fetch_with_request(&request))
        .await?
        .dyn_into::<web_sys::Response>()?;
    if !response.ok() {
        return Err("directory unavailable".into());
    }
    let body = JsFuture::from(response.text()?)
        .await?
        .as_string()
        .unwrap_or_default();
    serde_json::from_str(&body).map_err(|_| "directory unavailable".into())
}
pub(super) fn preference(key: &str) -> Value {
    let Ok(Some(storage)) = window().and_then(|w| w.local_storage()) else {
        return Value::Null;
    };
    let Ok(Some(raw)) = storage.get_item(key) else {
        return Value::Null;
    };
    let v = serde_json::from_str::<Value>(&raw).unwrap_or(json!(raw));
    if v.is_object() && v.get("expires").is_some() {
        if v["expires"]
            .as_f64()
            .is_some_and(|n| n.is_finite() && n > js_sys::Date::now())
        {
            v["value"].clone()
        } else {
            let _ = storage.remove_item(key);
            Value::Null
        }
    } else {
        save_preference(key, &v);
        v
    }
}
pub(super) fn save_preference(key: &str, v: &Value) {
    if let Ok(Some(storage)) = window().and_then(|w| w.local_storage()) {
        let _ = storage.set_item(
            key,
            &json!({"value":v,"expires":js_sys::Date::now()+31536000000.0}).to_string(),
        );
    }
}
#[wasm_bindgen]
pub fn site_canonical(value: &str) -> Option<String> {
    corvus_core::site::canonical(value, &window().ok()?.location().href().ok()?)
}
#[wasm_bindgen]
pub fn compound_tracked_url(
    href: &str,
    placement: Option<String>,
    base: Option<String>,
) -> Option<String> {
    corvus_core::site::compound_url(
        href,
        placement.as_deref().unwrap_or("site"),
        base.as_deref().unwrap_or("https://corvus.gent"),
    )
}
#[wasm_bindgen]
pub async fn site_load_routes() -> Result<JsValue, JsValue> {
    js(&Value::Array(discovery::load().await))
}
#[wasm_bindgen]
pub async fn site_fresh_entries(routes: JsValue, force: bool) -> Result<JsValue, JsValue> {
    js(&Value::Array(
        discovery::fresh(
            value(&routes).as_array().cloned().unwrap_or_default(),
            force,
        )
        .await,
    ))
}
#[wasm_bindgen]
pub fn start_site_discovery() -> Result<(), JsValue> {
    discovery::start()
}
#[wasm_bindgen]
pub fn start_site_shell() -> Result<(), JsValue> {
    shell::start()
}
#[wasm_bindgen]
pub fn start_inspiration() -> Result<(), JsValue> {
    inspiration::start()
}
#[wasm_bindgen]
pub fn start_compound_links() -> Result<(), JsValue> {
    shell::compound_links()
}
#[wasm_bindgen]
pub fn start_daily() -> Result<(), JsValue> {
    fn reveal(hash: &str) {
        let Ok(doc) = ui::doc() else { return };
        let mut node = doc.get_element_by_id(hash.strip_prefix('#').unwrap_or(""));
        while let Some(n) = node {
            if let Some(d) = n.dyn_ref::<web_sys::HtmlDetailsElement>() {
                d.set_open(true);
            }
            node = n.parent_element();
        }
    }
    for a in nodes("a[href^=\"#\"]") {
        let href = a.get_attribute("href").unwrap_or_default();
        ui::listen(&a, "click", move |_| reveal(&href))?;
    }
    ui::listen(&window()?.into(), "hashchange", move |_| {
        if let Ok(w) = window() {
            reveal(&w.location().hash().unwrap_or_default());
        }
    })?;
    reveal(&window()?.location().hash()?);
    Ok(())
}
