use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{Document, HtmlAnchorElement, HtmlDocument, MouseEvent, PageTransitionEvent};

fn document() -> Option<Document> {
    web_sys::window()?.document()
}
fn entered() -> bool {
    document()
        .and_then(|d| d.dyn_into::<HtmlDocument>().ok())
        .and_then(|d| d.cookie().ok())
        .is_some_and(|cookie| {
            cookie
                .split(';')
                .any(|part| part.trim() == "corvus_realm=1")
        })
}
fn refresh_after_reset() {
    if let Some(doc) = document()
        && !doc.hidden()
        && !entered()
        && let Some(w) = web_sys::window()
    {
        let _ = w.location().reload();
    }
}
fn listen(
    target: &web_sys::EventTarget,
    name: &str,
    callback: Closure<dyn FnMut(web_sys::Event)>,
) -> Result<(), JsValue> {
    target.add_event_listener_with_callback(name, callback.as_ref().unchecked_ref())?;
    callback.forget();
    Ok(())
}

#[wasm_bindgen]
pub fn start_portal() -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
    let doc = window
        .document()
        .ok_or_else(|| JsValue::from_str("No document"))?;
    let body = doc.body().ok_or_else(|| JsValue::from_str("No body"))?;
    // Multiple old entry modules can import this bridge. Bind listeners only once.
    if body.has_attribute("data-rust-portal") {
        return Ok(());
    }
    body.set_attribute("data-rust-portal", "")?;
    let gate = body.has_attribute("data-realm-gate");
    if let Some(link) = doc
        .query_selector(".realm-enter")?
        .and_then(|e| e.dyn_into::<HtmlAnchorElement>().ok())
    {
        let destination = link.clone();
        listen(
            link.as_ref(),
            "click",
            Closure::new(move |event: web_sys::Event| {
                if gate
                    && let Some(doc) = document().and_then(|d| d.dyn_into::<HtmlDocument>().ok())
                {
                    let reset = js_sys::Date::new(&JsValue::from_f64(crate::next_ritual_ms(
                        js_sys::Date::now(),
                    )));
                    if let Some(expires) = reset.to_utc_string().as_string() {
                        let _ = doc.set_cookie(&format!(
                            "corvus_realm=1; Expires={expires}; Path=/; SameSite=Lax; Secure"
                        ));
                    }
                }
                let Some(window) = web_sys::window() else {
                    return;
                };
                let modified = event
                    .dyn_ref::<MouseEvent>()
                    .is_some_and(|e| e.meta_key() || e.ctrl_key() || e.shift_key() || e.alt_key());
                if modified
                    || window
                        .match_media("(prefers-reduced-motion: reduce)")
                        .ok()
                        .flatten()
                        .is_some_and(|m| m.matches())
                {
                    return;
                }
                event.prevent_default();
                if let Some(body) = document().and_then(|d| d.body()) {
                    let _ = body.class_list().add_1("entering");
                }
                let href = destination.href();
                let callback = Closure::once_into_js(move || {
                    if let Some(w) = web_sys::window() {
                        let _ = w.location().assign(&href);
                    }
                });
                let _ = window.set_timeout_with_callback_and_timeout_and_arguments_0(
                    callback.unchecked_ref(),
                    400,
                );
            }),
        )?;
    }
    listen(
        window.as_ref(),
        "pageshow",
        Closure::new(move |event: web_sys::Event| {
            if !event
                .dyn_ref::<PageTransitionEvent>()
                .is_some_and(|e| e.persisted())
            {
                return;
            }
            if let Some(body) = document().and_then(|d| d.body()) {
                let _ = body.class_list().remove_1("entering");
            }
            if gate == entered()
                && let Some(w) = web_sys::window()
            {
                let _ = w.location().reload();
            }
        }),
    )?;
    if !gate && entered() {
        let callback = Closure::once_into_js(refresh_after_reset);
        let delay = (crate::next_ritual_ms(js_sys::Date::now()) - js_sys::Date::now() + 50.0)
            .clamp(0.0, i32::MAX as f64) as i32;
        window.set_timeout_with_callback_and_timeout_and_arguments_0(
            callback.unchecked_ref(),
            delay,
        )?;
        listen(
            doc.as_ref(),
            "visibilitychange",
            Closure::new(|_| refresh_after_reset()),
        )?;
    }
    Ok(())
}
