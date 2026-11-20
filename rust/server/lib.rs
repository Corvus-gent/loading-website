pub mod auth;
pub mod battle;
pub mod config;
pub mod crypto;
pub mod hack;
pub mod layers;
pub mod live;
pub mod live_interviews;
pub mod name_vote;
pub mod plethora;
pub mod store;
pub mod support;
pub mod voter;
use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::json;
use std::{collections::HashMap, sync::Arc, time::Duration};

pub type Error = Box<dyn std::error::Error + Send + Sync>;
#[derive(Clone)]
pub struct AppState {
    pub settings: Arc<config::Settings>,
    pub store: store::Store,
    pub http: reqwest::Client,
    pub live: live::LiveService,
}

pub fn app() -> Result<Router, Error> {
    app_with(config::Settings::from_env())
}
pub fn app_with(settings: config::Settings) -> Result<Router, Error> {
    let settings = Arc::new(settings);
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .connect_timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::none())
        .build()?;
    let state = AppState {
        live: live::LiveService::new()?,
        store: store::Store::new(settings.clone(), http.clone()),
        settings,
        http,
    };
    Ok(Router::new()
        .fallback(dispatch)
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .with_state(state))
}
async fn dispatch(
    State(state): State<AppState>,
    method: Method,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
    body: Bytes,
) -> Response {
    let module = query.get("module").map(String::as_str).unwrap_or("health");
    if module == "health" {
        if method != Method::GET && method != Method::HEAD {
            return StatusCode::METHOD_NOT_ALLOWED.into_response();
        }
        return ([("cache-control","no-store")],Json(json!({"runtime":"rust","migration":"in-progress","writeMode":if state.settings.write_enabled(){"enabled"}else{"disabled"}}))).into_response();
    }
    if !state.settings.module_enabled(module) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error":"Module not enabled in Rust."})),
        )
            .into_response();
    }
    let result = match module {
        "auth" => auth::handle(&state, &method, &headers, &body).await,
        "layers" => layers::handle(&state, &method, &headers, &query, &body).await,
        "live" => live::handle(&state, &method, &headers, &query, &body).await,
        "hack" => hack::handle(&state, &method, &headers, &query, &body).await,
        "name-vote" => name_vote::handle(&state, &method, &headers, &body).await,
        "battle" => battle::handle(&state, &method, &headers, &query, &body).await,
        "support" => support::handle(&state, &method, &headers, &query, &body).await,
        "plethora" => plethora::handle(&state, &method, &headers, &query).await,
        _ => Ok((
            StatusCode::NOT_FOUND,
            Json(json!({"error":"Unknown module."})),
        )
            .into_response()),
    };
    result.unwrap_or_else(|_| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            [("cache-control", "no-store")],
            Json(json!({"error":"service unavailable"})),
        )
            .into_response()
    })
}

#[cfg(test)]
mod http_tests;
