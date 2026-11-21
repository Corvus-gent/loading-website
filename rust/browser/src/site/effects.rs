use super::*;
use std::cell::RefCell;
thread_local! {static STARTED:RefCell<bool>=const{RefCell::new(false)};static WARNING:RefCell<i32>=const{RefCell::new(0)};}
pub(super) fn storage(until: String) -> Result<(), JsValue> {
    cancel(WARNING.replace(0));
    let Ok(note) = ui::element("storage-warning") else {
        return Ok(());
    };
    let valid = until.len() == 10
        && until.bytes().enumerate().all(|(i, c)| {
            if i == 4 || i == 7 {
                c == b'-'
            } else {
                c.is_ascii_digit()
            }
        });
    let remaining = if valid {
        js_sys::Date::parse(&format!("{until}T00:00:00.000Z")) - js_sys::Date::now()
    } else {
        0.0
    };
    note.set_hidden(remaining <= 0.0 || remaining.is_nan());
    note.set_text_content(Some(&if note.hidden() {
        String::new()
    } else {
        format!("storage link not encrypted until {until}")
    }));
    if !note.hidden() {
        WARNING.replace(later(remaining.min(86400000.0) as i32, move || {
            let _ = storage(until);
        })?);
    }
    Ok(())
}
pub(super) fn start() -> Result<(), JsValue> {
    if STARTED.replace(true) {
        return Ok(());
    }
    let cb = Closure::<dyn FnMut(js_sys::Array)>::new(|entries: js_sys::Array| {
        for e in entries
            .iter()
            .filter_map(|e| e.dyn_into::<web_sys::IntersectionObserverEntry>().ok())
        {
            let _ = e
                .target()
                .class_list()
                .toggle_with_force("motion-paused", !e.is_intersecting());
        }
    });
    let opts = web_sys::IntersectionObserverInit::new();
    opts.set_root_margin("80px");
    let observer =
        web_sys::IntersectionObserver::new_with_options(cb.as_ref().unchecked_ref(), &opts)?;
    for e in nodes(".vinyl,.np,.hero,.flock-pidgy,.visitor-map-shell") {
        observer.observe(&e);
    }
    cb.forget();
    let update = || {
        if let Ok(d) = ui::doc()
            && let Some(el) = d.document_element()
        {
            let _ = el.class_list().toggle_with_force("tab-hidden", d.hidden());
        }
    };
    ui::listen(&ui::doc()?.into(), "visibilitychange", move |_| update())?;
    update();
    Ok(())
}

pub(super) fn philosophy() -> Result<(), JsValue> {
    crate::language::start_language_bar()?;
    let select = ui::element("reading-theme")?.dyn_into::<web_sys::HtmlSelectElement>()?;
    let doc = ui::doc()?
        .document_element()
        .ok_or_else(|| JsValue::from_str("html"))?;
    if let Ok(Some(store)) = window()?.local_storage()
        && let Ok(Some(theme)) = store.get_item("corvus.philosophy.theme")
        && ["system", "light", "dark"].contains(&theme.as_str())
    {
        doc.set_attribute("data-theme", &theme)?;
        select.set_value(&theme);
    }
    let input = select.clone();
    ui::listen(&select.into(), "change", move |_| {
        let theme = input.value();
        let _ = doc.set_attribute("data-theme", &theme);
        if let Ok(w) = window()
            && let Ok(Some(store)) = w.local_storage()
        {
            let _ = store.set_item("corvus.philosophy.theme", &theme);
        }
    })?;
    Ok(())
}
