//! Blind voting and the scorecard. The existing HTML, CSS and media are unchanged.
use crate::ui;
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{HtmlAnchorElement, HtmlButtonElement, HtmlDetailsElement, HtmlVideoElement};
#[derive(Default)]
struct Battle {
    device: String,
    current: Value,
    busy: bool,
    loaded: bool,
    revealed: bool,
    last_good: f64,
    generation: u64,
    toast_timer: Option<i32>,
}
type State = Rc<RefCell<Battle>>;
fn video(side: &str) -> Result<HtmlVideoElement, JsValue> {
    ui::element(&format!("video-{side}"))?
        .dyn_into()
        .map_err(Into::into)
}
fn message(text: &str, error: bool) {
    ui::text("connection", text);
    if let Ok(el) = ui::element("connection") {
        let _ = el.class_list().toggle_with_force("error", error);
    }
    ui::hidden("retry", !error);
}
fn choices(disabled: bool) -> Result<(), JsValue> {
    let nodes = ui::doc()?.query_selector_all("[data-choice]")?;
    for i in 0..nodes.length() {
        if let Some(b) = nodes
            .item(i)
            .and_then(|n| n.dyn_into::<HtmlButtonElement>().ok())
        {
            b.set_disabled(disabled);
        }
    }
    Ok(())
}
fn verdict(data: &Value) -> String {
    data["pick"].as_str().filter(|s| !s.is_empty()).map(|pick|format!("I picked {} without knowing which AI made it 💀 Codex vs Compound, who wins? Vote blind: https://corvus.gent/go/bio-x",pick.to_uppercase())).unwrap_or_default()
}
fn share_links(data: &Value) -> Result<(), JsValue> {
    let text = verdict(data);
    ui::hidden("share-options", text.is_empty());
    if !text.is_empty() {
        let encoded = js_sys::encode_uri_component(&text)
            .as_string()
            .unwrap_or_default();
        ui::element("share-x")?
            .set_attribute("href", &format!("https://x.com/intent/post?text={encoded}"))?;
        ui::element("share-whatsapp")?
            .set_attribute("href", &format!("https://wa.me/?text={encoded}"))?;
    }
    Ok(())
}
fn play(v: HtmlVideoElement, report: bool) {
    spawn_local(async move {
        let failed = match v.play() {
            Ok(p) => JsFuture::from(p).await.is_err(),
            Err(_) => true,
        };
        if failed && report {
            message("Tap the video play button to start.", false);
        }
    });
}
fn render(state: &State, data: Value) -> Result<(), JsValue> {
    let ready = data["ready"] == true;
    let picked = data["pick"].as_str().is_some_and(|s| !s.is_empty());
    let closed = data["closed"] == true;
    let busy = state.borrow().busy;
    message(
        if closed {
            "Voting closed. The judges have spoken."
        } else if picked {
            "Your vote is locked in. Thanks for backing your fighter."
        } else if ready {
            "Both fighters are ready. Watch, then choose."
        } else {
            "Waiting for both videos. Voting opens when both are ready."
        },
        false,
    );
    if ready && !state.borrow().loaded {
        state.borrow_mut().loaded = true;
        for side in ["A", "B"] {
            let v = video(side)?;
            let base = format!("/api/battle?media={side}&device={}", state.borrow().device);
            v.set_poster(&format!("{base}&poster=1"));
            v.set_src(&base);
            // Install once, even if a failed media request is retried.
            if !v.has_attribute("data-rust-media") {
                v.set_attribute("data-rust-media", "")?;
                let target = v.clone();
                ui::listen(v.as_ref(), "loadeddata", move |_| {
                    if let Some(parent) = target.parent_element() {
                        let _ = parent.class_list().add_1("loaded");
                    }
                    play(target.clone(), false);
                })?;
                ui::listen(v.as_ref(), "error", |_| {
                    message("A video could not load. Tap Retry to reconnect.", true)
                })?;
            }
        }
    }
    choices(busy || !ready || picked || closed)?;
    let total = data["total"].as_f64().unwrap_or(0.0);
    let a = if total != 0.0 {
        data["votes"]["codex"].as_f64().unwrap_or(0.0) / total * 100.0
    } else {
        50.0
    };
    for who in ["codex", "compound"] {
        let count = data["votes"][who].as_f64().unwrap_or(0.0);
        ui::text(&format!("score-{who}"), &ui::number(count));
        ui::text(
            &format!("pct-{who}"),
            &if total != 0.0 {
                format!("{}%", (count / total * 100.0).round())
            } else {
                "no votes yet".into()
            },
        );
    }
    let fill = ui::element("tug-fill")?;
    fill.style()
        .set_property("transform", &format!("scaleX({})", a / 100.0))?;
    if let Some(parent) = fill.parent_element() {
        parent.set_attribute(
            "aria-label",
            &format!(
                "Codex {} percent, Compound {} percent",
                if total != 0.0 { a.round() } else { 0.0 },
                if total != 0.0 {
                    (100.0 - a).round()
                } else {
                    0.0
                }
            ),
        )?;
    }
    ui::text(
        "total-votes",
        &format!(
            "{} blind votes · updates every 5 seconds",
            ui::number(total)
        ),
    );
    ui::text("live-label", if closed { "FINAL" } else { "🔴 LIVE" });
    let winner = data["winner"].as_str().unwrap_or("");
    ui::hidden("winner", winner.is_empty());
    ui::text(
        "winner",
        &if winner.is_empty() {
            String::new()
        } else {
            format!("WINNER BY SUBMISSION: {}", winner.to_uppercase())
        },
    );
    if let Some(order) = data["order"].as_array().filter(|a| a.len() == 2) {
        for (i, side) in ["A", "B"].iter().enumerate() {
            ui::text(
                &format!("label-{side}"),
                &format!(
                    "{side} · {}",
                    order[i].as_str().unwrap_or("").to_uppercase()
                ),
            );
        }
        ui::hidden("reveal", false);
        ui::text(
            "reveal-title",
            &if picked {
                format!(
                    "YOU PICKED {}!",
                    data["pick"].as_str().unwrap_or("").to_uppercase()
                )
            } else {
                "THE FIGHTERS, REVEALED.".into()
            },
        );
        ui::text(
            "reveal-detail",
            &format!(
                "VIDEO A WAS… {}! VIDEO B WAS… {}!",
                order[0].as_str().unwrap_or("").to_uppercase(),
                order[1].as_str().unwrap_or("").to_uppercase()
            ),
        );
        share_links(&data)?;
        if picked && !state.borrow().revealed {
            state.borrow_mut().revealed = true;
            ui::element("twist")?
                .dyn_into::<HtmlDetailsElement>()?
                .set_open(true);
            if let Some(w) = web_sys::window()
                && let Ok(Some(storage)) = w.local_storage()
            {
                let _ = storage.set_item("battle.vote", data["pick"].as_str().unwrap_or(""));
            }
        }
    }
    let doc = ui::doc()?;
    let rows = ui::element("platform-rows")?;
    rows.set_text_content(None);
    for platform in ["tiktok", "instagram", "x", "linkedin"] {
        let row = doc.create_element("tr")?;
        let mut values = vec![platform.to_uppercase()];
        for who in ["codex", "compound"] {
            let views = data["views"]
                .as_array()
                .and_then(|a| {
                    a.iter()
                        .find(|v| v["fighter"] == who && v["platform"] == platform)
                })
                .map(|v| ui::number(v["views"].as_f64().unwrap_or(0.0)))
                .unwrap_or_else(|| "—".into());
            values.push(format!(
                "{} / {}",
                views,
                ui::number(
                    data["clicks"][format!("{who}:{platform}")]
                        .as_f64()
                        .unwrap_or(0.0)
                )
            ));
        }
        values.push(ui::number(
            data["clicks"][format!("bio:{platform}")]
                .as_f64()
                .unwrap_or(0.0),
        ));
        for value in values {
            let cell = doc.create_element("td")?;
            cell.set_text_content(Some(&value));
            row.append_child(&cell)?;
        }
        rows.append_child(&row)?;
    }
    ui::text(
        "updated",
        &data["updated"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(|s| format!("Views updated {}.", ui::date(s)))
            .unwrap_or_else(|| "Views have not been reported yet.".into()),
    );
    for who in ["codex", "compound"] {
        if let Some(url) = data["tips"][who]
            .as_str()
            .filter(|s| s.starts_with("https://buy.stripe.com/"))
        {
            let link = ui::element(&format!("tip-{who}"))?.dyn_into::<HtmlAnchorElement>()?;
            link.set_href(url);
            link.set_target("_blank");
            link.set_rel("noopener noreferrer");
            link.set_hidden(false);
        }
    }
    ui::hidden(
        "tip-status",
        !ui::element("tip-codex")?.hidden() && !ui::element("tip-compound")?.hidden(),
    );
    ui::text("disclaimer", data["disclaimer"].as_str().unwrap_or(""));
    if data["order"].is_array()
        && let Some(bonuses) = data["bonuses"].as_array().filter(|a| !a.is_empty())
    {
        let holder = ui::element("bonus-videos")?;
        if holder.child_element_count() == 0 {
            ui::hidden("bonus", false);
            for name in bonuses.iter().filter_map(Value::as_str) {
                let v = doc
                    .create_element("video")?
                    .dyn_into::<HtmlVideoElement>()?;
                v.set_controls(true);
                v.set_attribute("playsinline", "")?;
                v.set_preload("none");
                v.set_src(&format!("/public/battle/{name}.mp4"));
                v.set_poster(&format!("/public/battle/{name}.jpg"));
                v.set_attribute(
                    "aria-label",
                    &format!("Compound bonus {}", name.chars().last().unwrap_or(' ')),
                )?;
                holder.append_child(&v)?;
            }
        }
    }
    let mut s = state.borrow_mut();
    s.current = data;
    s.last_good = js_sys::Date::now();
    Ok(())
}
async fn request(state: &State, body: Option<Value>) -> Result<Value, JsValue> {
    let url = format!("/api/battle?device={}", state.borrow().device);
    let (ok, data) = ui::json(&url, body, None, 10000).await?;
    if !ok {
        return Err(JsValue::from_str(
            data["error"]
                .as_str()
                .unwrap_or("The judges disconnected. Try again."),
        ));
    }
    Ok(data)
}
fn refresh(state: State) {
    if state.borrow().busy || ui::doc().is_ok_and(|d| d.hidden()) {
        return;
    }
    state.borrow_mut().generation += 1;
    let generation = state.borrow().generation;
    spawn_local(async move {
        let result = request(&state, None).await;
        // A delayed GET from before a ballot must never undo its locked-in state.
        if state.borrow().generation != generation {
            return;
        }
        match result {
            Ok(data) => {
                if let Err(e) = render(&state, data) {
                    message(&ui::message(&e), true);
                }
            }
            Err(e) => {
                let last = state.borrow().last_good;
                let prefix = if last > 0.0 {
                    format!(
                        "Scoreboard last updated {}s ago. ",
                        ((js_sys::Date::now() - last) / 1000.0).round()
                    )
                } else {
                    String::new()
                };
                message(&format!("{prefix}{}", ui::message(&e)), true);
            }
        }
    });
}
fn device_id() -> Result<String, JsValue> {
    let w = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
    let storage = w.local_storage().ok().flatten();
    if let Some(id) = storage
        .as_ref()
        .and_then(|s| s.get_item("battle.device").ok().flatten())
        && (16..=64).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Ok(id);
    }
    let id = w.crypto()?.random_uuid();
    if let Some(storage) = storage {
        let _ = storage.set_item("battle.device", &id);
    }
    Ok(id)
}
#[wasm_bindgen]
pub fn start_battle() -> Result<(), JsValue> {
    let root = ui::element("connection")?;
    if root.has_attribute("data-rust-battle") {
        return Ok(());
    }
    root.set_attribute("data-rust-battle", "")?;
    let state = Rc::new(RefCell::new(Battle {
        device: device_id()?,
        ..Battle::default()
    }));
    let doc = ui::doc()?;
    let nodes = doc.query_selector_all("[data-choice]")?;
    for i in 0..nodes.length() {
        if let Some(button) = nodes
            .item(i)
            .and_then(|n| n.dyn_into::<HtmlButtonElement>().ok())
        {
            let choice = button.get_attribute("data-choice").unwrap_or_default();
            let state = state.clone();
            ui::listen(button.as_ref(), "click", move |_| {
                if state.borrow().busy {
                    return;
                }
                {
                    let mut s = state.borrow_mut();
                    s.busy = true;
                    s.generation += 1;
                }
                let _ = choices(true);
                message("Sending your ballot…", false);
                let state = state.clone();
                let choice = choice.clone();
                spawn_local(async move {
                    let body =
                        json!({"action":"vote","device":state.borrow().device,"choice":choice});
                    let result = request(&state, Some(body)).await;
                    state.borrow_mut().busy = false;
                    match result {
                        Ok(data) => {
                            if let Err(e) = render(&state, data) {
                                message(&ui::message(&e), true);
                            }
                            let reduced = web_sys::window()
                                .and_then(|w| {
                                    w.match_media("(prefers-reduced-motion: reduce)")
                                        .ok()
                                        .flatten()
                                })
                                .is_some_and(|m| m.matches());
                            if let Ok(el) = ui::element("reveal") {
                                let options = web_sys::ScrollIntoViewOptions::new();
                                options.set_behavior(if reduced {
                                    web_sys::ScrollBehavior::Instant
                                } else {
                                    web_sys::ScrollBehavior::Smooth
                                });
                                options.set_block(web_sys::ScrollLogicalPosition::Center);
                                el.scroll_into_view_with_scroll_into_view_options(&options);
                            }
                        }
                        Err(e) => {
                            message(&ui::message(&e), true);
                            let s = state.borrow();
                            let _ = choices(
                                s.current["pick"].is_string() || s.current["closed"] == true,
                            );
                        }
                    }
                });
            })?;
        }
    }
    for side in ["A", "B"] {
        if let Some(button) = doc.query_selector(&format!("[data-sound={side}]"))? {
            ui::listen(button.as_ref(), "click", move |_| {
                if let Ok(selected) = video(side) {
                    let unmute = selected.muted();
                    for other in ["A", "B"] {
                        if let Ok(v) = video(other) {
                            v.set_muted(other != side || !unmute);
                            if let Ok(doc) = ui::doc()
                                && let Ok(Some(button)) =
                                    doc.query_selector(&format!("[data-sound={other}]"))
                            {
                                button.set_text_content(Some(&if v.muted() {
                                    format!("🔊 Sound on {other}")
                                } else {
                                    format!("🔇 Mute {other}")
                                }));
                            }
                        }
                    }
                    play(selected, true);
                }
            })?;
        }
    }
    let copy_state = state.clone();
    ui::listen(ui::element("share-copy")?.as_ref(), "click", move |_| {
        let text = verdict(&copy_state.borrow().current);
        if text.is_empty() {
            return;
        }
        if let Some(w) = web_sys::window()
            && let Some(timer) = copy_state.borrow_mut().toast_timer.take()
        {
            w.clear_timeout_with_handle(timer);
        }
        let state = copy_state.clone();
        spawn_local(async move {
            let copied = ui::copy(&text).await;
            ui::text(
                "share-status",
                if copied {
                    "Copied ✅"
                } else {
                    "Copy unavailable. Try Post on X or WhatsApp."
                },
            );
            let callback = Closure::<dyn FnMut()>::new(|| ui::text("share-status", ""));
            if let Some(w) = web_sys::window() {
                state.borrow_mut().toast_timer = w
                    .set_timeout_with_callback_and_timeout_and_arguments_0(
                        callback.as_ref().unchecked_ref(),
                        3000,
                    )
                    .ok();
            }
            callback.forget();
        });
    })?;
    let retry = state.clone();
    ui::listen(ui::element("retry")?.as_ref(), "click", move |_| {
        if ["A", "B"]
            .iter()
            .any(|s| video(s).is_ok_and(|v| v.error().is_some()))
        {
            retry.borrow_mut().loaded = false;
        }
        refresh(retry.clone());
    })?;
    let visible = state.clone();
    ui::listen(doc.as_ref(), "visibilitychange", move |_| {
        refresh(visible.clone())
    })?;
    refresh(state.clone());
    let interval = Closure::<dyn FnMut()>::new(move || refresh(state.clone()));
    if let Some(w) = web_sys::window() {
        w.set_interval_with_callback_and_timeout_and_arguments_0(
            interval.as_ref().unchecked_ref(),
            5000,
        )?;
    }
    interval.forget();
    Ok(())
}
