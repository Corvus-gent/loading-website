pub use crate::compound_v2::security::header;
use crate::{AppState, Error, config::Settings, crypto, voter};
use axum::http::{HeaderMap, HeaderValue};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use serde_json::{Value, json};
pub fn prefix(env: &Settings) -> &str {
    env.get("COMPOUND_KEY_PREFIX").unwrap_or("compound")
}
fn sign(env: &Settings, value: &str) -> Result<String, Error> {
    let secret = env
        .get("COMPOUND_AUTH_SECRET")
        .map(str::to_string)
        .map(Ok)
        .unwrap_or_else(|| crypto::server_secret(env))?;
    Ok(crypto::sign(&secret, &format!("compound:{value}")))
}
pub fn identity(env: &Settings, h: &HeaderMap) -> Result<(String, Option<HeaderValue>), Error> {
    let (id, cookie) = voter::ensure_language(env, h)?;
    Ok((sign(env, &format!("voter:{id}"))?, cookie))
}
pub fn same_origin(env: &Settings, h: &HeaderMap) -> bool {
    let o = header(h, "origin");
    ["https://corvus.gent", "https://www.corvus.gent"].contains(&o)
        || ["VERCEL_URL", "VERCEL_BRANCH_URL"]
            .iter()
            .any(|k| env.get(k).is_some_and(|v| o == format!("https://{v}")))
        || (env.get("VERCEL_ENV") == Some("preview")
            && o == "https://loading-website-compound-preview-corvus11.vercel.app")
        || (env.get("NODE_ENV") != Some("production") && o == "http://127.0.0.1:4201")
}
pub fn authorized(env: &Settings, h: &HeaderMap, role: &str, now: i64) -> Result<bool, Error> {
    let bearer = header(h, "authorization");
    if env
        .get("COMPOUND_ADMIN_PASSWORD")
        .is_some_and(|s| crypto::safe_equal(s, bearer.strip_prefix("Bearer ").unwrap_or(bearer)))
    {
        return Ok(true);
    }
    let Some(cookie) = crypto::cookie(h, "compound_auth") else {
        return Ok(false);
    };
    let mut parts = cookie.split('.');
    let (Some(body), Some(signature)) = (parts.next(), parts.next()) else {
        return Ok(false);
    };
    if body.is_empty() || !crypto::safe_equal(signature, &sign(env, body)?) {
        return Ok(false);
    }
    let Ok(raw) = URL_SAFE_NO_PAD.decode(body) else {
        return Ok(false);
    };
    let Ok(s) = serde_json::from_slice::<Value>(&raw) else {
        return Ok(false);
    };
    let exp = crate::compound_v2::model::number(&s["exp"]);
    Ok(
        exp.is_some_and(|exp| exp > (now as f64) && exp < ((now + 14401000) as f64))
            && (s["role"] == "admin" || s["role"] == role),
    )
}
pub fn login(
    env: &Settings,
    role: &str,
    password: &Value,
    now: i64,
) -> Result<Option<HeaderValue>, Error> {
    let expected = env.get(if role == "admin" {
        "COMPOUND_ADMIN_PASSWORD"
    } else {
        "COMPOUND_STATS_PASSWORD"
    });
    if !expected
        .zip(password.as_str())
        .is_some_and(|(a, b)| crypto::safe_equal(a, b))
    {
        return Ok(None);
    }
    let body = URL_SAFE_NO_PAD.encode(
        json!({"role":role,"exp":now+14400000,"nonce":hex::encode(rand::random::<[u8;12]>())})
            .to_string(),
    );
    Ok(Some(format!("compound_auth={body}.{}; Path=/api/compound; Max-Age=14400; HttpOnly; Secure; SameSite=Strict",sign(env,&body)?).parse()?))
}
pub async fn limit(
    state: &AppState,
    h: &HeaderMap,
    kind: &str,
    max: i64,
    seconds: i64,
) -> Result<bool, Error> {
    let now = crate::compound_v2::model::now();
    let hash = crypto::daily_ip_hash(
        &crypto::server_secret(&state.settings)?,
        header(h, "x-forwarded-for"),
        &format!("compound-{kind}"),
        &now[..10],
    );
    let key = format!("{}:rate:{kind}:{hash}", prefix(&state.settings));
    let n=state.store.command(vec!["EVAL".into(),"local n=redis.call('INCR',KEYS[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n".into(),"1".into(),key,seconds.to_string()]).await?;
    Ok(n.as_i64().unwrap_or(i64::MAX) <= max)
}
