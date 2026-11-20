//! Existing quick-add markup and copy, with state and image preparation owned by Rust/WASM.
use crate::ui;
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{
    CanvasRenderingContext2d, HtmlButtonElement, HtmlCanvasElement, HtmlElement, HtmlFormElement,
    HtmlImageElement, HtmlInputElement, HtmlTextAreaElement,
};
const FIELDS: [&str; 6] = [
    "builder",
    "project",
    "description",
    "x_handle",
    "ig_handle",
    "clip_url",
];
#[derive(Default)]
struct Admin {
    editing: Option<Value>,
    published: Option<i64>,
    request_id: String,
    busy: bool,
    load_generation: u64,
    listeners: Vec<ui::Listener>,
}
type State = Rc<RefCell<Admin>>;
fn text<'a>(row: &'a Value, k: &str) -> &'a str {
    row[k].as_str().unwrap_or("")
}
fn form() -> Result<HtmlFormElement, JsValue> {
    ui::element("editor")?.dyn_into().map_err(Into::into)
}
fn input(name: &str) -> Result<HtmlInputElement, JsValue> {
    form()?
        .query_selector(&format!("[name={name}]"))?
        .ok_or_else(|| JsValue::from_str("Missing field"))?
        .dyn_into()
        .map_err(Into::into)
}
fn field(name: &str) -> Result<web_sys::Element, JsValue> {
    form()?
        .query_selector(&format!("[name={name}]"))?
        .ok_or_else(|| JsValue::from_str("Missing field"))
}
fn value(name: &str) -> Result<String, JsValue> {
    let e = field(name)?;
    if let Some(e) = e.dyn_ref::<HtmlTextAreaElement>() {
        Ok(e.value())
    } else {
        Ok(e.dyn_into::<HtmlInputElement>()?.value())
    }
}
fn set_value(name: &str, value: &str) -> Result<(), JsValue> {
    let e = field(name)?;
    if let Some(e) = e.dyn_ref::<HtmlTextAreaElement>() {
        e.set_value(value);
    } else {
        e.dyn_into::<HtmlInputElement>()?.set_value(value);
    }
    Ok(())
}
fn node(tag: &str, value: &str) -> Result<HtmlElement, JsValue> {
    let e = ui::doc()?.create_element(tag)?.dyn_into::<HtmlElement>()?;
    e.set_text_content(Some(value));
    Ok(e)
}
fn disabled(id: &str, value: bool) {
    if let Ok(e) =
        ui::element(id).and_then(|e| e.dyn_into::<HtmlButtonElement>().map_err(Into::into))
    {
        e.set_disabled(value);
    }
}
fn uuid() -> Result<String, JsValue> {
    Ok(web_sys::window()
        .ok_or_else(|| JsValue::from_str("No window"))?
        .crypto()?
        .random_uuid())
}
async fn api(body: Option<Value>, query: &str) -> Result<Value, JsValue> {
    let (ok, data) = ui::json(&format!("/api/compound-v2{query}"), body, None, 30000).await?;
    if !ok {
        return Err(JsValue::from_str(
            data["error"]
                .as_str()
                .unwrap_or("Connection lost. Your form is kept; please retry."),
        ));
    }
    Ok(data)
}
fn reset(state: &State) -> Result<(), JsValue> {
    let id = uuid()?;
    {
        let mut s = state.borrow_mut();
        s.editing = None;
        s.published = None;
        s.request_id = id;
    }
    form()?.reset();
    ui::text("editor-title", "Quick-add interview.");
    ui::text("save-status", "");
    for id in ["photo-preview", "remove-photo-wrap", "success"] {
        ui::hidden(id, true);
    }
    ui::hidden("editor", false);
    Ok(())
}
fn edit(state: &State, row: &Value) -> Result<(), JsValue> {
    reset(state)?;
    state.borrow_mut().editing = Some(row.clone());
    for key in FIELDS {
        set_value(key, text(row, key))?;
    }
    input("consent")?.set_checked(row["consent"] == true);
    ui::text("editor-title", &format!("Edit interview #{}", row["n"]));
    if !text(row, "photo_url").is_empty() {
        ui::element("photo-preview")?.set_attribute("src", text(row, "photo_url"))?;
        ui::hidden("photo-preview", false);
        ui::hidden("remove-photo-wrap", false);
    }
    ui::scroll("editor", false, false);
    Ok(())
}
fn success(state: &State, row: &Value) -> Result<(), JsValue> {
    state.borrow_mut().published = row["n"].as_i64();
    let n = row["n"].to_string();
    let mut url = url::Url::parse("https://corvus.gent/hack/3")
        .map_err(|_| JsValue::from_str("Invalid share URL"))?;
    url.query_pairs_mut().append_pair("interview", &n);
    url.set_fragment(Some(&format!("int-{n}")));
    let linked = url.to_string();
    url.query_pairs_mut()
        .append_pair("utm_source", "x")
        .append_pair("utm_medium", "post")
        .append_pair("utm_content", text(row, "slug"));
    let intro = format!(
        "Interview #{n}: {} built {}. ",
        text(row, "builder"),
        text(row, "project")
    );
    let suffix = format!(
        " 🤖{} ",
        if text(row, "x_handle").is_empty() {
            String::new()
        } else {
            format!(" @{}", text(row, "x_handle"))
        }
    );
    let room = 257usize.saturating_sub(intro.chars().count() + suffix.chars().count());
    let description = text(row, "description");
    let description = if description.chars().count() > room {
        format!(
            "{}…",
            description
                .chars()
                .take(room.saturating_sub(1))
                .collect::<String>()
        )
    } else {
        description.into()
    };
    let draft = format!("{intro}{description}{suffix}{url}");
    let message = format!("Here's your interview, repost it! 🙏 {linked}");
    for (id, base, param, value) in [
        (
            "share-x",
            "https://x.com/intent/post",
            "text",
            draft.as_str(),
        ),
        ("share-wa", "https://wa.me/", "text", message.as_str()),
        (
            "share-li",
            "https://www.linkedin.com/sharing/share-offsite/",
            "url",
            linked.as_str(),
        ),
    ] {
        let mut target =
            url::Url::parse(base).map_err(|_| JsValue::from_str("Invalid share URL"))?;
        target.query_pairs_mut().append_pair(param, value);
        ui::element(id)?.set_attribute("href", target.as_str())?;
    }
    ui::text("success-title", &format!("#{n} · {}", text(row, "project")));
    ui::text(
        "success-note",
        &format!(
            "Published on the robots page + {} in the tracker.",
            text(row, "slug")
        ),
    );
    ui::element("builder-text")?
        .dyn_into::<HtmlTextAreaElement>()?
        .set_value(&message);
    ui::element("open-interview")?.set_attribute("href", &linked)?;
    ui::hidden("success", false);
    ui::hidden("editor", true);
    ui::text("copy-status", "");
    ui::scroll("success", false, false);
    Ok(())
}
async fn load(state: State) {
    let generation = {
        let mut s = state.borrow_mut();
        s.load_generation += 1;
        s.load_generation
    };
    let result=async{
        let data=api(None,"?interviewAdmin=1").await?;
        if state.borrow().load_generation!=generation{return Ok(());}
        let rows=data["interviews"].as_array().ok_or_else(||JsValue::from_str("Could not load interviews."))?;
        ui::hidden("owner",false);ui::hidden("login",true);ui::text("list-status",&if rows.is_empty(){"No interviews yet. The robots are warming up.".into()}else{format!("{} interviews · newest first",rows.len())});
        state.borrow_mut().listeners.clear();let entries=ui::element("entries")?;entries.set_text_content(None);
        for row in rows{
            let card=node("article","")?;card.set_class_name("entry");card.append_child(&node("h3",&format!("#{} · {} / {}",row["n"],text(row,"builder"),text(row,"project")))?.into())?;card.append_child(&node("p",text(row,"description"))?.into())?;
            let actions=node("div","")?;actions.set_class_name("entry-actions");
            for label in ["edit","share","delete"]{
                let button=node("button",label)?.dyn_into::<HtmlButtonElement>()?;button.set_type("button");if label=="delete"{button.set_class_name("delete");}actions.append_child(&button)?;
                let row=row.clone();let s=state.clone();let listener=ui::scoped_listener(button.as_ref(),"click",move |_|{
                    if s.borrow().busy{return;}let row=row.clone();let s=s.clone();
                    if label=="edit"{if let Err(e)=edit(&s,&row){ui::text("list-status",&ui::message(&e));}}else if label=="share"{if let Err(e)=success(&s,&row){ui::text("list-status",&ui::message(&e));}}else{
                        if !web_sys::window().and_then(|w|w.confirm_with_message(&format!("Delete interview #{} and its tracker entry? Existing vote totals are retained.",row["n"])).ok()).unwrap_or(false){return;}
                        s.borrow_mut().busy=true;spawn_local(async move{match api(Some(json!({"action":"delete","n":row["n"],"updated_at":row["updated_at"]})),"?interviews=1").await{Ok(_)=>{let clear={let state=s.borrow();state.editing.as_ref().is_some_and(|v|v["n"]==row["n"])||state.published==row["n"].as_i64()};if clear{let _=reset(&s);}load(s.clone()).await;},Err(e)=>ui::text("list-status",&ui::message(&e))};s.borrow_mut().busy=false;});
                    }
                })?;state.borrow_mut().listeners.push(listener);
            }
            card.append_child(&actions)?;entries.append_child(&card)?;
        }Ok::<(),JsValue>(())
    }.await;
    if let Err(e) = result {
        if state.borrow().load_generation != generation {
            return;
        }
        let message = ui::message(&e);
        ui::text("list-status", &message);
        if message == "Sign in first." {
            ui::hidden("owner", true);
            ui::hidden("login", false);
        }
    }
}
async fn compress() -> Result<String, JsValue> {
    let Some(file) = ui::element("photo")?
        .dyn_into::<HtmlInputElement>()?
        .files()
        .and_then(|f| f.get(0))
    else {
        return Ok(String::new());
    };
    if file.size() > 25000000.0 {
        return Err(JsValue::from_str(
            "Photo is too large. Choose one under 25 MB.",
        ));
    }
    let url = web_sys::Url::create_object_url_with_blob(&file)?;
    let result = async {
        let img = HtmlImageElement::new()?;
        img.set_src(&url);
        JsFuture::from(img.decode()).await?;
        let scale = (1400.0 / f64::from(img.natural_width().max(img.natural_height()))).min(1.0);
        let canvas = ui::doc()?
            .create_element("canvas")?
            .dyn_into::<HtmlCanvasElement>()?;
        canvas.set_width((f64::from(img.natural_width()) * scale).round() as u32);
        canvas.set_height((f64::from(img.natural_height()) * scale).round() as u32);
        let ctx = canvas
            .get_context("2d")?
            .ok_or_else(|| JsValue::from_str("Canvas unavailable"))?
            .dyn_into::<CanvasRenderingContext2d>()?;
        ctx.draw_image_with_html_image_element_and_dw_and_dh(
            &img,
            0.0,
            0.0,
            f64::from(canvas.width()),
            f64::from(canvas.height()),
        )?;
        let data = canvas
            .to_data_url_with_type_and_encoder_options("image/jpeg", &JsValue::from_f64(0.82))?;
        if data.len() > 2400000 {
            return Err(JsValue::from_str("Choose a smaller photo."));
        }
        Ok::<String, JsValue>(data)
    }
    .await;
    let _ = web_sys::Url::revoke_object_url(&url);
    result.map_err(|_| {
        JsValue::from_str("This photo could not be read. Try a JPEG, or save now without a photo.")
    })
}
#[wasm_bindgen]
pub fn start_interviews_admin() -> Result<(), JsValue> {
    let form = form()?;
    if form.has_attribute("data-rust-interviews") {
        return Ok(());
    }
    form.set_attribute("data-rust-interviews", "")?;
    let state = Rc::new(RefCell::new(Admin {
        request_id: uuid()?,
        ..Default::default()
    }));
    let s = state.clone();
    ui::listen(form.clone().as_ref(), "submit", move |event| {
        event.prevent_default();
        if s.borrow().busy || !form.report_validity() {
            return;
        }
        s.borrow_mut().busy = true;
        disabled("save", true);
        ui::text("save-status", "saving the robot…");
        let s = s.clone();
        spawn_local(async move {
            let result = async {
                let mut body = json!({"action":"save"});
                for key in FIELDS {
                    body[key] = json!(value(key)?);
                }
                body["consent"] = json!(input("consent")?.checked());
                body["remove_photo"] = json!(input("remove_photo")?.checked());
                body["photo"] = json!(compress().await?);
                {
                    let s = s.borrow();
                    body["request_id"] = json!(s.request_id);
                    if let Some(editing) = &s.editing {
                        body["n"] = editing["n"].clone();
                        body["updated_at"] = editing["updated_at"].clone();
                    }
                }
                let data = api(Some(body), "?interviews=1").await?;
                success(&s, &data["interview"])?;
                load(s.clone()).await;
                Ok::<(), JsValue>(())
            }
            .await;
            if let Err(e) = result {
                ui::text("save-status", &ui::message(&e));
            }
            s.borrow_mut().busy = false;
            disabled("save", false);
        });
    })?;
    let login = ui::element("login")?.dyn_into::<HtmlFormElement>()?;
    let target = login.clone();
    let s = state.clone();
    ui::listen(login.as_ref(), "submit", move |event| {
        event.prevent_default();
        let s = s.clone();
        let target = target.clone();
        spawn_local(async move {
            let result = async {
                let button = target
                    .query_selector("button")?
                    .ok_or_else(|| JsValue::from_str("Missing login button"))?
                    .dyn_into::<HtmlButtonElement>()?;
                button.set_disabled(true);
                let password = target
                    .query_selector("[name=password]")?
                    .ok_or_else(|| JsValue::from_str("Missing password"))?
                    .dyn_into::<HtmlInputElement>()?
                    .value();
                let result = api(Some(json!({"action":"login","password":password})), "").await;
                button.set_disabled(false);
                result?;
                target.reset();
                ui::text("login-status", "");
                load(s).await;
                Ok::<(), JsValue>(())
            }
            .await;
            if let Err(e) = result {
                ui::text("login-status", &ui::message(&e));
            }
        });
    })?;
    for id in ["new", "another"] {
        let s = state.clone();
        ui::listen(ui::element(id)?.as_ref(), "click", move |_| {
            if !s.borrow().busy {
                if let Err(e) = reset(&s) {
                    ui::text("save-status", &ui::message(&e));
                }
                ui::scroll("editor", false, false);
            }
        })?;
    }
    let s = state.clone();
    ui::listen(ui::element("logout")?.as_ref(), "click", move |_| {
        if s.borrow().busy {
            return;
        }
        s.borrow_mut().load_generation += 1;
        spawn_local(async {
            match api(Some(json!({"action":"logout"})), "").await {
                Ok(_) => {
                    if let Some(w) = web_sys::window() {
                        let _ = w.location().reload();
                    }
                }
                Err(e) => ui::text("list-status", &ui::message(&e)),
            };
        });
    })?;
    ui::listen(ui::element("copy")?.as_ref(), "click", move |_| {
        spawn_local(async {
            if let Ok(field) = ui::element("builder-text")
                .and_then(|e| e.dyn_into::<HtmlTextAreaElement>().map_err(Into::into))
            {
                let copied = ui::copy(&field.value()).await;
                if !copied {
                    field.select();
                }
                ui::text(
                    "copy-status",
                    if copied {
                        "Copied ✓"
                    } else {
                        "Select and copy the message above."
                    },
                );
            }
        });
    })?;
    spawn_local(load(state));
    Ok(())
}
