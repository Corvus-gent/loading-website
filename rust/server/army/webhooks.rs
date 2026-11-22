use super::{
    discord::Discord, discord_model, handler::sync_payment, payments::Payments, security,
    store::Army,
};
use crate::{AppState, Error};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
fn json(status: StatusCode, value: Value) -> Response {
    (status, [("cache-control", "no-store")], Json(value)).into_response()
}
fn header<'a>(h: &'a HeaderMap, key: &str) -> &'a str {
    h.get(key).and_then(|v| v.to_str().ok()).unwrap_or("")
}
pub async fn signed(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    raw: &[u8],
    bmc: bool,
    context: Option<&vercel_runtime::AppState>,
) -> Result<Response, Error> {
    if method != Method::POST {
        return Ok(json(
            StatusCode::METHOD_NOT_ALLOWED,
            json!({"error":"method"}),
        ));
    }
    let Some(secret) = state.settings.get(if bmc {
        "BMC_WEBHOOK_SECRET"
    } else {
        "PIDGY_WEBHOOK_SECRET"
    }) else {
        return Ok(json(
            StatusCode::SERVICE_UNAVAILABLE,
            json!({"error":"not_configured"}),
        ));
    };
    if raw.len() > if bmc { 128 * 1024 } else { 16 * 1024 } {
        return Ok(json(StatusCode::PAYLOAD_TOO_LARGE, json!({"error":"size"})));
    }
    if !security::verify_webhook(raw, header(h, "x-signature-sha256"), secret) {
        return Ok(json(StatusCode::UNAUTHORIZED, json!({"error":"signature"})));
    }
    let event: Value = match serde_json::from_slice(raw) {
        Ok(v) => v,
        Err(_) => return Ok(json(StatusCode::BAD_REQUEST, json!({"error":"payload"}))),
    };
    // Even a valid signed preview event cannot acknowledge a production mutation.
    if !state.settings.write_enabled() {
        return Ok(json(
            StatusCode::SERVICE_UNAVAILABLE,
            json!({"error":"retry"}),
        ));
    }
    let army = Army::new(state)?;
    let result = if bmc {
        Payments(&army).accept(&event).await
    } else {
        Box::pin(army.pidgy_trial(&event)).await
    };
    let result = match result {
        Ok(value) => value,
        Err(e) => {
            return Ok(if e.to_string() == "payload" {
                json(StatusCode::BAD_REQUEST, json!({"error":"payload"}))
            } else {
                json(StatusCode::SERVICE_UNAVAILABLE, json!({"error":"retry"}))
            });
        }
    };
    if bmc {
        if result["accepted"] == true {
            let id = result["event"].as_str().ok_or("payment")?.to_owned();
            let state = state.clone();
            Box::pin(crate::compound_v2::handler::defer(context, async move {
                if let Ok(army) = Army::new(&state)
                    && Box::pin(Payments(&army).process(&id)).await.is_ok()
                {
                    sync_payment(&army, &id).await;
                }
            }))
            .await;
        }
        let mut output = json!({"ok":true});
        if result["test"] == true {
            output["test"] = json!(true);
        }
        Ok(json(StatusCode::OK, output))
    } else {
        Ok(json(
            StatusCode::OK,
            json!({"ok":true,"counted":result["counted"]==true}),
        ))
    }
}
pub async fn discord(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    raw: &[u8],
    context: Option<&vercel_runtime::AppState>,
) -> Result<Response, Error> {
    if method != Method::POST {
        return Ok(StatusCode::METHOD_NOT_ALLOWED.into_response());
    }
    if raw.len() > 32768 {
        return Ok(StatusCode::PAYLOAD_TOO_LARGE.into_response());
    }
    if !discord_model::interaction(
        raw,
        header(h, "x-signature-ed25519"),
        header(h, "x-signature-timestamp"),
        state.settings.get("DISCORD_PUBLIC_KEY").unwrap_or(""),
        chrono::Utc::now().timestamp_millis(),
    ) {
        return Ok(StatusCode::UNAUTHORIZED.into_response());
    }
    let event: Value = match serde_json::from_slice(raw) {
        Ok(v) => v,
        Err(_) => return Ok(StatusCode::BAD_REQUEST.into_response()),
    };
    if event["application_id"].as_str() != state.settings.get("DISCORD_APPLICATION_ID") {
        return Ok(StatusCode::FORBIDDEN.into_response());
    }
    if event["type"] == 1 {
        return Ok(json(StatusCode::OK, json!({"type":1})));
    }
    if event["type"] != 2 || event["data"]["name"] != "claim" {
        return Ok(json(
            StatusCode::OK,
            json!({"type":4,"data":{"content":"unknown command.","flags":64}}),
        ));
    }
    if !state.settings.write_enabled() {
        return Ok(StatusCode::SERVICE_UNAVAILABLE.into_response());
    }
    let state = state.clone();
    Box::pin(crate::compound_v2::handler::defer(context, async move {
        if let Ok(army) = Army::new(&state)
            && let Ok(discord) = Discord::new(&army, None)
        {
            let _ = Box::pin(tokio::time::timeout(
                std::time::Duration::from_secs(40),
                discord.complete(&event),
            ))
            .await;
        }
    }))
    .await;
    Ok(json(StatusCode::OK, json!({"type":5,"data":{"flags":64}})))
}
