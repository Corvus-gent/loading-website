//! Original Army SVG markup, with escaped text and a native byte-mode QR encoder.
use crate::army::truthy;
use qrcodegen::{QrCode, QrCodeEcc, QrSegment, Version};
use serde_json::Value;
use std::{fmt::Write, sync::OnceLock};
pub fn data() -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../../migration/army-art.json")).unwrap_or(Value::Null)
    })
}
pub fn escape(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            '&' => "&amp;".into(),
            '<' => "&lt;".into(),
            '>' => "&gt;".into(),
            '"' => "&quot;".into(),
            '\'' => "&#39;".into(),
            _ => c.to_string(),
        })
        .collect()
}
pub fn qr(url: &str, x: f64, y: f64, size: f64) -> Result<String, &'static str> {
    let qr = QrCode::encode_segments_advanced(
        &[QrSegment::make_bytes(url.as_bytes())],
        QrCodeEcc::Medium,
        Version::MIN,
        Version::MAX,
        None,
        false,
    )
    .map_err(|_| "qr")?;
    let n = qr.size();
    let unit = size / f64::from(n + 8);
    let mut path = String::new();
    for r in 0..n {
        for c in 0..n {
            if qr.get_module(c, r) {
                write!(
                    path,
                    "M{:.3} {:.3}h{unit:.3}v{unit:.3}h-{unit:.3}z",
                    x + f64::from(c + 4) * unit,
                    y + f64::from(r + 4) * unit
                )
                .map_err(|_| "qr")?;
            }
        }
    }
    Ok(format!(
        "<rect x=\"{x}\" y=\"{y}\" width=\"{size}\" height=\"{size}\" fill=\"#f4e8c9\"/><path d=\"{path}\" fill=\"#090909\"/>"
    ))
}
fn string(v: &Value) -> String {
    if v.is_null() {
        String::new()
    } else {
        crate::impact::string(v)
    }
}
pub fn tag(s: &Value, code: &str, poster: bool, labels: &Value) -> Result<String, &'static str> {
    let kind = if truthy(&s["tier"]) && s["tier"] != "imperator" {
        if ["senator", "consul"].contains(&s["tier"].as_str().unwrap_or("")) {
            "lifetime"
        } else {
            "tier"
        }
    } else {
        "plain"
    };
    let template = data()[format!("{}-{kind}", if poster { "poster" } else { "tag" })]
        .as_str()
        .ok_or("art")?;
    let username = if truthy(&s["username"]) {
        string(&s["username"])
    } else {
        "unknown soldier".into()
    };
    let serial = if truthy(&s["serial"]) {
        string(&s["serial"])
    } else {
        "0".into()
    };
    let serial = format!(
        "{}{}",
        "0".repeat(4usize.saturating_sub(serial.encode_utf16().count())),
        serial
    );
    let font = (650. / (username.encode_utf16().count() as f64 * 0.62)).min(if poster {
        44.
    } else {
        60.
    });
    let qr = qr(
        &format!("https://corvus.gent/r/{code}"),
        if poster { 790. } else { 825. },
        if poster { 1025. } else { 330. },
        if poster { 212. } else { 136. },
    )?;
    let fields = [
        ("NAME", escape(&username)),
        ("SERIAL", escape(&serial)),
        ("CREATED", escape(&string(&s["created"]))),
        (
            "RANK",
            escape(if truthy(&s["rank"]) {
                s["rank"].as_str().unwrap_or("")
            } else {
                "tiro"
            }),
        ),
        ("TIER", escape(&string(&s["tier"]))),
        ("CODE", escape(code)),
        ("RANKLABEL", escape(&string(&labels["rankLabel"]))),
        ("TIERLABEL", escape(&string(&labels["tierLabel"]))),
        ("LIFETIME", escape(&string(&labels["supporterLifetime"]))),
        ("FONTSIZE", font.to_string()),
        ("QR", qr),
    ];
    let pattern = regex::Regex::new(r"__RUST_([A-Z]+)__").map_err(|_| "art")?;
    Ok(pattern
        .replace_all(template, |cap: &regex::Captures<'_>| {
            fields
                .iter()
                .find(|(k, _)| *k == &cap[1])
                .map(|(_, v)| v.clone())
                .unwrap_or_default()
        })
        .into_owned())
}
pub fn insignia(name: &str, size: u32) -> String {
    let n = match name {
        "miles" => 1,
        "decanus" => 2,
        "optio" => 3,
        "centurio" => 4,
        "tribunus" => 5,
        "legatus" => 6,
        "imperator" => 8,
        _ => 0,
    };
    let mut mark = if n == 0 {
        "<circle cx=\"24\" cy=\"24\" r=\"3\" fill=\"currentColor\"/>".into()
    } else {
        (0..n.min(3))
            .map(|i| format!("<path d=\"M10 {}l14-8 14 8\"/>", 17 + i * 8))
            .collect::<String>()
    };
    if n >= 4 {
        mark = "<path d=\"M24 6l5 11 12 2-9 9 2 13-10-6-10 6 2-13-9-9 12-2z\"/>".into();
        if n >= 5 {
            mark.push_str("<circle cx=\"24\" cy=\"24\" r=\"4\"/>");
        }
        if n >= 6 {
            mark.push_str("<path d=\"M5 8v32M43 8v32\"/>");
        }
        if n >= 7 {
            mark.push_str("<path d=\"M10 45h28\"/>");
        }
        if n == 8 {
            mark.push_str("<circle cx=\"24\" cy=\"24\" r=\"22\"/>");
        }
    }
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" aria-hidden=\"true\">{mark}</svg>"
    )
}
