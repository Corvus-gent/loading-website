pub mod army;
pub mod auth;
pub mod battle;
pub mod compound;
pub mod compound_v2;
pub mod config;
pub mod crypto;
pub mod cv;
pub mod hack;
pub mod layers;
pub mod legion;
pub mod live;
pub mod live_interviews;
pub mod name_vote;
pub mod og;
pub mod plethora;
pub mod stats;
pub mod store;
pub mod support;
pub mod visitors;
pub mod voter;
use axum::{
    Extension, Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Query, RawQuery, State},
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::json;
use std::{collections::HashMap, sync::Arc, time::Duration};

pub type Error = Box<dyn std::error::Error + Send + Sync>;
pub mod impact;
pub mod interviews;
#[derive(Clone)]
pub struct AppState {
    pub settings: Arc<config::Settings>,
    pub store: store::Store,
    pub http: reqwest::Client,
    pub live: live::LiveService,
    pub compound_summary: compound_v2::summary::Service,
    pub coffee: stats::coffee::Service,
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
        compound_summary: compound_v2::summary::Service::default(),
        coffee: Default::default(),
        store: store::Store::new(settings.clone(), http.clone()),
        settings,
        http,
    };
    Ok(Router::new()
        .fallback(dispatch)
        .layer(DefaultBodyLimit::max(4_000_000))
        .with_state(state))
}
async fn dispatch(
    State(state): State<AppState>,
    method: Method,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
    RawQuery(raw_query): RawQuery,
    context: Option<Extension<vercel_runtime::AppState>>,
    body: Bytes,
) -> Response {
    let module = query.get("module").map(String::as_str).unwrap_or("health");
    let body_limit = if module == "legion" && query.get("senate").is_some_and(|v| v == "1") {
        4_000_000
    } else if module == "compound-v2"
        && ["interviews", "interviewAdmin"]
            .iter()
            .any(|k| query.get(*k).is_some_and(|v| v == "1"))
    {
        2_500_000
    } else {
        1024 * 1024
    };
    if body.len() > body_limit {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    }
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
        "cv" => Ok(cv::handle(
            &state,
            &method,
            &headers,
            &query,
            context.as_ref().map(|v| &v.0),
        )),
        "stats-coffee" => Ok(state.coffee.handle(&state, &method).await),
        "stats-daily" => Ok(Box::pin(stats::handler::daily(&state, &query)).await),
        "stats-sections" => Ok(Box::pin(stats::handler::section(&state, &method, &query)).await),
        "stats-private" => Ok(Box::pin(stats::handler::private(&state, &headers, &query)).await),
        "geo" => Ok(Box::pin(visitors::geo(&state, &method, &headers, &query)).await),
        "hit" | "notice" => Ok(Box::pin(visitors::hit(
            &state,
            &method,
            &headers,
            &body,
            module == "notice",
        ))
        .await),
        "og" => Ok(og::handler::handle(
            &state,
            &method,
            &serde_json::to_value(&query).unwrap_or_default(),
        )
        .await),
        "army" => {
            Box::pin(army::handler::handle(
                &state, &method, &headers, &query, &body,
            ))
            .await
        }
        "army-bmc" | "army-pidgy" => {
            Box::pin(army::webhooks::signed(
                &state,
                &method,
                &headers,
                &body,
                module == "army-bmc",
                context.as_ref().map(|v| &v.0),
            ))
            .await
        }
        "army-discord" => {
            Box::pin(army::webhooks::discord(
                &state,
                &method,
                &headers,
                &body,
                context.as_ref().map(|v| &v.0),
            ))
            .await
        }
        "legion" => {
            Box::pin(legion::handler::handle(
                &state, &method, &headers, &query, &body,
            ))
            .await
        }
        "legion-stripe" => {
            Ok(Box::pin(legion::handler::webhook(&state, &method, &headers, &body)).await)
        }
        "compound-stripe" => {
            Ok(Box::pin(compound::handler::webhook(&state, &method, &headers, &body)).await)
        }
        "compound-summary" => Ok(Box::pin(state.compound_summary.handle(&state, &method)).await),
        "compound" | "compound-v2" => {
            let mut ordered = serde_json::Value::Object(
                url::form_urlencoded::parse(raw_query.as_deref().unwrap_or("").as_bytes())
                    .map(|(k, v)| (k.into_owned(), json!(v)))
                    .collect(),
            );
            if module == "compound" {
                if let Some(q) = ordered.as_object_mut() {
                    q.shift_remove("module");
                }
                return Box::pin(compound::handler::handle(
                    &state, &method, &headers, &ordered, &body,
                ))
                .await
                .unwrap_or_else(|_| StatusCode::SERVICE_UNAVAILABLE.into_response());
            }
            Box::pin(compound_v2::handler::handle(
                &state,
                &method,
                &headers,
                &ordered,
                &body,
                context.as_ref().map(|v| &v.0),
            ))
            .await
        }
        "auth" => Box::pin(auth::handle(&state, &method, &headers, &body)).await,
        "layers" => Box::pin(layers::handle(&state, &method, &headers, &query, &body)).await,
        "live" => Box::pin(live::handle(&state, &method, &headers, &query, &body)).await,
        "hack" => Box::pin(hack::handle(&state, &method, &headers, &query, &body)).await,
        "name-vote" => Box::pin(name_vote::handle(&state, &method, &headers, &body)).await,
        "battle" => Box::pin(battle::handle(&state, &method, &headers, &query, &body)).await,
        "support" => Box::pin(support::handle(&state, &method, &headers, &query, &body)).await,
        "plethora" => Box::pin(plethora::handle(&state, &method, &headers, &query)).await,
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
