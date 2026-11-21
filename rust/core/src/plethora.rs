use serde::{Deserialize, Serialize};

pub const PLACEMENTS: &[&str] = &[
    "daily", "hub", "start", "gameover", "promo", "pause", "celtix", "babel", "borders", "wordle",
    "flags", "combo", "bangle", "pingle", "lantern", "battle", "legion", "home", "404", "share",
    "footer", "compound", "hack", "x", "li", "ig", "tt", "wa", "game", "qr", "twitch", "story",
    "bio-x", "bio-ig", "bio-tt",
];

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Destination {
    Download,
    Ossman,
}

pub fn canonical(value: &str) -> Option<&'static str> {
    let id = value.strip_prefix("plethora-").unwrap_or(value);
    if id == "bio" {
        return Some("bio-x");
    }
    PLACEMENTS
        .iter()
        .copied()
        .find(|candidate| *candidate == id)
}

pub fn destination(id: &str) -> Option<Destination> {
    canonical(id).map(|id| match id {
        "start" | "gameover" | "promo" | "pause" | "battle" | "hack" | "celtix" | "compound"
        | "game" => Destination::Ossman,
        _ => Destination::Download,
    })
}

pub fn official_url(value: &str) -> Option<String> {
    let id = canonical(value)?;
    let base = match destination(id)? {
        Destination::Download => "https://plethora.studio/download?utm_source=gabe",
        Destination::Ossman => "https://share.plethora.studio/retro/ossman?code=GABE",
    };
    Some(format!("{base}&utm_medium=corvus&utm_content={id}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_registered_links() {
        for id in PLACEMENTS {
            assert!(official_url(id).is_some());
        }
        for id in ["../home", "HOME", "home&ref=evil", "", "__proto__"] {
            assert_eq!(official_url(id), None);
        }
        assert_eq!(canonical("plethora-bio"), Some("bio-x"));
        assert_eq!(destination("game"), Some(Destination::Ossman));
    }
}
