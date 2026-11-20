//! Platform/account names and one-post metric normalization shared by server and browser.
use crate::{army::truthy, metrics};
use serde_json::{Value, json};
use std::sync::LazyLock;
static CONFIG: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../migration/impact-config.json")).unwrap_or(Value::Null)
});
pub fn config() -> &'static Value {
    &CONFIG
}
pub fn string(value: &Value) -> String {
    match value {
        Value::String(v) => v.clone(),
        Value::Null => "null".into(),
        Value::Object(_) => "[object Object]".into(),
        Value::Array(a) => a
            .iter()
            .map(|v| {
                if v.is_null() {
                    String::new()
                } else {
                    string(v)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        _ => value.to_string(),
    }
}
pub fn trimmed(s: &str) -> &str {
    s.trim_matches(|c: char| c == '\u{feff}' || (c.is_whitespace() && c != '\u{85}'))
}
pub fn normalized_handle(value: &Value) -> String {
    let value = if truthy(value) {
        string(value)
    } else {
        String::new()
    };
    trimmed(&value)
        .strip_prefix('@')
        .unwrap_or(trimmed(&value))
        .to_lowercase()
}
pub fn platform_id(value: &Value) -> String {
    let raw = if truthy(value) {
        string(value)
    } else {
        String::new()
    };
    let raw = trimmed(&raw).to_lowercase();
    config()["accounts"]
        .as_object()
        .and_then(|a| {
            a.iter()
                .find(|(id, v)| **id == raw || v["query"] == raw)
                .map(|(id, _)| id.clone())
        })
        .unwrap_or_default()
}
pub fn account_handle(platform: &str, value: &Value) -> String {
    let value = normalized_handle(value);
    if platform_id(&json!(platform)) == "li" && value == "gl" {
        config()["accounts"]["li"]["handles"][0]
            .as_str()
            .unwrap_or("")
            .into()
    } else {
        value
    }
}
pub fn configured(platform: &str, account: &Value) -> bool {
    config()["accounts"][platform]["handles"]
        .as_array()
        .is_some_and(|a| {
            a.iter()
                .any(|h| truthy(h) && normalized_handle(h) == normalized_handle(account))
        })
}
pub fn configured_accounts() -> Vec<Value> {
    config()["accounts"]
        .as_object()
        .into_iter()
        .flat_map(|a| a.iter())
        .flat_map(|(p, c)| {
            c["handles"]
                .as_array()
                .into_iter()
                .flatten()
                .filter(|h| truthy(h))
                .map(move |h| json!({"platform":p,"account":h}))
        })
        .collect()
}
pub fn filtered(posts: &[Value], platform: &str, account: &str) -> Vec<Value> {
    posts
        .iter()
        .filter(|p| {
            truthy(&p["made_with_compound"])
                && (platform.is_empty()
                    || platform_id(&p["platform"]) == platform_id(&json!(platform)))
                && (account.is_empty()
                    || account_handle(p["platform"].as_str().unwrap_or(""), &p["account"])
                        == account_handle(p["platform"].as_str().unwrap_or(""), &json!(account)))
        })
        .cloned()
        .collect()
}
fn paths(platform: &str, key: &str) -> &'static [&'static str] {
    match (platform, key) {
        ("tt", "views") => &["view_count", "play_count", "playCount", "viewCount"],
        ("tt", "likes") => &["like_count", "digg_count", "diggCount"],
        ("tt", "comments") => &["comment_count", "commentCount"],
        ("tt", "shares") => &["share_count", "shareCount"],
        ("tt", "saves") => &["collect_count", "collectCount", "favorites_count"],
        ("ig", "views") => &[
            "views",
            "play_count",
            "video_play_count",
            "ig_play_count",
            "video_view_count",
            "playCount",
            "view_count",
            "plays",
        ],
        ("ig", "likes") => &[
            "like_count",
            "edge_media_preview_like.count",
            "edge_liked_by.count",
        ],
        ("ig", "comments") => &[
            "comment_count",
            "comments_count",
            "edge_media_to_parent_comment.count",
            "edge_media_to_comment.count",
        ],
        ("ig", "shares") => &["share_count", "reshare_count", "shares_count"],
        ("ig", "saves") => &["save_count", "saved_count", "saved"],
        ("x", "views") => &["impression_count"],
        ("x", "likes") => &["like_count", "favorite_count"],
        ("x", "comments") => &["reply_count", "conversation_count"],
        ("x", "saves") => &["bookmark_count"],
        ("li", "views") => &["impressions", "video_views", "views", "IMPRESSION"],
        ("li", "likes") => &["reactions", "REACTION"],
        ("li", "comments") => &["comments", "COMMENT"],
        ("li", "shares") => &["reposts", "RESHARE"],
        ("li", "saves") => &["saves", "POST_SAVE"],
        ("yt", "views") => &["viewCount"],
        ("yt", "likes") => &["likeCount"],
        ("yt", "comments") => &["commentCount"],
        ("tw", "views") => &["view_count", "viewCount"],
        _ => &[],
    }
}
fn provider(key: &str) -> &'static [&'static str] {
    match key {
        "views" => &["viewsCount", "viewCount"],
        "likes" => &["likesCount", "likeCount"],
        "comments" => &["commentsCount", "commentCount"],
        "shares" => &["sharesCount", "shareCount"],
        "saves" => &["savesCount", "saveCount"],
        _ => &[],
    }
}
pub fn normalize(platform: &str, item: &Value, oriane: bool) -> Value {
    let mut out = json!({});
    let roots = [
        item,
        &item["statistics"],
        &item["stats"],
        &item["statsV2"],
        &item["metrics"],
        &item["public_metrics"],
    ];
    for key in metrics::FIELDS {
        let mut names = Vec::new();
        if oriane {
            names.push(*key);
            names.extend(provider(key));
        }
        names.extend(paths(platform, key));
        'root: for root in roots {
            for field in &names {
                let value = field.split('.').fold(root, |v, k| &v[k]);
                if let Some(n) = metrics::count(value) {
                    out[key] = json!(n);
                    break 'root;
                }
            }
        }
    }
    if platform == "ig" {
        let ins = if truthy(&item["insights"]["data"]) {
            &item["insights"]["data"]
        } else {
            &item["insights"]
        };
        if let Some(ins) = ins.as_array() {
            for (ours, names) in [
                ("views", &["views", "plays"][..]),
                ("shares", &["shares"][..]),
                ("saves", &["saved"][..]),
                ("likes", &["likes"][..]),
                ("comments", &["comments"][..]),
            ] {
                for name in names {
                    let Some(entry) = ins.iter().find(|v| v["name"] == *name) else {
                        continue;
                    };
                    let value = if !entry["total_value"]["value"].is_null() {
                        &entry["total_value"]["value"]
                    } else {
                        entry["values"]
                            .as_array()
                            .and_then(|a| a.last())
                            .map(|v| &v["value"])
                            .unwrap_or(&Value::Null)
                    };
                    if let Some(n) = metrics::count(value) {
                        out[ours] = json!(n);
                        break;
                    }
                }
            }
        }
    }
    if platform == "x" {
        let p = if truthy(&item["public_metrics"]) {
            &item["public_metrics"]
        } else {
            item
        };
        if let (Some(rt), Some(qt)) = (
            metrics::count(&p["retweet_count"]),
            metrics::count(&p["quote_count"]),
        ) {
            out["shares"] = json!(rt + qt);
        }
        if !out["views"].is_null() {
            out["view_metric"] = json!("impressions");
        }
    }
    if platform == "li" && !out["views"].is_null() {
        out["view_metric"] = json!(if !item["impressions"].is_null()
            || !item["IMPRESSION"].is_null()
        {
            "impressions"
        } else {
            "views"
        });
    }
    out
}
pub fn source_kind(s: &str) -> &'static str {
    if [
        "instagram-insights",
        "tiktok-display",
        "youtube-api",
        "helix",
        "x-public-metrics",
    ]
    .iter()
    .any(|v| s.contains(v))
        || ["x-api", "x_api", "x-lookup"].contains(&s)
    {
        "official"
    } else if [
        "browser",
        "scrap",
        "public-reels",
        "yt-dlp",
        "embed",
        "syndication",
    ]
    .iter()
    .any(|v| s.contains(v))
    {
        "scraped"
    } else if ["manual", "self-reported", "owner", "seed"]
        .iter()
        .any(|v| s.contains(v))
    {
        "manual"
    } else if s.to_lowercase().contains("oriane") {
        "provider"
    } else {
        "unknown"
    }
}
pub fn timestamp(v: &Value) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(v.as_str()?)
        .ok()
        .map(|v| v.timestamp_millis())
}
pub fn best_sample(rows: &[Value]) -> Option<Value> {
    let mut samples = rows
        .iter()
        .filter_map(metrics::first_day_sample)
        .collect::<Vec<_>>();
    samples.sort_by(|a, b| {
        timestamp(&b["at"]).cmp(&timestamp(&a["at"])).then_with(|| {
            a["missing"]
                .as_array()
                .map(Vec::len)
                .cmp(&b["missing"].as_array().map(Vec::len))
        })
    });
    samples.into_iter().next()
}
pub fn refresh_ms(row: &Value, now: i64) -> i64 {
    if ["posted_at", "first_seen_at"]
        .iter()
        .any(|k| timestamp(&row[*k]).is_some_and(|t| now >= t && now - t < 86400000))
    {
        3600000
    } else {
        86400000
    }
}
