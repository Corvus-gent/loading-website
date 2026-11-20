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

#[tokio::test]
async fn public_referrals_survive_missing_storage_without_fabricating_counts()
-> Result<(), crate::Error> {
    use http_body_util::BodyExt;
    let app = app_with(Settings::new(
        [("CORVUS_RUST_MODULES".into(), "plethora,live".into())].into(),
    ))?;
    for module in ["plethora", "live"] {
        let slug = if module == "plethora" {
            "plethora-home"
        } else {
            "twitch"
        };
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/rust?module={module}&slug={slug}"))
                    .body(Body::empty())?,
            )
            .await?;
        assert_eq!(response.status(), StatusCode::FOUND);
        assert!(response.headers().get("location").is_some());
    }
    for (action, status) in [
        ("stats", StatusCode::OK),
        ("csv", StatusCode::SERVICE_UNAVAILABLE),
    ] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/rust?module=plethora&action={action}"))
                    .body(Body::empty())?,
            )
            .await?;
        assert_eq!(response.status(), status);
        let data: serde_json::Value =
            serde_json::from_slice(&response.into_body().collect().await?.to_bytes())?;
        assert_eq!(data["ready"], false);
        assert!(data.get("total").is_none());
    }
    Ok(())
}

#[tokio::test]
async fn compound_preview_redirects_without_tracking_or_provider_io() -> Result<(), crate::Error> {
    let app = app_with(Settings::new(
        [
            (
                "CORVUS_RUST_MODULES".into(),
                "compound-v2,compound-summary".into(),
            ),
            ("ORIANE_API_KEY".into(), "fixture-must-not-be-used".into()),
            ("REDIS_URL".into(), "rediss://example.invalid/1".into()),
        ]
        .into(),
    ))?;
    let redirect = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/rust?module=compound-v2&short=1&slug=tt-gl-nl-mom1&utm_source=whatsapp")
                .header("user-agent", "ordinary-browser")
                .body(Body::empty())?,
        )
        .await?;
    assert_eq!(redirect.status(), StatusCode::FOUND);
    assert!(
        redirect.headers()["location"]
            .to_str()?
            .contains("utm_source=whatsapp")
    );
    assert!(redirect.headers().get("set-cookie").is_none());
    let vote = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/rust?module=compound-v2")
                .header("origin", "https://corvus.gent")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"action":"vote","slug":"tt-gl-nl-mom1","choice":"up"}"#,
                ))?,
        )
        .await?;
    assert_eq!(vote.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert!(vote.headers().get("set-cookie").is_none());
    Ok(())
}
