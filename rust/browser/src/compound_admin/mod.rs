//! Compound owner desk. Existing HTML/copy and API contracts stay authoritative.
mod links;
use crate::{compound_client as client, ui};
use corvus_core::army::truthy;
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::spawn_local;
use web_sys::{
    HtmlButtonElement, HtmlElement, HtmlFormElement, HtmlInputElement, HtmlSelectElement,
    HtmlTextAreaElement,
};
#[derive(Default)]
struct Admin {
    links: bool,
    reply_targets: std::collections::HashMap<String, String>,
    observer: Option<links::QrObserver>,
    data: Option<Value>,
    loading: bool,
    pending: bool,
    generation: u64,
    listeners: Vec<ui::Listener>,
    table_listeners: Vec<ui::Listener>,
    toast: Option<i32>,
}
type State = Rc<RefCell<Admin>>;
fn config() -> &'static Value {
    static CONFIG: std::sync::OnceLock<Value> = std::sync::OnceLock::new();
    CONFIG.get_or_init(|| {
        serde_json::from_str(include_str!("../../../migration/compound-v2-config.json"))
            .unwrap_or(Value::Null)
    })
}
fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
fn rows(v: &Value, k: &str) -> Vec<Value> {
    v[k].as_array().cloned().unwrap_or_default()
}
fn fmt(v: &Value) -> String {
    js_sys::Number::from(v.as_f64().unwrap_or(0.))
        .to_locale_string("en-US")
        .as_string()
        .unwrap_or_default()
}
fn label(group: &str, key: &str) -> String {
    let v = &config()[group][key];
    v.as_str().or_else(|| v[0].as_str()).unwrap_or("").into()
}
fn node(tag: &str, text: &str, class: &str) -> Result<HtmlElement, JsValue> {
    let e = ui::doc()?.create_element(tag)?.dyn_into::<HtmlElement>()?;
    e.set_text_content(Some(text));
    if !class.is_empty() {
        e.set_class_name(class);
    }
    Ok(e)
}
fn append(p: &impl AsRef<web_sys::Node>, c: &impl AsRef<web_sys::Node>) -> Result<(), JsValue> {
    p.as_ref().append_child(c.as_ref()).map(|_| ())
}
fn clear(id: &str) -> Result<HtmlElement, JsValue> {
    let e = ui::element(id)?;
    e.set_text_content(None);
    Ok(e)
}
fn button(text: &str, class: &str) -> Result<HtmlButtonElement, JsValue> {
    node("button", text, class)?.dyn_into().map_err(Into::into)
}
fn external(text: &str, url: &str, class: &str) -> Result<HtmlElement, JsValue> {
    let a = node("a", text, class)?;
    a.set_attribute("href", url)?;
    a.set_attribute("target", "_blank")?;
    a.set_attribute("rel", "noopener noreferrer")?;
    Ok(a)
}
fn date(value: &Value, method: &str, options: Option<Value>) -> String {
    let d = if value.is_null() {
        js_sys::Date::new_0()
    } else {
        js_sys::Date::new(&JsValue::from_str(value.as_str().unwrap_or("")))
    };
    let out = (|| {
        let f = js_sys::Reflect::get(&d, &method.into())?.dyn_into::<js_sys::Function>()?;
        if let Some(opts) = options {
            f.call2(
                &d,
                &js_sys::Array::new(),
                &js_sys::JSON::parse(&opts.to_string())?,
            )
        } else {
            f.call0(&d)
        }
    })();
    out.ok().and_then(|s| s.as_string()).unwrap_or_default()
}
fn posting(at: &Value) -> String {
    if js_sys::Date::parse(at.as_str().unwrap_or("")) <= js_sys::Date::now() {
        "ready now".into()
    } else {
        date(
            at,
            "toLocaleString",
            Some(json!({"weekday":"short","hour":"2-digit","minute":"2-digit"})),
        )
    }
}
fn field(form: &str, key: &str) -> Result<HtmlElement, JsValue> {
    ui::element(form)?
        .query_selector(&format!("[name={key}]"))?
        .ok_or(JsValue::NULL)?
        .dyn_into()
        .map_err(Into::into)
}
fn fields(form: &HtmlFormElement) -> Result<Value, JsValue> {
    let data = web_sys::FormData::new_with_form(form)?;
    let mut out = serde_json::Map::new();
    if let Some(iter) = js_sys::try_iter(&data)? {
        for pair in iter {
            let p = js_sys::Array::from(&pair?);
            if let Some(k) = p.get(0).as_string() {
                out.insert(k, json!(p.get(1).as_string().unwrap_or_default()));
            }
        }
    }
    Ok(Value::Object(out))
}
fn message(s: &str) {
    ui::text("admin-status", s)
}
fn toast(state: &State, s: &str) {
    ui::text("toast", s);
    ui::hidden("toast", false);
    if let Some(w) = web_sys::window() {
        if let Some(t) = state.borrow().toast {
            w.clear_timeout_with_handle(t)
        }
        let cb = Closure::once_into_js(|| ui::hidden("toast", true));
        state.borrow_mut().toast = w
            .set_timeout_with_callback_and_timeout_and_arguments_0(cb.unchecked_ref(), 4000)
            .ok();
    }
}
async fn copy(state: &State, s: &str) {
    if ui::copy(s).await {
        toast(state, "Copied ✓");
        return;
    }
    toast(state, "Select and copy the text below.");
    if let Ok(e) = node("textarea", "", "")
        .and_then(|n| n.dyn_into::<HtmlTextAreaElement>().map_err(Into::into))
    {
        e.set_value(s);
        let _ = e.set_attribute("aria-label", "Copy this text");
        if let Some(b) = ui::doc().ok().and_then(|d| d.body()) {
            let _ = b.append_child(&e);
            e.select();
            let _ = e.focus();
        }
    }
}
fn options(id: &str, group: &str, default: &str) -> Result<(), JsValue> {
    let e = clear(id)?.dyn_into::<HtmlSelectElement>()?;
    if let Some(items) = config()[group].as_object() {
        for (k, v) in items {
            let o = node(
                "option",
                v.as_str().or_else(|| v[0].as_str()).unwrap_or(""),
                "",
            )?;
            o.set_attribute("value", k)?;
            append(&e, &o)?;
        }
    }
    if !default.is_empty() {
        e.set_value(default)
    }
    Ok(())
}
fn summary(data: &Value) -> Result<(), JsValue> {
    let root = clear("admin-totals")?;
    for (k, l) in [
        ("views", "social views"),
        ("site_visits", "site visits"),
        ("votes", "votes"),
        ("feedback_count", "feedback"),
    ] {
        let el = node("div", "", "")?;
        append(&el, &node("b", &fmt(&data["totals"][k]), "")?)?;
        append(&el, &node("small", l, "")?)?;
        append(&root, &el)?;
    }
    Ok(())
}
fn winner(data: &Value) {
    let w = &data["push"]["winner"];
    ui::text(
        "winner-current",
        &if w.is_object() {
            format!(
                "Pushing: {}",
                if text(w, "slug").is_empty() {
                    text(w, "url")
                } else {
                    text(w, "slug")
                }
            )
        } else {
            "Choose a published TikTok, Instagram or X post below.".into()
        },
    );
}
fn report(data: &Value) -> Result<(), JsValue> {
    let state = &data["briefing"];
    let r = &state["report"];
    ui::text(
        "report-state",
        &if r.is_object() {
            format!(
                "updated {} · every 30 minutes{}",
                date(&r["generated_at"], "toLocaleString", None),
                if truthy(&state["error"]) {
                    " · refresh failed; showing the last successful report"
                } else {
                    ""
                }
            )
        } else {
            "No report yet. Refresh to build the first real snapshot.".into()
        },
    );
    if !r.is_object() {
        return Ok(());
    }
    let content = clear("report-content")?;
    append(
        &content,
        &node(
            "p",
            &format!(
                "{} reported views · {} published posts",
                fmt(&r["total_views"]),
                r["posts"]
            ),
            "",
        )?,
    )?;
    let list = node("ol", "", "")?;
    for v in rows(r, "top") {
        let li = node("li", "", "")?;
        append(&li, &external(text(&v, "slug"), text(&v, "url"), "")?)?;
        append(
            &li,
            &node(
                "p",
                &format!(
                    "{} views · {}",
                    fmt(&v["views"]),
                    if v["views_per_hour"].is_null() {
                        "views/hour unavailable".into()
                    } else {
                        format!("{} reported views/hour", fmt(&v["views_per_hour"]))
                    }
                ),
                "small",
            )?,
        )?;
        append(&list, &li)?;
    }
    append(&content, &list)?;
    append(
        &content,
        &node(
            "p",
            &format!(
                "Best variant: {}",
                if truthy(&r["best_variant"]) {
                    text(r, "best_variant")
                } else {
                    "not enough data."
                }
            ),
            "",
        )?,
    )?;
    for t in rows(r, "warnings") {
        append(
            &content,
            &node("p", t.as_str().unwrap_or(""), "small muted")?,
        )?;
    }
    ui::text("report-markdown", text(r, "markdown"));
    Ok(())
}
fn code_stats(data: &Value) -> Result<(), JsValue> {
    let section = match ui::element("code-visits") {
        Ok(e) => e,
        Err(_) => {
            let e = node("section", "", "")?;
            e.set_id("code-visits");
            ui::element("admin-totals")?.after_with_node_1(&e)?;
            e
        }
    };
    section.set_text_content(None);
    append(&section, &node("h2", "Visits from video codes", "")?)?;
    let table = node("table", "", "")?;
    let head = node("tr", "", "")?;
    for t in ["code", "code-link visits", "typed entries"] {
        append(&head, &node("th", t, "")?)?;
    }
    append(&table, &head)?;
    for r in rows(data, "code_visits") {
        let tr = node("tr", "", "")?;
        for t in [text(&r, "code").into(), fmt(&r["url"]), fmt(&r["typed"])] {
            append(&tr, &node("td", &t, "")?)?;
        }
        append(&table, &tr)?;
    }
    append(&section, &table)
}
fn queue(state: &State, data: &Value) -> Result<(), JsValue> {
    let videos = rows(data, "videos");
    ui::text(
        "queue-summary",
        &format!(
            "{} ready · {} posted",
            videos.iter().filter(|v| v["status"] == "ready").count(),
            videos.iter().filter(|v| v["status"] == "posted").count()
        ),
    );
    let root = clear("upload-queue")?;
    let groups = rows(data, "upload_queue");
    if groups.is_empty() {
        append(
            &root,
            &node(
                "p",
                "No ready exports queued. Posted clips and clips awaiting an export stay out of this list.",
                "muted",
            )?,
        )?;
    }
    for g in groups {
        let items = rows(&g, "items");
        let Some(v) = items.first() else { continue };
        let card = node("article", "", "panel queue-card")?;
        card.set_attribute("data-account", text(&g, "id"))?;
        for (tag, txt, class) in [
            (
                "h3",
                format!(
                    "{} · {}",
                    label("platforms", text(&g, "platform")),
                    label("accounts", text(&g, "account"))
                ),
                "",
            ),
            ("p", posting(&v["available_at"]), "queue-time"),
            ("strong", text(v, "slug").into(), ""),
            (
                "p",
                format!(
                    "{} · {}",
                    text(v, "vote_code"),
                    label("languages", text(v, "lang"))
                ),
                "small muted",
            ),
            (
                "code",
                v["filename"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .unwrap_or("No export file attached")
                    .into(),
                "queue-file",
            ),
        ] {
            append(&card, &node(tag, &txt, class)?)?;
        }
        let caption = node("textarea", "", "")?.dyn_into::<HtmlTextAreaElement>()?;
        caption.set_read_only(true);
        caption.set_value(text(v, "caption"));
        caption.set_rows(5);
        caption.set_attribute("aria-label", &format!("{} caption", text(v, "slug")))?;
        append(&card, &caption)?;
        let buttons = node("div", "", "draft-actions")?;
        let cp = button("copy caption", "button")?;
        cp.set_disabled(text(v, "caption").is_empty());
        let s = state.clone();
        let cap = text(v, "caption").to_string();
        state
            .borrow_mut()
            .listeners
            .push(ui::scoped_listener(cp.as_ref(), "click", move |_| {
                let (s, cap) = (s.clone(), cap.clone());
                spawn_local(async move {
                    copy(&s, &cap).await;
                });
            })?);
        append(&buttons, &cp)?;
        let done = button("mark posted →", "button primary")?;
        let slug = text(v, "slug").to_string();
        state.borrow_mut().listeners.push(ui::scoped_listener(
            done.as_ref(),
            "click",
            move |_| {
                let _ = (|| {
                    field("mark-posted", "slug")?
                        .dyn_into::<HtmlInputElement>()?
                        .set_value(&slug);
                    let opts = web_sys::ScrollIntoViewOptions::new();
                    opts.set_block(web_sys::ScrollLogicalPosition::Center);
                    let reduced = web_sys::window()
                        .and_then(|w| {
                            w.match_media("(prefers-reduced-motion: reduce)")
                                .ok()
                                .flatten()
                        })
                        .is_some_and(|m| m.matches());
                    opts.set_behavior(if reduced {
                        web_sys::ScrollBehavior::Instant
                    } else {
                        web_sys::ScrollBehavior::Smooth
                    });
                    ui::element("mark-posted")?
                        .scroll_into_view_with_scroll_into_view_options(&opts);
                    let f = web_sys::FocusOptions::new();
                    f.set_prevent_scroll(true);
                    field("mark-posted", "post_url")?.focus_with_options(&f)
                })();
            },
        )?);
        append(&buttons, &done)?;
        if !text(v, "download_url").is_empty() {
            append(
                &buttons,
                &external("download video ↗", text(v, "download_url"), "button")?,
            )?;
        }
        append(&card, &buttons)?;
        if items.len() > 1 {
            let det = node("details", "", "")?;
            append(
                &det,
                &node("summary", &format!("up next · {}", items.len() - 1), "")?,
            )?;
            let list = node("ol", "", "")?;
            for n in items.iter().skip(1) {
                append(
                    &list,
                    &node(
                        "li",
                        &format!(
                            "{} · {} · {}{}",
                            text(n, "vote_code"),
                            label("languages", text(n, "lang")),
                            posting(&n["available_at"]),
                            if truthy(&n["language_repeated"]) {
                                " · only this language remains"
                            } else {
                                ""
                            }
                        ),
                        "",
                    )?,
                )?;
            }
            append(&det, &list)?;
            append(&card, &det)?;
        }
        append(&root, &card)?;
    }
    let list = clear("postable-slugs")?;
    for v in videos.iter().filter(|v| !truthy(&v["is_example"])) {
        let o = node("option", "", "")?;
        o.set_attribute("value", text(v, "slug"))?;
        append(&list, &o)?;
    }
    Ok(())
}
async fn mutate(state: &State, body: Value) -> Result<Value, JsValue> {
    state.borrow_mut().generation += 1;
    client::api(Some(body), "", true).await
}
fn metric_input(v: &Value, k: &str) -> Result<HtmlInputElement, JsValue> {
    let e = node("input", "", "")?.dyn_into::<HtmlInputElement>()?;
    e.set_type("number");
    e.set_min("0");
    e.set_max("1000000000000");
    e.set_step("1");
    e.set_value(&v[k].as_f64().unwrap_or(0.).to_string());
    e.set_name(k);
    e.set_attribute("aria-label", &format!("{} {k}", text(v, "slug")))?;
    Ok(e)
}
fn table(state: &State, data: &Value) -> Result<(), JsValue> {
    state.borrow_mut().table_listeners.clear();
    let sort = ui::element("sort")?
        .dyn_into::<HtmlSelectElement>()?
        .value();
    let mut videos = rows(data, "videos");
    videos.sort_by(|a, b| {
        if sort == "slug" {
            js_sys::JsString::from(text(a, "slug"))
                .locale_compare(
                    text(b, "slug"),
                    &js_sys::Array::new(),
                    &js_sys::Object::new(),
                )
                .cmp(&0)
        } else {
            b[&sort]
                .as_f64()
                .unwrap_or(0.)
                .total_cmp(&a[&sort].as_f64().unwrap_or(0.))
        }
    });
    let table = node("table", "", "")?;
    let thead = node("thead", "", "")?;
    let head = node("tr", "", "")?;
    for t in [
        "slug / post",
        "platform",
        "account",
        "language",
        "hook",
        "views",
        "likes",
        "comments",
        "shares",
        "site visits",
        "votes",
        "feedback",
        "CTR",
        "save",
    ] {
        append(&head, &node("th", t, "")?)?;
    }
    append(&thead, &head)?;
    append(&table, &thead)?;
    let body = node("tbody", "", "")?;
    for v in videos {
        let tr = node("tr", "", "")?;
        let post = node("td", "", "post-cell")?;
        append(
            &post,
            &external(text(&v, "slug"), &format!("/v/{}", text(&v, "slug")), "")?,
        )?;
        append(
            &post,
            &node(
                "small",
                &if truthy(&v["updated_at"]) {
                    format!("\n{}", date(&v["updated_at"], "toLocaleString", None))
                } else {
                    "\nnot posted yet".into()
                },
                "",
            )?,
        )?;
        let url = node("input", "", "")?.dyn_into::<HtmlInputElement>()?;
        url.set_type("url");
        url.set_value(text(&v, "post_url"));
        url.set_placeholder("post URL");
        url.set_attribute("aria-label", &format!("{} post URL", text(&v, "slug")))?;
        let hook = node("input", "", "")?.dyn_into::<HtmlInputElement>()?;
        hook.set_type("text");
        hook.set_max_length(180);
        hook.set_value(text(&v, "hook_line"));
        hook.set_placeholder("hook line in this video’s language");
        hook.set_attribute("aria-label", &format!("{} hook line", text(&v, "slug")))?;
        append(&post, &hook)?;
        append(&post, &url)?;
        append(
            &post,
            &node(
                "small",
                &if v["metric_source"] == "oriane" {
                    format!("Oriane · {}", date(&v["synced_at"], "toLocaleString", None))
                } else if truthy(&v["awaiting_url"]) {
                    "awaiting post URL".into()
                } else {
                    "manually entered".into()
                },
                "",
            )?,
        )?;
        let example = node("input", "", "")?.dyn_into::<HtmlInputElement>()?;
        example.set_type("checkbox");
        example.set_checked(truthy(&v["is_example"]));
        let el = node("label", "", "checkbox")?;
        append(&el, &example)?;
        append(&el, &node("span", "example only", "")?)?;
        append(&post, &el)?;
        let win = button("Make this the winner", "button")?;
        win.set_type("button");
        win.set_disabled(
            text(&v, "post_url").is_empty()
                || truthy(&v["is_example"])
                || !["tt", "ig", "x"].contains(&text(&v, "platform")),
        );
        let (s, b, slug) = (state.clone(), win.clone(), text(&v, "slug").to_string());
        state.borrow_mut().table_listeners.push(ui::scoped_listener(
            win.as_ref(),
            "click",
            move |_| {
                b.set_disabled(true);
                let (s, b, slug) = (s.clone(), b.clone(), slug.clone());
                spawn_local(async move {
                    match mutate(&s, json!({"action":"set_winner","slug":slug})).await {
                        Ok(_) => {
                            toast(&s, "The army is now pushing this post.");
                            load(&s).await;
                        }
                        Err(e) => {
                            message(&ui::message(&e));
                            b.set_disabled(false);
                        }
                    }
                });
            },
        )?);
        append(&post, &win)?;
        append(&tr, &post)?;
        for (g, k) in [
            ("platforms", "platform"),
            ("accounts", "account"),
            ("languages", "lang"),
            ("hooks", "hook"),
        ] {
            append(&tr, &node("td", &label(g, text(&v, k)), "")?)?;
        }
        let mut inputs = Vec::new();
        for k in ["views", "likes", "comments", "shares"] {
            let td = node("td", "", "")?;
            let input = metric_input(&v, k)?;
            append(&td, &input)?;
            append(&tr, &td)?;
            inputs.push((k, input));
        }
        for value in [
            fmt(&v["site_visits"]),
            fmt(&v["votes"]),
            fmt(&v["feedback_count"]),
            if v["ctr"].is_null() {
                "—".into()
            } else {
                format!("{:.2}%", v["ctr"].as_f64().unwrap_or(0.) * 100.)
            },
        ] {
            append(&tr, &node("td", &value, "")?)?;
        }
        let td = node("td", "", "")?;
        let save = button("save", "")?;
        let (s, b) = (state.clone(), save.clone());
        state.borrow_mut().table_listeners.push(ui::scoped_listener(
            save.as_ref(),
            "click",
            move |_| {
                b.set_disabled(true);
                let (s, b, mut v, url, hook, example, inputs) = (
                    s.clone(),
                    b.clone(),
                    v.clone(),
                    url.clone(),
                    hook.clone(),
                    example.clone(),
                    inputs.clone(),
                );
                spawn_local(async move {
                    let result = async {
                        v["post_url"] = json!(url.value());
                        v["hook_line"] = json!(hook.value());
                        v["is_example"] = json!(example.checked());
                        for (k, input) in inputs {
                            if !input.report_validity() {
                                return Err(JsValue::from_str(&format!("Check the {k} field.")));
                            }
                            v[k] = json!(input.value().parse::<f64>().unwrap_or(0.));
                        }
                        mutate(&s, json!({"action":"edit","video":v})).await?;
                        load(&s).await;
                        message(&format!("Saved {}.", text(&v, "slug")));
                        Ok::<_, JsValue>(())
                    }
                    .await;
                    if let Err(e) = result {
                        message(&ui::message(&e));
                        b.set_disabled(false);
                    }
                });
            },
        )?);
        append(&td, &save)?;
        append(&tr, &td)?;
        append(&body, &tr)?;
    }
    append(&table, &body)?;
    append(&clear("stats-table")?, &table)
}
fn rollups(data: &Value) -> Result<(), JsValue> {
    let root = clear("rollups")?;
    for (k, g) in [
        ("platform", "platforms"),
        ("lang", "languages"),
        ("hook", "hooks"),
        ("account", "accounts"),
    ] {
        let section = node("div", "", "")?;
        append(&section, &node("h3", &format!("by {k}"), "")?)?;
        let table = node("table", "", "rollup-table")?;
        let head = node("tr", "", "")?;
        for t in [k, "views", "visits", "votes", "CTR"] {
            append(&head, &node("th", t, "")?)?;
        }
        append(&table, &head)?;
        let mut groups: Vec<(String, [f64; 3])> = Vec::new();
        for v in rows(data, "videos")
            .iter()
            .filter(|v| !truthy(&v["is_example"]))
        {
            let id = text(v, k);
            let index = groups.iter().position(|(s, _)| s == id).unwrap_or_else(|| {
                groups.push((id.into(), [0.; 3]));
                groups.len() - 1
            });
            for (i, key) in ["views", "site_visits", "votes"].iter().enumerate() {
                groups[index].1[i] += v[key].as_f64().unwrap_or(0.);
            }
        }
        groups.sort_by(|a, b| b.1[0].total_cmp(&a.1[0]));
        for (id, n) in &groups {
            let tr = node("tr", "", "")?;
            for val in [
                label(g, id),
                fmt(&json!(n[0])),
                fmt(&json!(n[1])),
                fmt(&json!(n[2])),
                if n[0] != 0. {
                    format!("{:.2}%", n[1] / n[0] * 100.)
                } else {
                    "—".into()
                },
            ] {
                append(&tr, &node("td", &val, "")?)?;
            }
            append(&table, &tr)?;
        }
        append(&section, &table)?;
        if groups.is_empty() {
            append(
                &section,
                &node("p", "No real posts yet. Examples are not counted.", "muted")?,
            )?;
        }
        append(&root, &section)?;
    }
    Ok(())
}
fn feedback(state: &State, data: &Value) -> Result<(), JsValue> {
    let root = clear("private-feedback")?;
    let rows = rows(data, "feedback");
    if rows.is_empty() {
        append(&root, &node("p", "No notes yet.", "")?)?;
    }
    for row in rows {
        let el = node("article", "", "private-feedback")?;
        append(
            &el,
            &node(
                "strong",
                &format!(
                    "{} · {}",
                    text(&row, "slug"),
                    row["handle"]
                        .as_str()
                        .filter(|s| !s.is_empty())
                        .unwrap_or("anonymous soldier")
                ),
                "",
            )?,
        )?;
        append(
            &el,
            &node(
                "small",
                &format!("\n{}", date(&row["at"], "toLocaleString", None)),
                "",
            )?,
        )?;
        append(&el, &node("p", text(&row, "text"), "")?)?;
        let b = button("delete note", "")?;
        let (s, button, id) = (state.clone(), b.clone(), row["id"].clone());
        state
            .borrow_mut()
            .listeners
            .push(ui::scoped_listener(b.as_ref(), "click", move |_| {
                button.set_disabled(true);
                let (s, b, id) = (s.clone(), button.clone(), id.clone());
                spawn_local(async move {
                    match mutate(&s, json!({"action":"hide_feedback","id":id})).await {
                        Ok(_) => load(&s).await,
                        Err(e) => {
                            message(&ui::message(&e));
                            b.set_disabled(false);
                        }
                    }
                });
            })?);
        append(&el, &b)?;
        append(&root, &el)?;
    }
    Ok(())
}
async fn render(state: &State, data: &Value) -> Result<(), JsValue> {
    state.borrow_mut().listeners.clear();
    if state.borrow().links {
        return links::render(state, data);
    }
    summary(data)?;
    winner(data);
    report(data)?;
    code_stats(data)?;
    queue(state, data)?;
    table(state, data)?;
    rollups(data)?;
    feedback(state, data)?;
    ui::text("sync-state", text(&data["sync"], "note"));
    crate::impact::admin::mount_impact_admin().await?;
    Ok(())
}
async fn load(state: &State) {
    if state.borrow().loading {
        state.borrow_mut().pending = true;
        return;
    }
    state.borrow_mut().loading = true;
    loop {
        state.borrow_mut().pending = false;
        let generation = state.borrow().generation;
        let result = client::api(None, "?private=1", true).await;
        if generation == state.borrow().generation {
            let result = match result {
                Ok(data) => {
                    ui::hidden("login", true);
                    ui::hidden("private", false);
                    state.borrow_mut().data = Some(data.clone());
                    render(state, &data).await
                }
                Err(e) => Err(e),
            };
            if let Err(e) = result {
                let msg = ui::message(&e);
                message(&msg);
                if msg == "Sign in first." {
                    ui::hidden("login", false);
                    ui::hidden("private", true);
                }
            } else {
                message(&format!(
                    "updated {}",
                    date(&Value::Null, "toLocaleTimeString", None)
                ));
            }
        }
        if !state.borrow().pending {
            break;
        }
    }
    state.borrow_mut().loading = false;
}
fn form_handler(state: &State, id: &'static str) -> Result<(), JsValue> {
    let form = ui::element(id)?.dyn_into::<HtmlFormElement>()?;
    let s = state.clone();
    ui::listen(form.as_ref(), "submit", move |e| {
        e.prevent_default();
        let s = s.clone();
        spawn_local(async move {
            let result = async {
                let form = ui::element(id)?.dyn_into::<HtmlFormElement>()?;
                let b = form
                    .query_selector("button")?
                    .ok_or(JsValue::NULL)?
                    .dyn_into::<HtmlButtonElement>()?;
                b.set_disabled(true);
                let result = async {
                    let mut f = fields(&form)?;
                    match id {
                        "login" => {
                            mutate(&s, json!({"action":"login","password":f["password"]})).await?;
                            form.reset();
                            load(&s).await;
                        }
                        "mark-posted" => {
                            f["action"] = json!("mark_posted");
                            let r = mutate(&s, f).await?;
                            ui::text(
                                "posted-status",
                                &format!(
                                    "Posted {} · {}",
                                    text(&r["video"], "slug"),
                                    date(&r["video"]["posted_at"], "toLocaleString", None)
                                ),
                            );
                            form.reset();
                            load(&s).await;
                        }
                        _ => {
                            let slug = format!(
                                "{}-{}-{}-{}{}",
                                text(&f, "platform"),
                                text(&f, "account"),
                                text(&f, "lang"),
                                text(&f, "hook"),
                                text(&f, "n")
                            );
                            f["slug"] = json!(slug);
                            f["posted_at"] = if text(&f, "posted_at").is_empty() {
                                Value::Null
                            } else {
                                let d =
                                    js_sys::Date::new(&JsValue::from_str(text(&f, "posted_at")));
                                if !d.get_time().is_finite() {
                                    return Err(JsValue::from_str("Invalid time value"));
                                }
                                json!(d.to_iso_string().as_string())
                            };
                            mutate(&s, json!({"action":"add","video":f})).await?;
                            ui::text("add-status", &format!("Added {slug}"));
                            load(&s).await;
                        }
                    }
                    Ok::<_, JsValue>(())
                }
                .await;
                b.set_disabled(false);
                result
            }
            .await;
            if let Err(e) = result {
                ui::text(
                    match id {
                        "login" => "login-status",
                        "mark-posted" => "posted-status",
                        _ => "add-status",
                    },
                    &ui::message(&e),
                );
            }
        });
    })
}
#[wasm_bindgen]
pub fn start_compound_admin() -> Result<(), JsValue> {
    let state = Rc::new(RefCell::new(Admin::default()));
    form_handler(&state, "login")?;
    state.borrow_mut().links = ui::element("link-list").is_ok();
    if state.borrow().links {
        links::start(&state)?;
    } else {
        for id in ["mark-posted", "add-video"] {
            form_handler(&state, id)?;
        }
        for (id, group, default) in [
            ("add-platform", "platforms", ""),
            ("add-account", "accounts", "gm"),
            ("add-lang", "languages", "en"),
            ("add-hook", "hooks", ""),
        ] {
            options(id, group, default)?;
        }
        let s = state.clone();
        ui::listen(ui::element("sort")?.as_ref(), "change", move |_| {
            let data = s.borrow().data.clone();
            if let Some(data) = data {
                let _ = table(&s, &data);
            }
        })?;
    }
    let s = state.clone();
    ui::listen(ui::element("refresh")?.as_ref(), "click", move |_| {
        let s = s.clone();
        spawn_local(async move {
            load(&s).await;
        });
    })?;
    let s = state.clone();
    ui::listen(ui::element("logout")?.as_ref(), "click", move |_| {
        let s = s.clone();
        spawn_local(async move {
            match mutate(&s, json!({"action":"logout"})).await {
                Ok(_) => {
                    s.borrow_mut().data = None;
                    s.borrow_mut().observer = None;
                    s.borrow_mut().reply_targets.clear();
                    s.borrow_mut().pending = false;
                    s.borrow_mut().listeners.clear();
                    s.borrow_mut().table_listeners.clear();
                    ui::hidden("private", true);
                    ui::hidden("login", false);
                }
                Err(e) => message(&ui::message(&e)),
            }
        });
    })?;
    if !state.borrow().links {
        let s = state.clone();
        ui::listen(
            ui::element("report-refresh")?.as_ref(),
            "click",
            move |_| {
                let s = s.clone();
                spawn_local(async move {
                    let Ok(b) = ui::element("report-refresh")
                        .and_then(|e| e.dyn_into::<HtmlButtonElement>().map_err(Into::into))
                    else {
                        return;
                    };
                    b.set_disabled(true);
                    let generation = s.borrow().generation;
                    match client::api(None, "?reportJob=1&force=1", true).await {
                        Ok(r) => {
                            if generation == s.borrow().generation {
                                let data = {
                                    let mut a = s.borrow_mut();
                                    if let Some(d) = a.data.as_mut() {
                                        d["briefing"] = r;
                                        Some(d.clone())
                                    } else {
                                        None
                                    }
                                };
                                if let Some(d) = data {
                                    let _ = report(&d);
                                }
                            }
                        }
                        Err(e) => ui::text(
                            "report-state",
                            &format!(
                                "Refresh failed. The last report stays visible. {}",
                                ui::message(&e)
                            ),
                        ),
                    }
                    b.set_disabled(false);
                });
            },
        )?;
        let s = state.clone();
        let poll = Closure::<dyn FnMut()>::new(move || {
            if ui::doc().map(|d| d.hidden()).unwrap_or(true)
                || s.borrow().data.is_none()
                || ui::element("private").map(|e| e.hidden()).unwrap_or(true)
            {
                return;
            }
            let s = s.clone();
            spawn_local(async move {
                let generation = s.borrow().generation;
                if let Ok(r) = client::api(None, "?report=1", true).await
                    && generation == s.borrow().generation
                {
                    let data = {
                        let mut a = s.borrow_mut();
                        if let Some(d) = a.data.as_mut() {
                            d["briefing"] = r;
                            Some(d.clone())
                        } else {
                            None
                        }
                    };
                    if let Some(d) = data {
                        let _ = report(&d);
                    }
                }
            });
        });
        if let Some(w) = web_sys::window() {
            w.set_interval_with_callback_and_timeout_and_arguments_0(
                poll.as_ref().unchecked_ref(),
                60000,
            )?;
            poll.forget();
        }
    }
    spawn_local(async move {
        match client::api(None, "?session=1", true).await {
            Ok(s) if truthy(&s["authorized"]) => load(&state).await,
            Err(_) => ui::text("login-status", "Connection lost. You can retry signing in."),
            _ => (),
        }
    });
    Ok(())
}
