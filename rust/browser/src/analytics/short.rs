use super::*;
use wasm_bindgen_futures::{JsFuture, future_to_promise};
const TARGETS: [(&str, &str); 7] = [
    ("me", "/people/?id=gabe"),
    ("home", "/"),
    ("now", "/now/"),
    ("sidequests", "/sidequests/"),
    ("support", "/support/"),
    ("402", "/402/"),
    ("cv", "/cv"),
];
async fn config() -> Value {
    let result = async {
        let w = web_sys::window().ok_or(JsValue::NULL)?;
        let options = web_sys::RequestInit::new();
        options.set_cache(web_sys::RequestCache::NoStore);
        options.set_signal(Some(&web_sys::AbortSignal::timeout_with_u32(8000)));
        let req = web_sys::Request::new_with_str_and_init("/site.json", &options)?;
        let r = JsFuture::from(w.fetch_with_request(&req))
            .await?
            .dyn_into::<web_sys::Response>()?;
        Ok::<_, JsValue>(value(&JsFuture::from(r.json()?).await?))
    }
    .await;
    result.unwrap_or(json!({}))
}
pub(super) async fn resolve(path: &str, search: &str) -> Result<Value, JsValue> {
    let parts = path.trim_end_matches('/').split('/').collect::<Vec<_>>();
    let p = parts.get(2).copied().unwrap_or("");
    let raw_target = parts.get(3).copied().unwrap_or("me");
    let raw_campaign = parts.get(4).copied().unwrap_or("");
    let source = policy::source(&json!(match p {
        "ig" => "instagram",
        "li" => "linkedin",
        "tt" => "tiktok",
        "x" => "x",
        "luma" => "luma",
        "dc" => "discord",
        "wa" => "whatsapp",
        "mail" => "email",
        "qr" => "qr",
        "bmc" => "buymeacoffee",
        "" => "direct",
        p => p,
    }));
    let campaign = if raw_campaign.is_empty() {
        String::new()
    } else if source == "x" {
        policy::campaign_slug(&json!(raw_campaign))
    } else {
        policy::campaign(&json!(raw_campaign))
            .as_str()
            .unwrap_or("other")
            .to_owned()
    };
    let content = if source == "x" {
        let q = web_sys::UrlSearchParams::new_with_str(search)?;
        policy::slot(&json!(q.get("utm_content")))
    } else {
        String::new()
    };
    let target = if TARGETS
        .iter()
        .any(|(k, _)| !k.is_empty() && *k == raw_target)
        || ["pidgy", "x", "book", "coffee"].contains(&raw_target)
    {
        raw_target
    } else {
        "me"
    };
    let medium = if campaign.is_empty() { "bio" } else { "post" };
    let external = ["pidgy", "x", "book", "coffee"].contains(&target);
    let origin = web_sys::window()
        .ok_or(JsValue::NULL)?
        .location()
        .origin()?;
    let base = if external {
        let cfg = config().await;
        match target {
            "pidgy" => "https://pidgy-ai.com/".into(),
            "x" => "https://x.com/gabe_maxxing".into(),
            key => {
                let v = &cfg[if key == "book" { "booking15" } else { "coffee" }];
                if corvus_core::army::truthy(v) {
                    corvus_core::impact::string(v)
                } else {
                    "/people/?id=gabe".into()
                }
            }
        }
    } else {
        TARGETS
            .iter()
            .find(|(k, _)| *k == target)
            .map(|(_, v)| *v)
            .unwrap_or("/people/?id=gabe")
            .into()
    };
    let url = web_sys::Url::new_with_base(&base, &origin)?;
    let q = url.search_params();
    q.set("utm_source", source.as_str().unwrap_or("other"));
    q.set("utm_medium", if external { "social" } else { medium });
    q.set(
        "utm_campaign",
        &if external {
            format!(
                "gabe{}",
                if campaign.is_empty() {
                    String::new()
                } else {
                    format!("-{campaign}")
                }
            )
        } else if campaign.is_empty() {
            "bio".into()
        } else {
            campaign.clone()
        },
    );
    q.set(
        "utm_content",
        if content.is_empty() {
            if external { "corvus" } else { target }
        } else {
            &content
        },
    );
    if target == "pidgy" {
        q.set("ref", "gabe");
    }
    Ok(
        json!({"url":url.href(),"source":source,"medium":medium,"campaign":campaign,"target":target,"utm_content":content,"external":external}),
    )
}
pub(super) async fn go() -> Result<(), JsValue> {
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let r = resolve(&w.location().pathname()?, &crate::arrival::arrival_search()).await?;
    let body = json!({"action":"short_click","path":w.location().pathname()?});
    let request = web_sys::RequestInit::new();
    request.set_method("POST");
    request.set_body(&body.to_string().into());
    js_sys::Reflect::set(&request, &"keepalive".into(), &true.into())?;
    let req = web_sys::Request::new_with_str_and_init("/api/legion", &request)?;
    req.headers().set("Content-Type", "application/json")?;
    let response = w.fetch_with_request(&req);
    let work = future_to_promise(async move {
        let _ = JsFuture::from(response).await;
        Ok(JsValue::NULL)
    });
    let wait = future_to_promise(async {
        ui::sleep(200).await?;
        Ok(JsValue::NULL)
    });
    let _ = JsFuture::from(js_sys::Promise::race(&js_sys::Array::of2(&work, &wait))).await;
    if r["external"] == true {
        let begin = js_sys::Date::now();
        loop {
            let ph = js_sys::Reflect::get(&w, &"posthog".into()).unwrap_or(JsValue::NULL);
            let f = js_sys::Reflect::get(&ph, &"capture".into())
                .ok()
                .and_then(|v| v.dyn_into::<js_sys::Function>().ok());
            if let Some(f) = f {
                let _ = f.call2(&ph, &"short_link_out".into(), &js(&r)?);
                break;
            }
            if js_sys::Date::now() - begin >= 1000.0 {
                break;
            }
            ui::sleep(100).await?;
        }
        ui::sleep(200).await?;
    }
    w.location()
        .replace(r["url"].as_str().ok_or(JsValue::NULL)?)?;
    Ok(())
}
