//! Preserve the small progressive CV enhancements without changing document content.
use crate::{language, ui};
use serde_json::Value;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
thread_local! {static STARTED:std::cell::Cell<bool>=const{std::cell::Cell::new(false)};}
const CODES: [u16; 3] = [512, 520, 1314];

fn format(value: f64, lang: &str) -> Result<String, JsValue> {
    let intl = js_sys::Reflect::get(&js_sys::global(), &"Intl".into())?;
    let constructor =
        js_sys::Reflect::get(&intl, &"NumberFormat".into())?.dyn_into::<js_sys::Function>()?;
    let formatter = js_sys::Reflect::construct(&constructor, &js_sys::Array::of1(&lang.into()))?;
    js_sys::Reflect::get(&formatter, &"format".into())?
        .dyn_into::<js_sys::Function>()?
        .call1(&formatter, &value.into())?
        .as_string()
        .ok_or_else(|| JsValue::from_str("Invalid number formatter"))
}
#[wasm_bindgen]
pub fn format_cv_count(value: JsValue, lang: Option<String>) -> Result<Option<String>, JsValue> {
    // Number::from(JsValue) is a binding cast, not ECMAScript Number(value).
    // Call the constructor so null, booleans, arrays and numeric strings retain their semantics.
    let n = js_sys::Reflect::get(&js_sys::global(), &"Number".into())?
        .dyn_into::<js_sys::Function>()?
        .call1(&JsValue::UNDEFINED, &value)?
        .as_f64()
        .unwrap_or(f64::NAN);
    if !n.is_finite() || n < 0.0 || n.fract() != 0.0 || n > 9_007_199_254_740_991.0 {
        return Ok(None);
    }
    Ok(format(n, lang.as_deref().unwrap_or("en"))
        .or_else(|_| format(n, "en"))
        .ok())
}
struct Cv {
    button: Option<web_sys::Element>,
    index: usize,
    binary: bool,
    hints: Value,
}
impl Cv {
    fn secret(&self, lang: &str) -> Result<(), JsValue> {
        let Some(button) = &self.button else {
            return Ok(());
        };
        let code = CODES[self.index];
        button.set_text_content(Some(&if self.binary {
            format!("{code:b}")
        } else {
            code.to_string()
        }));
        let words = self.hints.get(lang).unwrap_or(&self.hints["en"]);
        let word = |i| words[i].as_str().unwrap_or("");
        let binary = if self.binary {
            format!(", {}", word(1))
        } else {
            String::new()
        };
        let label = format!("{} {code}{binary}. {}", word(0), word(2));
        button.set_attribute("aria-label", &label)?;
        button.set_attribute("title", &label)
    }
    fn next(&mut self, step: isize) -> Result<(), JsValue> {
        self.index = (self.index as isize + step).rem_euclid(CODES.len() as isize) as usize;
        self.binary = false;
        self.secret(&language::get_language())
    }
    fn refresh(&self, lang: &str) -> Result<(), JsValue> {
        let nodes = ui::doc()?.query_selector_all("[data-cv-count]")?;
        for i in 0..nodes.length() {
            if let Some(el) = nodes
                .item(i)
                .and_then(|n| n.dyn_into::<web_sys::Element>().ok())
                && let Some(raw) = el.get_attribute("data-cv-count")
                && let Ok(Some(value)) = format_cv_count(raw.into(), Some(lang.into()))
            {
                el.set_text_content(Some(&value));
            }
        }
        self.secret(lang)
    }
}
#[wasm_bindgen]
pub fn start_cv() -> Result<(), JsValue> {
    if STARTED.replace(true) {
        return Ok(());
    }
    let state = Rc::new(RefCell::new(Cv {
        button: ui::doc()?.query_selector("[data-cv-secret]")?,
        index: 0,
        binary: false,
        hints: serde_json::from_str(include_str!("../../migration/cv-hints.json"))
            .map_err(|_| JsValue::from_str("Invalid CV copy"))?,
    }));
    if let Some(button) = state.borrow().button.clone() {
        let s = state.clone();
        ui::listen(button.as_ref(), "pointerenter", move |event| {
            if event
                .dyn_ref::<web_sys::PointerEvent>()
                .is_some_and(|e| matches!(e.pointer_type().as_str(), "mouse" | "pen"))
            {
                let _ = s.borrow_mut().next(1);
            }
        })?;
        let s = state.clone();
        ui::listen(button.as_ref(), "click", move |event| {
            let mut cv = s.borrow_mut();
            if event
                .dyn_ref::<web_sys::PointerEvent>()
                .is_some_and(|e| e.pointer_type() == "touch")
            {
                let _ = cv.next(1);
            } else {
                cv.binary = !cv.binary;
                let _ = cv.secret(&language::get_language());
            }
        })?;
        let s = state.clone();
        ui::listen(button.as_ref(), "keydown", move |event| {
            if let Some(key) = event.dyn_ref::<web_sys::KeyboardEvent>()
                && matches!(key.key().as_str(), "ArrowLeft" | "ArrowRight")
            {
                event.prevent_default();
                let _ = s
                    .borrow_mut()
                    .next(if key.key() == "ArrowLeft" { -1 } else { 1 });
            }
        })?;
    }
    let s = state.clone();
    ui::listen(
        &web_sys::window().ok_or(JsValue::NULL)?.into(),
        "corvus-language-change",
        move |event| {
            let lang = event
                .dyn_ref::<web_sys::CustomEvent>()
                .and_then(|e| js_sys::Reflect::get(&e.detail(), &"lang".into()).ok())
                .and_then(|v| v.as_string())
                .filter(|v| !v.is_empty())
                .unwrap_or_else(language::get_language);
            let _ = s.borrow().refresh(&lang);
        },
    )?;
    state.borrow().refresh(&language::get_language())
}
