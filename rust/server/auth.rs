use crate::{AppState, crypto};
use axum::{
    Json,
    body::Body,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::{Rng, RngCore};
use serde_json::{Value, json};

pub const ORIGINS: &[&str] = &[
    "https://corvus.gent",
    "https://www.corvus.gent",
    "https://stats.corvus.gent",
];
const VERIFY: &str = "local raw=redis.call('GET',KEYS[1]); if not raw then return -2 end\nlocal ttl=redis.call('PTTL',KEYS[1]); if ttl<=0 then redis.call('DEL',KEYS[1]); return -2 end\nlocal r=cjson.decode(raw); if r.tries>=3 then redis.call('DEL',KEYS[1]); return -1 end\nif r.h==ARGV[1] then redis.call('DEL',KEYS[1]); return 1 end\nr.tries=r.tries+1\nif r.tries>=3 then redis.call('DEL',KEYS[1]) else redis.call('SET',KEYS[1],cjson.encode(r),'PX',ttl) end\nreturn 0";
const LIMIT: &str = "local n=redis.call('INCR',KEYS[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
fn reply(status: StatusCode, value: Value) -> Response {
    (status, [("cache-control", "no-store")], Json(value)).into_response()
}
fn empty(status: StatusCode) -> Response {
    (status, [("cache-control", "no-store")], Body::empty()).into_response()
}
fn allowed(email: &str) -> bool {
    let Some(local) = email.strip_suffix("@corvus.gent") else {
        return false;
    };
    email.len() <= 254
        && !local.is_empty()
        && local
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"._%+-".contains(&c))
}
fn random_id(n: usize) -> String {
    let mut bytes = vec![0_u8; n];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
pub async fn session(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Option<(String, String)>, crate::Error> {
    let Some(raw) = crypto::cookie(headers, "sess") else {
        return Ok(None);
    };
    let mut bits = raw.split('.');
    let (Some(id), Some(signature)) = (bits.next(), bits.next()) else {
        return Ok(None);
    };
    let secret = crypto::session_secret(&state.settings)?;
    if id.is_empty() || !crypto::safe_equal(signature, &crypto::sign(&secret, id)) {
        return Ok(None);
    }
    let email = state.store.get(&format!("sess:{id}")).await?;
    Ok(email
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| (id.to_string(), s.to_string())))
}
async fn limit(
    state: &AppState,
    key: String,
    max: i64,
    seconds: i64,
) -> Result<bool, crate::Error> {
    Ok(state
        .store
        .command(vec![
            "EVAL".into(),
            LIMIT.into(),
            "1".into(),
            key,
            seconds.to_string(),
        ])
        .await?
        .as_i64()
        .is_some_and(|n| n <= max))
}
async fn login_log(state: &AppState, email: &str) -> Result<(), crate::Error> {
    let now = chrono::Utc::now();
    let id = hex::encode(rand::random::<[u8; 16]>());
    let script = "redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[5]); redis.call('ZADD',KEYS[2],ARGV[3],ARGV[4]); redis.call('EXPIRE',KEYS[2],ARGV[6]); return 1";
    state
        .store
        .command(vec![
            "EVAL".into(),
            script.into(),
            "2".into(),
            format!("privacy:log:logins:{id}"),
            "privacy:log-index:logins".into(),
            json!({"email":email,"at":now.to_rfc3339_opts(chrono::SecondsFormat::Millis,true)})
                .to_string(),
            "7776000".into(),
            now.timestamp_millis().to_string(),
            id,
            (now.timestamp_millis() - 7_776_000_000).to_string(),
            "7776000".into(),
        ])
        .await?;
    Ok(())
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    body: &[u8],
) -> Result<Response, crate::Error> {
    if !state.store.connected() {
        return Ok(reply(
            StatusCode::SERVICE_UNAVAILABLE,
            json!({"error":"storage not connected"}),
        ));
    }
    if method == Method::GET {
        return Ok(reply(
            StatusCode::OK,
            json!({"email":session(state,headers).await?.map(|(_,email)|email)}),
        ));
    }
    if method != Method::POST {
        return Ok(empty(StatusCode::METHOD_NOT_ALLOWED));
    }
    if !ORIGINS.contains(
        &headers
            .get("origin")
            .and_then(|v| v.to_str().ok())
            .unwrap_or(""),
    ) {
        return Ok(reply(StatusCode::FORBIDDEN, json!({"error":"forbidden"})));
    }
    if !state.settings.write_enabled() {
        return Ok(reply(
            StatusCode::SERVICE_UNAVAILABLE,
            json!({"error":"Rust writes are disabled during migration validation."}),
        ));
    }
    let raw: Value = if body.is_empty() {
        json!({})
    } else {
        match serde_json::from_slice(body) {
            Ok(v) => v,
            Err(_) => {
                return Ok(reply(
                    StatusCode::BAD_REQUEST,
                    json!({"error":"invalid JSON"}),
                ));
            }
        }
    };
    let email = raw["email"].as_str().unwrap_or("").trim().to_lowercase();
    let secret = crypto::session_secret(&state.settings)?;
    match raw["action"].as_str() {
        Some("logout") => {
            if let Some((id, _)) = session(state, headers).await? {
                state
                    .store
                    .command(vec!["DEL".into(), format!("sess:{id}")])
                    .await?;
            }
            let mut response = reply(StatusCode::OK, json!({"ok":true}));
            response.headers_mut().insert(
                "set-cookie",
                "sess=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict".parse()?,
            );
            Ok(response)
        }
        Some("request") => {
            let answer =
                json!({"ok":true,"message":"if that address is allowed, a code is on its way."});
            if !allowed(&email) {
                return Ok(reply(StatusCode::OK, answer));
            }
            let privacy_secret = crypto::server_secret(&state.settings)?;
            let ip = crypto::daily_ip_hash(
                &privacy_secret,
                headers
                    .get("x-forwarded-for")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or(""),
                "login",
                &chrono::Utc::now().format("%Y-%m-%d").to_string(),
            );
            if !limit(state, format!("otp:rl:ip:{ip}"), 10, 3600).await?
                || !limit(
                    state,
                    format!("otp:rl:mail:{}", crypto::hash(&secret, &email)),
                    3,
                    900,
                )
                .await?
            {
                return Ok(reply(
                    StatusCode::TOO_MANY_REQUESTS,
                    json!({"error":"slow down"}),
                ));
            }
            let code = format!("{:06}", rand::rng().random_range(0..1_000_000));
            state
                .store
                .command(vec![
                    "SET".into(),
                    format!("otp:{}", crypto::hash(&secret, &email)),
                    json!({"h":crypto::hash(&secret,&code),"tries":0}).to_string(),
                    "EX".into(),
                    "180".into(),
                ])
                .await?;
            let Some(key) = state.settings.get("RESEND_API_KEY") else {
                return Ok(reply(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    json!({"error":"could not send"}),
                ));
            };
            let sent=state.http.post("https://api.resend.com/emails").bearer_auth(key).json(&json!({"from":state.settings.get("LOGIN_FROM").unwrap_or("corvus <login@corvus.gent>"),"to":[email],"subject":format!("{code} is your corvus.gent code"),"text":format!("Your code: {code}\n\nValid for 3 minutes. If you didn't ask for this, ignore it.\n\n— the crow")})).send().await;
            if !sent.is_ok_and(|r| r.status().is_success()) {
                return Ok(reply(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    json!({"error":"could not send"}),
                ));
            }
            Ok(reply(StatusCode::OK, answer))
        }
        Some("verify") => {
            let code = raw["code"]
                .as_str()
                .map(str::to_string)
                .or_else(|| raw["code"].as_u64().map(|n| n.to_string()))
                .unwrap_or_default();
            if !allowed(&email) || code.len() != 6 || !code.bytes().all(|c| c.is_ascii_digit()) {
                return Ok(reply(
                    StatusCode::BAD_REQUEST,
                    json!({"error":"wrong code"}),
                ));
            }
            let result = state
                .store
                .command(vec![
                    "EVAL".into(),
                    VERIFY.into(),
                    "1".into(),
                    format!("otp:{}", crypto::hash(&secret, &email)),
                    crypto::hash(&secret, &code),
                ])
                .await?;
            if result.as_i64() != Some(1) {
                return Ok(reply(
                    if result.as_i64() == Some(-1) {
                        StatusCode::TOO_MANY_REQUESTS
                    } else {
                        StatusCode::BAD_REQUEST
                    },
                    json!({"error":match result.as_i64() {Some(-2)=>"code expired",Some(-1)=>"too many tries",_=>"wrong code"}}),
                ));
            }
            let id = random_id(24);
            state
                .store
                .command(vec![
                    "SET".into(),
                    format!("sess:{id}"),
                    email.clone(),
                    "EX".into(),
                    "604800".into(),
                ])
                .await?;
            login_log(state, &email).await?;
            let mut response = reply(StatusCode::OK, json!({"ok":true,"email":email}));
            response.headers_mut().insert(
                "set-cookie",
                format!(
                    "sess={id}.{}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict",
                    crypto::sign(&secret, &id)
                )
                .parse()?,
            );
            Ok(response)
        }
        _ => Ok(reply(
            StatusCode::BAD_REQUEST,
            json!({"error":"unknown action"}),
        )),
    }
}
