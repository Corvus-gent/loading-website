use super::{
    model::{self, RETENTION, count, text},
    security,
};
use crate::{AppState, Error, crypto};
use corvus_core::army::truthy;
use serde_json::{Map, Value, json};

pub struct Registry<'a>(pub &'a AppState);
pub fn object(raw: &Value) -> Map<String, Value> {
    raw.as_object().cloned().unwrap_or_else(|| {
        raw.as_array()
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .chunks_exact(2)
            .filter_map(|p| Some((p[0].as_str()?.into(), p[1].clone())))
            .collect()
    })
}
impl Registry<'_> {
    pub fn key(&self, part: &str) -> String {
        format!("{}:{part}", security::prefix(&self.0.settings))
    }
    pub async fn raw(&self, slug: &str) -> Result<Value, Error> {
        Ok(self
            .0
            .store
            .command(vec!["HGET".into(), self.key("videos"), slug.into()])
            .await?)
    }
    pub async fn videos(&self) -> Result<Vec<Value>, Error> {
        let raw = self
            .0
            .store
            .command(vec!["HVALS".into(), self.key("videos")])
            .await?;
        let mut rows = raw
            .as_array()
            .ok_or("invalid video registry")?
            .iter()
            .map(|v| serde_json::from_str::<Value>(text(v)))
            .collect::<Result<Vec<_>, _>>()?;
        for seed in model::seeds()? {
            if !rows.iter().any(|v| v["slug"] == seed["slug"]) {
                rows.push(seed);
            }
        }
        Ok(rows)
    }
    pub async fn get(&self, slug: &str) -> Result<Option<Value>, Error> {
        let raw = self.raw(slug).await?;
        if let Some(raw) = raw.as_str() {
            return Ok(Some(serde_json::from_str(raw)?));
        }
        Ok(model::seeds()?.into_iter().find(|v| v["slug"] == slug))
    }
    pub async fn eval(
        &self,
        script: &str,
        keys: &[String],
        args: &[String],
    ) -> Result<Value, Error> {
        let mut command = vec!["EVAL".into(), script.into(), keys.len().to_string()];
        command.extend_from_slice(keys);
        command.extend_from_slice(args);
        Ok(self.0.store.command(command).await?)
    }
    pub async fn save(&self, raw: &Value, update: bool) -> Result<Value, Error> {
        let old = if update {
            self.get(text(&raw["slug"])).await?
        } else {
            None
        };
        let mut merged = old.clone().unwrap_or_else(|| json!({}));
        if !merged.is_object() {
            return Err("invalid stored video".into());
        }
        if let Some(fields) = raw.as_object() {
            for (k, v) in fields {
                merged[k] = v.clone();
            }
        }
        let pending = old
            .as_ref()
            .is_some_and(|v| truthy(&v["interview_n"]) || v["status"] == "ready");
        let mut row = model::video(&merged, pending, &model::now())?;
        if let Some(old) = old.as_ref().filter(|v| truthy(&v["interview_n"])) {
            row["interview_n"] = old["interview_n"].clone();
            row["interview_clip_url"] = json!(text(&old["interview_clip_url"]));
        }
        let slug = text(&row["slug"]);
        if !update && self.raw(slug).await?.is_string() {
            return Err("slug already exists".into());
        }
        let result=self.eval("if ARGV[3]=='create' and redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 0 end\nif redis.call('HLEN',KEYS[1])>=1000 and redis.call('HEXISTS',KEYS[1],ARGV[1])==0 then return -1 end\nredis.call('HSET',KEYS[1],ARGV[1],ARGV[2]);redis.call('LPUSH',KEYS[2],ARGV[2]);redis.call('LTRIM',KEYS[2],0,199);redis.call('EXPIRE',KEYS[2],ARGV[4]);return 1",&[self.key("videos"),self.key(&format!("metrics-history:{slug}"))],&[slug.into(),row.to_string(),if update {"update"} else {"create"}.into(),RETENTION.to_string()]).await?;
        if count(&result) <= 0 {
            return Err("slug exists or registry is full".into());
        }
        Ok(row)
    }
    pub async fn report(&self, private: bool) -> Result<Value, Error> {
        let rows = self.videos().await?;
        let counts = self
            .0
            .store
            .pipeline(
                rows.iter()
                    .map(|v| {
                        vec![
                            "HGETALL".into(),
                            self.key(&format!("counts:{}", text(&v["slug"]))),
                        ]
                    })
                    .collect(),
            )
            .await?;
        let assets = if private {
            object(
                &self
                    .0
                    .store
                    .command(vec!["HGETALL".into(), self.key("export-assets")])
                    .await?,
            )
        } else {
            Map::new()
        };
        let mut all = Vec::new();
        let mut totals = json!({"videos":0,"views":0,"likes":0,"comments":0,"shares":0,"site_visits":0,"votes":0,"feedback_count":0});
        for (v, c) in rows.iter().zip(&counts) {
            let c = object(c);
            let stats: Value = [
                "pageview",
                "up",
                "down",
                "feedback",
                "share_click",
                "outbound_click",
                "code_entered",
                "redirect",
            ]
            .into_iter()
            .map(|k| (k.into(), json!(c.get(k).map(count).unwrap_or(0))))
            .collect::<Map<_, _>>()
            .into();
            let mut row = model::public_video(v);
            if let Some(asset) = assets.get(text(&v["slug"])) {
                for (k, v) in serde_json::from_str::<Map<String, Value>>(text(asset))? {
                    row[k] = v;
                }
            }
            if private {
                row["pinned_comment"] = json!(model::pinned_comment(v));
            }
            row["votes"] = json!(count(&stats["up"]) + count(&stats["down"]));
            row["site_visits"] = stats["pageview"].clone();
            row["feedback_count"] = stats["feedback"].clone();
            row["ctr"] = if count(&v["views"]) != 0 {
                json!(count(&stats["pageview"]) as f64 / count(&v["views"]) as f64)
            } else {
                Value::Null
            };
            row["stats"] = stats;
            if !truthy(&row["is_example"]) {
                for k in [
                    "videos",
                    "views",
                    "likes",
                    "comments",
                    "shares",
                    "site_visits",
                    "votes",
                    "feedback_count",
                ] {
                    totals[k] =
                        json!(count(&totals[k]) + if k == "videos" { 1 } else { count(&row[k]) });
                }
            }
            all.push(row);
        }
        let mut out = json!({"videos":all,"totals":totals});
        if private {
            let maps = self
                .0
                .store
                .pipeline(
                    ["url", "typed"]
                        .iter()
                        .map(|s| vec!["HGETALL".into(), self.key(&format!("codes:{s}"))])
                        .collect(),
                )
                .await?
                .iter()
                .map(object)
                .collect::<Vec<_>>();
            let mut codes = Vec::new();
            for code in maps.iter().flat_map(|m| m.keys()) {
                if !codes.iter().any(|v: &Value| v["code"] == *code) {
                    codes.push(json!({"code":code,"url":maps[0].get(code).map(count).unwrap_or(0),"typed":maps[1].get(code).map(count).unwrap_or(0)}));
                }
            }
            codes.sort_by_key(|v| std::cmp::Reverse(count(&v["url"])));
            out["code_visits"] = json!(codes);
        }
        out["updated_at"] = json!(model::now());
        out["metric_note"] = json!(
            "Social views are reported per post; they are not unique people. Site visits are page opens. Examples are excluded from totals."
        );
        Ok(out)
    }
    pub async fn event(&self, kind: &str, slug: &str, detail: &Value) -> Result<(), Error> {
        let at = model::now();
        let mut record = json!({"type":kind,"slug":slug});
        if let Some(tags) = detail["tags"].as_object() {
            for (k, v) in tags {
                record[k] = v.clone();
            }
        }
        let lang = text(&detail["lang"]);
        record["lang"] = json!(if lang.is_empty() {
            slug.split('-').nth(2).unwrap_or("")
        } else {
            lang
        });
        record["visitor"] = detail["visitor"].clone();
        record["timestamp"] = json!(at);
        for key in ["code", "source"] {
            if truthy(&detail[key]) {
                record[key] = detail[key].clone();
            }
        }
        self.eval("redis.call('HINCRBY',KEYS[1],ARGV[1],1)\nif ARGV[3]=='1' then redis.call('LPUSH',KEYS[2],ARGV[2]);redis.call('LTRIM',KEYS[2],0,9999);redis.call('EXPIRE',KEYS[2],ARGV[4]) end;return 1",&[self.key(&format!("counts:{slug}")),self.key(&format!("events:{}",&at[..10]))],&[kind.into(),record.to_string(),if truthy(&detail["visitor"]) { "1" } else { "0" }.into(),RETENTION.to_string()]).await?;
        let code = text(&detail["code"]);
        let source = text(&detail["source"]);
        if kind == "code_entered" && !code.is_empty() && ["url", "typed"].contains(&source) {
            self.eval("redis.call('HINCRBY',KEYS[1],ARGV[1],1);redis.call('EXPIRE',KEYS[1],ARGV[2]);return 1",&[self.key(&format!("codes:{source}"))],&[code.into(),RETENTION.to_string()]).await?;
        }
        Ok(())
    }
    pub async fn vote(&self, uid: &str, slug: &str, choice: &str) -> Result<Value, Error> {
        let event = json!({"type":"vote","slug":slug,"choice":choice,"at":model::now()});
        let result=self.eval("local old=redis.call('GET',KEYS[1]);if old then return {0,old} end\nredis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('LPUSH',KEYS[3],ARGV[3]);redis.call('LTRIM',KEYS[3],0,49);redis.call('EXPIRE',KEYS[3],86400);return {1,ARGV[1]}",&[self.key(&format!("vote:{slug}:{uid}")),self.key(&format!("counts:{slug}")),self.key("public-votes")],&[choice.into(),RETENTION.to_string(),event.to_string()]).await?;
        Ok(json!({"added":count(&result[0])==1,"choice":result[1]}))
    }
    pub async fn feedback(
        &self,
        uid: &str,
        slug: &str,
        text: &str,
        handle: &str,
    ) -> Result<Value, Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let at = model::now();
        let now = chrono::Utc::now().timestamp_millis();
        let row = json!({"id":id,"slug":slug,"text":text,"handle":handle,"at":at});
        let result=self.eval("if not redis.call('SET',KEYS[1],'1','NX','EX',ARGV[1]) then return 0 end\nredis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[1]);redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',ARGV[5]);redis.call('ZADD',KEYS[3],ARGV[3],ARGV[4]);redis.call('EXPIRE',KEYS[3],ARGV[1]);return 1",&[self.key(&format!("feedback-once:{slug}:{uid}:{}",crypto::sha(text))),self.key(&format!("feedback:{id}")),self.key("feedback-index")],&[RETENTION.to_string(),row.to_string(),now.to_string(),id.clone(),(now-RETENTION*1000).to_string()]).await?;
        Ok(json!({"added":count(&result)==1,"id":id}))
    }
    pub async fn private_feedback(&self) -> Result<Value, Error> {
        let ids = self
            .0
            .store
            .command(vec![
                "ZREVRANGEBYSCORE".into(),
                self.key("feedback-index"),
                "+inf".into(),
                (chrono::Utc::now().timestamp_millis() - RETENTION * 1000).to_string(),
                "LIMIT".into(),
                "0".into(),
                "200".into(),
            ])
            .await?;
        let rows = self
            .0
            .store
            .pipeline(
                ids.as_array()
                    .ok_or("invalid feedback index")?
                    .iter()
                    .map(|id| vec!["GET".into(), self.key(&format!("feedback:{}", text(id)))])
                    .collect(),
            )
            .await?;
        Ok(Value::Array(
            rows.iter()
                .filter(|v| truthy(v))
                .map(|v| serde_json::from_str(text(v)))
                .collect::<Result<_, _>>()?,
        ))
    }
    pub async fn hide_feedback(&self, id: &str) -> Result<(), Error> {
        if id.len() != 36
            || !id
                .bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c) || c == b'-')
        {
            return Err("invalid feedback".into());
        }
        self.0
            .store
            .pipeline(vec![
                vec!["DEL".into(), self.key(&format!("feedback:{id}"))],
                vec!["ZREM".into(), self.key("feedback-index"), id.into()],
            ])
            .await?;
        Ok(())
    }
    pub async fn apply_synced_metrics(
        &self,
        previous: &Value,
        metrics: &Value,
    ) -> Result<bool, Error> {
        let old = self.raw(text(&previous["slug"])).await?;
        let Some(old) = old.as_str() else {
            return Ok(false);
        };
        let mut current: Value = serde_json::from_str(old)?;
        if !current.is_object() {
            return Err("invalid stored video".into());
        }
        // Compare JSON values, then CAS the original bytes. Equivalent serializers may order keys differently.
        if current != *previous {
            return Ok(false);
        }
        if let Some(fields) = metrics.as_object() {
            for (k, v) in fields {
                current[k] = v.clone();
            }
        }
        let at = model::now();
        let mut row = model::video(&current, false, &at)?;
        row["metric_source"] = json!("oriane");
        row["synced_at"] = json!(at);
        let slug = text(&row["slug"]);
        let result=self.eval("if redis.call('HGET',KEYS[1],ARGV[1])~=ARGV[2] then return 0 end\nredis.call('HSET',KEYS[1],ARGV[1],ARGV[3]);redis.call('LPUSH',KEYS[2],ARGV[3]);redis.call('LTRIM',KEYS[2],0,199);redis.call('EXPIRE',KEYS[2],ARGV[4]);return 1",&[self.key("videos"),self.key(&format!("metrics-history:{slug}"))],&[slug.into(),old.into(),row.to_string(),RETENTION.to_string()]).await?;
        Ok(count(&result) == 1)
    }
    pub async fn latest_votes(&self) -> Result<Value, Error> {
        let rows = self
            .0
            .store
            .command(vec![
                "LRANGE".into(),
                self.key("public-votes"),
                "0".into(),
                "49".into(),
            ])
            .await?;
        Ok(Value::Array(
            rows.as_array()
                .ok_or("invalid vote feed")?
                .iter()
                .filter_map(|v| serde_json::from_str(text(v)).ok())
                .collect(),
        ))
    }
}
