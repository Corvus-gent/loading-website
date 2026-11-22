//! Identity normalization compatible with js/army/domain.js.
use crate::Error;
pub use corvus_core::army::{active_tier, public_soldier};
use corvus_core::impact::trimmed;
use regex::Regex;
use serde_json::{Value, json};
/// Default locale collation for validated ASCII IDs (punctuation, folded letters, case).
pub fn ascii_compare(a: &str, b: &str) -> std::cmp::Ordering {
    let key = |s: &str| {
        s.bytes()
            .map(|b| match b {
                b'_' => 1,
                b'-' => 2,
                _ => b.to_ascii_lowercase(),
            })
            .collect::<Vec<_>>()
    };
    key(a).cmp(&key(b)).then_with(|| {
        a.bytes()
            .map(|b| b.is_ascii_uppercase())
            .cmp(b.bytes().map(|b| b.is_ascii_uppercase()))
    })
}
pub fn username(v: &Value) -> String {
    let s = trimmed(v.as_str().unwrap_or("")).to_lowercase();
    let mut out = String::new();
    let mut space = false;
    for c in s.trim_start_matches('@').chars() {
        if trimmed(&c.to_string()).is_empty() {
            if !space {
                out.push('_');
            }
            space = true;
        } else {
            out.push(c);
            space = false;
        }
    }
    out
}
pub fn valid_username(s: &str) -> bool {
    (3..=24).contains(&s.len())
        && s.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
        && s.bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'_' || c == b'-')
        && ![
            "admin",
            "private",
            "api",
            "general",
            "corvus",
            "soldier",
            "unknown",
            "undefined",
            "null",
        ]
        .contains(&s)
}
pub fn email(v: &Value) -> Result<String, Error> {
    let s = trimmed(v.as_str().unwrap_or("")).to_lowercase();
    // JS whitespace excludes NEL and includes BOM.
    let pattern = Regex::new(r"^[^\s\u{feff}@<>]+@[^\s\u{feff}@<>]+\.[^\s\u{feff}@<>]+$")?;
    if s.encode_utf16().count() > 254 || !pattern.is_match(&s.replace('\u{85}', "x")) {
        return Err("email".into());
    }
    Ok(s)
}
pub fn link(v: &Value) -> Result<String, Error> {
    use corvus_core::army::truthy;
    let raw = if let Some(s) = v.as_str() {
        json!(trimmed(s))
    } else {
        v.clone()
    };
    if !truthy(&raw) {
        return Ok(String::new());
    }
    let s = raw
        .as_str()
        .filter(|s| s.encode_utf16().count() <= 300)
        .ok_or("link")?;
    let scheme = Regex::new(r"(?i)^[a-z][a-z0-9+.-]*://")?;
    let mut raw = if scheme.is_match(s) {
        s.to_string()
    } else {
        format!("https://{}", s.trim_start_matches('/'))
    };
    if raw
        .get(..7)
        .is_some_and(|s| s.eq_ignore_ascii_case("http://"))
    {
        raw.replace_range(..7, "https://");
    }
    let u = url::Url::parse(&raw).map_err(|_| "link")?;
    let host = u.host_str().unwrap_or("");
    if u.scheme() != "https"
        || !u.username().is_empty()
        || u.password().is_some()
        || !host.contains('.')
        || ["localhost", "127.", "0.", "["]
            .iter()
            .any(|p| host.starts_with(p))
    {
        return Err("link".into());
    }
    Ok(u.to_string())
}
pub fn application(input: &Value) -> Result<Value, Error> {
    let name = username(&input["username"]);
    if !valid_username(&name) {
        return Err("username".into());
    }
    let why = trimmed(input["why"].as_str().unwrap_or(""));
    if why.is_empty()
        || why.chars().count() > 280
        || why
            .chars()
            .any(|c| matches!(c,'\0'..='\u{8}'|'\u{b}'..='\u{1f}'))
    {
        return Err("why".into());
    }
    Ok(
        json!({"email":email(&input["email"] )?,"username":name,"link":link(&input["link"] )?,"why":why,"country":country(&input["country"]),"lang":if corvus_core::army::includes("LANGUAGES",&input["lang"]){input["lang"].clone()}else{json!("en")}}),
    )
}
pub fn country(v: &Value) -> Option<&str> {
    v.as_str()
        .filter(|s| s.len() == 2 && s.bytes().all(|b| b.is_ascii_uppercase()))
}
pub fn day_key(ms: i64) -> Result<String, Error> {
    Ok(chrono::DateTime::from_timestamp_millis(ms)
        .ok_or("time")?
        .with_timezone(&chrono_tz::Europe::Brussels)
        .format("%Y-%m-%d")
        .to_string())
}
pub fn week_key(ms: i64) -> Result<String, Error> {
    use chrono::Datelike;
    let day = chrono::NaiveDate::parse_from_str(&day_key(ms)?, "%Y-%m-%d")?;
    Ok((day - chrono::Duration::days(day.weekday().num_days_from_monday().into())).to_string())
}
pub fn iso(ms: i64) -> Result<String, Error> {
    Ok(chrono::DateTime::from_timestamp_millis(ms)
        .ok_or("time")?
        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
}
pub fn daily_mission(day: &str, kind: &str) -> Result<Value, Error> {
    if !Regex::new(r"^\d{4}-\d{2}-\d{2}$")?.is_match(day)
        || ![
            "babel", "borders", "wordle", "flags", "combo", "bangle", "pingle", "lantern",
        ]
        .contains(&kind)
    {
        return Err("mission".into());
    }
    Ok(
        json!({"id":format!("daily:{day}"),"type":"daily-game","game":kind,"start":day,"end":day,"reward":10}),
    )
}
pub fn mission_reward(m: &Value, now: i64) -> Result<i64, Error> {
    let reward = m["reward"]
        .as_f64()
        .filter(|r| r.fract() == 0. && *r >= 0. && *r <= 1000.)
        .ok_or("mission")? as i64;
    if !["daily-game", "special-puzzle", "hackathon"].contains(&m["type"].as_str().unwrap_or("")) {
        return Err("mission".into());
    }
    let day = day_key(now)?;
    Ok(
        if m["start"].as_str().is_some_and(|s| day.as_str() >= s)
            && m["end"].as_str().is_some_and(|s| day.as_str() <= s)
        {
            reward
        } else {
            0
        },
    )
}
