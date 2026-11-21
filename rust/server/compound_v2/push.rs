use super::{
    model::{self, count, text},
    store::Registry,
};
use crate::Error;
use regex::Regex;
use serde_json::{Value, json};
use std::sync::LazyLock;
use url::Url;
static X: LazyLock<Option<Regex>> = LazyLock::new(|| Regex::new(r"^/[^/]+/status/(\d+)/?$").ok());
static TT: LazyLock<Option<Regex>> = LazyLock::new(|| Regex::new(r"^/@[^/]+/video/(\d+)/?$").ok());
static IG: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"^/(?:reel|p)/([A-Za-z0-9_-]+)/?$").ok());
pub fn post_url(raw: &str) -> Option<Value> {
    let mut url = Url::parse(raw).ok()?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    let host = url
        .host_str()?
        .strip_prefix("www.")
        .unwrap_or(url.host_str()?);
    let (platform, re) = match host {
        "x.com" | "twitter.com" => ("x", &X),
        "tiktok.com" => ("tt", &TT),
        "instagram.com" => ("ig", &IG),
        _ => return None,
    };
    let id = re.as_ref()?.captures(url.path())?[1].to_string();
    url.set_query(None);
    url.set_fragment(None);
    Some(json!({"url":url.as_str(),"platform":platform,"id":id}))
}
pub async fn winner(registry: &Registry<'_>) -> Result<Value, Error> {
    let saved = registry.0.store.get(&registry.key("winner")).await?;
    let mut selection = saved
        .as_str()
        .map(serde_json::from_str::<Value>)
        .transpose()?;
    let mut row = if let Some(slug) = selection
        .as_ref()
        .and_then(|v| v["slug"].as_str())
        .filter(|s| !s.is_empty())
    {
        registry.get(slug).await?
    } else {
        None
    };
    if selection.is_none() {
        selection = registry
            .0
            .settings
            .get("WINNER_POST_URL")
            .and_then(post_url)
            .map(|p| json!({"post_url":p["url"]}));
    }
    if selection.is_none() {
        let mut videos = registry
            .videos()
            .await?
            .into_iter()
            .filter(|v| v["is_example"] != true && post_url(text(&v["post_url"])).is_some())
            .collect::<Vec<_>>();
        videos.sort_by_key(|v| std::cmp::Reverse(count(&v["views"])));
        row = videos.into_iter().next();
        if let Some(v) = &row {
            selection = Some(json!({"slug":v["slug"],"post_url":v["post_url"]}));
        }
    }
    let empty = json!({});
    let row = row.as_ref().unwrap_or(&empty);
    let selection = selection.as_ref().unwrap_or(&empty);
    let raw = if text(&row["post_url"]).is_empty() {
        text(&selection["post_url"])
    } else {
        text(&row["post_url"])
    };
    let Some(mut post) = post_url(raw) else {
        return Ok(json!({"winner":null,"deadline":model::deadline()?}));
    };
    post["slug"] = row
        .get("slug")
        .or_else(|| selection.get("slug"))
        .cloned()
        .unwrap_or(Value::Null);
    post["views"] =
        if row.is_object() && row.get("slug").is_some() && row["metric_source"] != "pending" {
            row["views"].clone()
        } else {
            Value::Null
        };
    post["metric_source"] = json!(if text(&row["metric_source"]).is_empty() {
        "unavailable"
    } else {
        text(&row["metric_source"])
    });
    post["updated_at"] = row["updated_at"].clone();
    Ok(json!({"winner":post,"deadline":model::deadline()?}))
}
pub async fn select(registry: &Registry<'_>, slug: &str) -> Result<Value, Error> {
    let row = registry
        .get(slug)
        .await?
        .filter(|v| v["is_example"] != true && post_url(text(&v["post_url"])).is_some())
        .ok_or("Choose a real TikTok, Instagram or X post with its published URL.")?;
    let selected = json!({"slug":row["slug"],"post_url":post_url(text(&row["post_url"])).ok_or("invalid post")?["url"],"selected_at":model::now()});
    registry
        .0
        .store
        .command(vec![
            "SET".into(),
            registry.key("winner"),
            selected.to_string(),
        ])
        .await?;
    winner(registry).await
}
