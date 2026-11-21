use super::*;
use std::cell::RefCell;
const SPOTS: [(&str, &str); 7] = [
    ("/", "top:45%;left:6px;transform:rotate(-20deg)"),
    ("/now/", "top:40%;right:6px;transform:rotate(40deg)"),
    ("/sidequests/", "top:62%;right:14px"),
    ("/support/", "top:120px;left:8px;transform:rotate(-30deg)"),
    (
        "/support/books/",
        "top:30%;right:10px;transform:rotate(15deg)",
    ),
    ("/languages/", "top:55%;left:10px;transform:rotate(160deg)"),
    ("/call/", "top:35%;left:10px;transform:rotate(90deg)"),
];
const LINES: [&str; 7] = [
    "coo.",
    "a Pidgy feather.",
    "Pidgy was here.",
    "inbox zero tastes like this.",
    "the flock sees you.",
    "follow the feathers.",
    "almost there.",
];
#[derive(Default)]
struct State {
    started: bool,
    memory: Vec<String>,
    identity: bool,
    ready: bool,
    server: Vec<String>,
    syncing: bool,
    toast: i32,
}
thread_local! {static STATE:RefCell<State>=RefCell::new(State::default());}
fn valid(s: &str) -> bool {
    SPOTS.iter().any(|(p, _)| *p == s)
}
fn found() -> Vec<String> {
    let mut result = STATE.with_borrow(|s| s.memory.clone());
    for id in preference("feathers")
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
    {
        if !result.iter().any(|p| p == id) {
            result.push(id.into());
        }
    }
    result.retain(|s| valid(s));
    result
}
fn save(v: Vec<String>) {
    save_preference("feathers", &json!(v));
    STATE.with_borrow_mut(|s| s.memory = v);
}
fn merge(v: &Value) {
    let identity = v.is_object();
    STATE.with_borrow_mut(|s| s.identity = identity);
    if !identity {
        return;
    }
    let spots = v
        .get("featherSpots")
        .or_else(|| v.get("feathers"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .filter(|s| valid(s))
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let mut f = found();
    for id in &spots {
        if !f.contains(id) {
            f.push(id.clone());
        }
    }
    STATE.with_borrow_mut(|s| s.server = spots);
    save(f);
    let _ = render();
}
fn sync() {
    if !STATE.with_borrow(|s| s.ready && s.identity && !s.syncing) {
        return;
    }
    STATE.with_borrow_mut(|s| s.syncing = true);
    wasm_bindgen_futures::spawn_local(async {
        for _ in 0..7 {
            let Some(spot) = found()
                .into_iter()
                .find(|id| !STATE.with_borrow(|s| s.server.contains(id)))
            else {
                break;
            };
            match crate::army_transport::submit("feather", json!({"spot":spot})).await {
                Ok(v) => merge(&v["self"]),
                Err(_) => break,
            }
        }
        STATE.with_borrow_mut(|s| s.syncing = false);
    });
}
fn toast(html: &str) -> Result<(), JsValue> {
    let e = if let Some(e) = ui::doc()?.get_element_by_id("egg-toast") {
        e
    } else {
        let e = element("div", None, Some("egg-toast"))?;
        e.set_id("egg-toast");
        ui::doc()?.body().ok_or(JsValue::NULL)?.append_child(&e)?;
        e
    };
    e.set_inner_html(html);
    e.class_list().add_1("show")?;
    cancel(STATE.with_borrow(|s| s.toast));
    let timer = later(3500, move || {
        let _ = e.class_list().remove_1("show");
    })?;
    STATE.with_borrow_mut(|s| s.toast = timer);
    Ok(())
}
fn collect(id: &str) -> Result<(), JsValue> {
    let mut f = found();
    if f.iter().any(|s| s == id) {
        return toast(&format!("🪶 already caught · {}/7", f.len()));
    }
    f.push(id.into());
    let n = f.len();
    save(f);
    render()?;
    toast(&if n >= 7 {
        format!(
            "🪶 {n}/7. you found the whole flock. <a href=\"/links/gabe\">claim your free Pidgy trial →</a>"
        )
    } else {
        format!("🪶 {} {n}/7 feathers found.", LINES[(n - 1) % 7])
    })?;
    sync();
    capture("feather_found", &json!({"id":id,"total":n}));
    Ok(())
}
pub(super) fn realm() -> Result<(), JsValue> {
    let saved = preference("realm-feather");
    let id = if let Some(s) = saved.as_str().filter(|s| valid(s)) {
        s.to_owned()
    } else {
        let f = found();
        let id = SPOTS
            .iter()
            .find(|(p, _)| !f.iter().any(|s| s == p))
            .map(|(p, _)| *p)
            .unwrap_or("/");
        save_preference("realm-feather", &json!(id));
        id.to_owned()
    };
    collect(&id)
}
fn render() -> Result<(), JsValue> {
    let path = window()?.location().pathname()?;
    let page = format!("{}/", path.strip_suffix('/').unwrap_or(&path));
    let Some((_, style)) = SPOTS.iter().find(|(p, _)| *p == page) else {
        return Ok(());
    };
    let f = found();
    let caught = f.contains(&page);
    let previous = ui::doc()?.get_element_by_id("hidden-feather");
    let fresh = previous.is_none();
    let button = previous.unwrap_or(element("button", None, None)?);
    button.set_id("hidden-feather");
    button.set_attribute("type", "button")?;
    button.set_class_name(if caught { "feather-caught" } else { "feather" });
    button.set_attribute(
        "aria-label",
        &if caught {
            format!("already caught · {}/7", f.len())
        } else {
            "catch the feather".into()
        },
    )?;
    button.set_attribute("style", style)?;
    button.set_text_content(None);
    if caught {
        button.set_text_content(Some("caught"));
    } else {
        let img = element("img", None, None)?;
        img.set_attribute("src", "/img/feather.png")?;
        img.set_attribute("alt", "")?;
        button.append_child(&img)?;
    }
    if fresh {
        ui::listen(&button.clone().into(), "click", move |e| {
            e.stop_propagation();
            let _ = collect(&page);
        })?;
        ui::doc()?
            .body()
            .ok_or(JsValue::NULL)?
            .append_child(&button)?;
    }
    Ok(())
}
pub(super) fn start() -> Result<(), JsValue> {
    if STATE.with_borrow_mut(|s| std::mem::replace(&mut s.started, true)) {
        return Ok(());
    }
    render()?;
    if window()?.location().pathname()? == "/now/" {
        let p = element("img", None, Some("peek"))?;
        p.set_attribute("src", "/img/sticky-pidgy.png")?;
        p.set_attribute("alt", "")?;
        ui::listen(&p.clone().into(), "click", move |_| {
            let _ = toast(
                "Pidgy remembers what you forget. <a href=\"https://pidgy-ai.com\" target=\"_blank\" rel=\"noreferrer\">pidgy-ai.com</a>",
            );
        })?;
        ui::doc()?.body().ok_or(JsValue::NULL)?.append_child(&p)?;
    }
    wasm_bindgen_futures::spawn_local(async {
        let v = get("/api/army", web_sys::RequestCache::NoStore, 8000)
            .await
            .unwrap_or(Value::Null);
        merge(&v["self"]);
        STATE.with_borrow_mut(|s| s.ready = true);
        sync();
    });
    Ok(())
}
