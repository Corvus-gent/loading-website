//! Privacy-sensitive browser analytics boundary. Provider SDK wiring is migrated separately.
use crate::ui;
use corvus_core::analytics as policy;
use serde_json::{Value, json};
use std::cell::RefCell;
use wasm_bindgen::{JsCast, prelude::*};
thread_local! {static APPROVED:RefCell<Vec<String>>=const{RefCell::new(Vec::new())};static QUEST:RefCell<Option<Value>>=const{RefCell::new(None)};}
fn value(v: &JsValue) -> Value {
    js_sys::JSON::stringify(v)
        .ok()
        .and_then(|s| s.as_string())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Null)
}
fn js(v: &Value) -> Result<JsValue, JsValue> {
    js_sys::JSON::parse(&v.to_string())
}
#[wasm_bindgen]
pub fn analytics_config() -> Result<JsValue, JsValue> {
    js(policy::config())
}
#[wasm_bindgen]
pub fn analytics_category(value_: JsValue, allowed: JsValue, fallback: JsValue) -> JsValue {
    if js_sys::Array::is_array(&allowed) && js_sys::Array::from(&allowed).includes(&value_, 0) {
        value_
    } else {
        fallback
    }
}
#[wasm_bindgen]
pub fn analytics_source(v: JsValue) -> Result<JsValue, JsValue> {
    js(&policy::source(&value(&v)))
}
#[wasm_bindgen]
pub fn analytics_campaign(v: JsValue) -> Result<JsValue, JsValue> {
    js(&policy::campaign(&value(&v)))
}
#[wasm_bindgen]
pub fn analytics_referrer(v: JsValue) -> Result<JsValue, JsValue> {
    js(&policy::referrer(&value(&v)))
}
#[wasm_bindgen]
pub fn analytics_path(v: JsValue) -> String {
    policy::path(&value(&v))
}
#[wasm_bindgen]
pub fn analytics_host(v: JsValue) -> Result<JsValue, JsValue> {
    js(&policy::host(&value(&v)))
}
#[wasm_bindgen]
pub fn analytics_url(v: JsValue, base: String) -> String {
    policy::safe_url((!v.is_undefined()).then(|| value(&v)).as_ref(), &base)
}
#[wasm_bindgen]
pub fn analytics_country(v: JsValue) -> Result<JsValue, JsValue> {
    js(&policy::country(&value(&v)))
}
#[wasm_bindgen]
pub fn analytics_sidequest(v: JsValue) -> Result<JsValue, JsValue> {
    js(&json!(policy::sidequest(&value(&v))))
}
#[wasm_bindgen]
pub fn analytics_slug(v: JsValue) -> String {
    policy::campaign_slug(&value(&v))
}
#[wasm_bindgen]
pub fn analytics_slot(v: JsValue) -> String {
    policy::slot(&value(&v))
}
#[wasm_bindgen]
pub fn set_x_campaigns(v: JsValue) {
    APPROVED.with_borrow_mut(|list| {
        *list = value(&v)
            .as_array()
            .into_iter()
            .flatten()
            .map(policy::campaign_slug)
            .filter(|s| !s.is_empty())
            .collect()
    });
}
#[wasm_bindgen]
pub fn approved_campaign(v: JsValue) -> String {
    let slug = policy::campaign_slug(&value(&v));
    if APPROVED.with_borrow(|a| a.contains(&slug)) {
        slug
    } else {
        String::new()
    }
}
#[wasm_bindgen]
pub fn analytics_x_context(path: &str, search: &str) -> Result<JsValue, JsValue> {
    js(&policy::x_context(path, search))
}
#[wasm_bindgen]
pub fn analytics_link_context(path: &str, search: &str) -> Result<JsValue, JsValue> {
    js(&policy::link_context(path, search))
}
fn language_valid(v: &Value) -> bool {
    let result = (|| -> Result<JsValue, JsValue> {
        let intl = js_sys::Reflect::get(&js_sys::global(), &"Intl".into())?;
        let ctor =
            js_sys::Reflect::get(&intl, &"DisplayNames".into())?.dyn_into::<js_sys::Function>()?;
        let instance = js_sys::Reflect::construct(
            &ctor,
            &js_sys::Array::of2(
                &js_sys::Array::of1(&"en".into()),
                &js(&json!({"type":"language","fallback":"none"}))?,
            ),
        )?;
        js_sys::Reflect::get(&instance, &"of".into())?
            .dyn_into::<js_sys::Function>()?
            .call1(&instance, &js(v)?)
    })();
    result.is_ok_and(|s| s.as_string().is_some_and(|s| !s.is_empty()))
}
#[wasm_bindgen]
pub fn analytics_privacy_event(v: JsValue) -> Result<JsValue, JsValue> {
    let e = value(&v);
    let valid = e["event"] == "language_vote" && language_valid(&e["properties"]["language"]);
    js(&APPROVED.with_borrow(|approved| policy::event(&e, approved, valid)))
}
#[wasm_bindgen]
pub fn quest_tags() -> Result<JsValue, JsValue> {
    if !crate::consent::analytics_allowed() {
        QUEST.replace(None);
        return js(&json!({}));
    }
    let v = QUEST.with_borrow_mut(|q| {
        q.get_or_insert_with(|| {
            if !crate::arrival::sidequests_page() {
                return json!({});
            }
            let mut p = json!({});
            for (k, v) in url::form_urlencoded::parse(
                crate::arrival::arrival_search()
                    .trim_start_matches('?')
                    .as_bytes(),
            ) {
                p[&*k] = json!(v);
            }
            json!(policy::sidequest(&p))
        })
        .clone()
    });
    js(&v)
}
#[wasm_bindgen]
pub fn attributed_url(href: &str, path: &str) -> Result<web_sys::Url, JsValue> {
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let u = web_sys::Url::new_with_base(href, &w.location().href()?)?;
    let host = u.hostname();
    if ["pidgy-ai.com", "app.pidgy-ai.com"].contains(&host.as_str()) {
        for (k, v) in [
            ("utm_source", "corvus".to_owned()),
            ("utm_medium", policy::path(&json!(path))),
            ("utm_campaign", "site".into()),
            ("ref", "corvus".into()),
        ] {
            if !u.search_params().has(k) {
                u.search_params().set(k, &v);
            }
        }
    }
    if ["the-feed.corvus.gent", "hackthefeed-six.vercel.app"].contains(&host.as_str())
        || (host == "github.com" && u.pathname().starts_with("/SiebeBaree/hackthefeed"))
    {
        for (k, v) in [
            ("utm_source", "corvus"),
            ("ref", "corvus"),
            ("utm_campaign", "hack"),
        ] {
            u.search_params().set(k, v);
        }
    }
    Ok(u)
}
fn outbound(e: web_sys::Event) {
    let _ = (|| -> Result<(), JsValue> {
        let Some(a) = e
            .target()
            .and_then(|e| e.dyn_into::<web_sys::Element>().ok())
            .and_then(|e| e.closest("a[href]").ok().flatten())
        else {
            return Ok(());
        };
        let w = web_sys::window().ok_or(JsValue::NULL)?;
        let path = w.location().pathname()?;
        let u = attributed_url(&a.get_attribute("href").unwrap_or_default(), &path)?;
        if !["http:", "https:"].contains(&u.protocol().as_str())
            || u.origin() == w.location().origin()?
        {
            return Ok(());
        }
        a.set_attribute("href", &u.href())?;
        let ph = js_sys::Reflect::get(&w, &"posthog".into())?;
        let capture =
            js_sys::Reflect::get(&ph, &"capture".into())?.dyn_into::<js_sys::Function>()?;
        capture.call3(&ph,&"outbound_click".into(),&js(&json!({"host":policy::host(&json!(u.hostname())),"href":policy::safe_url(Some(&json!(u.href())),"https://corvus.gent"),"path":policy::path(&json!(path))}))?,&js(&json!({"transport":"sendBeacon"}))?)?;
        Ok(())
    })();
}
#[wasm_bindgen]
pub fn start_outbound() -> Result<(), JsValue> {
    let doc = ui::doc()?;
    if doc
        .document_element()
        .is_some_and(|e| e.has_attribute("data-rust-outbound"))
    {
        return Ok(());
    }
    if let Some(root) = doc.document_element() {
        root.set_attribute("data-rust-outbound", "")?;
    }
    for name in ["click", "auxclick"] {
        let f = Closure::<dyn FnMut(web_sys::Event)>::new(move |e: web_sys::Event| {
            if name == "click"
                || e.dyn_ref::<web_sys::MouseEvent>()
                    .is_some_and(|m| m.button() == 1)
            {
                outbound(e);
            }
        });
        doc.add_event_listener_with_callback_and_bool(name, f.as_ref().unchecked_ref(), true)?;
        f.forget();
    }
    Ok(())
}

mod runtime;
#[wasm_bindgen]
pub fn start_analytics() -> Result<(), JsValue> {
    runtime::install()
}

mod short;
#[wasm_bindgen]
pub async fn resolve_short(path: String, search: String) -> Result<JsValue, JsValue> {
    js(&short::resolve(&path, &search).await?)
}
#[wasm_bindgen]
pub async fn go_short() -> Result<(), JsValue> {
    short::go().await
}
