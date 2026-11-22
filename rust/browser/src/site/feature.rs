use super::*;
use std::{cell::RefCell, collections::HashMap};
use wasm_bindgen_futures::future_to_promise;
thread_local! {static CACHE:RefCell<HashMap<String,JsValue>>=RefCell::new(HashMap::new());static PENDING:RefCell<HashMap<String,js_sys::Promise>>=RefCell::new(HashMap::new());}
fn error(s: &str) -> JsValue {
    js_sys::Error::new(s).into()
}
fn request(feature: String, lang: String) -> js_sys::Promise {
    if !["army", "mail", "wiki"].contains(&feature.as_str())
        || !["en", "nl", "es", "fr", "pt", "de", "zh"].contains(&lang.as_str())
    {
        return js_sys::Promise::reject(&error("unknown locale"));
    }
    let key = format!("{feature}:{lang}");
    if let Some(cached) = CACHE.with_borrow(|c| c.get(&key).cloned()) {
        return js_sys::Promise::resolve(&cached);
    }
    if let Some(pending) = PENDING.with_borrow(|p| p.get(&key).cloned()) {
        return pending;
    }
    let saved = key.clone();
    let promise = future_to_promise(async move {
        let result = async {
            let options = web_sys::RequestInit::new();
            options.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(5000)));
            let req = web_sys::Request::new_with_str_and_init(
                &format!("/js/i18n/{feature}.{lang}.json?v=20261108-entry1"),
                &options,
            )?;
            let r = JsFuture::from(window()?.fetch_with_request(&req))
                .await?
                .dyn_into::<web_sys::Response>()?;
            if !r.ok() {
                return Err(error("locale unavailable"));
            }
            let data = JsFuture::from(r.json()?).await?;
            if data.is_null() || !data.is_object() || js_sys::Array::is_array(&data) {
                return Err(error("invalid locale"));
            }
            let object = data.clone().dyn_into::<js_sys::Object>()?;
            if js_sys::Object::values(&object)
                .iter()
                .any(|v| v.as_string().is_none())
            {
                return Err(error("invalid locale"));
            }
            let frozen: JsValue = js_sys::Object::freeze(&object).into();
            CACHE.with_borrow_mut(|c| c.insert(saved.clone(), frozen.clone()));
            Ok(frozen)
        }
        .await;
        let result = match result {
            Err(_) if lang != "en" => JsFuture::from(request(feature, "en".into())).await,
            other => other,
        };
        PENDING.with_borrow_mut(|p| p.remove(&saved));
        result
    });
    PENDING.with_borrow_mut(|p| p.insert(key, promise.clone()));
    promise
}
pub(super) fn load(feature: String, lang: String) -> js_sys::Promise {
    request(feature, lang)
}
pub(super) fn format(text: JsValue, values: JsValue) -> Result<String, JsValue> {
    let string = js_sys::Reflect::get(&js_sys::global(), &"String".into())?
        .dyn_into::<js_sys::Function>()?;
    let text = string
        .call1(&JsValue::UNDEFINED, &text)?
        .as_string()
        .unwrap_or_default();
    let regex = regex::Regex::new(r"\{([A-Za-z0-9_]+)\}").map_err(|_| JsValue::NULL)?;
    Ok(regex
        .replace_all(&text, |caps: &regex::Captures<'_>| {
            let v = js_sys::Reflect::get(&values, &caps[1].into()).unwrap_or(JsValue::NULL);
            if v.is_null() || v.is_undefined() {
                String::new()
            } else {
                string
                    .call1(&JsValue::UNDEFINED, &v)
                    .ok()
                    .and_then(|s| s.as_string())
                    .unwrap_or_default()
            }
        })
        .into_owned())
}
pub(super) fn text(
    feature: String,
    key: String,
    values: JsValue,
    lang: String,
) -> Result<String, JsValue> {
    let selected = CACHE
        .with_borrow(|c| {
            [format!("{feature}:{lang}"), format!("{feature}:en")]
                .into_iter()
                .filter_map(|k| c.get(&k))
                .find_map(|v| {
                    js_sys::Reflect::get(v, &key.clone().into())
                        .ok()
                        .filter(|v| !v.is_null() && !v.is_undefined())
                })
        })
        .unwrap_or(key.into());
    format(selected, values)
}
