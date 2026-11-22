//! Local-only source classification. Never persist a raw user-agent or referrer URL.
use serde_json::{Value, json};
pub fn inferred(search: &str, user_agent: &str, referrer: &str) -> Value {
    let utm = url::form_urlencoded::parse(search.trim_start_matches('?').as_bytes())
        .find(|(k, _)| k == "utm_source")
        .map(|(_, v)| v.into_owned())
        .unwrap_or_default();
    if !utm.is_empty() {
        let value = utm.to_lowercase();
        let known = [
            "direct",
            "corvus",
            "linkedin",
            "instagram",
            "tiktok",
            "facebook",
            "youtube",
            "threads",
            "discord",
            "x",
            "luma",
            "whatsapp",
            "email",
            "qr",
            "buymeacoffee",
            "share",
            "self",
            "google",
            "bing",
            "duckduckgo",
            "hostel",
            "video",
            "offline",
            "compound",
            "dm",
            "other",
        ]
        .contains(&value.as_str());
        return json!({"source":if known{value.as_str()}else{"other"},"source_confidence":"utm"});
    }
    let ua = user_agent.to_ascii_lowercase();
    for (patterns, source) in [
        (&["instagram"][..], "instagram"),
        (&["fban", "fbav"][..], "facebook"),
        (&["linkedinapp"][..], "linkedin"),
        (&["tiktok", "musical_ly", "bytedancewebview"][..], "tiktok"),
        (&["twitter"][..], "x"),
    ] {
        if patterns.iter().any(|p| ua.contains(p)) {
            return json!({"source":source,"source_confidence":"user_agent"});
        }
    }
    let input = if referrer.contains("://") {
        referrer.into()
    } else {
        format!("https://{referrer}")
    };
    let host = url::Url::parse(&input)
        .ok()
        .and_then(|u| u.host_str().map(str::to_lowercase))
        .unwrap_or_default();
    for (domain, source) in [
        ("lnkd.in", "linkedin"),
        ("linkedin.com", "linkedin"),
        ("instagram.com", "instagram"),
        ("t.co", "x"),
        ("x.com", "x"),
        ("facebook.com", "facebook"),
        ("tiktok.com", "tiktok"),
    ] {
        if host == domain || host.ends_with(&format!(".{domain}")) {
            return json!({"source":source,"source_confidence":"referrer"});
        }
    }
    json!({"source":"direct","source_confidence":"unknown"})
}
