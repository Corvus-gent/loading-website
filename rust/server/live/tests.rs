use super::*;
use axum::{
    Router,
    extract::State,
    routing::{get, post},
};
use std::sync::atomic::{AtomicU8, AtomicUsize, Ordering};
#[derive(Clone, Default)]
struct Provider {
    calls: Arc<AtomicUsize>,
    phase: Arc<AtomicU8>,
}
async fn token(State(p): State<Provider>, body: String) -> Json<Value> {
    p.calls.fetch_add(1, Ordering::SeqCst);
    assert!(body.contains("client_id=test-id"));
    assert!(body.contains("grant_type=client_credentials"));
    Json(json!({"access_token":"fixture-private-token","expires_in":3600}))
}
async fn streams(State(p): State<Provider>, headers: HeaderMap) -> Response {
    p.calls.fetch_add(1, Ordering::SeqCst);
    assert_eq!(
        headers.get("authorization").and_then(|v| v.to_str().ok()),
        Some("Bearer fixture-private-token")
    );
    match p.phase.load(Ordering::SeqCst) {
        0 => Json(json!({"data":[{"user_login":"GABE_MAXXING","type":"live","id":"one"}]}))
            .into_response(),
        1 => Json(json!({"data":[]})).into_response(),
        2 => StatusCode::UNAUTHORIZED.into_response(),
        _ => Json(json!({"data":"invalid"})).into_response(),
    }
}
#[tokio::test]
async fn status_cache_coalesces_and_never_exposes_token() -> Result<(), Error> {
    let p = Provider::default();
    let app = Router::new()
        .route("/token", post(token))
        .route("/streams", get(streams))
        .with_state(p.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    let server = tokio::spawn(async move { axum::serve(listener, app).await });
    let mut reader = StatusReader::new(json!("auto"), "test".into());
    reader.token_url = format!("http://{address}/token");
    reader.streams_url = format!("http://{address}/streams");
    let settings = Settings::new(
        [
            ("TWITCH_CLIENT_ID".into(), "test-id".into()),
            ("TWITCH_CLIENT_SECRET".into(), "test-secret".into()),
        ]
        .into(),
    );
    let client = reqwest::Client::new();
    let (a, b, c) = tokio::join!(
        reader.read(&settings, &client, 0),
        reader.read(&settings, &client, 0),
        reader.read(&settings, &client, 0)
    );
    assert_eq!(a, b);
    assert_eq!(b, c);
    assert!(a.live);
    assert_eq!(a.session, "twitch-one");
    assert_eq!(p.calls.load(Ordering::SeqCst), 2);
    assert!(!serde_json::to_string(&a)?.contains("fixture-private-token"));
    p.phase.store(1, Ordering::SeqCst);
    assert!(reader.read(&settings, &client, 59_999).await.live);
    assert!(!reader.read(&settings, &client, 60_000).await.live);
    assert_eq!(p.calls.load(Ordering::SeqCst), 3);
    p.phase.store(2, Ordering::SeqCst);
    assert_eq!(
        reader.read(&settings, &client, 120_000).await.source,
        "fallback"
    );
    p.phase.store(0, Ordering::SeqCst);
    assert!(reader.read(&settings, &client, 180_000).await.live);
    assert_eq!(
        p.calls.load(Ordering::SeqCst),
        6,
        "401 discards cached token"
    );
    p.phase.store(3, Ordering::SeqCst);
    assert_eq!(
        reader.read(&settings, &client, 240_000).await.source,
        "fallback"
    );
    server.abort();
    Ok(())
}
#[tokio::test]
async fn absent_credentials_and_manual_modes_do_not_call_twitch() {
    let settings = Settings::new(Default::default());
    let client = reqwest::Client::new();
    for mode in [json!(false), json!(true), json!("auto")] {
        let reader = StatusReader::new(mode.clone(), "test".into());
        let result = reader.read(&settings, &client, 0).await;
        assert_eq!(result.live, mode == true);
        assert_eq!(result.source, "manual");
    }
}
#[test]
fn live_mode_honors_deadline_and_only_known_overrides() -> Result<(), Error> {
    let config = Config::embedded()?;
    let end = chrono::DateTime::parse_from_rfc3339(&config.until)?.timestamp_millis();
    assert_eq!(config.hack_mode(None, end - 1)["enabled"], true);
    assert_eq!(config.hack_mode(None, end)["enabled"], false);
    assert_eq!(config.hack_mode(Some("on"), end + 1)["enabled"], true);
    assert_eq!(config.hack_mode(Some("off"), end - 1)["enabled"], false);
    assert_eq!(config.hack_mode(Some("ON"), end)["mode"], "auto");
    for slug in [
        "//evil.example",
        "__proto__",
        "Twitch",
        "",
        "instagram/../x",
    ] {
        assert_eq!(destination(slug), None);
    }
    Ok(())
}
