use super::*;
fn safe_url(s: &str) -> String {
    url::Url::parse(s)
        .ok()
        .filter(|u| u.scheme() == "https" && u.username().is_empty() && u.password().is_none())
        .map(|u| u.to_string())
        .unwrap_or_else(|| "#".into())
}
fn link(
    p: &Value,
    label: &str,
    url: &str,
    slot: &str,
    class: &str,
    preview: bool,
) -> Result<HtmlElement, JsValue> {
    let a = node("a", label, class)?;
    a.set_attribute(
        "href",
        &if preview {
            safe_url(url)
        } else {
            format!(
                "/api/legion?senate=1&action=click&slug={}&slot={slot}",
                enc(text(p, "slug"))
            )
        },
    )?;
    a.set_attribute("target", "_blank")?;
    a.set_attribute("rel", "noopener noreferrer")?;
    Ok(a)
}
pub(super) fn render(p: &Value, root: &HtmlElement, preview: bool) -> Result<(), JsValue> {
    let c = &p["content"];
    let fragment = ui::doc()?.create_document_fragment();
    let hero = node("section", "", "senate-hero")?;
    if !text(c, "photo").is_empty() {
        let img = node("img", "", "")?;
        for (k, v) in [
            ("src", text(c, "photo")),
            ("alt", text(p, "name")),
            ("width", "240"),
            ("height", "240"),
            ("referrerpolicy", "no-referrer"),
        ] {
            img.set_attribute(k, v)?;
        }
        append(&hero, &img)?;
    }
    let copy = node("div", "", "")?;
    for (tag, s, class) in [
        ("p", "Corvus Senate · honorary senator", "site-eyebrow"),
        ("h1", text(p, "name"), ""),
        ("span", text(p, "title"), "site-tag"),
        ("h2", text(c, "headline"), ""),
        ("p", text(c, "bio"), "senate-bio"),
    ] {
        append(&copy, &node(tag, s, class)?)?;
    }
    append(&hero, &copy)?;
    append(&fragment, &hero)?;
    let links = node("div", "", "site-actions")?;
    for (i, l) in rows(c, "links").iter().enumerate() {
        append(
            &links,
            &link(
                p,
                &format!("{} ↗", text(l, "label")),
                text(l, "url"),
                &i.to_string(),
                "site-button secondary",
                preview,
            )?,
        )?;
    }
    append(&fragment, &links)?;
    let h = &c["highlight"];
    if ["title", "text", "image"]
        .iter()
        .any(|k| !text(h, k).is_empty())
    {
        let block = node("section", "", "site-card senate-highlight")?;
        if !text(h, "image").is_empty() {
            let img = node("img", "", "")?;
            for (k, v) in [
                ("src", text(h, "image")),
                ("alt", text(h, "title")),
                ("loading", "lazy"),
            ] {
                img.set_attribute(k, v)?;
            }
            append(&block, &img)?;
        }
        append(&block, &node("h2", text(h, "title"), "")?)?;
        append(&block, &node("p", text(h, "text"), "senate-bio")?)?;
        append(&fragment, &block)?;
    }
    if !text(&c["cta"], "url").is_empty() {
        append(
            &fragment,
            &link(
                p,
                text(&c["cta"], "label"),
                text(&c["cta"], "url"),
                "cta",
                "site-button",
                preview,
            )?,
        )?;
    }
    append(
        &fragment,
        &node(
            "p",
            &if text(p, "last_edited_by").is_empty() {
                "A seat gifted by Gabe.".into()
            } else {
                format!(
                    "last edited by {} · {}",
                    text(p, "last_edited_by"),
                    date(text(p, "last_edited_at"), "toLocaleDateString")
                )
            },
            "site-fine",
        )?,
    )?;
    root.set_text_content(None);
    append(root, &fragment)
}
#[wasm_bindgen]
pub fn render_senate_profile(p: JsValue, root: HtmlElement, preview: bool) -> Result<(), JsValue> {
    render(&value(&p)?, &root, preview)
}
fn card(p: &Value, strip: bool) -> Result<HtmlElement, JsValue> {
    let a = node("a", "", "site-card")?;
    a.set_attribute("href", &format!("/legion/senate/{}", text(p, "slug")))?;
    if strip && !text(&p["content"], "photo").is_empty() {
        let img = node("img", "", "")?;
        for (k, v) in [
            ("src", text(&p["content"], "photo")),
            ("alt", ""),
            ("width", "64"),
            ("height", "64"),
            ("loading", "lazy"),
        ] {
            img.set_attribute(k, v)?;
        }
        img.style().set_property("border-radius", "50%")?;
        append(&a, &img)?;
    }
    append(&a, &node("strong", text(p, "name"), "")?)?;
    append(
        &a,
        &node(
            "span",
            &format!(
                "{}{}",
                if strip { "Senator · " } else { "" },
                text(p, "title")
            ),
            "site-tag",
        )?,
    )?;
    append(&a, &node("p", text(&p["content"], "headline"), "")?)?;
    Ok(a)
}
#[wasm_bindgen]
pub fn start_senate() -> Result<(), JsValue> {
    let doc = ui::doc()?;
    if let Ok(root) = ui::element("senate-profile")
        && !root.has_attribute("data-rust-senate")
    {
        root.set_attribute("data-rust-senate", "")?;
        let slug = last_path()?;
        if slug == "senate" {
            doc.set_title("The Senate · Friends of the Legion | corvus");
            root.set_text_content(None);
            for (tag, s, class) in [
                ("p", "friends of the legion", "site-eyebrow"),
                ("h1", "the Senate.", ""),
                (
                    "p",
                    "Builders who made something possible. A seat, a story, a shared standard.",
                    "",
                ),
            ] {
                append(&root, &node(tag, s, class)?)?;
            }
            let grid = node("div", "", "site-grid")?;
            append(&root, &grid)?;
            spawn_local(async move {
                let r=async{let d=api(None,"",true).await?;let profiles=rows(&d,"profiles");if profiles.is_empty(){append(&grid,&node("p","The first seats are being claimed. Meet the army while the Senate gathers.","")?)?;}for p in profiles{append(&grid,&card(&p,false)?)?;}Ok::<(),JsValue>(())}.await;
                if r.is_err()
                    && let Ok(p) = node(
                        "p",
                        "The Senate directory is temporarily unavailable. Please try again.",
                        "",
                    )
                {
                    let _ = append(&grid, &p);
                }
            });
            let links = node("div", "", "site-actions")?;
            for (label, url) in [
                ("Meet the Legion →", "/legion/"),
                ("Meet Dorian / Cardneto →", "/friends/cardneto/"),
                ("The Compound story →", "/compound/impact/"),
            ] {
                let a = node("a", label, "site-button secondary")?;
                a.set_attribute("href", url)?;
                append(&links, &a)?;
            }
            append(&root, &links)?;
        } else {
            spawn_local(async move {
                let r = async {
                    let p = api(None, &format!("&slug={}", enc(&slug)), true).await?;
                    ui::doc()?.set_title(&format!(
                        "{} · {} | Corvus Senate",
                        text(&p, "name"),
                        text(&p, "title")
                    ));
                    render(&p, &root, false)?;
                    let _ = api(Some(json!({"action":"view","slug":slug})), "", true).await;
                    Ok::<(), JsValue>(())
                }
                .await;
                if let Err(e) = r {
                    root.set_text_content(None);
                    for (tag, s) in [
                        ("h1", "a seat in the Senate.".into()),
                        ("p", ui::message(&e)),
                    ] {
                        if let Ok(n) = node(tag, &s, "") {
                            let _ = append(&root, &n);
                        }
                    }
                }
            });
        }
    }
    let strips = doc.query_selector_all("[data-senate-strip]")?;
    for i in 0..strips.length() {
        let Some(strip) = strips
            .item(i)
            .and_then(|n| n.dyn_into::<HtmlElement>().ok())
        else {
            continue;
        };
        if strip.has_attribute("data-rust-senate") {
            continue;
        }
        strip.set_attribute("data-rust-senate", "")?;
        spawn_local(async move {
            let r = async {
                let d = api(None, "", true).await?;
                let profiles = rows(&d, "profiles");
                strip.set_hidden(profiles.is_empty());
                if profiles.is_empty() {
                    return Ok(());
                }
                let grid = node("div", "", "site-grid")?;
                for p in profiles {
                    append(&grid, &card(&p, true)?)?;
                }
                let h = node(
                    "h2",
                    if strip.get_attribute("data-senate-strip").as_deref() == Some("home") {
                        "Friends of the Legion"
                    } else {
                        "the Senate."
                    },
                    "",
                )?;
                strip.set_text_content(None);
                append(&strip, &h)?;
                append(&strip, &grid)
            }
            .await;
            let _ = r;
        });
    }
    Ok(())
}
