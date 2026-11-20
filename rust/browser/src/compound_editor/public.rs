use super::{cut::Cut, dom::*, *};
use std::{
    cell::RefCell,
    collections::{BTreeMap, BTreeSet},
    rc::Rc,
};
use wasm_bindgen_futures::{JsFuture, spawn_local};
#[derive(Clone)]
struct Draft {
    version: String,
    chip: String,
    id: Option<String>,
    generation: u64,
}
impl Default for Draft {
    fn default() -> Self {
        Self {
            version: String::new(),
            chip: "note".into(),
            id: None,
            generation: 0,
        }
    }
}
#[derive(Default)]
struct State {
    data: Option<Value>,
    active: usize,
    selected: String,
    loading: bool,
    again: bool,
    toast: u64,
    celebrated: bool,
    view_sent: bool,
    last_slots: String,
    battle_votes: BTreeSet<String>,
    pick_pool: String,
    draft: Draft,
    pending: bool,
    feed_loading: bool,
    feed_again: bool,
}
pub(super) struct App {
    state: RefCell<State>,
    pub cuts: RefCell<Vec<Rc<Cut>>>,
    listeners: RefCell<BTreeMap<String, Vec<ui::Listener>>>,
    pub global_polls: RefCell<BTreeSet<String>>,
}
pub(super) const CHIPS: [(&str, &str, &str); 6] = [
    ("hook", "🐌 hook too slow", "The hook is too slow because "),
    ("memes", "😂 needs more memes", "Add a meme where "),
    ("music", "🎵 music mid", "The music should "),
    ("length", "✂️ too long", "Cut the part where "),
    ("fire", "🔥 it's fire", "It's fire because "),
    ("note", "✍️ editor note", ""),
];
impl App {
    pub fn active(&self) -> usize {
        self.state.borrow().active
    }
    pub fn current(&self) -> Option<Value> {
        self.cuts
            .borrow()
            .get(self.active() - 1)
            .and_then(|c| c.current())
    }
    pub fn select(&self, id: &str) {
        if self.current().is_some_and(|v| text(&v, "id") == id) {
            self.state.borrow_mut().selected = id.into();
        }
    }
    pub fn toast(&self, message: &str) {
        let generation = {
            let mut s = self.state.borrow_mut();
            s.toast += 1;
            s.toast
        };
        ui::text("toast", message);
        ui::hidden("toast", false);
        // Element-local generation avoids retaining the application for a timeout.
        if let Ok(e) = ui::element("toast") {
            let _ = e.set_attribute("data-generation", &generation.to_string());
            later(5000, move || {
                if e.get_attribute("data-generation").as_deref() == Some(&generation.to_string()) {
                    e.set_hidden(true);
                }
                Ok(())
            });
        }
    }
    pub fn event(&self, name: &str, extra: Value) {
        let mut body = json!({"action":"event","event":name});
        if let Some(v) = self.current() {
            body["version"] = v["id"].clone();
        }
        if let Some(obj) = extra.as_object() {
            for (k, v) in obj {
                body[k] = v.clone();
            }
        }
        client::event(body, false);
    }
    pub async fn act(&self, mut body: Value) -> Result<Value, JsValue> {
        if body.get("version").is_none()
            && let Some(v) = self.current()
        {
            body["version"] = v["id"].clone();
        }
        api(Some(body), "").await
    }
    pub fn activate(self: &Rc<Self>, slot: usize, scroll: bool) -> Result<(), JsValue> {
        if !(1..=3).contains(&slot) {
            return Ok(());
        }
        self.state.borrow_mut().active = slot;
        let cuts = self.cuts.borrow().clone();
        for c in &cuts {
            c.tools.set_hidden(c.slot != slot);
        }
        for c in &cuts {
            if c.slot != slot {
                let _ = c.video.pause();
                c.hide_poll()?;
            }
            c.transition_at()?;
        }
        if let Some(c) = cuts.get(slot - 1) {
            c.prepare()?;
            let id = c
                .current()
                .map(|v| text(&v, "id").to_owned())
                .unwrap_or_default();
            let refresh = {
                let mut s = self.state.borrow_mut();
                s.selected = id.clone();
                !id.is_empty()
                    && s.data
                        .as_ref()
                        .is_some_and(|d| d["byVersion"].get(&id).is_none())
            };
            if refresh {
                self.refresh();
            }
            if scroll {
                let opt = web_sys::ScrollIntoViewOptions::new();
                opt.set_behavior(if reduced() {
                    web_sys::ScrollBehavior::Instant
                } else {
                    web_sys::ScrollBehavior::Smooth
                });
                opt.set_block(web_sys::ScrollLogicalPosition::Nearest);
                opt.set_inline(web_sys::ScrollLogicalPosition::Start);
                c.el.scroll_into_view_with_scroll_into_view_options(&opt);
            }
        }
        for b in all(
            &ui::doc()?.document_element().ok_or(JsValue::NULL)?,
            "[data-slot]",
        )? {
            let on = b.get_attribute("data-slot").as_deref() == Some(&slot.to_string());
            selected(&b, on)?;
            pressed(&b, on)?;
        }
        self.sync_quick()
    }
    fn celebrate(&self) -> Result<(), JsValue> {
        if self.state.borrow().celebrated {
            return Ok(());
        }
        self.state.borrow_mut().celebrated = true;
        if reduced() {
            return Ok(());
        }
        for i in 0..32 {
            let e = node("i", "", "confetti-piece")?;
            e.style()
                .set_property("left", &format!("{}%", js_sys::Math::random() * 100.))?;
            e.style().set_property(
                "--drift",
                &format!("{}px", (js_sys::Math::random() - 0.5) * 250.),
            )?;
            e.style().set_property(
                "animation-delay",
                &format!("{}s", js_sys::Math::random() * 0.6),
            )?;
            e.style()
                .set_property("background", if i % 3 == 0 { "#f35d62" } else { "#ffd76a" })?;
            append(&ui::element("confetti")?, &e)?;
            later(3400, move || {
                e.remove();
                Ok(())
            });
        }
        Ok(())
    }
    fn fund(&self, d: &Value) -> Result<(), JsValue> {
        let v = num(&d["total"]) / 100.;
        let hit = v >= 40.;
        let expired = js_sys::Date::now() >= 1794123000000.;
        ui::text("fund-total", &format!("€{} / €40", fixed(v, 2)));
        ui::element("fund-bar")?
            .style()
            .set_property("transform", &format!("scaleX({})", (v / 40.).min(1.)))?;
        if let Some(e) = ui::doc()?.query_selector(".meter")? {
            e.set_attribute("aria-valuenow", &v.min(40.).to_string())?;
        }
        ui::text(
            "fund-result",
            &if hit {
                "Night extended. Army wins.".into()
            } else if expired {
                format!("€{} before the deadline. thank you.", fixed(v, 2))
            } else {
                "one bed. one shower. one less questionable life choice.".into()
            },
        );
        if hit {
            self.celebrate()?;
        }
        disabled(&ui::element("donate")?, d["ready"] != true);
        disabled(&ui::element("revolut")?, text(d, "revolut_url").is_empty());
        ui::text(
            "payment-note",
            &format!(
                "{}stripe auto · revolut confirmed by gabe{}",
                if text(d, "mode") == "test" {
                    "TEST MODE · Stripe is test money. Revolut is real. "
                } else {
                    ""
                },
                if expired {
                    format!(" · after deadline: €{}", fixed(num(&d["late"]) / 100., 2))
                } else {
                    String::new()
                }
            ),
        );
        Ok(())
    }
    fn choose(
        self: &Rc<Self>,
        b: HtmlElement,
        body: Value,
        pool: Option<String>,
        pair: Option<String>,
    ) {
        disabled(&b, true);
        let app = self.clone();
        spawn_local(async move {
            match app.act(body).await {
                Ok(_) => {
                    if let Some(p) = pool {
                        app.state.borrow_mut().pick_pool = p;
                    }
                    if let Some(p) = pair {
                        app.state.borrow_mut().battle_votes.insert(p);
                    }
                    app.toast("verdict delivered.");
                    app.refresh();
                }
                Err(e) => {
                    app.toast(&ui::message(&e));
                    disabled(&b, false);
                }
            }
        });
    }
    fn battles(self: &Rc<Self>, d: &Value) -> Result<(), JsValue> {
        let cuts = rows(d, "cuts");
        let eligible = cuts
            .iter()
            .filter(|c| c["current"].is_object())
            .collect::<Vec<_>>();
        let pool = cuts
            .iter()
            .map(|c| c["current"]["id"].as_str().unwrap_or("none"))
            .collect::<Vec<_>>()
            .join("-");
        ui::text(
            "battle-note",
            "one tap. trust your gut. no watch requirement.",
        );
        let pick = clear("pick-buttons")?;
        let mut listeners = vec![];
        for c in &cuts {
            let b = node("button", &format!("V{}", count(c, "slot")), "")?;
            disabled(
                &b,
                !c["current"].is_object() || self.state.borrow().pick_pool == pool,
            );
            let weak = Rc::downgrade(self);
            let button = b.clone();
            let body = json!({"action":"pick","winner":c["current"]["id"]});
            let p = pool.clone();
            listeners.push(listen(b.as_ref(), "click", move |_| {
                if let Some(a) = weak.upgrade() {
                    a.choose(button.clone(), body.clone(), Some(p.clone()), None);
                }
                Ok(())
            })?);
            append(&pick, &b)?;
        }
        let mut pairs = vec![];
        for (i, a) in eligible.iter().enumerate() {
            for b in eligible.iter().skip(i + 1) {
                let mut ids = [text(&a["current"], "id"), text(&b["current"], "id")];
                ids.sort();
                let id = ids.join("-");
                if !self.state.borrow().battle_votes.contains(&id) {
                    pairs.push(([*a, *b], id));
                }
            }
        }
        ui::hidden("pairwise", pairs.is_empty());
        if let Some((pair, id)) = pairs.first() {
            let target = clear("battle-buttons")?;
            for (i, c) in pair.iter().enumerate() {
                let b = node("button", &format!("V{} wins →", count(c, "slot")), "button")?;
                let weak = Rc::downgrade(self);
                let button = b.clone();
                let body = json!({"action":"battle","winner":c["current"]["id"],"opponent":pair[1-i]["current"]["id"]});
                let id = id.clone();
                listeners.push(listen(b.as_ref(), "click", move |_| {
                    if let Some(a) = weak.upgrade() {
                        a.choose(button.clone(), body.clone(), None, Some(id.clone()));
                    }
                    Ok(())
                })?);
                append(&target, &b)?;
            }
        }
        self.listeners
            .borrow_mut()
            .insert("battles".into(), listeners);
        let score = |c: &Value, kind: &str| {
            num(&d["standings"][format!("{kind}:{}", text(&c["current"], "id"))])
        };
        let max = cuts
            .iter()
            .map(|c| score(c, "pick") + score(c, "battle"))
            .fold(1., f64::max);
        let target = clear("standings")?;
        for c in &cuts {
            let picks = score(c, "pick");
            let wins = score(c, "battle");
            let row = node("div", "", "")?;
            append(
                &row,
                &node(
                    "span",
                    &format!("V{} · {picks} picks · {wins} battle wins", count(c, "slot")),
                    "",
                )?,
            )?;
            let bar = node("i", "", "")?;
            bar.style()
                .set_property("transform", &format!("scaleX({})", (picks + wins) / max))?;
            append(&row, &bar)?;
            append(&target, &row)?;
        }
        Ok(())
    }
    fn render(self: &Rc<Self>, d: Value) -> Result<(), JsValue> {
        self.state.borrow_mut().data = Some(d.clone());
        self.fund(&d["fund"])?;
        let slots = rows(&d, "cuts")
            .iter()
            .map(|c| text(&c["current"], "id").to_owned())
            .collect::<Vec<_>>()
            .join("-");
        let changed = {
            let s = self.state.borrow();
            !s.last_slots.is_empty() && slots != s.last_slots
        };
        if changed {
            self.toast("NEW VERSION DROPPED · fresh cut in the selector.");
        }
        self.state.borrow_mut().last_slots = slots;
        for c in self.cuts.borrow().clone() {
            c.update(&d["cuts"][c.slot - 1], &d["byVersion"])?;
        }
        let current = self.current();
        self.state.borrow_mut().selected = current
            .map(|c| text(&c, "id").to_owned())
            .unwrap_or_default();
        if let Some(c) = self.cuts.borrow().get(self.active() - 1) {
            c.prepare()?;
        }
        ui::doc()?
            .document_element()
            .ok_or(JsValue::NULL)?
            .set_attribute("data-compound-ready", "1")?;
        ui::hidden("reload-cuts", true);
        ui::text("connection", "live · pick a cut. tell me what to change.");
        self.sync_quick()?;
        ui::element("connection")?.class_list().remove_1("error")?;
        let helpers = clear("helpers")?;
        let people = rows(&d, "helpers");
        if people.is_empty() {
            append(
                &helpers,
                &node("li", "first useful opinion gets the first spot.", "")?,
            )?;
        } else {
            for p in people {
                let li = node("li", text(&p, "handle"), "")?;
                append(&li, &node("b", &format!("{} pts", count(&p, "score")), "")?)?;
                append(&helpers, &li)?;
            }
        }
        self.battles(&d)?;
        if d["livePoll"].is_object()
            && let Some(c) = self.cuts.borrow().get(self.active() - 1)
        {
            c.show_poll(
                &d["livePoll"],
                (num(&d["livePoll"]["expires"]) - js_sys::Date::now()) / 1000.,
            )?;
        }
        if !self.state.borrow().view_sent {
            self.state.borrow_mut().view_sent = true;
            self.event("view", json!({}));
        }
        Ok(())
    }
    pub fn refresh(self: &Rc<Self>) {
        if ui::doc().is_ok_and(|d| d.hidden()) {
            return;
        }
        let query = {
            let mut s = self.state.borrow_mut();
            if s.loading {
                s.again = true;
                return;
            }
            s.loading = true;
            if s.selected.is_empty() {
                String::new()
            } else {
                format!("?version={}", js_sys::encode_uri_component(&s.selected))
            }
        };
        let app = self.clone();
        spawn_local(async move {
            let result = api(None, &query).await.and_then(|d| app.render(d));
            if result.is_err() {
                ui::text(
                    "connection",
                    if app.state.borrow().data.is_some() {
                        "connection lost. last counts shown. tap to retry."
                    } else {
                        "could not load. tap here to retry."
                    },
                );
                if let Ok(e) = ui::element("connection") {
                    let _ = e.class_list().add_1("error");
                }
                ui::hidden("reload-cuts", false);
            }
            let again = {
                let mut s = app.state.borrow_mut();
                s.loading = false;
                let a = s.again;
                s.again = false;
                a
            };
            if again {
                app.refresh();
            }
        });
    }
    fn sync_quick(&self) -> Result<(), JsValue> {
        let current = self.current();
        let id = current.as_ref().map(|v| text(v, "id")).unwrap_or("");
        ui::text(
            "feedback-cut",
            &format!(
                "· V{}{}",
                self.active(),
                if current.is_some() {
                    ""
                } else {
                    " · dropping soon"
                }
            ),
        );
        let s = self.state.borrow();
        for b in all(
            &ui::doc()?.document_element().ok_or(JsValue::NULL)?,
            "[data-chip]",
        )? {
            disabled(&b, current.is_none() || s.pending);
            pressed(
                &b,
                s.draft.version == id
                    && b.get_attribute("data-chip").as_deref() == Some(&s.draft.chip),
            )?;
        }
        disabled(
            &query(&ui::element("idea-form")?.into(), "button")?,
            current.is_none() || s.pending,
        );
        let reset = s.draft.version != id;
        drop(s);
        if reset {
            let n = self.state.borrow().draft.generation + 1;
            self.state.borrow_mut().draft = Draft {
                version: id.into(),
                generation: n,
                ..Default::default()
            };
            textarea("idea")?.set_value("");
            ui::text("idea-status", "");
            ui::hidden("feedback-thanks", true);
        }
        Ok(())
    }
    fn quick(self: &Rc<Self>, chip: &str) -> Result<(), JsValue> {
        let Some(v) = self.current() else {
            return Ok(());
        };
        if self.state.borrow().pending {
            return Ok(());
        }
        let version = text(&v, "id").to_owned();
        let generation = self.state.borrow().draft.generation + 1;
        self.state.borrow_mut().draft = Draft {
            version: version.clone(),
            chip: chip.into(),
            generation,
            id: None,
        };
        let starter = CHIPS
            .iter()
            .find(|c| c.0 == chip)
            .map(|c| c.2)
            .unwrap_or("");
        let area = textarea("idea")?;
        area.set_value(starter);
        let options = web_sys::FocusOptions::new();
        options.set_prevent_scroll(true);
        area.focus_with_options(&options)?;
        area.set_selection_range(
            starter.encode_utf16().count() as u32,
            starter.encode_utf16().count() as u32,
        )?;
        ui::text("idea-status", "saving your tap…");
        self.state.borrow_mut().pending = true;
        self.sync_quick()?;
        let website = fields(&form("idea-form")?)?["website"].clone();
        let chip = chip.to_owned();
        let app = self.clone();
        spawn_local(async move {
            match api(
                Some(json!({"action":"quick","version":version,"chip":chip,"website":website})),
                "",
            )
            .await
            {
                Ok(r) => {
                    if app.state.borrow().draft.generation == generation {
                        app.state.borrow_mut().draft.id = Some(text(&r, "id").into());
                        ui::text("idea-status", "tap saved ✅ add the why if you want.");
                        ui::hidden("feedback-thanks", false);
                    }
                    app.feed();
                }
                Err(e) => {
                    if app.state.borrow().draft.generation == generation {
                        ui::text("idea-status", &format!("not saved: {}", ui::message(&e)));
                    }
                }
            }
            app.state.borrow_mut().pending = false;
            report(app.sync_quick());
        });
        Ok(())
    }
    fn note(self: &Rc<Self>) -> Result<(), JsValue> {
        let draft = self.state.borrow().draft.clone();
        if draft.version.is_empty() || self.state.borrow().pending {
            return Ok(());
        }
        let words = textarea("idea")?.value().trim().to_owned();
        let website = fields(&form("idea-form")?)?["website"].clone();
        let generation = draft.generation;
        self.state.borrow_mut().pending = true;
        self.sync_quick()?;
        let app = self.clone();
        spawn_local(async move {
            let result = async {
                let id = if let Some(id) = draft.id.clone() {
                    id
                } else {
                    let r = api(
                        Some(json!({"action":"quick", "version":draft.version,
                        "chip":draft.chip, "text":words, "website":website})),
                        "",
                    )
                    .await?;
                    let id = text(&r, "id").to_owned();
                    // Retain the first successful write if the text update fails.
                    if app.state.borrow().draft.generation == generation {
                        app.state.borrow_mut().draft.id = Some(id.clone());
                    }
                    id
                };
                api(
                    Some(json!({"action":"note_text", "version":draft.version,
                    "id":id, "text":words, "website":website})),
                    "",
                )
                .await?;
                if app.state.borrow().draft.generation == generation {
                    app.state.borrow_mut().draft = Draft {
                        version: draft.version,
                        generation: generation + 1,
                        ..Default::default()
                    };
                    textarea("idea")?.set_value("");
                    ui::text("idea-status", "Noted ✅");
                    ui::hidden("feedback-thanks", false);
                }
                app.feed();
                app.refresh();
                Ok::<_, JsValue>(())
            }
            .await;
            if let Err(e) = result
                && app.state.borrow().draft.generation == generation
            {
                ui::text("idea-status", &format!("not saved: {}", ui::message(&e)));
            }
            app.state.borrow_mut().pending = false;
            report(app.sync_quick());
        });
        Ok(())
    }
    fn feed_render(&self, data: Value) -> Result<(), JsValue> {
        ui::hidden("feed-retry", true);
        let target = clear("feed-notes")?;
        let feedback = rows(&data, "feedback");
        if feedback.is_empty() {
            append(
                &target,
                &node("li", "no notes yet. your gut reaction goes here.", "muted")?,
            )?;
        }
        for note in feedback {
            let li = node("li", "", "")?;
            let label = CHIPS
                .iter()
                .find(|c| c.0 == text(&note, "chip"))
                .map(|c| c.1)
                .unwrap_or("✍️ editor note");
            let version = self.state.borrow().data.as_ref().and_then(|s| {
                rows(s, "versions")
                    .into_iter()
                    .find(|v| v["id"] == note["version"])
            });
            let suffix = version
                .map(|v| format!("V{} / r{}", count(&v, "slot"), count(&v, "iteration")))
                .unwrap_or_else(|| text(&note, "version").into());
            append(&li, &node("strong", label, "")?)?;
            append(
                &li,
                &node(
                    "p",
                    if text(&note, "text").is_empty() {
                        "one-tap feedback"
                    } else {
                        text(&note, "text")
                    },
                    "",
                )?,
            )?;
            append(
                &li,
                &node(
                    "small",
                    &format!("{} · {suffix}", text(&note, "handle")),
                    "",
                )?,
            )?;
            append(&target, &li)?;
        }
        Ok(())
    }
    fn feed(self: &Rc<Self>) {
        if ui::doc().is_ok_and(|d| d.hidden()) {
            return;
        }
        {
            let mut s = self.state.borrow_mut();
            if s.feed_loading {
                s.feed_again = true;
                return;
            }
            s.feed_loading = true;
        }
        let app = self.clone();
        spawn_local(async move {
            if api(None, "?feed=1")
                .await
                .and_then(|d| app.feed_render(d))
                .is_err()
            {
                if ui::element("feed-notes")
                    .is_ok_and(|e| e.query_selector("strong").ok().flatten().is_none())
                {
                    ui::text(
                        "feed-notes",
                        "feedback is unavailable for a moment. your draft stays here.",
                    );
                }
                ui::hidden("feed-retry", false);
            }
            let again = {
                let mut s = app.state.borrow_mut();
                s.feed_loading = false;
                let a = s.feed_again;
                s.feed_again = false;
                a
            };
            if again {
                app.feed();
            }
        });
    }
    fn share(self: &Rc<Self>, feedback: bool) {
        let app = self.clone();
        spawn_local(async move {
            let text = if feedback {
                "I just helped edit a €1000 video 🎬 https://corvus.gent/compound"
            } else {
                "Help this one-man army win €1000. Watch it. Roast it. Make it better. #jointhearmy"
            };
            let url = "https://corvus.gent/compound?utm_source=share&utm_medium=social&utm_campaign=compound-1000";
            let result = async {
                let nav = web_sys::window().ok_or(JsValue::NULL)?.navigator();
                if let Ok(f) = js_sys::Reflect::get(&nav, &"share".into())
                    && f.is_function()
                {
                    let data = js_sys::JSON::parse(
                        &if feedback {
                            json!({"text":text})
                        } else {
                            json!({"title":"Help Gabe win €1000","text":text,"url":url})
                        }
                        .to_string(),
                    )?;
                    let p = f.dyn_into::<js_sys::Function>()?.call1(&nav, &data)?;
                    JsFuture::from(js_sys::Promise::resolve(&p)).await?;
                } else {
                    let copy = if feedback {
                        text.into()
                    } else {
                        format!("{text} {url}")
                    };
                    if !ui::copy(&copy).await {
                        return Err(JsValue::from_str("Clipboard unavailable"));
                    }
                    app.toast(if feedback {
                        "Copied ✅"
                    } else {
                        "recruitment link copied."
                    });
                }
                app.event("share", json!({}));
                Ok::<_, JsValue>(())
            }
            .await;
            if let Err(e) = result
                && js_sys::Reflect::get(&e, &"name".into())
                    .ok()
                    .and_then(|v| v.as_string())
                    .as_deref()
                    != Some("AbortError")
            {
                app.toast(&if feedback {
                    text.into()
                } else {
                    format!("copy this: {url}")
                });
            }
        });
    }
}
pub(super) fn start() -> Result<(), JsValue> {
    let app = Rc::new(App {
        state: RefCell::new(State {
            active: 1,
            ..Default::default()
        }),
        cuts: RefCell::new(vec![]),
        listeners: RefCell::new(BTreeMap::new()),
        global_polls: RefCell::new(BTreeSet::new()),
    });
    for slot in 1..=3 {
        let c = Cut::new(slot, Rc::downgrade(&app))?;
        append(&ui::element("cuts")?, &c.el)?;
        append(&ui::element("cut-tools")?, &c.tools)?;
        app.cuts.borrow_mut().push(c);
    }
    for b in all(
        &ui::doc()?.document_element().ok_or(JsValue::NULL)?,
        "[data-slot]",
    )? {
        let a = app.clone();
        let slot = b
            .get_attribute("data-slot")
            .and_then(|s| s.parse().ok())
            .unwrap_or(1);
        on(b.as_ref(), "click", move |_| a.activate(slot, true))?;
    }
    let a = app.clone();
    let callback = Closure::wrap(Box::new(move |entries: js_sys::Array| {
        let mut es = entries
            .iter()
            .filter_map(|e| e.dyn_into::<web_sys::IntersectionObserverEntry>().ok())
            .filter(|e| e.is_intersecting() && e.intersection_ratio() > 0.6)
            .collect::<Vec<_>>();
        es.sort_by(|a, b| b.intersection_ratio().total_cmp(&a.intersection_ratio()));
        if let Some(e) = es.first()
            && let Some(slot) = e
                .target()
                .get_attribute("data-cut")
                .and_then(|s| s.parse().ok())
        {
            report(a.activate(slot, false));
        }
    }) as Box<dyn FnMut(js_sys::Array)>);
    let options = web_sys::IntersectionObserverInit::new();
    options.set_root(Some(ui::element("cuts")?.as_ref()));
    options.set_threshold(&js_sys::Array::of2(&0.6.into(), &0.9.into()));
    let observer = web_sys::IntersectionObserver::new_with_options(
        callback.as_ref().unchecked_ref(),
        &options,
    )?;
    for c in app.cuts.borrow().iter() {
        observer.observe(&c.el);
    }
    callback.forget(); // Browser owns observer until the document unloads.
    for b in all(
        &ui::doc()?.document_element().ok_or(JsValue::NULL)?,
        "[data-chip]",
    )? {
        let a = app.clone();
        let chip = b.get_attribute("data-chip").unwrap_or_default();
        on(b.as_ref(), "click", move |_| a.quick(&chip))?;
    }
    let a = app.clone();
    on(ui::element("idea-form")?.as_ref(), "submit", move |e| {
        e.prevent_default();
        a.note()
    })?;
    let a = app.clone();
    on(ui::element("feed-retry")?.as_ref(), "click", move |_| {
        a.feed();
        Ok(())
    })?;
    for (id, feedback) in [("feedback-share", true), ("share", false)] {
        let a = app.clone();
        on(ui::element(id)?.as_ref(), "click", move |_| {
            a.share(feedback);
            Ok(())
        })?;
    }
    input("handle")?.set_value(&client::compound_handle());
    let a = app.clone();
    on(ui::element("handle-form")?.as_ref(), "submit", move |e| {
        e.prevent_default();
        let a = a.clone();
        let handle = input("handle")?.value();
        spawn_local(async move {
            match a.act(json!({"action":"profile","handle":handle})).await {
                Ok(r) => {
                    client::compound_set_handle(text(&r, "handle"));
                    a.toast(if text(&r, "handle").is_empty() {
                        "handle removed."
                    } else {
                        "handle saved. useful chaos gets credit."
                    });
                    a.feed();
                    a.refresh();
                }
                Err(e) => a.toast(&ui::message(&e)),
            }
        });
        Ok(())
    })?;
    for (id, method) in [("donate", "stripe"), ("revolut", "revolut")] {
        let a = app.clone();
        on(ui::element(id)?.as_ref(), "click", move |_| {
            let w = web_sys::window().ok_or(JsValue::NULL)?;
            let checkout = w.open_with_url_and_target("about:blank", "_blank")?;
            if let Some(c) = &checkout {
                let _ = js_sys::Reflect::set(c, &"opener".into(), &JsValue::NULL);
            }
            let b = ui::element(id)?;
            disabled(&b, true);
            let a = a.clone();
            spawn_local(async move {
                match a.act(json!({"action":"donate","method":method})).await {
                    Ok(r) => {
                        let url = text(&r, "url");
                        if let Some(c) = &checkout
                            && c.closed().is_ok_and(|closed| !closed)
                        {
                            let _ = c.location().replace(url);
                        } else {
                            let _ = w.location().assign(url);
                        }
                    }
                    Err(e) => {
                        if let Some(c) = checkout {
                            let _ = c.close();
                        }
                        a.toast(&ui::message(&e));
                    }
                }
                disabled(&b, false);
            });
            Ok(())
        })?;
    }
    let a = app.clone();
    on(ui::element("army")?.as_ref(), "click", move |_| {
        a.event("army_join", json!({}));
        Ok(())
    })?;
    input("deep-analytics")?.set_checked(client::compound_deep_allowed());
    let a = app.clone();
    on(
        ui::element("deep-analytics")?.as_ref(),
        "change",
        move |_| {
            client::compound_set_deep(input("deep-analytics")?.checked());
            let on = client::compound_deep_allowed();
            input("deep-analytics")?.set_checked(on);
            a.toast(if on {
                "cross-visit tracking on. thank you."
            } else {
                "cross-visit tracking off."
            });
            Ok(())
        },
    )?;
    let a = app.clone();
    on(ui::element("connection")?.as_ref(), "click", move |_| {
        a.refresh();
        Ok(())
    })?;
    let a = app.clone();
    on(
        web_sys::window().ok_or(JsValue::NULL)?.as_ref(),
        "pagehide",
        move |_| {
            for c in a.cuts.borrow().iter() {
                c.dropoff();
            }
            Ok(())
        },
    )?;
    let a = app.clone();
    on(ui::doc()?.as_ref(), "visibilitychange", move |_| {
        if ui::doc()?.hidden() {
            for c in a.cuts.borrow().iter() {
                c.dropoff();
            }
        } else {
            a.refresh();
            a.feed();
        }
        Ok(())
    })?;
    app.activate(1, false)?;
    app.refresh();
    app.feed();
    let a = app.clone();
    interval(30000, move || {
        a.refresh();
        Ok(())
    })?;
    let a = app.clone();
    interval(10000, move || {
        a.feed();
        Ok(())
    })?;
    interval(2000, move || {
        if ui::doc()?.hidden() || app.current().is_none() {
            return Ok(());
        }
        let a = app.clone();
        spawn_local(async move {
            if let Ok(d) = api(None, "?live=1").await
                && d["poll"].is_object()
                && let Some(c) = a.cuts.borrow().get(a.active() - 1)
            {
                report(c.show_poll(
                    &d["poll"],
                    (num(&d["poll"]["expires"]) - js_sys::Date::now()) / 1000.,
                ));
            }
        });
        Ok(())
    })?;
    Ok(())
}
