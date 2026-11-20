use super::*;
use std::cell::RefCell;
use std::collections::HashSet;
use web_sys::RequestCache;
thread_local! {static ROUTES:RefCell<Option<Vec<Value>>>=const{RefCell::new(None)};static LOADING:RefCell<bool>=const{RefCell::new(false)};static STARTED:RefCell<bool>=const{RefCell::new(false)};}
pub(super) async fn load() -> Vec<Value> {
    loop {
        if let Some(rows) = ROUTES.with_borrow(Clone::clone) {
            return rows;
        }
        if !LOADING.with_borrow(|v| *v) {
            break;
        }
        let _ = ui::sleep(10).await;
    }
    LOADING.with_borrow_mut(|v| *v = true);
    let data = get("/site-directory.json", RequestCache::NoCache, 8000)
        .await
        .unwrap_or(Value::Null);
    let routes = data["routes"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|r| r["public"] != false && corvus_core::site::public_path(text(r, "path")))
        .cloned()
        .collect::<Vec<_>>();
    ROUTES.with_borrow_mut(|v| *v = Some(routes.clone()));
    LOADING.with_borrow_mut(|v| *v = false);
    routes
}
fn lower_slug(s: &str, max: usize) -> bool {
    !s.is_empty()
        && s.len() <= max
        && s.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
fn soldier(s: &str) -> bool {
    (3..=24).contains(&s.len())
        && s.as_bytes()[0].is_ascii_lowercase()
        && s.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-')
}
pub(super) async fn fresh(mut routes: Vec<Value>, force: bool) -> Vec<Value> {
    let directory = !nodes("[data-full-directory]").is_empty();
    if !force && !directory && nodes("[data-senate-strip]").is_empty() {
        return routes;
    }
    let mut extra = Vec::new();
    if let Ok(data) = get("/api/legion?senate=1", RequestCache::NoStore, 6000).await {
        for p in data["profiles"].as_array().into_iter().flatten() {
            if lower_slug(text(p, "slug"), 80) {
                extra.push(json!({"path":format!("/legion/senate/{}",text(p,"slug")),"title":format!("{} · {}",text(p,"name"),text(p,"title")),"description":p["content"]["headline"].as_str().filter(|s|!s.is_empty()).unwrap_or("A friend of the Legion."),"section":"legion","status":"claimed","kind":"senate","public":true}));
            }
        }
    }
    if (force || directory)
        && let Ok(data) = get("/api/compound-v2", RequestCache::NoCache, 8000).await
    {
        for v in data["videos"].as_array().into_iter().flatten() {
            let lang = text(v, "lang");
            let hook = text(v, "hook");
            if !corvus_core::army::truthy(&v["is_example"])
                && lang.len() == 2
                && lang.bytes().all(|b| b.is_ascii_lowercase())
                && !hook.is_empty()
                && hook.bytes().all(|b| b.is_ascii_lowercase())
                && v["n"].as_i64().is_some()
                && lower_slug(text(v, "slug"), 200)
            {
                extra.push(json!({"path":format!("/compound/v2/{lang}/{hook}/{}?video={}",v["n"],text(v,"slug")),"title":format!("{} · {} / {}",v["vote_code"].as_str().filter(|s|!s.is_empty()).unwrap_or(text(v,"slug")),text(v,"platform").to_uppercase(),text(v,"account")),"description":v["hook_line"].as_str().filter(|s|!s.is_empty()).unwrap_or("Watch and vote on this cut."),"section":"quests","kind":"video","status":"video","public":true}));
            }
        }
    }
    if let Ok(data) = get("/api/army?view=legion", RequestCache::NoStore, 6000).await {
        let soldiers = data["members"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|p| format!("/soldier/{}", text(p, "username")))
            .collect::<HashSet<_>>();
        for p in data["members"].as_array().into_iter().flatten() {
            let name = text(p, "username");
            if soldier(name) {
                extra.push(json!({"path":format!("/soldier/{name}"),"title":format!("{name} · public soldier profile"),"description":"Meet a soldier of the Corvus army.","section":"legion","status":"public","kind":"soldier","public":true}));
            }
        }
        routes.retain(|r| r["kind"] != "soldier" || soldiers.contains(text(r, "path")));
        for a in nodes(
            ".site-directory a[href*=\"/soldier/\"],.site-explore a[href*=\"/soldier/\"],.site-gems a[href*=\"/soldier/\"]",
        ) {
            if !soldiers.contains(
                &site_canonical(&a.get_attribute("href").unwrap_or_default()).unwrap_or_default(),
            ) {
                a.remove();
            }
        }
    }
    let mut seen = routes
        .iter()
        .map(|r| text(r, "path").to_owned())
        .collect::<HashSet<_>>();
    for r in extra {
        if corvus_core::site::public_path(text(&r, "path"))
            && seen.insert(text(&r, "path").to_owned())
        {
            routes.push(r);
        }
    }
    routes
}
fn filter() -> Result<(), JsValue> {
    let Some(root) = nodes("[data-full-directory]").first().cloned() else {
        return Ok(());
    };
    let query = nodes("[data-directory-filter]")
        .first()
        .and_then(|n| n.dyn_ref::<web_sys::HtmlInputElement>())
        .map(|i| i.value().trim().to_lowercase())
        .unwrap_or_default();
    let mut n = 0;
    let links = root.query_selector_all(".site-directory a")?;
    for i in 0..links.length() {
        if let Some(a) = links
            .item(i)
            .and_then(|e| e.dyn_into::<web_sys::HtmlElement>().ok())
        {
            let hay = format!(
                "{} {}",
                a.text_content().unwrap_or_default(),
                a.get_attribute("href").unwrap_or_default()
            )
            .to_lowercase();
            a.set_hidden(!query.is_empty() && !hay.contains(&query));
            if !a.hidden() {
                n += 1;
            }
        }
    }
    for count in nodes("[data-directory-count]") {
        count.set_text_content(Some(&format!("{n} public doors")));
    }
    Ok(())
}
pub(super) fn directory(routes: &[Value]) -> Result<(), JsValue> {
    let Some(root) = nodes("[data-full-directory]").first().cloned() else {
        return Ok(());
    };
    let links = root.query_selector_all("a[href]")?;
    let mut seen = HashSet::new();
    for i in 0..links.length() {
        if let Some(a) = links
            .item(i)
            .and_then(|n| n.dyn_into::<web_sys::Element>().ok())
            && let Some(path) = site_canonical(&a.get_attribute("href").unwrap_or_default())
        {
            seen.insert(path);
        }
    }
    for r in routes {
        let path = text(r, "path");
        if seen.contains(path) {
            continue;
        }
        let section = text(r, "section");
        if !section.bytes().all(|b| b.is_ascii_lowercase() || b == b'-') {
            continue;
        }
        if let Some(group) =
            root.query_selector(&format!("[data-directory-section=\"{section}\"]"))?
        {
            let a = element("a", Some(text(r, "title")), None)?;
            a.set_attribute(
                "href",
                &if path.starts_with('/') {
                    format!("{}{path}", host())
                } else {
                    path.to_owned()
                },
            )?;
            a.append_child(
                &element(
                    "small",
                    Some(
                        r["status"]
                            .as_str()
                            .filter(|s| !s.is_empty())
                            .unwrap_or("open"),
                    ),
                    None,
                )?
                .into(),
            )?;
            group.append_child(&a)?;
            seen.insert(path.to_owned());
        }
    }
    filter()
}
pub(super) fn start() -> Result<(), JsValue> {
    if STARTED.replace(true) {
        return Ok(());
    }
    for input in nodes("[data-directory-filter]") {
        ui::listen(&input, "input", move |_| {
            let _ = filter();
        })?;
    }
    wasm_bindgen_futures::spawn_local(async move {
        let routes = load().await;
        let _ = directory(&routes);
        if let Ok(w) = window() {
            let _ = js_sys::Reflect::set(&w, &"corvusDiscoveryReady".into(), &true.into());
        }
        let fresh = fresh(routes, false).await;
        ROUTES.with_borrow_mut(|v| *v = Some(fresh.clone()));
        let _ = directory(&fresh);
        let _ = event("corvus-directory-ready", &Value::Array(fresh));
    });
    Ok(())
}
