//! Generated Army artwork only. No user-supplied SVG, filesystem images or system fonts.
use crate::Error;
use corvus_core::army_art::{escape, tag};
use serde_json::Value;
use std::sync::OnceLock;
pub fn profile(s: &Value) -> String {
    let name = s["username"].as_str().unwrap_or("");
    let copy = super::copy::copy("army", "en");
    let mut title = format!(
        "{name} · {} {}",
        copy["rankLabel"].as_str().unwrap_or(""),
        s["rank"].as_str().unwrap_or("")
    );
    if let Some(tier) = s["tier"].as_str().filter(|s| *s != "imperator") {
        title.push_str(&format!(
            " · {} {tier}",
            copy["tierLabel"].as_str().unwrap_or("")
        ));
    }
    title.push_str(" | corvus");
    let encoded = url::form_urlencoded::byte_serialize(name.as_bytes())
        .collect::<String>()
        .replace('+', "%20");
    let fields = [
        ("TITLE", escape(&title)),
        ("NAME", escape(name)),
        (
            "URL",
            escape(&format!("https://corvus.gent/soldier/{encoded}")),
        ),
        (
            "DESCRIPTION",
            escape(&format!(
                "{name} enlisted. {} recruits. one soldier at a time.",
                corvus_core::impact::string(&s["recruits"])
            )),
        ),
    ];
    let mut html = include_str!("../../../soldier/index.html").to_owned();
    for (key, value) in fields {
        html = html.replace(&format!("%%{key}%%"), &value);
    }
    html
}
fn options() -> &'static resvg::usvg::Options<'static> {
    static OPTIONS: OnceLock<resvg::usvg::Options<'static>> = OnceLock::new();
    OPTIONS.get_or_init(|| {
        let mut opt = resvg::usvg::Options {
            font_family: "DejaVu Sans Mono".into(),
            ..Default::default()
        };
        opt.fontdb_mut()
            .load_font_data(include_bytes!("../../../img/army/fonts/DejaVuSansMono.ttf").to_vec());
        // resvg does not synthesize the bold face used by the old renderer.
        opt.fontdb_mut().load_font_data(
            include_bytes!("../../migration/fonts/DejaVuSansMono-Bold.ttf").to_vec(),
        );
        opt.fontdb_mut().set_monospace_family("DejaVu Sans Mono");
        opt.image_href_resolver.resolve_string = Box::new(|_, _| None);
        opt.image_href_resolver.resolve_data = Box::new(|_, _, _| None);
        opt
    })
}
pub fn png(s: &Value, code: &str, poster: bool) -> Result<Vec<u8>, Error> {
    let svg = tag(s, code, poster, super::copy::copy("army", "en"))?;
    let tree = resvg::usvg::Tree::from_str(&svg, options())?;
    let size = tree.size().to_int_size();
    if size.width() > 1200 || size.height() > 1350 {
        return Err("image_size".into());
    }
    let mut image =
        resvg::tiny_skia::Pixmap::new(size.width(), size.height()).ok_or("image_size")?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::default(),
        &mut image.as_mut(),
    );
    Ok(image.encode_png()?)
}
