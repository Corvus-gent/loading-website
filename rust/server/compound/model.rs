use crate::{Error, compound_v2::model::number};
use corvus_core::{
    army::truthy,
    impact::{string, trimmed},
};
use regex::Regex;
use serde_json::{Value, json};
use std::{collections::HashSet, sync::LazyLock};
use url::Url;
pub const DEADLINE: &str = "2026-11-09T17:00:00Z";
pub const FUND_DEADLINE: &str = "2026-11-08T07:30:00Z";
pub const GOAL: i64 = 4000;
pub const RETENTION: i64 = 90 * 86400;
pub const CATEGORIES: &[&str] = &[
    "Hook",
    "Transitions",
    "Music",
    "Pacing",
    "Story",
    "Humor",
    "Visuals",
    "Ending",
];
pub const REACTIONS: &[&str] = &["fire", "laugh", "neutral", "skull", "cut", "bored"];
pub const SOURCES: &[&str] = &[
    "dm",
    "facebook",
    "x",
    "linkedin",
    "instagram",
    "tiktok",
    "discord",
    "whatsapp",
    "share",
    "corvus",
    "direct",
    "hostel",
    "video",
    "offline",
    "compound",
    "other",
];
pub const EVENTS: &[&str] = &[
    "view",
    "play",
    "watch",
    "dropoff",
    "donation_click",
    "army_join",
    "share",
];
pub const TRANSITION_TAGS: &[&str] = &[
    "keep",
    "cut",
    "too slow",
    "too fast",
    "confusing",
    "smooth",
    "funny",
    "strong hook",
];
pub const QUICK_CHIPS: &[&str] = &["hook", "memes", "music", "length", "fire", "note"];
pub fn clean(v: &Value, max: usize) -> String {
    let s = if v.is_null() {
        String::new()
    } else {
        string(v)
    };
    let s: String = s
        .chars()
        .filter(|c| *c > '\u{1f}' && *c != '\u{7f}')
        .collect();
    // Keep the legacy UTF-16 budget without producing an unpaired surrogate.
    let mut used = 0;
    trimmed(&s)
        .chars()
        .take_while(|c| {
            used += c.len_utf16();
            used <= max
        })
        .collect()
}
pub fn valid_version(v: &Value) -> bool {
    static RE: LazyLock<Option<Regex>> = LazyLock::new(|| Regex::new(r"^v[1-9][0-9]{0,5}$").ok());
    RE.as_ref()
        .is_some_and(|r| r.is_match(&if truthy(v) { string(v) } else { String::new() }))
}
pub fn source(v: &Value) -> &str {
    v.as_str()
        .filter(|s| SOURCES.contains(s))
        .unwrap_or("other")
}
fn fallback<'a>(a: &'a Value, b: &'a Value) -> &'a Value {
    if truthy(a) { a } else { b }
}
pub fn attribution(raw: &Value, nested: bool, now: i64) -> Value {
    let a = if raw.is_object() || raw.is_array() {
        raw
    } else {
        &Value::Null
    };
    let src = fallback(&a["source"], &a["utm_source"]);
    let src = if truthy(src) { source(src) } else { "direct" };
    let confidence = a["source_confidence"]
        .as_str()
        .filter(|s| ["utm", "user_agent", "referrer", "unknown"].contains(s))
        .unwrap_or(if truthy(&a["utm_source"]) {
            "utm"
        } else {
            "unknown"
        });
    let mut out = json!({"source":src,"source_confidence":confidence});
    for k in ["medium", "campaign", "content", "term"] {
        let v = clean(fallback(&a[k], &a[format!("utm_{k}")]), 64);
        if !v.is_empty()
            && v.bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c))
        {
            out[k] = json!(v);
        }
    }
    if truthy(&a["referrer"]) {
        let parsed = a["referrer"].as_str().and_then(|s| {
            Url::parse(&if s.contains("://") {
                s.into()
            } else {
                format!("https://{s}")
            })
            .ok()
        });
        let host = parsed.as_ref().and_then(|u| u.host_str()).unwrap_or("");
        let host = host.strip_prefix("www.").unwrap_or(host);
        out["referrer"] = json!(if [
            "x.com",
            "t.co",
            "linkedin.com",
            "lnkd.in",
            "instagram.com",
            "l.instagram.com",
            "tiktok.com",
            "discord.com",
            "whatsapp.com",
            "corvus.gent"
        ]
        .contains(&host)
        {
            host
        } else {
            "other"
        });
    }
    if let Some(n) = a["landed"].as_f64()
        && ((now as f64) - n).abs() < 30. * 86400000.
    {
        out["landed"] = a["landed"].clone();
    }
    if nested {
        out["first"] = attribution(fallback(&a["first"], a), false, now);
        out["last"] = attribution(fallback(&a["last"], a), false, now);
    }
    out
}
pub fn poll(raw: &Value) -> Result<Value, Error> {
    let q = clean(&raw["q"], 180);
    let options: Vec<_> = raw["options"]
        .as_array()
        .map(|a| a.iter().map(|v| clean(v, 60)).collect())
        .unwrap_or_default();
    if q.is_empty()
        || !(2..=4).contains(&options.len())
        || options.iter().any(String::is_empty)
        || options.iter().collect::<HashSet<_>>().len() != options.len()
    {
        return Err("poll".into());
    }
    Ok(json!({"q":q,"options":options}))
}
pub fn cues(raw: &Value, duration: f64) -> Result<Value, Error> {
    let a = raw.as_array().filter(|a| a.len() <= 30).ok_or("cues")?;
    let mut out = Vec::new();
    for (i, c) in a.iter().enumerate() {
        let t = c["t"]
            .as_f64()
            .filter(|t| t.is_finite() && *t >= 0. && *t <= duration)
            .ok_or("cues")?;
        let p = poll(c)?;
        out.push(json!({"id":format!("cue-{i}"),"t":t,"q":p["q"],"options":p["options"]}));
    }
    out.sort_by(|a, b| {
        a["t"]
            .as_f64()
            .unwrap_or(0.)
            .total_cmp(&b["t"].as_f64().unwrap_or(0.))
    });
    Ok(json!(out))
}
pub fn time_bucket(raw: Option<&Value>, duration: f64) -> Result<f64, Error> {
    let t = raw
        .and_then(number)
        .filter(|t| t.is_finite() && *t >= 0. && *t <= duration + 2.)
        .ok_or("timestamp")?;
    Ok(duration.floor().min(t.floor()))
}
pub fn cutlist(raw: &Value, duration: f64) -> Result<Value, Error> {
    let empty = json!([]);
    let list = if raw.is_array() {
        raw
    } else if truthy(&raw["transitions"]) {
        &raw["transitions"]
    } else {
        &empty
    };
    let list = list
        .as_array()
        .filter(|a| a.len() <= 120)
        .ok_or("cutlist")?;
    let mut seen = HashSet::new();
    let mut end = 0.;
    let mut out = Vec::new();
    for (i, item) in list.iter().enumerate() {
        let start = item
            .get("start")
            .filter(|v| !v.is_null())
            .or_else(|| item.get("t"))
            .and_then(number)
            .filter(|n| n.is_finite())
            .ok_or("cutlist")?;
        let next = item
            .get("end")
            .and_then(number)
            .filter(|n| n.is_finite())
            .ok_or("cutlist")?;
        let label = clean(&item["label"], 100);
        let id = if truthy(&item["id"]) {
            clean(&item["id"], 40)
        } else {
            format!("t{}", i + 1)
        };
        if id.is_empty()
            || !id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c))
            || !seen.insert(id.clone())
            || label.is_empty()
            || start < end
            || next <= start
            || next > duration
        {
            return Err("cutlist".into());
        }
        end = next;
        let mut row = json!({"id":id,"start":start,"end":next,"label":label});
        if [json!("scene"), json!("transition")].contains(&item["type"]) {
            row["type"] = item["type"].clone();
        }
        out.push(row);
    }
    Ok(json!(out))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn text_budget_never_splits_an_emoji() {
        assert_eq!(clean(&json!("a🥋"), 2), "a");
        assert_eq!(clean(&json!("a🥋"), 3), "a🥋");
        assert_eq!(clean(&json!("🥋"), 1), "");
    }
}
