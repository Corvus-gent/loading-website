use serde_json::{Value, json};
use std::cell::RefCell;
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{Document, Element, HtmlDocument, HtmlElement, MouseEvent, Url};
thread_local! {
 static STRINGS:RefCell<Value>=const{RefCell::new(Value::Null)};
 static CALLBACKS:RefCell<Vec<js_sys::Function>>=const{RefCell::new(Vec::new())};
}
fn document() -> Option<Document> {
    web_sys::window()?.document()
}
fn languages() -> Vec<(&'static str, &'static str)> {
    let path = web_sys::window()
        .and_then(|w| w.location().pathname().ok())
        .unwrap_or_default();
    let curiosity = [
        "/curiositycraft",
        "/worldcraft",
        "/curiosity",
        "/quests",
        "/hack/4",
    ]
    .iter()
    .any(|p| path == *p || path.starts_with(&format!("{p}/")))
        || path == "/hack"
        || path == "/hack/";
    if curiosity {
        vec![
            ("en", "EN"),
            ("es", "ES"),
            ("zh", "中文"),
            ("fr", "FR"),
            ("pt", "PT"),
            ("nl", "NL"),
            ("hi", "हिन्दी"),
            ("ta", "தமிழ்"),
        ]
    } else {
        vec![
            ("en", "EN"),
            ("nl", "NL"),
            ("es", "ES"),
            ("fr", "FR"),
            ("pt", "PT"),
            ("de", "DE"),
            ("zh", "中文"),
        ]
    }
}
#[wasm_bindgen]
pub fn language_codes() -> js_sys::Array {
    languages()
        .iter()
        .map(|(code, label)| {
            let pair = js_sys::Array::new();
            pair.push(&JsValue::from_str(code));
            pair.push(&JsValue::from_str(label));
            JsValue::from(pair)
        })
        .collect()
}
fn storage() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
}
fn save_preference(code: &str) {
    if let Some(s) = storage() {
        let _ = s.set_item(
            "lang",
            &json!({"value":code,"expires":js_sys::Date::now()+31_536_000_000.0}).to_string(),
        );
    }
}
fn preference() -> Option<String> {
    if let Some(cookie) = document()
        .and_then(|d| d.dyn_into::<HtmlDocument>().ok())
        .and_then(|d| d.cookie().ok())
        && let Some(value) = cookie
            .split(';')
            .find_map(|p| p.trim().strip_prefix("corvus_lang="))
    {
        return Some(value.into());
    }
    let store = storage()?;
    let raw = store.get_item("lang").ok()??;
    let parsed = serde_json::from_str::<Value>(&raw).unwrap_or_else(|_| json!(raw));
    if parsed.is_object() && parsed.get("expires").is_some() {
        if !parsed["expires"]
            .as_f64()
            .is_some_and(|n| n.is_finite() && n > js_sys::Date::now())
        {
            let _ = store.remove_item("lang");
            return None;
        }
        return parsed["value"].as_str().map(str::to_owned);
    }
    let code = parsed.as_str()?;
    save_preference(code);
    Some(code.into())
}
#[wasm_bindgen]
pub fn get_language() -> String {
    let valid = |value: &str| languages().iter().any(|(code, _)| *code == value);
    if let Some(window) = web_sys::window() {
        if let Ok(href) = window.location().href()
            && let Ok(url) = Url::new(&href)
            && let Some(lang) = url.search_params().get("lang")
            && valid(&lang)
        {
            return lang;
        }
        if let Some(lang) = preference()
            && valid(&lang)
        {
            return lang;
        }
        if let Some(lang) = window.navigator().language() {
            let code = lang.chars().take(2).collect::<String>().to_lowercase();
            if valid(&code) {
                return code;
            }
        }
    }
    "en".into()
}
fn translation(key: &str) -> Option<String> {
    let code = get_language();
    STRINGS.with_borrow(|all| {
        all[&code][key]
            .as_str()
            .or_else(|| all["en"][key].as_str())
            .map(str::to_owned)
    })
}
#[wasm_bindgen]
pub fn translate(key: &str) -> String {
    translation(key).unwrap_or_else(|| key.into())
}
#[wasm_bindgen]
pub fn pick_language(value: JsValue, code: Option<String>) -> JsValue {
    if !value.is_null() && value.is_object() {
        let code = code.unwrap_or_else(get_language);
        let chosen =
            js_sys::Reflect::get(&value, &JsValue::from_str(&code)).unwrap_or(JsValue::UNDEFINED);
        if !chosen.is_null() && !chosen.is_undefined() {
            return chosen;
        }
        return js_sys::Reflect::get(&value, &JsValue::from_str("en"))
            .unwrap_or(JsValue::UNDEFINED);
    }
    value
}
fn each(doc: &Document, selector: &str, mut apply: impl FnMut(Element)) -> Result<(), JsValue> {
    let list = doc.query_selector_all(selector)?;
    for i in 0..list.length() {
        if let Some(e) = list.item(i).and_then(|n| n.dyn_into::<Element>().ok()) {
            apply(e);
        }
    }
    Ok(())
}
#[wasm_bindgen]
pub fn apply_language(code: Option<String>) -> Result<(), JsValue> {
    let Some(doc) = document() else {
        return Ok(());
    };
    let code = code.unwrap_or_else(get_language);
    if let Some(html) = doc.document_element() {
        html.set_attribute("lang", &code)?;
    }
    each(&doc, "a[href^=\"https://stats.corvus.gent\"]", |a| {
        if let Some(href) = a.get_attribute("href")
            && let Ok(url) = Url::new(&href)
        {
            url.search_params().set("lang", &code);
            let _ = a.set_attribute("href", &url.href());
        }
    })?;
    each(&doc, "#corner-nav a", |a| {
        let key = if a.text_content().as_deref() == Some("⌂") {
            "nav.home"
        } else {
            "nav.back"
        };
        let text = translate(key);
        let _ = a.set_attribute("title", &text);
        let _ = a.set_attribute("aria-label", &text);
    })?;
    if let Some(search) = doc.query_selector(".search-btn")? {
        search.set_attribute("aria-label", &translate("nav.search"))?;
    }
    each(&doc, "[data-i18n]", |e| {
        if let Some(key) = e.get_attribute("data-i18n")
            && let Some(value) = translation(&key)
        {
            e.set_text_content(Some(&value));
        }
    })?;
    each(&doc, "[data-i18n-placeholder]", |e| {
        if let Some(key) = e.get_attribute("data-i18n-placeholder")
            && let Some(value) = translation(&key)
        {
            let _ = e.set_attribute("placeholder", &value);
        }
    })?;
    Ok(())
}
fn change(code: &str) -> Result<(), JsValue> {
    let Some(window) = web_sys::window() else {
        return Ok(());
    };
    save_preference(code);
    if let Some(doc) = document().and_then(|d| d.dyn_into::<HtmlDocument>().ok()) {
        let host = window.location().hostname()?;
        let domain = if host == "corvus.gent" || host.ends_with(".corvus.gent") {
            "; Domain=corvus.gent"
        } else {
            ""
        };
        let _ = doc.set_cookie(&format!(
            "corvus_lang={code}; Max-Age=31536000; Path=/; SameSite=Lax; Secure{domain}"
        ));
    }
    let url = Url::new(&window.location().href()?)?;
    url.search_params().set("lang", code);
    window
        .history()?
        .replace_state_with_url(&JsValue::NULL, "", Some(&url.href()))?;
    apply_language(Some(code.into()))?;
    render_language_switcher(None)?;
    if let Some(doc) = document()
        && let Some(active) = doc
            .query_selector("#lang-switcher [aria-current]")?
            .and_then(|e| e.dyn_into::<HtmlElement>().ok())
    {
        let opts = web_sys::FocusOptions::new();
        opts.set_prevent_scroll(true);
        active.focus_with_options(&opts)?;
    }
    let detail = js_sys::Object::new();
    js_sys::Reflect::set(
        &detail,
        &JsValue::from_str("lang"),
        &JsValue::from_str(code),
    )?;
    let init = web_sys::CustomEventInit::new();
    init.set_detail(&detail);
    let event = web_sys::CustomEvent::new_with_event_init_dict("corvus-language-change", &init)?;
    window.dispatch_event(event.as_ref())?;
    let callbacks = CALLBACKS.with_borrow(Clone::clone);
    for callback in callbacks {
        let _ = callback.call1(&JsValue::UNDEFINED, &JsValue::from_str(code));
    }
    Ok(())
}
#[wasm_bindgen]
pub fn render_language_switcher(callback: Option<js_sys::Function>) -> Result<(), JsValue> {
    if let Some(callback) = callback {
        CALLBACKS.with_borrow_mut(|c| {
            if !c.contains(&callback) {
                c.push(callback);
            }
        });
    }
    let Some(doc) = document() else {
        return Ok(());
    };
    let Some(container) = doc.get_element_by_id("lang-switcher") else {
        return Ok(());
    };
    if !container.has_attribute("data-rust-languages") {
        let listener = Closure::<dyn FnMut(web_sys::Event)>::new(move |event: web_sys::Event| {
            if event
                .dyn_ref::<MouseEvent>()
                .is_some_and(|e| e.ctrl_key() || e.meta_key() || e.alt_key() || e.shift_key())
            {
                return;
            }
            let Some(anchor) = event
                .target()
                .and_then(|t| t.dyn_into::<Element>().ok())
                .and_then(|e| e.closest("a[hreflang]").ok().flatten())
            else {
                return;
            };
            if let Some(code) = anchor.get_attribute("hreflang")
                && languages().iter().any(|(c, _)| *c == code)
            {
                event.prevent_default();
                let _ = change(&code);
            }
        });
        container.add_event_listener_with_callback("click", listener.as_ref().unchecked_ref())?;
        listener.forget();
        container.set_attribute("data-rust-languages", "")?;
    }
    container.set_text_content(None);
    let current = get_language();
    let Some(window) = web_sys::window() else {
        return Ok(());
    };
    for (code, label) in languages() {
        let a = doc.create_element("a")?;
        let url = Url::new(&window.location().href()?)?;
        url.search_params().set("lang", code);
        a.set_attribute("href", &url.href())?;
        a.set_attribute("hreflang", code)?;
        a.set_text_content(Some(label));
        if code == current {
            a.set_class_name("active");
            a.set_attribute("aria-current", "true")?;
        }
        container.append_child(&a)?;
    }
    let stats = doc.create_element("a")?;
    stats.set_attribute(
        "href",
        if window.location().hostname()? == "stats.corvus.gent" {
            "https://corvus.gent/languages/"
        } else {
            "/languages/"
        },
    )?;
    stats.set_class_name("stats");
    stats.set_text_content(Some(&format!("· {}", translate("lang.title"))));
    container.append_child(&stats)?;
    Ok(())
}
#[wasm_bindgen]
pub fn start_languages() -> Result<(), JsValue> {
    let all: Value = serde_json::from_str(include_str!("../locales.json"))
        .map_err(|_| JsValue::from_str("Invalid translation data"))?;
    STRINGS.with_borrow_mut(|s| *s = all);
    Ok(())
}
#[wasm_bindgen]
pub fn start_language_bar() -> Result<(), JsValue> {
    let Some(doc) = document() else {
        return Ok(());
    };
    let bar = match doc.get_element_by_id("lang-switcher") {
        Some(e) => e,
        None => doc.create_element("nav")?,
    };
    bar.set_id("lang-switcher");
    bar.class_list().add_1("lang-switcher")?;
    bar.set_attribute("data-site-languages", "")?;
    bar.set_attribute("aria-label", "Language")?;
    if let Some(body) = doc.body() {
        body.prepend_with_node_1(&bar)?;
    }
    apply_language(None)?;
    render_language_switcher(None)
}
