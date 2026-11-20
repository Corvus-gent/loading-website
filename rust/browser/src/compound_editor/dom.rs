use super::*;
use wasm_bindgen_futures::spawn_local;
use web_sys::{Element, Event, EventTarget, HtmlButtonElement, HtmlTextAreaElement};
pub(super) fn query(root: &Element, s: &str) -> Result<HtmlElement, JsValue> {
    root.query_selector(s)?
        .ok_or_else(|| JsValue::from_str("Missing editor control"))?
        .dyn_into()
        .map_err(Into::into)
}
pub(super) fn all(root: &Element, s: &str) -> Result<Vec<HtmlElement>, JsValue> {
    let list = root.query_selector_all(s)?;
    Ok((0..list.length())
        .filter_map(|i| list.item(i)?.dyn_into().ok())
        .collect())
}
pub(super) fn button(e: &HtmlElement) -> Result<HtmlButtonElement, JsValue> {
    e.clone().dyn_into().map_err(Into::into)
}
pub(super) fn disabled(e: &HtmlElement, value: bool) {
    if let Ok(b) = button(e) {
        b.set_disabled(value);
    }
}
pub(super) fn is_disabled(e: &HtmlElement) -> bool {
    button(e).is_ok_and(|b| b.disabled())
}
pub(super) fn textarea(id: &str) -> Result<HtmlTextAreaElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
pub(super) fn pressed(e: &HtmlElement, on: bool) -> Result<(), JsValue> {
    e.set_attribute("aria-pressed", if on { "true" } else { "false" })
}
pub(super) fn selected(e: &HtmlElement, on: bool) -> Result<(), JsValue> {
    e.class_list().toggle_with_force("selected", on).map(|_| ())
}
pub(super) fn reduced() -> bool {
    web_sys::window()
        .and_then(|w| {
            w.match_media("(prefers-reduced-motion: reduce)")
                .ok()
                .flatten()
        })
        .is_some_and(|m| m.matches())
}
pub(super) fn report(r: Result<(), JsValue>) {
    if let Err(e) = r {
        web_sys::console::error_1(&e);
    }
}
pub(super) fn later(ms: i32, f: impl FnOnce() -> Result<(), JsValue> + 'static) {
    spawn_local(async move {
        if ui::sleep(ms).await.is_ok() {
            report(f());
        }
    });
}
pub(super) fn on(
    t: &EventTarget,
    event: &str,
    mut f: impl FnMut(Event) -> Result<(), JsValue> + 'static,
) -> Result<(), JsValue> {
    ui::listen(t, event, move |e| report(f(e)))
}
pub(super) fn listen(
    t: &EventTarget,
    event: &str,
    mut f: impl FnMut(Event) -> Result<(), JsValue> + 'static,
) -> Result<ui::Listener, JsValue> {
    ui::scoped_listener(t, event, move |e| report(f(e)))
}
pub(super) fn interval(
    ms: i32,
    mut f: impl FnMut() -> Result<(), JsValue> + 'static,
) -> Result<(), JsValue> {
    let c = Closure::wrap(Box::new(move || report(f())) as Box<dyn FnMut()>);
    web_sys::window()
        .ok_or(JsValue::NULL)?
        .set_interval_with_callback_and_timeout_and_arguments_0(c.as_ref().unchecked_ref(), ms)?;
    c.forget();
    Ok(())
}
pub(super) fn form(id: &str) -> Result<HtmlFormElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
pub(super) fn stamp(t: f64) -> String {
    format!(
        "{}:{:02}",
        (t / 60.).floor() as i64,
        (t % 60.).floor() as i64
    )
}
