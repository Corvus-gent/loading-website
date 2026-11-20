//! OSSMAN name voting, ideas and run scores. Original Redis keys and atomic scripts stay valid.
use crate::{AppState, Error, crypto, voter};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use regex::Regex;
use serde_json::{Value, json};
use std::sync::LazyLock;
const NAMES: [&str; 5] = ["CHOKEMAN", "BRAINROLL", "OSSMAN", "SMESH", "ARMBARCADE"];
const REVEAL_AT: &str = "2026-11-07T23:15:00Z";
const REVEAL_MS: i64 = 1794093300000;
const TTL: i64 = 90 * 86400;
static LINKS: LazyLock<Option<Regex>> = LazyLock::new(|| Regex::new(r"(?i)https?://\S+").ok());
static UNSAFE_NAME: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"[^\p{L}\p{N} _.-]").ok());
fn prefix(state: &AppState) -> &str {
    if state.settings.get("VERCEL_ENV") == Some("preview") {
        "namevote:preview:v1"
    } else {
        "namevote:v1"
    }
}
fn header<'a>(h: &'a HeaderMap, key: &str) -> &'a str {
    h.get(key).and_then(|v| v.to_str().ok()).unwrap_or("")
}
fn reply(status: StatusCode, data: Value) -> Response {
    (status, [("cache-control", "no-store")], Json(data)).into_response()
}
fn error(status: StatusCode, message: &str) -> Response {
    reply(status, json!({"error":message}))
}
fn number(v: &Value) -> f64 {
    v.as_f64()
        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        .unwrap_or(0.0)
}
fn valid_id(s: &str) -> bool {
    (16..=64).contains(&s.len())
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
}
fn digest(secret: &str, text: &str) -> String {
    hex::encode(crypto::hmac(
        secret.as_bytes(),
        format!("namevote:{text}").as_bytes(),
    ))
}
fn obj(value: &Value) -> Value {
    if value.is_object() {
        return value.clone();
    }
    Value::Object(
        value
            .as_array()
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .chunks_exact(2)
            .filter_map(|p| Some((p[0].as_str()?.into(), json!(number(p[1])))))
            .collect(),
    )
}
async fn board(state: &AppState) -> Result<Value, Error> {
    let p = prefix(state);
    let ids = state
        .store
        .command(vec![
            "ZREVRANGE".into(),
            format!("{p}:board"),
            "0".into(),
            "29".into(),
        ])
        .await?;
    let ids = ids
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect::<Vec<_>>();
    if ids.is_empty() {
        return Ok(json!([]));
    }
    let rows = state
        .store
        .pipeline(
            ids.iter()
                .map(|id| vec!["GET".into(), format!("{p}:entry:{id}")])
                .collect(),
        )
        .await?;
    Ok(Value::Array(
        rows.iter()
            .filter_map(|v| serde_json::from_str::<Value>(v.as_str()?).ok())
            .filter(|v| !v.is_null() && *v != false)
            .take(10)
            .enumerate()
            .map(|(i, r)| json!({"name":r["name"],"score":r["score"],"rank":i+1}))
            .collect(),
    ))
}
async fn ideas(state: &AppState) -> Result<Value, Error> {
    let p = prefix(state);
    let ids = state
        .store
        .command(vec![
            "ZREVRANGE".into(),
            format!("{p}:ideas"),
            "0".into(),
            "19".into(),
        ])
        .await?;
    let ids = ids
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect::<Vec<_>>();
    if ids.is_empty() {
        return Ok(json!([]));
    }
    let rows = state
        .store
        .pipeline(
            ids.iter()
                .flat_map(|id| {
                    [
                        vec!["GET".into(), format!("{p}:feedback:{id}")],
                        vec!["ZSCORE".into(), format!("{p}:ideas"), (*id).into()],
                    ]
                })
                .collect(),
        )
        .await?;
    Ok(Value::Array(
        ids.iter()
            .enumerate()
            .filter_map(|(i, id)| {
                let row: Value = serde_json::from_str(rows.get(i * 2)?.as_str()?).ok()?;
                (row["type"] == "idea")
                    .then(|| json!({"id":id,"text":row["text"],"votes":number(&rows[i*2+1])}))
            })
            .collect(),
    ))
}
async fn results(state: &AppState) -> Result<Value, Error> {
    let p = prefix(state);
    let rows = state
        .store
        .pipeline(vec![
            vec!["HGETALL".into(), format!("{p}:counts")],
            vec!["HGETALL".into(), format!("{p}:stats")],
        ])
        .await?;
    let counts = obj(&rows[0]);
    let stats = obj(&rows[1]);
    let votes = NAMES.map(|name| json!({"name":name,"count":number(&counts[name])}));
    let total = votes.iter().map(|v| number(&v["count"])).sum::<f64>();
    let now = chrono::Utc::now().timestamp_millis();
    let closed = now >= REVEAL_MS;
    let mut winner: Option<&str> = None;
    let mut best = f64::NEG_INFINITY;
    if closed && total != 0.0 {
        for name in NAMES {
            let count = number(&counts[name]);
            if count > best {
                best = count;
                winner = Some(name);
            }
        }
    }
    Ok(
        json!({"votes":votes,"total":total,"plays":number(&stats["plays"]),"topScore":number(&stats["topScore"]),"leaderboard":board(state).await?,"ideas":ideas(state).await?,"serverTime":now,"revealAt":REVEAL_AT,"closed":closed,"winner":winner}),
    )
}
async fn rate(
    state: &AppState,
    h: &HeaderMap,
    label: &str,
    scope: &str,
    max: i64,
) -> Result<bool, Error> {
    let hash = crypto::daily_ip_hash(
        &crypto::server_secret(&state.settings)?,
        header(h, "x-forwarded-for"),
        scope,
        &chrono::Utc::now().format("%Y-%m-%d").to_string(),
    );
    let n=state.store.command(vec!["EVAL".into(),"local n=redis.call('INCR',KEYS[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n".into(),"1".into(),format!("{}:{label}:{hash}",prefix(state)),"60".into()]).await?;
    Ok(number(&n) <= max as f64)
}
fn trim(s: &str) -> &str {
    s.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
}
pub fn feedback_text(text: &str) -> String {
    let text = LINKS
        .as_ref()
        .map(|r| r.replace_all(text, "[link removed]").into_owned())
        .unwrap_or_else(|| text.into());
    trim(
        &text
            .chars()
            .map(|c| {
                if c <= '\u{1f}' || c == '<' || c == '>' {
                    ' '
                } else {
                    c
                }
            })
            .collect::<String>(),
    )
    .to_string()
}
pub fn player_name(text: &str) -> String {
    let text = UNSAFE_NAME
        .as_ref()
        .map(|r| r.replace_all(text, "").into_owned())
        .unwrap_or_default();
    let mut count = 0;
    trim(&text)
        .chars()
        .take_while(|c| {
            count += c.len_utf16();
            count <= 16
        })
        .collect()
}
async fn action(
    state: &AppState,
    h: &HeaderMap,
    body: &Value,
    device: &str,
    voter: &str,
) -> Result<Response, Error> {
    let p = prefix(state);
    let secret = crypto::server_secret(&state.settings)?;
    let now = chrono::Utc::now().timestamp_millis();
    match body["action"].as_str().unwrap_or("") {
        "feedback" => {
            let kind = body["type"].as_str().unwrap_or("");
            let Some(text) = body["text"].as_str().filter(|s| {
                trim(s).encode_utf16().count() >= 3
                    && s.encode_utf16().count() <= 600
                    && ["idea", "bug"].contains(&kind)
            }) else {
                return Ok(error(StatusCode::BAD_REQUEST, "Write 3–600 characters."));
            };
            if !rate(state, h, "feedback-rate", "arcade-feedback", 5).await? {
                return Ok(error(
                    StatusCode::TOO_MANY_REQUESTS,
                    "Five messages per minute. Take a breath.",
                ));
            }
            let id = uuid::Uuid::new_v4().to_string();
            let text = feedback_text(text);
            state
                .store
                .command(vec![
                    "SET".into(),
                    format!("{p}:feedback:{id}"),
                    json!({"type":kind,"text":text,"at":now}).to_string(),
                    "EX".into(),
                    TTL.to_string(),
                ])
                .await?;
            let key = format!("{p}:{}", if kind == "idea" { "ideas" } else { "bugs" });
            state
                .store
                .command(vec![
                    "ZADD".into(),
                    key.clone(),
                    if kind == "idea" {
                        "0".into()
                    } else {
                        now.to_string()
                    },
                    id,
                ])
                .await?;
            state
                .store
                .command(vec!["EXPIRE".into(), key, TTL.to_string()])
                .await?;
            Ok(reply(StatusCode::OK, json!({"ok":true})))
        }
        "idea-vote" => {
            let id = body["id"].as_str().unwrap_or("");
            if id.len() != 36
                || !id
                    .bytes()
                    .all(|b| b.is_ascii_digit() || b"abcdef-".contains(&b))
            {
                return Ok(error(StatusCode::BAD_REQUEST, "Invalid idea."));
            }
            let raw = state.store.get(&format!("{p}:feedback:{id}")).await?;
            if raw.is_null() {
                return Ok(error(StatusCode::NOT_FOUND, "Idea unavailable."));
            }
            let row: Value = serde_json::from_str(raw.as_str().unwrap_or(""))?;
            if row["type"] != "idea" {
                return Ok(error(StatusCode::NOT_FOUND, "Idea unavailable."));
            }
            state.store.command(vec!["EVAL".into(),"if redis.call('SET',KEYS[1],'1','NX','EX',ARGV[2]) then redis.call('ZINCRBY',KEYS[2],1,ARGV[1]); end; return 1".into(),"2".into(),format!("{p}:idea-voter:{}:{id}",digest(&secret,voter)),format!("{p}:ideas"),id.into(),TTL.to_string()]).await?;
            Ok(reply(StatusCode::OK, json!({"ok":true})))
        }
        "play" | "score" | "result" => {
            let run = body["run"].as_str().unwrap_or("");
            if !valid_id(run) {
                return Ok(error(StatusCode::BAD_REQUEST, "Invalid run."));
            }
            let key = format!("{p}:run:{}", digest(&secret, &format!("{device}:{run}")));
            if body["action"] == "play" {
                state.store.command(vec!["EVAL".into(),"if redis.call('SET',KEYS[1],ARGV[1],'NX','EX',86400) then redis.call('HINCRBY',KEYS[2],'plays',1); end; return 1".into(),"2".into(),key,format!("{p}:stats"),now.to_string()]).await?;
            } else {
                let Some(score) = body["score"]
                    .as_f64()
                    .filter(|n| n.is_finite() && (0.0..=1000000.0).contains(n) && n.fract() == 0.0)
                else {
                    return Ok(error(StatusCode::BAD_REQUEST, "Invalid score."));
                };
                let started = number(&state.store.get(&key).await?);
                if started == 0.0 {
                    return Ok(error(StatusCode::CONFLICT, "Start a new run first."));
                }
                if score > 1000.0 + (now as f64 - started).max(0.0) / 1000.0 * 500.0 {
                    return Ok(error(StatusCode::BAD_REQUEST, "Score is too fast."));
                }
                state.store.command(vec!["EVAL".into(),"local old=tonumber(redis.call('HGET',KEYS[1],'topScore') or '0'); if tonumber(ARGV[1])>old then redis.call('HSET',KEYS[1],'topScore',ARGV[1]); end; return 1".into(),"1".into(),format!("{p}:stats"),score.to_string()]).await?;
            }
            if body["action"] == "result" {
                let name = player_name(body["name"].as_str().unwrap_or(""));
                if name.is_empty() {
                    return Ok(error(StatusCode::BAD_REQUEST, "Enter a short name."));
                }
                let id = digest(&secret, device);
                let score = number(&body["score"]);
                state.store.command(vec!["EVAL".into(),"local old=tonumber(redis.call('ZSCORE',KEYS[1],ARGV[1]) or '-1'); if tonumber(ARGV[2])>=old then redis.call('ZADD',KEYS[1],ARGV[2],ARGV[1]); redis.call('SET',KEYS[2],ARGV[3],'EX',ARGV[4]); redis.call('EXPIRE',KEYS[1],ARGV[4]); end; return 1".into(),"2".into(),format!("{p}:board"),format!("{p}:entry:{id}"),id.clone(),score.to_string(),json!({"name":name,"score":score,"at":now}).to_string(),TTL.to_string()]).await?;
                let rank = number(
                    &state
                        .store
                        .command(vec!["ZREVRANK".into(), format!("{p}:board"), id])
                        .await?,
                ) + 1.0;
                return Ok(reply(
                    StatusCode::OK,
                    json!({"ok":true,"rank":rank,"leaderboard":board(state).await?}),
                ));
            }
            Ok(reply(StatusCode::OK, json!({"ok":true})))
        }
        _ => {
            let name = body["name"].as_str().unwrap_or("");
            if !NAMES.contains(&name) {
                return Ok(error(
                    StatusCode::BAD_REQUEST,
                    "Choose one of the five names.",
                ));
            }
            if !rate(state, h, "vote-rate", "namevote-vote", 12).await? {
                return Ok(error(
                    StatusCode::TOO_MANY_REQUESTS,
                    "Too many tries. Wait a minute.",
                ));
            }
            let selected=state.store.command(vec!["EVAL".into(),"local now=redis.call('TIME'); if tonumber(now[1])*1000>=tonumber(ARGV[3]) then return 'CLOSED' end; local p=redis.call('GET',KEYS[1]) or redis.call('GET',KEYS[2]); if p then return p end; redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[2]); redis.call('HINCRBY',KEYS[3],ARGV[1],1); return ARGV[1]".into(),"3".into(),format!("{p}:device:{}",digest(&secret,device)),format!("{p}:voter:{}",digest(&secret,voter)),format!("{p}:counts"),name.into(),TTL.to_string(),REVEAL_MS.to_string()]).await?;
            let mut data = results(state).await?;
            if selected == "CLOSED" {
                data["error"] = json!("Voting is closed. The name is locked in.");
                return Ok(reply(StatusCode::CONFLICT, data));
            }
            data["pick"] = selected;
            Ok(reply(StatusCode::OK, data))
        }
    }
}
async fn inner(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    bytes: &[u8],
) -> Result<Response, Error> {
    if method == Method::GET {
        return Ok(reply(StatusCode::OK, results(state).await?));
    }
    if method != Method::POST {
        let mut response = error(StatusCode::METHOD_NOT_ALLOWED, "Use GET or POST.");
        response.headers_mut().insert("allow", "GET, POST".parse()?);
        return Ok(response);
    }
    let origin = header(h, "origin");
    let same = ["https://corvus.gent", "https://www.corvus.gent"].contains(&origin)
        || ["VERCEL_URL", "VERCEL_BRANCH_URL"].iter().any(|k| {
            state
                .settings
                .get(k)
                .is_some_and(|v| origin == format!("https://{v}"))
        })
        || state.settings.get("NODE_ENV") != Some("production")
            && origin == "http://127.0.0.1:4392";
    if !same || !header(h, "content-type").starts_with("application/json") {
        return Ok(error(StatusCode::FORBIDDEN, "Vote from this page."));
    }
    if !rate(state, h, "rate", "namevote", 120).await? {
        let mut r = error(
            StatusCode::TOO_MANY_REQUESTS,
            "Too many tries. Come back in a minute.",
        );
        r.headers_mut().insert("retry-after", "60".parse()?);
        return Ok(r);
    }
    if header(h, "content-length")
        .parse::<u64>()
        .is_ok_and(|n| n > 1024)
    {
        return Ok(error(StatusCode::PAYLOAD_TOO_LARGE, "Request too large."));
    }
    let Ok(body) = serde_json::from_slice::<Value>(bytes) else {
        return Ok(error(StatusCode::BAD_REQUEST, "Invalid vote."));
    };
    let device = body["device"].as_str().unwrap_or("");
    if !valid_id(device) {
        return Ok(error(
            StatusCode::BAD_REQUEST,
            "Choose one of the five names.",
        ));
    }
    let (voter, cookie) = voter::ensure_music(&state.settings, h, None)?;
    let mut response = action(state, h, &body, device, &voter)
        .await
        .unwrap_or_else(|_| unavailable());
    if let Some(cookie) = cookie {
        response.headers_mut().append("set-cookie", cookie);
    }
    Ok(response)
}
fn unavailable() -> Response {
    error(
        StatusCode::SERVICE_UNAVAILABLE,
        "Voting is reconnecting. Your vote was not confirmed; try again.",
    )
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    bytes: &[u8],
) -> Result<Response, Error> {
    Ok(inner(state, method, h, bytes)
        .await
        .unwrap_or_else(|_| unavailable()))
}
