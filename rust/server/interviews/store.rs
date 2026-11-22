use crate::{
    AppState, Error,
    compound_v2::{
        model::{self, text},
        store::Registry,
    },
    crypto,
};
use corvus_core::army::truthy;
use regex::Regex;
use serde_json::{Value, json};
use std::sync::LazyLock;
use url::Url;

pub const RETENTION: i64 = 90 * 86400;
static X_HANDLE: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_]{1,15}$").ok());
static IG_HANDLE: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_.]{1,30}$").ok());
fn string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Null => "null".into(),
        Value::Object(_) => "[object Object]".into(),
        Value::Array(v) => v
            .iter()
            .map(|x| {
                if x.is_null() {
                    String::new()
                } else {
                    string(x)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        _ => value.to_string(),
    }
}
fn or_empty(value: &Value) -> String {
    if truthy(value) {
        string(value)
    } else {
        String::new()
    }
}
pub fn fields(raw: &Value) -> Result<Value, Error> {
    let mut clean = json!({});
    for (key, max) in [("builder", 80), ("project", 100), ("description", 220)] {
        let value = raw[key]
            .as_str()
            .filter(|s| !model::trim(s).is_empty() && s.encode_utf16().count() <= max)
            .ok_or("Fill in the builder, robot and one-line description.")?;
        clean[key] = json!(model::plain(model::trim(value)));
    }
    for (key, pattern) in [("x_handle", &X_HANDLE), ("ig_handle", &IG_HANDLE)] {
        let raw = or_empty(&raw[key]);
        let value = model::trim(&raw)
            .strip_prefix('@')
            .unwrap_or(model::trim(&raw));
        if !value.is_empty() && !pattern.as_ref().is_some_and(|r| r.is_match(value)) {
            return Err("Use a handle, without a profile URL.".into());
        }
        clean[key] = json!(value);
    }
    clean["clip_url"] = json!("");
    if truthy(&raw["clip_url"]) {
        let url =
            Url::parse(&string(&raw["clip_url"])).map_err(|_| "Use a full HTTPS clip URL.")?;
        if url.scheme() != "https"
            || !url.username().is_empty()
            || url.password().is_some()
            || url.as_str().encode_utf16().count() > 1500
            || matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
        {
            return Err("Use a public HTTPS clip URL.".into());
        }
        clean["clip_url"] = json!(url.as_str());
    }
    if raw["consent"] != true {
        return Err("Confirm that the builder agreed to be filmed and posted.".into());
    }
    Ok(clean)
}
pub fn public_row(row: &Value) -> Value {
    let n = &row["n"];
    json!({"n":n,"title":format!("Interview #{n}: {}",text(&row["project"])),"builder":row["builder"],"project":row["project"],"description":row["description"],"x_handle":row["x_handle"],"ig_handle":row["ig_handle"],"clip_url":row["clip_url"],"photo_url":text(&row["photo_url"]),"url":format!("https://corvus.gent/hack/3?interview={n}#int-{n}"),"published_at":row["created_at"],"updated_at":row["updated_at"],"slug":row["slug"]})
}
pub struct Interviews<'a>(pub &'a AppState);
impl Interviews<'_> {
    pub fn key(&self, part: &str) -> String {
        Registry(self.0).key(&format!("interviews:{part}"))
    }
    pub async fn list(&self) -> Result<Vec<Value>, Error> {
        let ids = self
            .0
            .store
            .command(vec![
                "ZREVRANGEBYSCORE".into(),
                self.key("index"),
                "+inf".into(),
                (chrono::Utc::now().timestamp_millis() - RETENTION * 1000).to_string(),
            ])
            .await?;
        let commands = ids
            .as_array()
            .ok_or("invalid interview index")?
            .iter()
            .map(|id| vec!["GET".into(), self.key(&format!("record:{}", text(id)))])
            .collect::<Vec<_>>();
        if commands.is_empty() {
            return Ok(vec![]);
        }
        self.0
            .store
            .pipeline(commands)
            .await?
            .iter()
            .filter(|v| !v.is_null())
            .map(|v| serde_json::from_str(text(v)).map_err(Into::into))
            .collect()
    }
    pub async fn get(&self, n: &Value) -> Result<Option<Value>, Error> {
        let s = string(n);
        if s.len() > 4
            || s.is_empty()
            || s.starts_with('0')
            || !s.bytes().all(|b| b.is_ascii_digit())
        {
            return Ok(None);
        }
        let raw = self
            .0
            .store
            .command(vec!["GET".into(), self.key(&format!("record:{s}"))])
            .await?;
        raw.as_str()
            .map(serde_json::from_str)
            .transpose()
            .map_err(Into::into)
    }
    pub async fn save(
        &self,
        raw: &Value,
        photo_url: &str,
        remove_photo: bool,
    ) -> Result<Value, Error> {
        let clean = fields(raw)?;
        let n = if truthy(&raw["n"]) {
            model::number(&raw["n"]).ok_or("Invalid interview.")?
        } else {
            0.0
        };
        if n != 0.0 && (n.fract() != 0.0 || !(1.0..=9999.0).contains(&n)) {
            return Err("Invalid interview.".into());
        }
        let n = n as i64;
        let request_id = or_empty(&raw["request_id"]);
        if n == 0
            && (request_id.len() != 36
                || !request_id
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b) || b == b'-'))
        {
            return Err("Reload the form and try again.".into());
        }
        // Object insertion order is part of the legacy retry fingerprint.
        let mut fingerprint = clean.clone();
        fingerprint["photo"] = if truthy(&raw["photo"]) {
            raw["photo"].clone()
        } else {
            json!("")
        };
        fingerprint["remove_photo"] = json!(remove_photo);
        let hash = crypto::sha(&serde_json::to_string(&fingerprint)?);
        let now = model::now();
        let ms = chrono::Utc::now().timestamp_millis();
        let mut data = clean;
        for (k, v) in [
            ("photo_url", json!(photo_url)),
            ("consent", json!(true)),
            ("consent_at", json!(now)),
            ("created_at", json!(now)),
            ("created_ms", json!(ms)),
            ("updated_at", json!(now)),
        ] {
            data[k] = v;
        }
        let result = Registry(self.0)
            .eval(
                include_str!("../../migration/interview-save.lua"),
                &[
                    Registry(self.0).key("videos"),
                    self.key("index"),
                    self.key("sequence"),
                    self.key(&format!(
                        "retry:{}",
                        if request_id.is_empty() {
                            n.to_string()
                        } else {
                            request_id
                        }
                    )),
                ],
                &[
                    n.to_string(),
                    serde_json::to_string(&data)?,
                    self.key("record:"),
                    RETENTION.to_string(),
                    ms.to_string(),
                    or_empty(&raw["updated_at"]),
                    if !photo_url.is_empty() {
                        "replace"
                    } else if remove_photo {
                        "remove"
                    } else {
                        "keep"
                    }
                    .into(),
                    hash,
                ],
            )
            .await?;
        let status = model::count(&result[0]);
        if status < 0 {
            return Err(match status {
                -3 => "This entry changed. Reload before saving.",
                -2 => "Interview not found.",
                _ => "The interview registry is full.",
            }
            .into());
        }
        let row: Value = serde_json::from_str(text(&result[1]))?;
        Ok(json!({"row":row,"created":status==1,"oldPhoto":text(&result[2])}))
    }
    pub async fn remove(&self, n: &Value, updated_at: &Value) -> Result<Value, Error> {
        let old = self.get(n).await?.ok_or("Interview not found.")?;
        let result = Registry(self.0)
            .eval(
                include_str!("../../migration/interview-delete.lua"),
                &[
                    self.key(&format!("record:{}", string(n))),
                    self.key("index"),
                    Registry(self.0).key("videos"),
                ],
                &[string(n), or_empty(updated_at)],
            )
            .await?;
        if model::count(&result) != 1 {
            return Err("This entry changed. Reload before deleting.".into());
        }
        Ok(old)
    }
}
