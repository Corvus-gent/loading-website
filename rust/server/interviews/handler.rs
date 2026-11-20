use super::{
    photos::Photos,
    store::{self, Interviews},
};
use crate::{
    AppState, Error,
    compound_v2::{
        handler::defer,
        model::text,
        security::{self, header},
    },
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
async fn delete_later(state: &AppState, context: Option<&vercel_runtime::AppState>, url: String) {
    if url.is_empty() {
        return;
    }
    let state = state.clone();
    defer(context, async move {
        if let Ok(photos) = Photos::configured(&state) {
            let _ = photos.delete(&url).await;
        }
    })
    .await;
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
        .unwrap_or_else(|e| {
            let message = e.to_string();
            let safe = [
                "Fill in",
                "Use a",
                "Confirm that",
                "Invalid interview",
                "Reload the form",
                "This entry changed",
                "Interview not found",
                "The interview registry",
                "Choose a JPEG",
                "This photo could",
            ]
            .iter()
            .any(|s| message.starts_with(s));
            error(
                if safe {
                    StatusCode::BAD_REQUEST
                } else {
                    StatusCode::SERVICE_UNAVAILABLE
                },
                if safe {
                    &message
                } else {
                    "Could not save right now. Your form is kept; please retry."
                },
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
    let store = Interviews(state);
    if [Method::GET, Method::HEAD].contains(method) {
        if truthy(&q["interviewPage"]) || truthy(&q["interviewCard"]) {
            let page = truthy(&q["interviewPage"]);
            let n = if page {
                &q["interviewPage"]
            } else {
                &q["interviewCard"]
            };
            let mut og = json!({"kind":"interview","n":corvus_core::impact::string(n)});
            if page {
                og["ogPage"] = json!("1");
            }
            return Ok(crate::og::handler::handle(state, method, &og).await);
        }
        if q["interviewAdmin"] == "1" {
            if !security::authorized(
                &state.settings,
                headers,
                chrono::Utc::now().timestamp_millis(),
            )? {
                return Ok(error(StatusCode::UNAUTHORIZED, "Sign in first."));
            }
            return Ok(reply(
                StatusCode::OK,
                json!({"interviews":store.list().await?,"photos":state.settings.get("BLOB_READ_WRITE_TOKEN").is_some()}),
            ));
        }
        let legacy: Value = serde_json::from_str(include_str!("../../../hack/3/interviews.json"))?;
        let mut rows = store
            .list()
            .await?
            .iter()
            .map(store::public_row)
            .collect::<Vec<_>>();
        rows.extend(legacy["interviews"].as_array().cloned().unwrap_or_default());
        if state.settings.write_enabled() {
            let state = state.clone();
            defer(context, async move {
                if let Ok(photos) = Photos::configured(&state) {
                    let _ = photos.cleanup().await;
                }
            })
            .await;
        }
        let mut response = reply(StatusCode::OK, json!({"interviews":rows}));
        response.headers_mut().insert(
            "cache-control",
            "public, max-age=0, s-maxage=5, stale-while-revalidate=10".parse()?,
        );
        return Ok(response);
    }
    if method != Method::POST {
        return Ok(error(StatusCode::METHOD_NOT_ALLOWED, "Use GET or POST."));
    }
    if !security::authorized(
        &state.settings,
        headers,
        chrono::Utc::now().timestamp_millis(),
    )? {
        return Ok(error(StatusCode::UNAUTHORIZED, "Sign in first."));
    }
    if !security::same_origin(&state.settings, headers)
        && !header(headers, "authorization").starts_with("Bearer ")
    {
        return Ok(error(StatusCode::FORBIDDEN, "Please use the form."));
    }
    if !header(headers, "content-type").starts_with("application/json") {
        return Ok(error(StatusCode::UNSUPPORTED_MEDIA_TYPE, "Use JSON."));
    }
    if !security::limit(state, headers, "interview-edit", 30, 60).await? {
        return Ok(error(
            StatusCode::TOO_MANY_REQUESTS,
            "Take a moment and retry.",
        ));
    }
    if body.is_empty() || body.len() > 2500000 {
        return Ok(error(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Photo too large. Choose a smaller photo.",
        ));
    }
    let Ok(body) = serde_json::from_slice::<Value>(body) else {
        return Ok(error(StatusCode::BAD_REQUEST, "Invalid form."));
    };
    if !body.is_object() {
        return Ok(error(StatusCode::BAD_REQUEST, "Invalid form."));
    }
    if body["action"] == "delete" {
        let old = store.remove(&body["n"], &body["updated_at"]).await?;
        delete_later(state, context, text(&old["photo_url"]).into()).await;
        return Ok(reply(StatusCode::OK, json!({"ok":true})));
    }
    if body["action"] != "save" {
        return Ok(error(StatusCode::BAD_REQUEST, "Unknown action."));
    }
    store::fields(&body)?;
    if truthy(&body["n"])
        && !store
            .get(&body["n"])
            .await?
            .is_some_and(|v| v["updated_at"] == body["updated_at"])
    {
        return Ok(error(
            StatusCode::CONFLICT,
            "This entry changed. Reload before saving.",
        ));
    }
    let mut photo = String::new();
    if truthy(&body["photo"]) {
        if state.settings.get("BLOB_READ_WRITE_TOKEN").is_none() {
            return Ok(error(
                StatusCode::SERVICE_UNAVAILABLE,
                "Photo storage is unavailable. Save without the photo, then add it later.",
            ));
        }
        photo = Photos::configured(state)?
            .upload(
                body["photo"]
                    .as_str()
                    .ok_or("Choose a JPEG, PNG or WebP photo under 1.7 MB.")?,
            )
            .await?;
    }
    match store
        .save(&body, &photo, body["remove_photo"] == true)
        .await
    {
        Ok(result) => {
            if !photo.is_empty() && result["created"] != true {
                delete_later(state, context, photo).await;
            }
            if result["oldPhoto"] != result["row"]["photo_url"] {
                delete_later(state, context, text(&result["oldPhoto"]).into()).await;
            }
            Ok(reply(StatusCode::OK, json!({"interview":result["row"]})))
        }
        Err(error) => {
            delete_later(state, context, photo).await;
            Err(error)
        }
    }
}
