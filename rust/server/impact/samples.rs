//! Reconstruct only observations that actually exist, using their original timestamp.
use corvus_core::{army::truthy, impact, metrics};
use serde_json::{Map, Value, json};

pub fn hour_samples(history: &[Value]) -> Map<String, Value> {
    let mut hours = Map::new();
    for row in history {
        let Some(at) = impact::timestamp(&row["metrics_at"]) else {
            continue;
        };
        if metrics::coverage(row).score.is_none() || truthy(&row["measured_date"]) {
            continue;
        }
        let Some(date) = chrono::DateTime::from_timestamp_millis(at) else {
            continue;
        };
        let hour = date.format("%Y-%m-%dT%H").to_string();
        let mut sample = json!({});
        for key in ["posted_at", "platform", "metrics_at"] {
            if let Some(v) = row.get(key) {
                sample[key] = v.clone();
            }
        }
        for key in metrics::FIELDS {
            if !row[key].is_null() {
                sample[key] = row[key].clone();
            }
        }
        let replace = hours.get(&hour).is_none_or(|old| {
            let t = impact::timestamp(&old["metrics_at"]);
            Some(at) > t
                || (Some(at) == t
                    && metrics::coverage(&sample).known.len() > metrics::coverage(old).known.len())
        });
        if replace {
            hours.insert(hour, sample);
        }
    }
    hours
}
