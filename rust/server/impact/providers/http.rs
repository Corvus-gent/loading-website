use crate::{AppState, config::is_loopback};
use reqwest::Method;
use serde_json::{Value, json};
use std::time::Duration;
use url::Url;

#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct ProviderError {
    pub message: String,
    pub status: u16,
    pub retry_after: f64,
}
impl ProviderError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            status: 0,
            retry_after: 0.0,
        }
    }
    pub fn json(&self) -> Value {
        json!({"error":self.message,"status":self.status,"retryAfter":self.retry_after})
    }
}
impl From<url::ParseError> for ProviderError {
    fn from(_: url::ParseError) -> Self {
        Self::new("Invalid provider URL.")
    }
}

pub struct Provider<'a> {
    pub(super) state: &'a AppState,
    client: reqwest::Client,
    fixture: Option<Url>,
    pub now: i64,
}
impl<'a> Provider<'a> {
    pub fn new(
        state: &'a AppState,
        fixture: Option<&str>,
        now: i64,
    ) -> Result<Self, ProviderError> {
        let fixture = fixture.map(Url::parse).transpose()?;
        if fixture.as_ref().is_some_and(|u| {
            state.settings.production()
                || state.settings.get("CORVUS_RUST_WRITES") != Some("isolated")
                || !state.settings.write_enabled()
                || !is_loopback(u)
                || u.scheme() != "http"
                || !u.username().is_empty()
                || u.password().is_some()
                || u.query().is_some()
                || u.fragment().is_some()
        }) {
            return Err(ProviderError::new("Invalid provider fixture endpoint."));
        }
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(4))
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|_| ProviderError::new("Provider client unavailable."))?;
        Ok(Self {
            state,
            client,
            fixture,
            now,
        })
    }
    pub fn time(&self) -> String {
        chrono::DateTime::from_timestamp_millis(self.now)
            .map(|d| d.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_default()
    }
    pub fn credential(&self, name: &str) -> Option<&str> {
        self.state.settings.get(name)
    }
    pub fn url(base: &str, params: &[(&str, String)]) -> Result<Url, ProviderError> {
        let mut u = Url::parse(base)?;
        u.query_pairs_mut()
            .extend_pairs(params.iter().map(|(k, v)| (*k, v.as_str())));
        Ok(u)
    }
    pub(super) fn cache_key(&self) -> String {
        crate::crypto::sha(&format!(
            "{}:{}:{}",
            self.credential("TWITCH_CLIENT_ID").unwrap_or(""),
            self.credential("TWITCH_CLIENT_SECRET").unwrap_or(""),
            self.fixture.as_ref().map(Url::as_str).unwrap_or("")
        ))
    }
    pub async fn request(
        &self,
        method: Method,
        url: Url,
        headers: &[(&str, &str)],
        body: Option<String>,
        permission: &str,
    ) -> Result<Value, ProviderError> {
        if !self.state.settings.write_enabled() {
            return Err(ProviderError::new(
                "Provider refresh is disabled during read-only validation.",
            ));
        }
        const HOSTS: &[&str] = &[
            "graph.facebook.com",
            "open.tiktokapis.com",
            "www.googleapis.com",
            "youtubeanalytics.googleapis.com",
            "api.x.com",
            "connect.oriane.xyz",
            "api.twitch.tv",
            "id.twitch.tv",
        ];
        if url.scheme() != "https"
            || !url.host_str().is_some_and(|h| HOSTS.contains(&h))
            || !url.username().is_empty()
            || url.password().is_some()
            || url.port().is_some()
        {
            return Err(ProviderError::new("Invalid provider origin."));
        }
        if self.state.settings.get("CORVUS_RUST_WRITES") == Some("isolated")
            && self.fixture.is_none()
        {
            return Err(ProviderError::new(
                "Isolated provider tests require a loopback fixture.",
            ));
        }
        let target = if let Some(base) = &self.fixture {
            let mut target = base.clone();
            target.set_path(&format!(
                "/{host}{path}",
                host = url.host_str().unwrap_or(""),
                path = url.path()
            ));
            target.set_query(url.query());
            target
        } else {
            url
        };
        let mut req = self.client.request(method, target);
        for (k, v) in headers {
            req = req.header(*k, *v);
        }
        if let Some(body) = body {
            req = req.body(body);
        }
        let mut response = req.send().await.map_err(|_| {
            ProviderError::new("Provider request failed or timed out. Previous metrics kept.")
        })?;
        let status = response.status();
        let delay = response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let retry_after = delay
            .parse::<f64>()
            .ok()
            .filter(|n| n.is_finite())
            .or_else(|| {
                chrono::DateTime::parse_from_rfc2822(delay)
                    .ok()
                    .map(|d| ((d.timestamp_millis() - self.now) as f64 / 1000.0).max(0.0))
            })
            .unwrap_or(0.0);
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| {
            ProviderError::new("Provider response interrupted. Previous metrics kept.")
        })? {
            if bytes.len() + chunk.len() > 8 * 1024 * 1024 {
                return Err(ProviderError::new(
                    "Provider response exceeded its size limit.",
                ));
            }
            bytes.extend_from_slice(&chunk);
        }
        let body = serde_json::from_slice::<Value>(&bytes);
        if !status.is_success() {
            let code = body
                .as_ref()
                .ok()
                .and_then(|v| {
                    [
                        &v["error"]["errors"][0]["reason"],
                        &v["error"]["error_subcode"],
                        &v["error"]["code"],
                    ]
                    .into_iter()
                    .find(|v| corvus_core::army::truthy(v))
                })
                .map(|v| {
                    corvus_core::impact::string(v)
                        .chars()
                        .filter(|c| c.is_ascii_alphanumeric() || "_-".contains(*c))
                        .take(40)
                        .collect::<String>()
                })
                .unwrap_or_default();
            return Err(ProviderError {
                message: format!(
                    "HTTP {}{}. {permission}",
                    status.as_u16(),
                    if code.is_empty() {
                        String::new()
                    } else {
                        format!(" ({code})")
                    }
                ),
                status: status.as_u16(),
                retry_after,
            });
        }
        body.map_err(|_| {
            ProviderError::new("Provider returned invalid JSON. Previous metrics kept.")
        })
    }
    pub async fn get(
        &self,
        url: Url,
        token: &str,
        permission: &str,
    ) -> Result<Value, ProviderError> {
        self.request(
            Method::GET,
            url,
            &[("Authorization", &format!("Bearer {token}"))],
            None,
            permission,
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{config::Settings, live::LiveService, store::Store};
    use std::sync::Arc;
    #[tokio::test]
    async fn read_only_and_isolated_provider_credentials_never_escape() -> Result<(), crate::Error>
    {
        for isolated in [false, true] {
            let mut env = std::collections::BTreeMap::from([(
                "X_BEARER_TOKEN".into(),
                "fixture-secret".into(),
            )]);
            if isolated {
                env.insert("CORVUS_RUST_WRITES".into(), "isolated".into());
                env.insert("REDIS_URL".into(), "redis://127.0.0.1:9/1".into());
            }
            let settings = Arc::new(Settings::new(env));
            let client = reqwest::Client::new();
            let state = AppState {
                store: Store::new(settings.clone(), client.clone()),
                http: client,
                settings,
                live: LiveService::new()?,
                compound_summary: Default::default(),
                coffee: Default::default(),
            };
            let provider = Provider::new(&state, None, 0)?;
            let result = provider
                .run(
                    "x",
                    &[json!({"post_url":"https://x.com/gabe_maxxing/status/1"})],
                    &[],
                    "gabe_maxxing",
                    false,
                )
                .await;
            assert!(result.as_ref().is_err_and(|e| e.message
                == if isolated {
                    "Isolated provider tests require a loopback fixture."
                } else {
                    "Provider refresh is disabled during read-only validation."
                }));
        }
        Ok(())
    }
}
