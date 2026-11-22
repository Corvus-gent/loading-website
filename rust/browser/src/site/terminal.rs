use super::*;
use std::cell::RefCell;
thread_local! {static STARTED:RefCell<bool>=const{RefCell::new(false)};static HINT:RefCell<i32>=const{RefCell::new(0)};static NOTE:RefCell<i32>=const{RefCell::new(0)};}
const PAGES: [(&str, &str); 8] = [
    ("402", "/402/"),
    ("home", "/"),
    ("about", "/gabe"),
    ("now", "/now/"),
    ("sidequests", "/sidequests/"),
    ("support", "/support/"),
    ("languages", "/languages/"),
    ("cv", "/cv"),
];
fn one(selector: &str) -> Result<web_sys::Element, JsValue> {
    ui::doc()?
        .query_selector(selector)?
        .ok_or_else(|| "Terminal unavailable".into())
}
fn print(lines: &[String], class: &str) -> Result<(), JsValue> {
    let out = one(".term-out")?;
    for line in lines {
        out.append_child(
            &element("div", Some(line), (!class.is_empty()).then_some(class))?.into(),
        )?;
    }
    out.set_scroll_top(out.scroll_height());
    Ok(())
}
fn go(url: &str) -> Result<(), JsValue> {
    let url = url.to_owned();
    later(500, move || {
        if let Ok(w) = window() {
            let _ = w.location().set_href(&url);
        }
    })?;
    Ok(())
}
fn close() {
    if let Ok(dialog) = one("dialog.term").and_then(|e| {
        e.dyn_into::<web_sys::HtmlDialogElement>()
            .map_err(Into::into)
    }) {
        dialog.close();
    }
}
async fn run(raw: String) -> Result<(), JsValue> {
    let mut words = raw.split_whitespace();
    let cmd = words.next().unwrap_or("");
    let args = words.collect::<Vec<_>>();
    print(&[format!("$ {raw}")], "term-cmd")?;
    if cmd.is_empty() {
        return Ok(());
    }
    if cmd == "clear" {
        one(".term-out")?.set_text_content(None);
        return Ok(());
    }
    if cmd == "cd" {
        let arg = args.first().copied().unwrap_or("");
        if let Some((_, url)) = PAGES.iter().find(|(k, _)| !k.is_empty() && *k == arg) {
            print(&[format!("→ {arg}")], "")?;
            go(url)?;
        } else {
            print(&[format!("cd: no such page: {arg}")], "")?;
        }
        return Ok(());
    }
    if cmd == "lang" {
        let lang = args.first().copied().unwrap_or("en");
        let url = web_sys::Url::new(&window()?.location().href()?)?;
        url.search_params().set("lang", lang);
        print(&[format!("→ {lang}")], "")?;
        go(&url.href())?;
        return Ok(());
    }
    let lines: Vec<String> = match cmd {
        "help" => vec![
            "available commands:",
            "  whoami · now · sidequests · support · location · cv · contact · live",
            "  ls · cd <page> · lang <en|nl|fr|es|pt|de|zh> · clear · exit",
            "  (there might be more. sudo is watching.)",
        ]
        .into_iter()
        .map(str::to_owned)
        .collect(),
        "whoami" => vec![
            "gabe. gtm @ pidgy. upcoming business philosopher.".into(),
            "dropped out with one year left. got bored. wanted to build.".into(),
        ],
        "now" | "sidequests" | "support" => {
            go(&format!("/{cmd}/"))?;
            vec![format!("opening /{cmd} ...")]
        }
        "cv" => {
            go("/cv")?;
            vec!["opening cv ...".into()]
        }
        "contact" => {
            go("mailto:gabriel@corvus.gent")?;
            vec!["gabriel@corvus.gent".into()]
        }
        "live" => vec![
            "twitch → https://corvus.gent/go/twitch".into(),
            "instagram → https://corvus.gent/go/instagram".into(),
            "x → https://corvus.gent/go/twitter".into(),
        ],
        "ls" => vec![
            PAGES
                .iter()
                .filter(|(k, _)| !k.is_empty())
                .map(|(k, _)| *k)
                .collect::<Vec<_>>()
                .join("  "),
        ],
        "location" => vec![
            match get("/location.json", web_sys::RequestCache::NoStore, 8000).await {
                Ok(v) => format!(
                    "currently in: {}",
                    v.get("city")
                        .map(|v| v
                            .as_str()
                            .map(str::to_owned)
                            .unwrap_or_else(|| v.to_string()))
                        .unwrap_or("undefined".into())
                ),
                Err(_) => "currently in: unknown".into(),
            },
        ],
        "diogenes" => vec!["stand a little out of my sun.".into()],
        "lantern" => vec!["still looking for an honest man.".into()],
        "pay" => vec!["402 payment required.".into()],
        "pidgy" => vec!["coo. 🐦".into(), "→ pidgy-ai.com".into()],
        "coo" => vec!["coo coo.".into()],
        "headache" => {
            go("/img/paracetamail.png")?;
            vec![
                "fast-acting inbox relief: paracetamail® 500 mg".into(),
                "side effects may include free time.".into(),
            ]
        }
        "sudo" => {
            if args.join(" ") == "hire gabe" {
                vec!["permission granted.".into(), "→ gabriel@corvus.gent".into()]
            } else {
                vec!["nice try.".into()]
            }
        }
        "exit" => {
            close();
            vec![]
        }
        _ => vec![format!("command not found: {cmd}. try 'help'.")],
    };
    print(&lines, "")?;
    let known = [
        "help",
        "whoami",
        "now",
        "sidequests",
        "support",
        "cv",
        "contact",
        "live",
        "ls",
        "location",
        "diogenes",
        "lantern",
        "pay",
        "pidgy",
        "coo",
        "headache",
        "sudo",
        "exit",
    ]
    .contains(&cmd);
    capture(
        "terminal_command",
        &json!({"command":if known{cmd}else{"unknown"}}),
    );
    Ok(())
}
fn build() -> Result<(), JsValue> {
    let dialog = element("dialog", None, Some("term"))?.dyn_into::<web_sys::HtmlDialogElement>()?;
    dialog.set_attribute("aria-label", "terminal")?;
    dialog.set_inner_html(include_str!("../../site-terminal.html").trim_end());
    ui::doc()?
        .body()
        .ok_or(JsValue::NULL)?
        .append_child(&dialog)?;
    print(&["corvus.gent terminal. type 'help'.".into()], "")?;
    let input = one(".term input")?.dyn_into::<web_sys::HtmlInputElement>()?;
    let i = input.clone();
    ui::listen(&input.into(), "keydown", move |e| {
        if e.dyn_ref::<web_sys::KeyboardEvent>()
            .is_some_and(|k| k.key() == "Enter")
        {
            let raw = i.value();
            i.set_value("");
            wasm_bindgen_futures::spawn_local(async move {
                let _ = run(raw).await;
            });
        }
    })?;
    let d = dialog.clone();
    ui::listen(&dialog.clone().into(), "close", move |_| {
        let _ = d.style().set_property("display", "none");
    })?;
    let d = dialog.clone();
    ui::listen(&dialog.into(), "click", move |e| {
        if e.target().as_ref() == Some(d.as_ref()) {
            close();
        }
    })?;
    Ok(())
}
pub(super) fn open(first: &str) -> Result<(), JsValue> {
    if nodes("dialog.term").is_empty() {
        build()?;
    }
    let dialog = one("dialog.term")?.dyn_into::<web_sys::HtmlDialogElement>()?;
    if dialog.open() {
        return Ok(());
    }
    dialog.style().set_property("display", "flex")?;
    dialog.show_modal()?;
    let hints = nodes(".term .term-no");
    for h in &hints {
        h.class_list().remove_1("show")?;
    }
    cancel(HINT.replace(0));
    cancel(NOTE.replace(0));
    for (index, delay) in [(0, 2000), (1, 4000)] {
        if let Some(h) = hints.get(index).cloned() {
            let timer = later(delay, move || {
                let _ = h.class_list().add_1("show");
            })?;
            if index == 0 {
                HINT.replace(timer);
            } else {
                NOTE.replace(timer);
            }
        }
    }
    let input = one(".term input")?.dyn_into::<web_sys::HtmlInputElement>()?;
    input.focus()?;
    input.set_value(first);
    Ok(())
}
pub(super) fn start() -> Result<(), JsValue> {
    if STARTED.replace(true) {
        return Ok(());
    }
    ui::listen(&ui::doc()?.into(), "keydown", move |e| {
        let Some(k) = e.dyn_ref::<web_sys::KeyboardEvent>() else {
            return;
        };
        if e.default_prevented()
            || k.is_composing()
            || k.repeat()
            || !nodes("dialog[open]").is_empty()
            || k.key() == "/"
            || k.meta_key()
            || k.ctrl_key()
            || k.alt_key()
        {
            return;
        }
        if let Some(el) = e
            .target()
            .and_then(|t| t.dyn_into::<web_sys::Element>().ok())
        {
            if el.closest("input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]").ok().flatten().is_some(){return;}
            if k.key() == " "
                && el
                    .closest("a,button,summary,[role=button]")
                    .ok()
                    .flatten()
                    .is_some()
            {
                return;
            }
        }
        if k.key().encode_utf16().count() == 1 {
            e.prevent_default();
            let _ = open(&k.key());
        }
    })?;
    for n in nodes("[data-terminal]") {
        ui::listen(&n.into(), "click", move |e| {
            e.prevent_default();
            let _ = open("");
        })?;
    }
    Ok(())
}
