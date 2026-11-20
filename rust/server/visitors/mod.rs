//! Anonymous visit counters and bounded, server-only aggregate analytics.
pub mod model;
use crate::{
    AppState, Error, auth,
    config::{Settings, is_loopback},
};
use axum::{
    Json,
    body::Bytes,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::Utc;
use regex::Regex;
use serde_json::{Value, json};
use std::{collections::HashMap, sync::LazyLock, time::Duration};
use url::Url;
const INCREMENT: &str = "\n local n=redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120)\n if n>6000 then return 0 end\n redis.call('INCR',KEYS[2]);redis.call('EXPIRE',KEYS[2],34560000)\n redis.call('INCR',KEYS[3])\n if ARGV[1]~='' then redis.call('HINCRBY',KEYS[4],ARGV[1],1);redis.call('EXPIRE',KEYS[4],34560000) end\n return 1";
fn reply(code: u16, data: Value, cache: &str) -> Response {
    (
        StatusCode::from_u16(code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        [("cache-control", cache)],
        Json(data),
    )
        .into_response()
}
fn error(code: u16, message: &str) -> Response {
    reply(code, json!({"error":message}), "no-store")
}
fn no_content() -> Response {
    (StatusCode::NO_CONTENT, [("cache-control", "no-store")]).into_response()
}
pub fn day(at: i64) -> String {
    chrono::DateTime::from_timestamp_millis(at)
        .unwrap_or_default()
        .with_timezone(&chrono_tz::Europe::Brussels)
        .format("%Y-%m-%d")
        .to_string()
}
fn header<'a>(headers: &'a HeaderMap, key: &str) -> Option<&'a str> {
    headers.get(key).and_then(|h| h.to_str().ok())
}
pub async fn hit(
    s: &AppState,
    method: &Method,
    headers: &HeaderMap,
    body: &Bytes,
    soldier: bool,
) -> Response {
    let body: Value = serde_json::from_slice(body).unwrap_or(Value::Null);
    if !soldier && body.get("page").is_none() && body.get("day").is_none() {
        if *method != Method::POST || !s.store.connected() {
            return StatusCode::NO_CONTENT.into_response();
        }
        if !s.settings.write_enabled() {
            return error(503, "count unavailable");
        }
        let tool = body["tool"]
            .as_str()
            .filter(|t| {
                [
                    "curl",
                    "wget",
                    "httpie",
                    "python",
                    "go",
                    "node",
                    "postman",
                    "insomnia",
                    "powershell",
                    "other",
                ]
                .contains(t)
            })
            .unwrap_or("other");
        for key in [
            format!("cli:{}", day(Utc::now().timestamp_millis())),
            "cli:all".into(),
        ] {
            if s.store
                .command(vec!["HINCRBY".into(), key, tool.into(), "1".into()])
                .await
                .is_err()
            {
                return error(503, "service unavailable");
            }
        }
        return StatusCode::NO_CONTENT.into_response();
    }
    if *method != Method::POST {
        return error(405, "method");
    }
    if !auth::ORIGINS.contains(&header(headers, "origin").unwrap_or("")) {
        return error(403, "origin");
    }
    let now = Utc::now().timestamp_millis();
    let today = day(now);
    let valid = body
        .as_object()
        .is_some_and(|o| o.keys().all(|k| ["page", "day"].contains(&k.as_str())))
        && body["day"] == today
        && (soldier
            || body["page"]
                .as_str()
                .is_some_and(|s| s.encode_utf16().count() <= 160));
    if !valid {
        return error(400, "invalid hit");
    }
    if !s.store.connected() {
        return error(503, "count unavailable");
    }
    let raw = body["page"].as_str().unwrap_or("");
    if !soldier
        && ["/private", "/stats/private", "/music/admin"]
            .iter()
            .any(|p| raw == *p || raw.starts_with(&format!("{p}/")))
    {
        return no_content();
    }
    if !s.settings.write_enabled() {
        return error(503, "count unavailable");
    }
    let page = if soldier {
        String::new()
    } else {
        corvus_core::analytics::path(&body["page"])
    };
    let prefix = if soldier {
        "soldiers:ok"
    } else {
        "unseen:hits"
    };
    match s
        .store
        .command(vec![
            "EVAL".into(),
            INCREMENT.into(),
            "4".into(),
            format!("counting:limit:{}", now / 60000),
            format!("{prefix}:{today}"),
            format!("{prefix}:all"),
            format!("unseen:pages:{today}"),
            page,
        ])
        .await
    {
        Ok(v) if model::number(&v) != 0.0 => no_content(),
        Ok(_) => {
            let mut r = error(429, "busy");
            r.headers_mut()
                .insert("retry-after", axum::http::HeaderValue::from_static("60"));
            r
        }
        Err(_) => error(503, "count unavailable"),
    }
}
pub async fn counters(s: &AppState, day: &str) -> Result<Value, Error> {
    let data = s
        .store
        .command(vec![
            "MGET".into(),
            format!("unseen:hits:{day}"),
            "unseen:hits:all".into(),
            format!("soldiers:ok:{day}"),
            "soldiers:ok:all".into(),
        ])
        .await?;
    Ok(
        json!({"unseen":{"day":model::number(&data[0]),"all":model::number(&data[1])},"soldiers":{"day":model::number(&data[2]),"all":model::number(&data[3])}}),
    )
}
fn decoded(raw: &str) -> Option<String> {
    let b = raw.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let pair = std::str::from_utf8(b.get(i + 1..i + 3)?).ok()?;
            out.push(u8::from_str_radix(pair, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}
fn location_text(headers: &HeaderMap, key: &str) -> String {
    let s = decoded(header(headers, key).unwrap_or("")).unwrap_or_default();
    static TEXT: LazyLock<Option<Regex>> =
        LazyLock::new(|| Regex::new(r"^[\p{L}\p{N} .’'-]{1,100}$").ok());
    if TEXT.as_ref().is_some_and(|pattern| pattern.is_match(&s)) {
        s
    } else {
        String::new()
    }
}
pub fn country(headers: &HeaderMap) -> Value {
    let code = header(headers, "x-vercel-ip-country").filter(|s| {
        s.len() == 2
            && s.bytes().all(|b| b.is_ascii_uppercase())
            && !['X', 'Z'].iter().any(|c| *s == c.to_string().repeat(2))
    });
    let city = location_text(headers, "x-vercel-ip-city");
    let region = location_text(headers, "x-vercel-ip-country-region");
    let mut result = json!({"countryCode":code});
    if code.is_some() && !region.is_empty() {
        result["region"] = json!(region);
    }
    let coord = |key| {
        header(headers, key)
            .map(|s| model::number(&json!(s)))
            .unwrap_or(f64::NAN)
    };
    let (lat, lng) = (
        coord("x-vercel-ip-latitude"),
        coord("x-vercel-ip-longitude"),
    );
    if code.is_some()
        && !city.is_empty()
        && lat.is_finite()
        && lng.is_finite()
        && lat.abs() <= 90.0
        && lng.abs() <= 180.0
    {
        result["city"] = json!(city);
        result["region"] = json!(region);
        result["lat"] = json!((lat * 10.0 + 0.5).floor() / 10.0);
        result["lng"] = json!((lng * 10.0 + 0.5).floor() / 10.0);
    }
    result
}
pub fn posthog_ready(settings: &Settings) -> bool {
    settings.get("POSTHOG_PERSONAL_API_KEY").is_some()
        && Url::parse(
            settings
                .get("POSTHOG_HOST")
                .unwrap_or("https://eu.posthog.com"),
        )
        .is_ok_and(|u| {
            u.scheme() == "https"
                && u.host_str() == Some("eu.posthog.com")
                && u.port().is_none()
                && u.username().is_empty()
                && u.password().is_none()
                && u.query().is_none()
                && u.fragment().is_none()
                && u.path() == "/"
        })
}
fn remote(s: &AppState, path: &str, host: &str) -> Result<Url, Error> {
    if let Some(fixture) = s.settings.get("CORVUS_RUST_ANALYTICS_FIXTURE_URL") {
        let u = Url::parse(fixture)?;
        if s.settings.production()
            || s.settings.get("CORVUS_RUST_WRITES") != Some("isolated")
            || !s.settings.write_enabled()
            || u.scheme() != "http"
            || !is_loopback(&u)
            || !u.username().is_empty()
            || u.password().is_some()
            || u.query().is_some()
            || u.fragment().is_some()
        {
            return Err("invalid analytics fixture".into());
        }
        return Ok(u.join(path)?);
    }
    if s.settings.get("CORVUS_RUST_WRITES") == Some("isolated") {
        return Err("analytics fixture required".into());
    }
    Ok(Url::parse(host)?.join(path)?)
}
async fn bytes(mut response: reqwest::Response, limit: usize) -> Result<Vec<u8>, Error> {
    if !response.status().is_success()
        || response.content_length().is_some_and(|n| n > limit as u64)
    {
        return Err("aggregate source unavailable".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if bytes.len() + chunk.len() > limit {
            return Err("aggregate response too large".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
pub async fn hogql(s: &AppState, sql: &str) -> Result<Vec<Value>, Error> {
    if !posthog_ready(&s.settings) {
        return Err("PostHog EU configuration required".into());
    }
    let project = s.settings.get("POSTHOG_PROJECT_ID").unwrap_or("331552");
    if project.is_empty() || project.len() > 20 || !project.bytes().all(|b| b.is_ascii_digit()) {
        return Err("invalid analytics project".into());
    }
    let url = remote(
        s,
        &format!("/api/projects/{project}/query/"),
        "https://eu.posthog.com",
    )?;
    let response = s
        .http
        .post(url)
        .bearer_auth(s.settings.get("POSTHOG_PERSONAL_API_KEY").ok_or("key")?)
        .json(&json!({"query":{"kind":"HogQLQuery","query":sql},"refresh":"force_blocking"}))
        .timeout(Duration::from_secs(10))
        .send()
        .await?;
    let body: Value = serde_json::from_slice(&bytes(response, 8 * 1024 * 1024).await?)?;
    Ok(body["results"].as_array().cloned().unwrap_or_default())
}
pub async fn geo_data(s: &AppState, day: &str) -> Result<Value, Error> {
    let detailed = model::query(day)?;
    let country = model::country_query(day)?;
    let (counts, locations) = tokio::join!(hogql(s, &country), hogql(s, &detailed));
    model::combine(&counts?, locations.as_deref().ok())
}
async fn tiles(s: &AppState, q: &HashMap<String, String>) -> Response {
    let key = s.settings.get("CARTO_BASEMAPS_KEY");
    let values = [q.get("z"), q.get("x"), q.get("y")];
    if values.iter().all(Option::is_none) {
        return reply(200, json!({"available":key.is_some()}), "no-store");
    }
    let parsed: Option<Vec<u32>> = values
        .iter()
        .map(|v| {
            v.filter(|s| !s.is_empty() && s.len() <= 7 && s.bytes().all(|b| b.is_ascii_digit()))
                .and_then(|s| s.parse().ok())
        })
        .collect();
    let Some(v) = parsed else {
        return error(400, "invalid tile");
    };
    if v[0] > 12 || v[1] >= 2u32.pow(v[0]) || v[2] >= 2u32.pow(v[0]) {
        return error(400, "invalid tile");
    }
    let Some(key) = key else {
        return error(503, "map background unavailable");
    };
    let fetch = async {
        let mut url = remote(
            s,
            &format!("/dark_nolabels/{}/{}/{}.png", v[0], v[1], v[2]),
            "https://basemaps.cartocdn.com",
        )?;
        url.query_pairs_mut().append_pair("key", key);
        let response = s
            .http
            .get(url)
            .timeout(Duration::from_secs(10))
            .send()
            .await?;
        let kind = response
            .headers()
            .get("content-type")
            .and_then(|h| h.to_str().ok())
            .filter(|s| s.contains("image/"))
            .ok_or("invalid tile type")?
            .to_string();
        let body = bytes(response, 2 * 1024 * 1024).await?;
        Ok::<_, Error>((kind, body))
    };
    match fetch.await {
        Ok((kind, body)) => (
            [
                ("cache-control", "public, max-age=86400, s-maxage=86400"),
                ("content-type", &kind),
            ],
            body,
        )
            .into_response(),
        Err(_) => error(502, "map background unavailable"),
    }
}
pub async fn geo(
    s: &AppState,
    method: &Method,
    headers: &HeaderMap,
    q: &HashMap<String, String>,
) -> Response {
    if *method != Method::GET {
        let mut r = error(405, "method not allowed");
        r.headers_mut()
            .insert("allow", axum::http::HeaderValue::from_static("GET"));
        return r;
    }
    if q.get("tiles").is_some_and(|v| v == "1") {
        return tiles(s, q).await;
    }
    if q.get("country").is_some_and(|v| v == "1") {
        return reply(200, country(headers), "private, no-store");
    }
    if !posthog_ready(&s.settings) {
        return error(503, "the lantern is out.");
    }
    let day = q
        .get("day")
        .map(String::as_str)
        .filter(|s| !s.is_empty())
        .unwrap_or("all");
    if !model::valid_day(day) {
        return error(400, "invalid day");
    }
    let key = format!("geo:v6:{day}");
    let cached = if s.store.connected() {
        s.store
            .command(vec!["GET".into(), key.clone()])
            .await
            .ok()
            .and_then(|v| {
                v.as_str()
                    .and_then(|s| serde_json::from_str::<Value>(s).ok())
            })
    } else {
        None
    };
    let data = if let Some(data) = cached.as_ref().filter(|v| v["geoVersion"] == 6) {
        Ok(data.clone())
    } else {
        geo_data(s, day).await
    };
    match data {
        Ok(mut data) => {
            if cached.is_none() && s.store.connected() && s.settings.write_enabled() {
                let _ = s
                    .store
                    .command(vec![
                        "SET".into(),
                        key,
                        data.to_string(),
                        "EX".into(),
                        "900".into(),
                    ])
                    .await;
            }
            data["tiles"] = json!(s.settings.get("CARTO_BASEMAPS_KEY").is_some());
            reply(200, data, "public, max-age=0, s-maxage=900")
        }
        Err(_) => error(502, "the lantern is out."),
    }
}
