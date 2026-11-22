use super::{
    model::{self, count, text},
    store::Registry,
};
use crate::{
    Error,
    config::{Settings, is_loopback},
};
use chrono::{SecondsFormat, Utc};
use regex::Regex;
use serde_json::{Value, json};
use std::{sync::LazyLock, time::Duration};
use url::Url;
pub const ENDPOINT: &str =
    "https://connect.oriane.xyz/rest/contents/search?limit=100&projection=basic";
static TIKTOK: LazyLock<Option<Regex>> = LazyLock::new(|| Regex::new(r"/video/(\d+)/?$").ok());
static INSTAGRAM: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"^/(?:p|reel|tv)/([A-Za-z0-9_-]{5,20})/?$").ok());
pub fn configured(env: &Settings) -> bool {
    env.get("ORIANE_API_KEY")
        .is_some_and(|s| !model::trim(s).is_empty())
}
pub fn platform_id(video: &Value) -> Option<Value> {
    let url = Url::parse(text(&video["post_url"])).ok()?;
    let h = url
        .host_str()?
        .strip_prefix("www.")
        .unwrap_or(url.host_str()?);
    if video["platform"] == "tt" && ["tiktok.com", "m.tiktok.com"].contains(&h) {
        let id = TIKTOK.as_ref()?.captures(url.path())?[1].to_string();
        return Some(json!({"platform":"tiktok","platformId":id}));
    }
    if video["platform"] == "ig" && h == "instagram.com" {
        let captures = INSTAGRAM.as_ref()?.captures(url.path())?;
        let mut id = 0u128;
        for c in captures[1].bytes() {
            let digit = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
                .iter()
                .position(|v| *v == c)?;
            id = id.checked_mul(64)?.checked_add(digit as u128)?;
        }
        return Some(json!({"platform":"instagram","platformId":id.to_string()}));
    }
    None
}
pub async fn status(registry: &Registry<'_>) -> Result<Value, Error> {
    if !configured(&registry.0.settings) {
        return Ok(json!({"enabled":false,"mode":"manual","note":"Metrics are entered by Gabe."}));
    }
    let raw = registry.0.store.get(&registry.key("oriane:status")).await?;
    let mut result = json!({"enabled":true,"mode":"oriane"});
    let fields = if let Some(raw) = raw.as_str() {
        serde_json::from_str::<Value>(raw)?
    } else {
        json!({"note":"Oriane checks eligible TikTok/Instagram posts when this page is visited, at most every 15 minutes. Other platforms use manual entry."})
    };
    for (k, v) in fields.as_object().ok_or("invalid provider status")? {
        result[k] = v.clone();
    }
    Ok(result)
}
async fn refresh(registry: &Registry<'_>, endpoint: &str, result: &mut Value) -> Result<(), Error> {
    let all = registry
        .videos()
        .await?
        .into_iter()
        .filter(|v| v["is_example"] != true)
        .filter_map(|v| platform_id(&v).map(|id| (v, id)))
        .collect::<Vec<_>>();
    result["candidates"] = json!(all.len());
    let mut distinct = Vec::new();
    for (_, id) in &all {
        if !distinct.contains(id) {
            distinct.push(id.clone());
        }
    }
    for ids in distinct.chunks(100) {
        let response = registry
            .0
            .http
            .post(endpoint)
            .bearer_auth(
                registry
                    .0
                    .settings
                    .get("ORIANE_API_KEY")
                    .ok_or("missing provider configuration")?,
            )
            .timeout(Duration::from_secs(8))
            .json(&json!({"operator":"and","filters":{"platformId":{"includes":ids}}}))
            .send()
            .await?;
        if !response.status().is_success() {
            return Err("provider unavailable".into());
        }
        let body: Value = response.json().await?;
        for item in body["data"]["results"]
            .as_array()
            .ok_or("invalid response")?
        {
            if !ids.iter().any(|id| {
                id["platform"] == item["platform"] && id["platformId"] == item["platformId"]
            }) {
                continue;
            }
            let mut metrics = json!({});
            for (ours, theirs) in [
                ("views", "viewsCount"),
                ("likes", "likesCount"),
                ("comments", "commentsCount"),
                ("shares", "sharesCount"),
            ] {
                if let Some(n) = item[theirs]
                    .as_f64()
                    .filter(|n| n.is_finite() && (0.0..=1e12).contains(n) && n.fract() == 0.0)
                {
                    metrics[ours] = json!(n as u64);
                }
            }
            if metrics.as_object().is_none_or(|v| v.is_empty()) {
                continue;
            }
            for (video, _) in all.iter().filter(|(_, id)| {
                id["platform"] == item["platform"] && id["platformId"] == item["platformId"]
            }) {
                result["matched"] = json!(count(&result["matched"]) + 1);
                if registry.apply_synced_metrics(video, &metrics).await? {
                    result["updated"] = json!(count(&result["updated"]) + 1);
                }
            }
        }
    }
    result["state"] = json!(
        if count(&result["matched"]) < count(&result["candidates"]) {
            "partial"
        } else {
            "ok"
        }
    );
    result["note"] = json!(if all.is_empty() {
        "No published TikTok/Instagram post URLs yet. Add them in the table.".into()
    } else {
        format!(
            "Oriane updated {} posts. {} not indexed or unavailable; their previous values are kept. Other platforms use manual entry.",
            count(&result["updated"]),
            count(&result["candidates"]) - count(&result["matched"])
        )
    });
    Ok(())
}
pub async fn due(registry: &Registry<'_>) -> Result<Value, Error> {
    with_endpoint(registry, ENDPOINT).await
}
// The alternate transport exists only for isolated contract tests; no caller-provided URL is fetched in deployment.
pub async fn with_endpoint(registry: &Registry<'_>, endpoint: &str) -> Result<Value, Error> {
    if !configured(&registry.0.settings) {
        return Ok(json!({"skipped":true}));
    }
    if endpoint != ENDPOINT
        && !(registry.0.settings.get("CORVUS_RUST_WRITES") == Some("isolated")
            && registry.0.settings.write_enabled()
            && Url::parse(endpoint).is_ok_and(|u| is_loopback(&u)))
    {
        return Err("invalid provider endpoint".into());
    }
    let acquired = registry
        .0
        .store
        .command(vec![
            "SET".into(),
            registry.key("oriane:due"),
            "1".into(),
            "NX".into(),
            "EX".into(),
            "900".into(),
        ])
        .await?;
    if acquired.is_null() {
        return Ok(json!({"skipped":true}));
    }
    let mut result =
        json!({"attempted_at":model::now(),"updated":0,"matched":0,"candidates":0,"state":"ok"});
    let complete = tokio::time::timeout(
        Duration::from_secs(25),
        refresh(registry, endpoint, &mut result),
    )
    .await;
    if !matches!(complete, Ok(Ok(()))) {
        result["state"] = json!("error");
        result["note"] = json!(
            "Oriane could not complete this check. Previous numbers are kept; manual entry still works."
        );
    }
    result["completed_at"] = json!(model::now());
    result["next_check"] = json!(
        (Utc::now() + chrono::Duration::seconds(900)).to_rfc3339_opts(SecondsFormat::Millis, true)
    );
    registry
        .0
        .store
        .command(vec![
            "SET".into(),
            registry.key("oriane:status"),
            result.to_string(),
            "EX".into(),
            model::RETENTION.to_string(),
        ])
        .await?;
    Ok(result)
}
