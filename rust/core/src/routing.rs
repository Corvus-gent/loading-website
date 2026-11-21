//! Pure routing decisions. No network calls or side effects are performed here.
use crate::{
    tiers::tier_path,
    videos::{HOOKS, LANGUAGES, parse_slug},
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, sync::LazyLock};
use url::Url;
const PATTERNS: &[&str] = &[
    r"/{2,}",
    r"^/(?:rust|migration)(?:/|$)|^/Cargo\.(?:toml|lock)$|^/rust-toolchain\.toml$",
    r"^/api/_openrisk(?:/|$)",
    r"^/project-cto(?:/|$)",
    r"^/(?:stats/)?(?:(?:pidgy|games|map|music|hunt|x|coffee|linkedin|status|hack|army|private)/)?index\.html$",
    r"^/(?:links/gabe|soldier/[a-zA-Z0-9_-]+)/$",
    r"^/(?:$|(?:pidgy|games|map|music|hunt|x|coffee|linkedin|status|hack|army)/?$|(?:private|stats)(?:/|$)|(?:api|js|css|img|public|vendor)/)",
    r"(?i)\.[a-z0-9]+$",
    r"^/(?:enlist|join-the-army-now)(?:/.*)?$",
    r"^/go/compound-([a-z0-9-]{1,48})/?$",
    r"^/go/(cardneto-(?:demo|li|app|egg))/?$",
    r"^/c/([^/]+)/?$",
    r"^/compound/v2/?$",
    r"^/v/([^/]+)/?$",
    r"^/go/(twitch|instagram|twitter)/?$",
    r"^/go/((?:call|bmc|dinner|roll)-(?:li|x))/?$",
    r"^/go/(plethora-[a-z0-9-]+)/?$",
    r"^/go/((?:cx|cp|bio)-(?:tt|ig|x|li))/?$",
    r"^/squads/?$",
    r"^/sidequest/?$",
    r"^/coffee-with-gabe/?$",
    r"^/important-call-gabe-maxxer/?$",
    r"^/(pidgy|games|map|music|hunt|x|coffee|linkedin|status|hack|army)/?$",
    r"^/stats(?:/|$)",
    r"^/compound/v2(?:/([a-z]{2})(?:/([a-z]+)(?:/([1-9][0-9]{0,3}))?)?)?$",
    r"^[1-9][0-9]{0,3}$",
];
static EXPRESSIONS: LazyLock<Result<BTreeMap<&'static str, Regex>, regex::Error>> =
    LazyLock::new(|| {
        PATTERNS
            .iter()
            .map(|p| Regex::new(p).map(|r| (*p, r)))
            .collect()
    });
