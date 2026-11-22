//! Pure, localized owner share drafts. Never posts to a platform.
use crate::videos::{Video, parse_slug};
use serde_json::Value;
use std::sync::OnceLock;
use url::{Url, form_urlencoded};
fn config() -> &'static Value {
    static C: OnceLock<Value> = OnceLock::new();
    C.get_or_init(|| {
        serde_json::from_str(include_str!("../../migration/compound-share-config.json"))
            .unwrap_or(Value::Null)
    })
}
pub fn code(v: &Video) -> String {
    format!("{}-{}-{}", v.lang, v.hook, v.n).to_uppercase()
}
pub fn code_url(v: &Video) -> String {
    format!("https://corvus.gent/c/{}", code(v))
}
pub fn pinned(v: &Video) -> String {
    let ask = match v.lang.as_str() {
        "nl" => "stem op de volgende cut",
        "fr" => "vote pour le prochain montage",
        "pt" => "vota no próximo corte",
        "es" => "vota el próximo montaje",
        "de" => "stimme für den nächsten Schnitt",
        "it" => "vota il prossimo montaggio",
        _ => "vote on the next cut",
    };
    format!("🗳️ {ask}: corvus.gent/c/{}", code(v))
}
fn query(base: &str, pairs: &[(&str, &str)]) -> String {
    let mut q = form_urlencoded::Serializer::new(String::new());
    for (k, v) in pairs {
        q.append_pair(k, v);
    }
    format!("{base}?{}", q.finish())
}
pub fn full(v: &Video, medium: &str) -> String {
    let source = match v.platform.as_str() {
        "tt" => "tiktok",
        "ig" => "instagram",
        "li" => "linkedin",
        "tw" => "twitch",
        "yt" => "youtube",
        _ => "x",
    };
    let medium = if ["bio", "story", "post", "comment", "dm", "live"].contains(&medium) {
        medium
    } else {
        "post"
    };
    query(
        &format!(
            "https://corvus.gent/compound/v2/{}/{}/{}",
            v.lang, v.hook, v.n
        ),
        &[
            ("video", &v.slug),
            ("utm_source", source),
            ("utm_medium", medium),
            ("utm_campaign", "compound-v2"),
            ("utm_content", &v.slug),
        ],
    )
}
pub fn share_copy(slug: &str) -> Result<String, &'static str> {
    let v = parse_slug(slug).ok_or("Invalid video slug.")?;
    let locale = &config()["languages"][&v.lang];
    let template = locale["template"]
        .as_str()
        .ok_or("Missing language template.")?;
    Ok(template
        .replace("{hook}", locale["hooks"][&v.hook].as_str().unwrap_or(""))
        .replace("{code}", &code(&v))
        .trim()
        .into())
}
pub fn tracked(slug: &str, source: &str, medium: &str) -> Result<String, &'static str> {
    let v = parse_slug(slug).ok_or("Invalid share link.")?;
    if !["x", "linkedin", "whatsapp"].contains(&source)
        || !["post", "comment", "dm"].contains(&medium)
    {
        return Err("Invalid share link.");
    }
    Ok(query(
        &code_url(&v),
        &[
            ("utm_source", source),
            ("utm_medium", medium),
            (
                "utm_campaign",
                config()["campaign"].as_str().unwrap_or("compound-v2"),
            ),
            ("utm_content", &v.slug),
        ],
    ))
}
pub fn reply_id(value: &str) -> Option<String> {
    let value = value.trim();
    let lower = value.to_ascii_lowercase();
    let known = [
        "x.com/",
        "www.x.com/",
        "mobile.x.com/",
        "twitter.com/",
        "www.twitter.com/",
        "mobile.twitter.com/",
    ];
    let text = if known.iter().any(|p| lower.starts_with(p)) {
        format!("https://{value}")
    } else {
        value.into()
    };
    let u = Url::parse(&text).ok()?;
    if u.scheme() != "https"
        || !u.username().is_empty()
        || u.password().is_some()
        || u.port().is_some()
        || ![
            "x.com",
            "www.x.com",
            "mobile.x.com",
            "twitter.com",
            "www.twitter.com",
            "mobile.twitter.com",
        ]
        .contains(&u.host_str()?)
    {
        return None;
    }
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    let re=RE.get_or_init(||regex::Regex::new(r"^/(?:[a-zA-Z0-9_]{1,15}/status|i(?:/web)?/status)/([1-9]\d{0,24})(?:/(?:photo|video)/[1-4])?/?$").expect("constant regex"));
    re.captures(u.path()).map(|c| c[1].into())
}
pub fn draft(slug: &str, platform: &str, reply: &str) -> Result<Option<String>, &'static str> {
    let source = if platform == "reply" { "x" } else { platform };
    let medium = if platform == "reply" {
        "comment"
    } else if source == "whatsapp" {
        "dm"
    } else {
        "post"
    };
    let short = tracked(slug, source, medium)?;
    let text = format!("{} {short}", share_copy(slug)?);
    Ok(Some(match platform {
        "linkedin" => query(
            "https://www.linkedin.com/sharing/share-offsite/",
            &[("url", &short)],
        ),
        "whatsapp" => query("https://wa.me/", &[("text", &text)]),
        "reply" => {
            let Some(id) = reply_id(reply) else {
                return Ok(None);
            };
            query(
                "https://x.com/intent/post",
                &[("in_reply_to", &id), ("text", &text)],
            )
        }
        _ => query("https://x.com/intent/post", &[("text", &text)]),
    }))
}
pub fn today(videos: &[Value], day: &str) -> String {
    let rows: Vec<_> = videos
        .iter()
        .filter(|v| !crate::army::truthy(&v["is_example"]))
        .filter_map(|v| parse_slug(v["slug"].as_str()?))
        .collect();
    format!(
        "X drafts · {day} · San Francisco · {} videos\n\n{}",
        rows.len(),
        rows.iter()
            .map(|v| format!(
                "{}\n{}",
                v.slug,
                draft(&v.slug, "x", "").ok().flatten().unwrap_or_default()
            ))
            .collect::<Vec<_>>()
            .join("\n\n")
    )
}
