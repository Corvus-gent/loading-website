//! Opt-in Army HTTP API. Owner session, origins and write mode are checked before side effects.
use super::{
    auth::Auth,
    discord::Discord,
    jobs::Jobs,
    model,
    payments::Payments,
    public::Public,
    security,
    service::Service,
    store::{Army, DAY},
};
use crate::{AppState, Error, crypto};
use axum::{
    Json,
    body::Body,
    http::{
        HeaderMap, Method, StatusCode,
        header::{LOCATION, SET_COOKIE},
    },
    response::{IntoResponse, Response},
};
use corvus_core::army::{public_soldier, truthy};
use serde_json::{Value, json};
use std::collections::HashMap;
fn q<'a>(query: &'a HashMap<String, String>, key: &str) -> &'a str {
    query.get(key).map(String::as_str).unwrap_or("")
}
fn ok(v: Value) -> Response {
    Json(v).into_response()
}
fn fail(status: u16, code: &str) -> Response {
    (
        StatusCode::from_u16(status).unwrap_or(StatusCode::SERVICE_UNAVAILABLE),
        Json(json!({"error":code})),
    )
        .into_response()
}
fn mapped(e: Error) -> Response {
    let message = e.to_string();
    let code = if [
        "fields",
        "username",
        "email",
        "link",
        "why",
        "action",
        "verification",
        "expired",
        "session",
        "already_enlisted",
        "unavailable_name_or_email",
        "unverified",
        "missing",
        "feather",
        "login",
        "rate",
        "busy",
    ]
    .contains(&message.as_str())
    {
        message.as_str()
    } else {
        "resting"
    };
    let mut response = fail(
        match code {
            "login" => 401,
            "rate" => 429,
            "busy" => 409,
            "resting" => 503,
            _ => 400,
        },
        code,
    );
    if code == "rate" {
        response
            .headers_mut()
            .insert("retry-after", axum::http::HeaderValue::from_static("60"));
    }
    response
}
fn protected(mut response: Response, extra: HeaderMap) -> Response {
    response.headers_mut().insert(
        "cache-control",
        axum::http::HeaderValue::from_static("private, no-store"),
    );
    response.headers_mut().insert(
        "referrer-policy",
        axum::http::HeaderValue::from_static("no-referrer"),
    );
    response.headers_mut().insert(
        "x-content-type-options",
        axum::http::HeaderValue::from_static("nosniff"),
    );
    for value in extra.get_all(SET_COOKIE) {
        response.headers_mut().append(SET_COOKIE, value.clone());
    }
    response
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    query: &HashMap<String, String>,
    raw: &[u8],
) -> Result<Response, Error> {
    let mut extra = HeaderMap::new();
    let result = Box::pin(inner(state, method, h, query, raw, &mut extra)).await;
    Ok(protected(result.unwrap_or_else(mapped), extra))
}
async fn inner(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    query: &HashMap<String, String>,
    raw: &[u8],
    extra: &mut HeaderMap,
) -> Result<Response, Error> {
    if !state.store.connected() {
        return Ok(fail(503, "resting"));
    }
    let army = Army::new(state)?;
    let service = Service::new(&army, None, 16)?;
    if q(query, "job") == "1" {
        let token = state.settings.get("CRON_SECRET").unwrap_or("");
        if token.is_empty()
            || !crypto::safe_equal(
                h.get("authorization")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or(""),
                &format!("Bearer {token}"),
            )
        {
            return Ok(fail(401, "unauthorized"));
        }
        if !state.settings.write_enabled() {
            return Ok(fail(503, "resting"));
        }
        return Ok(ok(Box::pin(
            Jobs {
                army: &army,
                fixture: None,
            }
            .run(q(query, "dry") == "1"),
        )
        .await?));
    }
    if query.contains_key("unsubscribe") {
        if method != Method::GET && method != Method::POST {
            return Ok(StatusCode::METHOD_NOT_ALLOWED.into_response());
        }
        Box::pin(Auth(&army).unsubscribe(q(query, "unsubscribe"))).await?;
        return Ok(([("content-type","text/html; charset=utf-8")],"<!doctype html><html lang=\"en\"><meta name=\"viewport\" content=\"width=device-width\"><meta name=\"referrer\" content=\"no-referrer\"><title>the crow is quiet</title><body style=\"background:#000;color:#ddd;font:18px monospace;padding:10vw\"><h1>the crow is quiet.</h1><p>you are unsubscribed. that subscription is deleted.</p><a style=\"color:#ffd76a\" href=\"/games/\">back to the games →</a></body></html>").into_response());
    }
    if query.contains_key("ref") {
        let code = q(query, "ref");
        if method != Method::GET || !security::valid_code(code) {
            return Ok(fail(404, "missing"));
        }
        let parent = army.by_code(code).await?;
        if parent.is_null() || parent["status"] == "deleting" {
            return Ok(fail(404, "missing"));
        }
        if !army
            .rate(
                "redirect",
                &security::rate_hash(&state.settings, h, "redirect", army.now())?,
                60,
                60,
            )
            .await?
        {
            return Ok(fail(429, "rate"));
        }
        if security::read_cookie(&state.settings, h, "army_ref", "army_ref")?.is_none() {
            extra.append(
                SET_COOKIE,
                security::cookie(&state.settings, "army_ref", code, 30 * DAY, "army_ref")?,
            );
        }
        return Ok((
            StatusCode::TEMPORARY_REDIRECT,
            [(
                LOCATION,
                if q(query, "to") == "games" {
                    "/games/"
                } else {
                    "/join-the-army-now/"
                },
            )],
            Body::empty(),
        )
            .into_response());
    }
    if query.contains_key("profile") {
        let user = army
            .by_name(&model::username(&json!(q(query, "profile"))))
            .await?;
        if !(truthy(&user["verifiedAt"]) || truthy(&user["legion"])) || user["status"] == "deleting"
        {
            return Ok(fail(404, "missing"));
        }
        // Image/profile HTML remain on the legacy route until the shared publishing gate.
        if q(query, "image") == "1" || q(query, "html") == "1" {
            return Ok(fail(501, "render_migration_pending"));
        }
        return Ok(ok(
            json!({"soldier":public_soldier(&user,true,army.now()),"code":user["code"]}),
        ));
    }
    let body: Value = if raw.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(raw).map_err(|_| "fields")?
    };
    let body = if truthy(&body) { body } else { json!({}) };
    if q(query, "admin") == "1" {
        if !crate::auth::session(state, h)
            .await?
            .is_some_and(|(_, email)| email.eq_ignore_ascii_case("gabriel@corvus.gent"))
        {
            return Ok(fail(403, "forbidden"));
        }
        if method == Method::GET {
            return Ok(ok(service
                .admin_list(&serde_json::to_value(query)?)
                .await?));
        }
        if method != Method::POST || !security::same_origin(&state.settings, h) {
            return Ok(fail(403, "forbidden"));
        }
        validate_body(&body)?;
        return match body["action"].as_str().unwrap_or("") {
            "approve-help" => {
                let user = army.by_name(&model::username(&body["username"])).await?;
                if !truthy(&user["verifiedAt"]) {
                    return Ok(fail(400, "unverified"));
                }
                Ok(ok(Box::pin(army.approve_help(
                    user["id"].as_str().ok_or("session")?,
                    &body,
                ))
                .await?))
            }
            "flush-mail" => Ok(ok(Box::pin(service.mail.flush(false, None)).await?)),
            "sync-tolls" => Ok(ok(Box::pin(Payments(&army).drain()).await?)),
            "link-toll" => {
                let id = body["payment"].as_str().ok_or("fields")?;
                let result = Box::pin(Payments(&army).link(id, &body["username"])).await?;
                sync_payment(&army, id).await;
                Ok(ok(result))
            }
            action => {
                let id = body["id"]
                    .as_str()
                    .filter(|s| security::valid_id(s))
                    .ok_or("fields")?;
                Ok(ok(Box::pin(service.admin(action, id, &body)).await?))
            }
        };
    }
    if method == Method::GET {
        return Ok(ok(match q(query, "view") {
            "legion" => Public(&army).legion().await?,
            "public" => Public(&army).summary().await?,
            _ => {
                json!({"self":service.own_profile(&Box::pin(service.identity(h,extra,false)).await?,!army.session(h).await?.is_null()).await?})
            }
        }));
    }
    if method != Method::POST {
        return Ok(fail(405, "method"));
    }
    if !security::same_origin(&state.settings, h) {
        return Ok(fail(403, "forbidden"));
    }
    validate_body(&body)?;
    Ok(ok(match body["action"].as_str().unwrap_or("") {
        "begin" => {
            json!({"self":service.own_profile(&Box::pin(service.identity(h,extra,true)).await?,!army.session(h).await?.is_null()).await?})
        }
        "challenge" => {
            Box::pin(service.challenge(h, extra, body["for"].as_str().unwrap_or(""))).await?
        }
        "claim" => Box::pin(service.claim(h, extra, body["token"].as_str().unwrap_or(""))).await?,
        "discord-code" => {
            let user = army.session(h).await?;
            if user.is_null() {
                return Ok(fail(401, "login"));
            }
            Discord::new(&army, None)?.issue(&user).await?
        }
        "profile" => {
            let user = army.session(h).await?;
            let uid = user["id"].as_str().ok_or("login")?;
            Box::pin(army.locked(uid, async {
                let mut current = army.user(uid).await?;
                if current.is_null() {
                    return Err("session".into());
                }
                current["link"] = json!(model::link(&body["link"])?);
                current["country"] = json!(model::country(&body["country"]));
                current["hidden"] = json!(body["hidden"] == true);
                army.persist(&current).await?;
                Ok(())
            }))
            .await?;
            json!({"self":service.own_profile(&army.user(uid).await?,true).await?})
        }
        action @ ("export" | "delete" | "logout") => {
            let mut user = army.session(h).await?;
            if user.is_null() {
                let anon = Box::pin(service.identity(h, extra, false)).await?;
                if !truthy(&anon["email"]) {
                    user = anon;
                }
            }
            let uid = user["id"].as_str().ok_or("login")?;
            if action == "export" {
                army.export_data(uid).await?
            } else {
                if action == "delete" {
                    if body["confirm"] != true {
                        return Ok(fail(400, "confirm"));
                    }
                    Box::pin(army.remove(uid)).await?;
                    for name in ["army_id", "army_session", "army_ref"] {
                        extra.append(
                            SET_COOKIE,
                            security::cookie(&state.settings, name, "", 0, name)?,
                        );
                    }
                } else {
                    extra.append(
                        SET_COOKIE,
                        security::cookie(&state.settings, "army_session", "", 0, "army_session")?,
                    );
                }
                json!({"ok":true})
            }
        }
        _ => Box::pin(service.submit(h, &body)).await?,
    }))
}
fn validate_body(body: &Value) -> Result<(), Error> {
    if !body.is_object() || body.to_string().encode_utf16().count() > 5000 {
        Err("fields".into())
    } else {
        Ok(())
    }
}
pub async fn sync_payment(army: &Army<'_>, id: &str) {
    if let Ok(p) = army.get(&format!("bmc:event:{id}")).await
        && let Some(uid) = p["uid"].as_str()
        && let Ok(user) = army.user(uid).await
        && !user.is_null()
        && let Ok(discord) = Discord::new(army, None)
    {
        let _ = tokio::time::timeout(std::time::Duration::from_secs(8), discord.sync(&user)).await;
    }
}
