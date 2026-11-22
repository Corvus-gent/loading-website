use super::{
    events::{digest, uuid_like},
    model,
    store::{Editor, command, numeric, text},
};
use crate::{Error, compound_v2::model::now};
use corvus_core::army::truthy;
use serde_json::{Value, json};

const ONCE: &str = "if not redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[3],1);return 1";
impl Editor<'_> {
    pub async fn profile(&self, uid: &str, handle: &Value) -> Result<String, Error> {
        let clean = model::clean(handle, 60);
        let rest = clean.strip_prefix('@').unwrap_or(&clean);
        if !clean.is_empty()
            && (rest.is_empty()
                || !rest
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"_.- ".contains(&b)))
        {
            return Err("handle".into());
        }
        self.run(&[
            "SET",
            &self.key(&format!("helper:{uid}")),
            &json!({"handle":clean}).to_string(),
            "EX",
            &model::RETENTION.to_string(),
        ])
        .await?;
        let points = numeric(
            &self
                .run(&["GET", &self.key(&format!("score:{uid}"))])
                .await?,
        );
        if !clean.is_empty() && points != 0. {
            self.run(&["ZADD", &self.key("scores"), &points.to_string(), uid])
                .await?;
        } else {
            self.run(&["ZREM", &self.key("scores"), uid]).await?;
        }
        Ok(clean)
    }
    pub(super) async fn score(&self, uid: &str, points: i64) -> Result<(), Error> {
        if uid.is_empty() || points == 0 {
            return Ok(());
        }
        let k = self.key(&format!("score:{uid}"));
        let value = numeric(&self.run(&["INCRBY", &k, &points.to_string()]).await?);
        self.run(&["EXPIRE", &k, &model::RETENTION.to_string()])
            .await?;
        let person = self.get(&format!("helper:{uid}")).await?;
        if truthy(&person["handle"]) && !truthy(&person["hidden"]) {
            self.batch(vec![
                command(&["ZADD", &self.key("scores"), &value.max(0.).to_string(), uid]),
                command(&["EXPIRE", &self.key("scores"), &model::RETENTION.to_string()]),
            ])
            .await?;
        }
        Ok(())
    }
    async fn once(&self, key: &str, stats: &str, choice: &str, field: &str) -> Result<bool, Error> {
        Ok(numeric(
            &self
                .eval(
                    ONCE,
                    &[self.key(key), self.key(stats)],
                    &[choice.into(), model::RETENTION.to_string(), field.into()],
                )
                .await?,
        ) != 0.)
    }
    pub async fn feedback(&self, uid: &str, v: &str, data: &Value) -> Result<Value, Error> {
        let action = text(&data["action"]);
        let choice = text(&data["choice"]);
        let category = text(&data["category"]);
        let (field, dedupe) = match action {
            "vote" => {
                if !["up", "down"].contains(&choice) {
                    return Err("vote".into());
                }
                (format!("vote:{choice}"), "vote".to_owned())
            }
            "category" => {
                if !model::CATEGORIES.contains(&category) || !["up", "down"].contains(&choice) {
                    return Err("category".into());
                }
                (
                    format!("category:{category}:{choice}"),
                    format!("category:{category}"),
                )
            }
            _ => return Err("action".into()),
        };
        let key = format!("done:{v}:{uid}:{dedupe}");
        let added = self
            .once(&key, &format!("stats:{v}"), choice, &field)
            .await?;
        if added {
            self.score(uid, 1).await?;
            let why = model::clean(&data["why"], 280);
            if !why.is_empty() {
                self.save_text(
                    uid,
                    v,
                    &json!(why),
                    if action == "category" {
                        category
                    } else {
                        "vote"
                    },
                    0,
                )
                .await?;
            }
        }
        let selected = if added {
            json!(choice)
        } else {
            let old = self.run(&["GET", &self.key(&key)]).await?;
            if truthy(&old) { old } else { json!(choice) }
        };
        Ok(json!({"added":added,"choice":selected}))
    }
    pub async fn save_text(
        &self,
        uid: &str,
        v: &str,
        value: &Value,
        category: &str,
        points: i64,
    ) -> Result<Value, Error> {
        let value = model::clean(value, 500);
        if value.encode_utf16().count() < if category == "idea" { 8 } else { 1 } {
            return Err("text".into());
        }
        let k = self.key(&format!(
            "text-once:{v}:{uid}:{}",
            digest(&value.to_lowercase())
        ));
        if !truthy(
            &self
                .run(&["SET", &k, "1", "EX", &model::RETENTION.to_string(), "NX"])
                .await?,
        ) {
            return Ok(json!({"added":false}));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let p = self.get(&format!("helper:{uid}")).await?;
        let mut entry = json!({"id":id,"version":v,"text":value,"category":category,"handle":if truthy(&p["handle"]){text(&p["handle"])}else{"anon"},"uid":uid,"at":now(),"hidden":false});
        let key = self.key(&format!("text:{id}"));
        let list = self.key(&format!("texts:{v}"));
        let retention = model::RETENTION.to_string();
        self.batch(vec![
            command(&["SET", &key, &entry.to_string(), "EX", &retention]),
            command(&["LPUSH", &list, &id]),
            command(&["LTRIM", &list, "0", "499"]),
            command(&["EXPIRE", &list, &retention]),
            command(&["HINCRBY", &self.key(&format!("stats:{v}")), "texts", "1"]),
        ])
        .await?;
        if points != 0
            && truthy(
                &self
                    .run(&[
                        "SET",
                        &self.key(&format!("text-credit:{v}:{uid}")),
                        "1",
                        "EX",
                        &retention,
                        "NX",
                    ])
                    .await?,
            )
        {
            self.score(uid, points).await?;
            entry["points"] = json!(points);
            self.run(&["SET", &key, &entry.to_string(), "KEEPTTL"])
                .await?;
        }
        Ok(json!({"added":true,"id":id}))
    }
    pub async fn reaction(&self, uid: &str, v: &str, kind: &str, t: f64) -> Result<Value, Error> {
        if !model::REACTIONS.contains(&kind) {
            return Err("reaction".into());
        }
        Ok(
            json!({"added":self.once(&format!("reaction-once:{v}:{uid}:{t}:{kind}"),&format!("heat:{v}"),"1",&format!("{t}:{kind}")).await?}),
        )
    }
    pub async fn push_poll(&self, v: &str, data: &Value) -> Result<Value, Error> {
        let mut poll = model::poll(data)?;
        let id = format!("live-{}", uuid::Uuid::new_v4());
        let now = chrono::Utc::now().timestamp_millis();
        poll["id"] = json!(id);
        poll["version"] = json!(v);
        poll["created"] = json!(now);
        poll["expires"] = json!(now + 120000);
        self.run(&[
            "SET",
            &self.key("live-poll"),
            &poll.to_string(),
            "EX",
            "120",
        ])
        .await?;
        let list = self.key(&format!("polls:{v}"));
        let retention = model::RETENTION.to_string();
        self.batch(vec![
            command(&[
                "SET",
                &self.key(&format!("poll:{id}")),
                &poll.to_string(),
                "EX",
                &retention,
            ]),
            command(&["LPUSH", &list, &id]),
            command(&["LTRIM", &list, "0", "99"]),
            command(&["EXPIRE", &list, &retention]),
        ])
        .await?;
        Ok(poll)
    }
    pub async fn answer(
        &self,
        uid: &str,
        v: &str,
        id: &str,
        option: &Value,
    ) -> Result<Value, Error> {
        let record = self.version(v).await?;
        let mut poll = record["cues"]
            .as_array()
            .into_iter()
            .flatten()
            .find(|c| c["id"] == id)
            .cloned()
            .unwrap_or(Value::Null);
        if id.starts_with("live-") {
            poll = self.get(&format!("poll:{id}")).await?;
            if (poll["version"] != v && poll["version"] != "all")
                || numeric(&poll["expires"]) < (chrono::Utc::now().timestamp_millis() as f64)
            {
                return Err("poll expired".into());
            }
        }
        let n = option
            .as_f64()
            .filter(|n| n.fract() == 0. && *n >= 0.)
            .ok_or("poll")?;
        if poll.is_null() || n >= poll["options"].as_array().map(Vec::len).unwrap_or(0) as f64 {
            return Err("poll".into());
        }
        let scope = if poll["version"] == "all" { "all" } else { v };
        Ok(
            json!({"added":self.once(&format!("poll-once:{scope}:{id}:{uid}"),&format!("stats:{v}"),&n.to_string(),&format!("poll:{id}:{n}")).await?}),
        )
    }
    pub async fn predict(&self, uid: &str, data: &Value) -> Result<Value, Error> {
        let win = text(&data["win"]);
        let n = data["final"]
            .as_f64()
            .filter(|n| n.fract() == 0. && *n >= 1. && *n <= 999.)
            .ok_or("prediction")?;
        if !["yes", "no"].contains(&win) {
            return Err("prediction".into());
        }
        let added=self.eval("if not redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2],'NX') then return 0 end;redis.call('HINCRBY',KEYS[2],'win:'..ARGV[3],1);redis.call('HINCRBY',KEYS[2],'final:v'..ARGV[4],1);return 1",&[self.key(&format!("prediction:{uid}")),self.key("prediction")],&[json!({"win":win,"final":n}).to_string(),model::RETENTION.to_string(),win.into(),n.to_string()]).await?;
        Ok(json!({"added":numeric(&added)!=0.}))
    }
    pub async fn watched(&self, uid: &str, v: &str) -> Result<Value, Error> {
        let k = self.key(&format!("watched:{uid}"));
        self.batch(vec![
            command(&["SADD", &k, v]),
            command(&["EXPIRE", &k, &model::RETENTION.to_string()]),
        ])
        .await?;
        Ok(json!({"watched":self.run(&["SMEMBERS",&k]).await?}))
    }
    pub async fn duel(&self, uid: &str, data: &Value) -> Result<Value, Error> {
        let action = text(&data["action"]);
        let winner = self.version(text(&data["winner"])).await?;
        let other = if action == "battle" {
            self.version(text(&data["opponent"])).await?
        } else {
            Value::Null
        };
        if winner.is_null() {
            return Err("version".into());
        }
        if action == "battle"
            && (other.is_null() || numeric(&other["slot"]) == numeric(&winner["slot"]))
        {
            return Err("battle".into());
        }
        let pool = if action == "battle" {
            let mut ids = [text(&winner["id"]), text(&other["id"])];
            ids.sort();
            ids.join("-")
        } else {
            self.summary("").await?["cuts"]
                .as_array()
                .into_iter()
                .flatten()
                .map(|c| c["current"]["id"].as_str().unwrap_or("none"))
                .collect::<Vec<_>>()
                .join("-")
        };
        let key = format!("duel:{action}:{uid}:{pool}");
        let id = text(&winner["id"]);
        let added = self
            .once(&key, "standings", id, &format!("{action}:{id}"))
            .await?;
        if added {
            self.score(uid, 1).await?;
        }
        Ok(
            json!({"added":added,"winner":if added{json!(id)}else{self.run(&["GET",&self.key(&key)]).await?}}),
        )
    }
    pub async fn transition(&self, uid: &str, v: &Value, data: &Value) -> Result<Value, Error> {
        let item = v["transitions"]
            .as_array()
            .into_iter()
            .flatten()
            .find(|t| t["id"] == data["transition"])
            .ok_or("transition")?;
        let id = text(&item["id"]);
        let version = text(&v["id"]);
        match text(&data["action"]) {
            "transition" => {
                let choice = text(&data["choice"]);
                if !["up", "down"].contains(&choice) {
                    return Err("vote".into());
                }
                let k = format!("transition-once:{version}:{uid}:{id}");
                let added = self
                    .once(
                        &k,
                        &format!("stats:{version}"),
                        choice,
                        &format!("transition:{id}:{choice}"),
                    )
                    .await?;
                if added {
                    self.score(uid, 1).await?;
                }
                Ok(
                    json!({"added":added,"choice":if added{json!(choice)}else{self.run(&["GET",&self.key(&k)]).await?}}),
                )
            }
            "transition_tag" => {
                let tag = text(&data["tag"]);
                if !model::TRANSITION_TAGS.contains(&tag) {
                    return Err("tag".into());
                }
                Ok(
                    json!({"added":self.once(&format!("transition-tag:{version}:{uid}:{id}:{tag}"),&format!("stats:{version}"),"1",&format!("transition:{id}:tag:{tag}")).await?}),
                )
            }
            _ => {
                if model::clean(&data["text"], 280).encode_utf16().count() < 8 {
                    return Err("text".into());
                }
                self.save_text(uid, version, &data["text"], &format!("transition:{id}"), 3)
                    .await
            }
        }
    }
    pub async fn quick_note(&self, uid: &str, v: &str, data: &Value) -> Result<Value, Error> {
        let chip = if truthy(&data["chip"]) {
            text(&data["chip"])
        } else {
            "note"
        };
        let value = model::clean(&data["text"], 500);
        if !model::QUICK_CHIPS.contains(&chip) {
            return Err("chip".into());
        }
        if chip == "note" && value.encode_utf16().count() < 3 {
            return Err("text".into());
        }
        let id = uuid::Uuid::new_v4().to_string();
        let entry = json!({"id":id,"version":v,"chip":chip,"category":format!("quick:{chip}"),"text":value,"uid":uid,"points":1,"at":now(),"hidden":false});
        let once = if chip == "note" {
            digest(&value.to_lowercase())
        } else {
            chip.into()
        };
        let script = "local old=redis.call('GET',KEYS[1]);if old then return old end;redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[3]);redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]);for i=3,4 do redis.call('LPUSH',KEYS[i],ARGV[1]);redis.call('LTRIM',KEYS[i],0,499);redis.call('EXPIRE',KEYS[i],ARGV[3]) end;redis.call('HINCRBY',KEYS[5],ARGV[4],1);return ARGV[1]";
        let saved = self
            .eval(
                script,
                &[
                    self.key(&format!("quick-once:{v}:{uid}:{once}")),
                    self.key(&format!("text:{id}")),
                    self.key("feedback"),
                    self.key(&format!("texts:{v}")),
                    self.key(&format!("stats:{v}")),
                ],
                &[
                    id.clone(),
                    entry.to_string(),
                    model::RETENTION.to_string(),
                    format!("quick:{chip}"),
                ],
            )
            .await?;
        let added = saved == id;
        if added {
            self.score(uid, 1).await?;
        }
        Ok(json!({"added":added,"id":saved}))
    }
    pub async fn note_text(
        &self,
        uid: &str,
        v: &str,
        id: &str,
        value: &Value,
    ) -> Result<Value, Error> {
        let value = model::clean(value, 500);
        if !uuid_like(&json!(id)) || value.encode_utf16().count() < 3 {
            return Err("text".into());
        }
        let key = self.key(&format!("text:{id}"));
        let added=self.eval("local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local n=cjson.decode(raw);if n.uid~=ARGV[1] or n.version~=ARGV[2] or n.hidden or not n.chip then return 0 end;n.text=ARGV[3];redis.call('SET',KEYS[1],cjson.encode(n),'KEEPTTL');return 1",std::slice::from_ref(&key),&[uid.into(),v.into(),value]).await?;
        if numeric(&added) == 0. {
            return Err("text".into());
        }
        if truthy(
            &self
                .run(&[
                    "SET",
                    &self.key(&format!("text-credit:{v}:{uid}")),
                    "1",
                    "EX",
                    &model::RETENTION.to_string(),
                    "NX",
                ])
                .await?,
        ) {
            let credited=self.eval("local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local n=cjson.decode(raw);if n.hidden then return 0 end;n.points=(n.points or 0)+3;redis.call('SET',KEYS[1],cjson.encode(n),'KEEPTTL');return 1",&[key],&[]).await?;
            if numeric(&credited) != 0. {
                self.score(uid, 3).await?;
            }
        }
        Ok(json!({"added":true,"id":id}))
    }
    pub async fn feedback_feed(&self, limit: usize) -> Result<Vec<Value>, Error> {
        let mut rows = Vec::new();
        for offset in (0..500).step_by(20) {
            if rows.len() >= limit {
                break;
            }
            let ids = self
                .run(&[
                    "LRANGE",
                    &self.key("feedback"),
                    &offset.to_string(),
                    &(offset + 19).to_string(),
                ])
                .await?;
            let ids = ids.as_array().ok_or("feedback")?;
            if ids.is_empty() {
                break;
            }
            let keys = ids
                .iter()
                .map(|id| self.key(&format!("text:{}", text(id))))
                .collect::<Vec<_>>();
            rows.extend(
                self.mget(&keys)
                    .await?
                    .into_iter()
                    .filter(|n| truthy(n) && !truthy(&n["hidden"]))
                    .take(limit - rows.len()),
            );
            if ids.len() < 20 {
                break;
            }
        }
        let people = self
            .mget(
                &rows
                    .iter()
                    .map(|n| self.key(&format!("helper:{}", text(&n["uid"]))))
                    .collect::<Vec<_>>(),
            )
            .await?;
        Ok(rows.into_iter().zip(people).map(|(n,p)|json!({"id":n["id"],"version":n["version"],"chip":n["chip"],"text":n["text"],"at":n["at"],"handle":if truthy(&p["hidden"])||!truthy(&p["handle"]){"anonymous soldier"}else{text(&p["handle"])}})).collect())
    }
}
