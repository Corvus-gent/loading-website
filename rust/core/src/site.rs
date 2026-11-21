//! Public discovery and attribution URLs. Never return private/account capabilities.
use url::Url;
fn blocked(path: &str) -> bool {
    let parts = path
        .split('/')
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>();
    parts
        .iter()
        .any(|s| ["admin", "private", "edit", "join"].contains(s))
        || parts.first().is_some_and(|s| {
            [
                "army",
                "api",
                "clients",
                "letters",
                "rust",
                "migration",
                "target",
            ]
            .contains(s)
        })
        || path == "/compound/stats"
        || path.starts_with("/compound/stats/")
        || ["/compound/v2/stats", "/compound/v2/links", "/hack/3/add"]
            .iter()
            .any(|p| path == *p || path.starts_with(&format!("{p}/")))
}
pub fn public_path(value: &str) -> bool {
    let Ok(base) = Url::parse("https://corvus.gent") else {
        return false;
    };
    let Ok(u) = base.join(value) else {
        return false;
    };
    if u.scheme() != "https"
        || !u.username().is_empty()
        || u.password().is_some()
        || !matches!(u.host_str(), Some("corvus.gent" | "stats.corvus.gent"))
    {
        return false;
    }
    let prefix = if u.host_str() == Some("stats.corvus.gent") {
        "/stats"
    } else {
        ""
    };
    let mut decoded = u.path().to_owned();
    // Private paths stay private when percent-encoded or repeatedly encoded.
    for _ in 0..4 {
        let next = decode(&decoded);
        if next == decoded {
            break;
        }
        decoded = next;
    }
    if decoded.contains('%') || blocked(&format!("{prefix}{decoded}")) {
        return false;
    }
    !u.query_pairs().any(|(k, _)| {
        let k = k.to_lowercase();
        ["key", "token", "password", "email"]
            .iter()
            .any(|w| k.contains(w))
    })
}
fn decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let (Some(a), Some(b)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            )
        {
            out.push((a * 16 + b) as u8);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}
pub fn canonical(value: &str, base: &str) -> Option<String> {
    let mut u = Url::parse(base).ok()?.join(value).ok()?;
    let path = u
        .path()
        .strip_suffix("/index.html")
        .unwrap_or(u.path())
        .trim_end_matches('/');
    let path = if path.is_empty() { "/" } else { path };
    let path = path.to_owned();
    let mut query = u
        .query_pairs()
        .filter(|(k, _)| ["video", "id", "interview", "game"].contains(&k.as_ref()))
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect::<Vec<_>>();
    query.sort_by(|a, b| a.0.cmp(&b.0));
    u.set_path(&path);
    u.set_query(None);
    if !query.is_empty() {
        u.query_pairs_mut().extend_pairs(query);
    }
    Some(format!(
        "{}{}{}",
        if u.host_str() == Some("stats.corvus.gent") {
            "https://stats.corvus.gent"
        } else {
            ""
        },
        u.path(),
        u.query().map(|q| format!("?{q}")).unwrap_or_default()
    ))
}
pub fn compound_url(href: &str, placement: &str, base: &str) -> Option<String> {
    let base = Url::parse(base).ok()?;
    let u = base.join(href).ok()?;
    if u.scheme() != "https" || !matches!(u.host_str(), Some("compound.mov" | "www.compound.mov")) {
        return None;
    }
    let id = if !placement.is_empty()
        && placement.len() <= 48
        && placement
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
    {
        placement
    } else {
        "site"
    };
    let mut go = base.join(&format!("/go/compound-{id}")).ok()?;
    if u.path() != "/"
        || u.query().is_some_and(|q| !q.is_empty())
        || u.fragment().is_some_and(|h| !h.is_empty())
    {
        go.query_pairs_mut().append_pair("to", u.as_str());
    }
    Some(go.into())
}
