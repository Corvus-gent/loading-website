//! Fixed-origin owner APIs. Provider failures never erase previous observations.
mod http;
mod owner;
mod social;
use crate::compound_v2::model::text;
use corvus_core::impact;
pub use http::{Provider, ProviderError};
use serde_json::{Value, json};
pub use social::classify_x;

pub fn env_for(prefix: &str, account: &str) -> String {
    format!(
        "{prefix}_{}",
        account
            .to_uppercase()
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
            .collect::<String>()
    )
}
pub fn pending(error: impl Into<String>) -> Value {
    let error = error.into();
    json!({"mode":"not_configured","updates":[],"error":error,"note":error})
}
pub fn normalized(v: &Value) -> String {
    impact::normalized_handle(v)
}
pub fn merge(out: &mut Value, patch: &Value) {
    if let Some(o) = patch.as_object() {
        for (k, v) in o {
            out[k] = v.clone();
        }
    }
}
pub fn list<'a>(value: &'a Value, key: &str) -> &'a [Value] {
    value[key].as_array().map(Vec::as_slice).unwrap_or(&[])
}
impl Provider<'_> {
    pub async fn run(
        &self,
        platform: &str,
        rows: &[Value],
        registered: &[Value],
        account: &str,
        archives: bool,
    ) -> Result<Value, ProviderError> {
        match platform {
            "x" => self.x(rows).await,
            "li" => Ok(
                json!({"mode":"manual","updates":[],"note":"LinkedIn is not connected to an analytics API. Import published video URLs and self-reported metrics in /admin → Compound impact."}),
            ),
            "yt" => self.youtube(rows).await,
            "tw" => self.twitch(account, archives).await,
            "tt" | "ig" => {
                let result = if platform == "tt" {
                    self.tiktok(rows, registered, account).await
                } else {
                    self.instagram(rows, registered, account).await
                };
                let result = match result {
                    Ok(v) => v,
                    Err(e) if e.status == 429 => return Err(e),
                    Err(e) => json!({"mode":"error","updates":[],"error":e.to_string()}),
                };
                if !["not_configured", "error"].contains(&text(&result["mode"])) {
                    return Ok(result);
                }
                let mut out = result.clone();
                if self.state.settings.get("ORIANE_API_KEY").is_none() {
                    out["note"] = json!(format!(
                        "{} Oriane not configured; public fallback available.",
                        text(&result["error"])
                    ));
                    return Ok(out);
                }
                out = self.oriane(rows, platform).await?;
                out["error"] = result["error"].clone();
                out["note"] = json!(format!("Oriane fallback. {}", text(&result["error"])));
                Ok(out)
            }
            _ => Err(ProviderError::new("Unknown platform.")),
        }
    }
}
