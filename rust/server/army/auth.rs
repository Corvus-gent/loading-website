//! Single-use email claims and persistent subscription sessions. No provider I/O.
use super::{
    security,
    store::{Army, DAY},
};
use crate::Error;
use axum::http::{HeaderMap, header::SET_COOKIE};
use corvus_core::army::truthy;
use serde_json::{Value, json};
pub struct Auth<'a, 's>(pub &'a Army<'s>);
fn valid_token(token: &str) -> bool {
    token.len() == 48
        && token
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
impl Auth<'_, '_> {
    pub async fn queue(
        &self,
        uid: &str,
        kind: &str,
        data: &Value,
        seconds: i64,
        job_id: Option<&str>,
    ) -> Result<String, Error> {
        let id = job_id.map(str::to_owned).unwrap_or_else(security::id);
        let job = json!({"uid":uid,"kind":kind,"data":data,"created":self.0.timestamp()?,"expires":self.0.now()+seconds*1000});
        if truthy(&self.0.get(&format!("mail:{id}")).await?) {
            return Ok(id);
        }
        self.0
            .own(uid, &format!("mail:{id}"), &job, seconds)
            .await?;
        self.0
            .run(&[
                "ZADD",
                &self.0.key("outbox"),
                &self.0.now().to_string(),
                &id,
            ])
            .await?;
        Ok(id)
    }
    pub async fn issue(&self, uid: &str, purpose: &str) -> Result<Value, Error> {
        if !["claim", "daily", "weekly"].contains(&purpose) {
            return Err("purpose".into());
        }
        let user = self.0.user(uid).await?;
        if !truthy(&user["email"]) {
            return Err("email".into());
        }
        let token = format!("{}{}", security::id(), security::id());
        let hash = security::digest(&self.0.state.settings, &format!("token:{token}"))?;
        self.0
            .own(
                uid,
                &format!("token:{hash}"),
                &json!({"uid":uid,"purpose":purpose}),
                1800,
            )
            .await?;
        let job = self
            .queue(
                uid,
                if purpose == "claim" {
                    "claim"
                } else {
                    "confirm"
                },
                &json!({"secret":security::seal(&self.0.state.settings,&token)?,"purpose":purpose}),
                1800,
                None,
            )
            .await?;
        Ok(json!({"token":token,"job":job}))
    }
    pub async fn consume(&self, token: &str, headers: &mut HeaderMap) -> Result<Value, Error> {
        if !valid_token(token) {
            return Err("expired".into());
        }
        let hash = security::digest(&self.0.state.settings, &format!("token:{token}"))?;
        let raw = self
            .0
            .run(&["GETDEL", &self.0.key(&format!("token:{hash}"))])
            .await?;
        let entry: Value = serde_json::from_str(raw.as_str().ok_or("expired")?)?;
        let uid = entry["uid"].as_str().ok_or("expired")?;
        let user = self.0.user(uid).await?;
        if !truthy(&user["email"]) {
            return Err("expired".into());
        }
        let purpose = entry["purpose"].as_str().ok_or("expired")?;
        if purpose == "claim" {
            Box::pin(self.0.verify(uid)).await?;
        } else {
            let suffix = format!("sub:{uid}:{purpose}");
            let mut sub = self.0.get(&suffix).await?;
            if sub.is_null() {
                return Err("expired".into());
            }
            Box::pin(self.0.verify(uid)).await?;
            sub["confirmed"] = json!(true);
            sub["confirmedAt"] = json!(self.0.timestamp()?);
            self.0.own(uid, &suffix, &sub, 365 * DAY).await?;
        }
        let sid = security::id();
        let hash = security::digest(&self.0.state.settings, &sid)?;
        self.0
            .own(
                uid,
                &format!("session:{hash}"),
                &json!({"uid":uid}),
                7 * DAY,
            )
            .await?;
        headers.append(
            SET_COOKIE,
            security::cookie(
                &self.0.state.settings,
                "army_session",
                &sid,
                7 * DAY,
                "army_session",
            )?,
        );
        headers.append(
            SET_COOKIE,
            security::cookie(&self.0.state.settings, "army_id", uid, 90 * DAY, "army_id")?,
        );
        Ok(json!({"user":self.0.user(uid).await?,"purpose":purpose}))
    }
    pub async fn unsubscribe_token(&self, uid: &str, kind: &str) -> Result<String, Error> {
        let token = format!("{}{}", security::id(), security::id());
        let hash = security::digest(&self.0.state.settings, &token)?;
        self.0
            .own(
                uid,
                &format!("unsubscribe:{hash}"),
                &json!({"uid":uid,"kind":kind}),
                366 * DAY,
            )
            .await?;
        Ok(token)
    }
    pub async fn unsubscribe(&self, token: &str) -> Result<bool, Error> {
        if !valid_token(token) {
            return Ok(true);
        }
        let hash = security::digest(&self.0.state.settings, token)?;
        let entry = self.0.get(&format!("unsubscribe:{hash}")).await?;
        if entry.is_null() {
            return Ok(true);
        }
        let uid = entry["uid"].as_str().ok_or("expired")?;
        let kind = entry["kind"].as_str().ok_or("expired")?;
        self.0
            .run(&[
                "DEL",
                &self.0.key(&format!("sub:{uid}:{kind}")),
                &self.0.key(&format!("unsubscribe:{hash}")),
            ])
            .await?;
        let user = self.0.user(uid).await?;
        if !user.is_null()
            && !truthy(&user["applied"])
            && !truthy(
                &self
                    .0
                    .get(&format!(
                        "sub:{uid}:{}",
                        if kind == "daily" { "weekly" } else { "daily" }
                    ))
                    .await?,
            )
        {
            Box::pin(self.0.remove(uid)).await?;
        }
        Ok(true)
    }
}
