//! Read-only coffee totals: owner API, cross-feed payment dedupe and warm/shared cache.
use crate::{AppState, Error};
use axum::{
    Json,
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use corvus_core::{army::truthy, impact::string};
use serde_json::{Value, json};
use std::{collections::HashSet, sync::Arc, time::Duration};
use tokio::sync::{Mutex, OnceCell};
const SOURCES: [(&str, &str, &str); 3] = [
    ("supporters", "support_id", "support_created_on"),
    (
        "subscriptions",
        "subscription_id",
        "subscription_created_on",
    ),
    ("extras", "purchase_id", "purchased_on"),
];
fn number(v: &Value) -> f64 {
    crate::visitors::model::number(v)
}
fn counted_flag(v: &Value) -> bool {
    let n = number(v);
    n != 0.0 && !n.is_nan()
}
pub struct Counter {
    month: String,
    people: HashSet<String>,
    payments: HashSet<String>,
    total: f64,
    monthly: f64,
    estimated: bool,
    latest: Option<String>,
}
impl Counter {
    pub fn new(now: i64) -> Self {
        Self {
            month: crate::visitors::day(now)[..7].into(),
            people: HashSet::new(),
            payments: HashSet::new(),
            total: 0.0,
            monthly: 0.0,
            estimated: false,
            latest: None,
        }
    }
    pub fn page(&mut self, source: &str, page: u64, data: &Value) -> Result<bool, Error> {
        let (_, id_field, date_field) = SOURCES
            .iter()
            .find(|(name, _, _)| *name == source)
            .ok_or("invalid coffee source")?;
        let rows = data["data"].as_array().ok_or("invalid coffee page")?;
        if number(&data["current_page"]) != page as f64 {
            return Err("invalid coffee page".into());
        }
        for row in rows {
            if counted_flag(&row["is_refunded"]) || counted_flag(&row["purchase_is_revoked"]) {
                continue;
            }
            let id = row
                .get(*id_field)
                .filter(|v| !v.is_null())
                .ok_or("invalid coffee record")?;
            let record = format!("{source}:{}", string(id));
            let tx = &row["transaction_id"];
            let transaction = if truthy(tx) && !string(tx).contains('*') {
                format!("payment:{}", string(tx))
            } else {
                record.clone()
            };
            if self.payments.contains(&record) || self.payments.contains(&transaction) {
                continue;
            }
            self.payments.insert(record.clone());
            self.payments.insert(transaction);
            let email = ["payer_email", "support_email"]
                .iter()
                .filter_map(|k| row[*k].as_str())
                .find(|s| s.contains('@') && !s.contains('*'));
            let supporter = &row["supporter_id"];
            if email.is_none() && !truthy(supporter) {
                self.estimated = true;
            }
            let person = if let Some(email) = email {
                format!(
                    "email:{}",
                    corvus_core::impact::trimmed(email).to_lowercase()
                )
            } else if truthy(supporter) {
                format!("account:{}", string(supporter))
            } else {
                record
            };
            self.people.insert(person);
            let cups = [
                "support_coffees",
                "subscription_coffee_num",
                "purchase_coffees",
            ]
            .iter()
            .find_map(|k| row.get(*k).filter(|v| !v.is_null()))
            .map(number)
            .unwrap_or(0.0);
            if !cups.is_finite()
                || cups < 0.0
                || cups.fract() != 0.0
                || cups > 9_007_199_254_740_991.0
            {
                return Err("invalid coffee count".into());
            }
            if cups == 0.0 {
                continue;
            }
            let mut stamp = string(&row[*date_field]).replacen(' ', "T", 1);
            let has_zone = stamp.ends_with('Z')
                || stamp.ends_with('z')
                || stamp
                    .as_bytes()
                    .get(stamp.len().saturating_sub(6))
                    .is_some_and(|b| *b == b'+' || *b == b'-')
                    && stamp.as_bytes().get(stamp.len().saturating_sub(3)) == Some(&b':');
            if !has_zone {
                stamp.push('Z');
            }
            if stamp.ends_with('z') {
                stamp.pop();
                stamp.push('Z');
            }
            let at = DateTime::parse_from_rfc3339(&stamp)?.timestamp_millis();
            let local = crate::visitors::day(at);
            self.total += cups;
            if local.starts_with(&self.month) {
                self.monthly += cups;
            }
            if self.latest.as_ref().is_none_or(|last| local > *last) {
                self.latest = Some(local);
            }
        }
        Ok(truthy(&data["next_page_url"]) || (page as f64) < number(&data["last_page"]))
    }
    pub fn finish(&self) -> Value {
        json!({"ready":true,"total":self.total,"supporters":self.people.len(),"supportersEstimated":self.estimated,"month":self.monthly,"latest":self.latest})
    }
}
async fn fetch_totals(s: &AppState, now: i64) -> Result<Value, Error> {
    let token = s.settings.get("BMC_TOKEN").ok_or("missing coffee token")?;
    let work = async {
        let mut counter = Counter::new(now);
        for (source, _, _) in SOURCES {
            let mut page = 1;
            loop {
                let url = crate::visitors::remote(
                    s,
                    &format!("/api/v1/{source}?page={page}"),
                    "https://developers.buymeacoffee.com",
                )?;
                let response = s
                    .http
                    .get(url)
                    .bearer_auth(token)
                    .header("accept", "application/json")
                    .timeout(Duration::from_secs(20))
                    .send()
                    .await?;
                if page == 1 && source != "supporters" && response.status() == StatusCode::NOT_FOUND
                {
                    break;
                }
                let body: Value = serde_json::from_slice(
                    &crate::visitors::bytes(response, 8 * 1024 * 1024).await?,
                )?;
                if !counter.page(source, page, &body)? {
                    break;
                }
                page = page.checked_add(1).ok_or("too many coffee pages")?;
            }
        }
        Ok::<_, Error>(counter.finish())
    };
    tokio::time::timeout(Duration::from_secs(20), work).await?
}
type Pending = (String, Arc<OnceCell<Result<Value, String>>>);
#[derive(Default)]
struct Cache {
    memo: Option<(String, Value, i64)>,
    pending: Option<Pending>,
}
#[derive(Clone, Default)]
pub struct Service(Arc<Mutex<Cache>>);
impl Service {
    async fn load(&self, s: &AppState, key: &str) -> Result<Value, Error> {
        if s.store.connected()
            && let Ok(Ok(raw)) =
                tokio::time::timeout(Duration::from_millis(750), s.store.get(key)).await
            && let Some(raw) = raw.as_str().filter(|s| !s.is_empty())
        {
            return Ok(serde_json::from_str(raw)?);
        }
        let value = fetch_totals(s, Utc::now().timestamp_millis()).await?;
        if s.store.connected() && s.settings.write_enabled() {
            let _ = tokio::time::timeout(
                Duration::from_millis(750),
                s.store.command(vec![
                    "SET".into(),
                    key.into(),
                    value.to_string(),
                    "EX".into(),
                    "1800".into(),
                ]),
            )
            .await;
        }
        self.0.lock().await.memo = Some((
            key.into(),
            value.clone(),
            Utc::now().timestamp_millis() + 1_800_000,
        ));
        Ok(value)
    }
    pub async fn totals(&self, s: &AppState) -> Result<Value, Error> {
        if s.settings.get("BMC_TOKEN").is_none() {
            return Ok(json!({"ready":false}));
        }
        let now = Utc::now().timestamp_millis();
        let key = format!("stats:coffee:v1:{}", &crate::visitors::day(now)[..7]);
        let cell = {
            let mut cache = self.0.lock().await;
            if let Some((k, v, until)) = &cache.memo
                && *k == key
                && *until > now
            {
                return Ok(v.clone());
            }
            if let Some((k, cell)) = &cache.pending
                && *k == key
            {
                cell.clone()
            } else {
                let cell = Arc::new(OnceCell::new());
                cache.pending = Some((key.clone(), cell.clone()));
                cell
            }
        };
        let result = cell
            .get_or_init(|| async {
                self.load(s, &key)
                    .await
                    .map_err(|_| "coffee unavailable".into())
            })
            .await
            .clone();
        let mut cache = self.0.lock().await;
        if cache
            .pending
            .as_ref()
            .is_some_and(|(_, c)| Arc::ptr_eq(c, &cell))
        {
            cache.pending = None;
        }
        result.map_err(Into::into)
    }
    pub async fn handle(&self, s: &AppState, method: &Method) -> Response {
        let (status, body) = if *method != Method::GET && *method != Method::HEAD {
            (StatusCode::METHOD_NOT_ALLOWED, json!({"error":"method"}))
        } else {
            match self.totals(s).await {
                Ok(v) => (StatusCode::OK, v),
                Err(_) => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    json!({"error":"coffee unavailable"}),
                ),
            }
        };
        (status, [("cache-control", "no-store")], Json(body)).into_response()
    }
}
