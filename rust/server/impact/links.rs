use super::store::Impact;
use crate::{
    AppState, Error,
    compound_v2::{model, security, store::Registry},
    config::Settings,
    crypto,
};
use axum::http::{HeaderMap, Method};
use serde_json::Value;
use url::Url;

pub fn target(env: &Settings, raw: &str) -> Result<String, Error> {
    let mut u = Url::parse(if raw.is_empty() {
        "https://compound.mov/"
    } else {
        raw
    })
    .map_err(|_| "Invalid Compound destination.")?;
    if u.scheme() != "https"
        || !matches!(u.host_str(), Some("compound.mov" | "www.compound.mov"))
        || !u.username().is_empty()
        || u.password().is_some()
        || u.port().is_some()
        || u.as_str().encode_utf16().count() > 2000
    {
        return Err("Invalid Compound destination.".into());
    }
    let param = env.get("COMPOUND_REF_PARAM").unwrap_or("ref");
    if let Some(code) = env.get("COMPOUND_REF_CODE")
        && (1..=40).contains(&param.len())
        && param.as_bytes()[0].is_ascii_alphabetic()
        && param
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
    {
        // URLSearchParams.set retains the first occurrence's position and removes duplicate keys.
        let mut pairs = Vec::new();
        let mut found = false;
        for (k, v) in u.query_pairs() {
            if k == param {
                if !found {
                    pairs.push((k.into_owned(), code.to_string()));
                    found = true;
                }
            } else {
                pairs.push((k.into_owned(), v.into_owned()));
            }
        }
        if !found {
            pairs.push((param.into(), code.into()));
        }
        u.query_pairs_mut().clear().extend_pairs(pairs);
    }
    Ok(u.into())
}
pub async fn count(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    placement: &str,
) -> Result<Value, Error> {
    let ua = security::header(headers, "user-agent").to_ascii_lowercase();
    let purpose = security::header(headers, "purpose");
    let purpose = if purpose.is_empty() {
        security::header(headers, "sec-purpose")
    } else {
        purpose
    };
    if method != Method::GET
        || [
            "bot",
            "crawler",
            "spider",
            "preview",
            "curl",
            "wget",
            "headless",
            "facebookexternalhit",
            "discord",
            "slack",
        ]
        .iter()
        .any(|s| ua.contains(s))
        || purpose.to_ascii_lowercase().contains("prefetch")
    {
        return Ok(Value::Bool(false));
    }
    let id = format!("compound-{placement}");
    let day = model::now();
    let hash = crypto::daily_ip_hash(
        &crypto::server_secret(&state.settings)?,
        security::header(headers, "x-forwarded-for"),
        &format!("compound-click:{id}"),
        &day[..10],
    );
    let store = Impact(state);
    Registry(state).eval("redis.call('HINCRBY',KEYS[4],ARGV[1],1);if not redis.call('SET',KEYS[1],'1','NX','EX',1800) then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('HINCRBY',KEYS[3],ARGV[1],1);redis.call('EXPIRE',KEYS[3],31536000);return 1",&[store.key(&format!("click-dedupe:{id}:{hash}")),store.key("clicks"),store.key(&format!("clicks:{}",&day[..10])),store.key("raw-clicks")],&[id]).await
}
