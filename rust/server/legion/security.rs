pub use crate::compound_v2::security::header;
use crate::{AppState, Error, config::Settings, crypto};
use axum::http::{HeaderMap, HeaderValue};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use serde_json::Value;
pub fn prefix(env: &Settings) -> &str {
    env.get("LEGION_NAMESPACE").unwrap_or(if env.production() {
        "legion:v2:"
    } else {
        "legion:preview:v2:"
    })
}
pub fn key(env: &Settings, suffix: &str) -> String {
    format!("{}{suffix}", prefix(env))
}
pub fn token() -> String {
    URL_SAFE_NO_PAD.encode(rand::random::<[u8; 32]>())
}
pub fn valid_token(v: &Value) -> bool {
    v.as_str().is_some_and(|s| {
        (43..=128).contains(&s.len())
            && s.bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    })
}
pub fn password_stamp(env: &Settings) -> Result<String, Error> {
    Ok(hex::encode(crypto::hmac(
        crypto::server_secret(env)?.as_bytes(),
        format!("admin:{}", env.get("ADMIN_PASSWORD").unwrap_or("undefined")).as_bytes(),
    )))
}
pub fn same_origin(env: &Settings, h: &HeaderMap) -> bool {
    let origin = header(h, "origin");
    ["https://corvus.gent", "https://www.corvus.gent"].contains(&origin)
        || ["VERCEL_URL", "VERCEL_BRANCH_URL"]
            .iter()
            .any(|k| env.get(k).is_some_and(|v| origin == format!("https://{v}")))
        || env.get("LEGION_TEST_ORIGIN").is_some_and(|v| origin == v)
}
pub fn cookie(name: &str, value: &str, seconds: i64) -> Result<HeaderValue, Error> {
    Ok(
        format!("{name}={value}; Path=/; Max-Age={seconds}; HttpOnly; Secure; SameSite=Strict")
            .parse()?,
    )
}
pub async fn authorized(state: &AppState, h: &HeaderMap) -> Result<bool, Error> {
    if state.settings.get("ADMIN_PASSWORD").is_none() {
        return Ok(false);
    }
    let Some(raw) =
        crypto::cookie(h, "corvus_admin").filter(|s| valid_token(&Value::String(s.to_string())))
    else {
        return Ok(false);
    };
    let saved = state
        .store
        .get(&key(
            &state.settings,
            &format!("admin:{}", crypto::sha(raw)),
        ))
        .await?;
    Ok(saved.as_str().is_some_and(|s| {
        password_stamp(&state.settings).is_ok_and(|stamp| crypto::safe_equal(s, &stamp))
    }))
}
pub async fn rate(state: &AppState, k: &str, max: i64, seconds: i64) -> Result<bool, Error> {
    let r=state.store.command(vec!["EVAL".into(),"local n=redis.call('INCR',KEYS[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n".into(),"1".into(),k.into(),seconds.to_string()]).await?;
    Ok(r.as_i64().is_some_and(|n| n <= max))
}
pub async fn limited(
    state: &AppState,
    h: &HeaderMap,
    scope: &str,
    max: i64,
    seconds: i64,
) -> Result<bool, Error> {
    let hash = crypto::daily_ip_hash(
        &crypto::server_secret(&state.settings)?,
        header(h, "x-forwarded-for"),
        &format!("legion:{scope}"),
        &chrono::Utc::now().format("%Y-%m-%d").to_string(),
    );
    rate(
        state,
        &key(&state.settings, &format!("rate:{scope}:{hash}")),
        max,
        seconds,
    )
    .await
}
pub async fn login(
    state: &AppState,
    h: &HeaderMap,
    password: &Value,
) -> Result<HeaderValue, Error> {
    if !limited(state, h, "login", 5, 900).await?
        || !rate(state, &key(&state.settings, "login-global"), 100, 900).await?
    {
        return Err("rate".into());
    }
    let expected = state.settings.get("ADMIN_PASSWORD").ok_or("unauthorized")?;
    let submitted = if corvus_core::army::truthy(password) {
        corvus_core::impact::string(password)
    } else {
        String::new()
    };
    if !crypto::safe_equal(&crypto::sha(&submitted), &crypto::sha(expected)) {
        return Err("unauthorized".into());
    }
    let raw = token();
    state
        .store
        .command(vec![
            "SET".into(),
            key(&state.settings, &format!("admin:{}", crypto::sha(&raw))),
            password_stamp(&state.settings)?,
            "EX".into(),
            "28800".into(),
        ])
        .await?;
    cookie("corvus_admin", &raw, 28800)
}
pub async fn logout(state: &AppState, h: &HeaderMap) -> Result<HeaderValue, Error> {
    if let Some(raw) = crypto::cookie(h, "corvus_admin") {
        state
            .store
            .command(vec![
                "DEL".into(),
                key(&state.settings, &format!("admin:{}", crypto::sha(raw))),
            ])
            .await?;
    }
    cookie("corvus_admin", "", 0)
}
