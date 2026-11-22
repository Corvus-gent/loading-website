//! Exact allowlists for cookieless analytics. Never spread caller-provided properties.
use crate::{army::truthy, impact::string};
use regex::Regex;
use serde_json::{Map, Value, json};
use std::sync::LazyLock;
static CONFIG: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../migration/analytics-policy.json"))
        .expect("checked analytics policy")
});
pub fn config() -> &'static Value {
    &CONFIG
}
fn list(key: &str) -> &'static [Value] {
    CONFIG[key].as_array().map(Vec::as_slice).unwrap_or(&[])
}
fn has(key: &str, v: &Value) -> bool {
    list(key).contains(v)
}
fn re(pattern: &'static str, s: &str) -> bool {
    static PATTERNS: LazyLock<std::sync::Mutex<std::collections::HashMap<&'static str, Regex>>> =
        LazyLock::new(|| std::sync::Mutex::new(std::collections::HashMap::new()));
    let Ok(mut patterns) = PATTERNS.lock() else {
        return false;
    };
    patterns
        .entry(pattern)
        .or_insert_with(|| Regex::new(pattern).expect("static policy expression"))
        .is_match(s)
}
fn field<'a>(v: &'a Value, key: &str) -> &'a str {
    v[key].as_str().unwrap_or("")
}
fn cat(v: &Value, values: &[Value], fallback: &str) -> Value {
    if values.contains(v) {
        v.clone()
    } else {
        json!(fallback)
    }
}
fn strs(v: &Value, values: &[&str], fallback: &str) -> Value {
    v.as_str()
        .filter(|s| values.contains(s))
        .map(|s| json!(s))
        .unwrap_or(json!(fallback))
}
fn category(v: &Value, key: &str, fallback: &str) -> Value {
    cat(v, list(key), fallback)
}
pub fn source(v: &Value) -> Value {
    category(v, "SOURCES", "other")
}
pub fn campaign(v: &Value) -> Value {
    if v.as_str()
        .is_some_and(|s| re(r"^(corvus|pidgy)-(bio|402|402-post)$", s))
    {
        v.clone()
    } else {
        category(v, "CAMPAIGNS", "other")
    }
}
pub fn campaign_slug(v: &Value) -> String {
    let s = if truthy(v) { string(v) } else { String::new() };
    let s = s.strip_prefix("gabe-").unwrap_or(&s);
    if s.len() <= 64 && re(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", s) {
        s.into()
    } else {
        String::new()
    }
}
pub fn slot(v: &Value) -> String {
    let s = if truthy(v) { string(v) } else { String::new() };
    let Some((prefix, hour)) = s.split_once('-') else {
        return String::new();
    };
    if ["eu", "sf"].contains(&prefix)
        && (1..=2).contains(&hour.len())
        && hour.bytes().all(|b| b.is_ascii_digit())
        && let Ok(n) = hour.parse::<u8>()
        && n < 24
    {
        return format!("{prefix}-{n}");
    }
    String::new()
}
pub fn path(v: &Value) -> String {
    let Some(s) = v.as_str() else {
        return "/other/".into();
    };
    let s = s
        .split(['?', '#'])
        .next()
        .unwrap_or("")
        .trim_end_matches('/')
        .to_owned()
        + "/";
    if re(r"^/hack/[1-9][0-9]{0,3}/(?:the-feed/)?$", &s) || s == "/compound/" {
        return s;
    }
    if s.starts_with("/links/") {
        let who = s.split('/').nth(2).unwrap_or("");
        return format!(
            "/links/{}/",
            if ["corvus", "pidgy"].contains(&who) {
                who
            } else {
                "gabe"
            }
        );
    }
    if s.starts_with("/go/") {
        return "/go/".into();
    }
    if s.starts_with("/clients/aurus/") {
        return "/clients/aurus/".into();
    }
    if has("ROUTES", &json!(s)) {
        s
    } else {
        "/other/".into()
    }
}
pub fn host(v: &Value) -> Value {
    if has("HOSTS", v) || has("EXTERNAL", v) {
        v.clone()
    } else {
        json!("other")
    }
}
pub fn safe_url(v: Option<&Value>, base: &str) -> String {
    let s = v.map(string).unwrap_or("undefined".into());
    let u = url::Url::parse(base).and_then(|b| b.join(&s));
    let Ok(u) = u else { return String::new() };
    if !["https", "http"].contains(&u.scheme()) {
        return String::new();
    }
    let h = u.host_str().unwrap_or("");
    if has("HOSTS", &json!(h)) {
        return format!("https://{h}{}", path(&json!(u.path())));
    }
    if !has("EXTERNAL", &json!(h)) {
        return String::new();
    }
    format!(
        "https://{h}{}",
        if h == "app.pidgy-ai.com" && u.path() == "/book/gabe-maxxer/hi-there" {
            u.path()
        } else {
            "/"
        }
    )
}
pub fn referrer(v: &Value) -> Value {
    if !truthy(v) || v == "$direct" {
        return json!("direct");
    }
    let h = string(v).to_lowercase();
    if h == "lnkd.in" {
        return json!("linkedin");
    }
    if h == "t.co" {
        return json!("x");
    }
    for (d, s) in [
        ("instagram.com", "instagram"),
        ("linkedin.com", "linkedin"),
        ("tiktok.com", "tiktok"),
        ("facebook.com", "facebook"),
        ("discord.com", "discord"),
        ("twitter.com", "x"),
        ("x.com", "x"),
        ("google.com", "google"),
        ("bing.com", "bing"),
        ("duckduckgo.com", "duckduckgo"),
        ("buymeacoffee.com", "buymeacoffee"),
        ("corvus.gent", "corvus"),
    ] {
        if h == d || h.ends_with(&format!(".{d}")) {
            return json!(s);
        }
    }
    source(&json!(h))
}
pub fn country(v: &Value) -> Value {
    v.as_str()
        .and_then(|s| CONFIG["countries"].get(s))
        .cloned()
        .unwrap_or(json!("?"))
}
pub fn sidequest(v: &Value) -> Map<String, Value> {
    let mut out = Map::new();
    if v["utm_campaign"] != "corvus_softlaunch" || !truthy(&v["utm_source"]) {
        return out;
    }
    out.insert("utm_source".into(), source(&v["utm_source"]));
    out.insert("utm_campaign".into(), json!("corvus_softlaunch"));
    for (k, values) in [
        (
            "utm_medium",
            &["social", "referral", "post", "company-post", "bio"][..],
        ),
        (
            "utm_content",
            &["built_in_2_days_post", "sidequests_page"][..],
        ),
        ("utm_id", &["li_20261105"][..]),
        (
            "utm_term",
            &[
                "founders",
                "builders",
                "gtm",
                "sidequests",
                "linkedin",
                "launch",
            ][..],
        ),
    ] {
        if truthy(&v[k]) {
            out.insert(k.into(), strs(&v[k], values, "other"));
        }
    }
    out
}
fn first<'a>(p: &'a Value, keys: &[&str]) -> &'a Value {
    for k in keys {
        if truthy(&p[*k]) {
            return &p[*k];
        }
    }
    &Value::Null
}
fn query(search: &str, key: &str) -> String {
    url::form_urlencoded::parse(search.trim_start_matches('?').as_bytes())
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.into_owned())
        .unwrap_or_default()
}
pub fn x_context(path: &str, search: &str) -> Value {
    let links = Regex::new(r"^/links/(?:gabe|corvus|pidgy)/x/([^/]+)/?$").unwrap();
    let go = Regex::new(r"^/go/x/pidgy/([^/]+)/?$").unwrap();
    let route = links.captures(path).or_else(|| go.captures(path));
    if query(search, "utm_source") != "x" && route.is_none() {
        return Value::Null;
    }
    let campaign = query(search, "utm_campaign");
    let c = if campaign.is_empty() {
        route
            .and_then(|c| c.get(1).map(|m| m.as_str()))
            .unwrap_or("")
    } else {
        &campaign
    };
    json!({"campaign":campaign_slug(&json!(c)),"content":slot(&json!(query(search,"utm_content")))})
}
pub fn link_context(path: &str, search: &str) -> Value {
    let mut parts = path.trim_end_matches('/').split('/');
    if parts.next() != Some("") || parts.next() != Some("links") {
        return Value::Null;
    }
    let rest = parts.collect::<Vec<_>>();
    let person = rest
        .first()
        .copied()
        .filter(|p| ["gabe", "corvus", "pidgy"].contains(p))
        .unwrap_or("gabe");
    let offset = usize::from(
        rest.first()
            .is_some_and(|p| ["gabe", "corvus", "pidgy"].contains(p)),
    );
    let raw = rest
        .get(offset)
        .copied()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| query(search, "utm_source"));
    let raw = if raw.is_empty() { "direct" } else { &raw };
    let expanded = match raw {
        "li" => "linkedin",
        "ig" => "instagram",
        "tt" => "tiktok",
        "dc" => "discord",
        "bmc" => "buymeacoffee",
        "yt" => "youtube",
        "fb" => "facebook",
        v => v,
    };
    let s = source(&json!(expanded));
    let c = campaign_slug(&json!(
        rest.get(offset + 1)
            .copied()
            .filter(|s| !s.is_empty())
            .unwrap_or("bio")
    ));
    let mut out = json!({"links_person":person,"links_source":s,"links_campaign":if c.is_empty(){"other"}else{&c}});
    let slot = slot(&json!(query(search, "utm_content")));
    if s == "x" && !slot.is_empty() {
        out["utm_content"] = json!(slot);
    }
    out
}
/// `language_valid` is supplied by the browser's Intl.DisplayNames compatibility boundary.
pub fn event(e: &Value, approved: &[String], language_valid: bool) -> Value {
    let kind = field(e, "event");
    let p = &e["properties"];
    if !has("EVENTS", &e["event"]) || p["$cookieless_mode"] != true {
        return Value::Null;
    }
    let mut o = Map::new();
    if let Some(token) = p.get("token") {
        o.insert("token".into(), token.clone());
    }
    for (k, v) in [
        ("distinct_id", json!("$posthog_cookieless")),
        ("$cookieless_mode", json!(true)),
        ("$process_person_profile", json!(false)),
        ("$geoip_disable", json!(true)),
        ("$host", category(&p["$host"], "HOSTS", "other")),
        ("$pathname", json!(path(&p["$pathname"]))),
        (
            "$current_url",
            json!(safe_url(p.get("$current_url"), "https://corvus.gent")),
        ),
        ("$browser", category(&p["$browser"], "BROWSERS", "Other")),
        (
            "$device_type",
            strs(
                &p["$device_type"],
                &["Desktop", "Mobile", "Tablet"],
                "Other",
            ),
        ),
    ] {
        o.insert(k.into(), v);
    }
    o.insert(
        "$raw_user_agent".into(),
        json!(format!(
            "{}/{}",
            o["$browser"].as_str().unwrap_or("Other"),
            o["$device_type"].as_str().unwrap_or("Other")
        )),
    );
    if truthy(&p["corvus_country_code"]) {
        o.insert(
            "corvus_country_code".into(),
            country(&p["corvus_country_code"]),
        );
    }
    if kind == "$pageview"
        && truthy(&p["corvus_country_code"])
        && p["corvus_region"]
            .as_str()
            .is_some_and(|s| re(r"^[\p{L}\p{N} .’'-]{1,100}$", s))
    {
        o.insert("corvus_region".into(), p["corvus_region"].clone());
    }
    if kind == "$pageview"
        && p["corvus_city"]
            .as_str()
            .is_some_and(|s| re(r"^[\p{L}\p{N} .’'-]{1,100}$", s))
        && let (Some(lat), Some(lng)) = (
            p["corvus_latitude"].as_f64(),
            p["corvus_longitude"].as_f64(),
        )
        && lat.is_finite()
        && lng.is_finite()
        && lat.abs() <= 90.0
        && lng.abs() <= 180.0
    {
        o.insert("corvus_city".into(), p["corvus_city"].clone());
        if p["corvus_region"]
            .as_str()
            .is_some_and(|s| re(r"^[\p{L}\p{N} .’'-]{0,100}$", s))
        {
            o.insert("corvus_region".into(), p["corvus_region"].clone());
        }
        o.insert(
            "corvus_latitude".into(),
            json!((lat * 10.0 + 0.5).floor() / 10.0),
        );
        o.insert(
            "corvus_longitude".into(),
            json!((lng * 10.0 + 0.5).floor() / 10.0),
        );
    }
    if [
        "visit",
        "play",
        "vote",
        "comment",
        "like",
        "share",
        "reward_revealed",
    ]
    .contains(&kind)
    {
        o.insert("experience".into(), json!("curiositycraft"));
        for (k, values) in [
            (
                "feature_id",
                &[
                    "spawn-worlds",
                    "ai-drawings",
                    "character-voices",
                    "build-challenges",
                    "multiplayer",
                    "parent-report",
                    "teacher-mode",
                    "why-monster",
                ][..],
            ),
            ("platform", &["x", "linkedin", "whatsapp", "copy"][..]),
            (
                "reward_kind",
                &["photo", "fact", "badge", "easter-egg", "entry"][..],
            ),
        ] {
            if p[k].as_str().is_some_and(|s| values.contains(&s)) {
                o.insert(k.into(), p[k].clone());
            }
        }
    }
    if p["utm_campaign"] == "hack" && p["utm_content"] == "squads" {
        o.insert("utm_content".into(), json!("squads"));
        if p["short_slug"] == "squads" {
            o.insert("short_slug".into(), json!("squads"));
        }
    }
    if p["hack_id"]
        .as_f64()
        .is_some_and(|v| v.fract() == 0.0 && v > 0.0 && v <= 9999.0)
    {
        o.insert("hack_id".into(), p["hack_id"].clone());
    }
    if [
        "hack_live_click",
        "hack_robots_click",
        "hack_compound_click",
    ]
    .contains(&kind)
    {
        o.insert(
            "placement".into(),
            strs(
                &p["placement"],
                &["hero", "bar", "platform", "interview", "footer", "plan"],
                "other",
            ),
        );
        o.insert(
            "platform".into(),
            strs(
                &p["platform"],
                &["twitch", "tiktok", "instagram", "x", "linkedin"],
                "other",
            ),
        );
    }
    if kind == "squad_member_click" {
        o.insert(
            "member".into(),
            strs(&p["member"], &["gabe", "siebe"], "other"),
        );
    }
    if ["utm", "user_agent", "referrer", "unknown"].contains(&field(p, "source_confidence")) {
        o.insert("source_confidence".into(), p["source_confidence"].clone());
    }
    if p["utm_campaign"] == "compound-1000" {
        for k in ["utm_content", "utm_term"] {
            if p[k]
                .as_str()
                .is_some_and(|s| re(r"^[a-zA-Z0-9_.-]{1,64}$", s))
            {
                o.insert(k.into(), p[k].clone());
            }
        }
    }
    let refer = referrer(&p["$referring_domain"]);
    o.insert(
        "$referring_domain".into(),
        if refer == "direct" {
            json!("$direct")
        } else {
            refer
        },
    );
    for k in ["utm_source", "links_source", "source"] {
        if truthy(&p[k]) {
            o.insert(k.into(), source(&p[k]));
        }
    }
    for k in ["utm_campaign", "links_campaign", "campaign"] {
        if truthy(&p[k]) {
            o.insert(k.into(), campaign(&p[k]));
        }
    }
    for k in ["utm_medium", "medium"] {
        if truthy(&p[k]) {
            let allowed = [
                "hack_bar",
                "hack_page",
                "live_page",
                "direct",
                "story",
                "post",
                "company-page",
                "company-post",
                "bio",
                "links",
                "social",
                "game",
                "qr",
                "email",
            ];
            o.insert(
                k.into(),
                if has("ROUTES", &p[k]) {
                    p[k].clone()
                } else {
                    strs(&p[k], &allowed, "other")
                },
            );
        }
    }
    if p["utm_source"] == "linkedin"
        && p["utm_campaign"] == "gabe-corvus-page"
        && ["button", "website"].contains(&field(p, "utm_content"))
    {
        o.insert("utm_content".into(), p["utm_content"].clone());
    }
    o.extend(sidequest(p));
    if kind == "sidequests_cta_click" {
        o.insert(
            "button".into(),
            strs(&p["button"], &["pidgy", "contact", "home"], "other"),
        );
    }
    if kind == "sidequests_share" {
        o.insert(
            "method".into(),
            strs(&p["method"], &["native", "copy", "linkedin", "x"], "other"),
        );
    }
    let raw = first(p, &["utm_campaign", "links_campaign", "campaign"]);
    let raw_s = raw.as_str().unwrap_or("");
    let owner = ["corvus", "pidgy"]
        .into_iter()
        .find(|prefix| raw_s.starts_with(&format!("{prefix}-")));
    let slug = campaign_slug(
        &owner
            .map(|o| json!(&raw_s[o.len() + 1..]))
            .unwrap_or_else(|| raw.clone()),
    );
    if ["utm_source", "links_source", "source"]
        .iter()
        .any(|k| p[*k] == "x")
        && approved.contains(&slug)
        && !slug.is_empty()
    {
        let who = field(p, "links_person");
        let who = if ["corvus", "pidgy", "gabe"].contains(&who) {
            who
        } else {
            owner.unwrap_or("gabe")
        };
        o.insert("utm_source".into(), json!("x"));
        o.insert("utm_campaign".into(), json!(format!("{who}-{slug}")));
        for k in ["links_campaign", "campaign"] {
            if truthy(&p[k]) {
                o.insert(k.into(), json!(slug));
            }
        }
        let s = slot(&p["utm_content"]);
        if !s.is_empty() {
            o.insert("utm_content".into(), json!(s));
        }
    }
    if ["gabe", "pidgy", "corvus"].contains(&field(p, "links_person")) {
        o.insert("links_person".into(), p["links_person"].clone());
    }
    if kind == "link_click" {
        o.insert(
            "link_href".into(),
            json!(safe_url(p.get("link_href"), "https://corvus.gent")),
        );
        o.insert("page".into(), json!(path(&p["page"])));
    }
    if kind == "outbound_click" {
        o.insert("host".into(), host(&p["host"]));
        o.insert(
            "href".into(),
            json!(safe_url(p.get("href"), "https://corvus.gent")),
        );
        o.insert("path".into(), json!(path(&p["path"])));
    }
    if kind == "short_link_out" {
        o.insert(
            "url".into(),
            json!(safe_url(p.get("url"), "https://corvus.gent")),
        );
        o.insert(
            "target".into(),
            strs(
                &p["target"],
                &[
                    "me",
                    "home",
                    "now",
                    "sidequests",
                    "support",
                    "402",
                    "cv",
                    "pidgy",
                    "book",
                    "coffee",
                ],
                "other",
            ),
        );
        o.insert("external".into(), json!(truthy(&p["external"])));
    }
    if kind == "links_click" {
        o.insert(
            "link".into(),
            strs(
                &p["link"],
                &[
                    "pidgy",
                    "pidgy-trial",
                    "call",
                    "portfolio",
                    "now",
                    "sidequests",
                    "linkedin",
                    "ig-startup",
                    "ig-bjj",
                    "realm",
                    "games",
                    "music",
                    "wiki",
                    "stats",
                    "lantern",
                    "crow",
                    "keeper",
                    "gtm",
                    "instagram",
                    "youtube",
                    "facebook",
                    "threads",
                    "tiktok",
                    "x",
                    "luma",
                    "alkmist",
                    "coffee",
                    "home",
                ],
                "other",
            ),
        );
    }
    if kind == "music_play" {
        o.insert("genre".into(), category(&p["genre"], "GENRES", "other"));
    }
    if kind.starts_with("game_") {
        o.insert("type".into(), category(&p["type"], "GAME_TYPES", "other"));
        if p["guesses"]
            .as_f64()
            .is_some_and(|v| v.fract() == 0.0 && (0.0..=6.0).contains(&v))
        {
            o.insert("guesses".into(), p["guesses"].clone());
        }
        if p["solved"].is_boolean() {
            o.insert("solved".into(), p["solved"].clone());
        }
    }
    if (kind.starts_with("game_") || kind.starts_with("visitor_guess"))
        && re(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$", field(p, "day"))
    {
        o.insert("day".into(), p["day"].clone());
    }
    if kind == "language_vote" {
        o.insert(
            "language".into(),
            if language_valid {
                p["language"].clone()
            } else {
                json!("other")
            },
        );
    }
    if kind == "terminal_command" {
        o.insert(
            "command".into(),
            category(&p["command"], "COMMANDS", "unknown"),
        );
    }
    if kind == "feather_found" {
        o.insert(
            "id".into(),
            strs(
                &p["id"],
                &[
                    "/",
                    "/now/",
                    "/sidequests/",
                    "/support/",
                    "/support/books/",
                    "/languages/",
                    "/call/",
                ],
                "other",
            ),
        );
        let n = numeric(&p["total"]);
        o.insert(
            "total".into(),
            json!(if n.is_nan() { 0.0 } else { n.clamp(0.0, 7.0) }),
        );
    }
    if kind == "share_click" {
        o.insert("what".into(), strs(&p["what"], &["gabe", "site"], "other"));
    }
    let mut out = json!({"event":kind,"properties":o});
    for k in ["timestamp", "uuid"] {
        if let Some(v) = e.get(k) {
            out[k] = v.clone();
        }
    }
    out
}

fn numeric(v: &Value) -> f64 {
    match v {
        Value::Null => 0.0,
        Value::Bool(b) => u8::from(*b) as f64,
        Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        Value::String(_) | Value::Array(_) => {
            let raw = string(v);
            let s = raw.trim();
            if s.is_empty() {
                return 0.0;
            }
            for (prefix, radix) in [
                ("0x", 16),
                ("0X", 16),
                ("0o", 8),
                ("0O", 8),
                ("0b", 2),
                ("0B", 2),
            ] {
                if let Some(rest) = s.strip_prefix(prefix) {
                    return u64::from_str_radix(rest, radix)
                        .map(|n| n as f64)
                        .unwrap_or(f64::NAN);
                }
            }
            s.parse().unwrap_or(f64::NAN)
        }
        _ => f64::NAN,
    }
}
