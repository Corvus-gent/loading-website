use super::{Provider, ProviderError, env_for, list, merge, normalized, pending};
use crate::compound_v2::model::{number, text};
use corvus_core::{army::truthy, impact};
use reqwest::Method;
use serde_json::{Map, Value, json};
use std::collections::HashSet;
use url::Url;
fn numeric(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit())
}
fn post_id(row: &Value) -> Result<String, ProviderError> {
    let u = Url::parse(text(&row["post_url"]))?;
    Ok(u.path()
        .split('/')
        .filter(|s| !s.is_empty())
        .next_back()
        .unwrap_or("")
        .into())
}
fn instagram_id(value: &str) -> Result<String, ProviderError> {
    let u = Url::parse(value)?;
    Ok(u.path().split('/').nth(2).unwrap_or("").into())
}
impl Provider<'_> {
    pub async fn instagram(
        &self,
        rows: &[Value],
        registered: &[Value],
        account: &str,
    ) -> Result<Value, ProviderError> {
        let permission = "Professional Instagram account linked to a Facebook Page; Facebook Login token with instagram_basic, instagram_manage_insights and pages_read_engagement.";
        let token_key = env_for("IG_ACCESS_TOKEN", account);
        let user_key = env_for("IG_USER_ID", account);
        let (Some(token), Some(user)) = (
            self.credential(&token_key),
            self.credential(&user_key).filter(|s| numeric(s)),
        ) else {
            return Ok(pending(format!(
                "{token_key} and {user_key} required. {permission}"
            )));
        };
        let get = async |path: String, params: Vec<(&str, String)>| {
            self.get(
                Self::url(&format!("https://graph.facebook.com/v24.0/{path}"), &params)?,
                token,
                permission,
            )
            .await
        };
        let owner = get(user.into(), vec![("fields", "id,username".into())]).await?;
        if normalized(&owner["username"]) != normalized(&json!(account)) {
            return Err(ProviderError::new(format!(
                "Instagram token/account mismatch for @{account}"
            )));
        }
        let mut wanted = Map::new();
        for row in rows {
            wanted.insert(instagram_id(text(&row["post_url"]))?, row.clone());
        }
        let mut seen = registered
            .iter()
            .map(|r| instagram_id(text(&r["post_url"])))
            .collect::<Result<HashSet<_>, _>>()?;
        let mut updates = Vec::new();
        let mut posts = Vec::new();
        let mut after: Option<String> = None;
        let mut warning = None;
        for page in 0..8 {
            if page > 0 && wanted.is_empty() {
                break;
            }
            let mut params = vec![
                (
                    "fields",
                    "id,permalink,media_type,username,like_count,comments_count,timestamp".into(),
                ),
                ("limit", "100".into()),
            ];
            if let Some(a) = &after {
                params.push(("after", a.clone()));
            }
            let data = get(format!("{user}/media"), params).await?;
            let media = data["data"]
                .as_array()
                .ok_or_else(|| ProviderError::new("Invalid Instagram media response."))?;
            for media in media {
                let permalink = text(&media["permalink"]);
                let Ok(u) = Url::parse(permalink) else {
                    continue;
                };
                if u.scheme() != "https"
                    || !matches!(u.host_str(), Some("www.instagram.com" | "instagram.com"))
                {
                    continue;
                }
                let mut parts = u.path().split('/');
                parts.next();
                let kind = parts.next().unwrap_or("");
                let code = parts.next().unwrap_or("");
                if !["reel", "p", "tv"].contains(&kind)
                    || code.is_empty()
                    || !code
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
                {
                    continue;
                }
                let row = wanted.get(code).cloned();
                if (row.is_none()
                    && (page > 0
                        || seen.contains(code)
                        || posts.len() >= 30
                        || normalized(&media["username"]) != normalized(&json!(account))))
                    || media["media_type"] != "VIDEO"
                    || !numeric(text(&media["id"]))
                {
                    continue;
                }
                wanted.remove(code);
                let mut ins = Value::Null;
                if warning.is_none() {
                    match get(
                        format!("{}/insights", text(&media["id"])),
                        vec![("metric", "views,shares,saved".into())],
                    )
                    .await
                    {
                        Ok(v) => ins = v["data"].clone(),
                        Err(e) if e.status == 429 => return Err(e),
                        Err(e) => warning = Some(e.to_string()),
                    }
                }
                let mut input = media.clone();
                input["insights"] = ins;
                let patch = impact::normalize("ig", &input, false);
                if let Some(row) = row {
                    if patch.as_object().is_some_and(|v| !v.is_empty()) {
                        updates.push(json!({"row":row,"patch":patch}));
                    }
                } else {
                    seen.insert(code.into());
                    let mut post = json!({"post_url":media["permalink"],"account":account,"posted_at":media["timestamp"],"original_by_gabe":true,"post_type":"original","media_type":"video","native_video":true});
                    merge(&mut post, &patch);
                    posts.push(post);
                }
            }
            after = if truthy(&data["paging"]["next"]) {
                data["paging"]["cursors"]["after"]
                    .as_str()
                    .filter(|v| !v.is_empty())
                    .map(str::to_string)
            } else {
                None
            };
            if after.is_none() {
                break;
            }
        }
        Ok(
            json!({"mode":"instagram-insights","error":warning,"note":warning.clone().unwrap_or(format!("{} original media IDs matched to registered posts; unavailable insights are retained.",updates.len())),"updates":updates,"posts":posts}),
        )
    }
    pub async fn tiktok(
        &self,
        rows: &[Value],
        registered: &[Value],
        account: &str,
    ) -> Result<Value, ProviderError> {
        let permission = format!("Owner OAuth access token with video.list for @{account}");
        let token_key = env_for("TIKTOK_ACCESS_TOKEN", account);
        let Some(token) = self.credential(&token_key) else {
            return Ok(pending(format!("{token_key} required: {permission}")));
        };
        let fields = "id,share_url,create_time,title,cover_image_url,duration,view_count,like_count,comment_count,share_count";
        let get = async |path: &str, body: Value| -> Result<Vec<Value>, ProviderError> {
            let d = self
                .request(
                    Method::POST,
                    Self::url(
                        &format!("https://open.tiktokapis.com/v2/video/{path}/"),
                        &[("fields", fields.into())],
                    )?,
                    &[
                        ("Authorization", &format!("Bearer {token}")),
                        ("Content-Type", "application/json"),
                    ],
                    Some(body.to_string()),
                    &permission,
                )
                .await?;
            if truthy(&d["error"]["code"]) && d["error"]["code"] != "ok" {
                return Err(ProviderError {
                    message: format!("TikTok {}. {permission}", text(&d["error"]["code"])),
                    status: if d["error"]["code"] == "rate_limit_exceeded" {
                        429
                    } else {
                        0
                    },
                    retry_after: 0.0,
                });
            }
            Ok(list(&d["data"], "videos").to_vec())
        };
        let mut known = Map::new();
        for row in rows {
            known.insert(post_id(row)?, row.clone());
        }
        let mut updates = Vec::new();
        let mut posts = Vec::new();
        let ids = known.keys().cloned().collect::<Vec<_>>();
        for batch in ids.chunks(20) {
            for v in get("query", json!({"filters":{"video_ids":batch}})).await? {
                if let Some(row) = known.get(text(&v["id"])) {
                    updates.push(json!({"row":row,"patch":impact::normalize("tt",&v,false)}));
                }
            }
        }
        let registered = registered
            .iter()
            .map(post_id)
            .collect::<Result<HashSet<_>, _>>()?;
        for v in get("list", json!({"max_count":20})).await? {
            let Ok(u) = Url::parse(text(&v["share_url"])) else {
                continue;
            };
            let path = u.path().trim_end_matches('/');
            let segments = path.split('/').collect::<Vec<_>>();
            if registered.contains(text(&v["id"]))
                || u.host_str() != Some("www.tiktok.com")
                || segments.len() != 4
                || !segments[1].starts_with('@')
                || segments[2] != "video"
                || !numeric(segments[3])
                || normalized(&json!(&segments[1][1..])) != normalized(&json!(account))
                || v["id"] != segments[3]
                || number(&v["duration"]).is_none_or(|n| n <= 0.0)
            {
                continue;
            }
            let millis = number(&v["create_time"])
                .filter(|n| n.is_finite())
                .map(|n| (n * 1000.0) as i64)
                .ok_or_else(|| ProviderError::new("Invalid TikTok posting time."))?;
            let date = chrono::DateTime::from_timestamp_millis(millis)
                .ok_or_else(|| ProviderError::new("Invalid TikTok posting time."))?
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
            let mut post = json!({"post_url":format!("{}{}",u.origin().ascii_serialization(),u.path()),"account":account,"posted_at":date,"media_type":"video","post_type":"original","original_by_gabe":true,"native_video":true});
            for (k, from) in [("label", "title"), ("thumbnail_url", "cover_image_url")] {
                if let Some(v) = v.get(from) {
                    post[k] = v.clone();
                }
            }
            merge(&mut post, &impact::normalize("tt", &v, false));
            posts.push(post);
        }
        Ok(
            json!({"mode":"tiktok-display","updates":updates,"posts":posts,"note":"Owner video.list: views, likes, comments and shares. This API does not return saves."}),
        )
    }
    pub async fn youtube(&self, rows: &[Value]) -> Result<Value, ProviderError> {
        let key = self.credential("YOUTUBE_DATA_API_KEY");
        let owner = self.credential("YOUTUBE_ANALYTICS_ACCESS_TOKEN");
        if key.is_none() && owner.is_none() {
            return Ok(pending(
                "YOUTUBE_DATA_API_KEY required for public counts; optional YOUTUBE_ANALYTICS_ACCESS_TOKEN (yt-analytics.readonly) for owner shares.",
            ));
        }
        let mut known = Map::new();
        for row in rows {
            let u = Url::parse(text(&row["post_url"]))?;
            known.insert(
                u.query_pairs()
                    .find(|(k, _)| k == "v")
                    .map(|(_, v)| v.into_owned())
                    .unwrap_or("null".into()),
                row.clone(),
            );
        }
        let mut updates = Vec::new();
        let mut warning = None;
        let ids = known.keys().cloned().collect::<Vec<_>>();
        for batch in ids.chunks(50) {
            let url = Self::url(
                "https://www.googleapis.com/youtube/v3/videos",
                &[("part", "statistics".into()), ("id", batch.join(","))],
            )?;
            let auth = format!("Bearer {}", owner.unwrap_or(""));
            let headers = if let Some(key) = key {
                vec![("X-Goog-Api-Key", key)]
            } else {
                vec![("Authorization", auth.as_str())]
            };
            let data = self
                .request(
                    Method::GET,
                    url,
                    &headers,
                    None,
                    "Enable YouTube Data API v3 and authorize the API key.",
                )
                .await?;
            for item in list(&data, "items") {
                if let Some(row) = known.get(text(&item["id"])) {
                    updates.push(json!({"row":row,"patch":impact::normalize("yt",item,false)}));
                }
            }
            if let Some(owner) = owner {
                let url = Self::url(
                    "https://youtubeanalytics.googleapis.com/v2/reports",
                    &[
                        ("ids", "channel==MINE".into()),
                        ("dimensions", "video".into()),
                        ("metrics", "shares".into()),
                        ("filters", format!("video=={}", batch.join(","))),
                        ("startDate", "2005-04-23".into()),
                        ("endDate", self.time().get(..10).unwrap_or("").into()),
                    ],
                )?;
                match self.get(url,owner,"YouTube channel-owner OAuth: yt-analytics.readonly (and youtube.readonly).").await{Err(e)if e.status==429=>return Err(e),Err(e)=>warning=Some(e.to_string()),Ok(data)=>{let columns=list(&data,"columnHeaders");let vi=columns.iter().position(|c|c["name"]=="video");let si=columns.iter().position(|c|c["name"]=="shares");if let(Some(vi),Some(si))=(vi,si){for values in list(&data,"rows"){let id=text(&values[vi]);let n=&values[si];if n.as_f64().is_some_and(|n|n.is_finite()&&(0.0..=9_007_199_254_740_991.0).contains(&n)&&n.fract()==0.0)&&let Some(row)=known.get(id)&&let Some(update)=updates.iter_mut().find(|u|u["row"]==*row){update["patch"]["shares"]=n.clone();}}}}}
            }
        }
        Ok(
            json!({"mode":"youtube-api","updates":updates,"error":warning,"note":warning.clone().unwrap_or("YouTube Data API statistics; shares require owner Analytics. favoriteCount is deprecated and is never used as saves.".into())}),
        )
    }
}
