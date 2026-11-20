use super::{
    model::{self, count, text},
    store::{Registry, object},
};
use crate::Error;
use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::{Value, json};

fn time(v: &Value) -> Option<i64> {
    model::posted_date(v)
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|d| d.timestamp_millis())
}
fn iso(at: i64) -> Result<String, Error> {
    Ok(DateTime::<Utc>::from_timestamp_millis(at)
        .ok_or("invalid report timestamp")?
        .to_rfc3339_opts(SecondsFormat::Millis, true))
}
fn cell(v: &Value) -> String {
    let s = if v.is_null() { "—" } else { text(v) };
    s.chars()
        .map(|c| if "|\r\n".contains(c) { ' ' } else { c })
        .take(160)
        .collect()
}
fn grouped(n: i64) -> String {
    let s = n.to_string();
    let len = s.len();
    s.chars()
        .enumerate()
        .flat_map(|(i, c)| {
            if i > 0 && (len - i).is_multiple_of(3) {
                vec![',', c]
            } else {
                vec![c]
            }
        })
        .collect()
}
pub fn build(rows: &[Value], samples: &[Value], now: i64) -> Result<Value, Error> {
    let mut samples = samples
        .iter()
        .filter(|s| time(&s["at"]).is_some())
        .collect::<Vec<_>>();
    samples.sort_by_key(|s| std::cmp::Reverse(time(&s["at"])));
    let previous = samples
        .into_iter()
        .find(|s| time(&s["at"]).is_some_and(|t| t < now - 60000));
    let rates = previous.and_then(|v| v["posts"].as_array());
    let mut enriched = Vec::new();
    for v in rows
        .iter()
        .filter(|v| !text(&v["post_url"]).is_empty() && v["is_example"] != true)
    {
        let old = rates.and_then(|rows| rows.iter().rev().find(|old| old["slug"] == v["slug"]));
        let hours = previous
            .and_then(|v| time(&v["at"]))
            .map(|at| (now - at) as f64 / 3600000.0)
            .unwrap_or(0.0);
        let fresh = old.is_some_and(|old| {
            !text(&v["updated_at"]).is_empty()
                && v["updated_at"] != old["updated_at"]
                && time(&v["updated_at"])
                    .is_some_and(|t| t > time(&old["updated_at"]).unwrap_or(946684800000))
        });
        let rate = old
            .filter(|old| fresh && hours > 0.0 && count(&v["views"]) >= count(&old["views"]))
            .map(|old| ((count(&v["views"]) - count(&old["views"])) as f64 / hours).round() as i64);
        enriched.push(json!({"slug":v["slug"],"url":v["post_url"],"views":count(&v["views"]),"views_per_hour":rate,"updated_at":v["updated_at"],"variant":if text(&v["variant"]).is_empty() {"unknown"} else {text(&v["variant"])} }));
    }
    enriched.sort_by(|a, b| {
        count(&b["views"])
            .cmp(&count(&a["views"]))
            .then_with(|| text(&a["slug"]).cmp(text(&b["slug"])))
    });
    let top = enriched.iter().take(5).cloned().collect::<Vec<_>>();
    let groups=["base","goofy","short","long"].into_iter().map(|variant| {
        let rows=enriched.iter().filter(|v|v["variant"]==variant).collect::<Vec<_>>();let views=rows.iter().map(|v|count(&v["views"])).sum::<i64>();
        json!({"variant":variant,"posts":rows.len(),"views":views,"average":if rows.is_empty() {Value::Null} else {json!((views as f64/rows.len() as f64).round() as i64)}})
    }).collect::<Vec<_>>();
    let mut candidates = groups
        .iter()
        .filter(|v| count(&v["posts"]) > 0 && count(&v["views"]) > 0)
        .collect::<Vec<_>>();
    candidates.sort_by_key(|v| std::cmp::Reverse(count(&v["average"])));
    let best = if candidates.len() >= 2
        && count(&candidates[0]["average"]) > count(&candidates[1]["average"])
    {
        Some(text(&candidates[0]["variant"]))
    } else {
        None
    };
    let total = enriched.iter().map(|v| count(&v["views"])).sum::<i64>();
    let mut warnings = Vec::<String>::new();
    if enriched.is_empty() {
        warnings.push("No published posts are registered yet.".into());
    }
    if previous.is_none() {
        warnings.push("Views/hour needs a second timestamped sample. No rate is invented.".into());
    } else if !enriched.iter().any(|v| !v["views_per_hour"].is_null()) {
        warnings.push(
            "No new social metric reading since the previous sample; views/hour is unavailable."
                .into(),
        );
    }
    if !enriched.is_empty() && total == 0 {
        warnings.push("Registered posts currently have zero reported views. Enter their real metrics; zero is not proof nobody watched.".into());
    }
    let stale = enriched
        .iter()
        .filter(|v| {
            text(&v["updated_at"]).is_empty()
                || time(&v["updated_at"]).is_some_and(|at| now - at > 3600000)
        })
        .count();
    if stale > 0 {
        warnings.push(format!(
            "{stale} post(s) have no metric update in the last hour."
        ));
    }
    if best.is_none() {
        warnings.push("No defensible best variant yet. At least two variant groups need non-zero reported views.".into());
    }
    let generated = iso(now)?;
    let mut lines = vec![
        "# Compound v2 · half-hour report".into(),
        String::new(),
        format!("Generated: {generated}"),
        format!(
            "Published posts: {} · reported views: {}",
            enriched.len(),
            grouped(total)
        ),
        String::new(),
        "## Top five posts".into(),
        String::new(),
        "| Post | Views | Reported views/hour | Last metric update |".into(),
        "| --- | ---: | ---: | --- |".into(),
    ];
    lines.extend(top.iter().map(|v| {
        format!(
            "| [{}]({}) | {} | {} | {} |",
            text(&v["slug"]),
            text(&v["url"]),
            count(&v["views"]),
            if v["views_per_hour"].is_null() {
                "unavailable".into()
            } else {
                count(&v["views_per_hour"]).to_string()
            },
            cell(&v["updated_at"])
        )
    }));
    lines.extend([
        String::new(),
        "## Variant comparison".into(),
        String::new(),
        "| Variant | Posts | Views | Average views/post |".into(),
        "| --- | ---: | ---: | ---: |".into(),
    ]);
    lines.extend(groups.iter().map(|v| {
        format!(
            "| {} | {} | {} | {} |",
            text(&v["variant"]),
            count(&v["posts"]),
            count(&v["views"]),
            if v["average"].is_null() {
                "unavailable".into()
            } else {
                count(&v["average"]).to_string()
            }
        )
    }));
    lines.extend([
        String::new(),
        best.map(|b| {
            format!(
                "Highest reported average: **{b}**. This is observational, not a controlled result."
            )
        })
        .unwrap_or_else(|| "Best variant: not enough data.".into()),
        String::new(),
        "## Data quality".into(),
        String::new(),
    ]);
    lines.extend(warnings.iter().map(|w| format!("- {w}")));
    lines.extend([String::new(),"Social views are entered by Gabe or synced by the configured provider. Rates use changes between timestamped report samples only when a new metric reading exists. They are not estimated live views.".into(),String::new()]);
    Ok(
        json!({"generated_at":generated,"posts":enriched.len(),"total_views":total,"top":top,"best_variant":best,"variants":groups,"warnings":warnings,"markdown":lines.join("\n")}),
    )
}
pub async fn latest(registry: &Registry<'_>) -> Result<Value, Error> {
    let rows = registry
        .0
        .store
        .pipeline(
            ["report:latest", "report:error", "report:last-job"]
                .iter()
                .map(|k| vec!["GET".into(), registry.key(k)])
                .collect(),
        )
        .await?;
    let parse = |v: &Value| serde_json::from_str::<Value>(text(v)).unwrap_or(Value::Null);
    Ok(json!({"report":parse(&rows[0]),"error":parse(&rows[1]),"last_job":parse(&rows[2])}))
}
async fn locked_run(registry: &Registry<'_>, force: bool, trigger: &str) -> Result<Value, Error> {
    let mut old = latest(registry).await?;
    let now = Utc::now().timestamp_millis();
    if !force
        && time(&old["report"]["generated_at"])
            .is_some_and(|at| at.div_euclid(1800000) == now.div_euclid(1800000))
    {
        old["cached"] = json!(true);
        return Ok(old);
    }
    let rows = registry.videos().await?;
    let raw = registry
        .0
        .store
        .pipeline(vec![
            vec![
                "LRANGE".into(),
                registry.key("report:samples"),
                "0".into(),
                "95".into(),
            ],
            vec!["HGETALL".into(), registry.key("export-assets")],
        ])
        .await?;
    let assets = object(&raw[1]);
    let all = rows
        .into_iter()
        .map(|mut v| {
            if text(&v["variant"]).is_empty() {
                v["variant"] = assets
                    .get(text(&v["slug"]))
                    .and_then(|raw| serde_json::from_str::<Value>(text(raw)).ok())
                    .and_then(|v| v.get("variant").cloned())
                    .filter(|v| !text(v).is_empty())
                    .unwrap_or(json!("unknown"));
            }
            v
        })
        .collect::<Vec<_>>();
    let samples = raw[0]
        .as_array()
        .ok_or("invalid report samples")?
        .iter()
        .filter_map(|raw| serde_json::from_str(text(raw)).ok())
        .collect::<Vec<_>>();
    let report = build(&all, &samples, now)?;
    let at = iso(now)?;
    let sample = json!({"at":at,"posts":all.iter().filter(|v|!text(&v["post_url"]).is_empty() && v["is_example"]!=true).map(|v|json!({"slug":v["slug"],"views":v["views"],"updated_at":v["updated_at"]})).collect::<Vec<_>>()});
    let job = json!({"at":at,"trigger":trigger,"ok":true});
    registry.eval("redis.call('SET',KEYS[1],ARGV[1]);redis.call('LPUSH',KEYS[2],ARGV[2]);redis.call('LTRIM',KEYS[2],0,95);redis.call('EXPIRE',KEYS[2],604800);redis.call('LPUSH',KEYS[3],ARGV[1]);redis.call('LTRIM',KEYS[3],0,335);redis.call('EXPIRE',KEYS[3],604800);redis.call('SET',KEYS[4],ARGV[1],'EX',7776000);redis.call('SET',KEYS[5],ARGV[3]);redis.call('DEL',KEYS[6]);return 1",&[registry.key("report:latest"),registry.key("report:samples"),registry.key("report:history"),registry.key(&format!("report:daily:{}",&at[..10])),registry.key("report:last-job"),registry.key("report:error")],&[report.to_string(),sample.to_string(),job.to_string()]).await?;
    Ok(json!({"report":report,"error":null,"last_job":job}))
}
pub async fn run(registry: &Registry<'_>, force: bool, trigger: &str) -> Result<Value, Error> {
    let token = uuid::Uuid::new_v4().to_string();
    let lock = registry.key("report:lock");
    let acquired = registry
        .0
        .store
        .command(vec![
            "SET".into(),
            lock.clone(),
            token.clone(),
            "NX".into(),
            "EX".into(),
            "120".into(),
        ])
        .await?;
    if acquired.is_null() {
        let mut old = latest(registry).await?;
        old["busy"] = json!(true);
        return Ok(old);
    }
    let result = locked_run(registry, force, trigger).await;
    if result.is_err() {
        let _=registry.0.store.command(vec!["SET".into(),registry.key("report:error"),json!({"at":model::now(),"message":"Refresh failed. The previous successful report is retained."}).to_string(),"EX".into(),"86400".into()]).await;
    }
    let _=registry.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",&[lock],&[token]).await;
    result
}
