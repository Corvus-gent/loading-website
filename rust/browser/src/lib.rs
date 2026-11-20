//! Browser migration entry point. Not injected into production until parity passes.
use wasm_bindgen::prelude::*;
pub mod arrival;
pub mod battle;
pub mod battle_admin;
pub mod language;
pub mod live_banner;
mod portal;
pub mod support;
pub mod support_admin;
mod ui;
pub use portal::start_portal;

#[wasm_bindgen]
pub fn plethora_url(placement: &str) -> Option<String> {
    corvus_core::plethora::official_url(placement)
}

/// The visitor's own local calendar determines the next ritual, including DST.
#[wasm_bindgen]
pub fn next_ritual_ms(now_ms: f64) -> f64 {
    let now = js_sys::Date::new(&JsValue::from_f64(now_ms));
    let next = js_sys::Date::new(&JsValue::from_f64(now_ms));
    next.set_hours(4);
    next.set_minutes(2);
    next.set_seconds(0);
    next.set_milliseconds(0);
    if next.get_time() <= now.get_time() {
        next.set_date(next.get_date() + 1);
    }
    next.get_time()
}
