//! Arrival tags remain in page memory only; URL cleanup never writes tracking storage.
use std::cell::RefCell;
use wasm_bindgen::prelude::*;
thread_local! {static ARRIVAL:RefCell<Option<(String,bool)>>=const{RefCell::new(None)};}
#[wasm_bindgen]
pub fn start_arrival(search: &str, pathname: &str) {
    ARRIVAL.with_borrow_mut(|state| {
        if state.is_none() {
            let tags = url::form_urlencoded::parse(search.trim_start_matches('?').as_bytes())
                .filter(|(k, _)| k.to_ascii_lowercase().starts_with("utm_"))
                .map(|(k, v)| (k.into_owned(), v.into_owned()))
                .collect::<Vec<_>>();
            let encoded = url::form_urlencoded::Serializer::new(String::new())
                .extend_pairs(tags)
                .finish();
            *state = Some((
                if encoded.is_empty() {
                    encoded
                } else {
                    format!("?{encoded}")
                },
                matches!(pathname, "/sidequests" | "/sidequests/"),
            ));
        }
    });
}
#[wasm_bindgen]
pub fn arrival_search() -> String {
    ARRIVAL.with_borrow(|s| s.as_ref().map(|(s, _)| s.clone()).unwrap_or_default())
}
#[wasm_bindgen]
pub fn sidequests_page() -> bool {
    ARRIVAL.with_borrow(|s| s.as_ref().is_some_and(|(_, b)| *b))
}
#[wasm_bindgen]
pub fn clear_tracking_url() {
    let _ = clear();
}
fn clear() -> Result<(), JsValue> {
    let Some(w) = web_sys::window() else {
        return Ok(());
    };
    let original = w.location().href()?;
    let Ok(mut u) = url::Url::parse(&original) else {
        return Ok(());
    };
    let side = sidequests_page();
    let mut changed = false;
    if side && u.path().ends_with('/') {
        u.set_path("/sidequests");
        changed = true;
    }
    let pairs = u
        .query_pairs()
        .filter_map(|(k, v)| {
            if k.to_ascii_lowercase().starts_with("utm_") || !side && k.eq_ignore_ascii_case("ref")
            {
                changed = true;
                None
            } else {
                Some((k.into_owned(), v.into_owned()))
            }
        })
        .collect::<Vec<_>>();
    if changed {
        if pairs.is_empty() {
            u.set_query(None);
        } else {
            u.query_pairs_mut().clear().extend_pairs(pairs);
        }
        let target = format!(
            "{}{}{}",
            u.path(),
            u.query().map(|q| format!("?{q}")).unwrap_or_default(),
            u.fragment().map(|h| format!("#{h}")).unwrap_or_default()
        );
        let history = w.history()?;
        history.replace_state_with_url(&history.state()?, "", Some(&target))?;
    }
    Ok(())
}
