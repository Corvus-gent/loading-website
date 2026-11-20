//! Local translation of published copy; preserve original text and never retain removed DOM nodes.
use crate::{language, ui};
use serde_json::{Value, json};
use std::{cell::RefCell, collections::HashMap};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, future_to_promise, spawn_local};
use web_sys::{Element, MutationObserver, MutationRecord, Node};

const SKIPPED: &str = "script, style, code, pre, kbd, samp, svg, template, noscript, [contenteditable], [translate=\"no\"], #lang-switcher";
const ATTRIBUTES: &[&str] = &["alt", "aria-label", "title", "placeholder", "label"];
type ObserverCallback = Closure<dyn FnMut(js_sys::Array, MutationObserver)>;
thread_local! {
    static DICTIONARY: RefCell<Value> = const { RefCell::new(Value::Null) };
    static CATALOGS: RefCell<HashMap<String, js_sys::Promise>> = RefCell::new(HashMap::new());
    static TEXT: js_sys::WeakMap<Node, JsValue> = js_sys::WeakMap::new_typed();
    static ATTRS: js_sys::WeakMap<Element, JsValue> = js_sys::WeakMap::new_typed();
    static GENERATION: RefCell<u64> = const { RefCell::new(0) };
    static OBSERVER: RefCell<Option<(MutationObserver, ObserverCallback)>> = const { RefCell::new(None) };
    static STARTED: RefCell<bool> = const { RefCell::new(false) };
}
// ECMAScript \s, including BOM but excluding NEXT LINE.
fn space(c: char) -> bool {
    c == '\u{feff}' || (c.is_whitespace() && c != '\u{85}')
}
pub(crate) fn translate(text: &str) -> String {
    let key = text
        .split(space)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    DICTIONARY.with_borrow(|d| {
        d.get(&key)
            .and_then(Value::as_str)
            .unwrap_or(text)
            .to_owned()
    })
}
#[wasm_bindgen]
pub fn translate_page_text(text: JsValue) -> JsValue {
    text.as_string()
        .map(|s| JsValue::from_str(&translate(&s)))
        .unwrap_or(text)
}
#[wasm_bindgen]
pub fn format_page_text(text: String, values: JsValue) -> Result<String, JsValue> {
    let text = translate(&text);
    let re = regex::Regex::new(r"\{([A-Za-z0-9_]+)\}")
        .map_err(|_| JsValue::from_str("Invalid template"))?;
    Ok(re
        .replace_all(&text, |c: &regex::Captures| {
            let key = JsValue::from_str(&c[1]);
            if values.is_object()
                && js_sys::Object::has_own(values.unchecked_ref::<js_sys::Object>(), &key)
            {
                js_sys::Reflect::get(&values, &key)
                    .ok()
                    .map(|v| String::from(js_sys::JsString::from(v)))
                    .unwrap_or_else(|| c[0].into())
            } else {
                c[0].into()
            }
        })
        .into_owned())
}
fn stored(value: JsValue) -> Value {
    value
        .as_string()
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or(Value::Null)
}
fn translated(value: &str, previous: &Value) -> Value {
    let original = if previous["rendered"].as_str() == Some(value) {
        previous["original"].as_str().unwrap_or(value)
    } else {
        value
    };
    let translation = translate(original);
    let rendered = if translation == original {
        original.to_owned()
    } else {
        let before = original.len() - original.trim_start_matches(space).len();
        let after = original.trim_end_matches(space).len();
        format!("{}{translation}{}", &original[..before], &original[after..])
    };
    json!({"original": original, "rendered": rendered})
}
fn update_text(node: &Node) -> Result<(), JsValue> {
    let Some(parent) = node.parent_element() else {
        return Ok(());
    };
    if parent
        .closest(&format!("{SKIPPED}, [data-i18n], [data-wc], [data-army]"))?
        .is_some()
    {
        return Ok(());
    }
    if let Some(lang) = parent
        .closest("[lang]:not(html)")?
        .and_then(|e| e.get_attribute("lang"))
    {
        let lang = lang.to_lowercase();
        if !lang.is_empty() && lang != "en" && !lang.starts_with("en-") {
            return Ok(());
        }
    }
    let current = node.node_value().unwrap_or_default();
    let state = translated(&current, &TEXT.with(|m| stored(m.get(node))));
    if state["rendered"] != state["original"] {
        if let Some(option) = parent.closest("option:not([value])")? {
            // Freeze the form's submitted value before changing its visible label.
            let value = js_sys::Reflect::get(&option, &"value".into())?;
            js_sys::Reflect::set(&option, &"value".into(), &value)?;
        }
        TEXT.with(|m| m.set(node, &state.to_string().into()));
    } else {
        TEXT.with(|m| m.delete(node));
    }
    if state["rendered"].as_str() != Some(&current) {
        node.set_node_value(state["rendered"].as_str());
    }
    Ok(())
}
fn update_attributes(el: &Element) -> Result<(), JsValue> {
    if el.closest(SKIPPED)?.is_some() {
        return Ok(());
    }
    let names = if el.matches("meta[name=\"description\"]")? {
        &["content"][..]
    } else {
        ATTRIBUTES
    };
    let mut states = ATTRS
        .with(|m| stored(m.get(el)))
        .as_object()
        .cloned()
        .unwrap_or_default();
    for name in names {
        if (*name == "placeholder" && el.has_attribute("data-i18n-placeholder"))
            || (*name == "aria-label" && el.has_attribute("data-army-label"))
        {
            continue;
        }
        let Some(value) = el.get_attribute(name) else {
            states.remove(*name);
            continue;
        };
        let state = translated(&value, states.get(*name).unwrap_or(&Value::Null));
        let rendered = state["rendered"].as_str().unwrap_or(&value).to_owned();
        if state["rendered"] != state["original"] {
            states.insert((*name).into(), state);
        } else {
            states.remove(*name);
        }
        if value != rendered {
            el.set_attribute(name, &rendered)?;
        }
    }
    if states.is_empty() {
        ATTRS.with(|m| m.delete(el));
    } else {
        ATTRS.with(|m| m.set(el, &Value::Object(states).to_string().into()));
    }
    Ok(())
}
fn update_tree(root: &Node) -> Result<(), JsValue> {
    // Iterative traversal avoids call-stack growth on nested app content.
    let mut pending = vec![root.clone()];
    while let Some(node) = pending.pop() {
        if node.node_type() == Node::TEXT_NODE {
            update_text(&node)?;
            continue;
        }
        let Some(el) = node.dyn_ref::<Element>() else {
            continue;
        };
        if el.closest(SKIPPED)?.is_some() {
            continue;
        }
        update_attributes(el)?;
        let children = node.child_nodes();
        for i in (0..children.length()).rev() {
            if let Some(child) = children.item(i) {
                pending.push(child);
            }
        }
    }
    Ok(())
}
fn observe(root: &Element) -> Result<(), JsValue> {
    OBSERVER.with_borrow_mut(|state| {
        if state.is_none() {
            let callback = Closure::<dyn FnMut(js_sys::Array, MutationObserver)>::new(
                move |records: js_sys::Array, _| {
                    for raw in records {
                        let Ok(record) = raw.dyn_into::<MutationRecord>() else {
                            continue;
                        };
                        match record.type_().as_str() {
                            "characterData" => {
                                if let Some(node) = record.target() {
                                    let _ = update_text(&node);
                                }
                            }
                            "attributes" => {
                                if let Some(el) =
                                    record.target().and_then(|n| n.dyn_into::<Element>().ok())
                                {
                                    let _ = update_attributes(&el);
                                }
                            }
                            _ => {
                                let nodes = record.added_nodes();
                                for i in 0..nodes.length() {
                                    if let Some(node) = nodes.item(i) {
                                        let _ = update_tree(&node);
                                    }
                                }
                            }
                        }
                    }
                },
            );
            let observer = MutationObserver::new(callback.as_ref().unchecked_ref())?;
            *state = Some((observer, callback));
        }
        let options = web_sys::MutationObserverInit::new();
        options.set_subtree(true);
        options.set_child_list(true);
        options.set_character_data(true);
        options.set_attributes(true);
        let attributes: js_sys::Array = ATTRIBUTES
            .iter()
            .chain(std::iter::once(&"content"))
            .map(|s| JsValue::from_str(s))
            .collect();
        options.set_attribute_filter(&attributes);
        if let Some((observer, _)) = state {
            observer.observe_with_options(root, &options)?;
        }
        Ok(())
    })
}
async fn load(lang: &str) -> Result<Value, JsValue> {
    if lang == "en" || !["nl", "fr", "es", "pt", "de", "zh", "hi", "ta"].contains(&lang) {
        return Ok(json!({}));
    }
    let cached = CATALOGS.with_borrow(|m| m.get(lang).cloned());
    let promise = if let Some(promise) = cached {
        promise
    } else {
        let language = lang.to_owned();
        let promise = future_to_promise(async move {
            let config: Value =
                serde_json::from_str(include_str!("../../migration/page-copy-config.json"))
                    .map_err(|_| JsValue::from_str("Catalog configuration unavailable"))?;
            let url = format!(
                "/public/i18n/site.{language}.json?v={}",
                config["version"].as_str().unwrap_or_default()
            );
            match ui::json(&url, None, None, 8000).await {
                Ok((true, dictionary)) if dictionary.is_object() => {
                    Ok(dictionary.to_string().into())
                }
                _ => {
                    CATALOGS.with_borrow_mut(|m| m.remove(&language));
                    Ok("{}".into())
                }
            }
        });
        CATALOGS.with_borrow_mut(|m| m.insert(lang.to_owned(), promise.clone()));
        promise
    };
    Ok(stored(JsFuture::from(promise).await?))
}
#[wasm_bindgen]
pub async fn apply_page_copy(lang: String) -> Result<(), JsValue> {
    let generation = GENERATION.with_borrow_mut(|g| {
        *g = g.wrapping_add(1);
        *g
    });
    let selected = load(&lang).await?;
    if GENERATION.with_borrow(|g| *g != generation) {
        return Ok(());
    }
    DICTIONARY.with_borrow_mut(|d| *d = selected);
    OBSERVER.with_borrow(|s| {
        if let Some((observer, _)) = s {
            observer.disconnect();
        }
    });
    if let Some(root) = ui::doc()?.document_element() {
        update_tree(root.as_ref())?;
        if DICTIONARY.with_borrow(|d| d.as_object().is_some_and(|d| !d.is_empty())) {
            observe(&root)?;
        }
    }
    if let Some(window) = web_sys::window() {
        window.dispatch_event(&web_sys::Event::new("corvus-page-copy-ready")?)?;
    }
    Ok(())
}
pub(crate) fn start() -> Result<(), JsValue> {
    if STARTED.replace(true)
        || ui::doc()?
            .document_element()
            .is_some_and(|e| e.has_attribute("data-language-routes"))
    {
        return Ok(());
    }
    if let Some(window) = web_sys::window() {
        ui::listen(&window, "corvus-language-change", |event| {
            if let Some(lang) = event
                .dyn_ref::<web_sys::CustomEvent>()
                .and_then(|e| js_sys::Reflect::get(&e.detail(), &"lang".into()).ok())
                .and_then(|v| v.as_string())
            {
                spawn_local(async move {
                    let _ = apply_page_copy(lang).await;
                });
            }
        })?;
        if let Some(lang) = web_sys::Url::new(&window.location().href()?)?
            .search_params()
            .get("lang")
        {
            let codes = language::language_codes();
            if codes
                .iter()
                .any(|v| js_sys::Array::from(&v).get(0).as_string().as_deref() == Some(&lang))
            {
                language::save_language_preference(&lang);
            }
        }
    }
    let lang = language::get_language();
    spawn_local(async move {
        let _ = apply_page_copy(lang).await;
    });
    Ok(())
}
