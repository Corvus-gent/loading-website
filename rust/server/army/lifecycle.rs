//! Account lifecycle. Existing aliases, retention and erasure receipts are preserved.
use super::{
    model, security,
    store::{Army, DAY},
};
use crate::Error;
use corvus_core::army::truthy;
use serde_json::{Value, json};

const RESERVE: &str = "local n=redis.call('GET',KEYS[1]);local e=redis.call('GET',KEYS[2]);if (n and n~=ARGV[1]) or (e and e~=ARGV[1]) then return 0 end;redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[2]);return redis.call('INCR',KEYS[3])";
impl Army<'_> {
    pub async fn create(&self, country: &Value, existing: bool) -> Result<Value, Error> {
        // A collision retries without overwriting any existing identity.
        for _ in 0..32 {
            let uid = security::id();
            let code = security::recruit_code();
            let reserved = self
                .run(&[
                    "SET",
                    &self.key(&format!("code:{code}")),
                    &json!(uid).to_string(),
                    "NX",
                    "EX",
                    &(90 * DAY).to_string(),
                ])
                .await?;
            if reserved.is_null() {
                continue;
            }
            return self.persist(&json!({"id":uid,"code":code,"created":self.timestamp()?,"expires":model::iso(self.now()+90*DAY*1000)?,"status":"anonymous","country":country,"existingBrowser":existing,"streak":0,"best":0,"feathers":[],"recruits":0,"missionPoints":0,"weeklyWins":0})).await;
        }
        Err("busy".into())
    }
    pub async fn by_code(&self, code: &str) -> Result<Value, Error> {
        let uid = self.get(&format!("code:{code}")).await?;
        self.user(uid.as_str().unwrap_or("")).await
    }
    pub async fn enroll(&self, uid: &str, input: &Value, enlist: bool) -> Result<Value, Error> {
        let mut input = input.clone();
        if !enlist {
            input
                .as_object_mut()
                .ok_or("fields")?
                .insert("why".into(), json!("account"));
        }
        let mut data = model::application(&input)?;
        self.locked(uid, async {
            let mut user = self.user(uid).await?;
            if user.is_null() {
                return Err(if enlist {
                    "session"
                } else {
                    "already_enlisted"
                }
                .into());
            }
            if enlist {
                if truthy(&user["applied"]) {
                    return Err("already_enlisted".into());
                }
                if truthy(&user["username"]) && user["username"] != data["username"] {
                    return Err("username".into());
                }
                if truthy(&user["email"]) && user["email"] != data["email"] {
                    return Err("email".into());
                }
            } else if truthy(&user["username"])
                || truthy(&user["email"]) && user["email"] != data["email"]
            {
                return Err("already_enlisted".into());
            }
            let name = data["username"].as_str().ok_or("username")?;
            let email = data["email"].as_str().ok_or("email")?;
            let serial = self
                .run(&[
                    "EVAL",
                    RESERVE,
                    "3",
                    &self.key(&format!("name:{name}")),
                    &self.key(&format!(
                        "email:{}",
                        security::digest(&self.state.settings, email)?
                    )),
                    &self.key("serial"),
                    &json!(uid).to_string(),
                    &(7 * DAY).to_string(),
                ])
                .await?
                .as_i64()
                .ok_or("reservation")?;
            if serial == 0 {
                return Err("unavailable_name_or_email".into());
            }
            if !enlist {
                data.as_object_mut().ok_or("fields")?.remove("why");
            }
            user.as_object_mut()
                .ok_or("session")?
                .extend(data.as_object().ok_or("fields")?.clone());
            if !enlist || !truthy(&user["serial"]) {
                user["serial"] = json!(serial);
            }
            let verified = enlist && truthy(&user["verifiedAt"]);
            user["status"] = json!(if verified { "waiting" } else { "unconfirmed" });
            if enlist {
                user["applied"] = json!(self.timestamp()?);
            }
            user["expires"] = json!(model::iso(
                self.now() + if verified { 90 } else { 7 } * DAY * 1000
            )?);
            self.persist(&user).await
        })
        .await
    }
    pub async fn attach_email(&self, uid: &str, email: &str, lang: &str) -> Result<Value, Error> {
        self.locked(uid, async {
            let mut user = self.user(uid).await?;
            if user.is_null() {
                return Err("session".into());
            }
            if truthy(&user["email"]) && user["email"] != email {
                return Err("email".into());
            }
            let claimed = self
                .run(&[
                    "SET",
                    &self.key(&format!(
                        "email:{}",
                        security::digest(&self.state.settings, email)?
                    )),
                    &json!(uid).to_string(),
                    "NX",
                    "EX",
                    &(7 * DAY).to_string(),
                ])
                .await?;
            if claimed.is_null() && self.by_email(email).await?["id"] != uid {
                return Err("email".into());
            }
            user["email"] = json!(email);
            user["lang"] = json!(lang);
            user["status"] = json!("subscriber");
            user["expires"] = json!(model::iso(self.now() + 7 * DAY * 1000)?);
            self.persist(&user).await
        })
        .await
    }
    pub async fn verify(&self, uid: &str) -> Result<Value, Error> {
        self.locked(uid, async {
            let mut user = self.user(uid).await?;
            if !truthy(&user["email"]) {
                return Err("expired".into());
            }
            if !truthy(&user["verifiedAt"]) {
                user["verifiedAt"] = json!(self.timestamp()?);
                let initial = ["anonymous", "unconfirmed", "subscriber"]
                    .contains(&user["status"].as_str().unwrap_or(""));
                if initial {
                    user["status"] = json!(if truthy(&user["applied"]) {
                        "waiting"
                    } else if truthy(&user["username"]) {
                        "member"
                    } else {
                        "subscriber"
                    });
                }
                user["general"] = json!(user["email"] == "gabriel@corvus.gent");
                if initial {
                    user["expires"] = json!(model::iso(
                        self.now() + if truthy(&user["applied"]) { 90 } else { 365 } * DAY * 1000
                    )?);
                }
                self.persist(&user).await?;
            } else if ["member", "approved", "subscriber"]
                .contains(&user["status"].as_str().unwrap_or(""))
            {
                user["expires"] = json!(model::iso(self.now() + 365 * DAY * 1000)?);
                self.persist(&user).await?;
            }
            Ok(user)
        })
        .await
    }
    pub async fn rate(
        &self,
        scope: &str,
        hash: &str,
        max: i64,
        seconds: i64,
    ) -> Result<bool, Error> {
        Ok(self.run(&["EVAL","local n=redis.call('INCR',KEYS[1]);if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n","1",&self.key(&format!("rate:{scope}:{hash}")),&seconds.to_string()]).await?.as_i64().ok_or("rate")? <= max)
    }
    pub async fn feather(&self, uid: &str, spot: &Value) -> Result<Value, Error> {
        if !corvus_core::army::includes("FEATHERS", spot) {
            return Err("feather".into());
        }
        self.locked(uid, async {
            let mut user = self.user(uid).await?;
            if user.is_null() {
                return Err("session".into());
            }
            let feathers = user["feathers"].as_array_mut().ok_or("session")?;
            if !feathers.contains(spot) {
                feathers.push(spot.clone());
                self.persist(&user).await?;
            }
            Ok(user)
        })
        .await
    }
    pub async fn seen(&self, uid: &str, ip: &str) -> Result<(), Error> {
        if !self.user(uid).await?.is_null() {
            self.own(uid, &format!("owner-ip:{uid}:{ip}"), &json!(true), DAY)
                .await?;
        }
        Ok(())
    }
    pub async fn remove(&self, uid: &str) -> Result<bool, Error> {
        self.locked(uid, async {
            let mut user = self.user(uid).await?;
            if user.is_object() {
                user["status"] = json!("deleting");
                self.persist(&user).await?;
            }
            let everyone = self.all().await?;
            let hash = security::digest(&self.state.settings, &format!("recruit:{uid}"))?;
            for parent in everyone.iter().filter(|s| s["id"] != uid) {
                let id = parent["id"].as_str().ok_or("session")?;
                let edge = self
                    .run(&["HGET", &self.key(&format!("children:{id}")), &hash])
                    .await?;
                if edge.is_null() {
                    continue;
                }
                let week = model::week_key(corvus_core::impact::timestamp(&edge).ok_or("time")?)?;
                self.run(&[
                    "EVAL",
                    include_str!("scripts/detach.lua"),
                    "3",
                    &self.key(&format!("children:{id}")),
                    &self.key(&format!("u:{id}")),
                    &self.key(&format!("week:{week}")),
                    &hash,
                    id,
                ])
                .await?;
            }
            for child in everyone.iter().filter(|s| s["parent"] == uid) {
                let id = child["id"].as_str().ok_or("session")?;
                self.locked(id, async {
                    let mut latest = self.user(id).await?;
                    if latest["parent"] == uid {
                        latest.as_object_mut().ok_or("session")?.remove("parent");
                        self.persist(&latest).await?;
                    }
                    Ok(())
                })
                .await?;
            }
            let owned = self
                .run(&["SMEMBERS", &self.key(&format!("owned:{uid}"))])
                .await?;
            let keys = owned
                .as_array()
                .ok_or("owned")?
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>();
            let mail_prefix = self.key("mail:");
            let jobs = keys
                .iter()
                .filter_map(|k| k.strip_prefix(&mail_prefix))
                .collect::<Vec<_>>();
            if !jobs.is_empty() {
                let outbox = self.key("outbox");
                let mut args = vec!["ZREM", &outbox];
                args.extend(jobs);
                self.run(&args).await?;
            }
            if !keys.is_empty() {
                let mut args = vec!["DEL"];
                args.extend(keys);
                self.run(&args).await?;
            }
            self.run(&[
                "DEL",
                &self.key(&format!("u:{uid}")),
                &self.key(&format!("owned:{uid}")),
                &self.key("public"),
                &self.key("legion"),
            ])
            .await?;
            self.run(&["INCR", &self.key("revision")]).await?;
            self.run(&["ZREM", &self.key("users"), uid]).await?;
            self.run(&["ZREM", &self.key("outbox"), uid]).await?;
            let weeks = self.run(&["SMEMBERS", &self.key("weeks")]).await?;
            for week in weeks
                .as_array()
                .ok_or("weeks")?
                .iter()
                .filter_map(Value::as_str)
            {
                self.run(&["ZREM", &self.key(&format!("week:{week}")), uid])
                    .await?;
            }
            Ok(true)
        })
        .await
    }
    pub async fn export_data(&self, uid: &str) -> Result<Value, Error> {
        let mut profile = self.user(uid).await?;
        if profile.is_null() {
            return Err("session".into());
        }
        let owned = self
            .run(&["SMEMBERS", &self.key(&format!("owned:{uid}"))])
            .await?;
        let denied = regex::Regex::new(
            r":(?:token|session|mail|challenge|credited|email|name|code|ref-ip|owner-ip|children|discord):",
        )?;
        let keys = owned
            .as_array()
            .ok_or("owned")?
            .iter()
            .filter_map(Value::as_str)
            .filter(|k| !denied.is_match(k) && *k != self.key(&format!("u:{uid}")))
            .collect::<Vec<_>>();
        let mut records = serde_json::Map::new();
        if !keys.is_empty() {
            let mut args = vec!["MGET"];
            args.extend(keys.iter().copied());
            let values = self.run(&args).await?;
            for (key, raw) in keys.iter().zip(values.as_array().ok_or("records")?) {
                if let Some(raw) = raw.as_str()
                    && let Ok(mut value) = serde_json::from_str::<Value>(raw)
                {
                    if value.is_null() {
                        continue;
                    }
                    if let Some(object) = value.as_object_mut() {
                        for field in ["secret", "delivery", "unsubscribeSecret", "uid"] {
                            object.remove(field);
                        }
                    }
                    records.insert(
                        key.strip_prefix(&self.key(""))
                            .ok_or("owned")?
                            .replace(uid, "me"),
                        value,
                    );
                }
            }
        }
        let object = profile.as_object_mut().ok_or("session")?;
        for field in ["id", "general", "parent", "referral", "creditWeek"] {
            object.remove(field);
        }
        Ok(
            json!({"exported":self.timestamp()?,"profile":profile,"records":records,"note":"credentials and other people’s data are excluded"}),
        )
    }
    pub async fn cleanup(&self) -> Result<usize, Error> {
        let expired = self
            .run(&[
                "ZRANGEBYSCORE",
                &self.key("users"),
                "-inf",
                &self.now().to_string(),
                "LIMIT",
                "0",
                "100",
            ])
            .await?;
        let ids = expired.as_array().ok_or("users")?;
        for uid in ids.iter().filter_map(Value::as_str) {
            self.remove(uid).await?;
        }
        Ok(ids.len())
    }
}
