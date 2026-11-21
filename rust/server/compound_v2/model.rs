use crate::Error;
use chrono::{DateTime, Duration, Local, NaiveDate, NaiveDateTime, SecondsFormat, TimeZone, Utc};
use corvus_core::{army::truthy, videos::parse_slug};
use serde_json::{Map, Value, json};
use std::sync::LazyLock;
use url::Url;

pub const RETENTION: i64 = 90 * 86400;
pub const METRICS: [&str; 4] = ["views", "likes", "comments", "shares"];
static CONFIG: LazyLock<Option<Value>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../migration/compound-v2-config.json")).ok()
});
pub fn deadline() -> Result<&'static str, Error> {
    CONFIG
        .as_ref()
        .and_then(|v| v["deadline"].as_str())
        .ok_or_else(|| "Compound config unavailable".into())
}
pub fn seeds() -> Result<Vec<Value>, Error> {
    Ok(CONFIG
        .as_ref()
        .and_then(|v| v["seeds"].as_array())
        .ok_or("Compound config unavailable")?
        .clone())
}
pub fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
pub fn text(v: &Value) -> &str {
    v.as_str().unwrap_or("")
}
pub fn trim(s: &str) -> &str {
    s.trim_matches(|c: char| c == '\u{feff}' || (c.is_whitespace() && c != '\u{85}'))
}
pub fn plain(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c <= '\u{1f}' || c == '\u{7f}' {
                ' '
            } else {
                c
            }
        })
        .collect()
}
// Legacy form counts use Number(), including numeric strings and empty form fields.
pub fn number(v: &Value) -> Option<f64> {
    match v {
        Value::Null => Some(0.0),
        Value::Bool(v) => Some(if *v { 1.0 } else { 0.0 }),
        Value::Number(n) => n.as_f64(),
        Value::String(s) => {
            let s = trim(s);
            if s.is_empty() {
                return Some(0.0);
            }
            for (prefix, radix) in [("0x", 16), ("0b", 2), ("0o", 8)] {
                if s.to_ascii_lowercase().starts_with(prefix) {
                    return u64::from_str_radix(&s[2..], radix).ok().map(|n| n as f64);
                }
            }
            s.parse::<f64>().ok()
        }
        Value::Array(v) if v.is_empty() => Some(0.0),
        Value::Array(v) if v.len() == 1 => match &v[0] {
            Value::Null => Some(0.0),
            Value::String(_) | Value::Number(_) | Value::Array(_) => number(&v[0]),
            _ => None,
        },
        _ => None,
    }
}
pub fn count(v: &Value) -> i64 {
    number(v).unwrap_or(0.0) as i64
}
pub fn safe_post_url(value: &Value, compound: bool) -> Result<String, Error> {
    if !truthy(value) {
        return Ok(String::new());
    }
    let raw = value
        .as_str()
        .filter(|s| s.encode_utf16().count() <= 1500)
        .ok_or("invalid post URL")?;
    let mut u = Url::parse(raw).map_err(|_| "Invalid URL")?;
    let host = u
        .host_str()
        .unwrap_or("")
        .strip_prefix("www.")
        .unwrap_or(u.host_str().unwrap_or(""));
    let hosts = if compound {
        &["compound.mov"][..]
    } else {
        &[
            "tiktok.com",
            "vm.tiktok.com",
            "vt.tiktok.com",
            "instagram.com",
            "x.com",
            "twitter.com",
            "linkedin.com",
            "lnkd.in",
            "twitch.tv",
            "m.tiktok.com",
            "youtube.com",
            "m.youtube.com",
            "youtu.be",
        ][..]
    };
    if u.scheme() != "https"
        || !u.username().is_empty()
        || u.password().is_some()
        || !hosts.contains(&host)
    {
        return Err("invalid post URL".into());
    }
    u.set_fragment(None);
    Ok(u.into())
}
// JavaScript parses date-only ISO as UTC but offset-free date/time in the server's local zone.
fn local_time(date: NaiveDateTime) -> Option<DateTime<Utc>> {
    if let Some(at) = Local.from_local_datetime(&date).earliest() {
        return Some(at.with_timezone(&Utc));
    }
    // A spring-forward gap uses the preceding offset, matching Date's compatible disambiguation.
    for minutes in 1..=180 {
        if let Some(before) = Local
            .from_local_datetime(&(date - Duration::minutes(minutes)))
            .earliest()
        {
            return before
                .offset()
                .from_local_datetime(&date)
                .earliest()
                .map(|d| d.with_timezone(&Utc));
        }
    }
    None
}
pub fn posted_date(v: &Value) -> Option<String> {
    let s = text(v);
    let at = DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc))
        .or_else(|| {
            DateTime::parse_from_rfc2822(s)
                .ok()
                .map(|d| d.with_timezone(&Utc))
        })
        .or_else(|| {
            NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .ok()?
                .and_hms_opt(0, 0, 0)
                .map(|d| d.and_utc())
        })
        .or_else(|| {
            [
                "%Y-%m-%dT%H:%M:%S%.f",
                "%Y-%m-%dT%H:%M",
                "%Y-%m-%d %H:%M:%S",
            ]
            .iter()
            .find_map(|f| NaiveDateTime::parse_from_str(s, f).ok())
            .and_then(local_time)
        })?;
    Some(at.to_rfc3339_opts(SecondsFormat::Millis, true))
}
pub fn vote_code(v: &Value) -> String {
    format!("{}-{}-{}", text(&v["lang"]), text(&v["hook"]), v["n"]).to_ascii_uppercase()
}
pub fn pinned_comment(v: &Value) -> String {
    let ask = match text(&v["lang"]) {
        "nl" => "stem op de volgende cut",
        "fr" => "vote pour le prochain montage",
        "pt" => "vota no próximo corte",
        "es" => "vota el próximo montaje",
        "de" => "stimme für den nächsten Schnitt",
        "it" => "vota il prossimo montaggio",
        _ => "vote on the next cut",
    };
    format!("🗳️ {ask}: corvus.gent/c/{}", vote_code(v))
}
pub fn video(raw: &Value, allow_pending: bool, at: &str) -> Result<Value, Error> {
    let parsed = parse_slug(text(&raw["slug"])).ok_or("invalid slug")?;
    if raw.get("hook_line").is_some()
        && raw["hook_line"]
            .as_str()
            .is_none_or(|s| s.encode_utf16().count() > 180)
    {
        return Err("hook line must be at most 180 characters".into());
    }
    let mut result = json!({"hook_line":plain(trim(text(&raw["hook_line"])))});
    for (k, v) in serde_json::to_value(parsed)?
        .as_object()
        .ok_or("invalid slug")?
    {
        result[k] = v.clone();
    }
    result["post_url"] = json!(safe_post_url(&raw["post_url"], false)?);
    result["compound_url"] = json!(safe_post_url(&raw["compound_url"], true)?);
    result["is_example"] = json!(raw["is_example"] == true);
    if !allow_pending
        && result["is_example"] != true
        && text(&result["post_url"]).is_empty()
        && !seeds()?.iter().any(|v| v["slug"] == result["slug"])
    {
        return Err("a real video needs a post URL".into());
    }
    for key in METRICS {
        let n = number(&raw[key])
            .filter(|n| n.is_finite() && (0.0..=1e12).contains(n) && n.fract() == 0.0)
            .ok_or("metrics must be non-negative whole numbers")?;
        result[key] = json!(n as u64);
    }
    let metrics = METRICS.iter().any(|k| count(&result[*k]) != 0);
    if text(&result["post_url"]).is_empty() && metrics {
        return Err("add the post URL before recording social metrics".into());
    }
    if result["is_example"] == true && metrics {
        return Err("examples must have zero metrics".into());
    }
    let date = if truthy(&raw["posted_at"]) {
        Some(posted_date(&raw["posted_at"]).ok_or("invalid date")?)
    } else {
        None
    };
    let code = vote_code(&result);
    if raw.get("vote_code").is_some() && raw["vote_code"] != code {
        return Err(format!("vote code must match the export: {code}").into());
    }
    if raw.get("status").is_some()
        && !["pending", "ready", "posted"].contains(&text(&raw["status"]))
    {
        return Err("invalid video status".into());
    }
    if raw["status"] == "posted" && text(&result["post_url"]).is_empty() {
        return Err("posted videos need a post URL".into());
    }
    result["vote_code"] = json!(code);
    result["pinned_comment"] = json!(pinned_comment(&result));
    result["status"] = json!(if !text(&result["post_url"]).is_empty() {
        "posted"
    } else if text(&raw["status"]).is_empty() {
        "pending"
    } else {
        text(&raw["status"])
    });
    result["posted_at"] = json!(date);
    result["updated_at"] = json!(at);
    result["awaiting_url"] = json!(text(&result["post_url"]).is_empty());
    result["metric_source"] = json!(if result["is_example"] == true {
        "example"
    } else if result["awaiting_url"] == true {
        "pending"
    } else {
        "manual"
    });
    Ok(result)
}
pub fn public_video(row: &Value) -> Value {
    let fields = [
        "slug",
        "platform",
        "account",
        "lang",
        "hook",
        "n",
        "vote_code",
        "hook_line",
        "post_url",
        "compound_url",
        "is_example",
        "views",
        "likes",
        "comments",
        "shares",
        "posted_at",
        "updated_at",
        "status",
        "awaiting_url",
        "metric_source",
        "synced_at",
        "interview_n",
        "interview_clip_url",
    ];
    let mut out = Value::Object(
        fields
            .into_iter()
            .filter_map(|k| row.get(k).map(|v| (k.into(), v.clone())))
            .collect(),
    );
    out["vote_code"] = json!(vote_code(row));
    out["status"] = json!(if !text(&row["post_url"]).is_empty() {
        "posted"
    } else if text(&row["status"]).is_empty() {
        "pending"
    } else {
        text(&row["status"])
    });
    out
}
pub fn attribution(raw: &Value) -> Value {
    let mut out = Map::new();
    for key in ["utm_source", "utm_medium", "utm_campaign", "utm_content"] {
        if let Some(v) = raw
            .get(key)
            .filter(|v| !v.is_null())
            .or_else(|| raw.get(&key[4..]))
            .and_then(Value::as_str)
            .filter(|s| {
                (1..=100).contains(&s.len())
                    && s.bytes()
                        .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c))
            })
        {
            out.insert(key.into(), json!(v));
        }
    }
    let referrer = raw["referrer"]
        .as_str()
        .and_then(|s| {
            Url::parse(&if s.contains("://") {
                s.into()
            } else {
                format!("https://{s}")
            })
            .ok()
        })
        .map(|u| {
            let host = u.host_str().unwrap_or("");
            if [
                "instagram.com",
                "l.instagram.com",
                "tiktok.com",
                "x.com",
                "t.co",
                "linkedin.com",
                "lnkd.in",
                "twitch.tv",
                "corvus.gent",
                "web.whatsapp.com",
                "youtube.com",
                "youtu.be",
            ]
            .contains(&host.strip_prefix("www.").unwrap_or(host))
            {
                host.to_string()
            } else {
                "other".into()
            }
        })
        .unwrap_or_default();
    out.insert("referrer".into(), json!(referrer));
    Value::Object(out)
}
