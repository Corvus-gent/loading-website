use super::{
    model::{self, count, text},
    store::Registry,
};
use crate::Error;
use corvus_core::videos::parse_slug;
use serde_json::{Value, json};
use url::Url;

fn field(raw: &Value, name: &str, label: &str, max: usize) -> Result<String, Error> {
    raw[name]
        .as_str()
        .filter(|s| {
            s.encode_utf16().count() <= max
                && !s.chars().any(|c| {
                    c <= '\u{8}'
                        || c == '\u{b}'
                        || c == '\u{c}'
                        || ('\u{e}'..='\u{1f}').contains(&c)
                        || c == '\u{7f}'
                })
        })
        .map(str::to_string)
        .ok_or_else(|| format!("invalid {label}").into())
}
pub fn validate_export(raw: &Value) -> Result<Value, Error> {
    let parsed = parse_slug(text(&raw["slug"])).ok_or("invalid export slug")?;
    let mut out = serde_json::to_value(parsed)?;
    for key in ["platform", "account", "lang", "hook"] {
        if raw[key] != out[key] {
            return Err(format!("export {key} does not match slug").into());
        }
    }
    if raw["vote_code"] != model::vote_code(&out) {
        return Err("export vote code does not match slug".into());
    }
    let share = model::safe_post_url(&raw["share_url"], true)?;
    if share.is_empty() {
        return Err("export needs a share URL".into());
    }
    let download = field(raw, "download_url", "download URL", 4000)?;
    let url = Url::parse(&download).map_err(|_| "Invalid URL")?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return Err("export download needs HTTPS".into());
    }
    let path = field(raw, "local_path", "local path", 2000)?;
    if !path.starts_with('/') || !path.to_ascii_lowercase().ends_with(".mp4") {
        return Err("export needs an absolute MP4 path".into());
    }
    let caption = field(raw, "caption", "caption", 10000)?;
    if model::trim(&caption).is_empty() {
        return Err("export needs a caption".into());
    }
    let order = raw["export_order"]
        .as_f64()
        .filter(|n| {
            n.is_finite() && (0.0..=9_007_199_254_740_991.0).contains(n) && n.fract() == 0.0
        })
        .ok_or("invalid export order")?;
    out["pinned_comment"] = json!(model::pinned_comment(&out));
    out["vote_code"] = raw["vote_code"].clone();
    out["share_url"] = json!(share);
    out["download_url"] = json!(download);
    out["local_path"] = json!(path);
    out["filename"] = json!(path.rsplit('/').next().unwrap_or(""));
    out["caption"] = json!(caption);
    out["export_order"] = json!(order as u64);
    out["round"] = json!(if ["R03", "R04", "R05"].contains(&text(&raw["round"])) {
        text(&raw["round"])
    } else {
        ""
    });
    Ok(out)
}
async fn mutate<F>(registry: &Registry<'_>, slug: &str, change: F) -> Result<Value, Error>
where
    F: Fn(Option<Value>) -> Result<(Value, Option<Value>), Error>,
{
    for _ in 0..5 {
        let old = registry.raw(slug).await?;
        let existing = if let Some(raw) = old.as_str() {
            Some(serde_json::from_str(raw)?)
        } else {
            registry.get(slug).await?
        };
        if existing.as_ref().is_some_and(|v: &Value| !v.is_object()) {
            return Err("invalid stored video".into());
        }
        let (row, asset) = change(existing)?;
        let result=registry.eval("local current=redis.call('HGET',KEYS[1],ARGV[1])\nif (current or '')~=ARGV[2] then return 0 end\nif not current and redis.call('HLEN',KEYS[1])>=1000 then return -1 end\nredis.call('HSET',KEYS[1],ARGV[1],ARGV[3]);if ARGV[4]~='' then redis.call('HSET',KEYS[2],ARGV[1],ARGV[4]) end;return 1",&[registry.key("videos"),registry.key("export-assets")],&[slug.into(),text(&old).into(),row.to_string(),asset.map(|v|v.to_string()).unwrap_or_default()]).await?;
        if count(&result) == 1 {
            return Ok(row);
        }
        if count(&result) < 0 {
            return Err("video registry is full".into());
        }
    }
    Err("This video changed. Please retry.".into())
}
pub async fn import_export(registry: &Registry<'_>, raw: &Value) -> Result<Value, Error> {
    let asset = validate_export(raw)?;
    mutate(registry, text(&asset["slug"]), |existing| {
        let mut raw = asset.clone();
        if let Some(old) = &existing {
            for (k, v) in old.as_object().ok_or("invalid stored video")? {
                raw[k] = v.clone();
            }
        }
        raw["slug"] = asset["slug"].clone();
        raw["vote_code"] = asset["vote_code"].clone();
        raw["compound_url"] = asset["share_url"].clone();
        raw["status"] = json!(if text(&raw["post_url"]).is_empty() {
            "ready"
        } else {
            "posted"
        });
        let mut row = model::video(&raw, true, &model::now())?;
        if let Some(old) = existing {
            for key in [
                "metric_source",
                "synced_at",
                "interview_n",
                "interview_clip_url",
            ] {
                if let Some(v) = old.get(key) {
                    row[key] = v.clone();
                }
            }
        }
        Ok((row, Some(asset.clone())))
    })
    .await
}
pub async fn mark_posted(
    registry: &Registry<'_>,
    slug: &str,
    url: &Value,
    at: &str,
) -> Result<Value, Error> {
    let parsed = parse_slug(slug).ok_or("Choose a registered slug.")?;
    let post_url = model::safe_post_url(url, false)?;
    if post_url.is_empty() {
        return Err("Paste the published post URL.".into());
    }
    let hosts: &[&str] = match parsed.platform.as_str() {
        "tt" => &[
            "tiktok.com",
            "vm.tiktok.com",
            "vt.tiktok.com",
            "m.tiktok.com",
        ],
        "ig" => &["instagram.com"],
        "x" => &["x.com", "twitter.com"],
        "li" => &["linkedin.com", "lnkd.in"],
        "tw" => &["twitch.tv"],
        _ => &["youtube.com", "m.youtube.com", "youtu.be"],
    };
    let u = Url::parse(&post_url)?;
    let host = u.host_str().unwrap_or("");
    if !hosts.contains(&host.strip_prefix("www.").unwrap_or(host)) {
        return Err("The post URL must match this slug’s platform.".into());
    }
    mutate(registry, slug, |existing| {
        let mut row = existing.ok_or("This slug is not registered.")?;
        if !text(&row["post_url"]).is_empty() && row["post_url"] != post_url {
            return Err("Already posted at another URL. Use the full editor to correct it.".into());
        }
        let mut raw = row.clone();
        raw["post_url"] = json!(post_url);
        raw["status"] = json!("posted");
        if !corvus_core::army::truthy(&raw["posted_at"]) {
            raw["posted_at"] = json!(at);
        }
        for (k, v) in model::video(&raw, true, &model::now())?
            .as_object()
            .ok_or("invalid video")?
        {
            row[k] = v.clone();
        }
        Ok((row, None))
    })
    .await
}
