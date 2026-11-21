//! Browser migration entry point. Not injected into production until parity passes.
use wasm_bindgen::prelude::*;
#[cfg(feature = "army")]
mod army;
mod army_transport;
pub mod arrival;
#[cfg(feature = "battle")]
pub mod battle;
#[cfg(feature = "battle")]
pub mod battle_admin;
#[cfg(feature = "compound")]
pub mod compound_client;
#[cfg(feature = "compound")]
pub mod compound_v2;
pub mod consent;
#[cfg(feature = "impact")]
pub mod impact;
#[cfg(feature = "interviews")]
pub mod interviews;
#[cfg(feature = "interviews")]
pub mod interviews_admin;
pub mod language;
#[cfg(feature = "legion")]
mod legion;
pub mod live_banner;
mod portal;
pub mod privacy;
pub mod privacy_page;
#[cfg(feature = "support")]
pub mod support;
#[cfg(feature = "support")]
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

#[cfg(feature = "compound")]
mod compound_admin;

#[cfg(feature = "compound")]
mod compound_editor;

mod site;

mod analytics;

mod cv;
mod page_copy;
