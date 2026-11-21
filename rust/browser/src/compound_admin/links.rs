//! On-demand QR rendering and owner-controlled share drafts; no platform post is sent.
use super::*;
use corvus_core::{compound_share as share, videos};
use qrcodegen::{QrCode, QrCodeEcc, QrSegment, Version};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    CanvasRenderingContext2d, HtmlAnchorElement, HtmlCanvasElement, HtmlImageElement,
    IntersectionObserver, IntersectionObserverEntry,
};
pub(super) struct QrObserver {
    observer: IntersectionObserver,
    _callback: Closure<dyn FnMut(js_sys::Array, IntersectionObserver)>,
}
impl Drop for QrObserver {
    fn drop(&mut self) {
        self.observer.disconnect();
    }
}
fn error(s: &str) -> JsValue {
    JsValue::from_str(s)
}
fn day() -> Result<String, JsValue> {
    let intl = js_sys::Reflect::get(&js_sys::global(), &"Intl".into())?;
    let ctor =
        js_sys::Reflect::get(&intl, &"DateTimeFormat".into())?.dyn_into::<js_sys::Function>()?;
    let opts = js_sys::JSON::parse(r#"{"timeZone":"America/Los_Angeles"}"#)?;
    let args = js_sys::Array::of2(&"en-CA".into(), &opts);
    let formatter = js_sys::Reflect::construct(&ctor, &args)?;
    let format =
        js_sys::Reflect::get(&formatter, &"format".into())?.dyn_into::<js_sys::Function>()?;
    Ok(format
        .call1(&formatter, &js_sys::Date::new_0())?
        .as_string()
        .unwrap_or_default())
}
fn link_field(state: &State, label: &str, value: &str) -> Result<HtmlElement, JsValue> {
    let wrap = node("div", "", "")?;
    let l = node("label", label, "")?;
    let row = node("div", "", "link-field")?;
    let input = node("input", "", "")?.dyn_into::<HtmlInputElement>()?;
    input.set_read_only(true);
    input.set_value(value);
    input.set_attribute("aria-label", label)?;
    let b = button("copy", "")?;
    let (s, value) = (state.clone(), value.to_string());
    state
        .borrow_mut()
        .listeners
        .push(ui::scoped_listener(b.as_ref(), "click", move |_| {
            let (s, value) = (s.clone(), value.clone());
            spawn_local(async move {
                copy(&s, &value).await;
            });
        })?);
    append(&row, &input)?;
    append(&row, &b)?;
    append(&l, &row)?;
    append(&wrap, &l)?;
    Ok(wrap)
}
fn update_reply(
    state: &State,
    slug: &str,
    input: &HtmlInputElement,
    reply: &HtmlElement,
    status: &HtmlElement,
) -> Result<(), JsValue> {
    let value = input.value();
    let id = share::reply_id(&value);
    state
        .borrow_mut()
        .reply_targets
        .insert(slug.into(), value.clone());
    reply.set_attribute("aria-disabled", if id.is_none() { "true" } else { "false" })?;
    reply.set_tab_index(if id.is_none() { -1 } else { 0 });
    if let Some(id) = id {
        reply.set_attribute(
            "href",
            &share::draft(slug, "reply", &value)
                .map_err(error)?
                .unwrap_or_default(),
        )?;
        status.set_text_content(Some(&format!("Reply to post {id}.")));
        input.remove_attribute("aria-invalid")?;
    } else {
        reply.remove_attribute("href")?;
        let empty = value.trim().is_empty();
        status.set_text_content(Some(if empty {
            "Paste a post URL to open a reply draft."
        } else {
            "Use an X or Twitter post URL, including /status/…"
        }));
        input.set_attribute("aria-invalid", if empty { "false" } else { "true" })?;
    }
    Ok(())
}
fn drafts(state: &State, v: &Value) -> Result<HtmlElement, JsValue> {
    let slug = text(v, "slug");
    let wrap = node("section", "", "draft-tools")?;
    wrap.set_attribute("aria-label", &format!("{slug} share drafts"))?;
    let preview = node(
        "p",
        &share::share_copy(slug).map_err(error)?,
        "draft-preview",
    )?;
    preview.set_lang(text(v, "lang"));
    preview.set_dir(if ["ar", "fa"].contains(&text(v, "lang")) {
        "rtl"
    } else {
        "auto"
    });
    let row = node("div", "", "draft-actions")?;
    for (platform, label) in [
        ("x", "Post on X"),
        ("linkedin", "LinkedIn"),
        ("whatsapp", "WhatsApp"),
    ] {
        let a = external(
            label,
            &share::draft(slug, platform, "")
                .map_err(error)?
                .unwrap_or_default(),
            "button",
        )?;
        a.set_attribute("data-draft", platform)?;
        append(&row, &a)?;
    }
    let label = node("label", "reply to post URL", "")?;
    let input = node("input", "", "")?.dyn_into::<HtmlInputElement>()?;
    input.set_type("text");
    input.set_input_mode("url");
    input.set_max_length(2000);
    input.set_placeholder("https://x.com/name/status/…");
    input.set_autocomplete("off");
    input.set_value(
        state
            .borrow()
            .reply_targets
            .get(slug)
            .map(String::as_str)
            .unwrap_or(""),
    );
    input.set_attribute("aria-label", &format!("{slug} reply to post URL"))?;
    append(&label, &input)?;
    let reply = external("Reply on X", "", "button")?;
    reply.set_attribute("data-draft", "reply")?;
    let status = node("p", "", "small muted")?;
    status.set_id(&format!("reply-status-{slug}"));
    status.set_attribute("role", "status")?;
    input.set_attribute("aria-describedby", &status.id())?;
    update_reply(state, slug, &input, &reply, &status)?;
    let (s, slug, i, r, t) = (
        state.clone(),
        slug.to_string(),
        input.clone(),
        reply.clone(),
        status.clone(),
    );
    state
        .borrow_mut()
        .listeners
        .push(ui::scoped_listener(input.as_ref(), "input", move |_| {
            let _ = update_reply(&s, &slug, &i, &r, &t);
        })?);
    let reply_row = node("div", "", "reply-row")?;
    append(&reply_row, &label)?;
    append(&reply_row, &reply)?;
    for el in [preview, row, reply_row, status] {
        append(&wrap, &el)?;
    }
    Ok(wrap)
}
type Canvas = Rc<RefCell<Option<HtmlCanvasElement>>>;
fn make_qr(canvas: &Canvas, wrap: &HtmlElement, url: &str) -> Result<HtmlCanvasElement, JsValue> {
    if let Some(c) = canvas.borrow().clone() {
        return Ok(c);
    } // Same byte payload, M error correction and four-module quiet zone as the old encoder.
    let qr = QrCode::encode_segments_advanced(
        &[QrSegment::make_bytes(url.as_bytes())],
        QrCodeEcc::Medium,
        Version::MIN,
        Version::MAX,
        None,
        false,
    )
    .map_err(|_| error("QR link is too long."))?;
    let size = qr.size();
    let c = node("canvas", "", "")?.dyn_into::<HtmlCanvasElement>()?;
    c.set_width(((size + 8) * 8) as u32);
    c.set_height(((size + 8) * 8) as u32);
    let ctx = c
        .get_context("2d")?
        .ok_or(JsValue::NULL)?
        .dyn_into::<CanvasRenderingContext2d>()?;
    ctx.set_fill_style_str("#fff");
    ctx.fill_rect(0., 0., f64::from(c.width()), f64::from(c.height()));
    ctx.set_fill_style_str("#000");
    for y in 0..size {
        for x in 0..size {
            if qr.get_module(x, y) {
                ctx.fill_rect(f64::from((x + 4) * 8), f64::from((y + 4) * 8), 8., 8.);
            }
        }
    }
    let img = node("img", "", "")?.dyn_into::<HtmlImageElement>()?;
    img.set_src(&c.to_data_url_with_type("image/png")?);
    img.set_alt(&format!("QR code for {url}"));
    img.set_width(164);
    img.set_height(164);
    wrap.set_text_content(None);
    append(wrap, &img)?;
    *canvas.borrow_mut() = Some(c.clone());
    Ok(c)
}
fn download(c: &HtmlCanvasElement, slug: &str) -> Result<(), JsValue> {
    let a = node("a", "", "")?.dyn_into::<HtmlAnchorElement>()?;
    a.set_download(&format!("{slug}-qr.png"));
    a.set_href(&c.to_data_url_with_type("image/png")?);
    a.click();
    Ok(())
}
async fn clipboard_qr(c: &HtmlCanvasElement) -> Result<(), JsValue> {
    let canvas = c.clone();
    let promise = js_sys::Promise::new(&mut move |resolve, reject| {
        let r = reject.clone();
        let callback = Closure::once_into_js(move |v: JsValue| {
            if v.is_null() {
                let _ = reject.call1(&JsValue::UNDEFINED, &error("QR encoding failed."));
            } else {
                let _ = resolve.call1(&JsValue::UNDEFINED, &v);
            }
        });
        if let Err(e) = canvas.to_blob(callback.unchecked_ref()) {
            let _ = r.call1(&JsValue::UNDEFINED, &e);
        }
    });
    let blob = JsFuture::from(promise).await?;
    let object = js_sys::Object::new();
    js_sys::Reflect::set(&object, &"image/png".into(), &blob)?;
    let ctor = js_sys::Reflect::get(&js_sys::global(), &"ClipboardItem".into())?
        .dyn_into::<js_sys::Function>()?;
    let item = js_sys::Reflect::construct(&ctor, &js_sys::Array::of1(&object))?;
    let items = js_sys::Array::of1(&item);
    JsFuture::from(
        web_sys::window()
            .ok_or(JsValue::NULL)?
            .navigator()
            .clipboard()
            .write(&items),
    )
    .await?;
    Ok(())
}
pub(super) fn render(state: &State, data: &Value) -> Result<(), JsValue> {
    state.borrow_mut().observer = None;
    let root = clear("link-list")?;
    let cb = Closure::<dyn FnMut(js_sys::Array, IntersectionObserver)>::new(
        move |entries: js_sys::Array, observer: IntersectionObserver| {
            for e in entries.iter() {
                if let Ok(e) = e.dyn_into::<IntersectionObserverEntry>()
                    && e.is_intersecting()
                {
                    let target = e.target();
                    if let Ok(event) = web_sys::Event::new("makeqr") {
                        let _ = target.dispatch_event(&event);
                    }
                    observer.unobserve(&target);
                }
            }
        },
    );
    let observer = IntersectionObserver::new(cb.as_ref().unchecked_ref())?;
    let medium = ui::element("link-medium")?
        .dyn_into::<HtmlSelectElement>()?
        .value();
    let videos = rows(data, "videos");
    for v in &videos {
        let parsed =
            videos::parse_slug(text(v, "slug")).ok_or_else(|| error("Invalid video slug."))?;
        let slug = &parsed.slug;
        let url = share::code_url(&parsed);
        let card = node("article", "", "link-card")?;
        append(&card, &node("h2", slug, "")?)?;
        if truthy(&v["is_example"]) {
            append(
                &card,
                &node(
                    "span",
                    "example — replace with a real post before sharing",
                    "demo-tag",
                )?,
            )?;
        }
        let details = node("div", "", "link-details")?;
        let left = node("div", "", "")?;
        let wrap = node("div", "", "qr")?;
        let canvas: Canvas = Rc::default();
        let (c, w, u) = (canvas.clone(), wrap.clone(), url.clone());
        state.borrow_mut().listeners.push(ui::scoped_listener(
            wrap.as_ref(),
            "makeqr",
            move |_| {
                let _ = make_qr(&c, &w, &u);
            },
        )?);
        observer.observe(&wrap);
        let copy_qr = button("copy QR", "button")?;
        let dl = button("download QR", "button")?;
        let (c, w, u, slug_copy, s) = (
            canvas.clone(),
            wrap.clone(),
            url.clone(),
            slug.to_string(),
            state.clone(),
        );
        state.borrow_mut().listeners.push(ui::scoped_listener(
            copy_qr.as_ref(),
            "click",
            move |_| {
                let result = make_qr(&c, &w, &u);
                let (s, slug) = (s.clone(), slug_copy.clone());
                spawn_local(async move {
                    match result {
                        Ok(c) => {
                            if clipboard_qr(&c).await.is_ok() {
                                toast(&s, "QR copied ✓");
                            } else if download(&c, &slug).is_ok() {
                                toast(&s, "QR downloaded.");
                            } else {
                                toast(&s, "QR download failed. Try again.");
                            }
                        }
                        Err(e) => toast(&s, &ui::message(&e)),
                    }
                });
            },
        )?);
        let (c, w, u, slug) = (canvas, wrap.clone(), url.clone(), slug.to_string());
        state
            .borrow_mut()
            .listeners
            .push(ui::scoped_listener(dl.as_ref(), "click", move |_| {
                if let Ok(c) = make_qr(&c, &w, &u) {
                    let _ = download(&c, &slug);
                }
            })?);
        append(&left, &wrap)?;
        append(&left, &copy_qr)?;
        append(&left, &dl)?;
        let right = node("div", "", "")?;
        for (label, value) in [
            ("short link", url),
            ("pinned comment", share::pinned(&parsed)),
            ("full UTM link", share::full(&parsed, &medium)),
            (
                "share text",
                format!(
                    "{} {}",
                    share::share_copy(&parsed.slug).map_err(error)?,
                    share::tracked(&parsed.slug, "x", "post").map_err(error)?
                ),
            ),
        ] {
            append(&right, &link_field(state, label, &value)?)?;
        }
        append(&details, &left)?;
        append(&details, &right)?;
        append(&card, &drafts(state, v)?)?;
        append(&card, &details)?;
        append(&root, &card)?;
    }
    state.borrow_mut().observer = Some(QrObserver {
        observer,
        _callback: cb,
    });
    let count = videos.iter().filter(|v| !truthy(&v["is_example"])).count();
    ui::element("copy-all-drafts")?
        .dyn_into::<HtmlButtonElement>()?
        .set_disabled(count == 0);
    ui::text(
        "draft-count",
        &format!(
            "{count} video drafts · all registered non-example videos, dated today in San Francisco."
        ),
    );
    Ok(())
}
pub(super) fn start(state: &State) -> Result<(), JsValue> {
    let select = clear("link-medium")?.dyn_into::<HtmlSelectElement>()?;
    for v in config()["mediums"].as_array().cloned().unwrap_or_default() {
        let t = v.as_str().unwrap_or("");
        let o = node("option", t, "")?;
        o.set_attribute("value", t)?;
        append(&select, &o)?;
    }
    select.set_value("post");
    let s = state.clone();
    ui::listen(select.as_ref(), "change", move |_| {
        let data = s.borrow().data.clone();
        if let Some(data) = data {
            s.borrow_mut().listeners.clear();
            if let Err(e) = render(&s, &data) {
                message(&ui::message(&e));
            }
        }
    })?;
    let s = state.clone();
    ui::listen(
        ui::element("copy-all-drafts")?.as_ref(),
        "click",
        move |_| {
            let data = s.borrow().data.clone();
            if let Some(data) = data {
                let s = s.clone();
                spawn_local(async move {
                    match day() {
                        Ok(day) => copy(&s, &share::today(&rows(&data, "videos"), &day)).await,
                        Err(e) => message(&ui::message(&e)),
                    }
                });
            }
        },
    )?;
    Ok(())
}
