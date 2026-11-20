use super::{
    model::{self, count, text},
    store::Registry,
};
use crate::{AppState, Error};
use axum::{
    Json,
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::{DateTime, SecondsFormat, Utc};
use corvus_core::videos::parse_slug;
use serde_json::{Value, json};
use std::{sync::Arc, time::Duration};
use tokio::sync::{Mutex, RwLock};
fn timestamp(value: &Value) -> Option<i64> {
    DateTime::parse_from_rfc3339(value.as_str()?)
        .ok()
        .map(|v| v.timestamp_millis())
}
pub fn summarize(report: &Value, events: &[Value], now: i64) -> Result<Value, Error> {
    let mut rows = report["videos"]
        .as_array()
        .ok_or("invalid report")?
        .iter()
        .filter(|v| v["is_example"] != true)
        .collect::<Vec<_>>();
    rows.sort_by(|a, b| {
        count(&b["views"])
            .cmp(&count(&a["views"]))
            .then_with(|| count(&b["votes"]).cmp(&count(&a["votes"])))
            .then_with(|| text(&a["slug"]).cmp(text(&b["slug"])))
    });
    let leader = rows
        .first()
        .filter(|v| count(&v["views"]) > 0 || count(&v["votes"]) > 0)
        .map(|v| json!({"code":model::vote_code(v),"views":v["views"],"votes":v["votes"]}));
    let latest=events.iter().filter_map(|v|{
        if v["type"]!="vote" || !rows.iter().any(|row|row["slug"]==v["slug"]) || !["up","down"].contains(&text(&v["choice"])) || !timestamp(&v["at"]).is_some_and(|t|t>now-86400000 && t<=now+1000){return None;}
        let parsed=serde_json::to_value(parse_slug(text(&v["slug"]))?).ok()?;
        Some(json!({"type":"vote","code":model::vote_code(&parsed),"choice":v["choice"],"at":v["at"]}))
    }).take(3).collect::<Vec<_>>();
    let at = DateTime::<Utc>::from_timestamp_millis(now)
        .ok_or("invalid timestamp")?
        .to_rfc3339_opts(SecondsFormat::Millis, true);
    Ok(
        json!({"ready":true,"totals":{"views":report["totals"]["views"],"votes":report["totals"]["votes"]},"leader":leader,"leader_by":"views_then_votes","latest":latest,"deadline":model::deadline()?,"updated_at":at}),
    )
}
#[derive(Clone, Default)]
pub struct Service {
    last: Arc<RwLock<Option<Value>>>,
    refresh: Arc<Mutex<()>>,
}
impl Service {
    async fn fresh(&self) -> Option<Value> {
        self.last
            .read()
            .await
            .as_ref()
            .filter(|v| {
                timestamp(&v["updated_at"])
                    .is_some_and(|at| Utc::now().timestamp_millis() - at < 15000)
            })
            .cloned()
    }
    async fn snapshot(&self, state: &AppState) -> Result<Value, Error> {
        if let Some(last) = self.fresh().await {
            return Ok(last);
        }
        // Serializing cache misses coalesces successful concurrent polls; cancellation releases the lock.
        tokio::time::timeout(Duration::from_secs(4), async {
            let _lock = self.refresh.lock().await;
            if let Some(last) = self.fresh().await {
                return Ok(last);
            }
            let registry = Registry(state);
            let (report, events) = tokio::join!(registry.report(false), registry.latest_votes());
            let snapshot = summarize(
                &report?,
                events?.as_array().ok_or("invalid events")?,
                Utc::now().timestamp_millis(),
            )?;
            *self.last.write().await = Some(snapshot.clone());
            Ok::<_, Error>(snapshot)
        })
        .await?
    }
    pub async fn handle(&self, state: &AppState, method: &Method) -> Response {
        if ![Method::GET, Method::HEAD].contains(method) {
            return (
                StatusCode::METHOD_NOT_ALLOWED,
                [
                    ("allow", "GET, HEAD"),
                    ("x-content-type-options", "nosniff"),
                ],
            )
                .into_response();
        }
        let (status, body, cache) = match self.snapshot(state).await {
            Ok(body) => (
                StatusCode::OK,
                body,
                "public, max-age=0, s-maxage=15, stale-while-revalidate=30, stale-if-error=300",
            ),
            Err(_) => match self.last.read().await.clone() {
                Some(mut body) => {
                    body["stale"] = json!(true);
                    (StatusCode::OK, body, "no-store")
                }
                None => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    json!({"ready":false,"error":"Live counts are reconnecting."}),
                    "no-store",
                ),
            },
        };
        let headers = [
            ("cache-control", cache),
            ("x-content-type-options", "nosniff"),
        ];
        if method == Method::HEAD && status == StatusCode::OK && body["stale"] != true {
            (status, headers).into_response()
        } else {
            (status, headers, Json(body)).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Settings;
    use http_body_util::BodyExt;
    #[tokio::test]
    async fn outage_keeps_last_snapshot_and_never_invents_zeroes() -> Result<(), Error> {
        let settings = Arc::new(Settings::new(
            [("REDIS_MAINTENANCE".into(), "1".into())].into(),
        ));
        let http = reqwest::Client::new();
        let state = AppState {
            store: crate::store::Store::new(settings.clone(), http.clone()),
            http,
            settings,
            live: crate::live::LiveService::new()?,
            compound_summary: Service::default(),
        };
        let missing = state.compound_summary.handle(&state, &Method::GET).await;
        assert_eq!(missing.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body: Value = serde_json::from_slice(&missing.into_body().collect().await?.to_bytes())?;
        assert_eq!(body["ready"], false);
        assert!(body.get("totals").is_none());
        let prior = json!({"ready":true,"totals":{"views":12345,"votes":99},"leader":null,"latest":[],"updated_at":"2026-01-01T00:00:00.000Z"});
        *state.compound_summary.last.write().await = Some(prior.clone());
        let response = state.compound_summary.handle(&state, &Method::GET).await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()["cache-control"], "no-store");
        let body: Value =
            serde_json::from_slice(&response.into_body().collect().await?.to_bytes())?;
        assert_eq!(body["totals"], prior["totals"]);
        assert_eq!(body["stale"], true);
        Ok(())
    }
}
