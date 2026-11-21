//! Official referral links and the pre-existing persistent counter schema.
use crate::{AppState, Error, auth, crypto};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::{TimeZone, Timelike};
use corvus_core::plethora::{Destination, PLACEMENTS, canonical, destination, official_url};
use serde_json::{Map, Value, json};
use std::collections::{BTreeSet, HashMap};
const DAY: i64 = 86_400_000;
fn prefix(state: &AppState) -> &str {
    state
        .settings
        .get("PLETHORA_TEST_PREFIX")
        .unwrap_or(if state.settings.production() {
            "plethora:v1"
        } else {
            "plethora:preview:v1"
        })
}
fn snapshot_prefix(state: &AppState) -> String {
    state
        .settings
        .get("PLETHORA_TEST_PREFIX")
        .map(|p| format!("{p}:snapshot"))
        .unwrap_or_else(|| {
            if state.settings.production() {
                "stats:plethora".into()
            } else {
                "stats:plethora:preview".into()
            }
        })
}
fn number(v: &Value) -> i64 {
    v.as_i64()
        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        .unwrap_or(0)
}
fn hash(v: &Value) -> Map<String, Value> {
    if let Some(o) = v.as_object() {
        return o.clone();
    }
    let mut out = Map::new();
    if let Some(a) = v.as_array() {
        for pair in a.chunks_exact(2) {
            if let Some(k) = pair[0].as_str() {
                out.insert(k.into(), pair[1].clone());
            }
        }
    }
    out
}
fn sum(values: &Map<String, Value>) -> i64 {
    values.values().map(number).sum()
}
fn utc(now: i64) -> Result<chrono::DateTime<chrono::Utc>, Error> {
    chrono::Utc
        .timestamp_millis_opt(now)
        .single()
        .ok_or_else(|| "Invalid date".into())
}
fn iso(now: i64) -> Result<String, Error> {
    Ok(utc(now)?.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
}
pub fn pt_day(now: i64) -> Result<String, Error> {
    Ok(utc(now)?
        .with_timezone(&chrono_tz::America::Los_Angeles)
        .format("%Y-%m-%d")
        .to_string())
}
fn days(day: &str, count: i64) -> Result<Vec<String>, Error> {
    let end = chrono::NaiveDate::parse_from_str(day, "%Y-%m-%d")?;
    Ok((0..count)
        .map(|i| (end - chrono::Duration::days(count - 1 - i)).to_string())
        .collect())
}
fn names(id: &str) -> Vec<&str> {
    if id == "bio-x" {
        vec![id, "bio"]
    } else {
        vec![id]
    }
}
fn all_ids() -> Vec<&'static str> {
    PLACEMENTS.iter().copied().chain(["bio"]).collect()
}
fn kind(id: &str) -> &'static str {
    if destination(id) == Some(Destination::Ossman) {
        "ossman"
    } else {
        "download"
    }
}
fn header<'a>(headers: &'a HeaderMap, key: &str) -> &'a str {
    headers.get(key).and_then(|v| v.to_str().ok()).unwrap_or("")
}
pub fn platform(ua: &str) -> &'static str {
    let ua = ua.to_ascii_lowercase();
    if ["iphone", "ipad", "ipod"].iter().any(|v| ua.contains(v)) {
        "ios"
    } else if ua.contains("android") {
        "android"
    } else {
        "desktop"
    }
}
pub async fn track(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    id: &str,
    now: i64,
) -> Result<bool, Error> {
    let Some(id) = canonical(id) else {
        return Ok(false);
    };
    let ua = header(headers, "user-agent").to_ascii_lowercase();
    let purpose = if headers.contains_key("purpose") {
        header(headers, "purpose")
    } else {
        header(headers, "sec-purpose")
    }
    .to_ascii_lowercase();
    if method != Method::GET
        || [
            "bot",
            "crawler",
            "spider",
            "preview",
            "facebookexternalhit",
            "slack",
            "discord",
            "whatsapp",
            "twitterbot",
            "curl",
            "wget",
            "headless",
        ]
        .iter()
        .any(|s| ua.contains(s))
        || purpose.contains("prefetch")
    {
        return Ok(false);
    }
    let p = prefix(state);
    let secret = crypto::server_secret(&state.settings)?;
    let mut keys = Vec::new();
    for alias in names(id) {
        for offset in [0, DAY] {
            let day = utc(now - offset)?.format("%Y-%m-%d").to_string();
            let digest = crypto::daily_ip_hash(
                &secret,
                header(headers, "x-forwarded-for"),
                &format!("plethora-{alias}"),
                &day,
            );
            keys.push(format!("{p}:dedupe:{alias}:{digest}"));
        }
    }
    let n = keys.len();
    let device = platform(&ua);
    let country = header(headers, "x-vercel-ip-country");
    let country = if country.len() == 2 && country.bytes().all(|c| c.is_ascii_uppercase()) {
        country
    } else {
        "ZZ"
    };
    let day = pt_day(now)?;
    let kind = kind(id);
    let entry = json!({"placement":id,"destination":kind,"device":device,"country":country,"timestamp":iso(now)?,"nonce":hex::encode(rand::random::<[u8;8]>())});
    let fields = format!("{id}|{kind}|{device}|{country}");
    for suffix in [
        "clicks".into(),
        "raw".into(),
        "platforms".into(),
        "destinations".into(),
        format!("recent:{id}"),
        format!("events:{}", utc(now)?.format("%Y-%m-%d")),
        format!("ptday:{day}"),
        "ptdays".into(),
        "official-start".into(),
        "legacy:clicks".into(),
    ] {
        keys.push(format!("{p}:{suffix}"));
    }
    let mut args = vec![
        "EVAL".into(),
        include_str!("../migration/plethora-track.lua").into(),
        keys.len().to_string(),
    ];
    args.extend(keys);
    let day_start =
        chrono::DateTime::parse_from_rfc3339(&format!("{day}T00:00:00Z"))?.timestamp_millis();
    args.extend([
        n.to_string(),
        id.into(),
        now.to_string(),
        entry.to_string(),
        fields,
        device.into(),
        kind.into(),
        (now - 7 * DAY).to_string(),
        day,
        day_start.to_string(),
        (now - DAY).to_string(),
        (now.div_euclid(DAY) * 86400 + 7 * 86400).to_string(),
    ]);
    Ok(state.store.command(args).await?.as_i64() == Some(1))
}
fn daily_rows(value: &Value) -> Vec<Value> {
    let mut rows: Vec<Value> = Vec::new();
    for (field, count) in hash(value) {
        let bits = field.split('|').collect::<Vec<_>>();
        if bits.len() != 5 || !matches!(bits[0], "r" | "u") || bits[4].is_empty() {
            continue;
        }
        let index = rows.iter().position(|r| {
            r["placement"] == bits[1]
                && r["destination"] == bits[2]
                && r["device"] == bits[3]
                && r["country"] == bits[4]
        });
        let index = match index {
            Some(i) => i,
            None => {
                rows.push(json!({"placement":bits[1],"destination":bits[2],"device":bits[3],"country":bits[4],"total":0,"raw":0}));
                rows.len() - 1
            }
        };
        let key = if bits[0] == "u" { "total" } else { "raw" };
        rows[index][key] = json!(number(&rows[index][key]) + number(&count));
    }
    rows.sort_by(|a, b| {
        number(&b["total"])
            .cmp(&number(&a["total"]))
            .then_with(|| a["placement"].as_str().cmp(&b["placement"].as_str()))
    });
    rows
}
fn day_summary(day: &str, value: &Value, now: i64) -> Result<Value, Error> {
    let rows = daily_rows(value);
    let mut destinations = json!({"download":0,"ossman":0});
    let mut platforms = json!({"ios":0,"android":0,"desktop":0});
    for r in &rows {
        for (map, key) in [
            (&mut destinations, "destination"),
            (&mut platforms, "device"),
        ] {
            if let Some(k) = r[key].as_str() {
                map[k] = json!(number(&map[k]) + number(&r["total"]));
            }
        }
    }
    Ok(
        json!({"day":day,"timeZone":"America/Los_Angeles","total":rows.iter().map(|r|number(&r["total"])).sum::<i64>(),"raw":rows.iter().map(|r|number(&r["raw"])).sum::<i64>(),"destinations":destinations,"platforms":platforms,"rows":rows,"savedAt":iso(now)?}),
    )
}
pub async fn report(state: &AppState, now: i64) -> Result<Value, Error> {
    let p = prefix(state);
    let days = days(&pt_day(now)?, 7)?;
    let all = all_ids();
    let mut commands = vec![
        vec!["HGETALL".into(), format!("{p}:clicks")],
        vec!["HGETALL".into(), format!("{p}:raw")],
        vec!["HGETALL".into(), format!("{p}:platforms")],
        vec!["HGETALL".into(), format!("{p}:destinations")],
        vec!["GET".into(), format!("{p}:official-start")],
        vec!["GET".into(), format!("{p}:snapshot-last")],
    ];
    commands.extend(all.iter().map(|id| {
        vec![
            "ZCOUNT".into(),
            format!("{p}:recent:{id}"),
            (now - DAY).to_string(),
            "+inf".into(),
        ]
    }));
    commands.extend(
        days.iter()
            .map(|day| vec!["HGETALL".into(), format!("{p}:ptday:{day}")]),
    );
    let data = state.store.pipeline(commands).await?;
    if data.len() != 6 + all.len() + days.len() {
        return Err("Incomplete report".into());
    }
    let counts = hash(&data[0]);
    let raw = hash(&data[1]);
    let start = if data[4].is_null() {
        None
    } else {
        Some(pt_day(number(&data[4]))?)
    };
    let config: Value = serde_json::from_str(include_str!("../migration/plethora-config.json"))?;
    let daily: Vec<_> = data[6 + all.len()..].iter().map(daily_rows).collect();
    let mut rows = Vec::new();
    for id in PLACEMENTS {
        let ids = names(id);
        let category = config["categories"]
            .as_object()
            .and_then(|cs| {
                cs.iter()
                    .find(|(_, ids)| ids.as_array().is_some_and(|v| v.iter().any(|v| v == id)))
            })
            .map(|(key, _)| key.clone());
        let recent = ids
            .iter()
            .map(|id| {
                all.iter()
                    .position(|x| x == id)
                    .map(|i| number(&data[6 + i]))
                    .unwrap_or(0)
            })
            .sum::<i64>();
        let series: Vec<Value> = days
            .iter()
            .enumerate()
            .map(|(i, day)| {
                if start.as_ref().is_some_and(|s| day >= s) {
                    json!(
                        daily[i]
                            .iter()
                            .filter(|r| r["placement"] == *id)
                            .map(|r| number(&r["total"]))
                            .sum::<i64>()
                    )
                } else {
                    Value::Null
                }
            })
            .collect();
        rows.push(json!({"id":format!("plethora-{id}"),"label":config["placements"][id],"category":category,"destination":kind(id),"total":ids.iter().map(|id|counts.get(*id).map(number).unwrap_or(0)).sum::<i64>(),"raw":raw.get(*id).map(number).unwrap_or(0),"last24h":recent,"series":series}));
    }
    rows.sort_by(|a, b| {
        number(&b["total"])
            .cmp(&number(&a["total"]))
            .then_with(|| number(&b["last24h"]).cmp(&number(&a["last24h"])))
            .then_with(|| a["id"].as_str().cmp(&b["id"].as_str()))
    });
    let total = rows.iter().map(|r| number(&r["total"])).sum::<i64>();
    let last24 = rows.iter().map(|r| number(&r["last24h"])).sum::<i64>();
    let mut platforms = Map::new();
    let mut destinations = Map::new();
    for (map, keys, stored) in [
        (
            &mut platforms,
            vec!["ios", "android", "desktop"],
            hash(&data[2]),
        ),
        (
            &mut destinations,
            vec!["download", "ossman"],
            hash(&data[3]),
        ),
    ] {
        for k in keys {
            map.insert(k.into(), json!(stored.get(k).map(number).unwrap_or(0)));
        }
        map.insert("unknown".into(), json!((total - sum(map)).max(0)));
    }
    let categories:Vec<Value>=config["categories"].as_object().into_iter().flat_map(|o|o.keys()).map(|name|json!({"name":name,"total":rows.iter().filter(|r|r["category"]==name.as_str()).map(|r|number(&r["total"])).sum::<i64>(),"last24h":rows.iter().filter(|r|r["category"]==name.as_str()).map(|r|number(&r["last24h"])).sum::<i64>()})).collect();
    let history:Vec<Value>=days.iter().enumerate().map(|(i,day)|json!({"day":day,"total":if start.as_ref().is_some_and(|s|day>=s){Some(rows.iter().map(|r|number(&r["series"][i])).sum::<i64>())}else{None}})).collect();
    Ok(
        json!({"rows":rows,"total":total,"raw":sum(&raw),"last24h":last24,"platforms":platforms,"destinations":destinations,"categories":categories,"history":history,"historyStarted":if data[4].is_null(){None}else{Some(iso(number(&data[4]))?)},"snapshotAt":if data[5].is_null(){None}else{Some(iso(number(&data[5]))?)},"timeZone":"America/Los_Angeles","updated":iso(now)?}),
    )
}
pub async fn snapshot(state: &AppState, now: i64, catchup: bool) -> Result<Value, Error> {
    if !catchup
        && utc(now)?
            .with_timezone(&chrono_tz::America::Los_Angeles)
            .hour()
            != 0
    {
        return Ok(json!({"skipped":true,"reason":"not midnight Pacific"}));
    }
    let p = prefix(state);
    let sp = snapshot_prefix(state);
    let today = pt_day(now)?;
    let started = state.store.get(&format!("{p}:official-start")).await?;
    let legacy_days = days(&utc(now)?.format("%Y-%m-%d").to_string(), 9)?;
    let legacy = state
        .store
        .pipeline(
            legacy_days
                .iter()
                .map(|day| vec!["HGETALL".into(), format!("{p}:day:{day}")])
                .collect(),
        )
        .await?;
    let archive: Vec<Vec<String>> = legacy
        .iter()
        .enumerate()
        .filter(|(_, h)| !hash(h).is_empty())
        .map(|(i, h)| {
            vec![
                "SET".into(),
                format!("{sp}:legacy-utc:{}", legacy_days[i]),
                json!({"day":legacy_days[i],"timeZone":"UTC","placements":hash(h)}).to_string(),
                "NX".into(),
            ]
        })
        .collect();
    let archived = archive.len();
    state.store.pipeline(archive).await?;
    let mut saved = 0;
    if !started.is_null() {
        let indexed = state
            .store
            .command(vec![
                "ZRANGE".into(),
                format!("{p}:ptdays"),
                "0".into(),
                "-1".into(),
            ])
            .await?;
        let yesterday = days(&today, 2)?.remove(0);
        let mut days: BTreeSet<String> = indexed
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .filter(|d| *d < today.as_str())
            .map(str::to_string)
            .collect();
        if pt_day(number(&started))? <= yesterday {
            days.insert(yesterday);
        }
        let days: Vec<_> = days.into_iter().collect();
        for batch in days.chunks(100) {
            let hashes = state
                .store
                .pipeline(
                    batch
                        .iter()
                        .map(|d| vec!["HGETALL".into(), format!("{p}:ptday:{d}")])
                        .collect(),
                )
                .await?;
            let mut commands = Vec::new();
            for (day, h) in batch.iter().zip(hashes) {
                commands.push(vec![
                    "SET".into(),
                    format!("{sp}:{day}"),
                    day_summary(day, &h, now)?.to_string(),
                ]);
            }
            state.store.pipeline(commands).await?;
            saved += batch.len();
        }
    }
    state
        .store
        .command(vec![
            "SET".into(),
            format!("{p}:snapshot-last"),
            now.to_string(),
        ])
        .await?;
    Ok(json!({"saved":saved,"legacyArchived":archived}))
}
pub async fn csv(state: &AppState) -> Result<String, Error> {
    let p = prefix(state);
    let indexed = state
        .store
        .command(vec![
            "ZRANGE".into(),
            format!("{p}:ptdays"),
            "0".into(),
            "-1".into(),
        ])
        .await?;
    let days: Vec<_> = indexed
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    let started = state.store.get(&format!("{p}:official-start")).await?;
    let legacy = hash(
        &state
            .store
            .command(vec![
                "HGETALL".into(),
                format!(
                    "{p}:{}",
                    if started.is_null() {
                        "clicks"
                    } else {
                        "legacy:clicks"
                    }
                ),
            ])
            .await?,
    );
    let mut lines =
        vec!["day_pt,placement,destination,device,country,deduped_clicks,raw_clicks".into()];
    for (id, count) in legacy {
        let count = number(&count);
        if count != 0 {
            lines.push(format!(
                "legacy,{},unknown,unknown,unknown,{count},",
                canonical(&id).unwrap_or("unknown")
            ));
        }
    }
    for batch in days.chunks(100) {
        let hashes = state
            .store
            .pipeline(
                batch
                    .iter()
                    .map(|day| vec!["HGETALL".into(), format!("{p}:ptday:{day}")])
                    .collect(),
            )
            .await?;
        for (day, h) in batch.iter().zip(hashes) {
            for row in daily_rows(&h) {
                lines.push(format!(
                    "{day},{},{},{},{},{},{}",
                    row["placement"].as_str().unwrap_or(""),
                    row["destination"].as_str().unwrap_or(""),
                    row["device"].as_str().unwrap_or(""),
                    row["country"].as_str().unwrap_or(""),
                    number(&row["total"]),
                    number(&row["raw"])
                ));
            }
        }
    }
    Ok(lines.join("\r\n") + "\r\n")
}
async fn authorized(state: &AppState, headers: &HeaderMap) -> Result<bool, Error> {
    let token = header(headers, "authorization");
    let token = token.strip_prefix("Bearer ").unwrap_or(token);
    if state
        .settings
        .get("PLETHORA_ADMIN_KEY")
        .is_some_and(|key| crypto::safe_equal(token, key))
    {
        return Ok(true);
    }
    Ok(auth::session(state, headers)
        .await?
        .is_some_and(|(_, email)| email == "gabriel@corvus.gent"))
}
fn reply(status: StatusCode, body: Value) -> Response {
    (
        status,
        [
            ("cache-control", "no-store"),
            ("referrer-policy", "no-referrer"),
        ],
        Json(body),
    )
        .into_response()
}
async fn inner(
    state: &AppState,
    headers: &HeaderMap,
    query: &HashMap<String, String>,
    now: i64,
) -> Result<Response, Error> {
    let action = query.get("action").map(String::as_str).unwrap_or("");
    if action == "snapshot" {
        let cron = state.settings.get("CRON_SECRET").is_some_and(|s| {
            crypto::safe_equal(header(headers, "authorization"), &format!("Bearer {s}"))
        });
        let admin = if cron {
            false
        } else {
            authorized(state, headers).await?
        };
        if !cron && !admin {
            return Ok(reply(
                StatusCode::UNAUTHORIZED,
                json!({"error":"Unauthorized"}),
            ));
        }
        return Ok(reply(
            StatusCode::OK,
            snapshot(
                state,
                now,
                admin && query.get("catchup").is_some_and(|s| s == "1"),
            )
            .await?,
        ));
    }
    if action == "admin" && !authorized(state, headers).await? {
        return Ok(reply(
            StatusCode::UNAUTHORIZED,
            json!({"error":"Sign in as Gabe or use the private access key."}),
        ));
    }
    if action == "csv" {
        return Ok((
            [
                ("content-type", "text/csv; charset=utf-8"),
                (
                    "content-disposition",
                    "attachment; filename=\"plethora-stats.csv\"",
                ),
                (
                    "cache-control",
                    "public, s-maxage=60, stale-while-revalidate=300",
                ),
                ("referrer-policy", "no-referrer"),
            ],
            csv(state).await?,
        )
            .into_response());
    }
    let mut data = if matches!(action, "admin" | "stats") {
        report(state, now).await?
    } else {
        let counts = state
            .store
            .command(vec!["HGETALL".into(), format!("{}:clicks", prefix(state))])
            .await?;
        json!({"total":sum(&hash(&counts))})
    };
    data["referralCode"] = json!("GABE");
    data["ready"] = json!(true);
    let mut response = reply(StatusCode::OK, data);
    if action != "admin" {
        response.headers_mut().insert(
            "cache-control",
            "public, max-age=0, s-maxage=15, stale-while-revalidate=30".parse()?,
        );
    }
    Ok(response)
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    query: &HashMap<String, String>,
) -> Result<Response, Error> {
    if method != Method::GET && method != Method::HEAD {
        let mut r = reply(StatusCode::METHOD_NOT_ALLOWED, json!({"error":"Use GET."}));
        r.headers_mut().insert("allow", "GET, HEAD".parse()?);
        return Ok(r);
    }
    let now = chrono::Utc::now().timestamp_millis();
    if let Some(id) = query.get("slug").filter(|s| !s.is_empty()) {
        let Some(url) = official_url(id) else {
            return Ok(reply(
                StatusCode::NOT_FOUND,
                json!({"error":"Unknown placement."}),
            ));
        };
        let _ = track(state, method, headers, id, now).await;
        return Ok((
            StatusCode::FOUND,
            [
                ("cache-control", "no-store"),
                ("referrer-policy", "no-referrer"),
                ("location", url.as_str()),
            ],
        )
            .into_response());
    }
    Ok(inner(state, headers, query, now).await.unwrap_or_else(|_| {
        reply(
            if query
                .get("action")
                .is_some_and(|s| matches!(s.as_str(), "admin" | "csv" | "snapshot"))
            {
                StatusCode::SERVICE_UNAVAILABLE
            } else {
                StatusCode::OK
            },
            json!({"referralCode":"GABE","ready":false,"error":"Click counts are reconnecting."}),
        )
    }))
}
