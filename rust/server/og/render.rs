//! Bounded native social cards. Fonts are bundled; SVG cannot read files or URLs.
use crate::{AppState, Error};
use corvus_core::army_art::escape;
use harfrust::{Buffer, Font, ShapeOptions, ShaperFont};
use image::{DynamicImage, ImageDecoder, ImageReader, Rgba, imageops::FilterType};
use serde_json::Value;
use std::{io::Cursor, sync::OnceLock, time::Duration};

const SANS: &[u8] = include_bytes!("../../../api/_og/fonts/NotoSans.ttf");
const MONO: &[u8] = include_bytes!("../../../img/army/fonts/DejaVuSansMono.ttf");
const HAN: &[u8] = include_bytes!("../../../api/_og/fonts/NotoSansSC.ttf");
const ARABIC: &[u8] = include_bytes!("../../../api/_og/fonts/NotoSansArabic.ttf");
const GOLD: &str = "#ffd76a";
const WHITE: &str = "#f1eee5";
fn s<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
fn clean(value: &str) -> String {
    static RE: OnceLock<Option<regex::Regex>> = OnceLock::new();
    RE.get_or_init(|| regex::Regex::new(r"\p{Extended_Pictographic}|[\u{200d}\u{fe0f}]").ok())
        .as_ref()
        .map(|r| r.replace_all(value, "").into_owned())
        .unwrap_or_else(|| value.to_owned())
}
#[derive(Clone, Copy)]
enum Face {
    Sans,
    Mono,
    Han,
    Arabic,
}
impl Face {
    fn name(self) -> &'static str {
        match self {
            Self::Sans => "Noto Sans",
            Self::Mono => "DejaVu Sans Mono",
            Self::Han => "Noto Sans SC",
            Self::Arabic => "Noto Sans Arabic",
        }
    }
    fn font(self) -> Result<&'static Font, Error> {
        static FONTS: OnceLock<[Option<Font>; 4]> = OnceLock::new();
        let fonts = FONTS.get_or_init(|| [SANS, MONO, HAN, ARABIC].map(|data| Font::new(data, 0)));
        fonts[match self {
            Self::Sans => 0,
            Self::Mono => 1,
            Self::Han => 2,
            Self::Arabic => 3,
        }]
        .as_ref()
        .ok_or_else(|| "card_font".into())
    }
    fn measure(self, text: &str, size: f32) -> Result<f32, Error> {
        let font = self.font()?;
        let shaper = ShaperFont::new(font);
        let mut buffer = Buffer::new();
        buffer.push_str(text);
        buffer.guess_segment_properties();
        harfrust::shape(&shaper, &mut buffer, ShapeOptions::new())?;
        Ok(buffer
            .glyph_positions()
            .iter()
            .map(|p| p.x_advance as f32)
            .sum::<f32>()
            * size
            / f32::from(font.units_per_em()))
    }
}
fn face(text: &str, lang: &str) -> Face {
    if ["ar", "fa"].contains(&lang) || text.chars().any(|c| ('\u{0600}'..='\u{06ff}').contains(&c))
    {
        Face::Arabic
    } else if lang == "zh" || text.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c)) {
        Face::Han
    } else {
        Face::Sans
    }
}
fn options() -> &'static resvg::usvg::Options<'static> {
    static OPT: OnceLock<resvg::usvg::Options<'static>> = OnceLock::new();
    OPT.get_or_init(|| {
        let mut opt = resvg::usvg::Options {
            font_family: "Noto Sans".into(),
            ..Default::default()
        };
        for bytes in [SANS, MONO, HAN, ARABIC] {
            opt.fontdb_mut().load_font_data(bytes.to_vec());
        }
        opt.image_href_resolver.resolve_string = Box::new(|_, _| None);
        opt.image_href_resolver.resolve_data = Box::new(|_, _, _| None);
        opt
    })
}
struct Canvas {
    svg: String,
    clips: usize,
}
impl Canvas {
    fn new() -> Self {
        Self {svg:r##"<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#08090b"/><rect x="1.5" y="1.5" width="1197" height="627" fill="none" stroke="#66542b" stroke-width="3"/>"##.into(),clips:0}
    }
    #[allow(clippy::too_many_arguments)]
    fn line(
        &mut self,
        text: &str,
        x: f32,
        y: f32,
        size: f32,
        color: &str,
        font: Face,
        spacing: f32,
    ) {
        self.svg.push_str(&format!(r##"<text x="{x}" y="{y}" font-family="{}" font-size="{size}" fill="{color}" letter-spacing="{spacing}">{}</text>"##,font.name(),escape(text)));
    }
    #[allow(clippy::too_many_arguments)]
    fn block(
        &mut self,
        raw: &str,
        x: f32,
        top: f32,
        width: f32,
        size: f32,
        line_height: f32,
        max_height: f32,
        color: &str,
        font: Face,
        _rtl: bool,
    ) -> Result<f32, Error> {
        let text = clean(raw);
        let mut lines = Vec::new();
        let mut current = String::new();
        for word in text.split_inclusive(char::is_whitespace) {
            let candidate = format!("{current}{word}");
            if font.measure(candidate.trim_end(), size)? <= width {
                current = candidate;
                continue;
            }
            if !current.trim().is_empty() {
                lines.push(current.trim_end().to_owned());
                current.clear();
            }
            // Chinese/long unbroken words still wrap; all other text prefers whole words.
            for c in word.chars() {
                let candidate = format!("{current}{c}");
                if font.measure(&candidate, size)? > width && !current.is_empty() {
                    lines.push(current);
                    current = String::new();
                }
                current.push(c);
            }
        }
        if !current.trim().is_empty() {
            lines.push(current.trim_end().to_owned());
        }
        let height = (lines.len() as f32 * size * line_height).min(max_height);
        self.clips += 1;
        let id = self.clips;
        self.svg.push_str(&format!(r##"<defs><clipPath id="text{id}"><rect x="{x}" y="{top}" width="{width}" height="{max_height}"/></clipPath></defs><g clip-path="url(#text{id})">"##));
        for (i, line) in lines.iter().enumerate() {
            let baseline =
                top + size * (1.0 + (line_height - 1.0) / 2.0) + i as f32 * size * line_height;
            if baseline - size > top + max_height {
                break;
            }
            // Explicit embedding keeps terminal punctuation at the RTL end; usvg's paragraph default is LTR.
            let shown = if matches!(font, Face::Arabic) {
                format!("\u{202b}{line}\u{202c}")
            } else {
                line.clone()
            };
            self.line(&shown, x, baseline, size, color, font, 0.0);
        }
        self.svg.push_str("</g>");
        Ok(height)
    }
    fn finish(mut self) -> String {
        self.svg.push_str("</svg>");
        self.svg
    }
}
/// Only the established interview Blob namespace, never arbitrary URLs or redirects.
pub fn allowed_photo(raw: &str) -> bool {
    url::Url::parse(raw).is_ok_and(|u| {
        u.username().is_empty()
            && u.password().is_none()
            && u.port_or_known_default() == Some(443)
            && crate::interviews::photos::photo_url(raw)
    })
}
pub async fn photo(state: &AppState, source: &str) -> Option<Vec<u8>> {
    if source == "gabe" {
        return Some(include_bytes!("../../migration/og-gabe.jpg").to_vec());
    }
    if !allowed_photo(source) {
        return None;
    }
    let fetch = async {
        let mut res = state
            .http
            .get(source)
            .timeout(Duration::from_millis(2200))
            .send()
            .await
            .ok()?;
        if !res.status().is_success() || res.content_length().is_some_and(|s| s > 2_500_000) {
            return None;
        }
        let mut data = Vec::new();
        while let Some(chunk) = res.chunk().await.ok()? {
            if data.len() + chunk.len() > 2_500_000 {
                return None;
            }
            data.extend_from_slice(&chunk);
        }
        Some(data)
    };
    tokio::time::timeout(Duration::from_millis(2200), fetch)
        .await
        .ok()
        .flatten()
}
fn portrait(data: &[u8]) -> Result<image::RgbaImage, Error> {
    if data.len() > 2_500_000 {
        return Err("card_photo_size".into());
    }
    let mut reader = ImageReader::new(Cursor::new(data)).with_guessed_format()?;
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(160 * 1024 * 1024);
    limits.max_image_width = Some(20000);
    limits.max_image_height = Some(20000);
    reader.limits(limits);
    let mut decoder = reader.into_decoder()?;
    let (w, h) = decoder.dimensions();
    if w == 0 || h == 0 || u64::from(w) * u64::from(h) > 20_000_000 {
        return Err("card_photo_pixels".into());
    }
    let orientation = decoder.orientation()?;
    let mut img = DynamicImage::from_decoder(decoder)?;
    img.apply_orientation(orientation);
    Ok(img
        .resize_to_fill(330, 438, FilterType::Lanczos3)
        .to_rgba8())
}
pub fn render(card: &Value, now: i64, bytes: Option<&[u8]>) -> Result<Vec<u8>, Error> {
    let portrait = bytes.and_then(|b| portrait(b).ok());
    let width = if portrait.is_some() { 720.0 } else { 1080.0 };
    let mut c = Canvas::new();
    let x = 51.0;
    c.line(
        &clean(s(card, "kicker")),
        x,
        70.0,
        19.0,
        GOLD,
        Face::Mono,
        2.0,
    );
    let is_compound = card["kind"] == "compound";
    if is_compound {
        let hub = card["isHub"] == true;
        let code = if hub { "$1,000" } else { s(card, "code") };
        let size = if hub {
            132.0
        } else if code.len() > 12 {
            88.0
        } else {
            112.0
        };
        let codeheight = c.block(
            code,
            x,
            102.0,
            width,
            size,
            1.1,
            170.0,
            GOLD,
            Face::Mono,
            false,
        )?;
        let line = if hub { "on the line." } else { s(card, "line") };
        let top = 102.0 + codeheight + 16.0;
        c.block(
            line,
            x,
            top,
            width,
            38.0,
            1.3,
            150.0,
            WHITE,
            face(line, s(card, "lang")),
            ["ar", "fa"].contains(&s(card, "lang")),
        )?;
        if hub {
            c.line(
                "One-man army. Many editors.",
                x,
                top + 49.4 + 50.0,
                30.0,
                GOLD,
                Face::Sans,
                0.0,
            );
        }
        c.svg.push_str(&format!(
            r##"<path d="M {x} 464 H {}" stroke="#66542b"/>"##,
            x + width
        ));
        c.line(
            &super::model::countdown(now),
            x,
            510.0,
            30.0,
            GOLD,
            Face::Mono,
            0.0,
        );
        let deadline = "MON 9 NOV · 09:00 PT";
        c.line(
            deadline,
            x + width - Face::Sans.measure(deadline, 23.0)?,
            504.0,
            23.0,
            GOLD,
            Face::Sans,
            0.0,
        );
    } else {
        let live = card["kind"] == "live";
        let mut y = 99.0;
        if live {
            c.svg
                .push_str(r##"<circle cx="60" cy="119" r="9" fill="#ef4444"/>"##);
            c.line("LIVE", 83.0, 130.0, 29.0, "#ff6c6c", Face::Mono, 0.0);
            y = 164.0;
        }
        let title = if live {
            "from a robotics hackathon in SF"
        } else {
            s(card, "title")
        };
        let size = if live {
            64.0
        } else if title.encode_utf16().count() > 50 {
            43.0
        } else {
            56.0
        };
        y += c.block(
            title,
            x,
            y,
            width,
            size,
            1.12,
            240.0,
            WHITE,
            face(title, s(card, "lang")),
            false,
        )?;
        if !s(card, "builder").is_empty() {
            let text = format!("built by {}", s(card, "builder"));
            y += 18.0;
            y += c.block(
                &text,
                x,
                y,
                width,
                29.0,
                1.35,
                75.0,
                GOLD,
                face(&text, ""),
                false,
            )?;
        }
        y += 20.0;
        let line = s(card, "line");
        c.block(
            line,
            x,
            y,
            width,
            if s(card, "builder").is_empty() {
                28.0
            } else {
                24.0
            },
            1.35,
            108.0,
            "#c5bfae",
            face(line, s(card, "lang")),
            false,
        )?;
    }
    c.line(
        if is_compound {
            "vote the next cut →"
        } else {
            "one-man army. many editors."
        },
        48.0,
        586.0,
        21.0,
        GOLD,
        Face::Sans,
        0.0,
    );
    let url = if card["kind"] == "live" {
        "corvus.gent/live"
    } else if is_compound {
        "corvus.gent/compound/v2"
    } else {
        "corvus.gent/hack/3"
    };
    c.line(
        url,
        1152.0 - Face::Mono.measure(url, 21.0)?,
        586.0,
        21.0,
        GOLD,
        Face::Mono,
        0.0,
    );
    let svg = c.finish();
    let tree = resvg::usvg::Tree::from_str(&svg, options())?;
    let mut pixels = resvg::tiny_skia::Pixmap::new(1200, 630).ok_or("card_size")?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::default(),
        &mut pixels.as_mut(),
    );
    if let Some(photo) = portrait {
        let mut rgb =
            image::RgbaImage::from_raw(1200, 630, pixels.data().to_vec()).ok_or("card_size")?;
        // The background is opaque, so tiny-skia premultiplication is already RGB-safe.
        for y in 0..438 {
            for x in 0..330 {
                let dx = (26.0 - (x.min(329 - x) as f32 + 0.5)).max(0.0);
                let dy = (26.0 - (y.min(437 - y) as f32 + 0.5)).max(0.0);
                if dx * dx + dy * dy <= 26.0 * 26.0 {
                    let edge = dx * dx + dy * dy > 24.0 * 24.0
                        || !(2..328).contains(&x)
                        || !(2..436).contains(&y);
                    let p = if edge {
                        Rgba([119, 97, 45, 255])
                    } else {
                        *photo.get_pixel(x, y)
                    };
                    rgb.put_pixel(x + 801, y + 51, p);
                }
            }
        }
        let mut out = Cursor::new(Vec::new());
        DynamicImage::ImageRgba8(rgb).write_to(&mut out, image::ImageFormat::Png)?;
        return Ok(out.into_inner());
    }
    Ok(pixels.encode_png()?)
}

pub fn duration(value: f64, avg: bool) -> String {
    let n = if value.is_finite() {
        value.floor().max(0.0) as u64
    } else {
        0
    };
    let h = n / 3600;
    let m = n % 3600 / 60;
    let s = n % 60;
    if h > 0 {
        if avg {
            format!("{h}h {m:02}m {s:02}s")
        } else {
            format!("{h}h {m}m")
        }
    } else if m > 0 {
        format!("{m}m {s:02}s")
    } else {
        format!("{s}s")
    }
}
fn grouped(value: f64) -> String {
    let s = format!("{value:.0}");
    let bytes = s.as_bytes();
    let mut out = String::new();
    for (i, c) in bytes.iter().enumerate() {
        if i > 0 && (bytes.len() - i).is_multiple_of(3) {
            out.push(',');
        }
        out.push(*c as char);
    }
    out
}
pub fn curiosity(stats: &Value) -> Result<Vec<u8>, Error> {
    let num = |k: &str| stats[k].as_f64().unwrap_or(0.0);
    let labels = [
        ("Players", grouped(num("players"))),
        ("Total play time", duration(num("total"), false)),
        ("Avg per player", duration(num("avg"), true)),
        ("Comments", grouped(num("comments"))),
        ("Shares", grouped(num("shares"))),
    ];
    let mut c = Canvas::new();
    c.svg=r##"<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101321"/><stop offset="1" stop-color="#2e1b38"/></linearGradient></defs><rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="9" fill="#d1ff9b"/>"##.into();
    c.line(
        "LIVE FROM THE BUILD",
        48.0,
        75.0,
        20.0,
        "#f0afd9",
        Face::Sans,
        3.0,
    );
    c.line(
        "Curiosity Craft",
        48.0,
        172.0,
        76.0,
        "#d1ff9b",
        Face::Sans,
        0.0,
    );
    c.line(
        "Kids level up by asking why",
        48.0,
        223.0,
        34.0,
        "#f4e9ff",
        Face::Sans,
        0.0,
    );
    for (i, (label, value)) in labels.iter().enumerate() {
        let x = 48.0 + i as f32 * 222.0;
        c.svg.push_str(&format!(r##"<rect x="{x}" y="280" width="210" height="156" rx="18" stroke="#66516c" fill="#ffffff" fill-opacity="0.0314"/>"##));
        let size = if value.len() > 9 {
            30.0
        } else if value.len() > 7 {
            37.0
        } else {
            49.0
        };
        c.line(
            value,
            x + 15.0,
            298.0 + size * 1.1,
            size,
            "#d1ff9b",
            Face::Sans,
            0.0,
        );
        c.line(
            label,
            x + 15.0,
            298.0 + size * 1.36 + 36.0,
            19.0,
            "#d6c5e1",
            Face::Sans,
            0.0,
        );
    }
    c.svg
        .push_str(r##"<path d="M48 531 H1152" stroke="#705165"/>"##);
    c.line(
        "PLAY. COMMENT. PASS IT ON.",
        48.0,
        579.0,
        21.0,
        "#f2c4e6",
        Face::Sans,
        0.0,
    );
    let url = "corvus.gent/curiositycraft";
    c.line(
        url,
        1152.0 - Face::Sans.measure(url, 21.0)?,
        579.0,
        21.0,
        "#d1ff9b",
        Face::Sans,
        0.0,
    );
    let tree = resvg::usvg::Tree::from_str(&c.finish(), options())?;
    let mut pixels = resvg::tiny_skia::Pixmap::new(1200, 630).ok_or("card_size")?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::default(),
        &mut pixels.as_mut(),
    );
    Ok(pixels.encode_png()?)
}
