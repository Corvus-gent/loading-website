//! Small browser boundary; page behavior remains in Rust and content stays in HTML.
use serde_json::Value;
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::JsFuture;
pub fn doc() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|w| w.document())
        .ok_or_else(|| JsValue::from_str("Document unavailable"))
}
pub fn element(id: &str) -> Result<web_sys::HtmlElement, JsValue> {
    doc()?
        .get_element_by_id(id)
        .ok_or_else(|| JsValue::from_str("Missing page element"))?
        .dyn_into()
        .map_err(Into::into)
}
pub fn text(id: &str, message: &str) {
    if let Ok(el) = element(id) {
        el.set_text_content(Some(message));
    }
}
pub fn hidden(id: &str, value: bool) {
    if let Ok(el) = element(id) {
        el.set_hidden(value);
    }
}
pub fn listen(
    target: &web_sys::EventTarget,
    event: &str,
    callback: impl FnMut(web_sys::Event) + 'static,
) -> Result<(), JsValue> {
    let callback = Closure::wrap(Box::new(callback) as Box<dyn FnMut(web_sys::Event)>);
    target.add_event_listener_with_callback(event, callback.as_ref().unchecked_ref())?;
    callback.forget();
    Ok(())
}
pub fn message(error: &JsValue) -> String {
    if let Ok(v) = js_sys::Reflect::get(error, &JsValue::from_str("message"))
        && let Some(v) = v.as_string()
    {
        return v;
    }
    error
        .as_string()
        .unwrap_or_else(|| "Please try again.".into())
}
pub async fn json(
    url: &str,
    body: Option<Value>,
    key: Option<&str>,
    timeout: u32,
) -> Result<(bool, Value), JsValue> {
    let window = web_sys::window().ok_or_else(|| JsValue::from_str("Window unavailable"))?;
    let options = web_sys::RequestInit::new();
    options.set_method(if body.is_some() { "POST" } else { "GET" });
    options.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(timeout)));
    if let Some(body) = &body {
        options.set_body(&JsValue::from_str(&body.to_string()));
    }
    let request = web_sys::Request::new_with_str_and_init(url, &options)?;
    if body.is_some() {
        request.headers().set("Content-Type", "application/json")?;
    }
    if let Some(key) = key.filter(|s| !s.is_empty()) {
        request
            .headers()
            .set("Authorization", &format!("Bearer {key}"))?;
    }
    let response = JsFuture::from(window.fetch_with_request(&request))
        .await?
        .dyn_into::<web_sys::Response>()?;
    let text = JsFuture::from(response.text()?)
        .await?
        .as_string()
        .unwrap_or_default();
    let data = serde_json::from_str(&text).map_err(|_| JsValue::from_str("Please try again."))?;
    Ok((response.ok(), data))
}
pub async fn sleep(ms: i32) -> Result<(), JsValue> {
    if ms <= 0 {
        return Ok(());
    }
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        if let Some(w) = web_sys::window() {
            if let Err(e) = w.set_timeout_with_callback_and_timeout_and_arguments_0(&resolve, ms) {
                let _ = reject.call1(&JsValue::UNDEFINED, &e);
            }
        } else {
            let _ = resolve.call0(&JsValue::UNDEFINED);
        }
    });
    JsFuture::from(promise).await?;
    Ok(())
}
pub fn scroll(id: &str, smooth: bool, nearest: bool) {
    if let Ok(el) = element(id) {
        let options = web_sys::ScrollIntoViewOptions::new();
        options.set_behavior(if smooth {
            web_sys::ScrollBehavior::Smooth
        } else {
            web_sys::ScrollBehavior::Instant
        });
        options.set_block(if nearest {
            web_sys::ScrollLogicalPosition::Nearest
        } else {
            web_sys::ScrollLogicalPosition::Start
        });
        el.scroll_into_view_with_scroll_into_view_options(&options);
    }
}