fn matched(pattern: &str, path: &str) -> bool {
    EXPRESSIONS
        .as_ref()
        .ok()
        .and_then(|m| m.get(pattern))
        .is_some_and(|r| r.is_match(path))
}
fn captures(pattern: &str, path: &str) -> Option<Vec<Option<String>>> {
    Some(
        EXPRESSIONS
            .as_ref()
            .ok()?
            .get(pattern)?
            .captures(path)?
            .iter()
            .map(|m| m.map(|m| m.as_str().to_string()))
            .collect(),
    )
}
fn capture(pattern: &str, path: &str) -> Option<String> {
    captures(pattern, path)?.get(1)?.clone()
}
fn get(url: &Url, key: &str) -> Option<String> {
    url.query_pairs()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.into_owned())
}
fn set(url: &mut Url, key: &str, value: &str) {
    let mut pairs = Vec::new();
    let mut seen = false;
    for (k, v) in url.query_pairs() {
        if k == key {
            if !seen {
                pairs.push((key.to_string(), value.to_string()));
                seen = true;
            }
        } else {
            pairs.push((k.into_owned(), v.into_owned()));
        }
    }
    if !seen {
        pairs.push((key.into(), value.into()));
    }
    url.set_query(None);
    url.query_pairs_mut().extend_pairs(pairs);
}
fn target(url: &Url, keep: bool) -> Result<Url, url::ParseError> {
    let mut target = url.join("/api/stats")?;
    if keep {
        target.set_query(url.query())
    }
    Ok(target)
}
fn decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return None;
            }
            let a = (bytes[i + 1] as char).to_digit(16)?;
            let b = (bytes[i + 2] as char).to_digit(16)?;
            out.push((a * 16 + b) as u8);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Decision {
    pub status: u16,
    pub headers: BTreeMap<String, String>,
    pub body: String,
    pub hit: Option<String>,
}
impl Decision {
    fn new(status: u16, headers: &[(&str, &str)], body: &str) -> Self {
        Self {
            status,
            headers: headers
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            body: body.into(),
            hit: None,
        }
    }
    fn next() -> Self {
        Self::new(200, &[("x-middleware-next", "1")], "")
    }
    fn rewrite(url: &Url) -> Self {
        Self::new(200, &[("x-middleware-rewrite", url.as_str())], "")
    }
    fn redirect(status: u16, url: &str) -> Self {
        Self::new(status, &[("location", url)], "")
    }
    fn header(mut self, key: &str, value: &str) -> Self {
        self.headers.insert(key.into(), value.into());
        self
    }
}
pub fn og(path: &str, url: &Url) -> Option<Vec<(String, String)>> {
    let path = path.strip_suffix('/').unwrap_or(path);
    if path == "/live" {
        return Some(vec![("kind".into(), "live".into())]);
    }
    if path == "/hack/3" {
        return Some(
            if let Some(n) = get(url, "interview").filter(|s| matched(r"^[1-9][0-9]{0,3}$", s)) {
                vec![("kind".into(), "interview".into()), ("n".into(), n)]
            } else {
                vec![("kind".into(), "hack3".into())]
            },
        );
    }
    let m = captures(
        r"^/compound/v2(?:/([a-z]{2})(?:/([a-z]+)(?:/([1-9][0-9]{0,3}))?)?)?$",
        path,
    )?;
    if m[1].as_deref().is_some_and(|s| !LANGUAGES.contains(&s))
        || m[2].as_deref().is_some_and(|s| !HOOKS.contains(&s))
    {
        return None;
    }
    let mut out = vec![("kind".into(), "compound".into())];
    for (i, k) in [(1, "lang"), (2, "hook"), (3, "n")] {
        if let Some(value) = &m[i] {
            out.push((k.into(), value.clone()));
        }
    }
    if let Some(slug) = get(url, "video")
        .filter(|s| !s.is_empty())
        .or_else(|| get(url, "utm_content"))
        && let Some(v) = parse_slug(&slug)
        && m[1].as_deref() == Some(&v.lang)
        && m[2].as_deref() == Some(&v.hook)
        && m[3].as_ref().and_then(|s| s.parse::<u16>().ok()) == Some(v.n)
    {
        out.push(("video".into(), slug));
    }
    Some(out)
}
fn cli(ua: &str) -> Option<&'static str> {
    let ua = ua.to_ascii_lowercase();
    [
        (ua.starts_with("curl"), "curl"),
        (ua.starts_with("wget"), "wget"),
        (ua.contains("httpie"), "httpie"),
        (ua.contains("python") || ua.contains("aiohttp"), "python"),
        (ua.starts_with("go-http"), "go"),
        (
            ["node-fetch", "undici", "axios"]
                .iter()
                .any(|v| ua.contains(v)),
            "node",
        ),
        (ua.contains("postman"), "postman"),
        (ua.contains("insomnia"), "insomnia"),
        (ua.contains("powershell"), "powershell"),
    ]
    .into_iter()
    .find(|(yes, _)| *yes)
    .map(|(_, tool)| tool)
}
const COMPOUND: &[&str] = &[
    "x",
    "x-bio",
    "li",
    "li-1",
    "li-2",
    "ig",
    "ig-story",
    "bjj",
    "bjj-story",
    "dm",
    "tt",
    "tt-bio",
    "tt-bjj",
    "tt-g",
    "dc",
    "wa",
    "hostel",
    "v",
    "qr",
    "simon",
];
pub fn decide(raw_url: &str, method: &str, ua: &str, cookie: &str) -> Result<Decision, String> {
    if EXPRESSIONS.is_err() {
        return Err("Invalid route patterns".into());
    }
    let mut url = Url::parse(raw_url).map_err(|_| "Invalid URL")?;
    let path = url.path().to_string();
    let stats = url.host_str() == Some("stats.corvus.gent");
    let source = decode(&path)
        .map(|p| {
            let mut out = String::new();
            let mut slash = false;
            for c in p.chars() {
                if c != '/' || !slash {
                    out.push(c);
                }
                slash = c == '/';
            }
            out
        })
        .unwrap_or(path.clone());
    if matched(
        r"^/(?:rust|migration)(?:/|$)|^/Cargo\.(?:toml|lock)$|^/rust-toolchain\.toml$",
        &source,
    ) {
        return Ok(Decision::new(
            404,
            &[
                ("cache-control", "no-store"),
                ("content-type", "text/plain;charset=UTF-8"),
            ],
            "Not found",
        ));
    }
    if matched(r"^/api/_openrisk(?:/|$)", &path) {
        return Ok(Decision::new(
            404,
            &[
                ("cache-control", "private, no-store"),
                ("x-robots-tag", "noindex, nofollow"),
            ],
            "",
        ));
    }
    if matched(r"^/project-cto(?:/|$)", &path) {
        if stats || path.ends_with('/') {
            if stats {
                url.set_host(Some("corvus.gent"))
                    .map_err(|_| "Invalid host")?;
            }
            url.set_path(path.trim_end_matches('/'));
            return Ok(Decision::redirect(308, url.as_str())
                .header("cache-control", "private, no-store")
                .header("x-robots-tag", "noindex, nofollow"));
        }
        return Ok(Decision::next());
    }
    let clean = path.strip_suffix("/index.html").unwrap_or(&path);
    let clean = clean.strip_suffix('/').unwrap_or(clean);
    let clean = if clean.is_empty() { "/" } else { clean };
    if stats
        && matched(
            r"^/(?:stats/)?(?:(?:pidgy|games|map|music|hunt|x|coffee|linkedin|status|hack|army|private)/)?index\.html$",
            &path,
        )
    {
        url.set_path(path.strip_suffix("index.html").unwrap_or(&path));
        return Ok(Decision::redirect(308, url.as_str()));
    }
    if let Some(canonical) = match clean {
        "/hack2" => Some("/hack/2"),
        "/hack/the-feed" => Some("/hack/1/the-feed"),
        "/submission" => Some("/hack/play"),
        "/soldier" => Some("/legion/#wall"),
        _ => None,
    } {
        let mut target = Url::parse(&format!(
            "https://{}",
            &url[url::Position::BeforeHost..url::Position::AfterPort]
        ))
        .map_err(|_| "Invalid origin")?
        .join(canonical)
        .map_err(|_| "Invalid path")?;
        target.set_query(url.query());
        return Ok(Decision::redirect(301, target.as_str()));
    }
    if !stats && matched(r"^/(?:links/gabe|soldier/[a-zA-Z0-9_-]+)/$", &path) {
        url.set_path(&path[..path.len() - 1]);
        return Ok(Decision::redirect(308, url.as_str()));
    }
    if stats
        && !matched(
            r"^/(?:$|(?:pidgy|games|map|music|hunt|x|coffee|linkedin|status|hack|army)/?$|(?:private|stats)(?:/|$)|(?:api|js|css|img|public|vendor)/)",
            &path,
        )
        && !matched(r"(?i)\.[a-z0-9]+$", &path)
    {
        url.set_host(Some("corvus.gent"))
            .map_err(|_| "Invalid host")?;
        return Ok(Decision::redirect(301, url.as_str()));
    }
    if matched(r"^/(?:enlist|join-the-army-now)(?:/.*)?$", &path) {
        if stats {
            url.set_host(Some("corvus.gent"))
                .map_err(|_| "Invalid host")?;
        }
        url.set_path("/legion/");
        return Ok(Decision::redirect(301, url.as_str()));
    }
    if let Some(go) = capture(r"^/go/compound-([a-z0-9-]{1,48})/?$", &path) {
        let mut t = target(&url, true).map_err(|_| "Invalid target")?;
        for (k, v) in [("compoundV2", "1"), ("impact", "1"), ("go", &go)] {
            set(&mut t, k, v)
        }
        return Ok(Decision::rewrite(&t));
    }
    if let Some(partner) = capture(r"^/go/(cardneto-(?:demo|li|app|egg))/?$", &path) {
        let mut t = target(&url, false).map_err(|_| "Invalid target")?;
        set(&mut t, "legion", "1");
        set(&mut t, "partner", &partner);
        return Ok(Decision::rewrite(&t));
    }
    let alias = capture(r"^/c/([^/]+)/?$", &path);
    if !stats
        && (alias.is_some()
            || (matched(r"^/compound/v2/?$", &path)
                && get(&url, "code").is_some()
                && get(&url, "code_missing").is_none()))
    {
        let mut t = target(&url, true).map_err(|_| "Invalid target")?;
        set(&mut t, "compoundV2", "1");
        set(&mut t, "codeLink", "1");
        if let Some(code) = alias {
            set(&mut t, "code", &decode(&code).ok_or("Malformed code")?);
        }
        return Ok(Decision::rewrite(&t));
    }
    if let Some((protected, _)) = tier_path(&path)
        && !stats
    {
        let mut t = target(&url, false).map_err(|_| "Invalid target")?;
        for (k, v) in [
            ("legion", "1"),
            ("action", "layer_page"),
            ("path", protected),
            ("zone", &get(&url, "layer_zone").unwrap_or_default()),
        ] {
            set(&mut t, k, v)
        }
        return Ok(Decision::rewrite(&t)
            .header("cache-control", "private, no-store")
            .header("vary", "Cookie"));
    }
    if !stats && let Some(og) = og(&path, &url) {
        let mut t = target(&url, false).map_err(|_| "Invalid target")?;
        set(&mut t, "ogPage", "1");
        for (k, v) in og {
            set(&mut t, &k, &v)
        }
        return Ok(Decision::rewrite(&t));
    }
    for (pattern, param, stats_ok, keep) in [
        (r"^/v/([^/]+)/?$", "compoundV2", false, true),
        (r"^/go/(twitch|instagram|twitter)/?$", "live", true, false),
        (
            r"^/go/((?:call|bmc|dinner|roll)-(?:li|x))/?$",
            "support",
            true,
            true,
        ),
        (r"^/go/(plethora-[a-z0-9-]+)/?$", "plethora", true, true),
        (
            r"^/go/((?:cx|cp|bio)-(?:tt|ig|x|li))/?$",
            "battle",
            false,
            true,
        ),
    ] {
        if (stats_ok || !stats)
            && let Some(slug) = capture(pattern, &path)
        {
            let mut t = target(&url, keep).map_err(|_| "Invalid target")?;
            set(&mut t, param, "1");
            if param == "compoundV2" {
                set(&mut t, "short", "1");
            }
            set(&mut t, "slug", &slug);
            return Ok(Decision::rewrite(&t));
        }
    }
    if !stats && matched(r"^/squads/?$", &path) {
        url.set_path("/hackathons/");
        for (k, v) in [
            ("utm_source", "share"),
            ("utm_medium", "links"),
            ("utm_campaign", "hack"),
            ("utm_content", "squads"),
        ] {
            if get(&url, k).is_none() {
                set(&mut url, k, v)
            }
        }
        return Ok(Decision::redirect(307, url.as_str()));
    }
    let slug = path.strip_prefix('/').unwrap_or(&path);
    let slug = slug.strip_suffix('/').unwrap_or(slug);
    if !stats && COMPOUND.contains(&slug) {
        let mut t = target(&url, true).map_err(|_| "Invalid target")?;
        set(&mut t, "compound", "1");
        set(&mut t, "slug", slug);
        if let Some(c) = get(&url, "c") {
            set(
                &mut t,
                "c",
                &String::from_utf16_lossy(&c.encode_utf16().take(64).collect::<Vec<_>>()),
            );
        }
        return Ok(Decision::rewrite(&t));
    }
    if !stats && matched(r"^/sidequest/?$", &path) {
        url.set_path("/sidequests");
        return Ok(Decision::redirect(307, url.as_str()));
    }
    if stats && matched(r"^/coffee-with-gabe/?$", &path) {
        return Ok(Decision::redirect(
            307,
            "https://corvus.gent/go/corvus/coffee/coffee-stats",
        ));
    }
    if !stats {
        let company = match path.strip_suffix('/').unwrap_or(&path) {
            "/enter" => Some(
                "/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=button",
            ),
            "/the-crow" => Some(
                "/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=website",
            ),
            "/revived" => Some(
                "/?utm_source=linkedin&utm_medium=company-post&utm_campaign=gabe-corvus-revival",
            ),
            _ => None,
        };
        if let Some(location) = company {
            return Ok(Decision::redirect(307, location));
        }
        if matched(r"^/important-call-gabe-maxxer/?$", &path) {
            return Ok(Decision::redirect(
                307,
                "/call/?utm_source=linkedin&utm_medium=post&utm_campaign=gabe-important-call",
            ));
        }
        if matched(r"^/coffee-with-gabe/?$", &path) {
            return Ok(Decision::redirect(
                307,
                "/links/gabe/bmc/coffee-bio?utm_source=buymeacoffee&utm_medium=bio&utm_campaign=gabe-coffee-bio",
            ));
        }
    }
    let hit = cli(ua).map(str::to_string);
    if hit.is_some() && path == "/" && !stats {
        return Ok(Decision::new(
            200,
            &[("content-type", "text/plain; charset=utf-8")],
            include_str!("../../migration/curl-reply.txt"),
        )
        .with_hit(hit));
    }
    let result = if stats {
        if path == "/" {
            Decision::rewrite(&url.join("/stats/").map_err(|_| "Invalid target")?)
        } else if let Some(page) = capture(
            r"^/(pidgy|games|map|music|hunt|x|coffee|linkedin|status|hack|army)/?$",
            &path,
        ) {
            Decision::rewrite(
                &url.join(&format!("/stats/{page}/"))
                    .map_err(|_| "Invalid target")?,
            )
        } else if path.starts_with("/private") {
            Decision::rewrite(&url.join("/stats/private/").map_err(|_| "Invalid target")?)
        } else if matched(r"^/stats(?:/|$)", &path) {
            let rest = path.strip_prefix("/stats").unwrap_or(&path);
            let rest = if rest.is_empty() { "/" } else { rest };
            url.set_path(rest);
            Decision::redirect(308, url.as_str())
        } else {
            Decision::next()
        }
    } else if matched(r"^/stats(?:/|$)", &path) {
        let rest = path
            .strip_prefix("/stats")
            .unwrap_or(&path)
            .strip_prefix('/')
            .unwrap_or("");
        Decision::redirect(
            308,
            &format!(
                "https://stats.corvus.gent/{rest}{}",
                url.query().map(|q| format!("?{q}")).unwrap_or_default()
            ),
        )
    } else if clean == "/" && matches!(method, "GET" | "HEAD") {
        let entered = cookie.split(';').any(|v| v.trim() == "corvus_realm=1");
        let result = if entered {
            Decision::next()
        } else {
            url.set_path("/public/realm-entry.html");
            Decision::rewrite(&url)
        };
        result
            .header("cache-control", "private, no-store")
            .header("vary", "Cookie, User-Agent")
    } else {
        Decision::next()
    };
    Ok(result.with_hit(hit))
}
impl Decision {
    fn with_hit(mut self, hit: Option<String>) -> Self {
        self.hit = hit;
        self
    }
}
