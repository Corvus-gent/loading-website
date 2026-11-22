//! Privacy page content is compiled unchanged from the existing seven locale files.
use crate::{consent, language, privacy, ui};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{Element, HtmlButtonElement};
const PROVIDERS: [(&str, &str); 11] = [
    ("Vercel", "https://vercel.com/legal/privacy-notice"),
    ("PostHog EU", "https://posthog.com/privacy"),
    ("Resend", "https://resend.com/legal/privacy-policy"),
    ("Upstash", "https://upstash.com/trust/privacy.pdf"),
    ("Redis Cloud", "https://redis.io/legal/privacy-policy/"),
    ("CARTO", "https://carto.com/privacy"),
    ("Spotify", "https://www.spotify.com/legal/privacy-policy/"),
    ("Apple", "https://www.apple.com/legal/privacy/"),
    ("Buy Me a Coffee", "https://buymeacoffee.com/privacy-policy"),
    ("Pidgy", "https://app.pidgy-ai.com/privacy-policy"),
    ("Notion", "https://www.notion.com/privacy"),
];
fn node(tag: &str, text: &str) -> Result<Element, JsValue> {
    let el = ui::doc()?.create_element(tag)?;
    el.set_text_content(Some(text));
    Ok(el)
}
fn choice_labels() -> Result<(), JsValue> {
    let lang = language::get_language();
    let copy = &privacy::data()["strings"][&lang];
    ui::text(
        "analytics-choice-title",
        copy["change"].as_str().unwrap_or(""),
    );
    ui::text(
        "analytics-status",
        copy[if consent::privacy_signal() {
            "signal"
        } else if consent::analytics_allowed() {
            "on"
        } else {
            "off"
        }]
        .as_str()
        .unwrap_or(""),
    );
    let allow = ui::element("analytics-allow")?.dyn_into::<HtmlButtonElement>()?;
    allow.set_text_content(copy["allow"].as_str());
    allow.set_disabled(consent::choice()["choice"] == "allow");
    ui::text(
        "analytics-deny",
        copy[if consent::analytics_allowed() {
            "withdraw"
        } else {
            "deny"
        }]
        .as_str()
        .unwrap_or(""),
    );
    Ok(())
}
#[wasm_bindgen]
pub fn render_privacy_page() -> Result<(), JsValue> {
    let lang = language::get_language();
    let data = privacy::data();
    let copy = &data["pages"][&lang];
    choice_labels()?;
    ui::text(
        "analytics-choice-info",
        copy["consentInfo"].as_str().unwrap_or(""),
    );
    ui::doc()?.set_title(&format!(
        "{} | corvus.gent",
        copy["title"].as_str().unwrap_or("")
    ));
    ui::text("privacy-title", copy["title"].as_str().unwrap_or(""));
    ui::text(
        "privacy-meta",
        &format!(
            "{} · {}",
            copy["updated"].as_str().unwrap_or(""),
            data["version"].as_str().unwrap_or("")
        ),
    );
    let intro = ui::element("privacy-intro")?;
    intro.set_text_content(None);
    for text in copy["intro"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|v| v.as_str())
    {
        intro.append_child(&node("p", text)?.into())?;
    }
    let sections = ui::element("privacy-sections")?;
    sections.set_text_content(None);
    for row in copy["sections"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|v| v.as_array())
        .filter(|a| a.len() >= 2)
    {
        let section = node("section", "")?;
        section.set_id(row[0].as_str().unwrap_or(""));
        section.append_child(&node("h2", row[1].as_str().unwrap_or(""))?.into())?;
        for text in row.iter().skip(2).filter_map(|v| v.as_str()) {
            let p = node("p", "")?;
            // This HTML comes exclusively from local, reviewed translation assets.
            p.set_inner_html(text);
            section.append_child(&p)?;
        }
        sections.append_child(&section)?;
    }
    let stream = node("section", "")?;
    stream.append_child(&node("h2", "Twitch")?.into())?;
    stream.append_child(&node("p", data["streamPrivacy"][&lang].as_str().unwrap_or(""))?.into())?;
    let link = node("a", "Twitch · privacy ↗")?;
    link.set_attribute("href", "https://www.twitch.tv/p/en/legal/privacy-notice/")?;
    stream.append_child(&link)?;
    sections.append_child(&stream)?;
    let army = node("section", "")?;
    army.set_id("legion-privacy");
    for (i, text) in data["army"][&lang]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|v| v.as_str())
        .enumerate()
    {
        army.append_child(&node(if i == 0 { "h2" } else { "p" }, text)?.into())?;
    }
    let account = node("a", "corvus.gent/army/access →")?;
    account.set_attribute("href", "/army/access/")?;
    army.append_child(&account)?;
    sections.append_child(&army)?;
    ui::text(
        "privacy-providers-title",
        copy["providersTitle"].as_str().unwrap_or(""),
    );
    ui::text(
        "privacy-providers-note",
        copy["providersNote"].as_str().unwrap_or(""),
    );
    let list = ui::element("privacy-providers")?;
    list.set_text_content(None);
    for (i, (name, url)) in PROVIDERS.iter().enumerate() {
        let li = node("li", "")?;
        let a = node(
            "a",
            &format!("{name} · {}", copy["roles"][i].as_str().unwrap_or("")),
        )?;
        a.set_attribute("href", url)?;
        a.set_attribute("rel", "noreferrer")?;
        li.append_child(&a)?;
        list.append_child(&li)?;
    }
    Ok(())
}
#[wasm_bindgen]
pub fn start_privacy_page() -> Result<(), JsValue> {
    consent::start_consent()?;
    let el = ui::element("analytics-choice")?;
    if el.has_attribute("data-rust-privacy-page") {
        return Ok(());
    }
    el.set_attribute("data-rust-privacy-page", "")?;
    for (id, choice) in [("analytics-allow", "allow"), ("analytics-deny", "deny")] {
        ui::listen(ui::element(id)?.as_ref(), "click", move |_| {
            consent::choose_analytics(choice)
        })?;
    }
    if let Some(w) = web_sys::window() {
        ui::listen(w.as_ref(), "analytics-consent-change", |_| {
            let _ = choice_labels();
        })?;
    }
    render_privacy_page()
}
