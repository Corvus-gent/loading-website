//! Identity normalization compatible with js/army/domain.js.
use crate::Error;
use corvus_core::impact::trimmed;
use regex::Regex;
use serde_json::Value;
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
