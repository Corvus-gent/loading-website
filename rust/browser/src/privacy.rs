//! Same privacy notice and translations, with browser preferences controlled by Rust.
use crate::{arrival, consent, language, ui};
use serde_json::Value;
use std::{cell::RefCell, sync::LazyLock};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{HtmlElement, MutationObserver, MutationObserverInit, ResizeObserver};
static DATA: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../migration/privacy-config.json")).unwrap_or(Value::Null)
});
pub fn data() -> &'static Value {
    &DATA
}
struct Notice {
    element: HtmlElement,
    timer: i32,
    mutation: MutationObserver,
    resize: ResizeObserver,
    listeners: Vec<ui::Listener>,
}
thread_local! {static NOTICE:RefCell<Option<Notice>>=const{RefCell::new(None)};static STARTED:RefCell<bool>=const{RefCell::new(false)};}
fn lang() -> String {
    let w = web_sys::window();
    let query = w
        .as_ref()
        .and_then(|w| w.location().href().ok())
        .and_then(|s| url::Url::parse(&s).ok())
        .and_then(|u| {
            u.query_pairs()
                .find(|(k, _)| k == "lang")
                .map(|(_, v)| v.into_owned())
        });
    let html = ui::doc()
        .ok()
        .and_then(|d| d.document_element())
        .and_then(|e| e.get_attribute("lang"));
    let browser = w
        .and_then(|w| w.navigator().language())
        .map(|s| s.chars().take(2).collect());
    [query, language::preference(), html, browser]
        .into_iter()
        .flatten()
        .find(|code| data()["strings"].get(code).is_some())
        .unwrap_or_else(|| "en".into())
}

