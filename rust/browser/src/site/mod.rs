use crate::ui;
use serde_json::{Value, json};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::JsFuture;
mod corner;
mod discovery;
mod effects;
mod eggs;
mod feature;
mod inspiration;
mod realm;
mod shell;
mod terminal;

type Timer = (JsValue, Closure<dyn FnMut()>);
thread_local! {
 static TIMERS:std::cell::RefCell<std::collections::HashMap<i32,Timer>>=std::cell::RefCell::new(std::collections::HashMap::new());
 static NEXT_TIMER:std::cell::Cell<i32>=const{std::cell::Cell::new(1)};
}
pub(crate) fn later(ms: i32, f: impl FnOnce() + 'static) -> Result<i32, JsValue> {
    let id = NEXT_TIMER.with(|n| {
        let id = n.get();
        n.set(if id == i32::MAX { 1 } else { id + 1 });
        id
    });
    let mut task = Some(f);
    let callback = Closure::<dyn FnMut()>::new(move || {
        if let Some(f) = task.take() {
            f();
        }
        TIMERS.with_borrow_mut(|timers| timers.remove(&id));
    });
    let w = window()?;
    // Keep the browser's handle intact, including instrumented clocks that use IDs
    // above i32::MAX. Our small Rust ID owns the callback independently of that handle.
    let native = js_sys::Reflect::get(&w, &"setTimeout".into())?
        .dyn_into::<js_sys::Function>()?
        .call2(&w, callback.as_ref(), &ms.into())?;
    TIMERS.with_borrow_mut(|timers| timers.insert(id, (native, callback)));
    Ok(id)
}
pub(crate) fn cancel(id: i32) {
    if let Some((handle, _callback)) = TIMERS.with_borrow_mut(|timers| timers.remove(&id))
        && let Ok(w) = window()
    {
        let _ = js_sys::Reflect::get(&w, &"clearTimeout".into())
            .ok()
            .and_then(|f| f.dyn_into::<js_sys::Function>().ok())
            .and_then(|f| f.call1(&w, &handle).ok());
    }
}
pub(super) fn capture(name: &str, data: &Value) {
    let _ = (|| -> Result<(), JsValue> {
        let ph = js_sys::Reflect::get(&window()?.into(), &"posthog".into())?;
        let f = js_sys::Reflect::get(&ph, &"capture".into())?.dyn_into::<js_sys::Function>()?;
        f.call2(&ph, &name.into(), &js(data)?)?;
        Ok(())
    })();
}
#[wasm_bindgen]
pub fn start_terminal() -> Result<(), JsValue> {
    terminal::start()
}
#[wasm_bindgen]
pub fn open_terminal(first_key: Option<String>) -> Result<(), JsValue> {
    terminal::open(first_key.as_deref().unwrap_or(""))
}
#[wasm_bindgen]
pub fn start_eggs() -> Result<(), JsValue> {
    eggs::start()
}
#[wasm_bindgen]
pub fn collect_realm_feather() -> Result<(), JsValue> {
    eggs::realm()
}
#[wasm_bindgen]
pub fn start_realm() -> Result<(), JsValue> {
    realm::start()
}
#[wasm_bindgen]
pub fn start_realm_night() -> Result<(), JsValue> {
    realm::night()
}
#[wasm_bindgen]
pub fn start_performance() -> Result<(), JsValue> {
    effects::start()
}
#[wasm_bindgen]
pub fn show_storage_warning(until: Option<String>) -> Result<(), JsValue> {
    effects::storage(until.unwrap_or_default())
}
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

#[wasm_bindgen]
pub fn start_i18n() -> Result<(), JsValue> {
    corner::start()
}
#[wasm_bindgen]
pub fn init_i18n(callback: Option<js_sys::Function>) -> Result<(), JsValue> {
    corner::init(callback)
}
#[wasm_bindgen]
pub fn render_corner_search(container: web_sys::Element) -> Result<(), JsValue> {
    corner::search(container)
}

#[wasm_bindgen]
pub fn load_feature(feature: String, lang: String) -> js_sys::Promise {
    feature::load(feature, lang)
}
#[wasm_bindgen]
pub fn format_feature_copy(text: JsValue, values: JsValue) -> Result<String, JsValue> {
    feature::format(text, values)
}
#[wasm_bindgen]
pub fn feature_text(
    feature: String,
    key: String,
    values: JsValue,
    lang: String,
) -> Result<String, JsValue> {
    feature::text(feature, key, values, lang)
}
