use super::*;
use std::{cell::RefCell, rc::Rc};
use web_sys::{
    HtmlButtonElement, HtmlDialogElement, HtmlElement, HtmlFormElement, HtmlInputElement,
};
thread_local! {static STARTED:RefCell<bool>=const{RefCell::new(false)};static TRACKED:RefCell<bool>=const{RefCell::new(false)};}
struct Search {
    dialog: HtmlDialogElement,
    input: HtmlInputElement,
    list: web_sys::Element,
    routes: Vec<Value>,
    refreshed: f64,
    epoch: u32,
}
fn results(s: &Search) -> Result<(), JsValue> {
    let query = s.input.value().trim().to_lowercase();
    s.list.set_text_content(None);
    for r in &s.routes {
        let hay = format!(
            "{} {} {}",
            text(r, "title"),
            text(r, "description"),
            text(r, "path")
        )
        .to_lowercase();
        if r["public"] == false || (!query.is_empty() && !hay.contains(&query)) {
            continue;
        }
        let li = element("li", None, None)?;
        let a = element("a", Some(text(r, "title")), None)?;
        let path = text(r, "path");
        a.set_attribute(
            "href",
            &if path.starts_with('/') {
                format!("{}{path}", host())
            } else {
                path.to_owned()
            },
        )?;
        let small = element("small", Some(text(r, "section")), None)?;
        a.append_child(&small)?;
        li.append_child(&a)?;
        s.list.append_child(&li)?;
    }
    Ok(())
}
fn open(state: Rc<RefCell<Search>>) -> Result<(), JsValue> {
    let mut s = state.borrow_mut();
    if s.dialog.open() {
        return Ok(());
    }
    s.dialog.show_modal()?;
    s.input.set_value("");
    results(&s)?;
    s.input.focus()?;
    if js_sys::Date::now() - s.refreshed > 60000.0 {
        s.refreshed = js_sys::Date::now();
        s.epoch += 1;
        let epoch = s.epoch;
        let routes = s.routes.clone();
        drop(s);
        wasm_bindgen_futures::spawn_local(async move {
            let rows = discovery::fresh(routes, true).await;
            let mut s = state.borrow_mut();
            if s.epoch == epoch {
                s.routes = rows;
                if s.dialog.open() {
                    let _ = results(&s);
                }
            }
        });
    }
    Ok(())
}
fn key(e: &web_sys::Event) -> String {
    js_sys::Reflect::get(e, &"key".into())
        .ok()
        .and_then(|v| v.as_string())
        .unwrap_or_default()
}
fn flag(e: &web_sys::Event, name: &str) -> bool {
    js_sys::Reflect::get(e, &name.into())
        .ok()
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}
fn input(form: &HtmlFormElement, name: &str) -> Option<HtmlInputElement> {
    form.query_selector(&format!("[name=\"{name}\"]"))
        .ok()
        .flatten()?
        .dyn_into()
        .ok()
}
fn newsletter() -> Result<(), JsValue> {
    for form in nodes("[data-newsletter]") {
        let Ok(form) = form.dyn_into::<HtmlFormElement>() else {
            continue;
        };
        let form2 = form.clone();
        let busy = Rc::new(RefCell::new(false));
        ui::listen(&form, "submit", move |e| {
            e.prevent_default();
            if *busy.borrow() || !form2.report_validity() {
                return;
            }
            let form = form2.clone();
            let busy = busy.clone();
            *busy.borrow_mut() = true;
            wasm_bindgen_futures::spawn_local(async move {
                let button = form
                    .query_selector("button[type=submit]")
                    .ok()
                    .flatten()
                    .and_then(|b| b.dyn_into::<HtmlButtonElement>().ok());
                let status = form.query_selector("[role=status]").ok().flatten();
                if let Some(b) = &button {
                    b.set_disabled(true);
                }
                if let Some(s) = &status {
                    s.set_text_content(Some("sending the signal…"));
                }
                let body = json!({"action":"subscribe","email":input(&form,"email").map(|v|v.value()).unwrap_or_default(),"consent":input(&form,"consent").is_some_and(|v|v.checked()),"website":input(&form,"website").map(|v|v.value()).unwrap_or_default()});
                let result = ui::json("/api/legion", Some(body), None, 15000).await;
                let message = match result {
                    Ok((true, v)) => {
                        form.reset();
                        text(&v, "message").to_owned()
                    }
                    Ok((false, v)) => v["error"]
                        .as_str()
                        .unwrap_or("Please retry shortly.")
                        .to_owned(),
                    Err(e) => {
                        let m = ui::message(&e);
                        if m.is_empty() {
                            "Please retry shortly.".into()
                        } else {
                            m
                        }
                    }
                };
                if let Some(s) = status {
                    s.set_text_content(Some(&message));
                }
                if let Some(b) = button {
                    b.set_disabled(false);
                }
                *busy.borrow_mut() = false;
            });
        })?;
    }
    Ok(())
}
fn cardneto() -> Result<(), JsValue> {
    for button in nodes("[data-cardneto-egg]") {
        ui::listen(&button, "click", move |_| {
            let mut found = preference("corvus-secrets")
                .as_array()
                .cloned()
                .unwrap_or_default();
            if !found.iter().any(|v| v == "cardneto") {
                found.push(json!("cardneto"));
                save_preference("corvus-secrets", &Value::Array(found));
            }
            let _ = event("corvus-secret-found", &json!({"id":"cardneto"}));
            let show = || -> Result<(), JsValue> {
                let doc = ui::doc()?;
                let card = match doc.get_element_by_id("cardneto-card") {
                    Some(e) => e.dyn_into::<HtmlDialogElement>()?,
                    None => {
                        let card = element("dialog", None, Some("cardneto-dialog"))?
                            .dyn_into::<HtmlDialogElement>()?;
                        card.set_id("cardneto-card");
                        card.set_inner_html(include_str!("../../site-cardneto.html").trim_end());
                        doc.body()
                            .ok_or_else(|| JsValue::from_str("body"))?
                            .append_child(&card)?;
                        if let Some(b) = card.query_selector("button")? {
                            let c = card.clone();
                            ui::listen(&b, "click", move |_| c.close())?;
                        }
                        let c = card.clone();
                        ui::listen(&card, "click", move |e| {
                            if e.target().as_ref() == Some(c.as_ref()) {
                                c.close();
                            }
                        })?;
                        card
                    }
                };
                if !card.open() {
                    card.show_modal()?;
                }
                Ok(())
            };
            let _ = show();
            wasm_bindgen_futures::spawn_local(async {
                let opt = web_sys::RequestInit::new();
                opt.set_credentials(web_sys::RequestCredentials::SameOrigin);
                opt.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(5000)));
                if let Ok(req) = web_sys::Request::new_with_str_and_init("/go/cardneto-egg", &opt)
                    && let Ok(w) = window()
                {
                    let _ = JsFuture::from(w.fetch_with_request(&req)).await;
                }
            });
        })?;
    }
    Ok(())
}
pub(super) fn start() -> Result<(), JsValue> {
    if STARTED.replace(true) {
        return Ok(());
    }
    crate::language::start_language_bar()?;
    inspiration::start()?;
    compound_links()?;
    discovery::start()?;
    let doc = ui::doc()?;
    let dialog = element("dialog", None, Some("site-search"))?.dyn_into::<HtmlDialogElement>()?;
    dialog.set_attribute("aria-label", "Jump to a page")?;
    dialog.set_inner_html(include_str!("../../site-search.html").trim_end());
    doc.body()
        .ok_or_else(|| JsValue::from_str("body"))?
        .append_child(&dialog)?;
    let input = dialog
        .query_selector("input")?
        .ok_or_else(|| JsValue::from_str("input"))?
        .dyn_into::<HtmlInputElement>()?;
    let list = dialog
        .query_selector("ul")?
        .ok_or_else(|| JsValue::from_str("results"))?;
    let state = Rc::new(RefCell::new(Search {
        dialog: dialog.clone(),
        input: input.clone(),
        list,
        routes: Vec::new(),
        refreshed: 0.0,
        epoch: 0,
    }));
    {
        let state = state.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let rows = discovery::load().await;
            let mut s = state.borrow_mut();
            s.routes = rows;
            if s.dialog.open() {
                let _ = results(&s);
            }
        });
    }
    {
        let state = state.clone();
        let w = window()?;
        ui::listen(&w, "corvus-directory-ready", move |e| {
            if let Some(e) = e.dyn_ref::<web_sys::CustomEvent>() {
                let rows = value(&e.detail());
                let mut s = state.borrow_mut();
                s.routes = rows.as_array().cloned().unwrap_or_default();
                if s.dialog.open() {
                    let _ = results(&s);
                }
            }
        })?;
    }
    for button in nodes("[data-site-search]") {
        let s = state.clone();
        ui::listen(&button, "click", move |_| {
            let _ = open(s.clone());
        })?;
    }
    {
        let s = state.clone();
        ui::listen(&input, "input", move |_| {
            let _ = results(&s.borrow());
        })?;
    }
    if let Some(button) = dialog.query_selector("button")? {
        let d = dialog.clone();
        ui::listen(&button, "click", move |_| d.close())?;
    }
    {
        let d = dialog.clone();
        ui::listen(&dialog, "click", move |e| {
            if e.target().as_ref() == Some(d.as_ref()) {
                d.close();
            }
        })?;
    }
    {
        let state = state.clone();
        ui::listen(&input, "keydown", move |e| {
            let key = key(&e);
            if ["Enter", "ArrowDown"].contains(&key.as_str()) {
                e.prevent_default();
                if let Ok(Some(a)) = state.borrow().list.query_selector("a") {
                    if key == "ArrowDown" {
                        if let Some(a) = a.dyn_ref::<HtmlElement>() {
                            let _ = a.focus();
                        }
                    } else if let Some(href) = a.get_attribute("href")
                        && let Ok(w) = window()
                    {
                        let _ = w.location().assign(&href);
                    }
                }
            }
        })?;
    }
    let callback = Closure::<dyn FnMut(web_sys::Event)>::new(move |e| {
        if key(&e) != "/"
            || ["ctrlKey", "metaKey", "altKey"].iter().any(|k| flag(&e, k))
            || e.target()
                .and_then(|n| n.dyn_into::<web_sys::Element>().ok())
                .is_some_and(|e| {
                    e.closest("input,textarea,select,[contenteditable=true]")
                        .ok()
                        .flatten()
                        .is_some()
                })
            || !nodes("dialog[open]").is_empty()
        {
            return;
        }
        e.prevent_default();
        e.stop_immediate_propagation();
        let _ = open(state.clone());
    });
    doc.add_event_listener_with_callback_and_bool(
        "keydown",
        callback.as_ref().unchecked_ref(),
        true,
    )?;
    callback.forget();
    let host = host();
    if !host.is_empty() {
        for a in nodes("[data-site-shell] a") {
            if let Some(h) = a.get_attribute("href").filter(|h| h.starts_with('/')) {
                a.set_attribute("href", &format!("{host}{h}"))?;
            }
        }
    }
    cardneto()?;
    newsletter()
}
fn placement() -> String {
    let path = window()
        .ok()
        .and_then(|w| w.location().pathname().ok())
        .unwrap_or_default();
    if path.starts_with("/compound/impact") {
        "impact".into()
    } else if path.starts_with("/compound/v2") {
        "v2".into()
    } else if path.starts_with("/hack/3") {
        "hack3".into()
    } else {
        let p = path
            .split('/')
            .filter(|s| !s.is_empty())
            .take(2)
            .collect::<Vec<_>>()
            .join("-");
        if p.is_empty() { "home".into() } else { p }
    }
}
fn patch(root: &web_sys::Element) -> Result<(), JsValue> {
    let mut links = Vec::new();
    if root.matches("a[href]")? {
        links.push(root.clone());
    }
    let list = root.query_selector_all("a[href]")?;
    for i in 0..list.length() {
        if let Some(a) = list
            .item(i)
            .and_then(|v| v.dyn_into::<web_sys::Element>().ok())
        {
            links.push(a);
        }
    }
    for a in links {
        let Some(anchor) = a.dyn_ref::<web_sys::HtmlAnchorElement>() else {
            continue;
        };
        let p = if a.closest("footer")?.is_some() {
            "footer".into()
        } else {
            placement()
        };
        if let Some(url) =
            corvus_core::site::compound_url(&anchor.href(), &p, "https://corvus.gent")
        {
            a.set_attribute("href", &url)?;
        }
    }
    Ok(())
}
pub(super) fn compound_links() -> Result<(), JsValue> {
    if TRACKED.replace(true) {
        return Ok(());
    }
    let p = window()?.location().pathname()?;
    if !["/compound", "/support/companies"]
        .iter()
        .any(|root| p == *root || p.starts_with(&format!("{root}/")))
    {
        return Ok(());
    }
    let body = ui::doc()?.body().ok_or_else(|| JsValue::from_str("body"))?;
    patch(body.as_ref())?;
    let callback = Closure::<dyn FnMut(js_sys::Array, web_sys::MutationObserver)>::new(
        |records: js_sys::Array, _| {
            for v in records {
                if let Ok(r) = v.dyn_into::<web_sys::MutationRecord>() {
                    if r.type_() == "attributes" {
                        if let Some(e) = r
                            .target()
                            .and_then(|n| n.dyn_into::<web_sys::Element>().ok())
                        {
                            let _ = patch(&e);
                        }
                    } else {
                        let nodes = r.added_nodes();
                        for i in 0..nodes.length() {
                            if let Some(e) = nodes
                                .item(i)
                                .and_then(|n| n.dyn_into::<web_sys::Element>().ok())
                            {
                                let _ = patch(&e);
                            }
                        }
                    }
                }
            }
        },
    );
    let observer = web_sys::MutationObserver::new(callback.as_ref().unchecked_ref())?;
    let options = web_sys::MutationObserverInit::new();
    options.set_subtree(true);
    options.set_child_list(true);
    options.set_attributes(true);
    let attrs = js_sys::Array::of1(&"href".into());
    options.set_attribute_filter(&attrs);
    observer.observe_with_options(&body, &options)?;
    callback.forget();
    std::mem::forget(observer);
    Ok(())
}
