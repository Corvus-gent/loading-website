use crate::config::{ConfigError, Settings};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use url::Url;
type HmacSha256 = Hmac<Sha256>;
pub fn hmac(key: &[u8], value: &[u8]) -> Vec<u8> {
    let Ok(mut mac) = HmacSha256::new_from_slice(key) else {
        return Vec::new();
    };
    mac.update(value);
    mac.finalize().into_bytes().to_vec()
}
pub fn sha(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}
pub fn safe_equal(a: &str, b: &str) -> bool {
    bool::from(a.as_bytes().ct_eq(b.as_bytes()))
}
pub fn sign(secret: &str, value: &str) -> String {
    URL_SAFE_NO_PAD.encode(hmac(secret.as_bytes(), value.as_bytes()))
}
pub fn hash(secret: &str, value: &str) -> String {
    sha(&format!("{value}{secret}"))
}
pub fn server_secret(env: &Settings) -> Result<String, ConfigError> {
    for key in [
        "PRIVACY_SECRET",
        "SESSION_SECRET",
        "VOTE_SECRET",
        "REDIS_PRIVACY_SEED",
    ] {
        if let Some(v) = env.get(key) {
            return Ok(v.to_string());
        }
    }
    if let Some(v) = env
        .get("REDIS_PRIVACY_SEED_ENV")
        .and_then(|key| env.get(key))
    {
        return Ok(v.to_string());
    }
    if let Some(v) = env
        .suffix("REST_API_TOKEN", false)?
        .or(env.suffix("REDIS_REST_TOKEN", false)?)
    {
        return Ok(v.to_string());
    }
    if let Some(v) = env
        .get("REDIS_URL")
        .filter(|v| Url::parse(v).is_ok_and(|u| u.password().is_some_and(|p| !p.is_empty())))
    {
        return Ok(v.to_string());
    }
    Err(ConfigError::Missing)
}
pub fn credential_seed(env: &Settings) -> Result<String, ConfigError> {
    let verified = server_secret(env)?;
    if let Some(v) = env.get("REDIS_IDENTITY_SEED") {
        return Ok(v.to_string());
    }
    Ok(env
        .get("REDIS_URL")
        .filter(|v| Url::parse(v).is_ok_and(|u| u.password().is_some_and(|p| !p.is_empty())))
        .map(str::to_string)
        .unwrap_or(verified))
}
pub fn session_secret(env: &Settings) -> Result<String, ConfigError> {
    if let Some(v) = env.get("SESSION_SECRET") {
        return Ok(v.to_string());
    }
    Ok(sha(&format!("corvus{}", credential_seed(env)?)))
}
pub fn music_vote_secret(env: &Settings) -> Result<String, ConfigError> {
    for key in ["MUSIC_VOTE_SECRET", "VOTE_SECRET", "SESSION_SECRET"] {
        if let Some(v) = env.get(key) {
            return Ok(v.into());
        }
    }
    credential_seed(env)
}
pub fn language_vote_secret(env: &Settings) -> Result<String, ConfigError> {
    for key in ["LANGUAGE_VOTE_SECRET", "VOTE_SECRET"] {
        if let Some(v) = env.get(key) {
            return Ok(v.into());
        }
    }
    Ok(sha(&credential_seed(env)?))
}
pub fn game_secret(env: &Settings) -> Result<String, ConfigError> {
    for key in ["GAME_SECRET", "SESSION_SECRET", "VOTE_SECRET"] {
        if let Some(v) = env.get(key) {
            return Ok(v.into());
        }
    }
    credential_seed(env)
}
pub fn daily_ip_hash(secret: &str, forwarded: &str, scope: &str, day: &str) -> String {
    let address = forwarded.split(',').next().unwrap_or("").trim();
    let salt = hmac(
        secret.as_bytes(),
        format!("corvus:rate-limit:{day}:{scope}").as_bytes(),
    );
    format!(
        "d1:{}",
        hex::encode(hmac(
            &salt,
            if address.is_empty() {
                b"unknown"
            } else {
                address.as_bytes()
            }
        ))
    )
}
pub fn cookie<'a>(headers: &'a axum::http::HeaderMap, name: &str) -> Option<&'a str> {
    headers
        .get("cookie")?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|p| {
            let (key, value) = p.trim().split_once('=')?;
            (key == name).then_some(value)
        })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn equality_uses_bytes() {
        assert!(safe_equal("é", "é"));
        assert!(!safe_equal("é", "e"));
        assert!(!safe_equal("abc", "abcd"));
    }
    #[test]
    fn missing_secret_is_not_a_public_default() {
        assert!(session_secret(&Settings::new(Default::default())).is_err());
    }
}
