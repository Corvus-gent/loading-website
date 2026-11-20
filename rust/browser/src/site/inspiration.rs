use super::*;
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};
thread_local! {static STARTED:RefCell<bool>=const{RefCell::new(false)};}
fn image(art: &Value, decoding: bool) -> Result<web_sys::Element, JsValue> {
    let img = element("img", None, None)?;
    img.set_attribute("src", &text(art, "image").replace(".webp", "-margin.webp"))?;
    img.set_attribute("alt", "")?;
    img.set_attribute("loading", "lazy")?;
    if decoding {
        img.set_attribute("decoding", "async")?;
    }
    Ok(img)
}
pub(super) fn start() -> Result<(), JsValue> {
    if STARTED.replace(true) {
        return Ok(());
    }
    let doc = ui::doc()?;
    let w = window()?;
    let path = w.location().pathname()?;
    if doc
        .query_selector("[data-inspiration-off],meta[name=\"robots\"][content*=\"noindex\"]")?
        .is_some()
        || ["/admin", "/private", "/api", "/forms"]
            .iter()
            .any(|p| path == *p || path.starts_with(&format!("{p}/")))
    {
        return Ok(());
    }
    let css = element("link", None, None)?;
    css.set_attribute("rel", "stylesheet")?;
    css.set_attribute("href", "/css/inspiration.css?v=20261120")?;
    doc.query_selector("head")?
        .ok_or_else(|| JsValue::from_str("head"))?
        .append_child(&css)?;
    let arts: Vec<Value> =
        serde_json::from_str(include_str!("../../../migration/inspiration.json"))
            .map_err(|_| JsValue::from_str("inspiration data"))?;
    let main = doc.query_selector("main")?;
    let margin = arts
        .iter()
        .filter(|a| ["fallen", "diogenes"].contains(&text(a, "id")))
        .collect::<Vec<_>>();
    if margin.is_empty() {
        return Ok(());
    }
    let sum = path.encode_utf16().map(usize::from).sum::<usize>();
    let first = arts.first().ok_or_else(|| JsValue::from_str("art"))?;
    let second = margin
        .get(sum % margin.len())
        .ok_or_else(|| JsValue::from_str("art"))?;
    let mut rails = Vec::new();
    let body = doc.body().ok_or_else(|| JsValue::from_str("body"))?;
    for (i, art) in [first, *second].iter().enumerate() {
        let a = element(
            "a",
            None,
            Some(if i == 0 {
                "inspiration-rail left"
            } else {
                "inspiration-rail right"
            }),
        )?
        .dyn_into::<web_sys::HtmlElement>()?;
        a.set_attribute("href", &format!("{}/tattoo/#{}", host(), text(art, "id")))?;
        a.set_attribute(
            "aria-label",
            &format!("Explore inspiration: {}", text(art, "name")),
        )?;
        let img = image(art, true)?;
        let label = element("span", Some(text(art, "name")), None)?;
        a.append_child(&img)?;
        a.append_child(&label)?;
        a.set_hidden(true);
        body.append_child(&a)?;
        rails.push(a);
    }
    if let Some(main) = &main
        && !path.starts_with("/tattoo")
    {
        let a = element("a", None, Some("inspiration-mobile"))?;
        a.set_attribute("href", &format!("{}/tattoo/", host()))?;
        let img = image(second, false)?;
        let text_node = element("span", None, None)?;
        let title = element("strong", Some("the things that stay with me."), None)?;
        let sub = element(
            "small",
            Some(&format!(
                "{} · open my inspiration book",
                text(second, "name")
            )),
            None,
        )?;
        text_node.append_child(&title)?;
        text_node.append_child(&sub)?;
        a.append_child(&img)?;
        a.append_child(&text_node)?;
        if let Some(section) = main.query_selector(":scope > section")? {
            section.after_with_node_1(&a)?;
        } else {
            main.append_child(&a)?;
        }
    }
    let tick = Closure::<dyn FnMut()>::new(move || {
        let Ok(w) = window() else { return };
        let width = w.inner_width().ok().and_then(|n| n.as_f64()).unwrap_or(0.0);
        let rect = ui::doc()
            .ok()
            .and_then(|d| {
                d.query_selector("[data-art-boundary],main.site-page,main,.site-page")
                    .ok()
                    .flatten()
            })
            .map(|e| e.get_bounding_client_rect());
        for (i, a) in rails.iter().enumerate() {
            let space = rect
                .as_ref()
                .map(|r| if i == 0 { r.left() } else { width - r.right() })
                .unwrap_or(0.0);
            a.set_hidden(width < 1280.0 || space < 145.0);
            if !a.hidden() {
                let _ = a
                    .style()
                    .set_property("--art-width", &format!("{}px", 250.0_f64.min(space - 42.0)));
            }
        }
    });
    let function = tick.as_ref().unchecked_ref::<js_sys::Function>().clone();
    tick.forget();
    let frame = Rc::new(Cell::new(0));
    let schedule: Rc<dyn Fn()> = Rc::new(move || {
        if let Ok(w) = window() {
            let _ = w.cancel_animation_frame(frame.get());
            if let Ok(id) = w.request_animation_frame(&function) {
                frame.set(id);
            }
        }
    });
    schedule();
    {
        let schedule = schedule.clone();
        ui::listen(&w, "resize", move |_| schedule())?;
    }
    if let Some(main) = main {
        let callback =
            Closure::<dyn FnMut(js_sys::Array, web_sys::ResizeObserver)>::new(move |_, _| {
                schedule()
            });
        if let Ok(observer) = web_sys::ResizeObserver::new(callback.as_ref().unchecked_ref()) {
            observer.observe(&main);
            callback.forget();
            std::mem::forget(observer);
        }
    }
    Ok(())
}
