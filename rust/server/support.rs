//! Coffee bookings and Diogenes referrals; original keys, atomic scripts and consent boundaries.
use crate::{AppState, Error, auth, config::Settings, crypto, store::StoreError};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{collections::HashMap, time::Duration};
use url::Url;
const RETENTION: i64 = 60 * 86400;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    config: Value,
    tiers: Value,
    #[serde(rename = "bmcURL")]
    bmc_url: String,
    #[serde(rename = "linkedinURL")]
    linkedin_url: String,
    links: Vec<(String, Value)>,
    steps: Vec<(String, String)>,
}
impl Config {
    pub fn embedded() -> Result<Self, Error> {
        Ok(serde_json::from_str(include_str!(
            "../migration/support-config.json"
        ))?)
    }
    pub fn configuration(&self, env: &Settings) -> Value {
        let x = env
            .get("X_USER_ID")
            .filter(|s| (5..=25).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_digit()));
        let mut result = self.config.clone();
        result["bmcURL"] = json!(secure_url(env.get("BMC_URL"), &self.bmc_url));
        result["linkedinURL"] = json!(secure_url(
            env.get("LINKEDIN_PROFILE_URL"),
            &self.linkedin_url
        ));
        result["instagramURL"] = json!("https://ig.me/m/gabe.maxxing");
        result["xURL"] = json!(
            x.map(|s| format!("https://x.com/messages/compose?recipient_id={s}"))
                .unwrap_or_else(|| "https://x.com/gabe_maxxing".into())
        );
        result
    }
    pub fn destination(
        &self,
        id: &str,
        q: &HashMap<String, String>,
        env: &Settings,
    ) -> Option<String> {
        let rule = &self.links.iter().find(|(key, _)| key == id)?.1;
        let conf = self.configuration(env);
        let path = match rule["kind"].as_str()? {
            "call" => "/call/",
            "bmc" => conf["bmcURL"].as_str()?,
            "dinner" => "/dinner/",
            "roll" => "/gabinho-rolls/",
            _ => return None,
        };
        let mut url = Url::parse("https://corvus.gent").ok()?.join(path).ok()?;

        for key in ["utm_content", "utm_term", "utm_id"] {
            if let Some(s) = q.get(key).filter(|s| {
                !s.is_empty()
                    && s.len() <= 80
                    && s.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
            }) {
                set_param(&mut url, key, s);
            }
        }
        set_param(&mut url, "utm_source", rule["source"].as_str()?);
        set_param(&mut url, "utm_medium", "social");
        set_param(&mut url, "utm_campaign", "diogenes");
        if rule["kind"] == "roll" {
            set_param(&mut url, "from", "support");
        }

        if rule["kind"] == "bmc" {
            Some(url.into())
        } else {
            Some(format!("{}?{}", url.path(), url.query()?))
        }
    }
    pub fn validate(&self, b: &Value) -> Result<Value, &'static str> {
        let mut data = serde_json::Map::new();
        for (key, max) in [
            ("name", 80),
            ("contact", 160),
            ("pain", 600),
            ("times", 250),
        ] {
            let s = b[key]
                .as_str()
                .filter(|s| !js_trim(s).is_empty() && s.encode_utf16().count() <= max)
                .ok_or("Please fill in your name, contact, what hurts and preferred times.")?;
            data.insert(
                key.into(),
                js_trim(s)
                    .chars()
                    .map(|c| {
                        if c <= '\u{1f}' || c == '\u{7f}' {
                            ' '
                        } else {
                            c
                        }
                    })
                    .collect::<String>()
                    .into(),
            );
        }
        let tier = b["tier"]
            .as_str()
            .filter(|t| self.tiers.get(*t).is_some())
            .ok_or("Choose a call or meet-up.")?;
        let paid = self.tiers[tier]["paid"] == true;
        if paid && b["coffeePaid"] != true {
            return Err("Sort the coffee first, then tick the checkbox.");
        }
        data.insert("tier".into(), tier.into());
        data.insert("coffeePaid".into(), json!(paid && b["coffeePaid"] == true));
        data.insert(
            "source".into(),
            source(b["source"].as_str().unwrap_or("")).into(),
        );
        Ok(Value::Object(data))
    }
}
fn set_param(url: &mut Url, key: &str, value: &str) {
    let mut done = false;
    let mut pairs: Vec<(String, String)> = url
        .query_pairs()
        .filter_map(|(k, v)| {
            if k == key {
                if done {
                    return None;
                }
                done = true;
                Some((key.into(), value.into()))
            } else {
                Some((k.into_owned(), v.into_owned()))
            }
        })
        .collect();
    if !done {
        pairs.push((key.into(), value.into()));
    }
    url.query_pairs_mut().clear().extend_pairs(pairs);
}
fn js_trim(s: &str) -> &str {
    s.trim_matches(|c:char|matches!(c,'\t'..='\r'|' '| '\u{a0}'|'\u{1680}'|'\u{2000}'..='\u{200a}'|'\u{2028}'|'\u{2029}'|'\u{202f}'|'\u{205f}'|'\u{3000}'|'\u{feff}'))
}
fn secure_url(value: Option<&str>, fallback: &str) -> String {
    value
        .and_then(|v| Url::parse(v).ok())
        .filter(|u| u.scheme() == "https" && u.username().is_empty() && u.password().is_none())
        .map(String::from)
        .unwrap_or_else(|| fallback.into())
}
fn source(s: &str) -> &str {
    if matches!(s, "linkedin" | "x") {
        s
    } else {
        "direct"
    }
}
fn prefix(state: &AppState) -> &str {
    state
        .settings
        .get("SUPPORT_TEST_PREFIX")
        .unwrap_or(if state.settings.production() {
            "support:diogenes:v1"
        } else {
            "support:diogenes:preview:v1"
        })
}
fn day(now: DateTime<Utc>) -> String {
    now.with_timezone(&chrono_tz::Europe::Brussels)
        .format("%Y-%m-%d")
        .to_string()
}
fn mac(secret: &str, value: &str) -> String {
    hex::encode(crypto::hmac(
        secret.as_bytes(),
        format!("call-form:{value}").as_bytes(),
    ))
}
pub fn challenge(secret: &str, now: i64) -> Value {
    let v = format!("{now}.{}", hex::encode(rand::random::<[u8; 12]>()));
    json!({"token":format!("{v}.{}",mac(secret,&v)),"notBefore":now+3000})
}
pub fn valid_challenge(secret: &str, token: &str, now: i64) -> bool {
    if token.len() > 120 {
        return false;
    }
    let mut parts = token.split('.');
    let (Some(at), Some(nonce), Some(sig)) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    // Legacy destructuring ignores extra pieces; the signed timestamp/nonce remain authoritative.
    at.len() == 13
        && at.bytes().all(|b| b.is_ascii_digit())
        && nonce.len() == 24
        && nonce
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        && at
            .parse::<i64>()
            .ok()
            .and_then(|t| now.checked_sub(t))
            .is_some_and(|age| (3000..1800000).contains(&age))
        && crypto::safe_equal(sig, &mac(secret, &format!("{at}.{nonce}")))
}
fn header<'a>(h: &'a HeaderMap, k: &str) -> &'a str {
    h.get(k).and_then(|v| v.to_str().ok()).unwrap_or("")
}
fn human(method: &Method, h: &HeaderMap) -> bool {
    let ua = header(h, "user-agent").to_ascii_lowercase();
    method == Method::GET
        && ![
            "bot",
            "crawler",
            "spider",
            "preview",
            "facebookexternalhit",
            "slack",
            "discord",
            "whatsapp",
            "curl",
            "wget",
            "headless",
        ]
        .iter()
        .any(|s| ua.contains(s))
        && !if header(h, "purpose").is_empty() {
            header(h, "sec-purpose")
        } else {
            header(h, "purpose")
        }
        .to_ascii_lowercase()
        .contains("prefetch")
}
fn ip(state: &AppState, h: &HeaderMap, scope: &str, now: DateTime<Utc>) -> Result<String, Error> {
    Ok(crypto::daily_ip_hash(
        &crypto::server_secret(&state.settings)?,
        header(h, "x-forwarded-for"),
        scope,
        &now.format("%Y-%m-%d").to_string(),
    ))
}
pub async fn count(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    id: &str,
    now: DateTime<Utc>,
) -> Result<(), Error> {
    if !human(method, h) {
        return Ok(());
    }
    let p = prefix(state);
    let scope = format!("support-{id}");
    let keys = vec![
        format!("{p}:dedupe:{id}:{}", ip(state, h, &scope, now)?),
        format!(
            "{p}:dedupe:{id}:{}",
            ip(state, h, &scope, now - chrono::Duration::days(1))?
        ),
        format!("{p}:all"),
        format!("{p}:day:{}", day(now)),
        format!("{p}:unique"),
        format!("{p}:unique:{}", day(now)),
    ];
    let mut args = vec![
        "EVAL".into(),
        include_str!("../migration/support-count.lua").into(),
        keys.len().to_string(),
    ];
    args.extend(keys);
    args.push(id.into());
    state.store.command(args).await?;
    Ok(())
}
fn hash(v: &Value) -> serde_json::Map<String, Value> {
    if let Some(o) = v.as_object() {
        return o.clone();
    }
    let mut o = serde_json::Map::new();
    for pair in v
        .as_array()
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .chunks_exact(2)
    {
        if let Some(k) = pair[0].as_str() {
            o.insert(k.into(), pair[1].clone());
        }
    }
    o
}
fn number(v: Option<&Value>) -> i64 {
    v.and_then(|v| v.as_i64().or_else(|| v.as_str()?.parse().ok()))
        .unwrap_or(0)
}
pub async fn report(state: &AppState, c: &Config, date: Option<&str>) -> Result<Value, Error> {
    let today = day(Utc::now());
    let date = date
        .filter(|d| {
            d.len() == 10
                && d.bytes().enumerate().all(|(i, b)| {
                    if i == 4 || i == 7 {
                        b == b'-'
                    } else {
                        b.is_ascii_digit()
                    }
                })
        })
        .unwrap_or(&today);
    let p = prefix(state);
    let results = state
        .store
        .pipeline(vec![
            vec!["HGETALL".into(), format!("{p}:all")],
            vec!["HGETALL".into(), format!("{p}:day:{date}")],
            vec!["HGETALL".into(), format!("{p}:unique")],
        ])
        .await?;
    let all = hash(&results[0]);
    let daily = hash(&results[1]);
    let unique = hash(&results[2]);
    let mut rows=c.links.iter().map(|(id,r)|json!({"id":id,"label":r["label"],"source":r["source"],"total":number(all.get(id)),"day":number(daily.get(id)),"unique":number(unique.get(id))})).collect::<Vec<_>>();
    rows.sort_by_key(|r| {
        (
            std::cmp::Reverse(number(r.get("day"))),
            std::cmp::Reverse(number(r.get("total"))),
        )
    });
    let steps = c
        .steps
        .iter()
        .map(|(id, label)| {
            let sum = |table: &serde_json::Map<String, Value>| {
                ["linkedin", "x", "direct"]
                    .iter()
                    .map(|s| number(table.get(&format!("{id}:{s}"))))
                    .sum::<i64>()
            };
            json!({"id":id,"label":label,"total":sum(&all),"day":sum(&daily)})
        })
        .collect::<Vec<_>>();
    let total = rows.iter().map(|r| number(r.get("total"))).sum::<i64>();
    let clicks = rows.iter().map(|r| number(r.get("day"))).sum::<i64>();
    Ok(json!({"day":date,"rows":rows,"steps":steps,"total":total,"clicks":clicks}))
}
fn same_origin(state: &AppState, h: &HeaderMap) -> bool {
    let origin = header(h, "origin");
    ["https://corvus.gent", "https://www.corvus.gent"].contains(&origin)
        || ["VERCEL_URL", "VERCEL_BRANCH_URL"].iter().any(|k| {
            state
                .settings
                .get(k)
                .is_some_and(|s| origin == format!("https://{s}"))
        })
        || state.settings.get("NODE_ENV") != Some("production") && origin == "http://127.0.0.1:4395"
}
async fn admin(state: &AppState, h: &HeaderMap) -> Result<bool, Error> {
    let authorization = header(h, "authorization");
    let key = authorization
        .strip_prefix("Bearer ")
        .unwrap_or(authorization);
    if state
        .settings
        .get("CALL_ADMIN_KEY")
        .is_some_and(|s| crypto::safe_equal(key, s))
    {
        return Ok(true);
    }
    Ok(auth::session(state, h)
        .await?
        .is_some_and(|(_, email)| email == "gabriel@corvus.gent"))
}
fn request_id(s: &str) -> bool {
    s.len() == 36
        && s.bytes()
            .all(|b| b == b'-' || b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|n| n != 0.0),
        Value::String(s) => !s.is_empty(),
        _ => true,
    }
}
fn reply(status: StatusCode, data: Value) -> Response {
    (
        status,
        [
            ("cache-control", "no-store"),
            ("referrer-policy", "no-referrer"),
        ],
        Json(data),
    )
        .into_response()
}
fn error(status: StatusCode, message: &str) -> Response {
    reply(status, json!({"error":message}))
}
fn redirect(target: &str) -> Result<Response, Error> {
    let mut r = (
        StatusCode::FOUND,
        [
            ("cache-control", "no-store"),
            ("referrer-policy", "no-referrer"),
        ],
    )
        .into_response();
    r.headers_mut().insert("location", target.parse()?);
    Ok(r)
}
fn mail_payload(c: &Config, row: &Value) -> Value {
    let tier = &c.tiers[row["tier"].as_str().unwrap_or("")];
    let field = |k: &str| row[k].as_str().unwrap_or("");
    let paid = tier["paid"] == true;
    let coffee = if paid {
        if row["coffeePaid"] == true {
            "self-reported yes (honor system)"
        } else {
            "not confirmed"
        }
    } else {
        "not required"
    };
    let mut payload = json!({"from":"corvus <login@corvus.gent>","to":"gabriel@corvus.gent","subject":format!("💊 {}: {}",tier["short"].as_str().unwrap_or(""),field("name")),"text":([String::from("New call / SF request"),format!("Name: {}",field("name")),format!("Contact: {}",field("contact")),format!("Tier: {}",tier["label"].as_str().unwrap_or("")),format!("Coffee: {coffee}"),format!("What hurts: {}",field("pain")),format!("Preferred times: {}",field("times")),format!("Source: {}",field("source")),format!("Submitted: {}",field("createdAt")),if paid{"Includes 1 PARACETAMAIL after the call.".into()}else{String::new()},"Manage: https://corvus.gent/call/admin/".into()].join("\n"))});
    let contact = field("contact");
    if !contact.chars().any(char::is_whitespace)
        && let Some((local, domain)) = contact.split_once('@')
        && !local.is_empty()
        && !domain.contains('@')
        && domain
            .split_once('.')
            .is_some_and(|(a, b)| !a.is_empty() && !b.is_empty())
    {
        payload["reply_to"] = json!(contact);
    }
    payload
}
async fn notify_request(state: &AppState, c: &Config, id: &str) -> Result<bool, Error> {
    // External side effects must obey the same migration boundary as Redis writes.
    if !state.settings.write_enabled() {
        return Err(StoreError::ReadOnly.into());
    }
    let key = format!("{}:request:{id}", prefix(state));
    let stored = state.store.get(&key).await?;
    let Some(raw) = stored.as_str() else {
        return Ok(false);
    };
    let row: Value = serde_json::from_str(raw)?;
    if row["mailSent"] == true {
        return Ok(true);
    }
    let Some(token) = state.settings.get("RESEND_API_KEY") else {
        return Ok(false);
    };
    let response = state
        .http
        .post("https://api.resend.com/emails")
        .bearer_auth(token)
        .header("Idempotency-Key", format!("call-request-{id}"))
        .json(&mail_payload(c, &row))
        .timeout(Duration::from_secs(8))
        .send()
        .await;
    if !response.is_ok_and(|r| r.status().is_success()) {
        return Ok(false);
    }
    let marked=state.store.command(vec!["EVAL".into(),"local v=redis.call('GET',KEYS[1]);if not v then return 0 end;local r=cjson.decode(v);r.mailSent=true;redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 1".into(),"1".into(),key]).await;
    Ok(marked.is_ok())
}
async fn save_request(
    state: &AppState,
    h: &HeaderMap,
    mut data: Value,
    request_id: &str,
) -> Result<(StatusCode, String), Error> {
    let now = Utc::now();
    let id = uuid::Uuid::new_v4().to_string();
    let p = prefix(state);
    let hashed = ip(state, h, "call-form", now)?;
    let keys = vec![
        format!(
            "{p}:submit:{}",
            mac(&crypto::server_secret(&state.settings)?, request_id)
        ),
        format!("{p}:cool:{hashed}"),
        format!("{p}:hour:{hashed}"),
        format!("{p}:request:{id}"),
        format!("{p}:requests"),
        format!("{p}:all"),
        format!("{p}:day:{}", day(now)),
    ];
    let step = format!(
        "request-{}:{}",
        data["tier"].as_str().ok_or("missing tier")?,
        data["source"].as_str().ok_or("missing source")?
    );
    data["id"] = json!(id);
    data["status"] = json!("new");
    data["mailSent"] = json!(false);
    data["createdAt"] = json!(now.to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
    let mut args = vec![
        "EVAL".into(),
        include_str!("../migration/support-request.lua").into(),
        keys.len().to_string(),
    ];
    args.extend(keys);
    args.extend([
        id,
        data.to_string(),
        RETENTION.to_string(),
        now.timestamp_millis().to_string(),
        (now.timestamp_millis() - RETENTION * 1000).to_string(),
        step,
    ]);
    let value = state.store.command(args).await?;
    let status = value[0]
        .as_u64()
        .and_then(|n| u16::try_from(n).ok())
        .and_then(|n| StatusCode::from_u16(n).ok())
        .ok_or("invalid booking result")?;
    Ok((
        status,
        value[1].as_str().ok_or("invalid booking id")?.into(),
    ))
}
async fn inner(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    q: &HashMap<String, String>,
    body: &[u8],
) -> Result<Response, Error> {
    let c = Config::embedded()?;
    let action = q.get("action").map(String::as_str).unwrap_or("");
    if let Some(slug) = q.get("slug").filter(|s| !s.is_empty())
        && matches!(*method, Method::GET | Method::HEAD)
    {
        let Some(target) = c.destination(slug, q, &state.settings) else {
            return Ok(error(StatusCode::NOT_FOUND, "Unknown support link."));
        };
        let _ = tokio::time::timeout(
            Duration::from_secs(2),
            count(state, method, h, slug, Utc::now()),
        )
        .await;
        return redirect(&target);
    }
    if action == "admin" {
        if !admin(state, h).await? {
            return Ok(error(
                StatusCode::UNAUTHORIZED,
                "Sign in as Gabe or enter the private key.",
            ));
        }
        if method == Method::GET {
            let offset = q
                .get("offset")
                .and_then(|v| v.parse::<f64>().ok())
                .filter(|v| !v.is_nan())
                .unwrap_or(0.0)
                .clamp(0.0, 10000.0);
            let result = state
                .store
                .command(vec![
                    "ZREVRANGE".into(),
                    format!("{}:requests", prefix(state)),
                    offset.to_string(),
                    (offset + 49.0).to_string(),
                ])
                .await?;
            let ids = result.as_array().ok_or("invalid request index")?;
            let commands = ids
                .iter()
                .filter_map(Value::as_str)
                .map(|id| vec!["GET".into(), format!("{}:request:{id}", prefix(state))])
                .collect();
            let rows = state
                .store
                .pipeline(commands)
                .await?
                .iter()
                .filter_map(Value::as_str)
                .map(serde_json::from_str::<Value>)
                .collect::<Result<Vec<_>, _>>()?;
            return Ok(reply(
                StatusCode::OK,
                json!({"rows":rows,"more":ids.len()==50,"offset":offset}),
            ));
        }
        if method != Method::POST || !same_origin(state, h) {
            return Ok(error(StatusCode::FORBIDDEN, "Use the admin page."));
        }
        let b = serde_json::from_slice::<Value>(body).unwrap_or(Value::Null);
        let Some(id) = b["id"].as_str().filter(|s| request_id(s)) else {
            return Ok(error(StatusCode::BAD_REQUEST, "Invalid request."));
        };
        if b["action"] == "retry-mail" {
            return Ok(reply(
                StatusCode::OK,
                json!({"ok":notify_request(state,&c,id).await?}),
            ));
        }
        let Some(status) = b["status"]
            .as_str()
            .filter(|s| matches!(*s, "new" | "scheduled" | "done"))
        else {
            return Ok(error(
                StatusCode::BAD_REQUEST,
                "Choose new, scheduled or done.",
            ));
        };
        let changed=state.store.command(vec!["EVAL".into(),"local v=redis.call('GET',KEYS[1]);if not v then return 0 end;local r=cjson.decode(v);r.status=ARGV[1];redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 1".into(),"1".into(),format!("{}:request:{id}",prefix(state)),status.into()]).await?.as_i64().is_some_and(|v|v!=0);
        return Ok(reply(
            if changed {
                StatusCode::OK
            } else {
                StatusCode::NOT_FOUND
            },
            json!({"ok":changed}),
        ));
    }
    if matches!(*method, Method::GET | Method::HEAD) {
        if action == "stats" {
            let mut result = report(state, &c, q.get("day").map(String::as_str)).await?;
            result["ready"] = json!(true);
            let mut r = reply(StatusCode::OK, result);
            r.headers_mut().insert(
                "cache-control",
                "public, s-maxage=30, stale-while-revalidate=300".parse()?,
            );
            return Ok(r);
        }
        if action == "out" {
            let conf = c.configuration(&state.settings);
            let step = q.get("step").map(String::as_str).unwrap_or("");
            let field = match step {
                "call-coffee" => "bmcURL",
                "dinner-linkedin" => "linkedinURL",
                "dinner-instagram" | "roll-instagram" => "instagramURL",
                "dinner-x" | "roll-x" => "xURL",
                _ => return Ok(error(StatusCode::NOT_FOUND, "Unknown support action.")),
            };
            let id = format!(
                "{step}:{}",
                source(q.get("source").map(String::as_str).unwrap_or(""))
            );
            let _ = tokio::time::timeout(
                Duration::from_secs(2),
                count(state, method, h, &id, Utc::now()),
            )
            .await;
            return redirect(conf[field].as_str().ok_or("invalid redirect")?);
        }
        let mut data = c.config.clone();
        data["tiers"] = c.tiers;
        return Ok(reply(StatusCode::OK, data));
    }
    if method != Method::POST {
        let mut r = error(StatusCode::METHOD_NOT_ALLOWED, "Method not allowed.");
        r.headers_mut().insert("allow", "GET, HEAD, POST".parse()?);
        return Ok(r);
    }
    if !same_origin(state, h) || !header(h, "content-type").starts_with("application/json") {
        return Ok(error(StatusCode::FORBIDDEN, "Use the call page."));
    }
    if header(h, "content-length")
        .parse::<u64>()
        .ok()
        .is_some_and(|n| n > 5000)
    {
        return Ok(error(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Please keep it short.",
        ));
    }
    let b = serde_json::from_slice::<Value>(body).unwrap_or(Value::Null);
    if !truthy(&b) || b.to_string().encode_utf16().count() > 5000 {
        return Ok(error(StatusCode::BAD_REQUEST, "Invalid request."));
    }
    let now = Utc::now();
    let secret = crypto::server_secret(&state.settings)?;
    if b["action"] == "challenge" {
        let key = format!(
            "{}:challenge:{}",
            prefix(state),
            ip(state, h, "call-challenge", now)?
        );
        let count=state.store.command(vec!["EVAL".into(),"local n=redis.call('INCR',KEYS[1]);if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n".into(),"1".into(),key,"600".into()]).await?;
        if count.as_i64().is_none_or(|n| n > 20) {
            return Ok(error(
                StatusCode::TOO_MANY_REQUESTS,
                "Please try again shortly.",
            ));
        }
        return Ok(reply(
            StatusCode::OK,
            challenge(&secret, now.timestamp_millis()),
        ));
    }
    let request = b["requestId"].as_str().unwrap_or("");
    if truthy(&b["website"])
        || !valid_challenge(
            &secret,
            b["challenge"].as_str().unwrap_or(""),
            now.timestamp_millis(),
        )
        || !request_id(request)
    {
        return Ok(error(
            StatusCode::BAD_REQUEST,
            "Please wait a moment and try the form again.",
        ));
    }
    let data = match c.validate(&b) {
        Ok(v) => v,
        Err(message) => return Ok(error(StatusCode::BAD_REQUEST, message)),
    };
    let (status, id) = save_request(state, h, data, request).await?;
    if status == StatusCode::TOO_MANY_REQUESTS {
        let mut r = reply(
            status,
            json!({"error":"One request at a time. Please wait before sending another.","retryAfter":id.parse::<i64>()?}),
        );
        r.headers_mut().insert("retry-after", id.parse()?);
        return Ok(r);
    }
    let notified = notify_request(state, &c, &id).await?;
    Ok(reply(
        status,
        json!({"ok":true,"notified":notified,"message":"Got it 💊 I'll reply within a few hours to lock a time."}),
    ))
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    q: &HashMap<String, String>,
    body: &[u8],
) -> Result<Response, Error> {
    Ok(inner(state,method,h,q,body).await.unwrap_or_else(|_|error(StatusCode::SERVICE_UNAVAILABLE,"The form is reconnecting. Your request is not confirmed. Please retry, or email gabriel@corvus.gent.")))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn notification_contains_only_the_intended_recipient() -> Result<(), Error> {
        let c = Config::embedded()?;
        let row = json!({"name":"Fixture","contact":"fixture@example.test","tier":"coffee","coffeePaid":true,"pain":"growth","times":"tomorrow","source":"x","createdAt":"2026-11-20T00:00:00.000Z"});
        let payload = mail_payload(&c, &row);
        assert_eq!(payload["to"], "gabriel@corvus.gent");
        assert_eq!(payload["reply_to"], "fixture@example.test");
        assert!(
            payload["text"]
                .as_str()
                .is_some_and(|s| s.contains("PARACETAMAIL"))
        );
        let mut handle = row;
        handle["contact"] = json!("@fixture");
        assert!(mail_payload(&c, &handle).get("reply_to").is_none());
        Ok(())
    }
    #[tokio::test]
    async fn mail_retries_cannot_escape_the_read_only_boundary() -> Result<(), Error> {
        let settings = std::sync::Arc::new(Settings::new(
            [("RESEND_API_KEY".into(), "fixture-never-send".into())].into(),
        ));
        let http = reqwest::Client::new();
        let state = AppState {
            store: crate::store::Store::new(settings.clone(), http.clone()),
            http,
            settings,
            live: crate::live::LiveService::new()?,
        };
        assert!(
            notify_request(&state, &Config::embedded()?, "fixture")
                .await
                .is_err()
        );
        Ok(())
    }
}
