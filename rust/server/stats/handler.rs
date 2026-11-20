//! Existing statistics routes. Private aggregates are authenticated before every cache read.
use super::{model, task};
use crate::{AppState, Error, auth, visitors};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::{SecondsFormat, Utc};
use serde_json::{Map, Value, json};
use std::{collections::HashMap, time::Duration};
const SECTION_CACHE: &str = "public, max-age=0, s-maxage=900, stale-while-revalidate=60";
fn reply(status: StatusCode, body: Value, cache: &str) -> Response {
    (status, [("cache-control", cache)], Json(body)).into_response()
}
fn error(status: StatusCode, message: &str) -> Response {
    reply(status, json!({"error":message}), "no-store")
}
fn iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
fn merge(out: &mut Map<String, Value>, data: Value) -> Result<(), Error> {
    out.extend(data.as_object().ok_or("invalid aggregate object")?.clone());
    Ok(())
}
fn cached(raw: Value) -> Result<Option<Value>, Error> {
    raw.as_str()
        .filter(|s| !s.is_empty())
        .map(serde_json::from_str)
        .transpose()
        .map_err(Into::into)
}
pub async fn signups(s: &AppState) -> Result<Value, Error> {
    let (Some(key), Some(project), Some(event)) = (
        s.settings.get("PIDGY_POSTHOG_KEY"),
        s.settings.get("PIDGY_POSTHOG_PROJECT"),
        s.settings.get("PIDGY_SIGNUP_EVENT"),
    ) else {
        return Ok(Value::Null);
    };
    if project.len() > 20 || !project.bytes().all(|b| b.is_ascii_digit()) {
        return Err("invalid signup project".into());
    }
    let event = event.replace('\'', "''");
    let sql = format!(
        "SELECT count(DISTINCT distinct_id), count(DISTINCT if(toDate(toTimeZone(timestamp,'Europe/Brussels'))=today('Europe/Brussels'),distinct_id,NULL)) FROM events WHERE event='{event}' AND (person.properties.$initial_utm_source='corvus' OR extractURLParameter(toString(person.properties.$initial_current_url),'ref')='corvus')"
    );
    let url = visitors::remote(
        s,
        &format!("/api/projects/{project}/query/"),
        "https://eu.posthog.com",
    )?;
    let response = s
        .http
        .post(url)
        .bearer_auth(key)
        .json(&json!({"query":{"kind":"HogQLQuery","query":sql}}))
        .timeout(Duration::from_secs(10))
        .send()
        .await?;
    let data: Value = serde_json::from_slice(&visitors::bytes(response, 8 * 1024 * 1024).await?)?;
    let row = data["results"]
        .as_array()
        .and_then(|v| v.first())
        .and_then(Value::as_array)
        .ok_or("missing signup totals")?;
    let mut out = Map::new();
    for (i, k) in ["all", "today"].iter().enumerate() {
        if let Some(v) = row.get(i) {
            out.insert((*k).into(), v.clone());
        }
    }
    Ok(Value::Object(out))
}
pub async fn section_data(s: &AppState, section: &str, day: &str) -> Result<Value, Error> {
    match section {
        "games" => super::games(s, day).await,
        "music" => task(s, "music", "genres", day).await,
        "outbound" => task(s, "outbound", "outbound", day).await,
        "pidgy" => {
            let (crossings, signups) =
                tokio::try_join!(task(s, "pidgy", "crossings", day), signups(s))?;
            let mut out = crossings.as_object().ok_or("invalid crossings")?.clone();
            out.insert("signups".into(), signups);
            Ok(Value::Object(out))
        }
        _ => Err("unknown section".into()),
    }
}
pub async fn section(s: &AppState, method: &Method, query: &HashMap<String, String>) -> Response {
    if *method != Method::GET {
        return (
            StatusCode::METHOD_NOT_ALLOWED,
            [("cache-control", "no-store")],
        )
            .into_response();
    }
    let section = query.get("section").map(String::as_str).unwrap_or("");
    if !["games", "pidgy", "music", "outbound"].contains(&section) {
        return (StatusCode::NOT_FOUND, [("cache-control", "no-store")]).into_response();
    }
    let result = async {
        let day = visitors::day(Utc::now().timestamp_millis());
        let key = format!("stats:section:v2:{section}:{day}");
        if s.store.connected()
            && let Some(value) = cached(s.store.get(&key).await?)?
        {
            return Ok::<_, Error>(value);
        }
        let data = section_data(s, section, &day).await?;
        if s.store.connected() && s.settings.write_enabled() {
            s.store
                .command(vec![
                    "SET".into(),
                    key,
                    data.to_string(),
                    "EX".into(),
                    "900".into(),
                ])
                .await?;
        }
        Ok(data)
    }
    .await;
    match result {
        Ok(value) => reply(StatusCode::OK, value, SECTION_CACHE),
        Err(_) => error(
            StatusCode::SERVICE_UNAVAILABLE,
            "the crow is still counting. try again soon.",
        ),
    }
}
async fn private_logs(s: &AppState, kind: &str, now: i64) -> Result<Value, Error> {
    let index = format!("privacy:log-index:{kind}");
    let cutoff = now - 90 * 86_400_000;
    if s.settings.write_enabled() {
        s.store
            .command(vec![
                "ZREMRANGEBYSCORE".into(),
                index.clone(),
                "-inf".into(),
                cutoff.to_string(),
            ])
            .await?;
    }
    let ids = s
        .store
        .command(vec!["ZREVRANGE".into(), index, "0".into(), "49".into()])
        .await?;
    let commands = ids
        .as_array()
        .ok_or("invalid private index")?
        .iter()
        .map(|id| {
            Ok(vec![
                "GET".into(),
                format!(
                    "privacy:log:{kind}:{}",
                    id.as_str().ok_or("invalid private record")?
                ),
            ])
        })
        .collect::<Result<Vec<_>, Error>>()?;
    let mut rows = Vec::new();
    for raw in s.store.pipeline(commands).await? {
        if let Some(row) = cached(raw)?
            && row["at"]
                .as_str()
                .and_then(|v| chrono::DateTime::parse_from_rfc3339(v).ok())
                .is_some_and(|at| at.timestamp_millis() > cutoff)
        {
            rows.push(row);
        }
    }
    Ok(Value::Array(rows))
}
pub async fn personal_records(s: &AppState) -> Result<Value, Error> {
    let now = Utc::now().timestamp_millis();
    let access = private_logs(s, "access", now).await?;
    let logins = private_logs(s, "logins", now).await?;
    let days = s
        .store
        .command(vec!["SMEMBERS".into(), "guess_days".into()])
        .await?;
    let mut days = days
        .as_array()
        .ok_or("invalid guess dates")?
        .iter()
        .map(|v| {
            v.as_str()
                .map(str::to_owned)
                .ok_or_else(|| "invalid guess date".into())
        })
        .collect::<Result<Vec<_>, Error>>()?;
    days.sort();
    let mut guesses = Vec::new();
    for day in days {
        let raw = s
            .store
            .command(vec!["HGETALL".into(), format!("guesses:{day}")])
            .await?;
        for pair in raw
            .as_array()
            .ok_or("invalid guess records")?
            .chunks_exact(2)
        {
            let value: Value = serde_json::from_str(pair[1].as_str().ok_or("invalid guess")?)?;
            let mut guess = json!({"day":day,"email":pair[0]});
            if let Some(v) = value.get("guess") {
                guess["guess"] = v.clone();
            }
            guesses.push(guess);
        }
    }
    Ok(json!({"access_requests":access,"logins":logins,"guesses":guesses,"updated":iso()}))
}
pub async fn private(
    s: &AppState,
    headers: &HeaderMap,
    query: &HashMap<String, String>,
) -> Response {
    if !s.store.connected() {
        return error(StatusCode::SERVICE_UNAVAILABLE, "storage not connected");
    }
    match auth::session(s, headers).await {
        Ok(Some(_)) => {}
        Ok(None) => return error(StatusCode::UNAUTHORIZED, "login required"),
        Err(_) => return error(StatusCode::SERVICE_UNAVAILABLE, "storage not connected"),
    }
    let records = query.get("records").is_some_and(|v| v == "1");
    if !records && !visitors::posthog_ready(&s.settings) {
        return error(StatusCode::SERVICE_UNAVAILABLE, "posthog not connected yet");
    }
    let result = async {
        if records {
            return personal_records(s).await;
        }
        let mut aggregate = if let Some(data) = cached(s.store.get("stats:private:v2").await?)? {
            data.as_object().ok_or("invalid private cache")?.clone()
        } else {
            let day = visitors::day(Utc::now().timestamp_millis());
            let mut work = tokio::task::JoinSet::new();
            let names = model::private_names()?;
            for name in names.clone() {
                let s = s.clone();
                let day = day.clone();
                work.spawn(async move {
                    let data = task(&s, "private", &name, &day).await?;
                    Ok::<_, Error>((name, data))
                });
            }
            let mut out = Map::new();
            out.insert("updated".into(), json!(iso()));
            let mut completed = HashMap::new();
            while let Some(value) = work.join_next().await {
                let (name, data) = value??;
                completed.insert(name, data);
            }
            for name in names {
                merge(
                    &mut out,
                    completed.remove(&name).ok_or("missing private table")?,
                )?;
            }
            if s.settings.write_enabled() {
                s.store
                    .command(vec![
                        "SET".into(),
                        "stats:private:v2".into(),
                        Value::Object(out.clone()).to_string(),
                        "EX".into(),
                        "600".into(),
                    ])
                    .await?;
            }
            out
        };
        merge(&mut aggregate, personal_records(s).await?)?;
        Ok::<_, Error>(Value::Object(aggregate))
    }
    .await;
    match result {
        Ok(value) => reply(StatusCode::OK, value, "no-store"),
        Err(_) => error(StatusCode::INTERNAL_SERVER_ERROR, "stats error"),
    }
}
