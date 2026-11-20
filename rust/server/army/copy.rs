use serde_json::Value;
use std::sync::OnceLock;
pub fn copy(feature: &str, lang: &str) -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    let data = DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../../migration/army-locales.json"))
            .unwrap_or(Value::Null)
    });
    &data[feature][if corvus_core::army::includes("LANGUAGES", &serde_json::json!(lang)) {
        lang
    } else {
        "en"
    }]
}
pub fn fill(text: &str, values: &Value) -> Result<String, crate::Error> {
    Ok(regex::Regex::new(r"\{([A-Za-z0-9_]+)\}")?
        .replace_all(text, |c: &regex::Captures<'_>| {
            if values[&c[1]].is_null() {
                String::new()
            } else {
                corvus_core::impact::string(&values[&c[1]])
            }
        })
        .into_owned())
}
