use std::collections::BTreeMap;
use url::Url;

#[derive(Clone)]
pub struct Settings {
    values: BTreeMap<String, String>,
}
// No Debug implementation: values contain deployment secrets.
impl Settings {
    pub fn from_env() -> Self {
        Self::new(std::env::vars().collect())
    }
    pub fn new(values: BTreeMap<String, String>) -> Self {
        Self { values }
    }
    pub fn get(&self, name: &str) -> Option<&str> {
        self.values
            .get(name)
            .map(String::as_str)
            .filter(|s| !s.is_empty())
    }
    pub fn production(&self) -> bool {
        self.get("VERCEL_ENV") == Some("production")
    }
    pub fn module_enabled(&self, module: &str) -> bool {
        self.get("CORVUS_RUST_MODULES")
            .unwrap_or("")
            .split(',')
            .any(|s| s.trim() == module)
    }
    pub fn suffix(
        &self,
        suffix: &str,
        exclude_read_only: bool,
    ) -> Result<Option<&str>, ConfigError> {
        let mut found = self
            .values
            .iter()
            .filter(|(k, v)| {
                k.ends_with(suffix)
                    && !v.is_empty()
                    && !(exclude_read_only && k.contains("READ_ONLY"))
            })
            .map(|(_, v)| v.as_str());
        let first = found.next();
        if found.any(|v| Some(v) != first) {
            return Err(ConfigError::Ambiguous);
        }
        Ok(first)
    }
    pub fn redis_url(&self) -> Result<Option<&str>, ConfigError> {
        if let Some(value) = self.get("REDIS_URL") {
            return Ok(Some(value));
        }
        if let Some(value) = self.suffix("_REDIS_URL", true)? {
            return Ok(Some(value));
        }
        self.suffix("KV_URL", true)
    }
    pub fn rest(&self) -> Result<Option<(&str, &str)>, ConfigError> {
        if self.get("REDIS_URL").is_some() {
            return Ok(None);
        }
        let url = self
            .suffix("_REST_API_URL", true)?
            .or(self.suffix("_REDIS_REST_URL", true)?);
        let token = self
            .suffix("_REST_API_TOKEN", true)?
            .or(self.suffix("_REDIS_REST_TOKEN", true)?);
        Ok(url.zip(token))
    }
    pub fn write_enabled(&self) -> bool {
        match self.get("CORVUS_RUST_WRITES") {
            Some("production") => self.production(),
            Some("isolated") => {
                !self.production()
                    && self.rest().ok().flatten().is_none()
                    && self
                        .redis_url()
                        .ok()
                        .flatten()
                        .and_then(|u| Url::parse(u).ok())
                        .is_some_and(|u| {
                            is_loopback(&u)
                                && u.path()
                                    .strip_prefix('/')
                                    .and_then(|p| p.parse::<u8>().ok())
                                    .is_some_and(|db| db > 0)
                        })
            }
            _ => false,
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn explicit_target_wins_over_old_marketplace_values() {
        let s = Settings::new(
            [
                ("REDIS_URL".into(), "redis://127.0.0.1:1/1".into()),
                ("A_REDIS_URL".into(), "rediss://old-a.example/1".into()),
                ("B_REDIS_URL".into(), "rediss://old-b.example/1".into()),
            ]
            .into(),
        );
        assert_eq!(s.redis_url().ok().flatten(), Some("redis://127.0.0.1:1/1"));
        assert_eq!(s.rest().ok().flatten(), None);
    }
    #[test]
    fn isolated_mode_never_uses_the_default_database() {
        for path in ["", "/", "/0", "/00", "/hello"] {
            let s = Settings::new(
                [
                    ("REDIS_URL".into(), format!("redis://127.0.0.1:16380{path}")),
                    ("CORVUS_RUST_WRITES".into(), "isolated".into()),
                ]
                .into(),
            );
            assert!(!s.write_enabled());
        }
    }
}
pub fn is_loopback(url: &Url) -> bool {
    matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))
}
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing required server configuration")]
    Missing,
    #[error("Ambiguous legacy configuration; configure a dedicated value")]
    Ambiguous,
    #[error("Storage requires encrypted transport")]
    Insecure,
}
