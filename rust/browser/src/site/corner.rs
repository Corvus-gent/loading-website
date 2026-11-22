use super::*;
use std::cell::RefCell;
thread_local! {static FULL:RefCell<Vec<Value>>=const{RefCell::new(Vec::new())};static LOADED:RefCell<bool>=const{RefCell::new(false)};static STARTED:RefCell<bool>=const{RefCell::new(false)};}
fn index() -> Vec<Value> {
    serde_json::from_str(include_str!("../../../migration/search-index.json")).unwrap_or_default()
}
fn load() {
    if LOADED.replace(true) {
        return;
    }
    wasm_bindgen_futures::spawn_local(async {
        if let Ok(data) = get("/search-index.json", web_sys::RequestCache::Default, 8000).await
            && let Some(rows) = data.as_array()
        {
            FULL.with_borrow_mut(|v| *v = rows.clone());
        }
    });
}
fn matches(q: &str) -> Vec<Value> {
    let q = q.trim().to_lowercase();
    let index = index();
    if q.is_empty() {
        return [3, 0]
            .into_iter()
            .filter_map(|i| index.get(i).cloned())
            .collect();
    }
    let words = q.split_whitespace().collect::<Vec<_>>();
    let hit = |s: &str| words.iter().all(|w| s.contains(w));
    let mut out = index
        .into_iter()
        .filter(|i| hit(&format!("{} {}", text(i, "title"), text(i, "keys")).to_lowercase()))
        .collect::<Vec<_>>();
    for p in FULL.with_borrow(Clone::clone) {
        if out.len() >= 7 || out.iter().any(|o| o["url"] == p["url"]) {
            continue;
        }
        if hit(text(&p, "text")) || hit(text(&p, "title")) {
            let body = text(&p, "text");
            let snip = body
                .find(words[0])
                .map(|i| {
                    let chars = body.encode_utf16().collect::<Vec<_>>();
                    let utf_i = body[..i].encode_utf16().count();
                    let utf_start = utf_i.saturating_sub(25);
                    format!(
                        "{}{}…",
                        if utf_start > 0 { "…" } else { "" },
                        String::from_utf16_lossy(&chars[utf_start..(utf_i + 45).min(chars.len())])
                    )
                })
                .unwrap_or_default();
            out.push(json!({"title":p["title"],"url":p["url"],"snip":snip}));
        }
    }
    out.truncate(7);
    out
}
fn show(input: &web_sys::HtmlInputElement, list: &web_sys::Element) -> Result<(), JsValue> {
    load();
    list.set_text_content(None);
    let results = matches(&input.value());
    if results.is_empty() {
        list.set_inner_html(
            "<li class=\"sub\" style=\"padding:6px 8px\">nothing. the crow looked everywhere.</li>",
        );
        return Ok(());
    }
    for i in results {
        let li = element("li", None, None)?;
        let a = element("a", Some(text(&i, "title")), None)?;
        a.set_attribute("href", text(&i, "url"))?;
        if !text(&i, "snip").is_empty() {
            a.append_child(&element("small", Some(text(&i, "snip")), None)?.into())?;
        }
        li.append_child(&a)?;
        list.append_child(&li)?;
    }
    Ok(())
}
pub(super) fn search(container: web_sys::Element) -> Result<(), JsValue> {
    let b = element("div", None, Some("search"))?;
    b.set_inner_html("<button class=\"search-btn\" aria-label=\"search\">⌕</button>\n    <input class=\"search-in\" type=\"search\" placeholder=\"try: army or wiki\" aria-label=\"search the site\" autocomplete=\"off\">\n    <ul class=\"search-list\"></ul>");
    let input = b
        .query_selector("input")?
        .ok_or(JsValue::NULL)?
        .dyn_into::<web_sys::HtmlInputElement>()?;
    let list = b.query_selector("ul")?.ok_or(JsValue::NULL)?;
    let btn = b.query_selector("button")?.ok_or(JsValue::NULL)?;
    let box_ = b.clone();
    let i = input.clone();
    let l = list.clone();
    ui::listen(&btn.into(), "click", move |_| {
        if box_.class_list().toggle("open").unwrap_or(false) {
            let _ = i.focus();
            let _ = show(&i, &l);
        }
    })?;
    let i = input.clone();
    ui::listen(&input.clone().into(), "input", move |_| {
        let _ = show(&i, &list);
    })?;
    let i = input.clone();
    let box_ = b.clone();
    ui::listen(&input.into(), "keydown", move |e| {
        let Some(k) = e.dyn_ref::<web_sys::KeyboardEvent>() else {
            return;
        };
        if k.key() == "Enter" {
            if let Some(result) = matches(&i.value()).first()
                && let Ok(w) = window()
            {
                let _ = w.location().set_href(text(result, "url"));
            }
            capture("site_search", &json!({}));
        }
        if k.key() == "Escape" {
            let _ = box_.class_list().remove_1("open");
        }
    })?;
    let box_ = b.clone();
    ui::listen(&ui::doc()?.into(), "click", move |e| {
        let target = e.target().and_then(|n| n.dyn_into::<web_sys::Node>().ok());
        if !box_.contains(target.as_ref()) {
            let _ = box_.class_list().remove_1("open");
        }
    })?;
    container.insert_before(&b, container.first_child().as_ref())?;
    Ok(())
}
fn render() -> Result<(), JsValue> {
    let d = ui::doc()?;
    if d.get_element_by_id("corner-nav").is_some() {
        return Ok(());
    }
    let nav = element("div", None, Some("corner-nav"))?;
    nav.set_id("corner-nav");
    let path = window()?.location().pathname()?;
    if path != "/" {
        search(nav.clone())?;
    } else {
        d.body().ok_or(JsValue::NULL)?.append_child(&nav)?;
        return Ok(());
    }
    let back = element("a", Some("←"), None)?;
    back.set_attribute("href", "#")?;
    back.set_attribute("title", "back")?;
    back.set_attribute("aria-label", &crate::language::translate("nav.back"))?;
    ui::listen(&back.clone().into(), "click", move |e| {
        e.prevent_default();
        let _ = (|| -> Result<(), JsValue> {
            let w = window()?;
            if w.history()?.length()? > 1
                && ui::doc()?.referrer().starts_with(&w.location().origin()?)
            {
                w.history()?.back()?;
            } else {
                w.location().set_href("/realm/")?;
            }
            Ok(())
        })();
    })?;
    let home = element("a", Some("⌂"), None)?;
    home.set_attribute("href", &format!("{}/realm/", host()))?;
    home.set_attribute("title", "home")?;
    home.set_attribute("aria-label", &crate::language::translate("nav.home"))?;
    if !["join-the-army-now", "army", "legion", "soldier"]
        .contains(&path.split('/').nth(1).unwrap_or(""))
    {
        let army = element("a", Some("⚑"), Some("nav-army"))?;
        army.set_attribute("href", &format!("{}/join-the-army-now", host()))?;
        army.set_attribute("title", "join the army")?;
        army.set_attribute("aria-label", "join the army")?;
        nav.append_child(&army)?;
    }
    nav.append_child(&back)?;
    nav.append_child(&home)?;
    d.body().ok_or(JsValue::NULL)?.append_child(&nav)?;
    Ok(())
}
pub(super) fn init(callback: Option<js_sys::Function>) -> Result<(), JsValue> {
    crate::language::apply_language(None)?;
    crate::language::render_language_switcher(callback)?;
    render()
}
pub(super) fn start() -> Result<(), JsValue> {
    if STARTED.replace(true) {
        return Ok(());
    }
    eggs::start()?;
    let path = window()?.location().pathname()?;
    if [
        "now",
        "sidequests",
        "support",
        "languages",
        "call",
        "people",
        "gabe",
        "402",
    ]
    .contains(&path.split('/').nth(1).unwrap_or(""))
    {
        terminal::start()?;
    }
    Ok(())
}
