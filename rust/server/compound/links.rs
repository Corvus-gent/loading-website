use corvus_core::army::truthy;
use serde_json::{Value, json};
use std::sync::LazyLock;
static LINKS: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../migration/compound-links.json")).unwrap_or(Value::Null)
});
pub fn spec(slug: &str) -> Option<&'static Value> {
    LINKS.get(slug)
}
pub fn destination(slug: &str, content: &Value, incoming: &Value) -> Option<String> {
    let spec = spec(slug)?;
    let mut p = serde_json::Map::new();
    for (k, v) in incoming.as_object().into_iter().flatten() {
        if !["compound", "slug", "c"].contains(&k.as_str()) && v.is_string() {
            p.insert(k.clone(), v.clone());
        }
    }
    for (k, v) in [
        ("utm_source", spec[0].clone()),
        ("utm_medium", spec[1].clone()),
        ("utm_campaign", json!("compound-1000")),
        ("utm_term", json!(slug)),
    ] {
        p.insert(k.into(), v);
    }
    let c = if truthy(content) { content } else { &spec[2] };
    let c = if truthy(c) {
        corvus_core::impact::string(c)
    } else {
        String::new()
    };
    // URLSearchParams converts a truncated UTF-16 string to a Unicode scalar string.
    let c = String::from_utf16_lossy(&c.encode_utf16().take(64).collect::<Vec<_>>());
    if !c.is_empty() {
        p.insert("utm_content".into(), json!(c));
    }
    let mut query = url::form_urlencoded::Serializer::new(String::new());
    for (k, v) in &p {
        query.append_pair(k, v.as_str().unwrap_or(""));
    }
    Some(format!("/compound?{}", query.finish()))
}
