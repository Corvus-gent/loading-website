//! Existing health observation ledger, hourly/calendar aggregates and incident history.
use crate::{AppState, Error, visitors};
use chrono::{DateTime, NaiveDate, SecondsFormat};
use corvus_core::army::truthy;
use serde_json::{Map, Value, json};
pub const NAMES: &[&str] = &[
    "site",
    "redirects",
    "stats",
    "redis",
    "posthog",
    "resend",
    "notion",
    "coffee",
    "tiles",
    "spotify",
    "snapshots",
    "cron",
];
pub const HOUR: i64 = 3_600_000;
pub const DAY: i64 = 24 * HOUR;
pub const STEP: i64 = 300_000;
pub const SLOW_MS: f64 = 1500.0;
const INGEST: &str = include_str!("../../migration/health-ingest.lua");
fn floor(t: i64, step: i64) -> i64 {
    t.div_euclid(step) * step
}
fn number(v: &Value) -> f64 {
    visitors::model::number(v)
}
fn round(n: f64) -> f64 {
    (n + 0.5).floor()
}
fn iso(at: i64) -> Result<String, Error> {
    Ok(DateTime::from_timestamp_millis(at)
        .ok_or("invalid health time")?
        .to_rfc3339_opts(SecondsFormat::Millis, true))
}
pub fn range_ms(range: &str) -> Result<i64, Error> {
    match range {
        "24h" => Ok(DAY),
        "7d" => Ok(7 * DAY),
        "30d" => Ok(30 * DAY),
        _ => Err("invalid health range".into()),
    }
}
pub fn state(c: &Value) -> u8 {
    if c.is_null() || truthy(&c["skipped"]) || c["ok"].is_null() {
        0
    } else if !truthy(&c["ok"]) {
        3
    } else if number(&c["ms"]) >= SLOW_MS {
        2
    } else {
        1
    }
}
pub fn day_keys(at: i64) -> Result<Vec<String>, Error> {
    let today = NaiveDate::parse_from_str(&visitors::day(at), "%Y-%m-%d")?;
    (0..90)
        .map(|i| {
            today
                .checked_sub_days(chrono::Days::new(89 - i))
                .map(|d| d.to_string())
                .ok_or_else(|| "invalid health calendar".into())
        })
        .collect()
}
pub fn empty(range: &str, at: i64) -> Result<Value, Error> {
    range_ms(range)?;
    Ok(
        json!({"range":range,"built_at":at,"status":"unknown","checked_at":null,"uptime":[null,null,null,null],"days":day_keys(at)?,"times":[],"step":if range=="24h"{STEP}else{HOUR},"series":{},"checks":[],"incidents":[]}),
    )
}
pub fn write_command(
    sample: &Value,
    now: i64,
    archive: bool,
    monitor: bool,
) -> Result<Vec<String>, Error> {
    let stamp = sample["checked_at"].as_str().ok_or("missing health time")?;
    let at = DateTime::parse_from_rfc3339(stamp)?.timestamp_millis();
    let slot = floor(at, STEP);
    let hour = floor(at, HOUR);
    let checks = sample["checks"]
        .as_object()
        .ok_or("missing health checks")?;
    let mut cells = Map::new();
    for name in NAMES {
        let check = checks.get(*name).unwrap_or(&Value::Null);
        let level = state(check);
        if level == 0 {
            continue;
        }
        let ms = number(&check["ms"]);
        let ms = if ms.is_finite() {
            round(ms).max(0.0)
        } else {
            0.0
        };
        cells.insert((*name).into(), json!([level, ms, number(&check["ok"])]));
    }
    if !cells.is_empty() {
        let worst = cells
            .values()
            .filter_map(|v| v[0].as_u64())
            .max()
            .unwrap_or(0);
        let average =
            round(cells.values().map(|v| number(&v[1])).sum::<f64>() / cells.len() as f64);
        let ok = u8::from(cells.values().all(|v| truthy(&v[2])));
        cells.insert("overall".into(), json!([worst, average, ok]));
    }
    Ok(vec![
        "EVAL".into(),
        INGEST.into(),
        "6".into(),
        "health:v2:raw".into(),
        format!("health:v2:h:{hour}"),
        format!("health:v2:d:{}", visitors::day(at)),
        format!(
            "health:v2:{}",
            if archive { "legacy-ledger" } else { "ledger" }
        ),
        "health:v2:first".into(),
        "health:last".into(),
        at.to_string(),
        slot.to_string(),
        Value::Object(cells.clone()).to_string(),
        u8::from(archive).to_string(),
        (hour + 30 * DAY + HOUR).to_string(),
        (at + 120 * DAY).to_string(),
        (now - 2 * DAY).to_string(),
        json!({"at":at,"cells":cells}).to_string(),
        sample.to_string(),
        stamp.into(),
        u8::from(monitor).to_string(),
    ])
}
pub async fn record(s: &AppState, sample: &Value, now: i64, monitor: bool) -> Result<Value, Error> {
    Ok(s.store
        .command(write_command(sample, now, false, monitor)?)
        .await?)
}
fn parse(v: &Value) -> Result<Value, Error> {
    if let Some(s) = v.as_str().filter(|s| !s.is_empty()) {
        Ok(serde_json::from_str(s)?)
    } else {
        Ok(Value::Null)
    }
}
fn parsed_list(v: &Value) -> Result<Vec<Value>, Error> {
    v.as_array()
        .ok_or("invalid health rows")?
        .iter()
        .map(parse)
        .collect()
}
fn sum(cells: &[&Value], i: usize) -> f64 {
    cells
        .iter()
        .map(|v| if truthy(&v[i]) { number(&v[i]) } else { 0.0 })
        .sum()
}
fn pct(cells: &[&Value]) -> Value {
    let n = sum(cells, 0);
    if n != 0.0 {
        json!(100.0 * sum(cells, 1) / n)
    } else {
        Value::Null
    }
}
fn values(v: &Value) -> Vec<Value> {
    v.as_object()
        .map(|v| v.values().cloned().collect())
        .or_else(|| v.as_array().cloned())
        .unwrap_or_default()
}
pub fn incidents(live: &Value, legacy: &Value, first: i64) -> Vec<Value> {
    let mut result = values(&live["open"]);
    result.extend(values(&live["recent"]));
    result.extend(values(&legacy["recent"]));
    for mut old in values(&legacy["open"]) {
        if let Some(next) = result.iter_mut().find(|n| {
            n["name"] == old["name"] && floor(n["start"].as_i64().unwrap_or(0), STEP) == first
        }) {
            next["start"] = old["start"].clone();
            next["worst"] = json!(number(&next["worst"]).max(number(&old["worst"])));
        } else {
            old["interrupted"] = json!(true);
            result.push(old);
        }
    }
    result.sort_by(|a, b| {
        number(&b["start"])
            .total_cmp(&number(&a["start"]))
            .then_with(|| {
                a["name"]
                    .as_str()
                    .unwrap_or("")
                    .cmp(b["name"].as_str().unwrap_or(""))
            })
    });
    result.truncate(10);
    result
}
pub fn hours(at: i64, range: &str) -> Result<Vec<i64>, Error> {
    let length = if range == "24h" {
        24
    } else {
        range_ms(range)? / HOUR + 1
    };
    let hour = floor(at, HOUR);
    Ok((0..length)
        .map(|i| hour - (length - 1 - i) * HOUR)
        .collect())
}
pub fn read_commands(at: i64, range: &str) -> Result<Vec<Vec<String>>, Error> {
    let mut hourly = vec!["MGET".into()];
    hourly.extend(
        hours(at, range)?
            .into_iter()
            .map(|h| format!("health:v2:h:{h}")),
    );
    let mut daily = vec!["MGET".into()];
    daily.extend(
        day_keys(at)?
            .into_iter()
            .map(|d| format!("health:v2:d:{d}")),
    );
    Ok(vec![
        vec![
            "ZRANGEBYSCORE".into(),
            "health:v2:raw".into(),
            (at - DAY).to_string(),
            at.to_string(),
        ],
        hourly,
        daily,
        vec![
            "MGET".into(),
            "health:last".into(),
            "health:v2:ledger".into(),
            "health:v2:legacy-ledger".into(),
            "health:v2:first".into(),
        ],
    ])
}
pub fn project(at: i64, range: &str, rows: &[Value]) -> Result<Value, Error> {
    if rows.len() != 4 {
        return Err("invalid health batch".into());
    }
    let mut result = empty(range, at)?;
    let hours = hours(at, range)?;
    let points = parsed_list(&rows[0])?;
    let hourly = parsed_list(&rows[1])?;
    let daily = parsed_list(&rows[2])?;
    let meta = parsed_list(&rows[3])?;
    if hourly.len() != hours.len() || daily.len() != 90 || meta.len() != 4 {
        return Err("invalid health buckets".into());
    }
    let last = &meta[0];
    let live = &meta[1];
    let legacy = &meta[2];
    let first = meta[3].as_i64().unwrap_or(0);
    let frames: Vec<(i64, &Value)> = if range == "24h" {
        points
            .iter()
            .map(|p| {
                p["at"]
                    .as_i64()
                    .map(|at| (at, &p["cells"]))
                    .ok_or_else(|| "invalid health point".into())
            })
            .collect::<Result<_, Error>>()?
    } else {
        hours
            .iter()
            .enumerate()
            .filter(|(i, t)| {
                !hourly[*i].is_null() && **t + HOUR > at - range_ms(range).unwrap_or(0)
            })
            .map(|(i, t)| (*t, &hourly[i]))
            .collect()
    };
    result["times"] = json!(frames.iter().map(|(at, _)| *at).collect::<Vec<_>>());
    let mut series = Map::new();
    let mut checks = Vec::new();
    for name in std::iter::once("overall").chain(NAMES.iter().copied()) {
        let raw_cells: Vec<&Value> = points
            .iter()
            .map(|p| &p["cells"][name])
            .filter(|v| !v.is_null())
            .collect();
        let day_cells: Vec<&Value> = daily.iter().map(|d| &d[name]).collect();
        let uptime = json!([
            if raw_cells.is_empty() {
                Value::Null
            } else {
                json!(100.0 * sum(&raw_cells, 2) / raw_cells.len() as f64)
            },
            pct(&day_cells[83..]),
            pct(&day_cells[60..]),
            pct(&day_cells)
        ]);
        series.insert(
            name.into(),
            Value::Array(
                frames
                    .iter()
                    .map(|(_, bucket)| {
                        let v = &bucket[name];
                        if v.is_null() {
                            Value::Null
                        } else if range == "24h" {
                            json!([v[1], v[1], v[0]])
                        } else {
                            json!([round(number(&v[2]) / number(&v[0])), v[3], v[4]])
                        }
                    })
                    .collect(),
            ),
        );
        if name == "overall" {
            result["uptime"] = uptime;
            continue;
        }
        let spark = hourly[hourly.len().saturating_sub(24)..]
            .iter()
            .map(|b| {
                if b[name].is_null() {
                    Value::Null
                } else {
                    json!([b[name][3], b[name][4]])
                }
            })
            .collect::<Vec<_>>();
        let month = &day_cells[60..];
        let total = sum(month, 0);
        let average = if total != 0.0 {
            json!(round(sum(month, 2) / total))
        } else {
            Value::Null
        };
        let last_incident = month.iter().map(|v| number(&v[6])).fold(0.0, f64::max);
        let days = day_cells
            .iter()
            .map(|v| {
                if v.is_null() {
                    Value::Null
                } else {
                    json!([
                        v[4],
                        100.0 * number(&v[1]) / number(&v[0]),
                        round(number(&v[2]) / number(&v[0])),
                        v[5]
                    ])
                }
            })
            .collect::<Vec<_>>();
        checks.push(json!({"name":name,"state":state(&last["checks"][name]),"uptime":uptime,"spark":spark,"average":average,"lastIncident":if last_incident>0.0{json!(iso(last_incident as i64)?)}else{Value::Null},"days":days}));
    }
    result["series"] = Value::Object(series);
    result["checks"] = json!(checks);
    result["status"] = if truthy(&last["status"]) {
        last["status"].clone()
    } else {
        json!("unknown")
    };
    result["checked_at"] = if truthy(&last["checked_at"]) {
        last["checked_at"].clone()
    } else {
        Value::Null
    };
    result["incidents"] = json!(incidents(live, legacy, first));
    Ok(result)
}
pub async fn history(s: &AppState, at: i64, range: &str) -> Result<Value, Error> {
    project(
        at,
        range,
        &s.store.pipeline(read_commands(at, range)?).await?,
    )
}

