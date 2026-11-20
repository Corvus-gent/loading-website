use crate::{Error, config::Settings, crypto};
use axum::http::{HeaderMap, HeaderValue};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
pub fn secret(env: &Settings) -> Result<String, Error> {
    env.get("ARMY_SECRET")
        .map(str::to_owned)
        .map(Ok)
        .unwrap_or_else(|| crypto::server_secret(env).map_err(Into::into))
}
pub fn digest(env: &Settings, value: &str) -> Result<String, Error> {
    Ok(hex::encode(crypto::hmac(
        secret(env)?.as_bytes(),
        format!("army:v1:{value}").as_bytes(),
    )))
}
pub fn id() -> String {
    URL_SAFE_NO_PAD.encode(rand::random::<[u8; 18]>())
}
pub fn recruit_code() -> String {
    const ALPHABET: &[u8] = b"abcdefghijklmnopqrstuvwxyz234567";
    rand::random::<[u8; 8]>()
        .into_iter()
        .map(|b| ALPHABET[(b & 31) as usize] as char)
        .collect()
}
pub fn valid_id(v: &str) -> bool {
    v.len() == 24
        && v.bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
pub fn valid_code(v: &str) -> bool {
    v.len() == 8
        && v.bytes()
            .all(|c| c.is_ascii_lowercase() || (b'2'..=b'7').contains(&c))
}
pub fn namespace(env: &Settings) -> Result<String, Error> {
    if let Some(p) = env.get("ARMY_NAMESPACE") {
        return Ok(p.into());
    }
    if env.get("VERCEL_ENV") == Some("preview") {
        Ok(format!(
            "army:preview:{}:",
            &digest(env, env.get("VERCEL_GIT_COMMIT_REF").unwrap_or("preview"))?[..12]
        ))
    } else {
        Ok("army:v1:".into())
    }
}
pub fn signed(env: &Settings, value: &str, scope: &str) -> Result<String, Error> {
    Ok(format!(
        "{value}.{}",
        digest(env, &format!("{scope}:{value}"))?
    ))
}
pub fn read_cookie(
    env: &Settings,
    h: &HeaderMap,
    name: &str,
    scope: &str,
) -> Result<Option<String>, Error> {
    let Some(raw) = crypto::cookie(h, name) else {
        return Ok(None);
    };
    let mut pieces = raw.split('.');
    let (Some(value), Some(sig)) = (pieces.next(), pieces.next()) else {
        return Ok(None);
    };
    if pieces.next().is_some_and(|s| !s.is_empty()) || value.is_empty() || sig.is_empty() {
        return Ok(None);
    }
    Ok(crypto::safe_equal(sig, &digest(env, &format!("{scope}:{value}"))?).then(|| value.into()))
}
pub fn cookie(
    env: &Settings,
    name: &str,
    value: &str,
    seconds: i64,
    scope: &str,
) -> Result<HeaderValue, Error> {
    let raw = if value.is_empty() {
        String::new()
    } else {
        signed(env, value, scope)?
    };
    Ok(
        format!("{name}={raw}; Path=/; Max-Age={seconds}; HttpOnly; Secure; SameSite=Lax")
            .parse()?,
    )
}

/// Preserve the existing persisted envelope: base64url(12-byte nonce | 16-byte tag | body).
/// Every seal uses a fresh random nonce; no raw token is written to the outbox.
pub fn seal(env: &Settings, value: &str) -> Result<String, Error> {
    use ring::aead::{Aad, Nonce};
    let nonce = rand::random::<[u8; 12]>();
    let mut body = value.as_bytes().to_vec();
    let tag = mail_key(env)?
        .seal_in_place_separate_tag(Nonce::assume_unique_for_key(nonce), Aad::empty(), &mut body)
        .map_err(|_| "cipher")?;
    let mut out = nonce.to_vec();
    out.extend_from_slice(tag.as_ref());
    out.extend_from_slice(&body);
    Ok(URL_SAFE_NO_PAD.encode(out))
}
fn mail_key(env: &Settings) -> Result<ring::aead::LessSafeKey, Error> {
    let bytes = hex::decode(digest(env, "mail-encryption")?)?;
    let key =
        ring::aead::UnboundKey::new(&ring::aead::AES_256_GCM, &bytes).map_err(|_| "cipher")?;
    Ok(ring::aead::LessSafeKey::new(key))
}
pub fn open(env: &Settings, value: &str) -> Result<String, Error> {
    use ring::aead::{Aad, Nonce};
    let raw = URL_SAFE_NO_PAD.decode(value).map_err(|_| "cipher")?;
    if raw.len() < 28 {
        return Err("cipher".into());
    }
    let nonce = Nonce::try_assume_unique_for_key(&raw[..12]).map_err(|_| "cipher")?;
    let mut body = raw[28..].to_vec();
    body.extend_from_slice(&raw[12..28]);
    let key = mail_key(env)?;
    let plain = key
        .open_in_place(nonce, Aad::empty(), &mut body)
        .map_err(|_| "cipher")?;
    Ok(String::from_utf8_lossy(plain).into_owned())
}
