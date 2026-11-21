use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use url::form_urlencoded;

pub const PLATFORMS: &[&str] = &["tt", "ig", "x", "li", "tw", "yt"];
pub const ACCOUNTS: &[&str] = &["gl", "bjj", "gm", "collab"];
pub const LANGUAGES: &[&str] = &[
    "nl", "en", "fr", "pt", "es", "de", "it", "ca", "eu", "tl", "zh", "tr", "ar", "ru", "ce", "pl",
    "fa", "ln", "ay", "qu",
];
pub const HOOKS: &[&str] = &[
    "a", "b", "c", "d", "e", "f", "mom", "bjj", "startup", "side", "comm", "int", "live", "demo",
];
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Video {
    pub slug: String,
    pub platform: String,
    pub account: String,
    pub lang: String,
    pub hook: String,
    pub n: u16,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Code {
    pub lang: String,
    pub hook: String,
    pub n: u16,
    pub code: String,
}
fn hook_number(s: &str, dash: bool) -> Option<(String, u16)> {
    let start = s.find(|c: char| c.is_ascii_digit())?;
    let mut hook = &s[..start];
    let number = &s[start..];
    if dash {
        hook = hook.strip_suffix('-').unwrap_or(hook);
    }
    if !HOOKS.contains(&hook)
        || number.len() > 4
        || number.starts_with('0')
        || !number.bytes().all(|c| c.is_ascii_digit())
    {
        return None;
    }
    Some((hook.into(), number.parse().ok()?))
}
pub fn parse_slug(value: &str) -> Option<Video> {
    let parts: Vec<_> = value.split('-').collect();
    if parts.len() != 4
        || !PLATFORMS.contains(&parts[0])
        || !ACCOUNTS.contains(&parts[1])
        || !LANGUAGES.contains(&parts[2])
    {
        return None;
    }
    let (hook, n) = hook_number(parts[3], false)?;
    Some(Video {
        slug: value.into(),
        platform: parts[0].into(),
        account: parts[1].into(),
        lang: parts[2].into(),
        hook,
        n,
    })
}
pub fn parse_code(value: &str) -> Option<Code> {
    let s = value.trim().to_ascii_lowercase();
    if !s.is_ascii() || s.len() < 4 {
        return None;
    }
    let lang = &s[..2];
    if !LANGUAGES.contains(&lang) {
        return None;
    }
    let tail = s[2..].strip_prefix('-').unwrap_or(&s[2..]);
    let (hook, n) = hook_number(tail, true)?;
    Some(Code {
        lang: lang.into(),
        code: format!("{lang}-{hook}-{n}").to_ascii_uppercase(),
        hook,
        n,
    })
}
pub fn path(v: &Video) -> String {
    format!("/compound/v2/{}/{}/{}", v.lang, v.hook, v.n)
}
pub fn source(platform: &str) -> &str {
    match platform {
        "tt" => "tiktok",
        "ig" => "instagram",
        "li" => "linkedin",
        "tw" => "twitch",
        "yt" => "youtube",
        _ => "x",
    }
}
pub fn destination(slug: &str, query: &Value) -> Option<String> {
    let v = parse_slug(slug)?;
    let mut pairs = vec![("video".to_string(), slug.to_string())];
    let mut has_utm = false;
    if let Some(entries) = query.as_object() {
        for (k, value) in entries {
            if ["compoundV2", "slug", "short"].contains(&k.as_str()) {
                continue;
            }
            let Some(value) = value.as_str().filter(|v| v.chars().count() <= 500) else {
                continue;
            };
            if k.to_ascii_lowercase().starts_with("utm_") {
                has_utm = true;
            }
            if [
                "utm_source",
                "utm_medium",
                "utm_campaign",
                "utm_content",
                "utm_term",
                "utm_id",
                "c",
            ]
            .contains(&k.as_str())
            {
                pairs.push((k.clone(), value.into()));
            }
        }
    }
    if !has_utm {
        pairs.extend(
            [
                ("utm_source", source(&v.platform)),
                (
                    "utm_medium",
                    if v.platform == "tw" { "live" } else { "post" },
                ),
                ("utm_campaign", "compound-v2"),
                ("utm_content", slug),
            ]
            .map(|(k, v)| (k.into(), v.into())),
        );
    }
    Some(format!(
        "{}?{}",
        path(&v),
        form_urlencoded::Serializer::new(String::new())
            .extend_pairs(pairs)
            .finish()
    ))
}
pub fn resolve_code(raw: &str, videos: &[Video], query: &Value, source: &str) -> Value {
    let parsed = parse_code(raw);
    let code = parsed.as_ref().map(|p| p.code.clone()).unwrap_or_else(|| {
        let v = raw
            .to_ascii_uppercase()
            .chars()
            .filter(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || *c == '-')
            .take(32)
            .collect::<String>();
        if v.is_empty() { "UNKNOWN".into() } else { v }
    });
    let mut matches: Vec<&Video> = parsed
        .as_ref()
        .map(|p| {
            videos
                .iter()
                .filter(|v| v.lang == p.lang && v.hook == p.hook && v.n == p.n)
                .collect()
        })
        .unwrap_or_default();
    matches.sort_by(|a, b| a.slug.cmp(&b.slug));
    let mut pairs: Vec<(String, String)> = query
        .as_object()
        .map(|q| {
            q.iter()
                .filter_map(|(k, v)| {
                    v.as_str()
                        .filter(|v| {
                            k.to_ascii_lowercase().starts_with("utm_") && v.chars().count() <= 500
                        })
                        .map(|v| (k.clone(), v.into()))
                })
                .collect()
        })
        .unwrap_or_default();
    let route = if let (Some(p), Some(first)) = (parsed.as_ref(), matches.first()) {
        let route = if matches.len() == 1 {
            path(first)
        } else {
            format!("/compound/v2/{}/{}", p.lang, p.hook)
        };
        let has_utm = !pairs.is_empty();
        pairs.push(("c".into(), code.clone()));
        if matches.len() == 1 {
            pairs.push(("video".into(), first.slug.clone()));
        }
        if !has_utm {
            pairs.extend([
                ("utm_source".into(), "code".into()),
                (
                    "utm_medium".into(),
                    if source == "url" {
                        "pinned_comment"
                    } else {
                        "typed"
                    }
                    .into(),
                ),
                (
                    "utm_content".into(),
                    if matches.len() == 1 {
                        first.slug.clone()
                    } else {
                        code.clone()
                    },
                ),
            ]);
        }
        route
    } else {
        pairs.extend([
            ("code".into(), raw.chars().take(32).collect()),
            ("code_missing".into(), "1".into()),
        ]);
        "/compound/v2".into()
    };
    json!({"code":code,"parsed":parsed,"matches":matches.len(),"destination":format!("{route}?{}",form_urlencoded::Serializer::new(String::new()).extend_pairs(pairs).finish())})
}
