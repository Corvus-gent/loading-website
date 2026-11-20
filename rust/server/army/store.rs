use super::security;
use crate::{AppState, Error, compound::store::command};
use axum::http::HeaderMap;
use serde_json::{Value, json};
pub const DAY: i64 = 86400;
pub struct Army<'a> {
    pub state: &'a AppState,
    prefix: String,
    clock: Option<i64>,
}
impl<'a> Army<'a> {
    pub fn new(state: &'a AppState) -> Result<Self, Error> {
        Ok(Self {
            state,
            prefix: security::namespace(&state.settings)?,
            clock: None,
        })
    }
    /// A deterministic clock for isolated compatibility contracts, never read from env.
    pub fn with_now(state: &'a AppState, now: i64) -> Result<Self, Error> {
        let mut store = Self::new(state)?;
        store.clock = Some(now);
        Ok(store)
    }
    pub fn now(&self) -> i64 {
        self.clock
            .unwrap_or_else(|| chrono::Utc::now().timestamp_millis())
    }
    pub fn timestamp(&self) -> Result<String, Error> {
        super::model::iso(self.now())
    }
    pub fn remaining(&self, user: &Value) -> Result<i64, Error> {
        let until = corvus_core::impact::timestamp(&user["expires"]).ok_or("expiry")?;
        Ok(((until - self.now()) as f64 / 1000.).ceil().max(1.) as i64)
    }
    pub async fn run(&self, args: &[&str]) -> Result<Value, Error> {
        Ok(self.state.store.command(command(args)).await?)
    }
    pub async fn locked<T, F>(&self, uid: &str, operation: F) -> Result<T, Error>
    where
        F: std::future::Future<Output = Result<T, Error>>,
    {
        self.locked_for(uid, 15, operation).await
    }
    pub async fn locked_for<T, F>(&self, uid: &str, seconds: i64, operation: F) -> Result<T, Error>
    where
        F: std::future::Future<Output = Result<T, Error>>,
    {
        let token = self.acquire(uid, seconds).await?;
        let result = operation.await;
        let released = self.release(uid, &token).await;
        match result {
            Err(e) => Err(e),
            Ok(value) => {
                released?;
                Ok(value)
            }
        }
    }
    pub async fn invalidate(&self) -> Result<(), Error> {
        self.run(&["INCR", &self.key("revision")]).await?;
        self.run(&["DEL", &self.key("public"), &self.key("legion")])
            .await?;
        Ok(())
    }
    pub fn key(&self, suffix: &str) -> String {
        format!("{}{suffix}", self.prefix)
    }
    pub async fn get(&self, suffix: &str) -> Result<Value, Error> {
        let raw = self.state.store.get(&self.key(suffix)).await?;
        Ok(match raw.as_str() {
            Some(s) => serde_json::from_str(s)?,
            None => Value::Null,
        })
    }
    pub async fn user(&self, uid: &str) -> Result<Value, Error> {
        if !security::valid_id(uid) {
            return Ok(Value::Null);
        }
        let mut user = self.get(&format!("u:{uid}")).await?;
        if user.is_object() && !user["feathers"].is_array() {
            user["feathers"] = json!([]);
        }
        Ok(user)
    }
    pub fn ttl(user: &Value) -> Result<i64, Error> {
        let until = corvus_core::impact::timestamp(&user["expires"]).ok_or("expiry")?;
        Ok(
            ((until - chrono::Utc::now().timestamp_millis()) as f64 / 1000.)
                .ceil()
                .max(1.) as i64,
        )
    }
    pub async fn by_email(&self, email: &str) -> Result<Value, Error> {
        let uid = self
            .get(&format!(
                "email:{}",
                security::digest(&self.state.settings, email)?
            ))
            .await?;
        self.user(uid.as_str().unwrap_or("")).await
    }
    pub async fn by_name(&self, name: &str) -> Result<Value, Error> {
        let uid = self.get(&format!("name:{name}")).await?;
        self.user(uid.as_str().unwrap_or("")).await
    }
    pub async fn session(&self, h: &HeaderMap) -> Result<Value, Error> {
        let Some(sid) =
            security::read_cookie(&self.state.settings, h, "army_session", "army_session")?
                .filter(|s| security::valid_id(s))
        else {
            return Ok(Value::Null);
        };
        let record = self
            .get(&format!(
                "session:{}",
                security::digest(&self.state.settings, &sid)?
            ))
            .await?;
        self.user(record["uid"].as_str().unwrap_or("")).await
    }
    pub async fn own(
        &self,
        uid: &str,
        suffix: &str,
        value: &Value,
        seconds: i64,
    ) -> Result<Value, Error> {
        let owner = self.user(uid).await?;
        if owner.is_null() || owner["status"] == "deleting" {
            return Err("session".into());
        }
        let seconds = seconds.min(self.remaining(&owner)?);
        let result = self
            .state
            .store
            .command(command(&[
                "EVAL",
                OWN,
                "3",
                &self.key(suffix),
                &self.key(&format!("owned:{uid}")),
                &self.key(&format!("u:{uid}")),
                &value.to_string(),
                &seconds.to_string(),
                &seconds.max(367 * DAY).to_string(),
            ]))
            .await?;
        if result.as_i64() != Some(1) {
            return Err("session".into());
        }
        Ok(value.clone())
    }
    pub async fn persist(&self, user: &Value) -> Result<Value, Error> {
        let uid = user["id"]
            .as_str()
            .filter(|s| security::valid_id(s))
            .ok_or("session")?;
        let seconds = self.remaining(user)?;
        let mut fields = vec![
            (format!("u:{uid}"), user.clone()),
            (
                format!("code:{}", user["code"].as_str().unwrap_or("")),
                json!(uid),
            ),
        ];
        if let Some(name) = user["username"].as_str().filter(|s| !s.is_empty()) {
            fields.push((format!("name:{name}"), json!(uid)));
        }
        if let Some(email) = user["email"].as_str().filter(|s| !s.is_empty()) {
            fields.push((
                format!("email:{}", security::digest(&self.state.settings, email)?),
                json!(uid),
            ));
        }
        let mut args = command(&[
            "EVAL",
            PERSIST,
            "2",
            &self.key(&format!("owned:{uid}")),
            &self.key("users"),
        ]);
        for (k, v) in fields {
            args.push(self.key(&k));
            args.push(v.to_string());
        }
        args.extend([
            seconds.to_string(),
            (367 * DAY).to_string(),
            corvus_core::impact::timestamp(&user["expires"])
                .ok_or("expiry")?
                .to_string(),
            uid.into(),
        ]);
        self.state.store.command(args).await?;
        self.state
            .store
            .command(command(&["INCR", &self.key("revision")]))
            .await?;
        self.state
            .store
            .command(command(&["DEL", &self.key("public"), &self.key("legion")]))
            .await?;
        Ok(user.clone())
    }
    pub async fn all(&self) -> Result<Vec<Value>, Error> {
        let mut out = vec![];
        let now = self.now().to_string();
        let mut offset = 0;
        loop {
            let ids = self
                .state
                .store
                .command(command(&[
                    "ZRANGEBYSCORE",
                    &self.key("users"),
                    &now,
                    "+inf",
                    "LIMIT",
                    &offset.to_string(),
                    "500",
                ]))
                .await?;
            let ids = ids.as_array().ok_or("user index")?;
            if ids.is_empty() {
                break;
            }
            let mut args = vec!["MGET".into()];
            args.extend(
                ids.iter()
                    .filter_map(|id| id.as_str())
                    .map(|uid| self.key(&format!("u:{uid}"))),
            );
            let values = self.state.store.command(args).await?;
            if let Some(values) = values.as_array() {
                for raw in values {
                    if let Some(raw) = raw.as_str() {
                        let mut user: Value = serde_json::from_str(raw)?;
                        if user.is_object() && !user["feathers"].is_array() {
                            user["feathers"] = json!([]);
                        }
                        out.push(user);
                    }
                }
            }
            if ids.len() < 500 {
                break;
            }
            offset += 500;
        }
        Ok(out)
    }
    pub async fn acquire(&self, uid: &str, seconds: i64) -> Result<String, Error> {
        let owner = security::id();
        let result = self
            .state
            .store
            .command(command(&[
                "SET",
                &self.key(&format!("lock:{uid}")),
                &owner,
                "NX",
                "EX",
                &seconds.to_string(),
            ]))
            .await?;
        if result.is_null() {
            return Err("busy".into());
        }
        Ok(owner)
    }
    pub async fn release(&self, uid: &str, owner: &str) -> Result<(), Error> {
        self.state.store.command(command(&["EVAL","if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0","1",&self.key(&format!("lock:{uid}")),owner])).await?;
        Ok(())
    }
}
const OWN: &str = "local owner=redis.call('GET',KEYS[3]);if not owner or cjson.decode(owner).status=='deleting' then return 0 end;for _,k in ipairs(redis.call('SRANDMEMBER',KEYS[2],8)) do if redis.call('EXISTS',k)==0 then redis.call('SREM',KEYS[2],k) end end;redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);redis.call('SADD',KEYS[2],KEYS[1]);redis.call('EXPIRE',KEYS[2],ARGV[3]);return 1";
const PERSIST: &str = "for i=1,#ARGV-4,2 do redis.call('SET',ARGV[i],ARGV[i+1],'EX',ARGV[#ARGV-3]);redis.call('SADD',KEYS[1],ARGV[i]) end\nredis.call('EXPIRE',KEYS[1],ARGV[#ARGV-2]);redis.call('ZADD',KEYS[2],ARGV[#ARGV-1],ARGV[#ARGV]);return 1";
