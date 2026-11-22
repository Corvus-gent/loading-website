//! Existing private interview request form. Keys/signatures retain JS compatibility.
use crate::{AppState, Error, auth, crypto};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use std::collections::HashMap;
const RETENTION: i64 = 60 * 86400;
fn mac(secret: &str, value: &str) -> String {
    hex::encode(crypto::hmac(
        secret.as_bytes(),
        format!("live-interview:{value}").as_bytes(),
    ))
}
pub fn challenge(secret: &str, now: i64) -> Value {
    let value = format!("{now}.{}", hex::encode(rand::random::<[u8; 12]>()));
    json!({"token":format!("{value}.{}",mac(secret,&value)),"notBefore":now+3000})
}
pub fn valid_challenge(secret: &str, token: &str, now: i64) -> bool {
    if token.len() > 120 {
        return false;
    }
    let bits: Vec<_> = token.split('.').collect();
    if bits.len() != 3
        || bits[0].len() != 13
        || !bits[0].bytes().all(|v| v.is_ascii_digit())
        || bits[1].len() != 24
        || !bits[1]
            .bytes()
            .all(|v| v.is_ascii_digit() || (b'a'..=b'f').contains(&v))
    {
        return false;
    }
    let Some(age) = bits[0].parse::<i64>().ok().and_then(|v| now.checked_sub(v)) else {
        return false;
    };
    (3000..1_800_000).contains(&age)
        && crypto::safe_equal(bits[2], &mac(secret, &format!("{}.{}", bits[0], bits[1])))
}
fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|n| n != 0.0),
        Value::String(s) => !s.is_empty(),
        _ => true,
    }
}
pub fn validate(body: &Value) -> Result<Value, &'static str> {
    if !body.is_object() || truthy(&body["website"]) {
        return Err("Please check the form.");
    }
    let mut fields = serde_json::Map::new();
    for (key, max) in [("name", 80), ("project", 160), ("handle", 120)] {
        let value = body[key]
            .as_str()
            .filter(|s| s.encode_utf16().count() <= max)
            .ok_or("Please fill in your name, project and handle.")?;
        let value = value
            .chars()
            .map(|c| {
                if c <= '\u{1f}' || c == '\u{7f}' {
                    ' '
                } else {
                    c
                }
            })
            .collect::<String>()
            .trim()
            .to_string();
        if value.is_empty() {
            return Err("Please fill in your name, project and handle.");
        }
        fields.insert(key.into(), value.into());
    }
    Ok(Value::Object(fields))
}
fn reply(status: StatusCode, body: Value) -> Response {
    (
        status,
        [
            ("cache-control", "no-store"),
            ("referrer-policy", "no-referrer"),
        ],
        Json(body),
    )
        .into_response()
}
fn same_origin(state: &AppState, headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get("origin").and_then(|h| h.to_str().ok()) else {
        return false;
    };
    auth::ORIGINS.contains(&origin)
        || [
            "VERCEL_URL",
            "VERCEL_BRANCH_URL",
            "VERCEL_PROJECT_PRODUCTION_URL",
        ]
        .iter()
        .any(|k| {
            state
                .settings
                .get(k)
                .is_some_and(|v| origin == format!("https://{v}"))
        })
        || (state.settings.get("NODE_ENV") != Some("production")
            && origin == "http://127.0.0.1:4417")
}
async fn inner(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    query: &HashMap<String, String>,
    body: &[u8],
) -> Result<Response, Error> {
    let prefix = state.settings.get("LIVE_INTERVIEW_TEST_PREFIX").unwrap_or(
        if state.settings.production() {
            "live:interviews"
        } else {
            "live:preview:interviews"
        },
    );
    let now = chrono::Utc::now();
    if query.get("interviews").is_some_and(|v| v == "1") {
        if method != Method::GET {
            return Ok(reply(
                StatusCode::METHOD_NOT_ALLOWED,
                json!({"error":"Use GET."}),
            ));
        }
        if auth::session(state, headers)
            .await?
            .is_none_or(|(_, email)| email != "gabriel@corvus.gent")
        {
            return Ok(reply(
                StatusCode::UNAUTHORIZED,
                json!({"error":"Owner login required."}),
            ));
        }
        let ids = state
            .store
            .command(vec![
                "ZREVRANGEBYSCORE".into(),
                format!("{prefix}:index"),
                "+inf".into(),
                (now.timestamp_millis() - RETENTION * 1000).to_string(),
                "LIMIT".into(),
                "0".into(),
                "200".into(),
            ])
            .await?;
        let mut keys = vec!["MGET".into()];
        for id in ids
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
        {
            keys.push(format!("{prefix}:record:{id}"));
        }
        let mut rows = Vec::new();
        if keys.len() > 1 {
            let stored = state.store.command(keys).await?;
            for row in stored
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
            {
                rows.push(serde_json::from_str::<Value>(row)?);
            }
        }
        return Ok(reply(StatusCode::OK, json!({"interviews":rows})));
    }
    if method == Method::GET {
        return Ok(reply(
            StatusCode::OK,
            challenge(
                &crypto::server_secret(&state.settings)?,
                now.timestamp_millis(),
            ),
        ));
    }
    if method != Method::POST {
        let mut r = reply(StatusCode::METHOD_NOT_ALLOWED, json!({"error":"Use POST."}));
        r.headers_mut().insert("allow", "GET, POST".parse()?);
        return Ok(r);
    }
    if !same_origin(state, headers) {
        return Ok(reply(
            StatusCode::FORBIDDEN,
            json!({"error":"Please use the form on corvus.gent."}),
        ));
    }
    if !headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("application/json"))
    {
        return Ok(reply(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            json!({"error":"Use JSON."}),
        ));
    }
    if body.len() > 2048 {
        return Ok(reply(
            StatusCode::PAYLOAD_TOO_LARGE,
            json!({"error":"Please keep it short."}),
        ));
    }
    let Ok(body) = serde_json::from_slice::<Value>(body) else {
        return Ok(reply(
            StatusCode::BAD_REQUEST,
            json!({"error":"Please check the form."}),
        ));
    };
    let mut fields = match validate(&body) {
        Ok(v) => v,
        Err(message) => return Ok(reply(StatusCode::BAD_REQUEST, json!({"error":message}))),
    };
    let secret = crypto::server_secret(&state.settings)?;
    let token = body["token"].as_str().unwrap_or("");
    if !valid_challenge(&secret, token, now.timestamp_millis()) {
        return Ok(reply(
            StatusCode::BAD_REQUEST,
            json!({"error":"Please reload the form and try again."}),
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    fields["id"] = json!(id);
    fields["createdAt"] = json!(now.to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
    let day = now.format("%Y-%m-%d").to_string();
    let hash = crypto::daily_ip_hash(
        &secret,
        headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .unwrap_or(""),
        "live-interview",
        &day,
    );
    let result = state
        .store
        .command(vec![
            "EVAL".into(),
            include_str!("../migration/live-interviews.lua").into(),
            "5".into(),
            format!("{prefix}:submission:{}", mac(&secret, token)),
            format!("{prefix}:minute:{hash}"),
            format!("{prefix}:hour:{hash}"),
            format!("{prefix}:record:{id}"),
            format!("{prefix}:index"),
            id,
            fields.to_string(),
            RETENTION.to_string(),
            now.timestamp_millis().to_string(),
            (now.timestamp_millis() - RETENTION * 1000).to_string(),
        ])
        .await?;
    let status = result[0]
        .as_u64()
        .and_then(|n| u16::try_from(n).ok())
        .and_then(|n| StatusCode::from_u16(n).ok())
        .ok_or("invalid save result")?;
    if status == StatusCode::TOO_MANY_REQUESTS {
        let retry = result[1].as_str().ok_or("invalid retry")?;
        let mut r = reply(
            status,
            json!({"error":"One request at a time. Try again shortly.","retryAfter":retry.parse::<i64>()?}),
        );
        r.headers_mut().insert("retry-after", retry.parse()?);
        return Ok(r);
    }
    Ok(reply(status, json!({"ok":true,"id":result[1]})))
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    query: &HashMap<String, String>,
    body: &[u8],
) -> Result<Response, Error> {
    Ok(inner(state, method, headers, query, body)
        .await
        .unwrap_or_else(|_| {
            reply(
                StatusCode::SERVICE_UNAVAILABLE,
                json!({"error":"The form is taking a breather. Please DM Gabe instead."}),
            )
        }))
}
