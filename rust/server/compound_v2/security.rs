use super::model;
use crate::{AppState, Error, config::Settings, crypto, voter};
use axum::http::{HeaderMap, HeaderValue};
use serde_json::{Value, json};

pub fn prefix(env: &Settings) -> &str {
    env.get("COMPOUND_V2_PREFIX")
        .unwrap_or(if env.production() {
            "compound:v2"
        } else {
            "compound:v2:preview"
        })
}
pub fn header<'a>(headers: &'a HeaderMap, key: &str) -> &'a str {
    headers.get(key).and_then(|s| s.to_str().ok()).unwrap_or("")
}
fn password(env: &Settings) -> Option<&str> {
    env.get("COMPOUND_V2_ADMIN_PASSWORD")
        .or(env.get("COMPOUND_ADMIN_PASSWORD"))
}
fn sign(env: &Settings, body: &str) -> Result<String, Error> {
    Ok(crypto::sign(
        &crypto::server_secret(env)?,
        &format!(
            "compound-v2:{body}:{}",
            password(env).ok_or("missing admin password")?
        ),
    ))
}
pub fn authorized(env: &Settings, headers: &HeaderMap, now: i64) -> Result<bool, Error> {
    let Some(pass) = password(env) else {
        return Ok(false);
    };
    let bearer = header(headers, "authorization");
    if crypto::safe_equal(bearer.strip_prefix("Bearer ").unwrap_or(bearer), pass) {
        return Ok(true);
    }
    let Some(raw) = crypto::cookie(headers, "compound_v2_admin") else {
        return Ok(false);
    };
    let parts = raw.split('.').collect::<Vec<_>>();
    if parts.len() != 3 || parts[0].len() != 13 || !parts[0].bytes().all(|c| c.is_ascii_digit()) {
        return Ok(false);
    }
    if !crypto::safe_equal(parts[2], &sign(env, &format!("{}.{}", parts[0], parts[1]))?) {
        return Ok(false);
    }
    Ok(parts[0]
        .parse::<i64>()
        .is_ok_and(|exp| exp > now && exp <= now + 14401000))
}
pub fn login(env: &Settings, supplied: &Value, now: i64) -> Result<Option<HeaderValue>, Error> {
    if !password(env)
        .zip(supplied.as_str())
        .is_some_and(|(a, b)| crypto::safe_equal(a, b))
    {
        return Ok(None);
    }
    let value = format!(
        "{}.{}",
        now + 14400000,
        hex::encode(rand::random::<[u8; 12]>())
    );
    Ok(Some(format!("compound_v2_admin={value}.{}; Path=/api; Max-Age=14400; HttpOnly; Secure; SameSite=Strict",sign(env,&value)?).parse()?))
}
pub const LOGOUT: &str =
    "compound_v2_admin=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict";
pub fn same_origin(env: &Settings, headers: &HeaderMap) -> bool {
    let origin = header(headers, "origin");
    ["https://corvus.gent", "https://www.corvus.gent"].contains(&origin)
        || [
            "VERCEL_URL",
            "VERCEL_BRANCH_URL",
            "VERCEL_PROJECT_PRODUCTION_URL",
        ]
        .iter()
        .any(|key| {
            env.get(key)
                .is_some_and(|host| origin == format!("https://{host}"))
        })
        || (env.get("NODE_ENV") != Some("production") && origin == "http://127.0.0.1:4420")
}
pub fn analytics(body: &Value, headers: &HeaderMap) -> Value {
    let enabled = (body["analytics"] == true || body["analytics"] == "session")
        && header(headers, "sec-gpc") != "1"
        && header(headers, "dnt") != "1";
    let visitor = body["visitor"].as_str().filter(|s| {
        enabled
            && s.len() == 36
            && s.bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c) || c == b'-')
    });
    json!({"enabled":enabled,"visitor":visitor})
}
pub fn identity(
    env: &Settings,
    headers: &HeaderMap,
) -> Result<(String, Option<HeaderValue>), Error> {
    let (id, cookie) = voter::ensure_language(env, headers)?;
    let secret = env
        .get("COMPOUND_AUTH_SECRET")
        .map(str::to_string)
        .map(Ok)
        .unwrap_or_else(|| crypto::server_secret(env))?;
    Ok((
        crypto::sign(&secret, &format!("compound:voter:{id}")),
        cookie,
    ))
}
pub async fn limit(
    state: &AppState,
    headers: &HeaderMap,
    kind: &str,
    max: i64,
    seconds: i64,
) -> Result<bool, Error> {
    let day = model::now();
    let hash = crypto::daily_ip_hash(
        &crypto::server_secret(&state.settings)?,
        header(headers, "x-forwarded-for"),
        &format!("compound-v2-{kind}"),
        &day[..10],
    );
    let key = format!("{}:rate:{kind}:{hash}", prefix(&state.settings));
    let count=state.store.command(vec!["EVAL".into(),"local n=redis.call('INCR',KEYS[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n".into(),"1".into(),key,seconds.to_string()]).await?;
    Ok(model::count(&count) <= max)
}
