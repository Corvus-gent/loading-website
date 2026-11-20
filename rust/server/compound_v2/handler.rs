use super::{
    model::{self, text},
    push, queue, reports,
    security::{self, header},
    store::Registry,
    sync, uploads,
};
use crate::{AppState, Error, crypto};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use corvus_core::{army::truthy, videos};
use regex::Regex;
use serde_json::{Value, json};
use std::{future::Future, sync::LazyLock};
static BOT: LazyLock<Option<Regex>> = LazyLock::new(|| {
    Regex::new(
        "(?i)bot|crawler|spider|preview|curl|wget|headless|facebookexternalhit|slack|discord",
    )
    .ok()
});
fn human(h: &HeaderMap) -> bool {
    let purpose = if header(h, "purpose").is_empty() {
        header(h, "sec-purpose")
    } else {
        header(h, "purpose")
    };
    !BOT.as_ref()
        .is_some_and(|r| r.is_match(header(h, "user-agent")))
        && !purpose.to_ascii_lowercase().contains("prefetch")
}
fn reply(status: StatusCode, body: Value) -> Response {
    (
        status,
        [
            ("cache-control", "no-store"),
            ("x-content-type-options", "nosniff"),
        ],
        Json(body),
    )
        .into_response()
}
fn error(status: StatusCode, message: &str) -> Response {
    reply(status, json!({"error":message}))
}
fn cached(mut response: Response, cache: &'static str) -> Response {
    response
        .headers_mut()
        .insert("cache-control", axum::http::HeaderValue::from_static(cache));
    response
}
fn redirect(path: &str) -> Result<Response, Error> {
    let mut r = (
        StatusCode::FOUND,
        [
            ("cache-control", "no-store"),
            ("x-content-type-options", "nosniff"),
        ],
    )
        .into_response();
    r.headers_mut().insert("location", path.parse()?);
    Ok(r)
}
pub(crate) async fn defer<F>(context: Option<&vercel_runtime::AppState>, work: F)
where
    F: Future<Output = ()> + Send + 'static,
{
    if let Some(context) = context {
        context.wait_until(work);
    } else {
        work.await;
    }
}
async fn refresh(state: &AppState, context: Option<&vercel_runtime::AppState>) {
    // Read-only previews never schedule provider I/O or attempt to acquire a refresh lock.
    if state.settings.write_enabled() && sync::configured(&state.settings) {
        let state = state.clone();
        defer(context, async move {
            let _ = sync::due(&Registry(&state)).await;
        })
        .await;
    }
}
fn policy(body: &Value, headers: &HeaderMap) -> Value {
    let p = security::analytics(body, headers);
    json!({"tags":if p["enabled"]==true {model::attribution(&body["attribution"])}else{json!({})},"visitor":p["visitor"]})
}
async fn resolve(
    registry: &Registry<'_>,
    raw: &str,
    query: &Value,
    source: &str,
) -> Result<Value, Error> {
    let videos = registry
        .videos()
        .await?
        .iter()
        .filter_map(|v| videos::parse_slug(text(&v["slug"])))
        .collect::<Vec<_>>();
    Ok(videos::resolve_code(raw, &videos, query, source))
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    query: &Value,
    body: &[u8],
    context: Option<&vercel_runtime::AppState>,
) -> Result<Response, Error> {
    Ok(inner(state, method, headers, query, body, context)
        .await
        .unwrap_or_else(|_| {
            error(
                StatusCode::SERVICE_UNAVAILABLE,
                "The counters lost their connection. Your vote was not confirmed. Please retry.",
            )
        }))
}
async fn inner(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    q: &Value,
    body: &[u8],
    context: Option<&vercel_runtime::AppState>,
) -> Result<Response, Error> {
    let registry = Registry(state);
    // Separate handlers are not silently treated as the video registry during migration.
    if q["interviews"] == "1"
        || q["interviewAdmin"] == "1"
        || truthy(&q["interviewPage"])
        || truthy(&q["interviewCard"])
    {
        return crate::interviews::handler::handle(state, method, headers, q, body, context).await;
    }
    if q["impact"] == "1" {
        return Ok(error(
            StatusCode::NOT_IMPLEMENTED,
            "This Compound subhandler has not migrated yet.",
        ));
    }
    let owner = if method == Method::POST
        || ["reportJob", "report", "private", "session"]
            .iter()
            .any(|k| q[*k] == "1")
    {
        security::authorized(
            &state.settings,
            headers,
            chrono::Utc::now().timestamp_millis(),
        )?
    } else {
        false
    };
    if q["reportJob"] == "1" && method == Method::GET {
        let cron = state.settings.get("CRON_SECRET").is_some_and(|secret| {
            crypto::safe_equal(
                header(headers, "authorization"),
                &format!("Bearer {secret}"),
            )
        });
        if !owner && !cron {
            return Ok(error(
                StatusCode::UNAUTHORIZED,
                "Owner or scheduler access required.",
            ));
        }
        return Ok(reply(
            StatusCode::OK,
            reports::run(
                &registry,
                owner && q["force"] == "1",
                if owner { "owner" } else { "cron" },
            )
            .await?,
        ));
    }
    if q["report"] == "1" && method == Method::GET {
        return Ok(if owner {
            reply(StatusCode::OK, reports::latest(&registry).await?)
        } else {
            error(StatusCode::UNAUTHORIZED, "Sign in first.")
        });
    }
    if q["codeLink"] == "1" && [Method::GET, Method::HEAD].contains(method) {
        let result = resolve(&registry, text(&q["code"]), q, "url").await?;
        if method == Method::GET && human(headers) && state.settings.write_enabled() {
            if !security::limit(state, headers, "code", 120, 60).await? {
                return Ok(error(
                    StatusCode::TOO_MANY_REQUESTS,
                    "Please retry in a minute.",
                ));
            }
            registry.event("code_entered",&format!("code:{}",text(&result["code"])),&json!({"code":result["code"],"source":"url","lang":text(&result["parsed"]["lang"])})).await?;
        }
        return redirect(text(&result["destination"]));
    }
    if q["short"] == "1" && [Method::GET, Method::HEAD].contains(method) {
        let Some(target) = videos::destination(text(&q["slug"]), q) else {
            return Ok(error(
                StatusCode::NOT_FOUND,
                "That video code is not valid.",
            ));
        };
        if method == Method::GET && human(headers) && state.settings.write_enabled() {
            let state = state.clone();
            let headers = headers.clone();
            let slug = text(&q["slug"]).to_string();
            defer(context, async move {
                let registry = Registry(&state);
                if matches!(
                    security::limit(&state, &headers, "redirect", 120, 60).await,
                    Ok(true)
                ) && registry.get(&slug).await.is_ok_and(|v| v.is_some())
                {
                    let _ = registry.event("redirect", &slug, &json!({})).await;
                }
            })
            .await;
        }
        return redirect(&target);
    }
    if method == Method::GET {
        if q["push"] == "1" {
            return Ok(cached(
                reply(StatusCode::OK, push::winner(&registry).await?),
                "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
            ));
        }
        if q["session"] == "1" {
            return Ok(reply(StatusCode::OK, json!({"authorized":owner})));
        }
        if q["private"] == "1" {
            if !owner {
                return Ok(error(StatusCode::UNAUTHORIZED, "Sign in first."));
            }
            refresh(state, context).await;
            let mut report = registry.report(true).await?;
            report["upload_queue"] = queue::upload_queue(
                report["videos"].as_array().ok_or("invalid report")?,
                chrono::Utc::now().timestamp_millis(),
            );
            let (feedback, status, winner, briefing) = tokio::join!(
                registry.private_feedback(),
                sync::status(&registry),
                push::winner(&registry),
                reports::latest(&registry)
            );
            report["feedback"] = feedback?;
            report["sync"] = status?;
            report["push"] = winner?;
            report["briefing"] = briefing?;
            return Ok(reply(StatusCode::OK, report));
        }
        refresh(state, context).await;
        let mut report = registry.report(false).await?;
        report["deadline"] = json!(model::deadline()?);
        report["server_time"] = json!(model::now());
        return Ok(cached(
            reply(StatusCode::OK, report),
            "public, max-age=0, s-maxage=15, stale-while-revalidate=120",
        ));
    }
    if method != Method::POST {
        return Ok(error(StatusCode::METHOD_NOT_ALLOWED, "Use GET or POST."));
    }
    let api_admin = header(headers, "authorization").starts_with("Bearer ") && owner;
    if (!security::same_origin(&state.settings, headers) && !api_admin)
        || !header(headers, "content-type").starts_with("application/json")
    {
        return Ok(error(StatusCode::FORBIDDEN, "Please use the page."));
    }
    let b: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return Ok(error(StatusCode::BAD_REQUEST, "Invalid request.")),
    };
    if !b.is_object() || b.to_string().encode_utf16().count() > 12000 {
        return Ok(error(StatusCode::BAD_REQUEST, "Invalid request."));
    }
    if !security::limit(state, headers, "all", 150, 60).await? {
        return Ok(error(
            StatusCode::TOO_MANY_REQUESTS,
            "Take a breath. Try again in a minute.",
        ));
    }
    let action = text(&b["action"]);
    let slug = text(&b["slug"]);
    if action == "login" {
        if !security::limit(state, headers, "login", 5, 300).await? {
            return Ok(error(
                StatusCode::TOO_MANY_REQUESTS,
                "Too many attempts. Try again in five minutes.",
            ));
        }
        let Some(cookie) = security::login(
            &state.settings,
            &b["password"],
            chrono::Utc::now().timestamp_millis(),
        )?
        else {
            return Ok(error(StatusCode::UNAUTHORIZED, "Wrong password."));
        };
        let mut response = reply(StatusCode::OK, json!({"ok":true}));
        response.headers_mut().insert("set-cookie", cookie);
        return Ok(response);
    }
    if action == "logout" {
        let mut response = reply(StatusCode::OK, json!({"ok":true}));
        response
            .headers_mut()
            .insert("set-cookie", security::LOGOUT.parse()?);
        return Ok(response);
    }
    if ["add", "edit", "hide_feedback", "mark_posted", "set_winner"].contains(&action) {
        if !owner {
            return Ok(error(StatusCode::UNAUTHORIZED, "Owner sign-in required."));
        }
        if action == "set_winner" {
            return Ok(match push::select(&registry, slug).await {
                Ok(v) => reply(StatusCode::OK, v),
                Err(e) => error(StatusCode::BAD_REQUEST, &e.to_string()),
            });
        }
        if action == "hide_feedback" {
            registry.hide_feedback(text(&b["id"])).await?;
            return Ok(reply(StatusCode::OK, json!({"ok":true})));
        }
        let row = if action == "mark_posted" {
            uploads::mark_posted(&registry, slug, &b["post_url"], &model::now()).await
        } else {
            registry.save(&b["video"], action == "edit").await
        };
        return Ok(match row {
            Ok(row) => reply(StatusCode::OK, json!({"video":row})),
            Err(e) => error(StatusCode::BAD_REQUEST, &e.to_string()),
        });
    }
    if truthy(&b["website"]) {
        return Ok(error(
            StatusCode::BAD_REQUEST,
            "Please leave the hidden field empty.",
        ));
    }
    let mut detail = policy(&b, headers);
    if action == "push_event" {
        if !["view", "watch", "comment", "share"].contains(&text(&b["type"])) {
            return Ok(error(StatusCode::BAD_REQUEST, "Invalid action."));
        }
        if !human(headers) {
            return Ok(reply(StatusCode::OK, json!({"ok":true,"skipped":true})));
        }
        let selected = push::winner(&registry).await?;
        if selected["winner"].is_null() || selected["winner"]["slug"] != b["slug"] {
            return Ok(error(
                StatusCode::CONFLICT,
                "The selected post changed. Refresh the page.",
            ));
        }
        if security::analytics(&b, headers)["enabled"] == true {
            detail["tags"]["utm_content"] = json!("push");
        }
        registry
            .event(
                &format!("push_{}", text(&b["type"])),
                if slug.is_empty() { "push" } else { slug },
                &detail,
            )
            .await?;
        return Ok(reply(StatusCode::OK, json!({"ok":true})));
    }
    if action == "code" {
        let source = if b["source"] == "url" { "url" } else { "typed" };
        let result = resolve(&registry, text(&b["code"]), &b["query"], source).await?;
        detail["code"] = result["code"].clone();
        detail["source"] = json!(source);
        detail["lang"] = json!(text(&result["parsed"]["lang"]));
        registry
            .event(
                "code_entered",
                &format!("code:{}", text(&result["code"])),
                &detail,
            )
            .await?;
        if result["parsed"].is_null() {
            return Ok(error(
                StatusCode::BAD_REQUEST,
                "Code not found yet, pick a version below",
            ));
        }
        return Ok(reply(
            StatusCode::OK,
            json!({"destination":result["destination"],"matches":result["matches"]}),
        ));
    }
    if videos::parse_slug(slug).is_none() || registry.get(slug).await?.is_none() {
        return Ok(error(
            StatusCode::NOT_FOUND,
            "This video is not registered yet.",
        ));
    }
    if action == "event" {
        if !["pageview", "share_click", "outbound_click", "code_entered"]
            .contains(&text(&b["type"]))
        {
            return Ok(error(StatusCode::BAD_REQUEST, "Invalid event."));
        }
        if !human(headers) {
            return Ok(reply(StatusCode::OK, json!({"ok":true,"skipped":true})));
        }
        if b["type"] == "code_entered"
            && let Some(code) = videos::parse_code(text(&b["code"]))
        {
            detail["code"] = json!(code.code);
        }
        registry.event(text(&b["type"]), slug, &detail).await?;
        return Ok(reply(StatusCode::OK, json!({"ok":true})));
    }
    if action == "vote" {
        let choice = text(&b["choice"]);
        if !["up", "down"].contains(&choice) {
            return Ok(error(StatusCode::BAD_REQUEST, "Choose up or down."));
        }
        let (uid, cookie) = security::identity(&state.settings, headers)?;
        let result = registry.vote(&uid, slug, choice).await?;
        if result["added"] == true {
            registry.event("vote", slug, &detail).await?;
        }
        let mut response = reply(StatusCode::OK, result);
        if let Some(cookie) = cookie {
            response.headers_mut().insert("set-cookie", cookie);
        }
        return Ok(response);
    }
    if action == "feedback" {
        let valid_text = b["text"]
            .as_str()
            .is_some_and(|s| !model::trim(s).is_empty() && s.encode_utf16().count() <= 1000);
        let valid_handle = !truthy(&b["handle"])
            || b["handle"]
                .as_str()
                .is_some_and(|s| s.encode_utf16().count() <= 80);
        if !valid_text || !valid_handle {
            return Ok(error(
                StatusCode::BAD_REQUEST,
                "Write a note (max 1,000 characters), and an optional handle (max 80).",
            ));
        }
        if !security::limit(state, headers, "feedback", 3, 60).await? {
            return Ok(error(
                StatusCode::TOO_MANY_REQUESTS,
                "Three notes per minute. Make them count.",
            ));
        }
        let (uid, cookie) = security::identity(&state.settings, headers)?;
        let result = registry
            .feedback(
                &uid,
                slug,
                &model::plain(model::trim(text(&b["text"]))),
                model::trim(text(&b["handle"])),
            )
            .await?;
        if result["added"] == true {
            registry.event("feedback", slug, &detail).await?;
        }
        let mut response = reply(StatusCode::OK, result);
        if let Some(cookie) = cookie {
            response.headers_mut().insert("set-cookie", cookie);
        }
        return Ok(response);
    }
    Ok(error(StatusCode::BAD_REQUEST, "Unknown action."))
}
