use super::*;
#[derive(Default)]
struct Profile {
    soldier: Value,
    code: String,
}
fn profile_render(s: &Profile) -> Result<(), JsValue> {
    if s.soldier.is_null() {
        return Ok(());
    }
    let p = &s.soldier;
    ui::text("soldier-name", text(p, "username"));
    badges(&ui::element("soldier-ranks")?, p, false)?;
    let root = ui::element("soldier-metrics")?;
    root.set_text_content(None);
    for key in ["streak", "feathers", "recruits", "since"] {
        append(
            &root,
            &metric(
                &t(key),
                &string(&p[if key == "since" { "created" } else { key }]),
            )?,
        )?;
    }
    ui::text("soldier-recruit-url", &recruit(&s.code));
    if !text(p, "link").is_empty() {
        let e = ui::element("soldier-link")?;
        e.set_attribute("href", text(p, "link"))?;
        e.set_text_content(Some(&format!(
            "{} ↗",
            web_sys::Url::new(text(p, "link"))?.hostname()
        )));
        e.set_hidden(false);
    }
    tag("soldier-tag", p, &s.code)
}
#[wasm_bindgen]
pub fn start_army_profile() -> Result<(), JsValue> {
    if !once("profile")? {
        return Ok(());
    }
    let s = Rc::new(RefCell::new(Profile::default()));
    let s2 = s.clone();
    init(move || profile_render(&s2.borrow()))?;
    for (id, kind) in [
        ("soldier-copy", 0),
        ("soldier-share", 1),
        ("soldier-save", 2),
        ("soldier-poster", 3),
    ] {
        let s = s.clone();
        ui::listen(ui::element(id)?.as_ref(), "click", move |_| {
            let v = s.borrow();
            if v.code.is_empty() {
                return;
            }
            let p = v.soldier.clone();
            let code = v.code.clone();
            spawn_local(async move {
                match kind {
                    0 => copy(&code, "soldier-status").await,
                    1 => share(&code, "soldier-status").await,
                    _ => save_art(&p, &code, kind == 3, "soldier-status").await,
                }
            });
        })?;
    }
    let path = web_sys::window()
        .ok_or(JsValue::NULL)?
        .location()
        .pathname()?;
    let username = path
        .split('/')
        .filter(|v| !v.is_empty())
        .nth(1)
        .unwrap_or("")
        .to_owned();
    spawn_local(async move {
        let r = async {
            let v = api(None, &format!("?profile={}", enc(&username))).await?;
            {
                let mut s = s.borrow_mut();
                s.soldier = v["soldier"].clone();
                s.code = text(&v, "code").into();
            }
            profile_render(&s.borrow())
        }
        .await;
        if let Err(e) = r {
            ui::text("soldier-status", &error(&e));
        }
    });
    ready("profile");
    Ok(())
}
fn metric(label: &str, value: &str) -> Result<HtmlElement, JsValue> {
    let e = node("div", "", "")?;
    append(&e, &node("strong", value, "")?)?;
    append(&e, &node("span", label, "")?)?;
    Ok(e)
}
#[derive(Default)]
struct Wall {
    members: Vec<Value>,
    at_gate: Value,
    hidden: Value,
}
fn flag(code: &str) -> String {
    if code.len() == 2 && code.bytes().all(|c| c.is_ascii_uppercase()) {
        code.chars()
            .filter_map(|c| char::from_u32(127397 + c as u32))
            .collect()
    } else {
        String::new()
    }
}
fn wall(s: &Wall) -> Result<(), JsValue> {
    let search = input("legion-search")?.value().trim().to_lowercase();
    let tier = select("legion-tier")?.value();
    let country = select("legion-country")?.value();
    let root = ui::element("legion-list")?;
    root.set_text_content(None);
    let rows = s
        .members
        .iter()
        .filter(|m| {
            (search.is_empty() || text(m, "username").contains(&search))
                && (tier.is_empty() || text(m, "tier") == tier)
                && (country.is_empty() || text(m, "country") == country)
        })
        .collect::<Vec<_>>();
    for p in &rows {
        let e = node(
            "article",
            "",
            &format!(
                "legion-card tier-{}",
                if text(p, "tier").is_empty() {
                    "none"
                } else {
                    text(p, "tier")
                }
            ),
        )?;
        let a = node("a", text(p, "username"), "legion-name")?;
        a.set_attribute("href", &format!("/soldier/{}", enc(text(p, "username"))))?;
        append(&e, &a)?;
        let badge = node("div", "", "legion-badge")?;
        badges(&badge, p, true)?;
        append(&e, &badge)?;
        append(
            &e,
            &node(
                "p",
                &format!(
                    "{} {} {}",
                    flag(text(p, "country")),
                    t("since"),
                    text(p, "created")
                ),
                "army-fine",
            )?,
        )?;
        if !text(p, "link").is_empty() {
            let a = node(
                "a",
                &format!("{} ↗", web_sys::Url::new(text(p, "link"))?.hostname()),
                "legion-external",
            )?;
            a.set_attribute("href", text(p, "link"))?;
            a.set_attribute("rel", "noopener noreferrer")?;
            a.set_attribute("target", "_blank")?;
            append(&e, &a)?;
        }
        append(&root, &e)?;
    }
    ui::text(
        "legion-status",
        &if !rows.is_empty() {
            String::new()
        } else if !s.members.is_empty() {
            t("noResults")
        } else {
            let mut lines = vec![t("empty")];
            for (k, v) in [("legionAtGate", &s.at_gate), ("legionHidden", &s.hidden)] {
                if corvus_core::army::truthy(v) {
                    lines.push(tf(k, &json!({"n":v})));
                }
            }
            lines.join(" ")
        },
    );
    Ok(())
}
fn wall_countries(s: &Wall) -> Result<(), JsValue> {
    let e = select("legion-country")?;
    let value = e.value();
    let codes = s
        .members
        .iter()
        .map(|v| text(v, "country"))
        .filter(|v| !v.is_empty())
        .collect::<std::collections::BTreeSet<_>>();
    e.set_text_content(None);
    option(&e, &t("all"), "")?;
    for code in codes {
        option(&e, &region_name(code), code)?;
    }
    e.set_value(&value);
    Ok(())
}
#[wasm_bindgen]
pub fn start_army_wall() -> Result<(), JsValue> {
    if !once("wall")? {
        return Ok(());
    }
    let s = Rc::new(RefCell::new(Wall::default()));
    let ss = s.clone();
    init(move || {
        wall_countries(&ss.borrow())?;
        wall(&ss.borrow())
    })?;
    for id in ["legion-search", "legion-tier", "legion-country"] {
        let s = s.clone();
        ui::listen(ui::element(id)?.as_ref(), "input", move |_| {
            report(wall(&s.borrow()))
        })?;
    }
    spawn_local(async move {
        let r = async {
            let data = api(None, "?view=legion").await?;
            {
                let mut s = s.borrow_mut();
                s.members = arr(&data, "members");
                s.at_gate = data["atGate"].clone();
                s.hidden = data["hidden"].clone();
            }
            wall_countries(&s.borrow())?;
            wall(&s.borrow())
        }
        .await;
        if let Err(e) = r {
            ui::text("legion-status", &error(&e));
        }
    });
    ready("wall");
    Ok(())
}
fn war(data: &Value) -> Result<(), JsValue> {
    if data.is_null() {
        return Ok(());
    }
    let root = ui::element("war-counts")?;
    root.set_text_content(None);
    for (label, k) in [
        ("soldiers", "soldiers"),
        ("atGate", "atGate"),
        ("recruits", "recruits"),
        ("warApproved", "approved"),
    ] {
        append(
            &root,
            &metric(
                &t(label),
                &string(data.get(k).filter(|n| !n.is_null()).unwrap_or(&json!(0))),
            )?,
        )?;
    }
    for (id, k) in [
        ("war-leaderboard", "leaderboard"),
        ("war-recruiters", "recruiters"),
    ] {
        let root = ui::element(id)?;
        root.set_text_content(None);
        let rows = arr(data, k);
        for s in &rows {
            let e = node("li", "", "")?;
            let a = node("a", text(s, "username"), "")?;
            a.set_attribute("href", &format!("/soldier/{}", enc(text(s, "username"))))?;
            append(&e, &a)?;
            let label = if k == "recruiters" {
                format!("{} {}", string(&s["recruits"]), t("recruits"))
            } else {
                tf("rankPoints", &json!({"n":s["points"]}))
            };
            append(&e, &node("span", &label, "")?)?;
            let b = node("div", "", "")?;
            badges(&b, s, true)?;
            append(&e, &b)?;
            append(&root, &e)?;
        }
        if rows.is_empty() {
            root.set_text_content(Some(&t("empty")));
        }
    }
    for (id, k, label) in [
        ("war-ranks", "ranks", "rankLabel"),
        ("war-tiers", "tiers", "tierLabel"),
    ] {
        let root = ui::element(id)?;
        root.set_text_content(None);
        if let Some(map) = data[k].as_object() {
            for (name, count) in map {
                if k == "tiers" && name == "imperator" {
                    continue;
                }
                append(
                    &root,
                    &metric(&format!("{} {name}", t(label)), &string(count))?,
                )?;
            }
        }
    }
    Ok(())
}
async fn war_load(s: Rc<RefCell<Value>>) {
    if ui::doc().is_ok_and(|d| d.hidden()) {
        return;
    }
    match api(None, "?view=public").await {
        Ok(v) => {
            *s.borrow_mut() = v;
            report(war(&s.borrow()));
            ui::text("war-status", "");
        }
        Err(e) => ui::text("war-status", &error(&e)),
    }
}
#[wasm_bindgen]
pub fn start_army_war_room() -> Result<(), JsValue> {
    if !once("war")? {
        return Ok(());
    }
    let s = Rc::new(RefCell::new(Value::Null));
    let s2 = s.clone();
    init(move || war(&s2.borrow()))?;
    spawn_local(war_load(s.clone()));
    let callback = Closure::<dyn FnMut()>::new(move || {
        spawn_local(war_load(s.clone()));
    });
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let id = w.set_interval_with_callback_and_timeout_and_arguments_0(
        callback.as_ref().unchecked_ref(),
        30000,
    )?;
    callback.forget();
    let w2 = w.clone();
    ui::listen(w.as_ref(), "pagehide", move |_| {
        w2.clear_interval_with_handle(id)
    })?;
    ready("war");
    Ok(())
}
