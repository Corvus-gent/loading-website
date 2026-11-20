//! Preserve the two existing signed voter identities and one-use music proof challenges.
use crate::{AppState, Error, config::Settings, crypto};
use axum::http::{HeaderMap, HeaderValue};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use regex::Regex;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::sync::LazyLock;
static MUSIC: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"(?:^|;\s*)mvid=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)").ok());
static LANGUAGE: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"(?:^|;\s*)vid=([^;]+)").ok());
pub fn read_music(env: &Settings, cookies: &str) -> Result<Option<String>, Error> {
    let Some(c) = MUSIC.as_ref().and_then(|r| r.captures(cookies)) else {
        return Ok(None);
    };
    let signature = crypto::sign(&crypto::music_vote_secret(env)?, &c[1]);
    Ok(crypto::safe_equal(&c[2], &signature).then(|| c[1].to_string()))
}
pub fn read_language(env: &Settings, cookies: &str) -> Result<Option<String>, Error> {
    let Some(c) = LANGUAGE.as_ref().and_then(|r| r.captures(cookies)) else {
        return Ok(None);
    };
    let mut parts = c[1].split('.');
    let (Some(id), Some(sig)) = (parts.next(), parts.next()) else {
        return Ok(None);
    };
    if id.is_empty() || sig.is_empty() {
        return Ok(None);
    }
    Ok(
        crypto::safe_equal(sig, &crypto::sign(&crypto::language_vote_secret(env)?, id))
            .then(|| id.to_string()),
    )
}
pub fn cookies(headers: &HeaderMap) -> &str {
    headers
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
}
fn valid_id(s: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&s.len())
        && s.bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"_-".contains(&c))
}
pub fn ensure_music(
    env: &Settings,
    headers: &HeaderMap,
    adopt: Option<&str>,
) -> Result<(String, Option<HeaderValue>), Error> {
    if let Some(id) = read_music(env, cookies(headers))? {
        return Ok((id, None));
    }
    let id = adopt
        .filter(|s| valid_id(s, 16, 40))
        .map(str::to_string)
        .unwrap_or_else(|| URL_SAFE_NO_PAD.encode(rand::random::<[u8; 18]>()));
    let signature = crypto::sign(&crypto::music_vote_secret(env)?, &id);
    let cookie = format!(
        "mvid={id}.{signature}; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict"
    )
    .parse()?;
    Ok((id, Some(cookie)))
}
pub fn ensure_language(
    env: &Settings,
    headers: &HeaderMap,
) -> Result<(String, Option<HeaderValue>), Error> {
    if let Some(id) = read_language(env, cookies(headers))? {
        return Ok((id, None));
    }
    let id = URL_SAFE_NO_PAD.encode(rand::random::<[u8; 16]>());
    let signature = crypto::sign(&crypto::language_vote_secret(env)?, &id);
    let cookie = format!(
        "vid={id}.{signature}; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict"
    )
    .parse()?;
    Ok((id, Some(cookie)))
}
pub fn zero_bits(bytes: &[u8]) -> u32 {
    let mut n = 0;
    for b in bytes {
        n += b.leading_zeros();
        if *b != 0 {
            break;
        }
    }
    n
}
pub async fn make_challenge(state: &AppState, voter: &str, action: &str) -> Result<Value, Error> {
    let id = URL_SAFE_NO_PAD.encode(rand::random::<[u8; 18]>());
    let salt = hex::encode(rand::random::<[u8; 24]>());
    let seen = format!("music:seen:{voter}");
    state
        .store
        .command(vec![
            "SET".into(),
            seen.clone(),
            chrono::Utc::now().timestamp_millis().to_string(),
            "NX".into(),
            "EX".into(),
            "3600".into(),
        ])
        .await?;
    let raw = state.store.get(&seen).await?;
    let not_before = raw
        .as_str()
        .and_then(|s| s.parse::<i64>().ok())
        .ok_or("invalid challenge timestamp")?
        + 2000;
    let bits = if action == "suggest" { 18 } else { 16 };
    let data =
        json!({"voter":voter,"action":action,"salt":salt,"bits":bits,"notBefore":not_before});
    state
        .store
        .command(vec![
            "SET".into(),
            format!("music:challenge:{id}"),
            data.to_string(),
            "EX".into(),
            "300".into(),
        ])
        .await?;
    Ok(json!({"id":id,"salt":salt,"bits":bits,"notBefore":not_before}))
}
pub async fn verify_challenge(state: &AppState, voter: &str, body: &Value) -> Result<bool, Error> {
    let Some(id) = body["challenge"].as_str().filter(|s| valid_id(s, 24, 24)) else {
        return Ok(false);
    };
    let Some(nonce) = body["nonce"]
        .as_f64()
        .filter(|n| n.is_finite() && *n >= 0.0 && *n <= 9007199254740991.0 && n.fract() == 0.0)
    else {
        return Ok(false);
    };
    let raw = state
        .store
        .command(vec!["GETDEL".into(), format!("music:challenge:{id}")])
        .await?;
    let Some(raw) = raw.as_str() else {
        return Ok(false);
    };
    let ch: Value = serde_json::from_str(raw)?;
    if ch["voter"] != voter
        || ch["action"] != body["action"]
        || body["action"] == "suggest"
            && ch["notBefore"]
                .as_i64()
                .is_some_and(|t| chrono::Utc::now().timestamp_millis() < t)
    {
        return Ok(false);
    }
    let Some(salt) = ch["salt"].as_str() else {
        return Ok(false);
    };
    let zeros = zero_bits(&Sha256::digest(format!("{salt}:{nonce:.0}")));
    Ok(ch["bits"]
        .as_u64()
        .is_some_and(|bits| u64::from(zeros) >= bits))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn counts_leading_zero_bits() {
        assert_eq!(zero_bits(&[]), 0);
        assert_eq!(zero_bits(&[0, 0, 1, 0]), 23);
        assert_eq!(zero_bits(&[128, 0]), 0);
        assert_eq!(zero_bits(&[0, 8]), 12);
    }
}