fn measure() {
    let _ = (|| -> Result<(), JsValue> {
        if let Some(html) = ui::doc()?
            .document_element()
            .and_then(|e| e.dyn_into::<HtmlElement>().ok())
        {
            let height = NOTICE.with_borrow(|n| {
                n.as_ref()
                    .map(|n| {
                        if n.element.hidden() {
                            0.0
                        } else {
                            n.element.get_bounding_client_rect().height() + 20.0
                        }
                    })
                    .unwrap_or(0.0)
            });
            html.style()
                .set_property("--privacy-notice-space", &format!("{height}px"))?;
        }
        Ok(())
    })();
}
fn open(open: bool) {
    if let Ok(doc) = ui::doc()
        && let Some(html) = doc.document_element()
    {
        let _ = html
            .class_list()
            .toggle_with_force("privacy-notice-open", open);
    }
}
fn sync() {
    if let Ok(doc) = ui::doc() {
        let playing = doc
            .body()
            .is_some_and(|b| b.get_attribute("data-game-playing").as_deref() == Some("true"));
        NOTICE.with_borrow(|n| {
            if let Some(n) = n {
                n.element.set_hidden(playing);
            }
        });
        measure();
        open(!playing);
    }
}
fn close() {
    if let Some(notice) = NOTICE.with_borrow_mut(Option::take) {
        if let Some(w) = web_sys::window() {
            w.clear_timeout_with_handle(notice.timer);
        }
        notice.mutation.disconnect();
        notice.resize.disconnect();
        notice.element.remove();
        drop(notice.listeners);
    }
    open(false);
    if let Ok(doc) = ui::doc()
        && let Some(html) = doc
            .document_element()
            .and_then(|e| e.dyn_into::<HtmlElement>().ok())
    {
        let _ = html.style().remove_property("--privacy-notice-space");
    }
}
fn labels() -> Result<(), JsValue> {
    let doc = ui::doc()?;
    let lang = lang();
    let copy = &data()["strings"][&lang];
    let href = if lang == "en" {
        "/privacy/".into()
    } else {
        format!("/privacy/?lang={lang}")
    };
    for (selector, key) in [
        ("[data-privacy-link]", "label"),
        ("[data-spotify-notice]", "spotify"),
    ] {
        let nodes = doc.query_selector_all(selector)?;
        for i in 0..nodes.length() {
            if let Some(node) = nodes
                .item(i)
                .and_then(|n| n.dyn_into::<web_sys::Element>().ok())
            {
                node.set_text_content(copy[key].as_str());
                if key == "label" {
                    node.set_attribute("href", &href)?;
                }
            }
        }
    }
    NOTICE.with_borrow(|n| -> Result<(), JsValue> {
        if let Some(n) = n {
            n.element
                .set_attribute("aria-label", copy["label"].as_str().unwrap_or("privacy"))?;
            let stream = doc
                .document_element()
                .is_some_and(|e| e.get_attribute("data-twitch-loaded").as_deref() == Some("true"));
            for (selector, text) in [
                (
                    ".privacy-copy",
                    if stream {
                        data()["streamNotice"][&lang].as_str()
                    } else {
                        copy["notice"].as_str()
                    },
                ),
                ("[data-allow]", copy["allow"].as_str()),
                ("[data-deny]", copy["deny"].as_str()),
            ] {
                if let Some(el) = n.element.query_selector(selector)? {
                    el.set_text_content(text);
                }
            }
            if let Some(a) = n.element.query_selector("a")? {
                a.set_text_content(Some(&format!(
                    "{} →",
                    copy["label"].as_str().unwrap_or("privacy")
                )));
                a.set_attribute("href", &href)?;
            }
        }
        Ok(())
    })
}
#[wasm_bindgen]
pub fn start_privacy() -> Result<(), JsValue> {
    if STARTED.with_borrow(|s| *s) {
        return Ok(());
    }
    STARTED.with_borrow_mut(|s| *s = true);
    consent::start_consent()?;
    let doc = ui::doc()?;
    let w = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
    let path = w.location().pathname()?;
    let private = ["/private", "/stats/private", "/music/admin"]
        .iter()
        .any(|p| path == *p || path.starts_with(&format!("{p}/")));
    if private
        || (!arrival::sidequests_page() && !consent::analytics_allowed())
        || doc
            .query_selector("script[src^='/js/analytics.js']")?
            .is_none()
    {
        arrival::clear_tracking_url();
    }
    if !consent::notice_dismissed() && !private && path != "/402" && !path.starts_with("/402/") {
        let element = doc.create_element("aside")?.dyn_into::<HtmlElement>()?;
        element.set_id("privacy-notice");
        element.set_class_name("privacy-notice");
        element.set_hidden(true);
        // Fixed, local markup. No visitor input is ever inserted as HTML.
        element.set_inner_html(include_str!("../privacy-notice.html"));
        if let Some(body) = doc.body() {
            body.append_child(&element)?;
        }
        let changed = Closure::<dyn FnMut(js_sys::Array, MutationObserver)>::new(|_, _| sync());
        let mutation = MutationObserver::new(changed.as_ref().unchecked_ref())?;
        changed.forget();
        let measured = Closure::<dyn FnMut(js_sys::Array, ResizeObserver)>::new(|_, _| measure());
        let resize = ResizeObserver::new(measured.as_ref().unchecked_ref())?;
        resize.observe(&element);
        measured.forget();
        let show = Closure::<dyn FnMut()>::new(|| {
            sync();
            if let Some(w) = web_sys::window() {
                let frame = Closure::<dyn FnMut(f64)>::new(|_| {
                    NOTICE.with_borrow(|n| {
                        if let Some(n) = n {
                            let _ = n.element.class_list().add_1("is-visible");
                        }
                    })
                });
                let _ = w.request_animation_frame(frame.as_ref().unchecked_ref());
                frame.forget();
            }
            NOTICE.with_borrow(|n| {
                if let Some(n) = n
                    && let Ok(doc) = ui::doc()
                    && let Some(body) = doc.body()
                {
                    let opts = MutationObserverInit::new();
                    opts.set_attributes(true);
                    opts.set_attribute_filter(&js_sys::Array::of1(&JsValue::from_str(
                        "data-game-playing",
                    )));
                    let _ = n.mutation.observe_with_options(&body, &opts);
                }
            });
        });
        let timer = w.set_timeout_with_callback_and_timeout_and_arguments_0(
            show.as_ref().unchecked_ref(),
            1500,
        )?;
        show.forget();
        let mut listeners = Vec::new();
        for (selector, choice) in [("[data-allow]", "allow"), ("[data-deny]", "deny")] {
            if let Some(button) = element.query_selector(selector)? {
                listeners.push(ui::scoped_listener(button.as_ref(), "click", move |_| {
                    consent::choose_analytics(choice)
                })?);
            }
        }
        NOTICE.with_borrow_mut(|n| {
            *n = Some(Notice {
                element,
                timer,
                mutation,
                resize,
                listeners,
            })
        });
        ui::listen(w.as_ref(), "analytics-consent-change", |_| {
            if consent::notice_dismissed() {
                close();
            }
        })?;
    }
    labels()?;
    let changed = Closure::<dyn FnMut(js_sys::Array, MutationObserver)>::new(|_, _| {
        let _ = labels();
    });
    let observer = MutationObserver::new(changed.as_ref().unchecked_ref())?;
    if let Some(html) = doc.document_element() {
        let opts = MutationObserverInit::new();
        opts.set_attributes(true);
        opts.set_attribute_filter(&js_sys::Array::of1(&JsValue::from_str("lang")));
        observer.observe_with_options(&html, &opts)?;
    }
    changed.forget();
    // The observer and its callback live for this document, matching the old page module.
    std::mem::forget(observer);
    ui::listen(w.as_ref(), "twitch-status-change", |_| {
        let _ = labels();
    })?;
    Ok(())
}
