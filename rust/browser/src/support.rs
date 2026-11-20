use crate::{arrival, ui};
use serde_json::{Value, json};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use wasm_bindgen_futures::{JsFuture, future_to_promise, spawn_local};
use web_sys::{HtmlButtonElement, HtmlFormElement, HtmlInputElement, HtmlSelectElement};
struct Booking {
    proof: Option<(f64, Value)>,
    pending: Option<js_sys::Promise>,
    busy: bool,
    request_id: String,
    source: String,
}
type State = Rc<RefCell<Booking>>;
fn form() -> Result<HtmlFormElement, JsValue> {
    ui::element("call-request")?.dyn_into().map_err(Into::into)
}
fn tier() -> Result<HtmlSelectElement, JsValue> {
    ui::doc()?
        .query_selector("#call-request [name=tier]")?
        .ok_or_else(|| JsValue::from_str("Missing tier"))?
        .dyn_into()
        .map_err(Into::into)
}
fn coffee() -> Result<HtmlInputElement, JsValue> {
    ui::doc()?
        .query_selector("[name=coffeePaid][form=call-request]")?
        .ok_or_else(|| JsValue::from_str("Missing coffee checkbox"))?
        .dyn_into()
        .map_err(Into::into)
}
fn submit_button() -> Result<HtmlButtonElement, JsValue> {
    form()?
        .query_selector("[type=submit]")?
        .ok_or_else(|| JsValue::from_str("Missing submit button"))?
        .dyn_into()
        .map_err(Into::into)
}
fn sync_tier() -> Result<(), JsValue> {
    let paid = tier()?.value() != "quick";
    ui::hidden("call-coffee-step", !paid);
    let coffee = coffee()?;
    coffee.set_required(paid);
    if !paid {
        coffee.set_checked(false);
    }
    Ok(())
}
async fn prepare(state: State) -> Result<Value, JsValue> {
    if let Some((at, proof)) = &state.borrow().proof
        && js_sys::Date::now() - at < 1_500_000.0
    {
        return Ok(proof.clone());
    }
    let existing = state.borrow().pending.clone();
    let pending = if let Some(p) = existing {
        p
    } else {
        let inner = state.clone();
        let p = future_to_promise(async move {
            let (ok, data) = ui::json(
                "/api/support",
                Some(json!({"action":"challenge"})),
                None,
                8000,
            )
            .await?;
            if !ok {
                return Err(JsValue::from_str(
                    data["error"].as_str().unwrap_or("Please try again."),
                ));
            }
            inner.borrow_mut().proof = Some((js_sys::Date::now(), data.clone()));
            Ok(JsValue::from_str(&data.to_string()))
        });
        state.borrow_mut().pending = Some(p.clone());
        p
    };
    let result = JsFuture::from(pending).await;
    state.borrow_mut().pending = None;
    let result = result?
        .as_string()
        .ok_or_else(|| JsValue::from_str("Invalid challenge"))?;
    serde_json::from_str(&result).map_err(|_| JsValue::from_str("Invalid challenge"))
}
fn warm(state: State) {
    spawn_local(async move {
        let _ = prepare(state).await;
    });
}
async fn send(state: State) -> Result<(), JsValue> {
    let ch = prepare(state.clone()).await?;
    ui::sleep((ch["notBefore"].as_f64().unwrap_or(0.0) - js_sys::Date::now()).max(0.0) as i32)
        .await?;
    let fields = web_sys::FormData::new_with_form(&form()?)?;
    let mut body = serde_json::Map::new();
    for entry in js_sys::try_iter(&fields)?.into_iter().flatten() {
        let pair = js_sys::Array::from(&entry?);
        if let (Some(k), Some(v)) = (pair.get(0).as_string(), pair.get(1).as_string()) {
            body.insert(k, json!(v));
        }
    }
    body.insert("coffeePaid".into(), json!(coffee()?.checked()));
    body.insert("source".into(), json!(state.borrow().source));
    body.insert("requestId".into(), json!(state.borrow().request_id));
    body.insert("challenge".into(), ch["token"].clone());
    let (ok, data) = ui::json("/api/support", Some(Value::Object(body)), None, 18000).await?;
    if !ok || data["ok"] != true {
        let retry = data["retryAfter"]
            .as_i64()
            .filter(|v| *v != 0)
            .map(|v| format!(" Try again in {v} seconds."))
            .unwrap_or_default();
        return Err(JsValue::from_str(&format!(
            "{}{retry}",
            data["error"].as_str().unwrap_or("Please try again.")
        )));
    }
    ui::hidden("call-request", true);
    ui::hidden("call-coffee-step", true);
    ui::hidden("call-success", false);
    ui::scroll("call-success", true, true);
    Ok(())
}
#[wasm_bindgen]
pub fn start_support() -> Result<(), JsValue> {
    let doc = ui::doc()?;
    let w = web_sys::window().ok_or_else(|| JsValue::from_str("No window"))?;
    let tags =
        url::form_urlencoded::parse(arrival::arrival_search().trim_start_matches('?').as_bytes())
            .into_owned()
            .collect::<Vec<_>>();
    let source = tags
        .iter()
        .find(|(k, _)| k == "utm_source")
        .map(|(_, s)| s.as_str())
        .filter(|s| matches!(*s, "linkedin" | "x"))
        .unwrap_or("direct")
        .to_string();
    let from_support =
        url::form_urlencoded::parse(w.location().search()?.trim_start_matches('?').as_bytes())
            .find(|(k, _)| k == "from")
            .is_some_and(|(_, v)| v == "support");
    ui::hidden("support-roll", !from_support);
    let links = doc.query_selector_all("[data-support-step]")?;
    for i in 0..links.length() {
        if let Some(link) = links
            .item(i)
            .and_then(|n| n.dyn_into::<web_sys::HtmlAnchorElement>().ok())
            && let Ok(mut url) = url::Url::parse(&link.href())
        {
            let pairs = url
                .query_pairs()
                .filter(|(k, _)| k != "source")
                .map(|(k, v)| (k.into_owned(), v.into_owned()))
                .collect::<Vec<_>>();
            url.query_pairs_mut()
                .clear()
                .extend_pairs(pairs)
                .append_pair("source", &source);
            link.set_href(&format!("{}?{}", url.path(), url.query().unwrap_or("")));
        }
    }
    let Ok(form_el) = form() else {
        return Ok(());
    };
    if form_el.has_attribute("data-rust-support") {
        return Ok(());
    }
    form_el.set_attribute("data-rust-support", "")?;
    spawn_local(async {
        if let Ok((true, c)) = ui::json("/api/support", None, None, 6000).await
            && let Ok(doc) = ui::doc()
            && let Ok(Some(el)) = doc.query_selector("[data-support-spots]")
        {
            el.set_text_content(Some(&format!(
                "{}/{} spots this week",
                c["spotsThisWeek"], c["weeklyCapacity"]
            )));
        }
    });
    let state = Rc::new(RefCell::new(Booking {
        proof: None,
        pending: None,
        busy: false,
        request_id: w.crypto()?.random_uuid(),
        source,
    }));
    ui::listen(tier()?.as_ref(), "change", |_| {
        let _ = sync_tier();
    })?;
    sync_tier()?;
    let s = state.clone();
    ui::listen(form_el.as_ref(), "focusin", move |_| warm(s.clone()))?;
    let buttons = doc.query_selector_all("[data-call-tier]")?;
    for i in 0..buttons.length() {
        if let Some(button) = buttons
            .item(i)
            .and_then(|n| n.dyn_into::<web_sys::Element>().ok())
        {
            let value = button.get_attribute("data-call-tier").unwrap_or_default();
            let s = state.clone();
            ui::listen(button.as_ref(), "click", move |_| {
                if let Ok(t) = tier() {
                    t.set_value(&value);
                    let _ = sync_tier();
                    warm(s.clone());
                    let reduce = web_sys::window()
                        .and_then(|w| {
                            w.match_media("(prefers-reduced-motion: reduce)")
                                .ok()
                                .flatten()
                        })
                        .is_some_and(|m| m.matches());
                    ui::scroll("booking", !reduce, false);
                }
            })?;
        }
    }
    let s = state.clone();
    ui::listen(form_el.as_ref(), "submit", move |event| {
        event.prevent_default();
        if s.borrow().busy || form().map_or(true, |f| !f.report_validity()) {
            return;
        }
        s.borrow_mut().busy = true;
        if let Ok(button) = submit_button() {
            button.set_disabled(true);
        }
        ui::text("call-form-status", "sending your headache…");
        let state = s.clone();
        spawn_local(async move {
            if let Err(e) = send(state.clone()).await {
                let timed_out = js_sys::Reflect::get(&e, &JsValue::from_str("name"))
                    .ok()
                    .and_then(|v| v.as_string())
                    .is_some_and(|s| s == "TimeoutError");
                ui::text(
                    "call-form-status",
                    &if timed_out {
                        "The connection took too long. Retry safely; your request will not be duplicated.".into()
                    } else {
                        ui::message(&e)
                    },
                );
            }
            state.borrow_mut().busy = false;
            if let Ok(button) = submit_button() {
                button.set_disabled(false);
            }
        });
    })?;
    Ok(())
}
