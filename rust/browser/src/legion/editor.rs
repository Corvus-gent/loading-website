use super::*;
use std::{cell::RefCell, rc::Rc};
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, HtmlImageElement};
#[derive(Default)]
struct Editor {
    profile: Option<Value>,
    busy: bool,
}
type State = Rc<RefCell<Editor>>;
fn draft(s: &State) -> Result<Value, JsValue> {
    let f = form("spotlight-form")?;
    let state = s.borrow();
    let p = state.profile.as_ref().ok_or(JsValue::NULL)?;
    let mut links = Vec::new();
    for i in 0..4 {
        let label = get(&f, &format!("label{i}"))?.trim().to_string();
        let url = get(&f, &format!("url{i}"))?.trim().to_string();
        if !label.is_empty() || !url.is_empty() {
            links.push(json!({"label":label,"url":url}));
        }
    }
    Ok(
        json!({"headline":get(&f,"headline")?,"bio":get(&f,"bio")?,"photo":p["content"]["photo"],"links":links,"highlight":{"title":get(&f,"highlight_title")?,"text":get(&f,"highlight_text")?,"image":p["content"]["highlight"]["image"].as_str().unwrap_or("")},"cta":{"label":get(&f,"cta_label")?,"url":get(&f,"cta_url")?}}),
    )
}
fn show(s: &State) -> Result<(), JsValue> {
    let p = s.borrow().profile.clone();
    if let Some(mut p) = p {
        p["content"] = draft(s)?;
        senate::render(&p, &ui::element("spotlight-preview")?, true)?;
    }
    Ok(())
}
fn busy(s: &State, on: bool) -> Result<(), JsValue> {
    let mut state = s.borrow_mut();
    state.busy = on;
    let locked = state.profile.as_ref().is_none_or(|p| p["locked"] == true);
    disabled(
        &query(form("spotlight-form")?.as_ref(), "fieldset")?,
        on || locked,
    );
    Ok(())
}
fn fill(s: &State, p: Value) -> Result<(), JsValue> {
    let f = form("spotlight-form")?;
    let c = &p["content"];
    for (k, path) in [
        ("headline", &c["headline"]),
        ("bio", &c["bio"]),
        ("highlight_title", &c["highlight"]["title"]),
        ("highlight_text", &c["highlight"]["text"]),
        ("cta_label", &c["cta"]["label"]),
        ("cta_url", &c["cta"]["url"]),
    ] {
        set(&f, k, path.as_str().unwrap_or(""))?;
    }
    for i in 0..4 {
        set(&f, &format!("label{i}"), text(&c["links"][i], "label"))?;
        set(&f, &format!("url{i}"), text(&c["links"][i], "url"))?;
    }
    s.borrow_mut().profile = Some(p);
    show(s)
}
async fn photo(file: &web_sys::File) -> Result<String, JsValue> {
    if file.size() > 5. * 1024. * 1024.
        || !["image/jpeg", "image/png", "image/webp"].contains(&file.type_().as_str())
    {
        return Err(JsValue::from_str("Use a JPG, PNG or WebP up to 5 MB."));
    }
    let url = web_sys::Url::create_object_url_with_blob(file)?;
    let r = async {
        let img = HtmlImageElement::new()?;
        img.set_src(&url);
        JsFuture::from(img.decode()).await?;
        let scale = (1600. / f64::from(img.natural_width().max(img.natural_height()))).min(1.);
        let canvas = ui::doc()?
            .create_element("canvas")?
            .dyn_into::<HtmlCanvasElement>()?;
        canvas.set_width((f64::from(img.natural_width()) * scale).round() as u32);
        canvas.set_height((f64::from(img.natural_height()) * scale).round() as u32);
        let ctx = canvas
            .get_context("2d")?
            .ok_or(JsValue::NULL)?
            .dyn_into::<CanvasRenderingContext2d>()?;
        ctx.draw_image_with_html_image_element_and_dw_and_dh(
            &img,
            0.,
            0.,
            canvas.width().into(),
            canvas.height().into(),
        )?;
        let url = canvas.to_data_url_with_type_and_encoder_options("image/jpeg", &0.9.into())?;
        let data = url
            .split_once(',')
            .map(|(_, s)| s)
            .ok_or_else(|| JsValue::from_str("This photo could not be read."))?;
        if data.len() > 3800000 {
            return Err(JsValue::from_str(
                "This photo is too large to upload. Try a smaller one.",
            ));
        }
        Ok(data.to_string())
    }
    .await;
    let _ = web_sys::Url::revoke_object_url(&url);
    r
}
#[wasm_bindgen]
pub fn start_senate_editor() -> Result<(), JsValue> {
    let f = form("spotlight-form")?;
    if f.has_attribute("data-rust-editor") {
        return Ok(());
    }
    f.set_attribute("data-rust-editor", "")?;
    let token = last_path()?;
    let s = State::default();
    let state = s.clone();
    let t = token.clone();
    spawn_local(async move {
        let r = async {
            let p = api(Some(json!({"action":"load","token":t})), "", true).await?;
            ui::text(
                "edit-status",
                if p["locked"] == true {
                    "Gabe has locked editing."
                } else {
                    "Only your spotlight changes. Preview it below, then publish."
                },
            );
            ui::element("public-spotlight")?
                .set_attribute("href", &format!("/legion/senate/{}", text(&p, "slug")))?;
            fill(&state, p)?;
            ui::hidden("spotlight-form", false);
            busy(&state, false)
        }
        .await;
        if let Err(e) = r {
            ui::text("edit-status", &ui::message(&e));
            ui::hidden("spotlight-form", true);
        }
    });
    let state = s.clone();
    ui::listen(f.as_ref(), "input", move |_| {
        report(show(&state));
    })?;
    let state = s.clone();
    let token2 = token.clone();
    let form = f.clone();
    ui::listen(f.as_ref(), "submit", move |e| {
        e.prevent_default();
        if state.borrow().busy || !form.report_validity() {
            return;
        }
        let Some(p) = state.borrow().profile.clone() else {
            return;
        };
        if p["locked"] == true {
            return;
        }
        let body = match draft(&state) {
            Ok(c) => {
                json!({"action":"publish","token":token2,"revision":p["revision"],"content":c})
            }
            Err(e) => {
                ui::text("edit-status", &ui::message(&e));
                return;
            }
        };
        if let Err(e) = busy(&state, true) {
            ui::text("edit-status", &ui::message(&e));
            return;
        }
        let state = state.clone();
        spawn_local(async move {
            let r = async {
                let p = api(Some(body), "", true).await?;
                fill(&state, p)?;
                ui::text("edit-status", "Published ✓ Your spotlight is live.");
                Ok::<(), JsValue>(())
            }
            .await;
            if let Err(e) = r {
                ui::text("edit-status", &ui::message(&e));
            }
            report(busy(&state, false));
        });
    })?;
    for name in ["photo", "highlight_image"] {
        let input = field(&f, name)?.dyn_into::<HtmlInputElement>()?;
        let el = input.clone();
        let state = s.clone();
        let token = token.clone();
        ui::listen(input.as_ref(), "change", move |_| {
            let Some(file) = el.files().and_then(|f| f.get(0)) else {
                return;
            };
            if state.borrow().busy
                || state
                    .borrow()
                    .profile
                    .as_ref()
                    .is_none_or(|p| p["locked"] == true)
            {
                el.set_value("");
                return;
            }
            report(busy(&state, true));
            let el = el.clone();
            let state = state.clone();
            let token = token.clone();
            spawn_local(async move {
                let r=async{ui::text("edit-status","Preparing photo…");let data=photo(&file).await?;let d=api(Some(json!({"action":"upload","token":token,"data":data,"original_size":file.size()})),"",true).await?;
                if let Some(p)=state.borrow_mut().profile.as_mut(){if name=="photo"{p["content"]["photo"]=d["url"].clone();}else{p["content"]["highlight"]["image"]=d["url"].clone();}}
                show(&state)?;ui::text("edit-status","Photo ready. Publish to show it publicly.");Ok::<(),JsValue>(())
            }.await;
                if let Err(e) = r {
                    ui::text("edit-status", &ui::message(&e));
                }
                el.set_value("");
                report(busy(&state, false));
            });
        })?;
    }
    Ok(())
}
