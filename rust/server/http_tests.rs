use crate::{app_with, config::Settings};
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;

#[tokio::test]
async fn default_deployment_cannot_activate_handlers() -> Result<(), crate::Error> {
    let app = app_with(Settings::new(Default::default()))?;
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/rust?module=auth")
                .body(Body::empty())?,
        )
        .await?;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rust?module=health")
                .body(Body::empty())?,
        )
        .await?;
    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rust?module=auth")
                .body(Body::from(vec![0; 1024 * 1024 + 1]))?,
        )
        .await?;
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    Ok(())
}
#[tokio::test]
async fn enabled_preview_still_cannot_write_remote_data() -> Result<(), crate::Error> {
    let settings = Settings::new(
        [
            ("CORVUS_RUST_MODULES".into(), "auth".into()),
            ("CORVUS_RUST_WRITES".into(), "isolated".into()),
            ("REDIS_URL".into(), "rediss://example.invalid/1".into()),
        ]
        .into(),
    );
    let app = app_with(settings)?;
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rust?module=auth")
                .header("origin", "https://corvus.gent")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"action":"request","email":"fixture@corvus.gent"}"#,
                ))?,
        )
        .await?;
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert!(response.headers().get("set-cookie").is_none());
    Ok(())
}
