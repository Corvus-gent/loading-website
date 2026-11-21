use super::{
    model, security,
    store::{Army, DAY},
};
use crate::Error;
use corvus_core::{army::truthy, impact};
use serde_json::{Value, json};
pub fn handle_from_code(v: &Value) -> Option<String> {
    let normalized = model::username(v);
    let handle = normalized.strip_prefix("corvus-")?;
    model::valid_username(handle).then(|| handle.to_string())
}
impl Army<'_> {
    pub async fn pidgy_trial(&self, event: &Value) -> Result<Value, Error> {
        let id = if truthy(&event["event_id"]) {
            impact::string(&event["event_id"])
        } else {
            String::new()
        };
        if id.is_empty()
            || id.len() > 80
            || !id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_.:-".contains(&b))
            || event["started_at"].as_f64().is_none_or(|n| {
                !n.is_finite() || (n * 1000. - self.now() as f64).abs() > 30. * DAY as f64 * 1000.
            })
        {
            return Err("payload".into());
        }
        let Some(handle) = handle_from_code(&event["referral_code"]) else {
            return Ok(json!({"counted":false,"reason":"code"}));
        };
        let email = model::email(&event["email"]).map_err(|_| "payload")?;
        let account = self.by_name(&handle).await?;
        if !truthy(&account["verifiedAt"]) || account["status"] == "deleting" {
            return Ok(json!({"counted":false,"reason":"account"}));
        }
        let uid = account["id"].as_str().ok_or("session")?;
        if self.by_email(&email).await?["id"] == uid {
            return Ok(json!({"counted":false,"reason":"self"}));
        }
        Box::pin(self.locked(uid, async {
            let result = self
                .run(&[
                    "EVAL",
                    include_str!("scripts/pidgy.lua"),
                    "7",
                    &self.key(&format!(
                        "pidgy:event:{}",
                        security::digest(&self.state.settings, &format!("pidgy-event:{id}"))?
                    )),
                    &self.key(&format!(
                        "pidgy:email:{}",
                        security::digest(&self.state.settings, &format!("pidgy:{email}"))?
                    )),
                    &self.key(&format!("u:{uid}")),
                    &self.key(&format!("owned:{uid}")),
                    &self.key("revision"),
                    &self.key("public"),
                    &self.key("legion"),
                    uid,
                    &(400 * DAY).to_string(),
                ])
                .await?;
            Ok(if result[0] == 1 {
                json!({"counted":true,"trials":result[1]})
            } else {
                json!({"counted":false,"reason":if result[0]==0{"duplicate"}else{"account"}})
            })
        }))
        .await
    }
}
