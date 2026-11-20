use super::*;
use sha2::{Digest, Sha256};
use std::{collections::HashMap, future::Future};
use wasm_bindgen_futures::future_to_promise;
thread_local! {static PROOFS:RefCell<HashMap<String,(f64,js_sys::Promise)>>=RefCell::new(HashMap::new());}
pub(super) async fn api(body: Option<Value>, query: &str) -> Result<Value, JsValue> {
    let o = web_sys::RequestInit::new();
    o.set_method(if body.is_some() { "POST" } else { "GET" });
    o.set_credentials(web_sys::RequestCredentials::SameOrigin);
    o.set_cache(web_sys::RequestCache::NoStore);
    o.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(18000)));
    if let Some(b) = &body {
        o.set_body(&b.to_string().into());
    }
    let req = web_sys::Request::new_with_str_and_init(&format!("/api/army{query}"), &o)?;
    if body.is_some() {
        req.headers().set("Content-Type", "application/json")?;
    }
    let r = JsFuture::from(
        web_sys::window()
            .ok_or(JsValue::NULL)?
            .fetch_with_request(&req),
    )
    .await?
    .dyn_into::<web_sys::Response>()?;
    let raw = JsFuture::from(r.text()?)
        .await?
        .as_string()
        .unwrap_or_default();
    let v: Value = serde_json::from_str(&raw).map_err(|_| JsValue::from_str("resting"))?;
    if !r.ok() {
        let e = js_sys::Error::new(v["error"].as_str().unwrap_or("resting"));
        js_sys::Reflect::set(&e, &"status".into(), &r.status().into())?;
        return Err(e.into());
    }
    Ok(v)
}
pub(super) fn error(e: &JsValue) -> String {
    let s = ui::message(e);
    t(match s.as_str() {
        "rate" | "unavailable_name_or_email" | "expired" | "resting" => &s,
        "already_enlisted" | "login" => "already",
        _ => "fields",
    })
}
async fn proof(action: &str) -> Result<Value, JsValue> {
    let d = api(Some(json!({"action":"challenge","for":action})), "").await?;
    let c = &d["challenge"];
    let salt = c["salt"]
        .as_str()
        .ok_or_else(|| JsValue::from_str("verification"))?;
    let bits = c["bits"]
        .as_u64()
        .filter(|n| *n <= 32)
        .ok_or_else(|| JsValue::from_str("verification"))? as u32;
    let start = js_sys::Date::now();
    let mut found = None;
    for nonce in 0..20_000_000u32 {
        let hash = Sha256::digest(format!("{salt}:{nonce}").as_bytes());
        let zeros = hash
            .iter()
            .map(|b| b.leading_zeros())
            .scan(false, |done, n| {
                if *done {
                    None
                } else {
                    *done = n < 8;
                    Some(n)
                }
            })
            .sum::<u32>();
        if zeros >= bits {
            found = Some(nonce);
            break;
        }
        if nonce % 1024 == 1023 {
            if js_sys::Date::now() - start > 90000.0 {
                return Err("verification".into());
            }
            ui::sleep(1).await?;
        }
    }
    let nonce = found.ok_or_else(|| JsValue::from_str("verification"))?;
    let wait = c["notBefore"].as_f64().unwrap_or(0.0) - js_sys::Date::now() + 80.0;
    if wait > 0.0 {
        ui::sleep(wait.min(300_000.0) as i32).await?;
    }
    Ok(json!({"challenge":c["id"],"nonce":nonce}))
}
pub(super) async fn prepare(action: &str) -> Result<Value, JsValue> {
    let now = js_sys::Date::now();
    let cached = PROOFS.with_borrow(|m| {
        m.get(action)
            .filter(|(at, _)| now - at < 240000.0)
            .map(|(_, p)| p.clone())
    });
    let p = if let Some(p) = cached {
        p
    } else {
        let a = action.to_owned();
        let p = future_to_promise(async move { js(&proof(&a).await?) });
        PROOFS.with_borrow_mut(|m| {
            m.insert(action.into(), (now, p.clone()));
        });
        p
    };
    let r = JsFuture::from(p.clone()).await.and_then(|v| val(&v));
    if r.is_err() {
        PROOFS.with_borrow_mut(|m| {
            if m.get(action)
                .is_some_and(|(_, old)| js_sys::Object::is(old, &p))
            {
                m.remove(action);
            }
        });
    }
    r
}
pub(super) async fn submit(action: &str, mut body: Value) -> Result<Value, JsValue> {
    let result = async {
        let p = prepare(action).await?;
        body["lang"] = json!(language::get_language());
        body["action"] = json!(action);
        body["challenge"] = p["challenge"].clone();
        body["nonce"] = p["nonce"].clone();
        api(Some(body), "").await
    }
    .await;
    PROOFS.with_borrow_mut(|m| {
        m.remove(action);
    });
    result
}
#[wasm_bindgen]
pub async fn army_submit(action: String, body: JsValue) -> Result<JsValue, JsValue> {
    let b = val(&body)?;
    if !b.is_object() {
        return Err("fields".into());
    }
    js(&submit(&action, b).await?)
}
pub(super) fn fields(form: &HtmlFormElement) -> Result<Value, JsValue> {
    let data = web_sys::FormData::new_with_form(form)?;
    let mut v = json!({});
    for e in js_sys::try_iter(&data)?.into_iter().flatten() {
        let pair = js_sys::Array::from(&e?);
        if let (Some(k), Some(s)) = (pair.get(0).as_string(), pair.get(1).as_string()) {
            v[k] = json!(s);
        }
    }
    Ok(v)
}
pub(super) fn tidy(f: &HtmlFormElement) -> Result<(), JsValue> {
    if let Ok(e) = query(f.as_ref(), "input[name=username]") {
        let e2 = e.clone().dyn_into::<HtmlInputElement>()?;
        ui::listen(e.as_ref(), "input", move |_| {
            let s = e2.value();
            let s = regex::Regex::new(r"\s+")
                .expect("fixed pattern")
                .replace_all(s.trim_start_matches('@'), "_")
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
                .take(24)
                .collect::<String>()
                .to_ascii_lowercase();
            if s != e2.value() {
                e2.set_value(&s);
            }
        })?;
    }
    if let Ok(e) = query(f.as_ref(), "input[name=link]") {
        let e2 = e.clone().dyn_into::<HtmlInputElement>()?;
        ui::listen(e.as_ref(), "blur", move |_| {
            let s = e2.value().trim().to_owned();
            if !s.is_empty()
                && !regex::Regex::new(r"(?i)^[a-z][a-z0-9+.-]*://")
                    .expect("fixed pattern")
                    .is_match(&s)
            {
                e2.set_value(&format!("https://{}", s.trim_start_matches('/')));
            }
        })?;
    }
    Ok(())
}
pub(super) fn wire<F, Fut>(
    id: &str,
    action: &'static str,
    status: &'static str,
    done: F,
) -> Result<(), JsValue>
where
    F: Fn(Value) -> Fut + 'static,
    Fut: Future<Output = Result<(), JsValue>> + 'static,
{
    let f = form(id)?;
    tidy(&f)?;
    let warm = Rc::new(std::cell::Cell::new(false));
    ui::listen(f.as_ref(), "focusin", move |_| {
        if !warm.replace(true) {
            spawn_local(async move {
                let _ = prepare(action).await;
            });
        }
    })?;
    let f2 = f.clone();
    let done = Rc::new(done);
    ui::listen(f.as_ref(), "submit", move |e| {
        e.prevent_default();
        if !f2.report_validity() {
            return;
        }
        let Ok(b) = query(f2.as_ref(), "button[type=submit],button:not([type])") else {
            return;
        };
        if b.has_attribute("disabled") {
            return;
        }
        disabled(&b, true);
        ui::text(status, &t("proof"));
        let f = f2.clone();
        let done = done.clone();
        spawn_local(async move {
            let r = async {
                let v = submit(action, fields(&f)?).await?;
                done(v).await
            }
            .await;
            if let Err(e) = r {
                ui::text(status, &error(&e));
            }
            disabled(&b, false);
        });
    })
}
pub(super) fn recruit(code: &str) -> String {
    format!("https://corvus.gent/r/{code}")
}
pub(super) async fn copy(code: &str, status: &str) {
    let url = recruit(code);
    ui::text(
        status,
        &if ui::copy(&url).await {
            t("copied")
        } else {
            url
        },
    );
}
pub(super) async fn share(code: &str, status: &str) {
    let url = recruit(code);
    let r = async {
        let nav = web_sys::window().ok_or(JsValue::NULL)?.navigator();
        if let Ok(f) = js_sys::Reflect::get(&nav, &"share".into())?.dyn_into::<js_sys::Function>() {
            let v = json!({"title":"corvus","text":t("shareTag").replacen(" ↗","",1),"url":url});
            JsFuture::from(js_sys::Promise::resolve(&f.call1(&nav, &js(&v)?)?)).await?;
        } else {
            copy(code, status).await;
        }
        Ok::<(), JsValue>(())
    }
    .await;
    if let Err(e) = r {
        let name = js_sys::Reflect::get(&e, &"name".into())
            .ok()
            .and_then(|s| s.as_string());
        if name.as_deref() != Some("AbortError") {
            ui::text(status, &url);
        }
    }
}
pub(super) fn tag(id: &str, s: &Value, code: &str) -> Result<(), JsValue> {
    let l = json!({"rankLabel":t("rankLabel"),"tierLabel":t("tierLabel"),"supporterLifetime":t("supporterLifetime")});
    ui::element(id)?.set_inner_html(
        &corvus_core::army_art::tag(s, code, false, &l).map_err(JsValue::from_str)?,
    );
    Ok(())
}
pub(super) fn download(blob: &web_sys::Blob, name: &str) -> Result<(), JsValue> {
    let url = web_sys::Url::create_object_url_with_blob(blob)?;
    let a = ui::doc()?
        .create_element("a")?
        .dyn_into::<web_sys::HtmlAnchorElement>()?;
    a.set_href(&url);
    a.set_download(name);
    a.click();
    spawn_local(async move {
        let _ = ui::sleep(1000).await;
        let _ = web_sys::Url::revoke_object_url(&url);
    });
    Ok(())
}
pub(super) fn blob(bytes: &str, mime: &str) -> Result<web_sys::Blob, JsValue> {
    let a = js_sys::Array::new();
    a.push(&bytes.into());
    let opts = web_sys::BlobPropertyBag::new();
    opts.set_type(mime);
    web_sys::Blob::new_with_str_sequence_and_options(&a, &opts)
}
pub(super) async fn save_art(s: &Value, code: &str, poster: bool, status: &str) {
    let r=async{let l=json!({"rankLabel":t("rankLabel"),"tierLabel":t("tierLabel"),"supporterLifetime":t("supporterLifetime")});let svg=corvus_core::army_art::tag(s,code,poster,&l).map_err(JsValue::from_str)?;let url=web_sys::Url::create_object_url_with_blob(&blob(&svg,"image/svg+xml")?)?;let result=async{let img=web_sys::HtmlImageElement::new()?;img.set_src(&url);JsFuture::from(img.decode()).await?;let c=ui::doc()?.create_element("canvas")?.dyn_into::<web_sys::HtmlCanvasElement>()?;c.set_width(if poster{1080}else{1200});c.set_height(if poster{1350}else{630});c.get_context("2d")?.ok_or(JsValue::NULL)?.dyn_into::<web_sys::CanvasRenderingContext2d>()?.draw_image_with_html_image_element(&img,0.0,0.0)?;let p=js_sys::Promise::new(&mut|resolve,reject|{if let Err(e)=c.to_blob(&resolve){let _=reject.call1(&JsValue::NULL,&e);}});let b=JsFuture::from(p).await?.dyn_into::<web_sys::Blob>()?;download(&b,if poster{"corvus-recruit-poster.png"}else{"corvus-dog-tag.png"})}.await;let _=web_sys::Url::revoke_object_url(&url);result}.await;
    if r.is_err() {
        ui::text(status, &t("resting"));
    }
}
pub(super) fn badges(root: &HtmlElement, s: &Value, compact: bool) -> Result<(), JsValue> {
    let rank = text(s, "rank");
    let mut why = t("rankWhy");
    if rank == "imperator" {
        why = t("generalOnly");
    } else if !corvus_core::army::truthy(&s["rankGranted"]) && s["points"].is_number() {
        let ranks = corvus_core::army::config()["RANKS"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let next = ranks.iter().position(|r| r[0] == rank).map_or(0, |i| i + 1);
        why = if let Some(n) = ranks.get(next) {
            format!(
                "{} · {}",
                tf(
                    "rankNext",
                    &json!({"n":(n[1].as_f64().unwrap_or(0.0)-s["points"].as_f64().unwrap_or(0.0)).max(0.0),"rank":n[0]})
                ),
                t("rankWhy")
            )
        } else {
            t("rankTop")
        };
    }
    root.class_list().add_1("rank-badges")?;
    root.set_text_content(None);
    let mut b = vec![(
        "is-rank",
        if rank.is_empty() { "tiro" } else { rank },
        "rankLabel",
        why,
    )];
    let tier = text(s, "tier");
    if !tier.is_empty() && tier != "imperator" {
        b.push((
            "is-tier",
            tier,
            "tierLabel",
            format!(
                "{}{}",
                t("tierWhy"),
                if ["senator", "consul"].contains(&tier) {
                    format!(" · {}", t("supporterLifetime"))
                } else {
                    String::new()
                }
            ),
        ));
    }
    for (class, v, label, why) in b {
        let e = node("div", "", &format!("rank-badge {class}"))?;
        e.set_title(&why);
        append(&e, &node("span", &t(label), "")?)?;
        append(&e, &node("b", v, "")?)?;
        if !compact && !why.is_empty() {
            append(&e, &node("small", &why, "")?)?;
        }
        append(root, &e)?;
    }
    Ok(())
}
pub(super) fn benefit(id: &str, tier: &str) -> Result<(), JsValue> {
    let next = match tier {
        "" | "tiro" => "miles",
        "miles" => "centurio",
        "centurio" => "legatus",
        "legatus" => "senator",
        "senator" => "consul",
        _ => "",
    };
    let e = ui::element(id)?;
    e.set_hidden(next.is_empty());
    e.set_text_content(Some(&if next.is_empty() {
        String::new()
    } else {
        let key = if next == "consul" {
            "tierConsulPerk".into()
        } else {
            format!("tierPerk{}{}", next[..1].to_uppercase(), &next[1..])
        };
        tf("nextRank", &json!({"tier":next,"perk":t(&key)}))
    }));
    Ok(())
}
pub(super) fn region_name(code: &str) -> String {
    let r = (|| {
        let intl = js_sys::Reflect::get(&js_sys::global(), &"Intl".into())?;
        let ctor =
            js_sys::Reflect::get(&intl, &"DisplayNames".into())?.dyn_into::<js_sys::Function>()?;
        let args = js_sys::Array::new();
        args.push(&js_sys::Array::of1(&language::get_language().into()));
        args.push(&js(&json!({"type":"region"}))?);
        let instance = js_sys::Reflect::construct(&ctor, &args)?;
        js_sys::Reflect::get(&instance, &"of".into())?
            .dyn_into::<js_sys::Function>()?
            .call1(&instance, &code.into())
    })()
    .ok()
    .and_then(|s| s.as_string());
    r.unwrap_or_else(|| code.into())
}
pub(super) fn option(s: &HtmlSelectElement, label: &str, value: &str) -> Result<(), JsValue> {
    let e = node("option", label, "")?;
    e.set_attribute("value", value)?;
    append(s, &e)
}
pub(super) fn countries(id: &str, value: &str) -> Result<(), JsValue> {
    let all: Value = serde_json::from_str(include_str!("../../../migration/army-countries.json"))
        .map_err(|_| JsValue::NULL)?;
    let mut rows = all
        .as_object()
        .into_iter()
        .flat_map(|m| m.keys())
        .map(|k| (k.clone(), region_name(k)))
        .collect::<Vec<_>>();
    let lang = language::get_language();
    rows.sort_by(|a, b| {
        let a = js_sys::JsString::from(a.1.as_str());
        a.locale_compare(
            &b.1,
            &js_sys::Array::of1(&JsValue::from_str(&lang)),
            &js_sys::Object::new(),
        )
        .cmp(&0)
    });
    let s = select(id)?;
    s.set_text_content(None);
    option(&s, &t("notGiven"), "")?;
    for (c, n) in rows {
        option(&s, &n, &c)?;
    }
    s.set_value(value);
    Ok(())
}