/// Replays genuine legacy observations with the original chronological CAS cursor.
/// Live and archived samples use separate incident ledgers but the same aggregates.
pub async fn import_legacy(s: &AppState, now: i64) -> Result<(), Error> {
    let meta = s
        .store
        .command(vec![
            "MGET".into(),
            "health:v2:first".into(),
            "health:v2:legacy-cursor".into(),
        ])
        .await?;
    let first = meta[0].as_str().unwrap_or("");
    let cursor = meta[1].as_str().unwrap_or("0");
    if first.is_empty() || cursor == "done" {
        return Ok(());
    }
    let raw = s
        .store
        .command(vec![
            "ZRANGEBYSCORE".into(),
            "health:log".into(),
            format!("({cursor}"),
            format!("({first}"),
            "LIMIT".into(),
            "0".into(),
            "240".into(),
        ])
        .await?;
    let samples = parsed_list(&raw)?;
    if !samples.is_empty() {
        let commands=samples.iter().map(|v|{
            let at=v["at"].as_i64().ok_or("invalid legacy health time")?;
            let checks=v["checks"].as_object().ok_or("invalid legacy health checks")?.iter().map(|(k,v)|(k.clone(),json!({"ok":if v[0]==2{Value::Null}else{json!(truthy(&v[0]))},"ms":v[1]}))).collect::<Map<_,_>>();
            write_command(&json!({"checked_at":iso(at)?,"status":v["status"],"checks":checks}),now,true,false)
        }).collect::<Result<Vec<_>,Error>>()?;
        s.store.pipeline(commands).await?;
    }
    let next = if samples.len() < 240 {
        "done".into()
    } else {
        samples
            .last()
            .and_then(|v| v["at"].as_i64())
            .ok_or("missing legacy cursor")?
            .to_string()
    };
    let trim = if next == "done" {
        format!("({first}")
    } else {
        next.clone()
    };
    s.store.command(vec!["EVAL".into(),"if (redis.call('GET',KEYS[1]) or '0')==ARGV[1] then redis.call('SET',KEYS[1],ARGV[2],'EX',10368000);redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[3]);if ARGV[2]=='done' then redis.call('EXPIRE',KEYS[2],172800) end end;return 1".into(),"2".into(),"health:v2:legacy-cursor".into(),"health:log".into(),cursor.into(),next,trim]).await?;
    Ok(())
}
