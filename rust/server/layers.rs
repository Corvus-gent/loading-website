use crate::{AppState, Error, crypto};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::Timelike;
use corvus_core::tiers::{TASTE_SECONDS, Tier, tier_path};
use serde_json::{Value, json};
use std::collections::HashMap;
const AGE: i64 = 90 * 86400;
const METER: &str = include_str!("../migration/meter.lua");

pub fn local_day(now: i64, zone: &str) -> Option<String> {
    let tz: chrono_tz::Tz = zone.parse().ok()?;
    let local = chrono::DateTime::from_timestamp_millis(now)?.with_timezone(&tz);
    let date = local.date_naive();
    Some(
        if local.hour() * 60 + local.minute() < 242 {
            date.pred_opt()?
        } else {
            date
        }
        .to_string(),
    )
}
fn key(state: &AppState, suffix: &str) -> String {
    format!(
        "{}{suffix}",
        state
            .settings
            .get("LEGION_NAMESPACE")
            .unwrap_or(if state.settings.production() {
                "legion:v2:"
            } else {
                "legion:preview:v2:"
            })
    )
}
fn sign(secret: &str, data: &str) -> String {
    crypto::sign(secret, &format!("layer-v1:{data}"))
}
fn read_session(headers: &HeaderMap, secret: &str, now: i64) -> Value {
    if let Some(raw) = crypto::cookie(headers, "corvus_layer") {
        let mut parts = raw.split('.');
        if let (Some(data), Some(signature)) = (parts.next(), parts.next())
            && !data.is_empty()
            && data.len() < 1000
            && signature.len() == 43
            && crypto::safe_equal(signature, &sign(secret, data))
            && let Ok(bytes) = URL_SAFE_NO_PAD.decode(data)
            && let Ok(value) = serde_json::from_slice::<Value>(&bytes)
            && value["exp"].as_i64().is_some_and(|exp| exp > now)
            && value.is_object()
        {
            return value;
        }
    }
    json!({"id":uuid::Uuid::new_v4().to_string(),"tier":"visitor"})
}
fn cookie(
    response: &mut Response,
    session: &mut Value,
    secret: &str,
    now: i64,
) -> Result<(), Error> {
    session["exp"] = json!(now + AGE * 1000);
    let data = URL_SAFE_NO_PAD.encode(serde_json::to_vec(session)?);
    response.headers_mut().append(
        "set-cookie",
        format!(
            "corvus_layer={data}.{}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age={AGE}",
            sign(secret, &data)
        )
        .parse()?,
    );
    Ok(())
}
pub fn confirm_email(
    state: &AppState,
    headers: &HeaderMap,
    response: &mut Response,
    subscriber: &str,
) -> Result<(), Error> {
    let secret = crypto::server_secret(&state.settings)?;
    let now = chrono::Utc::now().timestamp_millis();
    let mut session = read_session(headers, &secret, now);
    session["subscriber"] = json!(subscriber);
    session["tier"] = json!("email");
    cookie(response, &mut session, &secret, now)
}
fn army_digest(secret: &str, value: &str) -> String {
    hex::encode(crypto::hmac(
        secret.as_bytes(),
        format!("army:v1:{value}").as_bytes(),
    ))
}
async fn json_get(state: &AppState, key: &str) -> Result<Value, Error> {
    let raw = state.store.get(key).await?;
    Ok(match raw.as_str() {
        Some(v) => serde_json::from_str(v)?,
        None => Value::Null,
    })
}
async fn current_tier(
    state: &AppState,
    headers: &HeaderMap,
    session: &Value,
) -> Result<Tier, Error> {
    if let Some(raw) = crypto::cookie(headers, "army_session") {
        let bits: Vec<_> = raw.split('.').collect();
        let army_secret = state
            .settings
            .get("ARMY_SECRET")
            .map(str::to_owned)
            .map(Ok)
            .unwrap_or_else(|| crypto::server_secret(&state.settings))?;
        if bits.len() == 2
            && bits[0].len() == 24
            && bits[0]
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            && crypto::safe_equal(
                bits[1],
                &army_digest(&army_secret, &format!("army_session:{}", bits[0])),
            )
        {
            let prefix = state
                .settings
                .get("ARMY_NAMESPACE")
                .map(str::to_owned)
                .unwrap_or_else(|| {
                    if state.settings.get("VERCEL_ENV") == Some("preview") {
                        format!(
                            "army:preview:{}:",
                            &army_digest(
                                &army_secret,
                                state
                                    .settings
                                    .get("VERCEL_GIT_COMMIT_REF")
                                    .unwrap_or("preview")
                            )[..12]
                        )
                    } else {
                        "army:v1:".into()
                    }
                });
            let record = json_get(
                state,
                &format!("{prefix}session:{}", army_digest(&army_secret, bits[0])),
            )
            .await?;
            if let Some(uid) = record["uid"].as_str().filter(|s| {
                s.len() == 24
                    && s.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            }) {
                let user = json_get(state, &format!("{prefix}u:{uid}")).await?;
                let tier = corvus_core::army::member_tier(&user);
                if tier != Tier::Visitor {
                    return Ok(tier);
                }
            }
        }
    }
    if let Some(id) = session["subscriber"].as_str()
        && json_get(state, &key(state, &format!("subscriber:{id}"))).await?["status"] == "confirmed"
    {
        return Ok(Tier::Email);
    }
    Ok(Tier::Visitor)
}
pub async fn meter(
    state: &AppState,
    id: &str,
    zone: &str,
    tab: &str,
    operation: &str,
    now: i64,
) -> Result<i64, Error> {
    let day = local_day(now, zone).ok_or("Invalid timezone")?;
    let prefix = key(state, &format!("taste:{{{id}:{day}}}"));
    let value = state
        .store
        .command(vec![
            "EVAL".into(),
            METER.into(),
            "2".into(),
            prefix.clone(),
            format!("{prefix}:tabs"),
            now.to_string(),
            (TASTE_SECONDS * 1000).to_string(),
            "15000".into(),
            tab.into(),
            operation.into(),
        ])
        .await?;
    value
        .as_i64()
        .ok_or_else(|| "Invalid meter response".into())
}
fn screen(status: StatusCode, text: &str, body: &str) -> Response {
    let html = format!(
        "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{text} | Corvus</title><link rel=\"stylesheet\" href=\"/styles.css\"><link rel=\"stylesheet\" href=\"/css/site/shell.css\"><body><main class=\"site-page\"><p class=\"site-eyebrow\">corvus / legion</p><h1>{text}</h1>{body}</main><footer class=\"site-next site-quiet-footer\"><a href=\"/\"><img src=\"/logo.png\" width=\"28\" height=\"28\" alt=\"Corvus home\"></a><a href=\"/map/\">map</a><a href=\"#lang-switcher\">language</a><a href=\"/privacy/\">privacy</a></footer><script type=\"module\" src=\"/js/i18n/bar.js\"></script></body></html>"
    );
    (status, [("content-type", "text/html; charset=utf-8")], html).into_response()
}
fn answer(status: StatusCode, value: Value) -> Response {
    (status, Json(value)).into_response()
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    query: &HashMap<String, String>,
    body: &[u8],
) -> Result<Response, Error> {
    let page = (method == Method::GET || method == Method::HEAD)
        && query.get("action").is_some_and(|v| v == "layer_page");
    let args = if page {
        serde_json::to_value(query)?
    } else {
        if method != Method::POST {
            return Ok(answer(
                StatusCode::METHOD_NOT_ALLOWED,
                json!({"error":"Use the page."}),
            ));
        }
        let origin = headers
            .get("origin")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let allowed = ["https://corvus.gent", "https://www.corvus.gent"].contains(&origin)
            || ["VERCEL_URL", "VERCEL_BRANCH_URL"].iter().any(|k| {
                state
                    .settings
                    .get(k)
                    .is_some_and(|v| origin == format!("https://{v}"))
            })
            || state.settings.get("LEGION_TEST_ORIGIN") == Some(origin);
        if !allowed
            || !headers
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .is_some_and(|v| v.starts_with("application/json"))
        {
            return Ok(answer(StatusCode::FORBIDDEN, json!({"error":"forbidden"})));
        }
        let args: Value = serde_json::from_slice(body)?;
        if !args.is_object()
            || body.len() > 6000
            || corvus_core::army::truthy(&args["website"])
            || args["action"] != "layer_tick"
        {
            return Ok(answer(StatusCode::BAD_REQUEST, json!({"error":"fields"})));
        }
        args
    };
    let Some((path, required)) = tier_path(args["path"].as_str().unwrap_or("")) else {
        return Ok(StatusCode::NOT_FOUND.into_response());
    };
    let now = chrono::Utc::now().timestamp_millis();
    let secret = crypto::session_secret(&state.settings)?;
    let mut session = read_session(headers, &secret, now);
    let tier = current_tier(state, headers, &session).await?;
    session["tier"] = serde_json::to_value(tier)?;
    let admitted = tier >= required;
    let mut timer = String::new();
    let mut response = if !admitted && required != Tier::Soldier {
        let name = serde_json::to_value(required)?
            .as_str()
            .unwrap_or("visitor")
            .to_string();
        if !page {
            answer(StatusCode::FORBIDDEN, json!({"required":required}))
        } else {
            let action = if required == Tier::Email {
                "<a href=\"/daily/#signup\">Confirm your email →</a>"
            } else {
                "<a href=\"/legion/\">See the Legion ranks →</a>"
            };
            screen(
                StatusCode::FORBIDDEN,
                &format!("The {name} layer."),
                &format!(
                    "{action}<p><a href=\"/army/access/\">Already a member? Sign in →</a></p>"
                ),
            )
        }
    } else {
        if !admitted {
            let supplied = args["zone"]
                .as_str()
                .filter(|s| s.len() <= 80 && local_day(now, s).is_some());
            if session["zone"].as_str().is_none() && supplied.is_none() {
                let mut r = if page {
                    screen(
                        StatusCode::OK,
                        "Your daily taste.",
                        "<script src=\"/js/site/taste-zone.js\"></script><noscript><p>The preview needs JavaScript to time your visit. <a href=\"/legion/\">Enter the Legion →</a></p></noscript>",
                    )
                } else {
                    answer(StatusCode::CONFLICT, json!({"reload":true}))
                };
                cookie(&mut r, &mut session, &secret, now)?;
                return Ok(secure(r));
            }
            let id = session["id"]
                .as_str()
                .ok_or("Missing session identity")?
                .to_string();
            if session["zone"].as_str().is_none() {
                let k = key(state, &format!("taste-zone:{id}"));
                state
                    .store
                    .command(vec![
                        "SET".into(),
                        k.clone(),
                        supplied.ok_or("Missing timezone")?.into(),
                        "NX".into(),
                        "EX".into(),
                        AGE.to_string(),
                    ])
                    .await?;
                session["zone"] = state.store.get(&k).await?;
            }
            let tab = if page {
                uuid::Uuid::new_v4().to_string()
            } else {
                args["tab"].as_str().unwrap_or("").to_string()
            };
            if tab.len() != 36
                || !tab
                    .bytes()
                    .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c) || c == b'-')
            {
                return Ok(answer(
                    StatusCode::BAD_REQUEST,
                    json!({"error":"Invalid tab."}),
                ));
            }
            let operation = if !page && args["operation"] == "pause" {
                "pause"
            } else {
                "read"
            };
            let remaining = meter(
                state,
                &id,
                session["zone"].as_str().ok_or("Invalid timezone")?,
                &tab,
                operation,
                now,
            )
            .await?;
            if !page || remaining == 0 {
                let mut r = if !page {
                    answer(
                        if remaining > 0 {
                            StatusCode::OK
                        } else {
                            StatusCode::PAYMENT_REQUIRED
                        },
                        json!({"remaining":remaining}),
                    )
                } else {
                    screen(
                        StatusCode::PAYMENT_REQUIRED,
                        "402 · payment required",
                        "<p>come back tomorrow or become a soldier</p><p>Your daily taste returns at 04:02 local time.</p><a href=\"/legion/\">Become a soldier →</a>",
                    )
                };
                cookie(&mut r, &mut session, &secret, now)?;
                return Ok(secure(r));
            }
            let seconds = (remaining + 999) / 1000;
            timer = format!(
                "<aside class=\"layer-clock\" data-tab=\"{tab}\" data-remaining=\"{remaining}\"><span>{}:{:02}</span> · payment required</aside><script type=\"module\" src=\"/js/site/taste.js\"></script>",
                seconds / 60,
                seconds % 60
            );
        }
        if !page {
            answer(StatusCode::OK, json!({"admitted":true}))
        } else {
            // `path` comes only from the five-entry tier allowlist, never an arbitrary filename.
            let html = tokio::fs::read_to_string(format!(".{path}/index.html")).await?;
            (
                StatusCode::OK,
                [("content-type", "text/html; charset=utf-8")],
                html.replacen("</body>", &format!("{timer}</body>"), 1),
            )
                .into_response()
        }
    };
    cookie(&mut response, &mut session, &secret, now)?;
    Ok(secure(response))
}
fn secure(mut response: Response) -> Response {
    for (k, v) in [
        ("cache-control", "private, no-store, max-age=0"),
        ("vary", "Cookie"),
        ("referrer-policy", "no-referrer"),
        ("x-content-type-options", "nosniff"),
        ("x-robots-tag", "noindex, nofollow"),
    ] {
        response
            .headers_mut()
            .insert(k, axum::http::HeaderValue::from_static(v));
    }
    response
}
