use super::{Provider, ProviderError, list, merge};
use crate::compound_v2::{model::text, sync::platform_id};
use corvus_core::{army::truthy, impact};
use reqwest::Method;
use serde_json::{Map, Value, json};
use std::{collections::HashMap, sync::LazyLock};
use tokio::sync::Mutex;
use url::Url;

pub fn classify_x(item: &Value, includes: &Value) -> Value {
    let author = list(includes, "users")
        .iter()
        .find(|u| u["id"] == item["author_id"]);
    let refs = list(item, "referenced_tweets");
    let post_type = if refs.iter().any(|r| r["type"] == "retweeted") {
        "repost"
    } else if refs.iter().any(|r| r["type"] == "replied_to") || truthy(&item["in_reply_to_user_id"])
    {
        "reply"
    } else if refs.iter().any(|r| r["type"] == "quoted") {
        "quote"
    } else {
        "original"
    };
    let keys = list(&item["attachments"], "media_keys");
    let media = list(includes, "media")
        .iter()
        .filter(|m| keys.contains(&m["media_key"]))
        .collect::<Vec<_>>();
    let media_type = if media.iter().any(|m| m["type"] == "video") {
        "video"
    } else if media.iter().any(|m| m["type"] == "animated_gif") {
        "gif"
    } else if media.iter().any(|m| m["type"] == "photo") {
        "image"
    } else if keys.is_empty() {
        "text"
    } else {
        "unknown"
    };
    let original = author.is_some_and(|a| {
        impact::config()["accounts"]["x"]["handles"]
            .as_array()
            .is_some_and(|handles| {
                handles
                    .iter()
                    .any(|h| truthy(h) && h == &text(&a["username"]).to_lowercase())
            })
    });
    let mut out = json!({"post_type":post_type,"media_type":media_type,"original_by_gabe":original,"native_video":media_type=="video"});
    if let Some(v) = media.iter().find(|m| m["type"] == "video")
        && truthy(&v["preview_image_url"])
    {
        out["thumbnail_url"] = v["preview_image_url"].clone();
    }
    out
}
static TWITCH_TOKENS: LazyLock<Mutex<HashMap<String, (String, i64)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
impl Provider<'_> {
    pub async fn x(&self, rows: &[Value]) -> Result<Value, ProviderError> {
        let Some(token) = self.credential("X_BEARER_TOKEN") else {
            return Ok(
                json!({"mode":"not_configured","updates":[],"error":"X_BEARER_TOKEN missing: X API v2 post lookup with public_metrics is required.","note":"X key absent. Media is checked through the post embed; public video metrics use the scheduled fallback."}),
            );
        };
        let mut updates = Vec::new();
        for batch in rows.chunks(100) {
            let mut ids = Map::new();
            for row in batch {
                let u = Url::parse(text(&row["post_url"]))?;
                ids.insert(
                    u.path().split('/').next_back().unwrap_or("").into(),
                    row.clone(),
                );
            }
            let url=Self::url("https://api.x.com/2/tweets",&[("ids",ids.keys().cloned().collect::<Vec<_>>().join(",")),("tweet.fields","public_metrics,created_at,author_id,attachments,referenced_tweets,in_reply_to_user_id".into()),("expansions","author_id,attachments.media_keys".into()),("media.fields","type,preview_image_url".into()),("user.fields","username".into())])?;
            let body = self.get(url, token, "").await.map_err(|e| {
                if e.status > 0 {
                    ProviderError {
                        message: format!("X unavailable ({}). Previous metrics kept.", e.status),
                        ..e
                    }
                } else {
                    e
                }
            })?;
            let data = body["data"]
                .as_array()
                .ok_or_else(|| ProviderError::new("X returned no usable posts."))?;
            for item in data {
                let Some(row) = ids.get(text(&item["id"])) else {
                    continue;
                };
                let mut patch = classify_x(item, &body["includes"]);
                merge(
                    &mut patch,
                    &impact::normalize("x", &item["public_metrics"], false),
                );
                if impact::timestamp(&item["created_at"]).is_some() {
                    patch["posted_at"] = item["created_at"].clone();
                }
                updates.push(json!({"row":row,"patch":patch}));
            }
        }
        Ok(
            json!({"mode":"x-api","updates":updates,"note":"X views are post impressions; shares include reposts + quotes. Own attached video and original author are checked separately."}),
        )
    }
    pub async fn oriane(&self, rows: &[Value], platform: &str) -> Result<Value, ProviderError> {
        let Some(token) = self.credential("ORIANE_API_KEY") else {
            return Ok(
                json!({"mode":"manual","updates":[],"note":"Manual entry · Oriane key not configured."}),
            );
        };
        let selected = rows
            .iter()
            .filter_map(|row| {
                let mut r = row.clone();
                r["platform"] = json!(platform);
                platform_id(&r).map(|id| (row, id))
            })
            .collect::<Vec<_>>();
        let mut updates = Vec::new();
        for batch in selected.chunks(100) {
            let wanted = batch
                .iter()
                .map(|(row, id)| {
                    (
                        format!("{}:{}", text(&id["platform"]), text(&id["platformId"])),
                        *row,
                    )
                })
                .collect::<HashMap<_, _>>();
            let body = json!({"operator":"and","filters":{"platformId":{"includes":batch.iter().map(|(_,id)|id).collect::<Vec<_>>()}}});
            let data=self.request(Method::POST,Url::parse("https://connect.oriane.xyz/rest/contents/search?limit=100&projection=basic")?,&[("Authorization",&format!("Bearer {token}")),("Content-Type","application/json")],Some(body.to_string()),"").await.map_err(|e|if e.status>0{ProviderError{message:format!("Oriane HTTP {}; check ORIANE_API_KEY and content search access.",e.status),..e}}else{e})?;
            let items = data["data"]["results"]
                .as_array()
                .ok_or_else(|| ProviderError::new("Oriane returned no usable metrics."))?;
            for item in items {
                let Some(row) = wanted.get(&format!(
                    "{}:{}",
                    text(&item["platform"]),
                    text(&item["platformId"])
                )) else {
                    continue;
                };
                let patch = impact::normalize(platform, item, true);
                if patch.as_object().is_some_and(|o| !o.is_empty()) {
                    updates.push(json!({"row":row,"patch":patch}));
                }
            }
        }
        Ok(
            json!({"mode":"oriane","note":format!("{} matched posts; unreported fields kept.",updates.len()),"updates":updates}),
        )
    }
    pub async fn twitch(&self, account: &str, archives: bool) -> Result<Value, ProviderError> {
        let (Some(id), Some(secret)) = (
            self.credential("TWITCH_CLIENT_ID"),
            self.credential("TWITCH_CLIENT_SECRET"),
        ) else {
            return Ok(
                json!({"mode":"not_configured","posts":[],"note":"Helix requires app credentials.","error":"TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not configured."}),
            );
        };
        let cache_key = self.cache_key();
        let mut cache = TWITCH_TOKENS.lock().await;
        let token = if let Some((token, until)) = cache
            .get(&cache_key)
            .filter(|(_, until)| *until >= self.now)
        {
            let _ = until;
            token.clone()
        } else {
            let body = url::form_urlencoded::Serializer::new(String::new())
                .append_pair("client_id", id)
                .append_pair("client_secret", secret)
                .append_pair("grant_type", "client_credentials")
                .finish();
            let result = self
                .request(
                    Method::POST,
                    Url::parse("https://id.twitch.tv/oauth2/token")?,
                    &[("Content-Type", "application/x-www-form-urlencoded")],
                    Some(body),
                    "Helix requires app credentials.",
                )
                .await?;
            let token = result["access_token"]
                .as_str()
                .filter(|s| !s.is_empty())
                .ok_or_else(|| ProviderError::new("Twitch returned no app token."))?
                .to_string();
            let until = self.now
                + ((crate::compound_v2::model::number(&result["expires_in"]).unwrap_or(0.0) - 60.0)
                    .max(0.0)
                    * 1000.0) as i64;
            if cache.len() >= 4 {
                cache.clear();
            }
            cache.insert(cache_key.clone(), (token.clone(), until));
            token
        };
        drop(cache);
        let get =
            async |endpoint: &str, params: Vec<(&str, String)>| -> Result<Value, ProviderError> {
                let url = Self::url(&format!("https://api.twitch.tv/helix/{endpoint}"), &params)?;
                let result = self
                    .request(
                        Method::GET,
                        url,
                        &[
                            ("Authorization", &format!("Bearer {token}")),
                            ("Client-Id", id),
                        ],
                        None,
                        "Helix request failed. Previous metrics kept.",
                    )
                    .await;
                if result.as_ref().is_err_and(|e| e.status == 401) {
                    TWITCH_TOKENS.lock().await.remove(&cache_key);
                }
                result
            };
        let user_data = get("users", vec![("login", account.into())]).await?;
        let user = list(&user_data, "data")
            .first()
            .ok_or_else(|| ProviderError::new(format!("Twitch account not found: {account}")))?;
        let uid = text(&user["id"]);
        let mut posts = Vec::new();
        let since = chrono::DateTime::from_timestamp_millis(self.now - 30 * 86400000)
            .map(|d| d.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_default();
        let clips = get(
            "clips",
            vec![
                ("broadcaster_id", uid.into()),
                ("first", "30".into()),
                ("started_at", since),
            ],
        )
        .await?;
        for c in list(&clips, "data")
            .iter()
            .filter(|c| c["broadcaster_id"] == user["id"])
        {
            posts.push(json!({"post_url":c["url"],"account":account,"label":c["title"],"posted_at":c["created_at"],"views":c["view_count"],"thumbnail_url":c["thumbnail_url"],"original_by_gabe":impact::configured("tw",&json!(account)),"post_type":"original","media_type":"video","native_video":true,"video_kind":"clip"}));
        }
        for kind in ["highlight", "upload", "archive"]
            .into_iter()
            .filter(|k| *k != "archive" || archives)
        {
            let data = get(
                "videos",
                vec![
                    ("user_id", uid.into()),
                    ("type", kind.into()),
                    ("first", "30".into()),
                    ("sort", "time".into()),
                ],
            )
            .await?;
            for v in list(&data, "data")
                .iter()
                .filter(|v| v["user_id"] == user["id"] && v["type"] == kind)
            {
                let mut post = json!({"post_url":v["url"],"account":account,"label":v["title"],"posted_at":v["created_at"],"views":v["view_count"],"original_by_gabe":impact::configured("tw",&json!(account)),"post_type":"original","media_type":"video","native_video":true,"video_kind":kind});
                if let Some(t) = v["thumbnail_url"].as_str() {
                    post["thumbnail_url"] = json!(t.replacen("%{width}", "640", 1).replacen(
                        "%{height}",
                        "360",
                        1
                    ));
                }
                posts.push(post);
            }
        }
        posts.sort_by(|a, b| {
            impact::timestamp(&b["posted_at"]).cmp(&impact::timestamp(&a["posted_at"]))
        });
        posts.truncate(30);
        Ok(
            json!({"mode":"twitch-helix","posts":posts,"error":null,"note":format!("Clips (last 30 days), highlights and uploads{}",if archives{", including archived broadcasts."}else{"; raw past broadcasts excluded."})}),
        )
    }
}
