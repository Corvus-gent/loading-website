use super::{mail, security, store::Legion};
use crate::{
    AppState, Error, army::model::email, compound::store::command, compound_v2::model::now, crypto,
};
use serde_json::{Value, json};
pub struct Newsletter<'a>(pub &'a AppState);
pub struct Confirmation {
    pub body: Value,
    pub subscriber: String,
}
impl Newsletter<'_> {
    fn key(&self, s: &str) -> String {
        security::key(&self.0.settings, s)
    }
    pub async fn subscribe(&self, value: &Value, origin: &str) -> Result<Value, Error> {
        let email = email(value)?;
        let hash = crypto::sha(&email);
        let legion = Legion(self.0);
        let existing = legion.get(&format!("subscriber:{hash}")).await?;
        let cooldown = self.key(&format!("subscribe-cooldown:{hash}"));
        if self
            .0
            .store
            .command(command(&["SET", &cooldown, "1", "NX", "EX", "3600"]))
            .await?
            .is_null()
        {
            return Ok(
                json!({"ok":true,"message":"Check your inbox. If needed, the crow sent a confirmation."}),
            );
        }
        let raw = security::token();
        let unsubscribe = security::token();
        let token_hash = crypto::sha(&raw);
        let (subject, text, id, message) = if existing["status"] == "confirmed" {
            self.0
                .store
                .command(command(&[
                    "SET",
                    &self.key(&format!("restore:{token_hash}")),
                    &hash,
                    "EX",
                    "1800",
                ]))
                .await?;
            (
                "Your Corvus email layer",
                format!(
                    "Open this one-time link to unlock the email layer on this browser. It expires in 30 minutes.\n\n{origin}/letters/confirm/?token={raw}"
                ),
                format!("restore-{token_hash}"),
                "Check your inbox. If needed, the crow sent a confirmation.",
            )
        } else {
            let row = json!({"email":email,"status":"pending","created_at":existing["created_at"].as_str().filter(|s|!s.is_empty()).map(str::to_owned).unwrap_or_else(now),"confirmation":token_hash,"unsubscribe":crypto::sha(&unsubscribe)});
            // All confirmation aliases and their subscriber enter Redis together.
            self.0.store.command(command(&["EVAL","redis.call('SET',KEYS[1],ARGV[1],'EX',172800);redis.call('SET',KEYS[2],ARGV[2],'EX',172800);redis.call('SET',KEYS[3],ARGV[2],'EX',31622400);redis.call('ZADD',KEYS[4],ARGV[3],ARGV[2]);return 1","4",&self.key(&format!("subscriber:{hash}")),&self.key(&format!("confirm:{token_hash}")),&self.key(&format!("unsubscribe:{}",crypto::sha(&unsubscribe))),&self.key("subscribers"),&row.to_string(),&hash,&chrono::Utc::now().timestamp_millis().to_string()])).await?;
            (
                "one small signal from the crow",
                format!(
                    "You asked for occasional Corvus transmissions. Confirm here:\n\n{origin}/letters/confirm/?token={raw}\n\nNo confirmation, no transmissions. This link expires in 48 hours.\n\nChanged your mind? {origin}/letters/unsubscribe/?token={unsubscribe}\n\nCorvus · gabriel@corvus.gent"
                ),
                format!("confirm-{token_hash}"),
                "Check your inbox. Confirm once to hear from the crow.",
            )
        };
        if !mail::send(self.0, &email, subject, &text, &id).await? {
            self.0.store.command(command(&["DEL", &cooldown])).await?;
            return Err("mail".into());
        }
        Ok(json!({"ok":true,"message":message}))
    }
    pub async fn confirm(&self, raw: &str) -> Result<Confirmation, Error> {
        if !security::valid_token(&json!(raw)) {
            return Err("expired".into());
        }
        let hash = crypto::sha(raw);
        let restored = self
            .0
            .store
            .command(command(&["GETDEL", &self.key(&format!("restore:{hash}"))]))
            .await?;
        if let Some(s) = restored.as_str()
            && Legion(self.0).get(&format!("subscriber:{s}")).await?["status"] == "confirmed"
        {
            return Ok(Confirmation {
                body: json!({"ok":true,"message":"Your email layer is open on this browser."}),
                subscriber: s.into(),
            });
        }
        let result = self
            .0
            .store
            .command(command(&[
                "EVAL",
                CONFIRM,
                "1",
                &self.key(&format!("confirm:{hash}")),
                &self.key("subscriber:"),
                &hash,
                &now(),
            ]))
            .await?;
        let subscriber = result.as_str().filter(|s| !s.is_empty()).ok_or("expired")?;
        Ok(Confirmation {
            body: json!({"ok":true,"message":"Confirmed. The crow will write when there is something worth saying."}),
            subscriber: subscriber.into(),
        })
    }
    pub async fn unsubscribe(&self, raw: &str) -> Result<Value, Error> {
        if !security::valid_token(&json!(raw)) {
            return Ok(json!({"ok":true}));
        }
        let token_key = self.key(&format!("unsubscribe:{}", crypto::sha(raw)));
        let hash = self.0.store.get(&token_key).await?;
        if let Some(hash) = hash.as_str() {
            self.0.store.command(command(&["EVAL","redis.call('DEL',KEYS[1],KEYS[2],KEYS[3]);redis.call('ZREM',KEYS[4],ARGV[1]);return 1","4",&self.key(&format!("subscriber:{hash}")),&token_key,&self.key(&format!("subscribe-cooldown:{hash}")),&self.key("subscribers"),hash])).await?;
        }
        Ok(json!({"ok":true,"message":"Unsubscribed. The crow is quiet."}))
    }
    pub async fn subscribers(&self) -> Result<Value, Error> {
        let ids = self
            .0
            .store
            .command(command(&[
                "ZREVRANGE",
                &self.key("subscribers"),
                "0",
                "9999",
            ]))
            .await?;
        let commands = ids
            .as_array()
            .ok_or("subscriber index")?
            .iter()
            .filter_map(Value::as_str)
            .map(|s| command(&["GET", &self.key(&format!("subscriber:{s}"))]))
            .collect();
        let mut rows = vec![];
        for raw in self.0.store.pipeline(commands).await? {
            if let Some(s) = raw.as_str() {
                let row: Value = serde_json::from_str(s)?;
                let mut public = serde_json::Map::new();
                for field in ["email", "status", "created_at", "confirmed_at"] {
                    if let Some(v) = row.get(field) {
                        public.insert(field.into(), v.clone());
                    }
                }
                rows.push(Value::Object(public));
            }
        }
        Ok(json!(rows))
    }
}
const CONFIRM: &str = "local h=redis.call('GET',KEYS[1]);if not h then return 0 end;local k=ARGV[1]..h;local s=redis.call('GET',k);if not s then return 0 end;local r=cjson.decode(s);if r.confirmation~=ARGV[2] then return 0 end;r.status='confirmed';r.confirmed_at=ARGV[3];r.confirmation=nil;redis.call('SET',k,cjson.encode(r),'EX',31536000);redis.call('DEL',KEYS[1]);return h";
