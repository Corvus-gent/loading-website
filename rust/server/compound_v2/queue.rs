use super::model::{self, text};
use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::{Value, json};
use std::collections::HashMap;
fn time(v: &Value) -> Option<i64> {
    model::posted_date(v)
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|v| v.timestamp_millis())
}
fn iso(at: i64) -> Value {
    DateTime::<Utc>::from_timestamp_millis(at)
        .map(|v| json!(v.to_rfc3339_opts(SecondsFormat::Millis, true)))
        .unwrap_or(Value::Null)
}
pub fn upload_queue(videos: &[Value], now: i64) -> Value {
    let mut groups: Vec<(String, Vec<&Value>)> = Vec::new();
    for v in videos.iter().filter(|v| v["is_example"] != true) {
        let id = format!("{}-{}", text(&v["platform"]), text(&v["account"]));
        if let Some((_, rows)) = groups.iter_mut().find(|(key, _)| *key == id) {
            rows.push(v);
        } else {
            groups.push((id, vec![v]));
        }
    }
    let mut result = Vec::new();
    for (id, rows) in groups {
        let first = rows[0];
        let platform = text(&first["platform"]);
        let interval = match platform {
            "tt" | "ig" | "yt" => 3600000,
            "x" => 2700000,
            _ => 0,
        };
        let last = rows
            .iter()
            .filter(|v| {
                (v["status"] == "posted" || !text(&v["post_url"]).is_empty())
                    && time(&v["posted_at"]).is_some()
            })
            .min_by_key(|v| std::cmp::Reverse(time(&v["posted_at"])));
        let mut previous = last.map(|v| text(&v["lang"]).to_string());
        let mut at = last
            .and_then(|v| time(&v["posted_at"]))
            .map(|v| (v + interval).max(now))
            .unwrap_or(now);
        let mut pending = rows
            .iter()
            .filter(|v| v["status"] == "ready" && text(&v["post_url"]).is_empty())
            .copied()
            .collect::<Vec<_>>();
        pending.sort_by(|a, b| {
            let order = |v: &Value| {
                v.get("export_order")
                    .filter(|v| !v.is_null())
                    .and_then(model::number)
                    .unwrap_or(1e6)
            };
            order(a)
                .partial_cmp(&order(b))
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| text(&a["slug"]).cmp(text(&b["slug"])))
        });
        let mut items = Vec::new();
        while !pending.is_empty() {
            let mut counts = HashMap::<&str, usize>::new();
            for v in &pending {
                *counts.entry(text(&v["lang"])).or_default() += 1;
            }
            let mut best = None;
            let mut max = 0;
            for (i, v) in pending.iter().enumerate() {
                let lang = text(&v["lang"]);
                let total = counts.get(lang).copied().unwrap_or(0);
                if previous.as_deref() != Some(lang) && (best.is_none() || total > max) {
                    best = Some(i);
                    max = total;
                }
            }
            let mut item = pending.remove(best.unwrap_or(0)).clone();
            item["available_at"] = iso(at);
            item["language_repeated"] = json!(previous.as_deref() == Some(text(&item["lang"])));
            previous = Some(text(&item["lang"]).into());
            at += interval;
            items.push(item);
        }
        if !items.is_empty() {
            result.push(json!({"id":id,"platform":platform,"account":first["account"],"interval_minutes":interval/60000,"last_posted_at":last.map(|v|v["posted_at"].clone()),"items":items}));
        }
    }
    result.sort_by(|a, b| {
        text(&a["items"][0]["available_at"])
            .cmp(text(&b["items"][0]["available_at"]))
            .then_with(|| text(&a["id"]).cmp(text(&b["id"])))
    });
    json!(result)
}
