//! Mail/Discord I/O. Fixtures cannot reach the public network; redirects never carry tokens.
use crate::{AppState, Error, config::is_loopback};
use reqwest::Method;
use serde_json::Value;
use std::time::Duration;
use url::Url;
pub struct Transport<'a> {
    state: &'a AppState,
    client: reqwest::Client,
    fixture: Option<Url>,
}
pub struct Reply {
    pub status: u16,
    pub bytes: Vec<u8>,
}
impl Reply {
    pub fn ok(&self) -> bool {
        (200..300).contains(&self.status)
    }
    pub fn json(&self) -> Result<Value, Error> {
        Ok(serde_json::from_slice(&self.bytes).map_err(|_| "provider_json")?)
    }
}
impl<'a> Transport<'a> {
    pub fn new(state: &'a AppState, fixture: Option<&str>) -> Result<Self, Error> {
        let fixture = fixture.map(Url::parse).transpose()?;
        if fixture.as_ref().is_some_and(|u| {
            state.settings.production()
                || state.settings.get("CORVUS_RUST_WRITES") != Some("isolated")
                || !state.settings.write_enabled()
                || u.scheme() != "http"
                || !is_loopback(u)
                || !u.username().is_empty()
                || u.password().is_some()
                || u.query().is_some()
                || u.fragment().is_some()
        }) {
            return Err("provider_fixture".into());
        }
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(8))
            .build()?;
        Ok(Self {
            state,
            client,
            fixture,
        })
    }
    pub async fn request(
        &self,
        url: &str,
        method: Method,
        headers: &[(&str, &str)],
        body: Option<&Value>,
    ) -> Result<Reply, Error> {
        if !self.state.settings.write_enabled() {
            return Err("provider_read_only".into());
        }
        let url = Url::parse(url)?;
        if url.scheme() != "https"
            || !matches!(url.host_str(), Some("discord.com" | "api.resend.com"))
            || url.port().is_some()
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err("provider_origin".into());
        }
        if self.state.settings.get("CORVUS_RUST_WRITES") == Some("isolated")
            && self.fixture.is_none()
        {
            return Err("provider_fixture_required".into());
        }
        let target = if let Some(base) = &self.fixture {
            let mut u = base.clone();
            u.set_path(&format!("/{}{}", url.host_str().unwrap_or(""), url.path()));
            u.set_query(url.query());
            u
        } else {
            url
        };
        let mut request = self.client.request(method, target);
        for (k, v) in headers {
            request = request.header(*k, *v);
        }
        if let Some(body) = body {
            request = request.json(body);
        }
        let mut response = request.send().await.map_err(|_| "provider_request")?;
        let status = response.status().as_u16();
        let mut bytes = vec![];
        while let Some(chunk) = response.chunk().await.map_err(|_| "provider_response")? {
            if bytes.len() + chunk.len() > 2 * 1024 * 1024 {
                return Err("provider_size".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        Ok(Reply { status, bytes })
    }
}
