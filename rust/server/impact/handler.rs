use super::{
    links, model,
    store::{Impact, SaveOptions},
    sync,
};
use crate::{
    AppState, Error,
    compound_v2::{handler::defer, model as legacy, security},
    crypto,
};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use corvus_core::army::truthy;
use serde_json::{Value, json};

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
fn empty(status: StatusCode) -> Response {
    (
        status,
        [
            ("cache-control", "no-store"),
            ("x-content-type-options", "nosniff"),
        ],
    )
        .into_response()
}
async fn owner_admin(state: &AppState, headers: &HeaderMap) -> Result<bool, Error> {
    let Some(password) = state.settings.get("ADMIN_PASSWORD") else {
        return Ok(false);
    };
    let Some(token) = crypto::cookie(headers, "corvus_admin").filter(|s| {
        (43..=128).contains(&s.len())
            && s.bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"_-".contains(&c))
    }) else {
        return Ok(false);
    };
    let prefix = state
        .settings
        .get("LEGION_NAMESPACE")
        .unwrap_or(if state.settings.production() {
            "legion:v2:"
        } else {
            "legion:preview:v2:"
        });
    let raw = state
        .store
        .get(&format!("{prefix}admin:{}", crypto::sha(token)))
        .await?;
    let expected = hex::encode(crypto::hmac(
        crypto::server_secret(&state.settings)?.as_bytes(),
        format!("admin:{password}").as_bytes(),
    ));
    Ok(raw
        .as_str()
        .is_some_and(|v| crypto::safe_equal(v, &expected)))
}
fn owner_origin(state: &AppState, headers: &HeaderMap) -> bool {
    let origin = security::header(headers, "origin");
    !origin.is_empty()
        && (["https://corvus.gent", "https://www.corvus.gent"].contains(&origin)
            || ["VERCEL_URL", "VERCEL_BRANCH_URL"].iter().any(|k| {
                state
                    .settings
                    .get(k)
                    .is_some_and(|v| origin == format!("https://{v}"))
            })
            || state.settings.get("LEGION_TEST_ORIGIN") == Some(origin))
}
async fn authorized(state: &AppState, headers: &HeaderMap) -> Result<bool, Error> {
    if security::authorized(
        &state.settings,
        headers,
        chrono::Utc::now().timestamp_millis(),
    )? {
        Ok(true)
    } else {
        owner_admin(state, headers).await
    }
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    q: &Value,
    body: &[u8],
    context: Option<&vercel_runtime::AppState>,
) -> Result<Response, Error> {
    Ok(inner(state, method, headers, q, body, context)
        .await
        .unwrap_or_else(|_| {
            error(
                StatusCode::SERVICE_UNAVAILABLE,
                "The metrics are temporarily unavailable. Try again shortly.",
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
    if truthy(&q["go"]) {
        let placement = legacy::text(&q["go"]);
        if placement.is_empty()
            || placement.len() > 48
            || !placement
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
        {
            return Ok(error(StatusCode::NOT_FOUND, "Unknown placement."));
        }
        if ![Method::GET, Method::HEAD].contains(method) {
            return Ok(empty(StatusCode::METHOD_NOT_ALLOWED));
        }
        let target = match links::target(&state.settings, legacy::text(&q["to"])) {
            Ok(v) => v,
            Err(e) => return Ok(error(StatusCode::BAD_REQUEST, &e.to_string())),
        };
        if method == Method::GET && state.settings.write_enabled() {
            let state = state.clone();
            let headers = headers.clone();
            let placement = placement.to_owned();
            defer(context, async move {
                let _ = links::count(&state, &Method::GET, &headers, &placement).await;
            })
            .await;
        }
        let mut response = empty(StatusCode::FOUND);
        response.headers_mut().insert("location", target.parse()?);
        return Ok(response);
    }
    if q["job"] == "1" {
        let cron = state.settings.get("CRON_SECRET").is_some_and(|s| {
            crypto::safe_equal(
                security::header(headers, "authorization"),
                &format!("Bearer {s}"),
            )
        });
        if !cron && !authorized(state, headers).await? {
            return Ok(error(
                StatusCode::UNAUTHORIZED,
                "Owner or scheduler access required.",
            ));
        }
        if method != Method::GET {
            return Ok(empty(StatusCode::METHOD_NOT_ALLOWED));
        }
        return Ok(reply(
            StatusCode::OK,
            sync::run(state, false, None, None).await?,
        ));
    }
    if method == Method::GET {
        let private = q["private"] == "1";
        if private && !authorized(state, headers).await? {
            return Ok(error(StatusCode::UNAUTHORIZED, "Sign in first."));
        }
        let mut response = reply(StatusCode::OK, Impact(state).report(private).await?);
        if !private {
            response.headers_mut().insert(
                "cache-control",
                "public, max-age=0, s-maxage=30, stale-while-revalidate=300".parse()?,
            );
        }
        return Ok(response);
    }
    if method != Method::POST {
        return Ok(empty(StatusCode::METHOD_NOT_ALLOWED));
    }
    if !authorized(state, headers).await? {
        return Ok(error(StatusCode::UNAUTHORIZED, "Owner sign-in required."));
    }
    if (!security::same_origin(&state.settings, headers)
        && !owner_origin(state, headers)
        && !security::header(headers, "authorization").starts_with("Bearer "))
        || !security::header(headers, "content-type").starts_with("application/json")
    {
        return Ok(error(StatusCode::FORBIDDEN, "Use the owner form."));
    }
    if !security::limit(state, headers, "impact-admin", 30, 60).await? {
        return Ok(error(
            StatusCode::TOO_MANY_REQUESTS,
            "Please retry in a minute.",
        ));
    }
    if body.len() > 22000 {
        return Ok(error(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Please use a smaller batch.",
        ));
    }
    let b: Value = match serde_json::from_slice(body) {
        Ok(b) => b,
        Err(_) => return Ok(error(StatusCode::BAD_REQUEST, "Invalid request.")),
    };
    if !truthy(&b) || b.is_array() || b.to_string().encode_utf16().count() > 22000 {
        return Ok(error(StatusCode::BAD_REQUEST, "Invalid request."));
    }
    Ok(match write(state, &b).await {
        Ok(v) => reply(StatusCode::OK, v),
        Err(e) => error(StatusCode::BAD_REQUEST, &e.to_string()),
    })
}
async fn write(state: &AppState, b: &Value) -> Result<Value, Error> {
    let store = Impact(state);
    match legacy::text(&b["action"]) {
        "linkedin-save" => {
            let row = model::linkedin_post(&b["post"])?;
            let post = store.save(&row, SaveOptions::default()).await?;
            store.save_status("li",legacy::text(&row["account"]),&json!({"mode":"manual","found":1,"note":"Self-reported import. Original native video confirmed by owner.","error":null})).await?;
            store.snapshot().await?;
            Ok(json!({"post":post}))
        }
        "save" => {
            model::validate(&b["post"], &json!({}))?;
            let post = store.save(&b["post"], SaveOptions::default()).await?;
            store.snapshot().await?;
            Ok(json!({"post":post}))
        }
        "bulk" | "linkedin-bulk" => {
            let linkedin = b["action"] == "linkedin-bulk";
            let rows = if linkedin {
                model::linkedin_bulk(&b["text"], b)?
            } else {
                model::bulk_rows(&b["text"], &json!(b["made_with_compound"] != false), false)?
            };
            let mut saved = Vec::new();
            for row in &rows {
                saved.push(store.save(row, SaveOptions::default()).await?["id"].clone());
            }
            if linkedin && let Some(row) = rows.first() {
                store.save_status("li",legacy::text(&row["account"]),&json!({"mode":"manual","found":rows.len(),"note":"Self-reported import. Media confirmed by owner.","error":null})).await?;
            }
            store.snapshot().await?;
            Ok(json!({"saved":saved}))
        }
        "settings" => {
            if !b["include_twitch_archives"].is_boolean() {
                return Err("Invalid archive setting.".into());
            }
            state
                .store
                .command(vec![
                    "SET".into(),
                    store.key("settings"),
                    json!({"include_twitch_archives":b["include_twitch_archives"]}).to_string(),
                ])
                .await?;
            Ok(json!({"ok":true}))
        }
        // The old reply seeds were deliberately removed. Never reconstruct them.
        "seed" => {
            store.snapshot().await?;
            Ok(json!({"ok":true}))
        }
        "sync" => sync::run(state, true, b["platform"].as_str(), None).await,
        _ => Err("Unknown action.".into()),
    }
}
