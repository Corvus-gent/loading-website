use crate::config::{ConfigError, Settings, is_loopback};
use redis::aio::ConnectionManager;
use serde_json::Value;
use std::{sync::Arc, time::Duration};
use tokio::sync::OnceCell;
use url::Url;
#[derive(Clone)]
pub struct Store {
    settings: Arc<Settings>,
    http: reqwest::Client,
    tcp: Arc<OnceCell<ConnectionManager>>,
}
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("Storage unavailable")]
    Unavailable,
    #[error("Writes are disabled during migration validation")]
    ReadOnly,
    #[error(transparent)]
    Config(#[from] ConfigError),
}
pub fn read_command(command: &str) -> bool {
    matches!(
        command.to_ascii_uppercase().as_str(),
        "GET"
            | "MGET"
            | "EXISTS"
            | "TTL"
            | "PTTL"
            | "HGET"
            | "HGETALL"
            | "HMGET"
            | "HLEN"
            | "HKEYS"
            | "HVALS"
            | "ZRANGE"
            | "ZREVRANGE"
            | "ZRANGEBYSCORE"
            | "ZREVRANGEBYSCORE"
            | "ZCOUNT"
            | "ZCARD"
            | "ZSCORE"
            | "SMEMBERS"
            | "SISMEMBER"
            | "SCARD"
            | "LRANGE"
            | "LLEN"
            | "PING"
            | "TYPE"
    )
}
impl Store {
    pub fn new(settings: Arc<Settings>, http: reqwest::Client) -> Self {
        Self {
            settings,
            http,
            tcp: Arc::new(OnceCell::new()),
        }
    }
    pub fn connected(&self) -> bool {
        self.settings.get("REDIS_MAINTENANCE") != Some("1")
            && (self.settings.rest().ok().flatten().is_some()
                || self.settings.redis_url().ok().flatten().is_some())
    }
    fn endpoint(&self, raw: &str, rest: bool) -> Result<(), ConfigError> {
        let u = Url::parse(raw).map_err(|_| ConfigError::Insecure)?;
        if rest && u.scheme() == "https"
            || !rest && (u.scheme() == "rediss" || (is_loopback(&u) && u.scheme() == "redis"))
        {
            return Ok(());
        }
        if !rest
            && u.scheme() == "redis"
            && u.host_str() == self.settings.get("REDIS_PLAINTEXT_HOST")
            && let Some(until) = self
                .settings
                .get("REDIS_PLAINTEXT_UNTIL")
                .filter(|d| d.len() == 10)
                .and_then(|d| {
                    chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
                        .ok()
                        .filter(|v| v.to_string() == d)
                })
            && until > chrono::Utc::now().date_naive()
        {
            return Ok(());
        }
        Err(ConfigError::Insecure)
    }
    pub async fn command(&self, args: Vec<String>) -> Result<Value, StoreError> {
        if self.settings.get("REDIS_MAINTENANCE") == Some("1") || args.is_empty() {
            return Err(StoreError::Unavailable);
        }
        if !read_command(&args[0]) && !self.settings.write_enabled() {
            return Err(StoreError::ReadOnly);
        }
        if let Some((url, token)) = self.settings.rest()? {
            self.endpoint(url, true)?;
            let response = self
                .http
                .post(url)
                .bearer_auth(token)
                .json(&args)
                .send()
                .await
                .map_err(|_| StoreError::Unavailable)?;
            if !response.status().is_success() {
                return Err(StoreError::Unavailable);
            }
            let body: Value = response.json().await.map_err(|_| StoreError::Unavailable)?;
            if body.get("error").is_some_and(|v| !v.is_null()) || body.get("result").is_none() {
                return Err(StoreError::Unavailable);
            }
            return Ok(body["result"].clone());
        }
        let url = self.settings.redis_url()?.ok_or(ConfigError::Missing)?;
        self.endpoint(url, false)?;
        let connection = self
            .tcp
            .get_or_try_init(|| async {
                let client = redis::Client::open(url).map_err(|_| StoreError::Unavailable)?;
                client
                    .get_connection_manager_with_config(
                        redis::aio::ConnectionManagerConfig::new()
                            .set_connection_timeout(Duration::from_secs(5))
                            .set_response_timeout(Duration::from_secs(5)),
                    )
                    .await
                    .map_err(|_| StoreError::Unavailable)
            })
            .await?;
        let mut conn = connection.clone();
        let mut cmd = redis::cmd(&args[0]);
        cmd.arg(&args[1..]);
        let value: redis::Value = cmd
            .query_async(&mut conn)
            .await
            .map_err(|_| StoreError::Unavailable)?;
        convert(value)
    }
    pub async fn get(&self, key: &str) -> Result<Value, StoreError> {
        self.command(vec!["GET".into(), key.into()]).await
    }
}
fn convert(v: redis::Value) -> Result<Value, StoreError> {
    Ok(match v {
        redis::Value::Nil => Value::Null,
        redis::Value::Int(v) => v.into(),
        redis::Value::BulkString(v) => String::from_utf8(v)
            .map_err(|_| StoreError::Unavailable)?
            .into(),
        redis::Value::SimpleString(v) => v.into(),
        redis::Value::Okay => "OK".into(),
        redis::Value::Array(v) => {
            Value::Array(v.into_iter().map(convert).collect::<Result<_, _>>()?)
        }
        redis::Value::Map(v) => Value::Array(
            v.into_iter()
                .flat_map(|(a, b)| [a, b])
                .map(convert)
                .collect::<Result<_, _>>()?,
        ),
        _ => return Err(StoreError::Unavailable),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn previews_cannot_write_with_production_credentials() {
        let cfg = Settings::new(
            [
                ("REDIS_URL".into(), "rediss://example.com:6380/1".into()),
                ("CORVUS_RUST_WRITES".into(), "isolated".into()),
            ]
            .into(),
        );
        assert!(!cfg.write_enabled());
        assert!(!read_command("EVAL"));
        assert!(!read_command("SET"));
        assert!(read_command("GET"));
    }
}
