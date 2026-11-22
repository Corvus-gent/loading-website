//! Credit is earned once, atomically, using the existing Redis receipts.
use super::{
    model, security,
    store::{Army, DAY},
};
use crate::Error;
use corvus_core::army::truthy;
use serde_json::{Value, json};
impl Army<'_> {
    pub async fn remember_referral(&self, uid: &str, code: &str, ip: &str) -> Result<bool, Error> {
        let user = self.user(uid).await?;
        let parent = self.by_code(code).await?;
        if user.is_null()
            || parent.is_null()
            || user["status"] == "deleting"
            || parent["status"] == "deleting"
            || user["id"] == parent["id"]
            || [
                "existingBrowser",
                "parent",
                "referral",
                "qualifiedAt",
                "email",
            ]
            .iter()
            .any(|k| truthy(&user[k]))
        {
            return Ok(false);
        }
        Box::pin(self.locked(uid, async {
            let mut latest = self.user(uid).await?;
            if latest.is_null() || truthy(&latest["referral"]) || truthy(&latest["parent"]) {
                return Ok(false);
            }
            latest["referral"] = json!({"code":code,"until":self.now()+30*DAY*1000});
            self.own(
                uid,
                &format!("ref-ip:{uid}"),
                &json!({"hash":ip,"day":model::day_key(self.now())?}),
                DAY,
            )
            .await?;
            self.persist(&latest).await?;
            Ok(true)
        }))
        .await
    }
    pub async fn qualify(&self, uid: &str, ip: &str) -> Result<bool, Error> {
        let user = self.user(uid).await?;
        if user.is_null()
            || truthy(&user["parent"])
            || truthy(&user["existingBrowser"])
            || !truthy(&user["referral"])
            || user["referral"]["until"]
                .as_i64()
                .is_some_and(|n| n < self.now())
        {
            return Ok(false);
        }
        let code = user["referral"]["code"].as_str().unwrap_or("");
        let parent = self.by_code(code).await?;
        let pid = parent["id"].as_str().unwrap_or("");
        if parent.is_null()
            || parent["status"] == "deleting"
            || user["status"] == "deleting"
            || pid == uid
            || truthy(&self.get(&format!("owner-ip:{pid}:{ip}")).await?)
        {
            return Ok(false);
        }
        let hash = security::digest(&self.state.settings, &format!("recruit:{uid}"))?;
        let day = model::day_key(self.now())?;
        let week = model::week_key(self.now())?;
        let result = self
            .run(&[
                "EVAL",
                include_str!("scripts/qualify.lua"),
                "9",
                &self.key(&format!("u:{uid}")),
                &self.key(&format!("u:{pid}")),
                &self.key(&format!("children:{pid}")),
                &self.key(&format!("ref-day:{code}:{day}")),
                &self.key(&format!("ref-ip-day:{day}:{ip}")),
                &self.key(&format!("credited:{hash}")),
                &self.key(&format!("owned:{uid}")),
                &self.key(&format!("week:{week}")),
                &self.key(&format!("owned:{pid}")),
                &self.timestamp()?,
                &hash,
                pid,
                &week,
                uid,
                &(367 * DAY).to_string(),
            ])
            .await?
            .as_i64()
            .ok_or("credit")?;
        if result != 0 {
            self.run(&["SADD", &self.key("weeks"), &week]).await?;
            self.run(&["EXPIRE", &self.key("weeks"), &(120 * DAY).to_string()])
                .await?;
            self.invalidate().await?;
        }
        Ok(result == 1)
    }
    pub async fn complete(&self, uid: &str, body: &Value, ip: &str) -> Result<Value, Error> {
        let day = body["day"].as_str().unwrap_or("");
        let kind = body["type"].as_str().unwrap_or("");
        let mission = model::daily_mission(day, kind)?;
        let reward = model::mission_reward(&mission, self.now())?;
        if reward == 0 {
            return Ok(Value::Null);
        }
        let result = Box::pin(self.locked(uid, async {
            let mut user = self.user(uid).await?;
            if user.is_null() {
                return Ok(Value::Null);
            }
            let receipt = format!("mission:{uid}:{}", mission["id"].as_str().ok_or("mission")?);
            if truthy(&self.get(&receipt).await?) {
                return Ok(user);
            }
            let streak = if truthy(&body["solved"]) {
                body["streak"].as_i64().unwrap_or(0).clamp(0, 3660)
            } else {
                0
            };
            user["streak"] = json!(streak);
            user["best"] = json!(user["best"].as_i64().unwrap_or(0).max(streak));
            user["missionPoints"] = json!(user["missionPoints"].as_i64().unwrap_or(0) + reward);
            self.own(
                uid,
                &receipt,
                &json!({"day":day,"type":kind,"reward":reward}),
                2 * DAY,
            )
            .await?;
            self.persist(&user).await
        }))
        .await?;
        if !result.is_null() {
            self.qualify(uid, ip).await?;
        }
        self.user(uid).await
    }
    pub async fn approve_help(&self, uid: &str, body: &Value) -> Result<Value, Error> {
        let kind = body["kind"].as_str().unwrap_or("");
        let reference = corvus_core::impact::trimmed(body["reference"].as_str().ok_or("fields")?);
        if !["help", "intro"].contains(&kind)
            || !(8..=180).contains(&reference.encode_utf16().count())
            || reference.chars().any(|c| c <= '\u{1f}')
        {
            return Err("fields".into());
        }
        let user = self.user(uid).await?;
        if !truthy(&user["verifiedAt"]) || user["status"] == "deleting" {
            return Err("unverified".into());
        }
        let hash = security::digest(
            &self.state.settings,
            &format!("help:{}", reference.to_lowercase()),
        )?;
        let seconds = self.remaining(&user)?;
        Box::pin(self.locked(uid, async {
            let result = self
                .run(&[
                    "EVAL",
                    include_str!("scripts/help.lua"),
                    "7",
                    &self.key(&format!("u:{uid}")),
                    &self.key(&format!("help-credit:{uid}:{hash}")),
                    &self.key(&format!("help-report:{uid}:{hash}")),
                    &self.key(&format!("owned:{uid}")),
                    &self.key("revision"),
                    &self.key("public"),
                    &self.key("legion"),
                    &seconds.to_string(),
                    &json!({"kind":kind,"reference":reference,"approvedAt":self.timestamp()?})
                        .to_string(),
                    &seconds.min(90 * DAY).to_string(),
                    &(367 * DAY).to_string(),
                ])
                .await?
                .as_i64()
                .ok_or("credit")?;
            if result < 0 {
                return Err("unverified".into());
            }
            Ok(json!({"credited":result==1}))
        }))
        .await
    }
}
