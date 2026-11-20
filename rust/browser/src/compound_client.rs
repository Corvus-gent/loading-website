//! Shared Compound attribution and transport, preserving opt-in journey storage and session IDs.
use crate::{arrival, consent, ui};
use serde_json::{Value, json};
use std::cell::RefCell;
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, spawn_local};
const KEY: &str = "compound-journey-v1";
const CHOICE: &str = "compound-journey-choice";
struct Journey {
    first: Value,
    journey: Option<Value>,
    session: String,
    has_source: bool,
}
thread_local! {static STATE:RefCell<Option<Journey>>=const{RefCell::new(None)};}
fn get(key: &str) -> Option<String> {
    web_sys::window()?
        .local_storage()
        .ok()??
        .get_item(key)
        .ok()
        .flatten()
}
fn set(key: &str, value: Option<&str>) {
    if let Some(storage) = web_sys::window().and_then(|w| w.local_storage().ok().flatten()) {
        let _ = if let Some(v) = value {
            storage.set_item(key, v)
        } else {
            storage.remove_item(key)
        };
    }
}
#[wasm_bindgen]
pub fn compound_deep_allowed() -> bool {
    get(CHOICE).as_deref() == Some("yes")
        && consent::analytics_allowed()
        && !consent::privacy_signal()
}
fn reload() {
    STATE.with_borrow_mut(|state| {
        let Some(s) = state else { return };
        if !compound_deep_allowed() {
            set(KEY, None);
            s.journey = None;
            return;
        }
        let now = js_sys::Date::now();
        let previous = get(KEY)
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .filter(|v| {
                v["expires"].as_f64().is_some_and(|t| t > now)
                    && v["id"].as_str().is_some_and(|s| {
                        s.len() == 36
                            && s.bytes().all(|b| {
                                b.is_ascii_digit() || (b'a'..=b'f').contains(&b) || b == b'-'
                            })
                    })
            });
        if let Some(j) = previous {
            s.journey = Some(j)
        }
        if s.journey.is_none() {
            s.journey = Some(json!({"id":s.session,"first":s.first,"expires":now+90.0*86400000.0}));
        }
        if let Some(j) = &mut s.journey {
            if !corvus_core::army::truthy(&j["last"]) || s.has_source {
                j["last"] = s.first.clone();
            }
            set(KEY, Some(&j.to_string()));
        }
    });
}
#[wasm_bindgen]
pub fn start_compound_client() -> Result<(), JsValue> {
    if STATE.with_borrow(|s| s.is_some()) {
        return Ok(());
    }
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let saved = arrival::arrival_search();
    let search = if saved.is_empty() {
        w.location().search()?
    } else {
        saved
    };
    let query = web_sys::UrlSearchParams::new_with_str(&search)?;
    let referrer = ui::doc()?.referrer();
    let source = corvus_core::attribution::inferred(
        &search,
        &w.navigator().user_agent().unwrap_or_default(),
        &referrer,
    );
    let host = web_sys::Url::new(&referrer)
        .map(|u| u.hostname())
        .unwrap_or_default();
    let first = json!({"source":source["source"],"source_confidence":source["source_confidence"],"medium":query.get("utm_medium").unwrap_or_default(),"campaign":query.get("utm_campaign").unwrap_or_default(),"content":query.get("utm_content").unwrap_or_default(),"term":query.get("utm_term").unwrap_or_default(),"referrer":host,"landed":js_sys::Date::now()});
    let session = w.crypto()?.random_uuid();
    STATE.with_borrow_mut(|s| {
        *s = Some(Journey {
            first,
            journey: None,
            session,
            has_source: query.has("utm_source"),
        })
    });
    reload();
    ui::listen(w.as_ref(), "analytics-consent-change", |_| reload())?;
    Ok(())
}
#[wasm_bindgen]
pub fn compound_set_deep(on: bool) {
    set(CHOICE, Some(if on { "yes" } else { "no" }));
    if !on {
        set(KEY, None)
    }
    STATE.with_borrow_mut(|s| {
        if let Some(s) = s {
            s.journey = None
        }
    });
    reload();
}
#[wasm_bindgen]
pub fn compound_handle() -> String {
    get("compound-handle").unwrap_or_default()
}
#[wasm_bindgen]
pub fn compound_set_handle(value: &str) {
    set("compound-handle", (!value.is_empty()).then_some(value));
}
pub fn tags() -> Value {
    STATE.with_borrow(|state|{let Some(s)=state else{return json!({"analytics":false})};let allowed=consent::analytics_allowed()&&!consent::privacy_signal();let first=s.journey.as_ref().map(|j|&j["first"]).filter(|j|corvus_core::army::truthy(j)).unwrap_or(&s.first);let last=s.journey.as_ref().map(|j|&j["last"]).filter(|j|corvus_core::army::truthy(j)).unwrap_or(&s.first);let mut attribution=if last.is_object(){last.clone()}else{json!({})};attribution["first"]=first.clone();attribution["last"]=last.clone();let mut data=json!({"attribution":attribution,"analytics":if !allowed{json!(false)}else if s.journey.is_some(){json!(true)}else{json!("session")}});if allowed{data["visitor"]=s.journey.as_ref().map(|j|j["id"].clone()).unwrap_or(json!(s.session));data["visit"]=json!(s.session);}data})
}
#[wasm_bindgen]
pub fn compound_tags() -> JsValue {
    let value = js_sys::JSON::parse(&tags().to_string()).unwrap_or(JsValue::NULL);
    if !consent::analytics_allowed() || consent::privacy_signal() {
        let _ = js_sys::Reflect::set(&value, &"visitor".into(), &JsValue::UNDEFINED);
        let _ = js_sys::Reflect::set(&value, &"visit".into(), &JsValue::UNDEFINED);
    }
    value
}
pub async fn api(body: Option<Value>, query: &str, v2: bool) -> Result<Value, JsValue> {
    let options = web_sys::RequestInit::new();
    options.set_method(if body.is_some() { "POST" } else { "GET" });
    options.set_credentials(web_sys::RequestCredentials::SameOrigin);
    options.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(12000)));
    options.set_cache(
        if v2 || body.is_some() || query.contains("private=") || query.contains("session=") {
            web_sys::RequestCache::NoStore
        } else {
            web_sys::RequestCache::Default
        },
    );
    if let Some(body) = &body {
        let mut merged = tags();
        if let Some(body) = body.as_object() {
            for (k, v) in body {
                merged[k] = v.clone();
            }
        }
        options.set_body(&JsValue::from_str(&merged.to_string()));
    }
    let request = web_sys::Request::new_with_str_and_init(
        &format!("/api/compound{}{query}", if v2 { "-v2" } else { "" }),
        &options,
    )?;
    if body.is_some() {
        request.headers().set("Content-Type", "application/json")?;
    }
    let response = JsFuture::from(
        web_sys::window()
            .ok_or(JsValue::NULL)?
            .fetch_with_request(&request),
    )
    .await?
    .dyn_into::<web_sys::Response>()?;
    let data = JsFuture::from(response.text()?)
        .await?
        .as_string()
        .unwrap_or_default();
    let data: Value = serde_json::from_str(&data)
        .map_err(|_| JsValue::from_str("Connection lost. Try again."))?;
    if !response.ok() {
        return Err(JsValue::from_str(data["error"].as_str().unwrap_or(if v2 {
            "Connection lost. Try again."
        } else {
            "the crow lost its connection. try again."
        })));
    }
    Ok(data)
}
#[wasm_bindgen]
pub async fn compound_api(body: JsValue, query: &str) -> Result<JsValue, JsValue> {
    let body = if body.is_undefined() || body.is_null() {
        None
    } else {
        let s = js_sys::JSON::stringify(&body)?
            .as_string()
            .unwrap_or_default();
        Some(serde_json::from_str(&s).map_err(|_| JsValue::NULL)?)
    };
    let v = api(body, query, false).await.map_err(|e| {
        if let Some(message) = e.as_string() {
            js_sys::Error::new(&message).into()
        } else {
            e
        }
    })?;
    js_sys::JSON::parse(&v.to_string())
}
pub fn event(body: Value, v2: bool) {
    let mut merged = tags();
    if let Some(body) = body.as_object() {
        for (k, v) in body {
            merged[k] = v.clone();
        }
    }
    spawn_local(async move {
        let _ = async {
            let options = web_sys::RequestInit::new();
            options.set_method("POST");
            options.set_credentials(web_sys::RequestCredentials::SameOrigin);
            options.set_body(&JsValue::from_str(&merged.to_string()));
            js_sys::Reflect::set(&options, &"keepalive".into(), &JsValue::TRUE)?;
            let request = web_sys::Request::new_with_str_and_init(
                if v2 {
                    "/api/compound-v2"
                } else {
                    "/api/compound"
                },
                &options,
            )?;
            request.headers().set("Content-Type", "application/json")?;
            JsFuture::from(
                web_sys::window()
                    .ok_or(JsValue::NULL)?
                    .fetch_with_request(&request),
            )
            .await?;
            Ok::<_, JsValue>(())
        }
        .await;
    });
}
#[wasm_bindgen]
pub fn compound_beacon(body: JsValue) {
    if let Ok(s) = js_sys::JSON::stringify(&body)
        && let Some(s) = s.as_string()
        && let Ok(v) = serde_json::from_str(&s)
    {
        event(v, false);
    }
}
#[wasm_bindgen]
pub fn compound_node(
    tag: &str,
    text: JsValue,
    class: JsValue,
) -> Result<web_sys::Element, JsValue> {
    let e = ui::doc()?.create_element(tag)?;
    if !text.is_undefined() {
        if text.is_null() {
            e.set_text_content(None);
        } else {
            let constructor = js_sys::Reflect::get(&js_sys::global(), &"String".into())?
                .dyn_into::<js_sys::Function>()?;
            let string = constructor
                .call1(&JsValue::UNDEFINED, &text)?
                .as_string()
                .unwrap_or_default();
            e.set_text_content(Some(&string));
        }
    }
    if let Some(class) = class.as_string().filter(|s| !s.is_empty()) {
        e.set_class_name(&class);
    }
    Ok(e)
}

#[wasm_bindgen]
pub fn inferred_source(search: &str, user_agent: &str, referrer: &str) -> JsValue {
    js_sys::JSON::parse(
        &corvus_core::attribution::inferred(search, user_agent, referrer).to_string(),
    )
    .unwrap_or(JsValue::NULL)
}
