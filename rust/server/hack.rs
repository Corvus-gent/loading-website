//! Hackathon comments, private feedback and aggregate reactions; preserve the existing namespace.
use crate::{AppState, Error, auth, crypto};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use regex::Regex;
use serde_json::{Value, json};
use std::{collections::HashMap, sync::LazyLock};
const LIFE: i64 = 90 * 86400;
const EVENTS: [&str; 9] = [
    "view",
    "app_open",
    "github_click",
    "like",
    "dislike",
    "comment",
    "feedback",
    "share",
    "squad_member",
];
const SOURCES: [&str; 10] = [
    "dm",
    "facebook",
    "x",
    "linkedin",
    "instagram",
    "tiktok",
    "corvus",
    "share",
    "direct",
    "other",
];
static EMAIL: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"^[^\s@]+@[^\s@]+\.[^\s@]+$").ok());
fn reply(code: StatusCode, data: Value, cache: Option<&str>) -> Response {
    let mut response = (code, Json(data)).into_response();
    if let Some(cache) = cache.and_then(|v| v.parse().ok()) {
        response.headers_mut().insert("cache-control", cache);
    }
    response
}
fn error(code: StatusCode, message: &str, cache: Option<&str>) -> Response {
    reply(code, json!({"error":message}), cache)
}
fn header<'a>(h: &'a HeaderMap, key: &str) -> &'a str {
    h.get(key).and_then(|v| v.to_str().ok()).unwrap_or("")
}
fn number(v: &Value) -> f64 {
    v.as_f64()
        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        .unwrap_or(0.0)
}
fn object(v: &Value) -> serde_json::Map<String, Value> {
    if let Some(obj) = v.as_object() {
        return obj
            .iter()
            .map(|(k, v)| (k.clone(), json!(number(v))))
            .collect();
    }
    v.as_array()
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .chunks_exact(2)
        .filter_map(|p| Some((p[0].as_str()?.into(), json!(number(p[1])))))
        .collect()
}
pub fn public_members(raw: &Value) -> Value {
    let mut result = serde_json::Map::new();
    for (id, count) in object(raw) {
        let parts = id.split(':').collect::<Vec<_>>();
        if parts.len() != 2 || !["1", "2"].contains(&parts[0]) {
            continue;
        }
        let key = if parts[1] == "gabe" || (parts[0] == "1" && parts[1] == "siebe") {
            id
        } else {
            format!("{}:xx", parts[0])
        };
        let old = result.get(&key).map(number).unwrap_or(0.0);
        result.insert(key, json!(old + number(&count)));
    }
    Value::Object(result)
}
fn clean(v: &Value, limit: usize) -> String {
    let text = match v {
        Value::String(s) => s.clone(),
        Value::Bool(true) => "true".into(),
        Value::Number(n) => n.to_string(),
        Value::Object(_) => "[object Object]".into(),
        _ => String::new(),
    };
    let text = text
        .chars()
        .filter(|c| *c > '\u{1f}' && *c != '\u{7f}' && *c != '<' && *c != '>')
        .collect::<String>();
    let mut count = 0;
    text.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
        .chars()
        .take_while(|c| {
            count += c.len_utf16();
            count <= limit
        })
        .collect()
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
async fn records(state: &AppState, kind: &str) -> Result<Value, Error> {
    let ids = state
        .store
        .command(vec![
            "ZREVRANGE".into(),
            format!("hack:{kind}"),
            "0".into(),
            "49".into(),
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
    let values = state
        .store
        .pipeline(
            ids.iter()
                .flat_map(|id| {
                    [
                        vec!["GET".into(), format!("hack:{kind}:{id}")],
                        vec!["GET".into(), format!("hack:hidden:{id}")],
                        vec!["GET".into(), format!("hack:likes:{id}")],
                    ]
                })
                .collect(),
        )
        .await?;
    Ok(Value::Array(
        ids.iter()
            .enumerate()
            .filter_map(|(i, id)| {
                let mut row: Value = serde_json::from_str(values.get(i * 3)?.as_str()?).ok()?;
                if !row.is_object() || truthy(&values[i * 3 + 1]) {
                    return None;
                }
                row["id"] = json!(id);
                row["likes"] = json!(number(&values[i * 3 + 2]));
                Some(row)
            })
            .collect(),
    ))
}
async fn rate(state: &AppState, key: &str, max: i64) -> Result<bool, Error> {
    Ok(number(&state.store.command(vec!["EVAL".into(),"local n=redis.call('INCR',KEYS[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n".into(),"1".into(),key.into(),"60".into()]).await?)<=max as f64)
}
async fn inner(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    q: &HashMap<String, String>,
    bytes: &[u8],
) -> Result<Response, Error> {
    if method == Method::GET {
        let private = q.get("private").is_some_and(|v| v == "1");
        let authorized = private
            && auth::session(state, h)
                .await?
                .is_some_and(|(_, email)| email == "gabriel@corvus.gent");
        if private && !authorized {
            return Ok(error(
                StatusCode::UNAUTHORIZED,
                "Log in to see private feedback.",
                None,
            ));
        }
        let (rows, comments, feedback) = tokio::join!(
            state.store.pipeline(vec![
                vec!["HGETALL".into(), "hack:totals".into()],
                vec!["HGETALL".into(), "hack:sources".into()],
                vec!["HGETALL".into(), "hack:members".into()]
            ]),
            records(state, "comments"),
            async {
                if authorized {
                    records(state, "feedback").await
                } else {
                    Ok(json!([]))
                }
            }
        );
        let (rows, comments, feedback) = (rows?, comments?, feedback?);
        return Ok(reply(
            StatusCode::OK,
            json!({"totals":object(&rows[0]),"sources":object(&rows[1]),"comments":comments,"feedback":feedback,"members":public_members(&rows[2]),"private":authorized}),
            Some(if private {
                "private, no-store"
            } else {
                "public, s-maxage=15, stale-while-revalidate=60"
            }),
        ));
    }
    if method != Method::POST {
        return Ok(error(
            StatusCode::METHOD_NOT_ALLOWED,
            "Method not allowed.",
            None,
        ));
    }
    let cache = Some("no-store");
    let origin = header(h, "origin");
    let allowed = ["https://corvus.gent", "https://stats.corvus.gent"].contains(&origin)
        || ["VERCEL_URL", "VERCEL_BRANCH_URL"].iter().any(|key| {
            state
                .settings
                .get(key)
                .is_some_and(|v| origin == format!("https://{v}"))
        })
        || state.settings.get("NODE_ENV") != Some("production")
            && origin == "http://127.0.0.1:4196";
    if !allowed || !header(h, "content-type").starts_with("application/json") {
        return Ok(error(
            StatusCode::FORBIDDEN,
            "Please use the form on this site.",
            cache,
        ));
    }
    let body: Value = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(bytes)?
    };
    if body.to_string().encode_utf16().count() > 5000 {
        return Ok(error(
            StatusCode::PAYLOAD_TOO_LARGE,
            "That message is too long.",
            cache,
        ));
    }
    let action = body["action"].as_str().unwrap_or("");
    let hash = crypto::daily_ip_hash(
        &crypto::server_secret(&state.settings)?,
        header(h, "x-forwarded-for"),
        "hack",
        &chrono::Utc::now().format("%Y-%m-%d").to_string(),
    );
    if !EVENTS.contains(&action) && action != "comment_like" {
        return Ok(error(StatusCode::BAD_REQUEST, "Unknown action.", cache));
    }
    let hack_id = body["hack_id"].as_i64();
    let member = body["member"].as_str().unwrap_or("");
    if action == "squad_member"
        && !((hack_id == Some(1) && ["gabe", "siebe"].contains(&member))
            || (hack_id == Some(2) && member == "gabe"))
    {
        return Ok(error(
            StatusCode::BAD_REQUEST,
            "Unknown squad member.",
            cache,
        ));
    }
    if !rate(state, &format!("hack:rate:{hash}"), 60).await? {
        return Ok(error(
            StatusCode::TOO_MANY_REQUESTS,
            "Take a breath. Try again in a minute.",
            cache,
        ));
    }
    if truthy(&body["website"]) {
        return Ok(error(
            StatusCode::BAD_REQUEST,
            "Please leave the hidden field empty.",
            cache,
        ));
    }
    let source = body["source"]
        .as_str()
        .filter(|s| SOURCES.contains(s))
        .unwrap_or("other");
    if ["comment", "feedback"].contains(&action) {
        let text = clean(&body["text"], 1000);
        let name = clean(&body["name"], 40);
        let email = clean(&body["email"], 254);
        let now = chrono::Utc::now();
        if text.is_empty()
            || body["started"]
                .as_f64()
                .is_none_or(|v| !v.is_finite() || v > (now.timestamp_millis() - 3000) as f64)
        {
            return Ok(error(
                StatusCode::BAD_REQUEST,
                "Write a message and wait a moment before sending.",
                cache,
            ));
        }
        if !email.is_empty() && !EMAIL.as_ref().is_some_and(|r| r.is_match(&email)) {
            return Ok(error(
                StatusCode::BAD_REQUEST,
                "Check the optional email address.",
                cache,
            ));
        }
        if !rate(state, &format!("hack:post:{hash}"), 1).await? {
            return Ok(error(
                StatusCode::TOO_MANY_REQUESTS,
                "One message per minute. Try again shortly.",
                cache,
            ));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let kind = if action == "comment" {
            "comments"
        } else {
            "feedback"
        };
        let mut record = json!({"name":if name.is_empty(){"anonymous"}else{&name},"text":text,"at":now.to_rfc3339_opts(chrono::SecondsFormat::Millis,true)});
        if action == "feedback" && !email.is_empty() {
            record["email"] = json!(email);
        }
        state
            .store
            .pipeline(vec![
                vec![
                    "SET".into(),
                    format!("hack:{kind}:{id}"),
                    record.to_string(),
                    "EX".into(),
                    LIFE.to_string(),
                ],
                vec![
                    "ZADD".into(),
                    format!("hack:{kind}"),
                    now.timestamp_millis().to_string(),
                    id,
                ],
                vec![
                    "ZREMRANGEBYSCORE".into(),
                    format!("hack:{kind}"),
                    "-inf".into(),
                    (now.timestamp_millis() - LIFE * 1000).to_string(),
                ],
                vec!["EXPIRE".into(), format!("hack:{kind}"), LIFE.to_string()],
            ])
            .await?;
    }
    if action == "comment_like" {
        let id = body["id"].as_str().unwrap_or("");
        if id.len() != 36
            || !id
                .bytes()
                .all(|b| b.is_ascii_digit() || b"abcdef-".contains(&b))
            || number(
                &state
                    .store
                    .command(vec!["EXISTS".into(), format!("hack:comments:{id}")])
                    .await?,
            ) == 0.0
        {
            return Ok(error(StatusCode::NOT_FOUND, "Comment unavailable.", cache));
        }
        if truthy(
            &state
                .store
                .command(vec![
                    "SET".into(),
                    format!("hack:vote:{hash}:{id}"),
                    "1".into(),
                    "EX".into(),
                    "86400".into(),
                    "NX".into(),
                ])
                .await?,
        ) {
            state
                .store
                .pipeline(vec![
                    vec!["INCR".into(), format!("hack:likes:{id}")],
                    vec![
                        "EXPIRE".into(),
                        format!("hack:likes:{id}"),
                        LIFE.to_string(),
                    ],
                ])
                .await?;
        }
        return Ok(reply(StatusCode::OK, json!({"ok":true}), cache));
    }
    if ["like", "dislike"].contains(&action)
        && !truthy(
            &state
                .store
                .command(vec![
                    "SET".into(),
                    format!("hack:vote:{hash}"),
                    "1".into(),
                    "EX".into(),
                    "86400".into(),
                    "NX".into(),
                ])
                .await?,
        )
    {
        return Ok(reply(
            StatusCode::OK,
            json!({"ok":true,"already":true}),
            cache,
        ));
    }
    let confidence = body["source_confidence"]
        .as_str()
        .filter(|s| ["utm", "user_agent", "referrer", "unknown"].contains(s))
        .unwrap_or("unknown");
    let mut commands = vec![
        vec![
            "HINCRBY".into(),
            "hack:totals".into(),
            action.into(),
            "1".into(),
        ],
        vec![
            "HINCRBY".into(),
            "hack:sources".into(),
            format!("{source}:{action}"),
            "1".into(),
        ],
        vec![
            "HINCRBY".into(),
            "hack:confidence".into(),
            format!("{confidence}:{action}"),
            "1".into(),
        ],
    ];
    if action == "squad_member" {
        commands.push(vec![
            "HINCRBY".into(),
            "hack:members".into(),
            format!("{}:{member}", hack_id.unwrap_or(0)),
            "1".into(),
        ]);
    }
    state.store.pipeline(commands).await?;
    Ok(reply(StatusCode::OK, json!({"ok":true}), cache))
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    q: &HashMap<String, String>,
    bytes: &[u8],
) -> Result<Response, Error> {
    Ok(inner(state, method, h, q, bytes).await.unwrap_or_else(|_| {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "The crow lost its connection. Try again shortly.",
            if method == Method::POST {
                Some("no-store")
            } else {
                None
            },
        )
    }))
}
