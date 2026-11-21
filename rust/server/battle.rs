//! Blind battle voting with compatible device/voter identities and atomic close/vote decisions.
use crate::{AppState, Error, crypto, voter};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet},
    time::Duration,
};
const FIGHTERS: [&str; 2] = ["codex", "compound"];
const PLATFORMS: [&str; 4] = ["tiktok", "instagram", "x", "linkedin"];
fn prefix(state: &AppState) -> &str {
    state
        .settings
        .get("BATTLE_TEST_PREFIX")
        .unwrap_or(if state.settings.production() {
            "battle:v1"
        } else {
            "battle:preview:v1"
        })
}
fn hash(secret: &str, value: &str) -> String {
    hex::encode(crypto::hmac(
        secret.as_bytes(),
        format!("battle:{value}").as_bytes(),
    ))
}
fn valid_device(s: &str) -> bool {
    (16..=64).contains(&s.len())
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
}
pub fn order(secret: &str, device: &str) -> [&'static str; 2] {
    if crypto::hmac(secret.as_bytes(), format!("battle:{device}").as_bytes())
        .first()
        .is_some_and(|b| b % 2 == 1)
    {
        ["compound", "codex"]
    } else {
        FIGHTERS
    }
}
fn header<'a>(h: &'a HeaderMap, key: &str) -> &'a str {
    h.get(key).and_then(|v| v.to_str().ok()).unwrap_or("")
}
fn authorized(state: &AppState, h: &HeaderMap) -> bool {
    let actual = header(h, "authorization");
    state.settings.get("BATTLE_ADMIN_KEY").is_some_and(|key| {
        crypto::safe_equal(actual.strip_prefix("Bearer ").unwrap_or(actual), key)
    })
}
fn same_origin(state: &AppState, h: &HeaderMap) -> bool {
    let origin = header(h, "origin");
    ["https://corvus.gent", "https://www.corvus.gent"].contains(&origin)
        || ["VERCEL_URL", "VERCEL_BRANCH_URL"].iter().any(|key| {
            state
                .settings
                .get(key)
                .is_some_and(|s| origin == format!("https://{s}"))
        })
        || state.settings.get("NODE_ENV") != Some("production") && origin == "http://127.0.0.1:4393"
}
fn ip(state: &AppState, h: &HeaderMap, scope: &str, offset: i64) -> Result<String, Error> {
    Ok(crypto::daily_ip_hash(
        &crypto::server_secret(&state.settings)?,
        header(h, "x-forwarded-for"),
        scope,
        &(chrono::Utc::now() - chrono::Duration::days(offset))
            .format("%Y-%m-%d")
            .to_string(),
    ))
}
fn ip_keys(state: &AppState, h: &HeaderMap, scope: &str) -> Result<Vec<String>, Error> {
    [0, 1]
        .iter()
        .map(|day| {
            Ok(format!(
                "{}:{scope}:{}",
                prefix(state),
                ip(state, h, &format!("battle-{scope}"), *day)?
            ))
        })
        .collect()
}
fn object(v: &Value) -> serde_json::Map<String, Value> {
    if let Some(o) = v.as_object() {
        return o.clone();
    }
    v.as_array()
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .chunks_exact(2)
        .filter_map(|p| Some((p[0].as_str()?.into(), p[1].clone())))
        .collect()
}
fn media() -> Result<Value, Error> {
    Ok(serde_json::from_str(include_str!(
        "../../battle/media.json"
    ))?)
}
fn num(v: Option<&Value>) -> i64 {
    v.and_then(|v| v.as_i64().or_else(|| v.as_str()?.parse().ok()))
        .unwrap_or(0)
}
fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(v) => *v,
        Value::Number(n) => n.as_f64().is_some_and(|n| n != 0.0),
        Value::String(s) => !s.is_empty(),
        _ => true,
    }
}
async fn status(state: &AppState, device: Option<&str>, h: &HeaderMap) -> Result<Value, Error> {
    let p = prefix(state);
    let secret = crypto::server_secret(&state.settings)?;
    let cookie = voter::read_music(&state.settings, voter::cookies(h))?;
    let rows = state
        .store
        .pipeline(vec![
            vec!["HGETALL".into(), format!("{p}:votes")],
            vec!["HGETALL".into(), format!("{p}:clicks")],
            vec!["HGETALL".into(), format!("{p}:meta")],
            vec![
                "GET".into(),
                format!(
                    "{p}:device:{}",
                    hash(&secret, device.filter(|s| !s.is_empty()).unwrap_or("none"))
                ),
            ],
            vec![
                "GET".into(),
                format!(
                    "{p}:voter:{}",
                    hash(&secret, cookie.as_deref().unwrap_or("none"))
                ),
            ],
        ])
        .await?;
    let counts = object(&rows[0]);
    let meta = object(&rows[2]);
    let codex = num(counts.get("codex"));
    let compound = num(counts.get("compound"));
    let media = media()?;
    let config: Value = serde_json::from_str(include_str!("../../battle/config.json"))?;
    let closed = meta.get("closed").and_then(Value::as_str) == Some("1");
    let pick = rows[3]
        .as_str()
        .filter(|s| !s.is_empty())
        .or_else(|| rows[4].as_str().filter(|s| !s.is_empty()));
    let views: Value = serde_json::from_str(
        meta.get("views")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .unwrap_or("[]"),
    )?;
    let mut result = json!({"votes":{"codex":codex,"compound":compound},"total":codex+compound,"clicks":object(&rows[1]),"views":views,"updated":meta.get("updated").and_then(Value::as_str).filter(|s|!s.is_empty()),"closed":closed,"winner":meta.get("winner").and_then(Value::as_str).filter(|s|!s.is_empty()),"ready":truthy(&media["codex"])&&truthy(&media["compound"]),"bonuses":media.get("bonuses").filter(|v|truthy(v)).cloned().unwrap_or(json!([])),"tips":config["tips"],"disclaimer":config["disclaimer"],"serverTime":chrono::Utc::now().timestamp_millis()});
    if pick.is_some() || closed {
        result["order"] = json!(
            device
                .filter(|s| valid_device(s))
                .map(|s| order(&secret, s))
        );
        result["pick"] = json!(pick);
    }
    Ok(result)
}
fn reply(code: StatusCode, body: Value) -> Response {
    (
        code,
        [
            ("cache-control", "no-store"),
            ("referrer-policy", "no-referrer"),
        ],
        Json(body),
    )
        .into_response()
}
fn error(code: StatusCode, message: &str) -> Response {
    reply(code, json!({"error":message}))
}
fn redirect(target: &str) -> Result<Response, Error> {
    let mut r = (
        StatusCode::FOUND,
        [
            ("cache-control", "no-store"),
            ("content-type", "application/json"),
            ("referrer-policy", "no-referrer"),
        ],
    )
        .into_response();
    r.headers_mut().insert("location", target.parse()?);
    Ok(r)
}
async fn count_click(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    slug: &str,
    content: &str,
    source: &str,
) -> Result<(), Error> {
    let ua = header(h, "user-agent").to_ascii_lowercase();
    if method != Method::GET
        || [
            "bot", "crawler", "spider", "preview", "headless", "curl", "wget",
        ]
        .iter()
        .any(|v| ua.contains(v))
    {
        return Ok(());
    }
    let p = prefix(state);
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let mut keys = ip_keys(state, h, &format!("click-{slug}"))?;
    keys.extend([
        format!("{p}:clicks"),
        format!("{p}:clicks-day:{today}"),
        format!("{p}:clicks-daily-start"),
    ]);
    let mut args=vec!["EVAL".into(),"if redis.call('EXISTS',KEYS[1])==0 and redis.call('EXISTS',KEYS[2])==0 then redis.call('SET',KEYS[1],'1','EX',1800); redis.call('HINCRBY',KEYS[3],ARGV[1],1); redis.call('HINCRBY',KEYS[4],ARGV[1],1);redis.call('SET',KEYS[5],ARGV[2],'NX'); end; return 1".into(),keys.len().to_string()];
    args.extend(keys);
    args.extend([format!("{content}:{source}"), today]);
    state.store.command(args).await?;
    Ok(())
}
pub fn validate_admin(body: &Value) -> Result<(), &'static str> {
    let Some(rows) = body["views"].as_array().filter(|rows| rows.len() == 8) else {
        return Err("Provide all eight rows and voting state.");
    };
    if !body["closed"].is_boolean() {
        return Err("Provide all eight rows and voting state.");
    }
    let mut seen = HashSet::new();
    for row in rows {
        let fighter = row["fighter"].as_str().unwrap_or("");
        let platform = row["platform"].as_str().unwrap_or("");
        let url = row["url"].as_str();
        let views = row["views"].as_f64();
        if !FIGHTERS.contains(&fighter)
            || !PLATFORMS.contains(&platform)
            || !seen.insert((fighter, platform))
            || views
                .is_none_or(|v| !v.is_finite() || !(0.0..=1e12).contains(&v) || v.fract() != 0.0)
            || url.is_none_or(|s| s.encode_utf16().count() > 2000)
        {
            return Err("Invalid views row.");
        }
        if let Some(url) = url.filter(|s| !s.is_empty())
            && !url::Url::parse(url).is_ok_and(|u| u.scheme() == "https")
        {
            return Err("Post links must use HTTPS.");
        }
    }
    Ok(())
}
async fn inner(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    q: &HashMap<String, String>,
    bytes: &[u8],
) -> Result<Response, Error> {
    let body = serde_json::from_slice::<Value>(bytes).unwrap_or(Value::Null);
    if let Some(slug) = q.get("slug").filter(|s| !s.is_empty()) {
        let Some((fighter, platform)) = slug.split_once('-') else {
            return Ok(error(StatusCode::NOT_FOUND, "Unknown link."));
        };
        let content = match fighter {
            "cx" => "codex",
            "cp" => "compound",
            "bio" => "bio",
            _ => return Ok(error(StatusCode::NOT_FOUND, "Unknown link.")),
        };
        let source = match platform {
            "tt" => "tiktok",
            "ig" => "instagram",
            "x" => "x",
            "li" => "linkedin",
            _ => return Ok(error(StatusCode::NOT_FOUND, "Unknown link.")),
        };
        let _ = tokio::time::timeout(
            Duration::from_secs(2),
            count_click(state, method, h, slug, content, source),
        )
        .await;
        // Query order is not significant; private Rust dispatch parameters are not forwarded.
        let mut params = q
            .iter()
            .filter(|(k, _)| !matches!(k.as_str(), "battle" | "slug" | "module"))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect::<std::collections::BTreeMap<_, _>>();
        for (k, v) in [
            ("utm_source", source),
            ("utm_medium", "video"),
            ("utm_campaign", "battle"),
            ("utm_content", content),
        ] {
            params.insert(k.into(), v.into());
        }
        let query = url::form_urlencoded::Serializer::new(String::new())
            .extend_pairs(params)
            .finish();
        return redirect(&format!("/battle?{query}"));
    }
    let action = q
        .get("action")
        .map(String::as_str)
        .filter(|s| !s.is_empty())
        .or(body["action"].as_str().filter(|s| !s.is_empty()))
        .unwrap_or("status");
    if method == Method::GET
        && let Some(side) = q.get("media").filter(|s| !s.is_empty())
    {
        let device = q.get("device").map(String::as_str).unwrap_or("");
        if !valid_device(device) || !matches!(side.as_str(), "A" | "B") {
            return Ok(error(StatusCode::BAD_REQUEST, "Invalid player."));
        }
        let fighter =
            order(&crypto::server_secret(&state.settings)?, device)[usize::from(side == "B")];
        if !truthy(&media()?[fighter]) {
            return Ok(error(StatusCode::NOT_FOUND, "Video not available yet."));
        }
        let extension = if q.get("poster").is_some_and(|s| s == "1") {
            "jpg"
        } else {
            "mp4"
        };
        return redirect(&format!("/public/battle/{fighter}.{extension}"));
    }
    if action == "admin" && !authorized(state, h) {
        return Ok(error(StatusCode::UNAUTHORIZED, "Admin access required."));
    }
    if method == Method::GET {
        return Ok(reply(
            StatusCode::OK,
            status(state, q.get("device").map(String::as_str), h).await?,
        ));
    }
    if method != Method::POST {
        let mut r = error(StatusCode::METHOD_NOT_ALLOWED, "Use GET or POST.");
        r.headers_mut().insert("allow", "GET, POST".parse()?);
        return Ok(r);
    }
    if !same_origin(state, h) || !header(h, "content-type").starts_with("application/json") {
        return Ok(error(StatusCode::FORBIDDEN, "Use the battle page."));
    }
    if header(h, "content-length")
        .parse::<u64>()
        .is_ok_and(|n| n > 12000)
    {
        return Ok(error(StatusCode::PAYLOAD_TOO_LARGE, "Request too large."));
    }
    if !body.is_object() && !body.is_array() {
        return Ok(error(StatusCode::BAD_REQUEST, "Invalid request."));
    }
    let p = prefix(state);
    if body["action"] == "admin" {
        if !authorized(state, h) {
            return Ok(error(StatusCode::UNAUTHORIZED, "Admin access required."));
        }
        if let Err(message) = validate_admin(&body) {
            return Ok(error(StatusCode::BAD_REQUEST, message));
        }
        let closed = if body["closed"] == true { "1" } else { "0" };
        let result = state
            .store
            .command(vec![
                "EVAL".into(),
                include_str!("../migration/battle-admin.lua").into(),
                "2".into(),
                format!("{p}:votes"),
                format!("{p}:meta"),
                closed.into(),
                body["views"].to_string(),
                chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            ])
            .await?;
        if result == "TIE" {
            return Ok(error(
                StatusCode::CONFLICT,
                "Voting is tied. Keep it open until there is one winner.",
            ));
        }
        return Ok(reply(StatusCode::OK, status(state, None, h).await?));
    }
    let device = body["device"].as_str().unwrap_or("");
    let choice = body["choice"].as_str().unwrap_or("");
    if body["action"] != "vote" || !valid_device(device) || !matches!(choice, "A" | "B") {
        return Ok(error(StatusCode::BAD_REQUEST, "Choose video A or B."));
    }
    let limited=state.store.command(vec!["EVAL".into(),"local n=redis.call('INCR',KEYS[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n".into(),"1".into(),format!("{p}:rate:{}",ip(state,h,"battle-vote",0)?),"60".into()]).await?;
    if limited.as_i64().is_none_or(|n| n > 12) {
        return Ok(error(
            StatusCode::TOO_MANY_REQUESTS,
            "Too many tries. Wait a minute.",
        ));
    }
    let media = media()?;
    if !truthy(&media["codex"]) || !truthy(&media["compound"]) {
        return Ok(error(
            StatusCode::CONFLICT,
            "Both videos must be ready before voting opens.",
        ));
    }
    let (voter, cookie) = voter::ensure_music(&state.settings, h, None)?;
    let secret = crypto::server_secret(&state.settings)?;
    let pick = order(&secret, device)[usize::from(choice == "B")];
    let mut keys = vec![
        format!("{p}:meta"),
        format!("{p}:device:{}", hash(&secret, device)),
        format!("{p}:voter:{}", hash(&secret, &voter)),
    ];
    keys.extend(ip_keys(state, h, "vote")?);
    keys.push(format!("{p}:votes"));
    let mut args = vec![
        "EVAL".into(),
        include_str!("../migration/battle-vote.lua").into(),
        keys.len().to_string(),
    ];
    args.extend(keys);
    args.extend([pick.into(), (90 * 86400).to_string()]);
    let result = state.store.command(args).await?;
    let mut response = if result == "CLOSED" {
        error(
            StatusCode::CONFLICT,
            "Voting has closed. The result is final.",
        )
    } else if result == "NETWORK" {
        error(
            StatusCode::CONFLICT,
            "This network voted recently. One vote per device; shared networks can try again after 30 minutes.",
        )
    } else {
        reply(StatusCode::OK, status(state, Some(device), h).await?)
    };
    if let Some(cookie) = cookie {
        response.headers_mut().insert("set-cookie", cookie);
    }
    Ok(response)
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    q: &HashMap<String, String>,
    body: &[u8],
) -> Result<Response, Error> {
    Ok(inner(state, method, h, q, body).await.unwrap_or_else(|_| {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "The scoreboard is reconnecting. Your vote is not confirmed. Please retry.",
        )
    }))
}
