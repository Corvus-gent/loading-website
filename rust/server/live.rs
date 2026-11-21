//! Stream status, cached server-only Twitch credentials, and existing click counters.
use crate::{AppState, Error, config::Settings, crypto};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::Mutex;

#[derive(Clone, Deserialize)]
pub struct Config {
    pub live: Value,
    pub stream: String,
    pub until: String,
    pub socials: Vec<Value>,
}
impl Config {
    pub fn embedded() -> Result<Self, serde_json::Error> {
        serde_json::from_str(include_str!("../migration/live-config.json"))
    }
    pub fn hack_mode(&self, mode: Option<&str>, now: i64) -> Value {
        let mode = match mode {
            Some("on") => "on",
            Some("off") => "off",
            _ => "auto",
        };
        let until = chrono::DateTime::parse_from_rfc3339(&self.until)
            .map(|d| d.timestamp_millis())
            .unwrap_or(0);
        json!({"mode":mode,"until":self.until,"enabled":mode=="on"||(mode=="auto"&&now<until),"serverTime":now})
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Status {
    pub live: bool,
    pub source: String,
    pub session: String,
}
#[derive(Default)]
struct Cache {
    token: String,
    token_until: i64,
    status: Option<Status>,
    until: i64,
}
#[derive(Clone)]
pub struct StatusReader {
    cache: Arc<Mutex<Cache>>,
    mode: Value,
    stream: String,
    token_url: String,
    streams_url: String,
}
impl StatusReader {
    pub fn new(mode: Value, stream: String) -> Self {
        Self {
            cache: Arc::new(Mutex::new(Cache::default())),
            mode,
            stream,
            token_url: "https://id.twitch.tv/oauth2/token".into(),
            streams_url: "https://api.twitch.tv/helix/streams?user_login=gabe_maxxing".into(),
        }
    }
    fn manual(&self, source: &str) -> Status {
        Status {
            live: self.mode == Value::Bool(true),
            source: source.into(),
            session: format!("manual-{}", self.stream),
        }
    }
    pub async fn read(&self, settings: &Settings, http: &reqwest::Client, now: i64) -> Status {
        let (Some(id), Some(secret)) = (
            settings.get("TWITCH_CLIENT_ID"),
            settings.get("TWITCH_CLIENT_SECRET"),
        ) else {
            return self.manual("manual");
        };
        if self.mode != Value::String("auto".into()) {
            return self.manual("manual");
        }
        // The lock coalesces simultaneous polls and keeps access tokens out of responses/logs.
        let mut cache = self.cache.lock().await;
        if now < cache.until
            && let Some(status) = &cache.status
        {
            return status.clone();
        }
        let result = self
            .fetch(http, &mut cache, id, secret, now)
            .await
            .unwrap_or_else(|_| self.manual("fallback"));
        cache.until = now + 60_000;
        cache.status = Some(result.clone());
        result
    }
    async fn fetch(
        &self,
        http: &reqwest::Client,
        cache: &mut Cache,
        id: &str,
        secret: &str,
        now: i64,
    ) -> Result<Status, Error> {
        if cache.token.is_empty() || now >= cache.token_until {
            let body = url::form_urlencoded::Serializer::new(String::new())
                .append_pair("client_id", id)
                .append_pair("client_secret", secret)
                .append_pair("grant_type", "client_credentials")
                .finish();
            let data: Value = http
                .post(&self.token_url)
                .timeout(Duration::from_secs(4))
                .header("content-type", "application/x-www-form-urlencoded")
                .body(body)
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?;
            cache.token = data["access_token"]
                .as_str()
                .filter(|s| !s.is_empty())
                .ok_or("token unavailable")?
                .into();
            let seconds = data["expires_in"]
                .as_f64()
                .or_else(|| data["expires_in"].as_str().and_then(|v| v.parse().ok()))
                .unwrap_or(0.0);
            cache.token_until = now.saturating_add(((seconds - 60.0).max(0.0) * 1000.0) as i64);
        }
        let response = http
            .get(&self.streams_url)
            .timeout(Duration::from_secs(4))
            .header("Client-Id", id)
            .bearer_auth(&cache.token)
            .send()
            .await?;
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            cache.token.clear();
            cache.token_until = 0;
        }
        let data: Value = response.error_for_status()?.json().await?;
        let streams = data["data"].as_array().ok_or("invalid status")?;
        let live = streams.iter().find(|s| {
            s["user_login"]
                .as_str()
                .is_some_and(|s| s.eq_ignore_ascii_case("gabe_maxxing"))
                && s["type"] == "live"
        });
        let session = live
            .map(|s| {
                let id = s["id"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .or_else(|| s["started_at"].as_str())
                    .unwrap_or("undefined");
                format!("twitch-{id}")
            })
            .unwrap_or_else(|| "offline".into());
        Ok(Status {
            live: live.is_some(),
            source: "twitch".into(),
            session,
        })
    }
}
#[derive(Clone)]
pub struct LiveService {
    pub config: Config,
    banner: StatusReader,
    landing: StatusReader,
}
impl LiveService {
    pub fn new() -> Result<Self, serde_json::Error> {
        let config = Config::embedded()?;
        Ok(Self {
            banner: StatusReader::new(config.live.clone(), config.stream.clone()),
            landing: StatusReader::new(json!("auto"), config.stream.clone()),
            config,
        })
    }
}
pub fn destination(slug: &str) -> Option<&'static str> {
    match slug {
        "twitch" => Some("https://www.twitch.tv/gabe_maxxing"),
        "instagram" => Some("https://www.instagram.com/gabe.maxxing"),
        "twitter" => Some("https://x.com/gabe_maxxing"),
        _ => None,
    }
}
fn value<'a>(headers: &'a HeaderMap, key: &str) -> &'a str {
    headers.get(key).and_then(|v| v.to_str().ok()).unwrap_or("")
}
async fn count(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    slug: &str,
) -> Result<(), Error> {
    let ua = value(headers, "user-agent").to_ascii_lowercase();
    let purpose = if headers.contains_key("purpose") {
        value(headers, "purpose")
    } else {
        value(headers, "sec-purpose")
    }
    .to_ascii_lowercase();
    if method != Method::GET
        || [
            "bot", "crawler", "spider", "preview", "headless", "curl", "wget",
        ]
        .iter()
        .any(|v| ua.contains(v))
        || purpose.contains("prefetch")
    {
        return Ok(());
    }
    let prefix = if state.settings.production() {
        "live:clicks"
    } else {
        "live:preview:clicks"
    };
    let day = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let hash = crypto::daily_ip_hash(
        &crypto::server_secret(&state.settings)?,
        value(headers, "x-forwarded-for"),
        &format!("live-{slug}"),
        &day,
    );
    state.store.command(vec!["EVAL".into(),"if redis.call('SET',KEYS[1],'1','NX','EX',1800) then redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('HINCRBY',KEYS[3],ARGV[1],1) end;return 1".into(),"3".into(),format!("{prefix}:dedupe:{slug}:{hash}"),format!("{prefix}:all"),format!("{prefix}:{day}"),slug.into()]).await?;
    Ok(())
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    query: &HashMap<String, String>,
    body: &[u8],
) -> Result<Response, Error> {
    if query.get("form").is_some_and(|v| v == "interview")
        || query.get("interviews").is_some_and(|v| v == "1")
    {
        return super::live_interviews::handle(state, method, headers, query, body).await;
    }
    if method != Method::GET && method != Method::HEAD {
        return Ok((
            StatusCode::METHOD_NOT_ALLOWED,
            [("cache-control", "no-store"), ("allow", "GET, HEAD")],
            Json(json!({"error":"Use GET."})),
        )
            .into_response());
    }
    if let Some(slug) = query.get("slug").filter(|s| !s.is_empty()) {
        let Some(url) = destination(slug) else {
            return Ok((
                StatusCode::NOT_FOUND,
                [("cache-control", "no-store")],
                Json(json!({"error":"Unknown stream."})),
            )
                .into_response());
        };
        // Bound optional telemetry; redirects remain available during a datastore outage.
        let _ =
            tokio::time::timeout(Duration::from_secs(2), count(state, method, headers, slug)).await;
        return Ok((
            StatusCode::FOUND,
            [("cache-control", "no-store"), ("location", url)],
        )
            .into_response());
    }
    let now = chrono::Utc::now().timestamp_millis();
    let data = if query.get("landing").is_some_and(|v| v == "1") {
        let mut platforms = serde_json::Map::new();
        for account in &state.live.config.socials {
            if account["primary"] == true
                && let Some(p) = account["platform"].as_str()
            {
                platforms.insert(p.into(), account["isLive"].clone());
            }
        }
        let twitch = state
            .live
            .landing
            .read(&state.settings, &state.http, now)
            .await;
        if twitch.source == "twitch" {
            platforms.insert("twitch".into(), json!(twitch.live));
        }
        json!({"live":platforms.values().any(|v|v==true),"platforms":platforms,"hackMode":state.live.config.hack_mode(state.settings.get("HACK_LIVE_MODE"),now)})
    } else {
        serde_json::to_value(
            state
                .live
                .banner
                .read(&state.settings, &state.http, now)
                .await,
        )?
    };
    Ok((
        [("cache-control", "public, max-age=0, s-maxage=60")],
        Json(data),
    )
        .into_response())
}

#[cfg(test)]
mod tests;
