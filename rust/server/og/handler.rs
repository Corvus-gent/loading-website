use crate::{AppState, Error};
use axum::{
    body::Body,
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::VecDeque,
    sync::{Arc, LazyLock},
    time::Duration,
};
use tokio::sync::{Mutex, Semaphore};
static RENDERS: LazyLock<Arc<Semaphore>> = LazyLock::new(|| Arc::new(Semaphore::new(2)));
static CACHE: Mutex<VecDeque<(String, Vec<u8>)>> = Mutex::const_new(VecDeque::new());
const CACHE_HEADER: &str = "public, max-age=0, s-maxage=60, stale-while-revalidate=60";
fn reply(status: StatusCode, kind: &str, body: impl Into<Body>, cache: &str) -> Response {
    let mut r = body.into().into_response();
    *r.status_mut() = status;
    for (k, v) in [
        ("content-type", kind),
        ("cache-control", cache),
        ("x-content-type-options", "nosniff"),
    ] {
        if let Ok(v) = v.parse() {
            r.headers_mut().insert(k, v);
        }
    }
    r
}
async fn stats(state: &AppState) -> Result<Value, Error> {
    let prefix = if state.settings.get("VERCEL_ENV") == Some("preview") {
        "worldcraft:preview:features:v2"
    } else {
        "worldcraft:features:v2"
    };
    let rows = state
        .store
        .pipeline(vec![
            vec!["SCARD".into(), format!("{prefix}:players")],
            vec!["HGETALL".into(), format!("{prefix}:stats")],
        ])
        .await?;
    let players = rows[0].as_f64().unwrap_or(0.0);
    let mut data = rows[1].clone();
    if let Some(a) = data.as_array() {
        data = Value::Object(
            a.chunks_exact(2)
                .filter_map(|p| p[0].as_str().map(|k| (k.to_owned(), p[1].clone())))
                .collect(),
        );
    }
    let num = |k: &str| {
        data[k]
            .as_f64()
            .or_else(|| data[k].as_str().and_then(|s| s.parse::<f64>().ok()))
            .filter(|v| v.is_finite())
            .unwrap_or(0.0)
    };
    let total = num("total_play_seconds");
    Ok(
        json!({"players":players,"total":total,"avg":if players>0.0{total/players}else{0.0},"comments":num("comments"),"shares":num("shares")}),
    )
}
async fn png(state: &AppState, card: Value, curiosity: bool) -> Result<Vec<u8>, Error> {
    let now = chrono::Utc::now().timestamp_millis();
    let key = hex::encode(Sha256::digest(format!(
        "{curiosity}:{card}:{}",
        now / 60000
    )));
    if let Some((_, bytes)) = CACHE.lock().await.iter().find(|(k, _)| k == &key) {
        return Ok(bytes.clone());
    }
    let permit =
        tokio::time::timeout(Duration::from_secs(3), RENDERS.clone().acquire_owned()).await??;
    if let Some((_, bytes)) = CACHE.lock().await.iter().find(|(k, _)| k == &key) {
        return Ok(bytes.clone());
    }
    let photo = if curiosity {
        None
    } else {
        super::render::photo(state, card["photo"].as_str().unwrap_or("")).await
    };
    // Move the permit into the worker: cancelled HTTP requests must not lift the CPU limit early.
    let bytes = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        if curiosity {
            super::render::curiosity(&card)
        } else {
            super::render::render(&card, now, photo.as_deref())
        }
    })
    .await??;
    let mut cache = CACHE.lock().await;
    cache.push_back((key, bytes.clone()));
    while cache.len() > 48 || cache.iter().map(|(_, b)| b.len()).sum::<usize>() > 16_000_000 {
        cache.pop_front();
    }
    Ok(bytes)
}
async fn inner(state: &AppState, method: &Method, q: &Value) -> Result<Response, Error> {
    if q["kind"] == "curiositycraft" {
        if method == Method::HEAD {
            return Ok(reply(
                StatusCode::OK,
                "image/png",
                Body::empty(),
                CACHE_HEADER,
            ));
        }
        let data = tokio::time::timeout(Duration::from_secs(3), stats(state)).await??;
        return Ok(reply(
            StatusCode::OK,
            "image/png",
            png(state, data, true).await?,
            CACHE_HEADER,
        ));
    }
    let card = super::model::resolve(state, q).await?;
    if q["ogPage"] == "1" {
        let html = match card["kind"].as_str() {
            Some("live") => include_str!("../../../live/index.html"),
            Some("compound") => include_str!("../../../compound/v2/index.html"),
            _ => include_str!("../../../hack/3/index.html"),
        };
        return Ok(reply(
            StatusCode::OK,
            "text/html; charset=utf-8",
            if method == Method::HEAD {
                String::new()
            } else {
                super::model::metadata(html, &card)?
            },
            CACHE_HEADER,
        ));
    }
    if method == Method::HEAD {
        return Ok(reply(
            StatusCode::OK,
            "image/png",
            Body::empty(),
            CACHE_HEADER,
        ));
    }
    Ok(reply(
        StatusCode::OK,
        "image/png",
        png(state, card, false).await?,
        CACHE_HEADER,
    ))
}
pub async fn handle(state: &AppState, method: &Method, q: &Value) -> Response {
    if ![Method::GET, Method::HEAD].contains(method) {
        return reply(
            StatusCode::METHOD_NOT_ALLOWED,
            "text/plain; charset=utf-8",
            Body::empty(),
            CACHE_HEADER,
        );
    }
    match Box::pin(inner(state, method, q)).await {
        Ok(r) => r,
        Err(e) => {
            let missing = e.to_string() == "not_found";
            reply(
                if missing {
                    StatusCode::NOT_FOUND
                } else {
                    StatusCode::SERVICE_UNAVAILABLE
                },
                "text/plain; charset=utf-8",
                if method == Method::HEAD {
                    ""
                } else if missing {
                    "Preview not found."
                } else {
                    "Preview temporarily unavailable."
                },
                "no-store",
            )
        }
    }
}
