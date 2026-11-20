use super::{model, security};
use crate::{AppState, Error, compound::store::command, crypto};
use axum::http::{HeaderMap, Method};
use serde_json::{Value, json};
pub struct Partners<'a>(pub &'a AppState);
impl Partners<'_> {
    fn key(&self, s: &str) -> String {
        security::key(&self.0.settings, s)
    }
    fn day(&self) -> Result<String, Error> {
        crate::plethora::pt_day(chrono::Utc::now().timestamp_millis())
    }
    fn hash(&self, h: &HeaderMap, scope: &str) -> Result<String, Error> {
        Ok(crypto::daily_ip_hash(
            &crypto::server_secret(&self.0.settings)?,
            security::header(h, "x-forwarded-for"),
            scope,
            &chrono::Utc::now().format("%Y-%m-%d").to_string(),
        ))
    }
    fn bot(h: &HeaderMap) -> bool {
        let ua = security::header(h, "user-agent").to_ascii_lowercase();
        [
            "bot", "crawler", "spider", "preview", "curl", "wget", "headless",
        ]
        .iter()
        .any(|w| ua.contains(w))
    }
    pub async fn count(&self, m: &Method, h: &HeaderMap, id: &str) -> Result<Value, Error> {
        if model::config()["partners"].get(id).is_none() || *m != Method::GET || Self::bot(h) {
            return Ok(json!(false));
        }
        let result=self.0.store.command(command(&["EVAL","if not redis.call('SET',KEYS[1],'1','NX','EX',1800) then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('HINCRBY',KEYS[3],ARGV[1],1);redis.call('EXPIRE',KEYS[3],34560000);return 1","3",&self.key(&format!("partner-dedupe:{id}:{}",self.hash(h,&format!("partner-{id}"))?)),&self.key("partner-total"),&self.key(&format!("partner-day:{}",self.day()?)),id])).await?;
        Ok(result)
    }
    async fn hashes(
        &self,
        total: &str,
        today: &str,
    ) -> Result<
        (
            serde_json::Map<String, Value>,
            serde_json::Map<String, Value>,
        ),
        Error,
    > {
        let result = self
            .0
            .store
            .pipeline(vec![
                command(&["HGETALL", total]),
                command(&["HGETALL", today]),
            ])
            .await?;
        Ok((
            crate::compound_v2::store::object(result.first().ok_or("totals")?),
            crate::compound_v2::store::object(result.get(1).ok_or("day")?),
        ))
    }
    pub async fn report(&self) -> Result<Value, Error> {
        let (t, d) = self
            .hashes(
                &self.key("partner-total"),
                &self.key(&format!("partner-day:{}", self.day()?)),
            )
            .await?;
        let rows=model::config()["partners"].as_object().ok_or("partners")?.iter().map(|(id,p)|json!({"id":id,"label":p["label"],"total":count(t.get(id)),"today":count(d.get(id))})).collect::<Vec<_>>();
        Ok(json!({"rows":rows,"total":t.values().fold(0.0, |total,v| total+count(Some(v)))}))
    }
    pub async fn count_short(&self, h: &HeaderMap, path: &Value) -> Result<Value, Error> {
        let path = path.as_str().ok_or("fields")?;
        if !regex::Regex::new(
            r"^/go/(?:ig|li|tt|x|luma|dc|wa|mail|qr|bmc|corvus)(?:/[a-z0-9-]{1,48}){0,2}/?$",
        )?
        .is_match(path)
        {
            return Err("fields".into());
        }
        if Self::bot(h) {
            return Ok(json!({"ok":true}));
        }
        let id = path
            .strip_prefix("/go/")
            .ok_or("fields")?
            .trim_end_matches('/');
        self.0.store.command(command(&["EVAL","if redis.call('SET',KEYS[1],'1','NX','EX',1800) then redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('HINCRBY',KEYS[3],ARGV[1],1);redis.call('EXPIRE',KEYS[3],34560000) end;return 1","3",&self.key(&format!("short-dedupe:{id}:{}",self.hash(h,&format!("short-{id}"))?)),&self.key("short-total"),&self.key(&format!("short-day:{}",self.day()?)),id])).await?;
        Ok(json!({"ok":true}))
    }
    pub async fn all(&self) -> Result<Value, Error> {
        let mut rows = self.report().await?["rows"]
            .as_array()
            .ok_or("partners")?
            .clone();
        if let Ok(p) = crate::plethora::report(self.0, chrono::Utc::now().timestamp_millis()).await
        {
            for r in p["rows"].as_array().into_iter().flatten() {
                rows.push(json!({"id":r["id"],"label":r["label"],"total":r["total"],"today":r["series"].as_array().and_then(|v|v.last()),"last24h":r["last24h"]}));
            }
        }
        if let Ok(conf) = crate::support::Config::embedded()
            && let Ok(p) = crate::support::report(self.0, &conf, None).await
        {
            for r in p["rows"].as_array().into_iter().flatten() {
                let mut row = r.clone();
                row["today"] = r["day"].clone();
                row["timeZone"] = json!("Brussels");
                rows.push(row);
            }
        }
        if let Ok((a, d)) = self
            .hashes(
                &self.key("short-total"),
                &self.key(&format!("short-day:{}", self.day()?)),
            )
            .await
        {
            for (id, total) in a {
                rows.push(json!({"id":id,"label":id,"total":count(Some(&total)),"today":count(d.get(&id)),"note":"Aggregate tracking from 9 Nov 2026"}));
            }
        }
        if let Ok(p) = crate::impact::store::Impact(self.0).click_report().await {
            rows.extend(p["rows"].as_array().into_iter().flatten().cloned());
        }
        let day = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let prefix = if self.0.settings.production() {
            "live:clicks"
        } else {
            "live:preview:clicks"
        };
        if let Ok((a, d)) = self
            .hashes(&format!("{prefix}:all"), &format!("{prefix}:{day}"))
            .await
        {
            for id in ["twitch", "instagram", "twitter"] {
                rows.push(json!({"id":id,"label":id,"total":count(a.get(id)),"today":count(d.get(id)),"timeZone":"UTC"}));
            }
        }
        let prefix =
            self.0
                .settings
                .get("BATTLE_TEST_PREFIX")
                .unwrap_or(if self.0.settings.production() {
                    "battle:v1"
                } else {
                    "battle:preview:v1"
                });
        if let Ok((a, d)) = self
            .hashes(
                &format!("{prefix}:clicks"),
                &format!("{prefix}:clicks-day:{day}"),
            )
            .await
            && let Ok(start) = self
                .0
                .store
                .get(&format!("{prefix}:clicks-daily-start"))
                .await
        {
            for (short, fighter) in [("cx", "codex"), ("cp", "compound"), ("bio", "bio")] {
                for (p, platform) in [
                    ("tt", "tiktok"),
                    ("ig", "instagram"),
                    ("x", "x"),
                    ("li", "linkedin"),
                ] {
                    let key = format!("{fighter}:{platform}");
                    let mut row = json!({"id":format!("{short}-{p}"),"label":format!("Battle · {fighter} · {platform}"),"total":count(a.get(&key)),"today":if start.is_null()||start==day{Value::Null}else{json!(count(d.get(&key)))},"timeZone":"UTC"});
                    if start.is_null() {
                        row["note"] = json!("daily history begins with the next click");
                    } else if start == day {
                        row["note"] = json!("daily tracking starts today");
                    }
                    rows.push(row);
                }
            }
        }
        rows.sort_by(|a, b| count(Some(&b["total"])).total_cmp(&count(Some(&a["total"]))));
        Ok(json!(rows))
    }
}
fn count(v: Option<&Value>) -> f64 {
    v.and_then(crate::compound_v2::model::number).unwrap_or(0.)
}
