//! Social-card selection and metadata; same public records and canonical URLs as the existing renderer.
use crate::{AppState, Error, compound_v2::store::Registry, interviews::store::Interviews};
use corvus_core::{army::truthy, army_art::escape, videos};
use serde_json::{Value, json};
use std::time::Duration;
use url::Url;
const ROOT: &str = "https://corvus.gent";
pub const DEADLINE: i64 = 1794243600000;
fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
pub fn countdown(now: i64) -> String {
    let minutes = (((DEADLINE - now) as f64 / 60000.0).ceil() as i64).max(0);
    if minutes > 0 {
        format!(
            "{}d {}h {}m left",
            minutes / 1440,
            (minutes / 60) % 24,
            minutes % 60
        )
    } else {
        "challenge ended".into()
    }
}
pub fn interview_card(row: &Value) -> Value {
    let n = &row["n"];
    let b = text(row, "builder");
    let p = text(row, "project");
    let line = text(row, "description");
    let mut v = json!({"kind":"interview","n":n,"kicker":format!("HACKATHON 003 / INTERVIEW {n}"),"title":p,"builder":b,"line":line,"description":format!("{b} built {p}. {line}"),"photo":text(row,"photo_url"),"url":format!("{ROOT}/hack/3?interview={n}"),"metaTitle":format!("Interview #{n}: {b} built {p}"),"lang":"en"});
    if let Some(at) = row.get("updated_at") {
        v["updated"] = at.clone();
    }
    v
}
fn languages() -> Value {
    serde_json::from_str::<Value>(include_str!("../../migration/compound-v2-config.json"))
        .unwrap_or(Value::Null)["languages"]
        .clone()
}
fn positive(n: &str) -> bool {
    !n.is_empty() && n.len() <= 4 && !n.starts_with('0') && n.bytes().all(|b| b.is_ascii_digit())
}
pub fn validate(q: &Value) -> bool {
    match text(q, "kind") {
        "live" | "hack3" => true,
        "interview" => positive(text(q, "n")),
        "compound" => {
            let l = if truthy(&q["lang"]) {
                text(q, "lang")
            } else {
                "en"
            };
            let h = text(q, "hook");
            let n = text(q, "n");
            languages().get(l).is_some()
                && (h.is_empty() || videos::HOOKS.contains(&h))
                && (n.is_empty() || (!h.is_empty() && positive(n)))
        }
        _ => false,
    }
}
pub fn resolve_data(q: &Value, rows: &[Value], video: Option<&Value>) -> Result<Value, Error> {
    if !validate(q) {
        return Err("not_found".into());
    }
    match text(q, "kind") {
        "live" => Ok(
            json!({"kind":"live","kicker":"ONE-MAN ARMY. MANY EDITORS.","title":"LIVE from a robotics hackathon in SF","metaTitle":"🔴 LIVE from a robotics hackathon in SF","line":"24-hour content streak. Watch with Gabe.","description":"One-man army. Many editors. Livestreaming the builders and their robots in San Francisco.","photo":"gabe","url":format!("{ROOT}/live"),"lang":"en"}),
        ),
        "interview" => rows
            .first()
            .map(interview_card)
            .ok_or_else(|| "not_found".into()),
        "hack3" => Ok(if let Some(row) = rows.first() {
            let mut card = interview_card(row);
            card["url"] = json!(format!("{ROOT}/hack/3"));
            card["kind"] = json!("hack3");
            card
        } else {
            json!({"kind":"hack3","kicker":"HACKATHON 003 / SAN FRANCISCO","title":"Meet the robots.","metaTitle":"Hack #3: Robotics hackathon, SF","line":"Builders. Their robots. Their stories.","description":"Meet the builders and their robots. Interviews from a robotics hackathon in San Francisco.","photo":"gabe","url":format!("{ROOT}/hack/3"),"lang":"en"})
        }),
        _ => {
            let lang = if text(q, "lang").is_empty() {
                "en"
            } else {
                text(q, "lang")
            };
            let hook = text(q, "hook");
            let n = text(q, "n");
            let candidate = videos::parse_slug(text(q, "video"));
            let code = if !n.is_empty() {
                format!("{lang}-{hook}-{n}").to_uppercase()
            } else if !hook.is_empty() {
                format!("{lang}-{hook}").to_uppercase()
            } else if truthy(&q["lang"]) {
                lang.to_uppercase()
            } else {
                "$1,000".into()
            };
            let mut url = Url::parse(&format!(
                "{ROOT}/compound/v2{}{}{}",
                if truthy(&q["lang"]) {
                    format!("/{lang}")
                } else {
                    String::new()
                },
                if hook.is_empty() {
                    String::new()
                } else {
                    format!("/{hook}")
                },
                if n.is_empty() {
                    String::new()
                } else {
                    format!("/{n}")
                }
            ))?;
            if let Some(c) = candidate
                && video.is_some_and(|v| v["slug"] == c.slug)
            {
                url.query_pairs_mut().append_pair("video", &c.slug);
            }
            let langs = languages();
            let line = video
                .map(|v| text(v, "hook_line"))
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| langs[lang][1].as_str().unwrap_or(""));
            let mut v = json!({"kind":"compound","code":code,"title":code,"metaTitle":format!("{code} · vote the next cut · Corvus"),"kicker":"ONE-MAN ARMY. MANY EDITORS.","line":line,"description":format!("{line} Vote the next cut. $1,000 on the line. Deadline: Mon 9 Nov 2026, 09:00 PT."),"lang":lang,"url":url.as_str(),"video":video.map(|v|text(v,"slug")).unwrap_or(""),"isHub":!truthy(&q["lang"]),"deadline":"2026-11-09T17:00:00Z"});
            if let Some(at) = video.and_then(|v| v.get("updated_at")) {
                v["updated"] = at.clone();
            }
            Ok(v)
        }
    }
}
pub async fn resolve(state: &AppState, q: &Value) -> Result<Value, Error> {
    if !validate(q) {
        return Err("not_found".into());
    }
    let limit = Duration::from_millis(2200);
    match text(q, "kind") {
        "interview" => {
            let row = tokio::time::timeout(limit, Interviews(state).get(&q["n"])).await??;
            resolve_data(q, &row.into_iter().collect::<Vec<_>>(), None)
        }
        "hack3" => {
            let rows = tokio::time::timeout(limit, Interviews(state).list())
                .await
                .ok()
                .and_then(Result::ok)
                .unwrap_or_default();
            resolve_data(q, &rows, None)
        }
        "compound" if !text(q, "n").is_empty() => {
            let candidate = videos::parse_slug(text(q, "video"));
            let lang = if text(q, "lang").is_empty() {
                "en"
            } else {
                text(q, "lang")
            };
            let hook = text(q, "hook");
            let n = text(q, "n").parse::<u64>().unwrap_or(0);
            let registry = Registry(state);
            let found = if let Some(c) =
                candidate.filter(|c| c.lang == lang && c.hook == hook && u64::from(c.n) == n)
            {
                tokio::time::timeout(limit, registry.get(&c.slug))
                    .await
                    .ok()
                    .and_then(Result::ok)
                    .flatten()
            } else {
                tokio::time::timeout(limit, registry.videos())
                    .await
                    .ok()
                    .and_then(Result::ok)
                    .and_then(|v| {
                        v.into_iter().find(|r| {
                            r["lang"] == lang && r["hook"] == hook && r["n"].as_u64() == Some(n)
                        })
                    })
            };
            resolve_data(q, &[], found.as_ref())
        }
        _ => resolve_data(q, &[], None),
    }
}
pub fn image_url(card: &Value) -> Result<String, Error> {
    let mut u = Url::parse(&format!("{ROOT}/api/og"))?;
    u.query_pairs_mut().append_pair("kind", text(card, "kind"));
    if card["kind"] == "interview" {
        u.query_pairs_mut()
            .append_pair("n", &corvus_core::impact::string(&card["n"]));
    }
    if card["kind"] == "compound" {
        let page = Url::parse(text(card, "url"))?;
        let parts = page.path().split('/').skip(3).collect::<Vec<_>>();
        for (i, k) in ["lang", "hook", "n"].iter().enumerate() {
            if let Some(v) = parts.get(i).filter(|v| !v.is_empty()) {
                u.query_pairs_mut().append_pair(k, v);
            }
        }
        if !text(card, "video").is_empty() {
            u.query_pairs_mut()
                .append_pair("video", text(card, "video"));
        }
    }
    u.query_pairs_mut().append_pair("v", "20261109og1");
    if truthy(&card["updated"]) {
        let at = corvus_core::impact::timestamp(&card["updated"])
            .map(|t| t.to_string())
            .unwrap_or_else(|| "NaN".into());
        u.query_pairs_mut().append_pair("updated", &at);
    }
    Ok(u.into())
}
pub fn metadata(html: &str, card: &Value) -> Result<String, Error> {
    let title = if text(card, "metaTitle").is_empty() {
        text(card, "title")
    } else {
        text(card, "metaTitle")
    };
    let image = image_url(card)?;
    let alt = format!("{title} — {}", text(card, "line"));
    let tags = [
        ("description", text(card, "description")),
        ("og:type", "website"),
        ("og:title", title),
        ("og:description", text(card, "description")),
        ("og:url", text(card, "url")),
        ("og:image", &image),
        ("og:image:secure_url", &image),
        ("og:image:type", "image/png"),
        ("og:image:width", "1200"),
        ("og:image:height", "630"),
        ("og:image:alt", &alt),
        ("twitter:card", "summary_large_image"),
        ("twitter:title", title),
        ("twitter:description", text(card, "description")),
        ("twitter:image", &image),
        ("twitter:image:alt", &alt),
    ];
    let title = format!("<title>{}</title>", escape(title));
    let mut html = regex::Regex::new(r"<title>[^<]*</title>")?
        .replacen(html, 1, regex::NoExpand(&title))
        .into_owned();
    html = regex::Regex::new(r#"(?i)<link\b[^>]*rel="canonical"[^>]*>"#)?
        .replace_all(&html, "")
        .into_owned();
    let mut head = String::new();
    for (k, v) in tags {
        html = regex::Regex::new(&format!(
            r#"(?i)<meta\b[^>]*(?:property|name)="{}"[^>]*>"#,
            regex::escape(k)
        ))?
        .replace_all(&html, "")
        .into_owned();
        head.push_str(&format!(
            "<meta {}=\"{k}\" content=\"{}\">",
            if k.starts_with("og:") {
                "property"
            } else {
                "name"
            },
            escape(v)
        ));
    }
    head.push_str(&format!(
        "<link rel=\"canonical\" href=\"{}\">",
        escape(text(card, "url"))
    ));
    Ok(html.replacen("</head>", &format!("{head}</head>"), 1))
}
