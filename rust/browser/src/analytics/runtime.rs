use super::*;
use crate::{arrival, consent, site};
use wasm_bindgen_futures::{JsFuture, future_to_promise, spawn_local};
#[derive(Default)]
struct State {
    installed: bool,
    started: bool,
    stopped: bool,
    controller: Option<web_sys::AbortController>,
    client: Option<JsValue>,
    pageview: bool,
    bare: bool,
    notice: bool,
    pending: Vec<Value>,
    cleanup: i32,
    delay: i32,
}
thread_local! {static STATE:RefCell<State>=RefCell::new(State::default());}
fn win() -> Result<web_sys::Window, JsValue> {
    web_sys::window().ok_or(JsValue::NULL)
}
fn reflect(v: &JsValue, key: &str) -> JsValue {
    js_sys::Reflect::get(v, &key.into()).unwrap_or(JsValue::UNDEFINED)
}
fn method(v: &JsValue, key: &str, args: &js_sys::Array) -> Result<JsValue, JsValue> {
    reflect(v, key)
        .dyn_into::<js_sys::Function>()?
        .apply(v, args)
}
fn capture(ph: &JsValue, event: &str, props: &Value) {
    let _ = method(
        ph,
        "capture",
        &js_sys::Array::of2(&event.into(), &js(props).unwrap_or(JsValue::UNDEFINED)),
    );
}
fn clear() {
    site::cancel(STATE.with_borrow_mut(|s| std::mem::take(&mut s.cleanup)));
    arrival::clear_tracking_url();
}
fn bare() {
    if STATE.with_borrow(|s| s.bare || s.pageview) {
        return;
    }
    STATE.with_borrow_mut(|s| s.bare = true);
    let _ = (|| -> Result<(), JsValue> {
        let w = win()?;
        let opts = js(&json!({"timeZone":"Europe/Brussels"}))?.dyn_into::<js_sys::Object>()?;
        let day = js_sys::Intl::DateTimeFormat::new(&js_sys::Array::of1(&"sv-SE".into()), &opts)
            .format()
            .call1(&JsValue::UNDEFINED, &js_sys::Date::new_0())?;
        let request = web_sys::RequestInit::new();
        request.set_method("POST");
        request.set_credentials(web_sys::RequestCredentials::Omit);
        request.set_referrer_policy(web_sys::ReferrerPolicy::NoReferrer);
        js_sys::Reflect::set(&request, &"keepalive".into(), &true.into())?;
        request.set_body(
            &json!({"page":policy::path(&json!(w.location().pathname()?)),"day":day.as_string()})
                .to_string()
                .into(),
        );
        let request = web_sys::Request::new_with_str_and_init("/api/hit", &request)?;
        request.headers().set("Content-Type", "application/json")?;
        spawn_local(async move {
            let _ = JsFuture::from(w.fetch_with_request(&request)).await;
        });
        Ok(())
    })();
}
fn action(e: web_sys::Event, family: &str) {
    if !consent::analytics_allowed() {
        return;
    }
    let Some(e) = e.dyn_ref::<web_sys::CustomEvent>() else {
        return;
    };
    let detail = value(&e.detail());
    let name = detail["event"].as_str().unwrap_or("");
    let names = match family {
        "world" => &[
            "visit",
            "play",
            "vote",
            "comment",
            "like",
            "share",
            "reward_revealed",
        ][..],
        "hack" => &[
            "hack_live_click",
            "hack_robots_click",
            "hack_compound_click",
        ][..],
        _ => &["sidequests_cta_click", "sidequests_share"][..],
    };
    if !names.contains(&name) {
        return;
    }
    let client = STATE.with_borrow(|s| s.client.clone());
    if let Some(ph) = client {
        capture(&ph, name, &detail["props"]);
    } else {
        STATE.with_borrow_mut(|s| {
            if s.pending.len() < if family == "world" { 64 } else { 12 } {
                s.pending.push(detail);
            }
        });
    }
}
async fn get(url: &str, ms: u32, omit: bool) -> Value {
    let result = async {
        let options = web_sys::RequestInit::new();
        options.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(ms)));
        options.set_credentials(if omit {
            web_sys::RequestCredentials::Omit
        } else {
            web_sys::RequestCredentials::SameOrigin
        });
        if !omit {
            options.set_cache(web_sys::RequestCache::NoStore);
        }
        let req = web_sys::Request::new_with_str_and_init(url, &options)?;
        let r = JsFuture::from(win()?.fetch_with_request(&req))
            .await?
            .dyn_into::<web_sys::Response>()?;
        if !r.ok() {
            return Err(JsValue::NULL);
        }
        Ok(value(&JsFuture::from(r.json()?).await?))
    }
    .await;
    result.unwrap_or(Value::Null)
}
fn query(search: &str) -> Value {
    let mut q = json!({});
    for (k, v) in url::form_urlencoded::parse(search.trim_start_matches('?').as_bytes()) {
        if q.get(&*k).is_none() {
            q[&*k] = json!(v);
        }
    }
    q
}
fn loaded(ph: JsValue, geo: &Value, attribution: &Value, x: &Value, inferred: &Value) {
    if !consent::analytics_allowed() || STATE.with_borrow(|s| s.stopped) {
        clear();
        return;
    }
    let _ = (|| -> Result<(), JsValue> {
        let mut props = json!({"utm_source":inferred["source"],"source_confidence":inferred["source_confidence"]});
        if let Some(a) = attribution.as_object() {
            props.as_object_mut().unwrap().extend(a.clone());
        }
        let w = win()?;
        if let Some(p) = value(&reflect(&w, "__phProps")).as_object() {
            props.as_object_mut().unwrap().extend(p.clone());
        }
        let q = query(&arrival::arrival_search());
        if q.get("utm_source").is_some() {
            props["utm_source"] = policy::source(&q["utm_source"]);
        }
        for key in ["utm_campaign", "utm_content", "utm_term", "utm_medium"] {
            if let Some(v) = q.get(key) {
                props[key] = v.clone();
            }
        }
        if corvus_core::army::truthy(&x["content"]) {
            props["utm_content"] = x["content"].clone();
        }
        if geo["countryCode"]
            .as_str()
            .is_some_and(|s| s.len() == 2 && s.bytes().all(|b| b.is_ascii_uppercase()))
        {
            props["corvus_country_code"] = geo["countryCode"].clone();
        }
        if corvus_core::army::truthy(&geo["region"]) {
            props["corvus_region"] = geo["region"].clone();
        }
        if corvus_core::army::truthy(&geo["city"]) {
            for (k, source) in [
                ("corvus_city", "city"),
                ("corvus_region", "region"),
                ("corvus_latitude", "lat"),
                ("corvus_longitude", "lng"),
            ] {
                if let Some(v) = geo.get(source) {
                    props[k] = v.clone();
                }
            }
        }
        let path = w.location().pathname()?;
        if ["hack", "compound"].contains(&path.split('/').nth(1).unwrap_or("")) {
            props["utm_campaign"] = q["utm_campaign"]
                .as_str()
                .filter(|s| !s.is_empty())
                .map(|s| json!(s))
                .unwrap_or(json!(if path.starts_with("/hack") {
                    "hack"
                } else {
                    "compound-1000"
                }));
            if path.starts_with("/hack/")
                && let Some(id) = path
                    .split('/')
                    .nth(2)
                    .filter(|s| !s.starts_with('0') && s.bytes().all(|b| b.is_ascii_digit()))
                    .and_then(|s| s.parse::<u64>().ok())
            {
                props["hack_id"] = json!(id);
            }
        }
        if arrival::sidequests_page()
            && corvus_core::army::truthy(&attribution["utm_source"])
            && let Some(a) = attribution.as_object()
        {
            props.as_object_mut().unwrap().extend(a.clone());
        }
        method(&ph, "register", &js_sys::Array::of1(&js(&props)?))?;
        capture(&ph, "$pageview", &json!({}));
        let (notice, pending) = STATE.with_borrow_mut(|s| {
            s.pageview = true;
            s.client = Some(ph.clone());
            (
                std::mem::take(&mut s.notice),
                std::mem::take(&mut s.pending),
            )
        });
        if notice {
            capture(&ph, "notice_ok", &json!({}));
        }
        for a in pending {
            if let Some(event) = a["event"].as_str() {
                capture(&ph, event, &a["props"]);
            }
        }
        clear();
        Ok(())
    })();
}
fn initialize(
    geo: Value,
    catalog: Value,
    attribution: Value,
    x: Value,
    inferred: Value,
) -> Result<(), JsValue> {
    set_x_campaigns(js(&catalog["campaigns"])?);
    if !consent::analytics_allowed() || STATE.with_borrow(|s| s.stopped) {
        clear();
        return Ok(());
    }
    let w = win()?;
    let ph = reflect(&w, "posthog");
    if !reflect(&ph, "init").is_function() {
        clear();
        return Ok(());
    }
    let options = js(
        &json!({"api_host":"https://eu.i.posthog.com","cookieless_mode":"always","person_profiles":"never","persistence":"memory","disable_persistence":true,"ip":false,"respect_dnt":true,"debug":false,"autocapture":false,"capture_pageview":false,"capture_pageleave":false,"capture_heatmaps":false,"capture_performance":false,"capture_dead_clicks":false,"rageclick":false,"disable_session_recording":true,"session_recording":{"maskAllInputs":true,"maskTextSelector":"*"},"mask_all_text":true,"mask_all_element_attributes":true,"mask_personal_data_properties":true,"disableDeviceModel":true,"disable_surveys":true,"disable_conversations":true,"disable_product_tours":true,"disable_web_experiments":true,"disable_external_dependency_loading":true,"advanced_disable_flags":true,"advanced_disable_feature_flags":true,"enable_recording_console_log":false,"capture_exceptions":false,"save_campaign_params":false,"save_referrer":false,"request_batching":false,"disable_compression":true,"api_transport":"fetch","disable_beacon":true,"fetch_options":{"credentials":"omit","keepalive":arrival::sidequests_page(),"referrerPolicy":"no-referrer"}}),
    )?;
    let signal = STATE.with_borrow(|s| s.controller.as_ref().map(|c| c.signal()));
    if let Some(signal) = signal {
        js_sys::Reflect::set(
            &reflect(&options, "fetch_options"),
            &"signal".into(),
            &signal,
        )?;
    }
    let before = Closure::<dyn FnMut(JsValue) -> JsValue>::new(|e| {
        if consent::analytics_allowed() {
            analytics_privacy_event(e).unwrap_or(JsValue::NULL)
        } else {
            JsValue::NULL
        }
    });
    js_sys::Reflect::set(&options, &"before_send".into(), before.as_ref())?;
    before.forget();
    let onload =
        Closure::<dyn FnMut(JsValue)>::new(move |ph| loaded(ph, &geo, &attribution, &x, &inferred));
    js_sys::Reflect::set(&options, &"loaded".into(), onload.as_ref())?;
    onload.forget();
    method(
        &ph,
        "init",
        &js_sys::Array::of2(
            &"phc_tqJYxREMXWjzQusx6xNPuEa2fNCzKmVpAURSHKnVbpro".into(),
            &options,
        ),
    )?;
    Ok(())
}
fn start() -> Result<(), JsValue> {
    let w = win()?;
    let attribution = value(&quest_tags()?);
    let x = policy::x_context(&w.location().pathname()?, &arrival::arrival_search());
    let inferred = corvus_core::attribution::inferred(
        &arrival::arrival_search(),
        &w.navigator().user_agent()?,
        &ui::doc()?.referrer(),
    );
    let catalog = if x.is_null() {
        js_sys::Promise::resolve(&JsValue::NULL)
    } else {
        future_to_promise(async { js(&get("/api/x-stats?catalog=1", 3000, true).await) })
    };
    let country = future_to_promise(async { js(&get("/api/geo?country=1", 2000, false).await) });
    STATE.with_borrow_mut(|s| {
        s.cleanup = site::later(5000, arrival::clear_tracking_url).unwrap_or(0)
    });
    let script = ui::doc()?.create_element("script")?;
    script.set_attribute("src", "/js/vendor/posthog-1.445.3.min.js")?;
    script.set_attribute("async", "")?;
    ui::listen(&script.clone().into(), "error", move |_| {
        clear();
        bare();
    })?;
    ui::listen(&script.clone().into(), "load", move |_| {
        let all = js_sys::Promise::all(&js_sys::Array::of2(&country, &catalog));
        let attribution = attribution.clone();
        let x = x.clone();
        let inferred = inferred.clone();
        spawn_local(async move {
            if let Ok(v) = JsFuture::from(all).await {
                let array = js_sys::Array::from(&v);
                let _ = initialize(
                    value(&array.get(0)),
                    value(&array.get(1)),
                    attribution,
                    x,
                    inferred,
                );
            }
        });
    })?;
    ui::doc()?
        .query_selector("head")?
        .ok_or(JsValue::NULL)?
        .append_child(&script)?;
    Ok(())
}
fn sync() {
    site::cancel(STATE.with_borrow_mut(|s| std::mem::take(&mut s.delay)));
    if !consent::analytics_allowed() {
        STATE.with_borrow_mut(|s| {
            s.pending.clear();
            s.notice = false;
            s.client = None;
        });
        let _ = quest_tags();
        bare();
        if arrival::sidequests_page()
            && consent::consent_choice().is_null()
            && !consent::privacy_signal()
        {
            STATE.with_borrow_mut(|s| {
                s.delay = site::later(5500, arrival::clear_tracking_url).unwrap_or(0)
            });
        } else {
            arrival::clear_tracking_url();
        }
        if STATE.with_borrow(|s| s.started) {
            STATE.with_borrow_mut(|s| {
                s.stopped = true;
                if let Some(c) = &s.controller {
                    c.abort();
                }
            });
            if let Ok(w) = win() {
                let ph = reflect(&w, "posthog");
                let reject = Closure::<dyn FnMut(JsValue) -> JsValue>::new(|_| JsValue::NULL);
                let options = js_sys::Object::new();
                let _ = js_sys::Reflect::set(&options, &"before_send".into(), reject.as_ref());
                let _ = method(&ph, "set_config", &js_sys::Array::of1(&options));
                reject.forget();
                let _ = method(&ph, "shutdown", &js_sys::Array::new());
            }
        }
        return;
    }
    if STATE.with_borrow(|s| s.stopped) {
        if let Ok(w) = win() {
            let _ = w.location().reload();
        }
        return;
    }
    if STATE.with_borrow(|s| s.started) {
        return;
    }
    let Ok(controller) = web_sys::AbortController::new() else {
        return;
    };
    STATE.with_borrow_mut(|s| {
        s.started = true;
        s.controller = Some(controller);
    });
    let _ = start();
}
pub(super) fn install() -> Result<(), JsValue> {
    if STATE.with_borrow_mut(|s| std::mem::replace(&mut s.installed, true)) {
        return Ok(());
    }
    let w = win()?;
    let path = w.location().pathname()?;
    crate::site::start_performance()?;
    start_outbound()?;
    if path == "/links" || path.starts_with("/links/") {
        js_sys::Reflect::set(
            &w,
            &"__phProps".into(),
            &js(&policy::link_context(&path, &arrival::arrival_search()))?,
        )?;
    }
    let is_private = path == "/army/access"
        || path.starts_with("/army/access/")
        || path == "/private"
        || path.starts_with("/private/")
        || path == "/stats/private"
        || path.starts_with("/stats/private/")
        || path == "/music/admin"
        || path.starts_with("/music/admin/");
    if is_private {
        arrival::clear_tracking_url();
        return Ok(());
    }
    if arrival::sidequests_page() {
        ui::listen(&w.clone().into(), "quest-action", move |e| {
            action(e, "quest")
        })?;
    }
    ui::listen(&w.clone().into(), "worldcraft-action", move |e| {
        action(e, "world")
    })?;
    js_sys::Reflect::set(&w, &"__worldcraftAnalyticsReady".into(), &true.into())?;
    let queue = reflect(&w, "__worldcraftAnalyticsQueue");
    if js_sys::Array::is_array(&queue) {
        for detail in js_sys::Array::from(&queue).iter() {
            let opts = web_sys::CustomEventInit::new();
            opts.set_detail(&detail);
            action(
                web_sys::CustomEvent::new_with_event_init_dict("worldcraft-action", &opts)?.into(),
                "world",
            );
        }
    }
    js_sys::Reflect::set(
        &w,
        &"__worldcraftAnalyticsQueue".into(),
        &js_sys::Array::new(),
    )?;
    ui::listen(&w.clone().into(), "hack-action", move |e| action(e, "hack"))?;
    ui::listen(&w.clone().into(), "notice-ok", move |_| {
        if consent::analytics_allowed() {
            if let Some(ph) = STATE.with_borrow(|s| s.client.clone()) {
                capture(&ph, "notice_ok", &json!({}));
            } else {
                STATE.with_borrow_mut(|s| s.notice = true);
            }
        }
    })?;
    ui::listen(&w.into(), "analytics-consent-change", move |_| sync())?;
    sync();
    ui::listen(&ui::doc()?.into(), "click", move |e| {
        if !consent::analytics_allowed() {
            return;
        }
        if let Some(a) = e
            .target()
            .and_then(|e| e.dyn_into::<web_sys::Element>().ok())
            .and_then(|e| e.closest("a").ok().flatten())
            && let Ok(w) = win()
        {
            let ph = reflect(&w, "posthog");
            let url = web_sys::Url::new_with_base(
                &a.get_attribute("href").unwrap_or_default(),
                &w.location().href().unwrap_or_default(),
            )
            .ok();
            capture(
                &ph,
                "link_click",
                &json!({"link_href":policy::safe_url(url.map(|u|json!(u.href())).as_ref(),"https://corvus.gent"),"page":policy::path(&json!(w.location().pathname().unwrap_or_default()))}),
            );
        }
    })?;
    Ok(())
}
