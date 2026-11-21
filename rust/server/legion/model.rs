use crate::Error;
use corvus_core::{
    army::truthy,
    impact::{string, trimmed},
};
use regex::Regex;
use serde_json::{Value, json};
use std::sync::LazyLock;
use unicode_normalization::UnicodeNormalization;
use url::Url;
static CONFIG: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../migration/legion-config.json")).unwrap_or(Value::Null)
});
pub fn config() -> &'static Value {
    &CONFIG
}
pub fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
fn or_empty(v: &Value) -> Value {
    if truthy(v) { v.clone() } else { json!("") }
}
pub fn clean(v: &Value, max: usize) -> String {
    let Some(v) = v.as_str() else {
        return String::new();
    };
    let mut units = 0;
    trimmed(v)
        .chars()
        .map(|c| {
            if c <= '\u{1f}' || c == '\u{7f}' {
                ' '
            } else {
                c
            }
        })
        .take_while(|c| {
            units += c.len_utf16();
            units <= max
        })
        .collect()
}
pub fn plain(v: &Value, max: usize) -> Result<String, Error> {
    let v = v.as_str().ok_or("plain_text")?;
    if v.encode_utf16().count() > max || Regex::new(r"(?i)</?[a-z][^>]*>")?.is_match(v) {
        return Err("plain_text".into());
    }
    Ok(trimmed(v)
        .chars()
        .filter(|&c| !matches!(c,'\u{0}'..='\u{8}'|'\u{b}'|'\u{c}'|'\u{e}'..='\u{1f}'|'\u{7f}'))
        .collect())
}
pub fn https(v: &Value) -> Result<String, Error> {
    let raw = v
        .as_str()
        .filter(|s| s.encode_utf16().count() <= 1500)
        .ok_or("url")?;
    let u = Url::parse(raw).map_err(|_| "url")?;
    if u.scheme() != "https"
        || !u.username().is_empty()
        || u.password().is_some()
        || u.port().is_some()
    {
        return Err("url".into());
    }
    Ok(u.into())
}
pub fn valid_slug(v: &Value) -> bool {
    v.as_str().is_some_and(|s| {
        s.len() <= 70
            && !s.is_empty()
            && !s.starts_with('-')
            && !s.ends_with('-')
            && !s.contains("--")
            && s.bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
    })
}
pub fn content(raw: &Value) -> Result<Value, Error> {
    if !raw.is_object() {
        return Err("fields".into());
    }
    let headline = plain(&or_empty(&raw["headline"]), 80)?;
    let bio = plain(&or_empty(&raw["bio"]), 400)?;
    if headline.is_empty() {
        return Err("headline".into());
    }
    let list = raw["links"]
        .as_array()
        .filter(|a| a.len() <= 4)
        .ok_or("links")?;
    let mut links = vec![];
    for item in list {
        let label = plain(&or_empty(&item["label"]), 50)?;
        let url = https(&item["url"])?;
        if label.is_empty() {
            return Err("links".into());
        }
        links.push(json!({"label":label,"url":url}));
    }
    let highlight = json!({"title":plain(&or_empty(&raw["highlight"]["title"]),80)?,"text":plain(&or_empty(&raw["highlight"]["text"]),800)?,"image":string(&or_empty(&raw["highlight"]["image"]))});
    let cta = if truthy(&raw["cta"]["label"]) || truthy(&raw["cta"]["url"]) {
        let label = plain(&or_empty(&raw["cta"]["label"]), 50)?;
        let url = https(&raw["cta"]["url"])?;
        if label.is_empty() {
            return Err("links".into());
        }
        json!({"label":label,"url":url})
    } else {
        json!({"label":"","url":""})
    };
    Ok(
        json!({"headline":headline,"bio":bio,"links":links,"highlight":highlight,"cta":cta,"photo":string(&or_empty(&raw["photo"]))}),
    )
}
pub fn stored_content(c: &Value) -> Value {
    let mut c = if c.is_object() { c.clone() } else { json!({}) };
    if !c["links"].is_array() {
        c["links"] = json!([]);
    }
    c
}
pub fn public_profile(p: &Value) -> Value {
    let mut out = json!({});
    for k in [
        "slug",
        "name",
        "title",
        "rank",
        "revision",
        "published_at",
        "last_edited_at",
        "last_edited_by",
    ] {
        if let Some(v) = p.get(k) {
            out[k] = v.clone();
        }
    }
    out["content"] = stored_content(&p["content"]);
    out
}
pub fn reservation(b: &Value, at: &str) -> Result<Value, Error> {
    let slug = if truthy(&b["spotlight_slug"]) {
        b["spotlight_slug"].clone()
    } else {
        let source = clean(&b["name"], 80)
            .to_lowercase()
            .nfkd()
            .collect::<String>();
        json!(
            Regex::new("[^a-z0-9]+")?
                .replace_all(&source, "-")
                .trim_matches('-')
        )
    };
    if !valid_slug(&slug) {
        return Err("slug".into());
    }
    let title = plain(&or_empty(&b["title"]), 80)?;
    if title.is_empty() {
        return Err("title".into());
    }
    let default = if slug == config()["simon"]["slug"] {
        config()["simon"]["content"].clone()
    } else {
        json!({"photo":"","headline":if truthy(&b["headline"]){b["headline"].clone()}else{json!("A friend of the Legion")},"bio":"","links":[],"highlight":{"title":"","text":"","image":""},"cta":{"label":"","url":""}})
    };
    let profile = content(if truthy(&b["spotlight"]) {
        &b["spotlight"]
    } else {
        &default
    })?;
    let name = clean(&b["name"], 80);
    if name.is_empty() {
        return Err("name".into());
    }
    Ok(
        json!({"slug":slug,"name":name,"title":title,"rank":"senator","status":"pending","created_at":at,"content":profile,"revision":0,"edit_hash":null,"locked":false,"last_edited_by":null}),
    )
}
pub fn member(u: &Value) -> bool {
    truthy(&u["legion"])
        || u["status"] == "approved"
        || truthy(&u["verifiedAt"])
            && truthy(&u["membership"])
            && u["membership"]["state"] != "refunded"
}
pub fn member_row(u: &Value) -> Option<Value> {
    if u["status"] == "deleting" || !member(u) {
        return None;
    }
    let pick = |a: &Value, b: &Value, c: Value| {
        if truthy(a) {
            a.clone()
        } else if truthy(b) {
            b.clone()
        } else {
            c
        }
    };
    let mut row = json!({"name":pick(&u["legion"]["name"],&u["username"],json!("anonymous soldier")),"handle":or_empty(&u["username"]),"email":or_empty(&u["email"]),"rank":corvus_core::army::rank(u),"source":if truthy(&u["legion"]["source"]){u["legion"]["source"].clone()}else{json!(if truthy(&u["membership"]){"paid"}else{"application"})},"hidden":truthy(&u["hidden"]),"legacy":!truthy(&u["legion"]),"honorary":u["legion"]["type"]=="honorary","title":or_empty(&u["legion"]["title"]),"spotlight_slug":or_empty(&u["legion"]["spotlight_slug"])});
    if let Some(id) = u.get("id") {
        row["id"] = id.clone();
    }
    for field in [
        &u["legion"]["joined_at"],
        &u["approvedAt"],
        &u["verifiedAt"],
        &u["created"],
    ] {
        if truthy(field) {
            row["joined_at"] = field.clone();
            break;
        }
    }
    Some(row)
}
pub fn csv_cell(v: Option<&Value>) -> String {
    let s = v.filter(|v| !v.is_null()).map(string).unwrap_or_default();
    format!(
        "\"{}{}\"",
        if s.starts_with(['=', '+', '-', '@', '\t', '\r']) {
            "'"
        } else {
            ""
        },
        s.replace('"', "\"\"")
    )
}
