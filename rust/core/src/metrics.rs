use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

pub const FIELDS: &[&str] = &["views", "likes", "comments", "shares", "saves"];
pub fn weight(key: &str) -> f64 {
    match key {
        "views" => 1.0,
        "likes" => 3.0,
        "comments" => 8.0,
        "shares" => 10.0,
        "saves" => 5.0,
        _ => 0.0,
    }
}
pub fn applicable(platform: &str) -> &'static [&'static str] {
    match platform {
        "yt" => &["views", "likes", "comments", "shares"],
        "tw" => &["views"],
        _ => FIELDS,
    }
}
pub fn count(value: &Value) -> Option<f64> {
    let number = match value {
        Value::String(s) => {
            let s = s.trim();
            if s.is_empty() || !s.bytes().all(|c| c.is_ascii_digit()) {
                return None;
            }
            s.parse::<f64>().ok()?
        }
        Value::Number(n) => n.as_f64()?,
        _ => return None,
    };
    (number.is_finite()
        && (0.0..=9_007_199_254_740_991.0).contains(&number)
        && number.fract() == 0.0)
        .then_some(number)
}
#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct Coverage {
    pub known: Vec<String>,
    pub missing: Vec<String>,
    pub unsupported: Vec<String>,
    pub score: Option<f64>,
    pub partial: bool,
}
pub fn coverage(row: &Value) -> Coverage {
    let supported = applicable(row["platform"].as_str().unwrap_or(""));
    let known: Vec<String> = supported
        .iter()
        .filter(|k| count(&row[**k]).is_some())
        .map(|k| k.to_string())
        .collect();
    let missing: Vec<String> = supported
        .iter()
        .filter(|k| count(&row[**k]).is_none())
        .map(|k| k.to_string())
        .collect();
    let unsupported = FIELDS
        .iter()
        .filter(|k| !supported.contains(k))
        .map(|k| k.to_string())
        .collect();
    let score = (!known.is_empty()).then(|| {
        known
            .iter()
            .filter_map(|k| count(&row[k]).map(|n| n * weight(k)))
            .sum()
    });
    Coverage {
        partial: !missing.is_empty(),
        known,
        missing,
        unsupported,
        score,
    }
}
pub fn engagements(row: &Value) -> Option<f64> {
    let values: Vec<f64> = applicable(row["platform"].as_str().unwrap_or(""))
        .iter()
        .filter(|k| **k != "views")
        .filter_map(|k| count(&row[*k]))
        .collect();
    (!values.is_empty()).then(|| values.iter().sum())
}
pub fn classification(row: &Value) -> Value {
    let post = row["post_type"]
        .as_str()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            row["post_kind"]
                .as_str()
                .filter(|s| !s.is_empty())
                .map(|s| if s == "self_thread" { "reply" } else { s })
        })
        .unwrap_or("unknown");
    json!({"post_type":post,"media_type":row["media_type"].as_str().filter(|s|!s.is_empty()).unwrap_or("unknown")})
}
pub fn eligibility(row: &Value) -> Value {
    let c = classification(row);
    let mut reasons = Vec::new();
    if row["original_by_gabe"] != true {
        reasons.push("Confirm that Gabe is the author.");
    }
    if c["post_type"] != "original" {
        reasons.push("Replies, reposts and quote posts do not count.");
    }
    if c["media_type"] != "video" {
        reasons.push("The post itself must contain a native video.");
    }
    json!({"eligible":reasons.is_empty(),"reasons":reasons})
}
pub fn first_day_sample(row: &Value) -> Option<Value> {
    let posted = chrono::DateTime::parse_from_rfc3339(row["posted_at"].as_str()?).ok()?;
    let observed = chrono::DateTime::parse_from_rfc3339(row["metrics_at"].as_str()?).ok()?;
    let hours = (observed.timestamp_millis() - posted.timestamp_millis()) as f64 / 3_600_000.0;
    let c = coverage(row);
    let score = c.score?;
    if hours <= 0.0 || hours > 24.0 {
        return None;
    }
    Some(
        json!({"at":row["metrics_at"],"posted_at":row["posted_at"],"score":score,"partial":c.partial,"missing":c.missing,"velocity":score/hours}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn zero_unknown_and_unsupported_stay_distinct() {
        let c = coverage(
            &json!({"platform":"yt","views":0,"likes":"99","comments":8,"shares":null,"saves":900}),
        );
        assert_eq!(c.score, Some(361.0));
        assert_eq!(c.missing, vec!["shares"]);
        assert_eq!(c.unsupported, vec!["saves"]);
        assert!(c.partial);
        assert_eq!(coverage(&json!({"platform":"x"})).score, None);
    }
    #[test]
    fn no_replies_quotes_images_or_other_authors() {
        for post in ["reply", "repost", "quote", "unknown"] {
            assert_eq!(
                eligibility(
                    &json!({"original_by_gabe":true,"post_type":post,"media_type":"video"})
                )["eligible"],
                false
            );
        }
        assert_eq!(
            eligibility(
                &json!({"original_by_gabe":true,"post_type":"original","media_type":"video"})
            )["eligible"],
            true
        );
    }
}
