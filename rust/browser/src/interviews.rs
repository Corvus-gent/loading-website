use crate::ui;
use serde_json::Value;
use std::{cell::Cell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::spawn_local;
use web_sys::{HtmlElement, HtmlImageElement};
fn text<'a>(row: &'a Value, key: &str) -> &'a str {
    row[key].as_str().unwrap_or("")
}
fn node(tag: &str, label: &str) -> Result<HtmlElement, JsValue> {
    let el = ui::doc()?.create_element(tag)?.dyn_into::<HtmlElement>()?;
    el.set_text_content(Some(label));
    Ok(el)
}
fn url(raw: &str) -> Result<url::Url, JsValue> {
    url::Url::parse(raw).map_err(|_| JsValue::from_str("Invalid interview URL"))
}
fn link(label: &str, href: &str, external: bool) -> Result<HtmlElement, JsValue> {
    let el = node("a", label)?;
    el.set_attribute("href", href)?;
    el.set_class_name("inline-link interview-social");
    if external {
        el.set_attribute("target", "_blank")?;
        el.set_attribute("rel", "noopener noreferrer")?;
    }
    Ok(el)
}
fn render(row: &Value) -> Result<Option<HtmlElement>, JsValue> {
    let (builder, project) = (text(row, "builder"), text(row, "project"));
    if builder.is_empty() || project.is_empty() {
        return Ok(None);
    }
    let n = row["n"].as_i64().filter(|n| *n != 0);
    let el = node("article", "")?;
    el.set_class_name("interview-tile");
    if let Some(n) = n {
        el.set_id(&format!("int-{n}"));
    }
    el.append_child(
        &node(
            "h3",
            if text(row, "title").is_empty() {
                project
            } else {
                text(row, "title")
            },
        )?
        .into(),
    )?;
    el.append_child(&node("p", &format!("{builder} · {project}"))?.into())?;
    if !text(row, "description").is_empty() {
        el.append_child(&node("p", text(row, "description"))?.into())?;
    }
    if !text(row, "photo_url").is_empty() {
        let u = url(text(row, "photo_url"))?;
        if u.scheme() == "https"
            && u.host_str()
                .is_some_and(|s| s.ends_with(".public.blob.vercel-storage.com"))
        {
            let img = HtmlImageElement::new()?;
            img.set_src(u.as_str());
            img.set_alt(&format!("{builder} with {project}"));
            img.set_attribute("loading", "lazy")?;
            img.set_width(480);
            img.set_height(320);
            img.style().set_css_text(
                "width:100%;height:auto;max-height:320px;object-fit:cover;border-radius:6px",
            );
            el.append_child(&img)?;
        }
    }
    for (key, base, label) in [
        ("x_handle", "https://x.com/", "X"),
        ("ig_handle", "https://www.instagram.com/", "Instagram"),
    ] {
        let handle = text(row, key);
        if !handle.is_empty()
            && handle.len() <= 30
            && handle
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'.'))
        {
            el.append_child(
                &link(
                    &format!("@{handle} · {label} ↗"),
                    &format!("{base}{handle}"),
                    true,
                )?
                .into(),
            )?;
        }
    }
    let clip = if n.is_some() {
        text(row, "clip_url")
    } else {
        text(row, "url")
    };
    if !clip.is_empty() {
        let Ok(u) = url(clip) else {
            return Ok(None);
        };
        if u.scheme() != "https" {
            return Ok(None);
        }
        el.append_child(&link("watch the interview ↗", u.as_str(), true)?.into())?;
    } else {
        el.append_child(&node("p", "clip coming soon. meet the builder now.")?.into())?;
    }
    if let Some(n) = n {
        el.append_child(
            &link(
                &format!("share interview #{n} ↗"),
                &format!("/hack/3?interview={n}#int-{n}"),
                false,
            )?
            .into(),
        )?;
    }
    Ok(Some(el))
}
fn refresh(pending: Rc<Cell<bool>>, jumped: Rc<Cell<bool>>) {
    if pending.get() || ui::doc().is_ok_and(|d| d.hidden()) {
        return;
    }
    pending.set(true);
    spawn_local(async move {
        let result = async {
            let (ok, data) = ui::json("/api/compound-v2?interviews=1", None, None, 6000).await?;
            if !ok {
                return Ok(());
            }
            let rows = data["interviews"]
                .as_array()
                .ok_or_else(|| JsValue::from_str("Invalid interviews"))?;
            let nodes = rows
                .iter()
                .map(render)
                .collect::<Result<Vec<_>, _>>()?
                .into_iter()
                .flatten()
                .collect::<Vec<_>>();
            let target = ui::element("interviews-grid")?;
            target.set_text_content(None);
            for el in &nodes {
                target.append_child(el)?;
            }
            ui::hidden("interviews-empty", !nodes.is_empty());
            if !jumped.get() {
                let w = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
                let hash = w.location().hash()?;
                let from_hash = hash
                    .strip_prefix("#int-")
                    .filter(|s| {
                        !s.starts_with('0')
                            && !s.is_empty()
                            && s.len() <= 4
                            && s.bytes().all(|b| b.is_ascii_digit())
                    })
                    .map(str::to_string);
                let n = from_hash.or_else(|| {
                    url(&w.location().href().ok()?)
                        .ok()?
                        .query_pairs()
                        .find(|(k, _)| k == "interview")
                        .map(|(_, v)| v.into_owned())
                });
                if let Some(n) = n {
                    let id = format!("int-{n}");
                    if ui::doc()?.get_element_by_id(&id).is_some() {
                        ui::scroll(&id, false, false);
                        jumped.set(true);
                    }
                }
            }
            Ok::<(), JsValue>(())
        }
        .await;
        let _ = result;
        pending.set(false);
    });
}
#[wasm_bindgen]
pub fn start_interviews() -> Result<(), JsValue> {
    let target = ui::element("interviews-grid")?;
    if target.has_attribute("data-rust-interviews") {
        return Ok(());
    }
    target.set_attribute("data-rust-interviews", "")?;
    let pending = Rc::new(Cell::new(false));
    let jumped = Rc::new(Cell::new(false));
    refresh(pending.clone(), jumped.clone());
    let (p, j) = (pending.clone(), jumped.clone());
    ui::listen(ui::doc()?.as_ref(), "visibilitychange", move |_| {
        refresh(p.clone(), j.clone())
    })?;
    let cb = Closure::<dyn FnMut()>::new(move || refresh(pending.clone(), jumped.clone()));
    web_sys::window()
        .ok_or_else(|| JsValue::from_str("No window"))?
        .set_interval_with_callback_and_timeout_and_arguments_0(
            cb.as_ref().unchecked_ref(),
            30000,
        )?;
    cb.forget();
    Ok(())
}
