use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    Visitor,
    Email,
    Soldier,
    Hacker,
    Call,
}

pub const TASTE_SECONDS: u64 = 242;
pub const PAGE_TIERS: &[(&str, Tier)] = &[
    ("/wiki/corvus/namesakes", Tier::Email),
    ("/wiki/corvus", Tier::Soldier),
    ("/wiki/pidgy", Tier::Soldier),
    ("/legion/hacker-room", Tier::Hacker),
    ("/legion/call-room", Tier::Call),
];

/// Decode percent escapes without treating `+` in a path as a space.
pub fn decode_path(path: &str) -> Option<String> {
    let bytes = path.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hi = (*bytes.get(i + 1)? as char).to_digit(16)?;
            let lo = (*bytes.get(i + 2)? as char).to_digit(16)?;
            decoded.push((hi * 16 + lo) as u8);
            i += 3;
        } else {
            decoded.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

pub fn tier_path(path: &str) -> Option<(&'static str, Tier)> {
    let decoded = decode_path(path)?;
    let joined = decoded
        .split('/')
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("/");
    let mut canonical = format!("/{joined}");
    let lower = canonical.to_lowercase();
    for ending in ["/index.html", "/index"] {
        if lower.ends_with(ending) {
            canonical.truncate(canonical.len() - ending.len());
            break;
        }
    }
    PAGE_TIERS.iter().copied().find(|(p, _)| *p == canonical)
}

pub fn safe_https_link(value: &str) -> bool {
    Url::parse(value).is_ok_and(|u| {
        u.scheme() == "https"
            && u.host_str().is_some()
            && u.username().is_empty()
            && u.password().is_none()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn protected_aliases_and_invalid_encoding() {
        for path in [
            "/wiki/corvus",
            "/wiki//corvus/",
            "/wiki/corvus/index.html",
            "/wiki/%63orvus/INDEX/",
        ] {
            assert_eq!(tier_path(path), Some(("/wiki/corvus", Tier::Soldier)));
        }
        assert_eq!(tier_path("/wiki/%FF"), None);
        assert_eq!(tier_path("/wiki/corvus%"), None);
        assert_eq!(tier_path("/compound"), None);
    }
}
