//! Public hub, localized video lists, voting, feedback and sharing; existing markup is retained.
use crate::{compound_client as client, ui};
use corvus_core::{army::truthy, videos};
use serde_json::{Value, json};
use std::{cell::RefCell, collections::HashSet, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{
    HtmlButtonElement, HtmlElement, HtmlFormElement, HtmlInputElement, HtmlSelectElement,
};
thread_local! {static CONFIG:Value=serde_json::from_str(include_str!("../../migration/compound-v2-config.json")).unwrap_or(Value::Null);}
fn config() -> Value {
    CONFIG.with(Clone::clone)
}
#[derive(Default)]
struct Page {
    lang: String,
    hook: String,
    n: u64,
    query: Value,
    code: Option<videos::Code>,
    valid: bool,
    data: Option<Value>,
    selected: Option<Value>,
    clock_offset: f64,
    loading: bool,
    reload_after: bool,
    generation: u64,
    seen: HashSet<String>,
    listeners: Vec<ui::Listener>,
    toast: Option<i32>,
}
type State = Rc<RefCell<Page>>;
fn text<'a>(p: &'a Value, k: &str) -> &'a str {
    p[k].as_str().unwrap_or("")
}
fn node(tag: &str, label: &str, class: &str) -> Result<HtmlElement, JsValue> {
    let e = ui::doc()?.create_element(tag)?.dyn_into::<HtmlElement>()?;
    e.set_text_content(Some(label));
    if !class.is_empty() {
        e.set_class_name(class)
    }
    Ok(e)
}
fn append(p: &impl AsRef<web_sys::Node>, c: &impl AsRef<web_sys::Node>) -> Result<(), JsValue> {
    p.as_ref().append_child(c.as_ref()).map(|_| ())
}
fn fmt(value: &Value) -> String {
    js_sys::Number::from(value.as_f64().unwrap_or(0.0))
        .to_locale_string("en-US")
        .as_string()
        .unwrap_or_default()
}
fn select(id: &str) -> Result<HtmlSelectElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
fn input(id: &str) -> Result<HtmlInputElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
fn disabled(id: &str, v: bool) {
    if let Ok(e) =
        ui::element(id).and_then(|e| e.dyn_into::<HtmlButtonElement>().map_err(Into::into))
    {
        e.set_disabled(v);
    }
}
fn options(id: &str, items: &Value, all: &str) -> Result<(), JsValue> {
    let s = select(id)?;
    s.set_text_content(None);
    let o = node("option", all, "")?;
    o.set_attribute("value", "")?;
    append(&s, &o)?;
    if let Some(items) = items.as_object() {
        for (k, v) in items {
            let label = if v.is_array() {
                v[0].as_str()
            } else {
                v.as_str()
            }
            .unwrap_or("");
            let o = node("option", label, "")?;
            o.set_attribute("value", k)?;
            append(&s, &o)?;
        }
    }
    Ok(())
}
fn code(v: &Value) -> String {
    format!(
        "{}-{}-{}",
        text(v, "lang"),
        text(v, "hook"),
        v["n"].as_u64().unwrap_or(0)
    )
    .to_uppercase()
}
fn page_link(v: &Value) -> String {
    format!(
        "/compound/v2/{}/{}/{}?video={}",
        text(v, "lang"),
        text(v, "hook"),
        v["n"].as_u64().unwrap_or(0),
        js_sys::encode_uri_component(text(v, "slug"))
            .as_string()
            .unwrap_or_default()
    )
}
fn event(kind: &str, slug: &str) {
    client::event(json!({"action":"event","type":kind,"slug":slug}), true);
}
fn status(state: &State, message: &str, error: bool) -> Result<(), JsValue> {
    let el = ui::element("load-status")?;
    el.class_list().toggle_with_force("error", error)?;
    el.set_text_content(Some(message));
    state.borrow_mut().listeners.clear();
    if error {
        let retry = node("button", "retry", "")?;
        let s = state.clone();
        state.borrow_mut().listeners.push(ui::scoped_listener(
            retry.as_ref(),
            "click",
            move |_| {
                let s = s.clone();
                spawn_local(async move {
                    load(&s).await;
                });
            },
        )?);
        append(&el, &retry)?;
    }
    Ok(())
}
fn local_time() -> String {
    let date = js_sys::Date::new_0();
    js_sys::Reflect::get(&date, &"toLocaleTimeString".into())
        .ok()
        .and_then(|f| f.dyn_into::<js_sys::Function>().ok())
        .and_then(|f| f.call0(&date).ok())
        .and_then(|v| v.as_string())
        .unwrap_or_default()
}
fn tick(state: &State) {
    let deadline = js_sys::Date::parse(config()["deadline"].as_str().unwrap_or(""));
    let ms = (deadline - js_sys::Date::now() - state.borrow().clock_offset).max(0.0);
    let sec = (ms / 1000.0).floor() as u64;
    ui::text(
        "clock",
        &if ms > 0.0 {
            format!(
                "{}d {:02}h {:02}m {:02}s",
                sec / 86400,
                sec / 3600 % 24,
                sec / 60 % 60,
                sec % 60
            )
        } else {
            "the challenge has ended.".into()
        },
    );
}
fn code_matches(state: &Page, v: &Value) -> bool {
    state.code.as_ref().is_some_and(|c| {
        v["lang"] == c.lang && v["hook"] == c.hook && v["n"].as_u64() == Some(c.n as u64)
    })
}
fn card(v: &Value, cfg: &Value) -> Result<HtmlElement, JsValue> {
    let a = node("a", "", "video-card")?;
    a.set_attribute("href", &page_link(v))?;
    let cover = node("div", "", "video-cover")?;
    append(
        &cover,
        &node(
            "span",
            &format!(
                "{} / {}",
                cfg["platforms"][text(v, "platform")].as_str().unwrap_or(""),
                cfg["languages"][text(v, "lang")][0].as_str().unwrap_or("")
            ),
            "",
        )?,
    )?;
    append(&cover, &node("b", &code(v), "")?)?;
    append(
        &cover,
        &node(
            "span",
            if truthy(&v["is_example"]) {
                "EXAMPLE · NOT POSTED"
            } else if text(v, "post_url").is_empty() {
                "POST LINK COMING SOON"
            } else {
                "WATCH + VOTE ↗"
            },
            "",
        )?,
    )?;
    let body = node("div", "", "card-body")?;
    append(&body, &node("h3", text(v, "slug"), "")?)?;
    append(
        &body,
        &node(
            "p",
            &format!(
                "{} · {}",
                cfg["accounts"][text(v, "account")].as_str().unwrap_or(""),
                cfg["hooks"][text(v, "hook")].as_str().unwrap_or("")
            ),
            "",
        )?,
    )?;
    append(
        &body,
        &node(
            "p",
            &format!(
                "{} social views · {} votes",
                fmt(&v["views"]),
                fmt(&v["votes"])
            ),
            "",
        )?,
    )?;
    if truthy(&v["is_example"]) {
        append(
            &body,
            &node("span", "demo — excluded from totals", "demo-tag")?,
        )?;
    }
    append(&a, &cover)?;
    append(&a, &body)?;
    Ok(a)
}
fn grid(state: &State) -> Result<(), JsValue> {
    let s = state.borrow();
    let Some(data) = &s.data else { return Ok(()) };
    let cfg = config();
    let filters = [
        ("platform", select("platform-filter")?.value()),
        ("account", select("account-filter")?.value()),
        ("lang", select("lang-filter")?.value()),
        ("hook", select("hook-filter")?.value()),
    ];
    let mut rows = data["videos"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|v| filters.iter().all(|(k, x)| x.is_empty() || v[*k] == *x))
        .cloned()
        .collect::<Vec<_>>();
    rows.sort_by(|a, b| {
        code_matches(&s, b)
            .cmp(&code_matches(&s, a))
            .then_with(|| truthy(&a["is_example"]).cmp(&truthy(&b["is_example"])))
            .then_with(|| {
                b["views"]
                    .as_f64()
                    .unwrap_or(0.0)
                    .total_cmp(&a["views"].as_f64().unwrap_or(0.0))
            })
            .then_with(|| {
                b["votes"]
                    .as_f64()
                    .unwrap_or(0.0)
                    .total_cmp(&a["votes"].as_f64().unwrap_or(0.0))
            })
    });
    let root = ui::element("video-grid")?;
    root.set_text_content(None);
    for (i, v) in rows.iter().enumerate() {
        let el = card(v, &cfg)?;
        if i == 0 && code_matches(&s, v) {
            el.class_list().add_1("code-highlight")?;
            el.set_attribute(
                "aria-label",
                &format!("Your code: {} · {}", code(v), text(v, "slug")),
            )?;
        }
        append(&root, &el)?;
    }
    ui::hidden("grid-empty", !rows.is_empty());
    ui::text("result-count", &format!("{} videos", rows.len()));
    Ok(())
}
fn detail(state: &State) -> Result<(), JsValue> {
    let (slang, shook, n, query, data) = {
        let s = state.borrow();
        let Some(data) = &s.data else { return Ok(()) };
        (
            s.lang.clone(),
            s.hook.clone(),
            s.n,
            s.query.clone(),
            data.clone(),
        )
    };
    let cfg = config();
    let videos = data["videos"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    let matches = videos
        .iter()
        .filter(|v| v["lang"] == slang && v["hook"] == shook && v["n"].as_u64() == Some(n))
        .collect::<Vec<_>>();
    let chosen = matches
        .iter()
        .find(|v| v["slug"] == query["video"])
        .or_else(|| matches.iter().find(|v| v["slug"] == query["utm_content"]))
        .or_else(|| matches.iter().find(|v| !truthy(&v["is_example"])))
        .or_else(|| matches.first())
        .copied();
    let Some(v) = chosen else {
        state.borrow_mut().selected = None;
        ui::hidden("detail", true);
        status(
            state,
            "This cut is not registered yet. Browse the other videos below.",
            true,
        )?;
        return Ok(());
    };
    state.borrow_mut().selected = Some(v.clone());
    ui::hidden("hub-hero", true);
    ui::hidden("detail", false);
    let code = code(&json!({"lang":slang,"hook":shook,"n":n}));
    ui::text(
        "detail-title",
        &format!("{code} · {}", cfg["hooks"][&shook].as_str().unwrap_or("")),
    );
    ui::text("detail-code", &code);
    ui::text(
        "detail-label",
        &format!(
            "{} · {}",
            cfg["platforms"][text(v, "platform")].as_str().unwrap_or(""),
            cfg["accounts"][text(v, "account")].as_str().unwrap_or("")
        ),
    );
    ui::hidden("example-note", !text(v, "post_url").is_empty());
    ui::text(
        "example-note",
        if truthy(&v["is_example"]) {
            "example only · excluded from totals"
        } else {
            "registered cut · post URL coming soon"
        },
    );
    let post = text(v, "post_url");
    let clip = text(v, "interview_clip_url");
    ui::hidden("watch-post", post.is_empty() && clip.is_empty());
    ui::element("watch-post")?.set_attribute(
        "href",
        if !post.is_empty() {
            post
        } else if !clip.is_empty() {
            clip
        } else {
            "#"
        },
    )?;
    ui::text(
        "watch-post",
        &if !post.is_empty() {
            format!(
                "Watch on {} ↗",
                cfg["platforms"][text(v, "platform")].as_str().unwrap_or("")
            )
        } else {
            "Watch the interview ↗".into()
        },
    );
    let original = text(v, "compound_url");
    ui::hidden("watch-compound", original.is_empty());
    ui::element("watch-compound")?
        .set_attribute("href", if original.is_empty() { "#" } else { original })?;
    ui::text(
        "detail-views",
        &format!("{} reported social views", fmt(&v["views"])),
    );
    ui::text("up-count", &fmt(&v["stats"]["up"]));
    ui::text("down-count", &fmt(&v["stats"]["down"]));
    let other = ui::element("other-versions")?;
    other.set_text_content(None);
    for other_v in videos
        .iter()
        .filter(|x| x["slug"] != v["slug"] && (x["lang"] == slang || x["hook"] == shook))
        .take(16)
    {
        let a = node("a", text(other_v, "slug"), "")?;
        a.set_attribute("href", &page_link(other_v))?;
        append(&other, &a)?;
    }
    let container = ui::element("platform-versions")?;
    container.set_text_content(None);
    for other in matches {
        let a = node(
            "a",
            &format!(
                "{} · {}",
                cfg["platforms"][text(other, "platform")]
                    .as_str()
                    .unwrap_or(""),
                cfg["accounts"][text(other, "account")]
                    .as_str()
                    .unwrap_or("")
            ),
            "",
        )?;
        a.set_attribute("href", &page_link(other))?;
        if other["slug"] == v["slug"] {
            a.set_attribute("aria-current", "page")?;
        }
        append(&container, &a)?;
    }
    if state.borrow_mut().seen.insert(text(v, "slug").into()) {
        event("pageview", text(v, "slug"));
    }
    ui::doc()?.set_title(&format!("{code} · vote the next cut · Corvus"));
    Ok(())
}
async fn load(state: &State) {
    if state.borrow().loading {
        state.borrow_mut().reload_after = true;
        return;
    }
    state.borrow_mut().loading = true;
    loop {
        state.borrow_mut().reload_after = false;
        let generation = state.borrow().generation;
        let outcome = async {
            let data = client::api(None, "", true).await?;
            if state.borrow().generation != generation {
                return Ok(());
            }
            if !text(&data, "server_time").is_empty() {
                state.borrow_mut().clock_offset =
                    js_sys::Date::parse(text(&data, "server_time")) - js_sys::Date::now();
            }
            state.borrow_mut().data = Some(data.clone());
            for (id, k) in [
                ("total-views", "views"),
                ("total-videos", "videos"),
                ("total-votes", "votes"),
            ] {
                ui::text(id, &fmt(&data["totals"][k]));
            }
            status(
                state,
                &format!("updated {} · reported social views", local_time()),
                false,
            )?;
            grid(state)?;
            if state.borrow().n != 0 {
                detail(state)?;
            }
            Ok::<_, JsValue>(())
        }
        .await;
        if let Err(e) = outcome
            && state.borrow().generation == generation
        {
            let prefix = if state.borrow().data.is_some() {
                "Showing the last loaded numbers. "
            } else {
                ""
            };
            let _ = status(state, &format!("{prefix}{}", ui::message(&e)), true);
        }
        if !state.borrow().reload_after {
            break;
        }
    }
    state.borrow_mut().loading = false;
}
fn toast(state: &State, message: &str) {
    ui::text("toast", message);
    ui::hidden("toast", false);
    if let Some(w) = web_sys::window() {
        if let Some(t) = state.borrow().toast {
            w.clear_timeout_with_handle(t);
        }
        let callback = Closure::once_into_js(|| ui::hidden("toast", true));
        state.borrow_mut().toast = w
            .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), 4000)
            .ok();
    }
}
async fn copy(state: &State, text: &str) {
    if ui::copy(text).await {
        toast(state, "Copied ✓");
        return;
    }
    toast(state, "Select and copy the text below.");
    if let Ok(field) = ui::doc()
        .and_then(|d| d.create_element("textarea"))
        .and_then(|e| {
            e.dyn_into::<web_sys::HtmlTextAreaElement>()
                .map_err(Into::into)
        })
    {
        field.set_value(text);
        let _ = field.set_attribute("aria-label", "Copy this text");
        if let Some(body) = ui::doc().ok().and_then(|d| d.body()) {
            let _ = body.append_child(&field);
            field.select();
            let _ = field.focus();
        }
    }
}
fn share_text(p: &Value) -> String {
    format!(
        "One-man army. Many editors. Help shape the next cut — $1,000 on the line. https://corvus.gent/v/{}",
        text(p, "slug")
    )
}
async fn share_native(state: &State, p: &Value) {
    let text = share_text(p);
    let outcome = async {
        let nav = web_sys::window().ok_or(JsValue::NULL)?.navigator();
        let share = js_sys::Reflect::get(&nav, &"share".into())?;
        if let Ok(f) = share.dyn_into::<js_sys::Function>() {
            let body = js_sys::JSON::parse(&json!({"text":text}).to_string())?;
            let promise = f.call1(&nav, &body)?;
            JsFuture::from(js_sys::Promise::resolve(&promise)).await?;
        } else {
            copy(state, &text).await;
        }
        Ok::<_, JsValue>(())
    }
    .await;
    match outcome {
        Ok(_) => event("share_click", self::text(p, "slug")),
        Err(e) => {
            if js_sys::Reflect::get(&e, &"name".into())
                .ok()
                .and_then(|v| v.as_string())
                .as_deref()
                != Some("AbortError")
            {
                copy(state, &text).await;
                event("share_click", self::text(p, "slug"));
            }
        }
    }
}
#[wasm_bindgen]
pub fn start_compound_v2() -> Result<(), JsValue> {
    let root = ui::element("video-grid")?;
    if root.has_attribute("data-rust-compound") {
        return Ok(());
    }
    root.set_attribute("data-rust-compound", "")?;
    client::start_compound_client()?;
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let path = w.location().pathname()?;
    let parts = path
        .trim_end_matches('/')
        .split('/')
        .skip(3)
        .collect::<Vec<_>>();
    let lang = parts.first().copied().unwrap_or("").to_owned();
    let hook = parts.get(1).copied().unwrap_or("").to_owned();
    let number = parts.get(2).copied().unwrap_or("");
    let n = number.parse::<u64>().unwrap_or(0);
    let cfg = config();
    let valid = parts.len() <= 3
        && (lang.is_empty() || cfg["languages"].get(&lang).is_some())
        && (hook.is_empty() || cfg["hooks"].get(&hook).is_some())
        && (number.is_empty()
            || (number.len() <= 4
                && !number.starts_with('0')
                && number.bytes().all(|b| b.is_ascii_digit())));
    let mut query = json!({});
    for (k, v) in
        url::form_urlencoded::parse(w.location().search()?.trim_start_matches('?').as_bytes())
    {
        query[k.as_ref()] = json!(v);
    }
    let state = Rc::new(RefCell::new(Page {
        lang: lang.clone(),
        hook: hook.clone(),
        n,
        code: videos::parse_code(text(&query, "c")),
        query: query.clone(),
        valid,
        ..Default::default()
    }));
    tick(&state);
    let s = state.clone();
    let tick = Closure::<dyn FnMut()>::new(move || tick(&s));
    w.set_interval_with_callback_and_timeout_and_arguments_0(tick.as_ref().unchecked_ref(), 1000)?;
    tick.forget();
    for (id, k, all) in [
        ("platform-filter", "platforms", "all platforms"),
        ("account-filter", "accounts", "all accounts"),
        ("lang-filter", "languages", "all languages"),
        ("hook-filter", "hooks", "all hooks"),
    ] {
        options(id, &cfg[k], all)?;
        let s = state.clone();
        ui::listen(ui::element(id)?.as_ref(), "change", move |_| {
            let _ = grid(&s);
        })?;
    }
    if !lang.is_empty() {
        select("lang-filter")?.set_value(&lang);
        select("lang-filter")?.set_disabled(true);
        if let Some(html) = ui::doc()?.document_element() {
            html.set_attribute("lang", &lang)?;
            if ["ar", "fa"].contains(&lang.as_str()) {
                html.set_attribute("dir", "rtl")?;
            }
        }
        ui::text(
            "locale-headline",
            cfg["languages"][&lang][1].as_str().unwrap_or(""),
        );
        ui::hidden("locale-headline", false);
    }
    if !hook.is_empty() {
        select("hook-filter")?.set_value(&hook);
        select("hook-filter")?.set_disabled(true);
    }
    for (id, k, selected) in [
        ("languages", "languages", lang.as_str()),
        ("hook-links", "hooks", hook.as_str()),
    ] {
        let container = ui::element(id)?;
        container.set_text_content(None);
        if let Some(items) = cfg[k].as_object() {
            for (key, v) in items {
                let label = if v.is_array() {
                    v[0].as_str()
                } else {
                    v.as_str()
                }
                .unwrap_or("");
                let a = node("a", label, "")?;
                a.set_attribute(
                    "href",
                    &if id == "languages" {
                        format!("/compound/v2/{key}")
                    } else {
                        format!(
                            "/compound/v2/{}/{key}",
                            if lang.is_empty() { "en" } else { &lang }
                        )
                    },
                )?;
                if key == selected {
                    a.set_attribute("aria-current", "page")?;
                }
                append(&container, &a)?;
            }
        }
    }
    for id in ["watch-post", "watch-compound"] {
        let s = state.clone();
        ui::listen(ui::element(id)?.as_ref(), "click", move |_| {
            if let Some(p) = &s.borrow().selected {
                event("outbound_click", text(p, "slug"));
            }
        })?;
    }
    let s = state.clone();
    ui::listen(ui::element("code-form")?.as_ref(), "submit", move |e| {
        e.prevent_default();
        let s = s.clone();
        let button = ui::element("code-form")
            .ok()
            .and_then(|f| f.query_selector("button").ok().flatten())
            .and_then(|b| b.dyn_into::<HtmlButtonElement>().ok());
        if button.as_ref().is_some_and(|b| b.disabled()) {
            return;
        }
        if let Some(b) = &button {
            b.set_disabled(true)
        }
        spawn_local(async move {
            let query = s.borrow().query.clone();
            let code = input("video-code").map(|e| e.value()).unwrap_or_default();
            match client::api(
                Some(json!({"action":"code","code":code,"source":"typed","query":query})),
                "",
                true,
            )
            .await
            {
                Ok(d) => {
                    if let Some(w) = web_sys::window() {
                        let _ = w.location().assign(text(&d, "destination"));
                    }
                }
                Err(e) => toast(&s, &ui::message(&e)),
            }
            if let Some(b) = button {
                b.set_disabled(false);
            }
        });
    })?;
    for choice in ["up", "down"] {
        let s = state.clone();
        ui::listen(
            ui::element(&format!("vote-{choice}"))?.as_ref(),
            "click",
            move |_| {
                let Some(p) = s.borrow().selected.clone() else {
                    return;
                };
                s.borrow_mut().generation += 1;
                disabled("vote-up", true);
                disabled("vote-down", true);
                let s = s.clone();
                spawn_local(async move {
                    match client::api(
                        Some(json!({"action":"vote","slug":p["slug"],"choice":choice})),
                        "",
                        true,
                    )
                    .await
                    {
                        Ok(d) => {
                            for c in ["up", "down"] {
                                if let Ok(b) = ui::element(&format!("vote-{c}")) {
                                    let _ = b.set_attribute(
                                        "aria-pressed",
                                        if d["choice"] == c { "true" } else { "false" },
                                    );
                                }
                            }
                            ui::text(
                                "vote-status",
                                &if truthy(&d["added"]) {
                                    "Saved. You just shaped the next cut.".into()
                                } else {
                                    format!("Your {} vote was already saved.", text(&d, "choice"))
                                },
                            );
                            load(&s).await;
                        }
                        Err(e) => {
                            ui::text("vote-status", &ui::message(&e));
                            disabled("vote-up", false);
                            disabled("vote-down", false);
                        }
                    }
                });
            },
        )?;
    }
    let s = state.clone();
    ui::listen(ui::element("feedback-form")?.as_ref(), "submit", move |e| {
        e.prevent_default();
        let Some(p) = s.borrow().selected.clone() else {
            return;
        };
        let s = s.clone();
        disabled("feedback-send", true);
        spawn_local(async move {
            let outcome = async {
                let f = ui::element("feedback-form")?.dyn_into::<HtmlFormElement>()?;
                let form = web_sys::FormData::new_with_form(&f)?;
                let mut body = json!({"action":"feedback","slug":p["slug"]});
                if let Some(iter) = js_sys::try_iter(&form)? {
                    for pair in iter {
                        let a = js_sys::Array::from(&pair?);
                        if let Some(k) = a.get(0).as_string() {
                            body[k] = json!(a.get(1).as_string().unwrap_or_default());
                        }
                    }
                }
                client::api(Some(body), "", true).await?;
                f.reset();
                ui::text("feedback-status", "Noted ✓ One-man army. Many editors.");
                load(&s).await;
                Ok::<_, JsValue>(())
            }
            .await;
            if let Err(e) = outcome {
                ui::text("feedback-status", &ui::message(&e));
            }
            disabled("feedback-send", false);
        });
    })?;
    for id in ["native", "copy", "x", "whatsapp"] {
        let s = state.clone();
        ui::listen(
            ui::element(&format!("share-{id}"))?.as_ref(),
            "click",
            move |_| {
                let Some(p) = s.borrow().selected.clone() else {
                    return;
                };
                let s = s.clone();
                if id == "native" {
                    spawn_local(async move {
                        share_native(&s, &p).await;
                    });
                } else if id == "copy" {
                    spawn_local(async move {
                        copy(&s, &share_text(&p)).await;
                        event("share_click", text(&p, "slug"));
                    });
                } else {
                    event("share_click", text(&p, "slug"));
                    let encoded = js_sys::encode_uri_component(&share_text(&p))
                        .as_string()
                        .unwrap_or_default();
                    if let Some(w) = web_sys::window() {
                        let _ = w.open_with_url_and_target_and_features(
                            &format!(
                                "{}{encoded}",
                                if id == "x" {
                                    "https://x.com/intent/post?text="
                                } else {
                                    "https://wa.me/?text="
                                }
                            ),
                            "_blank",
                            "noopener,noreferrer",
                        );
                    }
                }
            },
        )?;
    }
    if valid {
        let s = state.clone();
        spawn_local(async move {
            load(&s).await;
        });
    } else {
        ui::hidden("grid-empty", false);
        ui::text("grid-empty", "That language or video code does not exist.");
        status(&state, "Choose a language below.", false)?;
    }
    let s = state.clone();
    let refresh = Closure::<dyn FnMut()>::new(move || {
        if s.borrow().valid && ui::doc().is_ok_and(|d| !d.hidden()) {
            let s = s.clone();
            spawn_local(async move {
                load(&s).await;
            });
        }
    });
    w.set_interval_with_callback_and_timeout_and_arguments_0(
        refresh.as_ref().unchecked_ref(),
        30000,
    )?;
    refresh.forget();
    if query.get("code").is_some() {
        let code = text(&query, "code");
        input("video-code")?.set_value(&code.chars().take(32).collect::<String>());
        let msg = node(
            "p",
            "Code not found yet, pick a version below",
            "status-line",
        )?;
        msg.set_id("code-status");
        msg.set_attribute("role", "status")?;
        let form = ui::element("code-form")?;
        if let Some(parent) = form.parent_node() {
            parent.insert_before(&msg, form.next_sibling().as_ref())?;
        }
        if query.get("code_missing").is_none() {
            let code = code.to_owned();
            spawn_local(async move {
                match client::api(
                    Some(json!({"action":"code","code":code,"source":"url","query":query})),
                    "",
                    true,
                )
                .await
                {
                    Ok(d) => {
                        if truthy(&d["matches"])
                            && let Some(w) = web_sys::window()
                        {
                            let _ = w.location().replace(text(&d, "destination"));
                        }
                    }
                    Err(e) => ui::text("code-status", &ui::message(&e)),
                }
            });
        }
    }
    Ok(())
}
