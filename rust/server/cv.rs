//! Public PDF delivery is independent of best-effort analytics availability.
use crate::AppState;
use axum::{
    body::Body,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use std::{collections::HashMap, time::Duration};
fn bot(agent: &str) -> bool {
    let agent = agent.to_ascii_lowercase();
    [
        "bot",
        "crawl",
        "spider",
        "preview",
        "slurp",
        "facebookexternalhit",
        "linkedinbot",
        "whatsapp",
        "telegram",
        "discord",
        "curl",
        "wget",
    ]
    .iter()
    .any(|s| agent.contains(s))
}
const PDF: &[u8] = include_bytes!("../../cv/gabe.pdf");
fn counters(download: bool, now: i64) -> Vec<Vec<String>> {
    let kind = if download { "download" } else { "open" };
    let key = format!("cv:{kind}");
    vec![
        vec!["INCR".into(), key.clone()],
        vec![
            "INCR".into(),
            format!("{key}:{}", crate::visitors::day(now)),
        ],
    ]
}
pub fn handle(
    state: &AppState,
    method: &Method,
    headers: &HeaderMap,
    query: &HashMap<String, String>,
    context: Option<&vercel_runtime::AppState>,
) -> Response {
    if *method != Method::GET && *method != Method::HEAD {
        return (StatusCode::METHOD_NOT_ALLOWED, [("allow", "GET, HEAD")]).into_response();
    }
    let download = query.get("dl").is_some_and(|v| v == "1");
    if *method == Method::GET
        && state.store.connected()
        && state.settings.write_enabled()
        && !bot(headers
            .get("user-agent")
            .and_then(|v| v.to_str().ok())
            .unwrap_or(""))
    {
        let store = state.store.clone();
        let commands = counters(download, chrono::Utc::now().timestamp_millis());
        let work = async move {
            let _ = tokio::time::timeout(Duration::from_secs(5), store.pipeline(commands)).await;
        };
        if let Some(context) = context {
            context.wait_until(work);
        } else {
            // The native service remains alive after the response, unlike serverless requests.
            // Do not reuse the generic awaited fallback: a stalled counter must not stall a PDF.
            tokio::spawn(work);
        }
    }
    let disposition = format!(
        "{}; filename=\"Gabriel-Van-Langenhove-Technical-CV.pdf\"",
        if download { "attachment" } else { "inline" }
    );
    let mut response = Response::new(if *method == Method::HEAD {
        Body::empty()
    } else {
        Body::from(PDF)
    });
    for (name, value) in [
        ("content-type", "application/pdf".into()),
        ("content-length", PDF.len().to_string()),
        ("content-disposition", disposition),
        ("cache-control", "no-store".into()),
    ] {
        if let Ok(value) = value.parse() {
            response.headers_mut().insert(name, value);
        }
    }
    response
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn counters_follow_brussels_midnight_and_bot_contract() -> Result<(), crate::Error> {
        let at = chrono::DateTime::parse_from_rfc3339("2026-11-20T23:30:00Z")?.timestamp_millis();
        assert_eq!(
            counters(true, at),
            vec![
                vec!["INCR", "cv:download"],
                vec!["INCR", "cv:download:2026-11-21"]
            ]
        );
        assert_eq!(counters(false, at)[0], vec!["INCR", "cv:open"]);
        for agent in ["LinkedInBot", "curl/8", "preview", "TelegramBot"] {
            assert!(bot(agent));
        }
        assert!(!bot("Human browser"));
        assert!(PDF.starts_with(b"%PDF-"));
        Ok(())
    }
}
