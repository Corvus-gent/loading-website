//! Existing canonical post IDs, owner forms, bulk import and public field allowlist.
use crate::{Error, compound_v2::model as legacy};
use corvus_core::{army::truthy, impact, metrics};
use regex::Regex;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::sync::LazyLock;
use url::Url;

static POST_PATHS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    [
        r"^/([A-Za-z0-9_]+)/status/([0-9]+)/?$",
        r"^/@([^/]+)/video/([0-9]+)/?$",
        r"^/(p|reel|tv)/[A-Za-z0-9_-]+/?$",
        r"^/(posts/[^/]+|feed/update/urn:li:activity:[0-9]+)/?$",
        r"^/videos/[0-9]+/?$",
        r"^/[A-Za-z0-9_-]+/?$",
        r"^/([A-Za-z0-9_]+)/clip/([A-Za-z0-9_-]+)/?$",
        r"^/shorts/([A-Za-z0-9_-]+)/?$",
    ]
    .iter()
    .filter_map(|s| Regex::new(s).ok())
    .collect()
});
fn clean(v: &Value, max: usize) -> String {
    let s = if truthy(v) {
        impact::string(v)
    } else {
        String::new()
    };
    let s = legacy::plain(impact::trimmed(&s));
    String::from_utf16_lossy(&s.encode_utf16().take(max).collect::<Vec<_>>())
}
fn enum_field(
    raw: &Value,
    out: &mut Value,
    key: &str,
    allowed: &[&str],
    error: &str,
) -> Result<(), Error> {
    if let Some(v) = raw.get(key) {
        if !v.as_str().is_some_and(|s| allowed.contains(&s)) {
            return Err(error.into());
        }
        out[key] = v.clone();
    }
    Ok(())
}
pub fn post_info(value: &Value) -> Result<Value, Error> {
    let raw = value
        .as_str()
        .filter(|s| s.encode_utf16().count() <= 1500)
        .ok_or("Paste a valid post URL.")?;
    let mut u = Url::parse(impact::trimmed(raw)).map_err(|_| "Paste a full https:// post URL.")?;
    if u.scheme() != "https"
        || !u.username().is_empty()
        || u.password().is_some()
        || u.port().is_some()
    {
        return Err("Use a public HTTPS post URL.".into());
    }
    let original_host = u.host_str().unwrap_or("");
    let host = original_host
        .strip_prefix("www.")
        .or_else(|| original_host.strip_prefix("m."))
        .unwrap_or(original_host)
        .to_owned();
    let path = u.path().to_owned();
    let mut account = String::new();
    if POST_PATHS.len() != 8 {
        return Err("Post URL configuration unavailable".into());
    }
    let platform;
    if ["x.com", "twitter.com"].contains(&host.as_str())
        && let Some(m) = POST_PATHS[0].captures(&path)
    {
        platform = "x";
        account = m[1].into();
        u.set_host(Some("x.com"))?;
        u.set_path(&format!("/{account}/status/{}", &m[2]));
    } else if host == "tiktok.com"
        && let Some(m) = POST_PATHS[1].captures(&path)
    {
        platform = "tt";
        account = m[1].into();
        u.set_host(Some("www.tiktok.com"))?;
        u.set_path(&format!("/@{account}/video/{}", &m[2]));
    } else if host == "instagram.com" && POST_PATHS[2].is_match(&path) {
        platform = "ig";
        u.set_host(Some("www.instagram.com"))?;
        u.set_path(&format!("{}/", path.trim_end_matches('/')));
    } else if host == "linkedin.com" && POST_PATHS[3].is_match(&path) {
        platform = "li";
        u.set_host(Some("www.linkedin.com"))?;
        u.set_path(path.trim_end_matches('/'));
    } else if host == "twitch.tv" && POST_PATHS[4].is_match(&path) {
        platform = "tw";
        u.set_host(Some("www.twitch.tv"))?;
        u.set_path(path.trim_end_matches('/'));
    } else if host == "clips.twitch.tv" && POST_PATHS[5].is_match(&path) {
        platform = "tw";
        u = Url::parse(&format!(
            "https://clips.twitch.tv/{}",
            path.trim_matches('/')
        ))?;
    } else if host == "twitch.tv"
        && let Some(m) = POST_PATHS[6].captures(&path)
    {
        platform = "tw";
        account = m[1].into();
        u = Url::parse(&format!("https://clips.twitch.tv/{}", &m[2]))?;
    } else if ["youtube.com", "youtu.be"].contains(&host.as_str()) {
        let id = if host == "youtu.be" {
            Some(path[1..].to_string())
        } else {
            POST_PATHS[7]
                .captures(&path)
                .map(|m| m[1].to_string())
                .or_else(|| {
                    u.query_pairs()
                        .find(|(k, _)| k == "v")
                        .map(|(_, v)| v.into_owned())
                })
        };
        let id = id
            .filter(|id| {
                id.len() == 11
                    && id
                        .bytes()
                        .all(|c| c.is_ascii_alphanumeric() || b"_-".contains(&c))
            })
            .ok_or("Use a YouTube video or Shorts URL.")?;
        platform = "yt";
        u = Url::parse(&format!("https://www.youtube.com/watch?v={id}"))?;
    } else {
        return Err("Use a TikTok, Instagram, X, LinkedIn, Twitch or YouTube post URL.".into());
    }
    if platform != "yt" {
        u.set_query(None);
    }
    u.set_fragment(None);
    let post_url = u.to_string();
    let id = format!("{:x}", Sha256::digest(post_url.as_bytes()))[..24].to_owned();
    Ok(json!({"id":id,"platform":platform,"account":account,"post_url":post_url}))
}
pub fn validate(raw: &Value, previous: &Value) -> Result<Value, Error> {
    let info = post_info(if truthy(&raw["post_url"]) {
        &raw["post_url"]
    } else {
        &previous["post_url"]
    })?;
    let mut out = previous
        .as_object()
        .cloned()
        .map(Value::Object)
        .unwrap_or(json!({}));
    for (k, v) in info.as_object().ok_or("Post URL unavailable")? {
        out[k] = v.clone();
    }
    for key in metrics::FIELDS {
        if let Some(v) = raw.get(*key) {
            out[key] = if v.is_null() || v == "" {
                Value::Null
            } else {
                let n = legacy::number(v)
                    .filter(|n| n.is_finite() && (0.0..=1e12).contains(n) && n.fract() == 0.0)
                    .ok_or_else(|| format!("{key} must be a non-negative whole number."))?;
                json!(n as u64)
            };
        }
    }
    for key in ["original_by_gabe", "native_video"] {
        if let Some(v) = raw.get(key) {
            if !v.is_boolean() {
                return Err(format!("Confirm {key}").into());
            }
            out[key] = v.clone();
        }
    }
    enum_field(
        raw,
        &mut out,
        "post_type",
        &["original", "reply", "repost", "quote", "unknown"],
        "Invalid post_type",
    )?;
    enum_field(
        raw,
        &mut out,
        "media_type",
        &[
            "video", "image", "gif", "carousel", "text", "link", "unknown",
        ],
        "Invalid media_type",
    )?;
    if raw.get("post_type").is_none() && raw.get("post_kind").is_some() {
        out["post_type"] = metrics::classification(raw)["post_type"].clone();
    }
    if let Some(v) = raw.get("made_with_compound") {
        if !v.is_boolean() {
            return Err("Choose Compound yes or no.".into());
        }
        out["made_with_compound"] = v.clone();
    }
    enum_field(
        raw,
        &mut out,
        "video_kind",
        &["clip", "highlight", "upload", "archive", "video"],
        "Invalid video kind.",
    )?;
    for (key, max) in [("account", 80), ("label", 160)] {
        if let Some(v) = raw.get(key) {
            out[key] = json!(clean(v, max));
        }
    }
    if !truthy(&out["account"]) {
        out["account"] = if truthy(&info["account"]) {
            info["account"].clone()
        } else if truthy(&previous["account"]) {
            previous["account"].clone()
        } else {
            json!("")
        };
    }
    out["account"] = json!(impact::account_handle(
        legacy::text(&info["platform"]),
        &out["account"]
    ));
    enum_field(
        raw,
        &mut out,
        "view_metric",
        &["views", "impressions"],
        "Choose views or impressions.",
    )?;
    if let Some(v) = raw.get("posted_at") {
        out["posted_at"] = if truthy(v) {
            json!(legacy::posted_date(v).ok_or("Check the posting date.")?)
        } else {
            Value::Null
        };
    }
    if let Some(v) = raw.get("thumbnail_url") {
        out["thumbnail_url"] = if !truthy(v) {
            json!("")
        } else {
            let u = Url::parse(&impact::string(v)).map_err(|_| "Invalid URL")?;
            if u.scheme() != "https"
                || !u.username().is_empty()
                || u.password().is_some()
                || u.port().is_some()
            {
                return Err("Thumbnail must use HTTPS.".into());
            }
            json!(String::from_utf16_lossy(
                &u.as_str().encode_utf16().take(1500).collect::<Vec<_>>()
            ))
        };
    }
    Ok(out)
}
pub fn bulk_rows(text: &Value, made: &Value, allow_unmeasured: bool) -> Result<Vec<Value>, Error> {
    let text = text
        .as_str()
        .filter(|s| s.encode_utf16().count() <= 16000)
        .ok_or("Paste at most 25 rows.")?;
    let lines = text
        .split('\n')
        .map(impact::trimmed)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>();
    if lines.is_empty() || lines.len() > 25 {
        return Err("Paste 1–25 rows.".into());
    }
    let url_re = Regex::new(r"https://[^\s—]+")?;
    let count_re = Regex::new(
        r"(?i)(-?[0-9,]+(?:\.[0-9]+)?)\s*(views?|impressions?|likes?|reactions?|comments?|replies|shares?|reposts?|quotes?|saves?|bookmarks?)",
    )?;
    lines
        .iter()
        .enumerate()
        .map(|(index, line)| {
            let run = || -> Result<Value, Error> {
                let m = url_re.find(line).ok_or("Paste a valid post URL.")?;
                let mut row = json!({"post_url":m.as_str(),"made_with_compound":made});
                post_info(&row["post_url"])?;
                let mut found = 0;
                for m in count_re.captures_iter(&line[m.end()..]) {
                    let unit = m[2].to_ascii_lowercase();
                    let key = if unit.contains("view") || unit.contains("impression") {
                        "views"
                    } else if unit.contains("like") || unit.contains("reaction") {
                        "likes"
                    } else if unit.contains("comment") || unit.contains("repl") {
                        "comments"
                    } else if unit.contains("save") || unit.contains("bookmark") {
                        "saves"
                    } else {
                        "shares"
                    };
                    let value = m[1]
                        .replace(',', "")
                        .parse::<f64>()
                        .ok()
                        .filter(|n| {
                            n.is_finite()
                                && (0.0..=9_007_199_254_740_991.0).contains(n)
                                && n.fract() == 0.0
                        })
                        .ok_or("Metrics must be non-negative whole numbers.")?;
                    if key == "views" {
                        if row.get("views").is_some() {
                            return Err("Use views or impressions, not both.".into());
                        }
                        row["view_metric"] = json!(if unit.contains("impression") {
                            "impressions"
                        } else {
                            "views"
                        });
                    }
                    row[key] = json!(row[key].as_f64().unwrap_or(0.0) + value);
                    found += 1;
                }
                if found == 0 && (!allow_unmeasured || *line != m.as_str()) {
                    return Err("include metrics, e.g. 5052 views, 54 likes".into());
                }
                validate(&row, &json!({}))
            };
            run().map_err(|e| format!("Line {}: {e}", index + 1).into())
        })
        .collect()
}
pub fn velocity(row: &Value) -> Value {
    let sample = if truthy(&row["first24_sample"]) {
        Some(row["first24_sample"].clone())
    } else {
        metrics::first_day_sample(row)
    };
    sample
        .and_then(|v| v.get("velocity").filter(|n| !n.is_null()).cloned())
        .or_else(|| {
            row["first24_velocity"]
                .as_f64()
                .filter(|n| n.is_finite())
                .map(|n| json!(n))
        })
        .unwrap_or(Value::Null)
}
pub fn public_post(row: &Value) -> Value {
    let mut out = json!({});
    for key in [
        "id",
        "post_url",
        "platform",
        "account",
        "label",
        "slug",
        "posted_at",
        "thumbnail_url",
        "made_with_compound",
        "metric_source",
        "metrics_at",
        "measured_date",
        "field_sources",
        "field_observed",
        "first24_sample",
        "view_metric",
        "vote_code",
        "original_by_gabe",
        "native_video",
        "video_kind",
        "post_kind",
        "post_type",
        "media_type",
        "manual_approved",
        "registry_match",
    ]
    .iter()
    .chain(metrics::FIELDS)
    {
        out[key] = row[*key].clone();
    }
    let classification = metrics::classification(row);
    out["post_type"] = classification["post_type"].clone();
    out["media_type"] = classification["media_type"].clone();
    let eligible = metrics::eligibility(row)["eligible"] == true;
    let coverage = metrics::coverage(row);
    out["score"] = if eligible {
        json!(coverage.score)
    } else {
        Value::Null
    };
    out["engagements"] = if eligible {
        json!(metrics::engagements(row))
    } else {
        Value::Null
    };
    out["velocity"] = if eligible { velocity(row) } else { Value::Null };
    out["missing_metrics"] = json!(coverage.missing);
    out["coverage"] = json!(coverage);
    out
}
pub fn linkedin_bulk(text: &Value, options: &Value) -> Result<Vec<Value>, Error> {
    let account = impact::account_handle(
        "li",
        options
            .get("account")
            .unwrap_or(&impact::config()["accounts"]["li"]["handles"][0]),
    );
    if !impact::configured("li", &json!(account)) {
        return Err("Choose the configured LinkedIn account.".into());
    }
    if !options["has_video"].is_boolean() || options["original"] != true {
        return Err("Confirm that these are original posts by Gabe.".into());
    }
    let mut rows = bulk_rows(text, &json!(true), true)?;
    for row in &mut rows {
        if row["platform"] != "li" {
            return Err("LinkedIn bulk import accepts LinkedIn URLs only.".into());
        }
        row["account"] = json!(account);
        row["original_by_gabe"] = json!(true);
        row["post_type"] = json!("original");
        row["media_type"] = json!(if options["has_video"] == true {
            "video"
        } else {
            "text"
        });
        row["native_video"] = options["has_video"].clone();
    }
    Ok(rows)
}
pub fn linkedin_post(raw: &Value) -> Result<Value, Error> {
    if raw["has_video"] != true {
        return Err("Confirm this post contains a native uploaded video.".into());
    }
    let confirmed = linkedin_bulk(&raw["post_url"], raw)?
        .into_iter()
        .next()
        .ok_or("LinkedIn post unavailable")?;
    let mut patch = raw.clone();
    for (k, v) in confirmed.as_object().ok_or("LinkedIn post unavailable")? {
        patch[k] = v.clone();
    }
    for key in metrics::FIELDS.iter().copied().chain(["posted_at"]) {
        if (patch[key].is_null() || patch[key] == "")
            && let Some(o) = patch.as_object_mut()
        {
            o.remove(key);
        }
    }
    if patch.get("views").is_none()
        && let Some(o) = patch.as_object_mut()
    {
        o.remove("view_metric");
    }
    validate(&patch, &json!({}))
}
