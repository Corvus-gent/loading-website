use serde_json::Value;
use std::{cell::RefCell, collections::HashSet};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{Document, HtmlElement};
struct Banner {
    element: HtmlElement,
    promo: Option<HtmlElement>,
    live: bool,
    session: String,
    dismissed: HashSet<String>,
    pending: bool,
    manual: bool,
    manual_session: String,
    observer: Option<web_sys::ResizeObserver>,
}
thread_local! {static STATE:RefCell<Option<Banner>>=const{RefCell::new(None)};}
fn document() -> Option<Document> {
    web_sys::window()?.document()
}
fn storage() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
}
fn stored(key: &str) -> bool {
    storage()
        .and_then(|s| s.get_item(key).ok().flatten())
        .as_deref()
        == Some("1")
}
fn key(b: &Banner) -> String {
    let locales = js_sys::Array::of1(&JsValue::from_str("en-CA"));
    let options = js_sys::Object::new();
    let _ = js_sys::Reflect::set(
        &options,
        &JsValue::from_str("timeZone"),
        &JsValue::from_str("America/Los_Angeles"),
    );
    let day = js_sys::Intl::DateTimeFormat::new(&locales, &options)
        .format()
        .call1(&JsValue::UNDEFINED, &js_sys::Date::new_0())
        .ok()
        .and_then(|s| s.as_string())
        .unwrap_or_default();
    format!("corvus.live.dismissed:{day}:{}", b.session)
}
fn size(b: &Banner) {
    if let Some(html) = document()
        .and_then(|d| d.document_element())
        .and_then(|e| e.dyn_into::<HtmlElement>().ok())
    {
        let height = if b.element.hidden() {
            "0px".into()
        } else {
            format!("{}px", b.element.get_bounding_client_rect().height())
        };
        let _ = html.style().set_property("--site-live-height", &height);
    }
}
fn render() {
    STATE.with_borrow(|state| {
        if let Some(b) = state {
            let key = key(b);
            b.element
                .set_hidden(!b.live || b.dismissed.contains(&key) || stored(&key));
            if let Some(promo) = &b.promo {
                promo.set_hidden(b.live || stored("plethora.home.dismissed"));
            }
            if let Some(html) = document().and_then(|d| d.document_element()) {
                let _ = html
                    .class_list()
                    .toggle_with_force("site-live-visible", !b.element.hidden());
            }
            size(b);
        }
    });
}
async fn fetch_status() -> Result<(bool, String), JsValue> {
    let window = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
    let options = web_sys::RequestInit::new();
    options.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(10_000)));
    let request = web_sys::Request::new_with_str_and_init("/api/live", &options)?;
    let response = JsFuture::from(window.fetch_with_request(&request))
        .await?
        .dyn_into::<web_sys::Response>()?;
    if !response.ok() {
        return Err(JsValue::from_str("Status unavailable"));
    }
    let data = JsFuture::from(response.json()?).await?;
    let live = js_sys::Reflect::get(&data, &JsValue::from_str("live"))?
        .as_bool()
        .ok_or_else(|| JsValue::from_str("Invalid status"))?;
    let session = js_sys::Reflect::get(&data, &JsValue::from_str("session"))?
        .as_string()
        .ok_or_else(|| JsValue::from_str("Invalid status"))?;
    Ok((live, session))
}
fn refresh() {
    if document().is_none_or(|d| d.hidden()) {
        return;
    }
    let start = STATE.with_borrow_mut(|state| {
        if let Some(b) = state
            && !b.pending
        {
            b.pending = true;
            true
        } else {
            false
        }
    });
    if !start {
        return;
    }
    spawn_local(async {
        let result = fetch_status().await;
        STATE.with_borrow_mut(|state| {
            if let Some(b) = state {
                let (live, session) =
                    result.unwrap_or_else(|_| (b.manual, b.manual_session.clone()));
                b.live = live;
                b.session = session;
                b.pending = false;
            }
        });
        render();
    });
}
fn dismiss() {
    STATE.with_borrow_mut(|state| {
        if let Some(b) = state {
            let key = key(b);
            b.dismissed.insert(key.clone());
            if let Some(store) = storage() {
                for i in (0..store.length().unwrap_or(0)).rev() {
                    if let Ok(Some(old)) = store.key(i)
                        && old.starts_with("corvus.live.dismissed:")
                        && old != key
                    {
                        let _ = store.remove_item(&old);
                    }
                }
                let _ = store.set_item(&key, "1");
            }
        }
    });
    render();
}
fn listen(
    target: &web_sys::EventTarget,
    event: &str,
    callback: Closure<dyn FnMut(web_sys::Event)>,
) -> Result<(), JsValue> {
    target.add_event_listener_with_callback(event, callback.as_ref().unchecked_ref())?;
    callback.forget();
    Ok(())
}
#[wasm_bindgen]
pub fn start_live_banner() -> Result<(), JsValue> {
    let Some(doc) = document() else { return Ok(()) };
    if doc.query_selector("[data-live-banner]")?.is_some() {
        return Ok(());
    }
    let config: Value = serde_json::from_str(include_str!("../../migration/live-config.json"))
        .map_err(|_| JsValue::from_str("Invalid live configuration"))?;
    let sheet = doc.create_element("link")?;
    sheet.set_attribute("rel", "stylesheet")?;
    sheet.set_attribute("href", "/css/live-banner.css?v=20261108live1")?;
    if let Some(head) = doc.query_selector("head")? {
        head.append_child(&sheet)?;
    }
    let element = doc.create_element("aside")?.dyn_into::<HtmlElement>()?;
    element.set_class_name("plethora-banner site-live-banner");
    element.set_attribute("data-live-banner", "")?;
    element.set_attribute("data-rust-live", "")?;
    element.set_hidden(true);
    element.set_attribute("aria-label", "live stream")?;
    // Constant, historical markup only; never insert upstream or user content as HTML.
    element.set_inner_html(include_str!("../live-banner.html"));
    if let Some(body) = doc.body() {
        body.prepend_with_node_1(&element)?;
    }
    let promo = doc
        .query_selector("[data-plethora-banner]")?
        .and_then(|e| e.dyn_into::<HtmlElement>().ok());
    let manual = config["live"] == true;
    let manual_session = format!("manual-{}", config["stream"].as_str().unwrap_or(""));
    STATE.with_borrow_mut(|s| {
        *s = Some(Banner {
            element: element.clone(),
            promo,
            live: manual,
            session: manual_session.clone(),
            dismissed: HashSet::new(),
            pending: false,
            manual,
            manual_session,
            observer: None,
        })
    });
    if let Some(button) = element.query_selector("button")? {
        listen(button.as_ref(), "click", Closure::new(|_| dismiss()))?;
    }
    let callback = Closure::<dyn FnMut()>::new(|| {
        STATE.with_borrow(|s| {
            if let Some(b) = s {
                size(b)
            }
        })
    });
    let observer = web_sys::ResizeObserver::new(callback.as_ref().unchecked_ref())?;
    observer.observe(&element);
    callback.forget();
    STATE.with_borrow_mut(|s| {
        if let Some(b) = s {
            b.observer = Some(observer)
        }
    });
    if let Some(window) = web_sys::window() {
        let path = window.location().pathname()?;
        if (path == "/hack/play" || path.starts_with("/hack/play/"))
            && let Some(html) = doc.document_element()
        {
            html.class_list().add_1("site-live-game")?;
        }
        let timer = Closure::<dyn FnMut()>::new(refresh);
        window.set_interval_with_callback_and_timeout_and_arguments_0(
            timer.as_ref().unchecked_ref(),
            60_000,
        )?;
        timer.forget();
        listen(window.as_ref(), "storage", Closure::new(|_| render()))?;
    }
    listen(
        doc.as_ref(),
        "visibilitychange",
        Closure::new(|_| refresh()),
    )?;
    render();
    refresh();
    Ok(())
}
