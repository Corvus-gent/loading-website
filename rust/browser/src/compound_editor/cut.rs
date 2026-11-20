use super::{dom::*, public::App, *};
use std::{
    cell::RefCell,
    collections::{BTreeMap, BTreeSet},
    rc::{Rc, Weak},
};
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::HtmlVideoElement;
const CATEGORIES: [&str; 8] = [
    "Hook",
    "Transitions",
    "Music",
    "Pacing",
    "Story",
    "Humor",
    "Visuals",
    "Ending",
];
const TAGS: [&str; 8] = [
    "keep",
    "cut",
    "too slow",
    "too fast",
    "confusing",
    "smooth",
    "funny",
    "strong hook",
];
#[derive(Default)]
struct Model {
    current: Option<Value>,
    history: Vec<Value>,
    previous_latest: String,
    stats: Value,
    milestones: BTreeSet<i32>,
    seen_polls: BTreeSet<String>,
    choices: BTreeMap<String, String>,
    categories: BTreeMap<String, String>,
    transitions: BTreeMap<String, String>,
    tags: BTreeSet<String>,
    played: bool,
    last_drop: Option<i64>,
    watched_sent: bool,
    ended_at: f64,
    active_transition: Option<Value>,
    pinned: Option<Value>,
    poll_until: Option<f64>,
}
pub(super) struct Cut {
    pub slot: usize,
    pub el: HtmlElement,
    pub tools: HtmlElement,
    pub video: HtmlVideoElement,
    app: Weak<App>,
    model: RefCell<Model>,
    listeners: RefCell<BTreeMap<String, Vec<ui::Listener>>>,
    sound: HtmlElement,
    bored: HtmlElement,
    bored_heat: HtmlElement,
}
impl Cut {
    fn q(&self, s: &str) -> Result<HtmlElement, JsValue> {
        query(&self.el, s).or_else(|_| query(&self.tools, s))
    }
    fn all(&self, s: &str) -> Result<Vec<HtmlElement>, JsValue> {
        let mut es = all(&self.el, s)?;
        es.extend(all(&self.tools, s)?);
        Ok(es)
    }
    pub fn current(&self) -> Option<Value> {
        self.model.borrow().current.clone()
    }
    fn app(&self) -> Result<Rc<App>, JsValue> {
        self.app.upgrade().ok_or(JsValue::NULL)
    }
    fn bind(
        self: &Rc<Self>,
        e: &HtmlElement,
        event: &str,
        mut f: impl FnMut(&Rc<Self>, web_sys::Event) -> Result<(), JsValue> + 'static,
    ) -> Result<(), JsValue> {
        let weak = Rc::downgrade(self);
        on(e.as_ref(), event, move |event| {
            if let Some(c) = weak.upgrade() {
                f(&c, event)?;
            }
            Ok(())
        })
    }
    fn listener(
        self: &Rc<Self>,
        e: &HtmlElement,
        event: &str,
        mut f: impl FnMut(&Rc<Self>, web_sys::Event) -> Result<(), JsValue> + 'static,
    ) -> Result<ui::Listener, JsValue> {
        let weak = Rc::downgrade(self);
        listen(e.as_ref(), event, move |event| {
            if let Some(c) = weak.upgrade() {
                f(&c, event)?;
            }
            Ok(())
        })
    }
    pub fn new(slot: usize, app: Weak<App>) -> Result<Rc<Self>, JsValue> {
        let el = node("article", "", "cut-card")?;
        el.set_attribute("data-cut", &slot.to_string())?;
        el.set_attribute("aria-label", &format!("Cut V{slot}"))?;
        el.set_inner_html(
            include_str!("cut.html")
                .trim_end()
                .replace("{{slot}}", &slot.to_string())
                .as_str(),
        );
        el.class_list().add_1("empty")?;
        let tools = node("div", "", "cut-tools")?;
        let children = all(&el, ":scope > *")?;
        for c in children {
            if !c.matches(".cut-heading,.video-stage")? {
                append(&tools, &c)?;
            }
        }
        let video = query(&el, "video")?.dyn_into::<HtmlVideoElement>()?;
        let sound = node("button", "tap for sound", "sound-toggle")?;
        sound.set_hidden(true);
        let stage = query(&el, ".video-stage")?;
        append(&stage, &sound)?;
        let bored = node("button", "🥱 BORING HERE", "bored-button")?;
        button(&bored)?.set_type("button");
        bored.set_hidden(true);
        append(&stage, &bored)?;
        let bored_heat = node("div", "", "bored-heat")?;
        bored_heat.set_attribute("aria-label", "Where people got bored. Tap to jump.")?;
        append(&el, &bored_heat)?;
        append(
            &el,
            &node(
                "p",
                "bored here? tap the heat bar to jump.",
                "small muted bored-caption",
            )?,
        )?;
        let cut = Rc::new(Self {
            slot,
            el,
            tools,
            video,
            app,
            model: RefCell::new(Model::default()),
            listeners: RefCell::new(BTreeMap::new()),
            sound,
            bored,
            bored_heat,
        });
        cut.bind(&cut.q("select")?, "change", |c, _| {
            let id = c.q("select")?.dyn_into::<HtmlSelectElement>()?.value();
            let v = c
                .model
                .borrow()
                .history
                .iter()
                .find(|v| text(v, "id") == id)
                .cloned();
            if let Some(v) = v {
                c.use_version(v)?;
            }
            c.app()?.refresh();
            Ok(())
        })?;
        cut.bind(&cut.sound, "click", |c, _| {
            c.video.set_muted(!c.video.muted());
            c.play(false);
            c.sound.set_text_content(Some(if c.video.muted() {
                "tap for sound"
            } else {
                "mute"
            }));
            Ok(())
        })?;
        cut.bind(&cut.bored, "click", |c, _| {
            c.submit(
                c.bored.clone(),
                json!({"action":"reaction","type":"bored","t":c.video.current_time()}),
                |c, _| {
                    c.bored.set_text_content(Some("Noted ✅"));
                    let b = c.bored.clone();
                    later(900, move || {
                        b.set_text_content(Some("🥱 BORING HERE"));
                        disabled(&b, false);
                        Ok(())
                    });
                    Ok(())
                },
            );
            Ok(())
        })?;
        for (kind, label) in [
            ("fire", "🔥"),
            ("laugh", "😂"),
            ("neutral", "😐"),
            ("skull", "💀"),
            ("cut", "✂️ cut this"),
        ] {
            let b = node("button", label, "")?;
            b.set_attribute("aria-label", &format!("{kind} at this moment"))?;
            disabled(&b, true);
            let cb = b.clone();
            cut.bind(&b, "click", move |c, _| {
                let b = cb.clone();
                c.submit(
                    b.clone(),
                    json!({"action":"reaction","type":kind,"t":c.video.current_time()}),
                    move |c, _| {
                        let video = c.video.clone();
                        later(400, move || {
                            disabled(&b, video.paused());
                            Ok(())
                        });
                        Ok(())
                    },
                );
                Ok(())
            })?;
            append(&cut.q(".reaction-bar")?, &b)?;
        }
        for b in cut.all(".vote")? {
            let cb = b.clone();
            cut.bind(&b, "click", move |c, _| {
                c.submit(
                    cb.clone(),
                    json!({"action":"vote","choice":cb.get_attribute("data-choice")}),
                    |c, r| {
                        if let Some(v) = c.current() {
                            c.model
                                .borrow_mut()
                                .choices
                                .insert(text(&v, "id").into(), text(&r, "choice").into());
                        }
                        c.q(".categories")?.set_hidden(false);
                        Ok(())
                    },
                );
                Ok(())
            })?;
        }
        for category in CATEGORIES {
            let row = node("div", "", "category-row")?;
            append(&row, &node("span", category, "")?)?;
            for choice in ["up", "down"] {
                let b = node("button", if choice == "up" { "👍" } else { "👎" }, "")?;
                b.set_attribute("data-category", category)?;
                b.set_attribute("data-choice", choice)?;
                b.set_attribute(
                    "aria-label",
                    &format!(
                        "{category} {}",
                        if choice == "up" {
                            "worked"
                        } else {
                            "needs work"
                        }
                    ),
                )?;
                let cb = b.clone();
                cut.bind(&b, "click", move |c, _| {
                    let why = c
                        .q(".category-why")?
                        .dyn_into::<HtmlInputElement>()?
                        .value();
                    c.submit(
                        cb.clone(),
                        json!({"action":"category","category":category,"choice":choice,"why":why}),
                        move |c, r| {
                            if let Some(v) = c.current() {
                                c.model.borrow_mut().categories.insert(
                                    format!("{}:{category}", text(&v, "id")),
                                    text(&r, "choice").into(),
                                );
                            }
                            c.q(".category-why")?
                                .dyn_into::<HtmlInputElement>()?
                                .set_value("");
                            Ok(())
                        },
                    );
                    Ok(())
                })?;
                append(&row, &b)?;
            }
            append(&cut.q(".category-list")?, &row)?;
        }
        cut.bind(&cut.q(".poll-top button")?, "click", |c, _| c.hide_poll())?;
        let ve = cut.video.clone().dyn_into::<HtmlElement>()?;
        cut.bind(&ve, "play", |c, _| {
            c.model.borrow_mut().ended_at = 0.;
            c.app()?.activate(c.slot, false)?;
            let played = c.model.borrow().played;
            if !played {
                c.model.borrow_mut().played = true;
                c.event("play", json!({}));
            }
            c.reactions(true)
        })?;
        cut.bind(&ve, "pause", |c, _| {
            c.dropoff();
            c.reactions(false)
        })?;
        for event in ["timeupdate", "seeking"] {
            cut.bind(&ve, event, |c, _| c.time())?;
        }
        cut.bind(&ve, "ended", |c, _| {
            c.model.borrow_mut().ended_at = js_sys::Date::now();
            c.watch(100);
            c.transition_at()?;
            let weak = Rc::downgrade(c);
            later(1510, move || {
                if let Some(c) = weak.upgrade() {
                    c.transition_at()?;
                }
                Ok(())
            });
            Ok(())
        })?;
        cut.bind(&ve, "error", |c, _| {
            c.app()?
                .toast(&format!("V{} could not load. try another cut.", c.slot));
            Ok(())
        })?;
        cut.bind(&cut.q(".transition-comment")?, "submit", |c, e| {
            e.prevent_default();
            let input = c
                .q(".transition-comment input")?
                .dyn_into::<HtmlInputElement>()?;
            let id = c
                .model
                .borrow()
                .active_transition
                .as_ref()
                .map(|t| text(t, "id").to_owned());
            if let Some(id) = id
                && !input.value().trim().is_empty()
            {
                c.submit(
                    c.q(".transition-comment button")?,
                    json!({"action":"transition_text","transition":id,"text":input.value()}),
                    move |_, _| {
                        input.set_value("");
                        Ok(())
                    },
                );
            }
            Ok(())
        })?;
        let weak = Rc::downgrade(&cut);
        interval(250, move || {
            if let Some(c) = weak.upgrade() {
                c.poll_tick()?;
            }
            Ok(())
        })?;
        Ok(cut)
    }
    fn submit(
        self: &Rc<Self>,
        b: HtmlElement,
        mut body: Value,
        done: impl FnOnce(&Rc<Self>, Value) -> Result<(), JsValue> + 'static,
    ) {
        let Some(v) = self.current() else { return };
        if is_disabled(&b) {
            return;
        }
        let id = text(&v, "id").to_owned();
        body["version"] = json!(id);
        disabled(&b, true);
        let weak = Rc::downgrade(self);
        spawn_local(async move {
            let result = api(Some(body), "").await;
            if let Some(c) = weak.upgrade() {
                match result {
                    Ok(r) => {
                        if c.current().is_some_and(|v| text(&v, "id") == id) {
                            report(done(&c, r.clone()));
                        }
                        if let Ok(a) = c.app() {
                            a.toast(if r["added"] == false {
                                "already counted. thank you."
                            } else {
                                "counted. the edit thanks you."
                            });
                            a.refresh();
                        }
                    }
                    Err(e) => {
                        if let Ok(a) = c.app() {
                            a.toast(&ui::message(&e));
                        }
                        disabled(&b, false);
                    }
                }
            }
        });
    }
    fn event(&self, event: &str, mut extra: Value) {
        if let Some(v) = self.current() {
            extra["version"] = v["id"].clone();
        }
        if let Ok(a) = self.app() {
            a.event(event, extra);
        }
    }
    pub fn update(self: &Rc<Self>, cut: &Value, metrics: &Value) -> Result<(), JsValue> {
        let history = rows(cut, "history");
        let current = self.current();
        let desired = if let Some(v) = &current {
            history.iter().find(|n| n["id"] == v["id"]).cloned()
        } else {
            cut.get("current").filter(|v| v.is_object()).cloned()
        };
        self.model.borrow_mut().history = history.clone();
        if current.is_none() {
            if let Some(v) = desired {
                self.use_version(v)?;
            }
        } else if let Some(v) = desired {
            self.model.borrow_mut().current = Some(v);
        }
        let previous = self.model.borrow().previous_latest.clone();
        if let Some(v) = self.current()
            && text(&cut["current"], "id") != previous
            && text(&v, "id") == previous
            && self.video.paused()
            && cut["current"].is_object()
        {
            self.use_version(cut["current"].clone())?;
        }
        self.model.borrow_mut().previous_latest = text(&cut["current"], "id").into();
        let select = self.q("select")?.dyn_into::<HtmlSelectElement>()?;
        select.set_text_content(None);
        if history.is_empty() {
            append(&select, &node("option", "incoming", "")?)?;
        } else {
            for v in &history {
                append(
                    &select,
                    &option(
                        &format!(
                            "r{} · {}",
                            count(v, "iteration"),
                            if v["id"] == cut["current"]["id"] {
                                "latest"
                            } else {
                                text(v, "label")
                            }
                        ),
                        text(v, "id"),
                    )?,
                )?;
            }
        }
        select.set_disabled(history.is_empty());
        let current = self.current();
        let id = current.as_ref().map(|v| text(v, "id")).unwrap_or("");
        if current.is_some() {
            select.set_value(id);
        }
        let ol = self.q(".history ol")?;
        ol.set_text_content(None);
        for v in &history {
            let li = node("li", "", "")?;
            append(
                &li,
                &node(
                    "strong",
                    &format!(
                        "V{} · r{} · {}",
                        self.slot,
                        count(v, "iteration"),
                        ui::date(text(v, "uploaded_at"))
                    ),
                    "",
                )?,
            )?;
            append(&li, &node("p", text(v, "changelog"), "")?)?;
            append(&ol, &li)?;
        }
        let d = &metrics[id];
        let stats = d.get("stats").cloned().unwrap_or(json!({}));
        self.model.borrow_mut().stats = stats.clone();
        for b in self.all(".vote")? {
            let choice = b.get_attribute("data-choice").unwrap_or_default();
            query(&b, "b")?
                .set_text_content(Some(&num(&stats[format!("vote:{choice}")]).to_string()));
            let m = self.model.borrow();
            disabled(&b, current.is_none() || m.choices.contains_key(id));
            selected(&b, m.choices.get(id) == Some(&choice))?;
        }
        self.q(".categories")?
            .set_hidden(!self.model.borrow().choices.contains_key(id));
        for b in self.all("[data-category]")? {
            let key = format!(
                "{id}:{}",
                b.get_attribute("data-category").unwrap_or_default()
            );
            let m = self.model.borrow();
            disabled(&b, current.is_none() || m.categories.contains_key(&key));
            selected(
                &b,
                m.categories.get(&key) == b.get_attribute("data-choice").as_ref(),
            )?;
        }
        self.render_bored(&d["heat"])?;
        self.render_heat(&d["heat"])?;
        self.timeline()?;
        self.transition_at()
    }
    fn use_version(self: &Rc<Self>, v: Value) -> Result<(), JsValue> {
        if self.current().is_some_and(|c| c["id"] == v["id"]) {
            return Ok(());
        }
        self.dropoff();
        let _ = self.video.pause();
        {
            let mut m = self.model.borrow_mut();
            m.current = Some(v.clone());
            m.played = false;
            m.last_drop = None;
            m.watched_sent = false;
            m.milestones.clear();
            m.active_transition = None;
            m.pinned = None;
        }
        self.hide_poll()?;
        self.video.remove_attribute("src")?;
        self.video.set_hidden(false);
        self.q(".cut-empty")?.set_hidden(true);
        self.el.class_list().remove_1("empty")?;
        self.video.set_poster("/compound/v1-poster.jpg");
        self.q(".heat-caption span")?
            .set_text_content(Some(&stamp(num(&v["duration"]))));
        self.video.load();
        if self.app()?.active() == self.slot {
            self.prepare()?;
        }
        self.app()?.select(text(&v, "id"));
        Ok(())
    }
    fn play(&self, show_failure: bool) {
        if let Ok(p) = self.video.play() {
            let sound = self.sound.clone();
            spawn_local(async move {
                if JsFuture::from(p).await.is_err() && show_failure {
                    sound.set_text_content(Some("play · tap for sound"));
                }
            });
        }
    }
    pub fn prepare(&self) -> Result<(), JsValue> {
        if let Some(v) = self.current()
            && self.video.get_attribute("src").is_none()
        {
            self.video.set_src(text(&v, "url"));
            self.video
                .set_preload(if self.slot == 1 { "auto" } else { "metadata" });
            if self.slot == 1 {
                self.video.set_muted(true);
                self.video.set_autoplay(!reduced());
                self.sound.set_hidden(false);
            }
            self.video.load();
            if self.video.autoplay() {
                self.play(true);
            }
        }
        Ok(())
    }
    fn reactions(&self, on: bool) -> Result<(), JsValue> {
        self.bored.set_hidden(!on);
        for b in self.all(".reaction-bar button")? {
            disabled(&b, !on);
        }
        Ok(())
    }
    fn time(self: &Rc<Self>) -> Result<(), JsValue> {
        let Some(v) = self.current() else {
            return Ok(());
        };
        self.transition_at()?;
        if !self.model.borrow().played {
            return Ok(());
        }
        let percent = self.video.current_time() / num(&v["duration"]) * 100.;
        for n in [25, 50, 75, 100] {
            if percent >= if n == 100 { 99.5 } else { n as f64 } {
                self.watch(n);
            }
        }
        for cue in rows(&v, "cues") {
            let t = self.video.current_time();
            if t >= num(&cue["t"]) && t < num(&cue["t"]) + 1.5 {
                self.show_poll(&cue, 5.)?;
            }
        }
        Ok(())
    }
    fn watch(self: &Rc<Self>, n: i32) {
        let Some(v) = self.current() else { return };
        {
            let mut m = self.model.borrow_mut();
            if !m.milestones.insert(n) {
                return;
            }
        }
        self.event("watch", json!({"percent":n}));
        if self.model.borrow().watched_sent {
            return;
        }
        self.model.borrow_mut().watched_sent = true;
        let id = text(&v, "id").to_owned();
        let weak = Rc::downgrade(self);
        spawn_local(async move {
            if api(
                Some(json!({"action":"watched","version":id,"percent":n})),
                "",
            )
            .await
            .is_err()
                && let Some(c) = weak.upgrade()
                && c.current().is_some_and(|v| text(&v, "id") == id)
            {
                c.model.borrow_mut().watched_sent = false;
            }
        });
    }
    pub fn dropoff(&self) {
        if self.current().is_none() || !self.model.borrow().played || self.video.ended() {
            return;
        }
        let t = self.video.current_time();
        let bucket = (t / 5.).floor() as i64;
        {
            let mut m = self.model.borrow_mut();
            if m.last_drop == Some(bucket) {
                return;
            }
            m.last_drop = Some(bucket);
        }
        self.event("dropoff", json!({"t":t}));
    }
    pub fn transition_at(self: &Rc<Self>) -> Result<(), JsValue> {
        let Some(v) = self.current() else {
            return Ok(());
        };
        let t = self.video.current_time();
        if !self.video.paused() {
            self.model.borrow_mut().pinned = None;
        }
        let finished = self.video.ended()
            && self.model.borrow().ended_at != 0.
            && js_sys::Date::now() - self.model.borrow().ended_at >= 1500.;
        let visible = rows(&v, "transitions")
            .into_iter()
            .rev()
            .filter(|i| t >= num(&i["start"]) && t < num(&i["end"]) + 1.5)
            .collect::<Vec<_>>();
        let current = visible
            .iter()
            .find(|i| text(i, "type") == "transition")
            .or(visible.first())
            .cloned();
        let item = if self.app()?.active() == self.slot {
            self.model
                .borrow()
                .pinned
                .clone()
                .or(if finished { None } else { current })
        } else {
            None
        };
        self.q(".transition-card")?.set_hidden(item.is_none());
        self.q(".transition-empty")?.set_hidden(item.is_some());
        let Some(item) = item else {
            self.model.borrow_mut().active_transition = None;
            return Ok(());
        };
        let key = format!("{}:{}", text(&v, "id"), text(&item, "id"));
        let changed = self
            .model
            .borrow()
            .active_transition
            .as_ref()
            .is_none_or(|i| i["id"] != item["id"]);
        self.model.borrow_mut().active_transition = Some(item.clone());
        self.q(".transition-top strong")?
            .set_text_content(Some(&format!("🎬 NOW: {}", text(&item, "label"))));
        if changed {
            let mut listeners = vec![];
            let target = self.q(".transition-votes")?;
            target.set_text_content(None);
            for choice in ["up", "down"] {
                let b = node("button", if choice == "up" { "👍" } else { "👎" }, "")?;
                b.set_attribute("aria-label", &format!("{} {choice}", text(&item, "label")))?;
                let cb = b.clone();
                let key = key.clone();
                let id = text(&item, "id").to_owned();
                listeners.push(self.listener(&b,"click",move |c,_|{let key=key.clone();c.submit(cb.clone(),json!({"action":"transition","transition":id,"choice":choice,"t":c.video.current_time()}),move |c,r|{c.model.borrow_mut().transitions.insert(key,text(&r,"choice").into());c.transition_at()});Ok(())})?);
                append(&target, &b)?;
            }
            let target = self.q(".transition-tags")?;
            target.set_text_content(None);
            for tag in TAGS {
                let b = node("button", tag, "")?;
                button(&b)?.set_type("button");
                let fullkey = format!("{key}:{tag}");
                disabled(&b, self.model.borrow().tags.contains(&fullkey));
                let cb = b.clone();
                let id = text(&item, "id").to_owned();
                listeners.push(self.listener(&b, "click", move |c, _| {
                    let key = fullkey.clone();
                    c.submit(
                        cb.clone(),
                        json!({"action":"transition_tag","transition":id,"tag":tag}),
                        move |c, _| {
                            c.model.borrow_mut().tags.insert(key);
                            Ok(())
                        },
                    );
                    Ok(())
                })?);
                append(&target, &b)?;
            }
            self.q(".transition-comment input")?
                .dyn_into::<HtmlInputElement>()?
                .set_value("");
            self.listeners
                .borrow_mut()
                .insert("transition".into(), listeners);
        }
        let choice = self.model.borrow().transitions.get(&key).cloned();
        self.q(".transition-follow")?.set_hidden(choice.is_none());
        for (i, b) in self
            .all(".transition-votes button")?
            .into_iter()
            .enumerate()
        {
            let value = if i == 0 { "up" } else { "down" };
            b.set_attribute("aria-label", &format!("{} {value}", text(&item, "label")))?;
            disabled(&b, choice.is_some());
            selected(&b, choice.as_deref() == Some(value))?;
        }
        Ok(())
    }
    fn timeline(self: &Rc<Self>) -> Result<(), JsValue> {
        let target = self.q(".transition-timeline")?;
        target.set_text_content(None);
        let mut listeners = vec![];
        if let Some(v) = self.current() {
            for item in rows(&v, "transitions") {
                let up =
                    num(&self.model.borrow().stats[format!("transition:{}:up", text(&item, "id"))]);
                let down =
                    num(&self.model.borrow().stats
                        [format!("transition:{}:down", text(&item, "id"))]);
                let b = node("button", text(&item, "label"), "")?;
                b.style().set_property(
                    "flex-grow",
                    &(num(&item["end"]) - num(&item["start"])).to_string(),
                )?;
                b.set_class_name(if up + down > 0. {
                    if up >= down { "good" } else { "bad" }
                } else {
                    ""
                });
                let title = format!(
                    "{}–{} · {up} 👍 / {down} 👎",
                    stamp(num(&item["start"])),
                    stamp(num(&item["end"]))
                );
                b.set_title(&title);
                b.set_attribute(
                    "aria-label",
                    &format!("{} · jump and vote · {title}", text(&item, "label")),
                )?;
                listeners.push(self.listener(&b, "click", move |c, _| {
                    c.app()?.activate(c.slot, false)?;
                    c.video.set_current_time(num(&item["start"]));
                    c.model.borrow_mut().pinned = Some(item.clone());
                    c.transition_at()
                })?);
                append(&target, &b)?;
            }
        }
        self.listeners
            .borrow_mut()
            .insert("timeline".into(), listeners);
        Ok(())
    }
    fn render_bored(self: &Rc<Self>, data: &Value) -> Result<(), JsValue> {
        let duration = self
            .current()
            .map(|v| num(&v["duration"]))
            .filter(|n| *n > 0.)
            .unwrap_or(1.);
        let mut values = [0.; 24];
        if let Some(data) = data.as_object() {
            for (k, n) in data {
                if let Some((t, "bored")) = k.split_once(':')
                    && let Ok(t) = t.parse::<f64>()
                    && t.is_finite()
                {
                    values[(t / duration * 24.).floor().clamp(0., 23.) as usize] += num(n);
                }
            }
        }
        let max = values.iter().copied().fold(1., f64::max);
        self.bored_heat.set_text_content(None);
        let mut listeners = vec![];
        for (i, n) in values.into_iter().enumerate() {
            let b = node("button", "", "")?;
            button(&b)?.set_type("button");
            disabled(&b, self.current().is_none());
            b.style().set_property(
                "--heat",
                &if n != 0. {
                    (0.25 + 0.75 * n / max).to_string()
                } else {
                    "0".into()
                },
            )?;
            let t = i as f64 / 24. * duration;
            let label = format!("{} · {n} bored reactions", stamp(t));
            b.set_attribute("aria-label", &label)?;
            b.set_title(&label);
            listeners.push(self.listener(&b, "click", move |c, _| {
                c.video.set_current_time(t);
                c.video.focus()
            })?);
            append(&self.bored_heat, &b)?;
        }
        self.listeners
            .borrow_mut()
            .insert("bored".into(), listeners);
        Ok(())
    }
    fn render_heat(self: &Rc<Self>, data: &Value) -> Result<(), JsValue> {
        let duration = self.current().map(|v| num(&v["duration"])).unwrap_or(0.);
        let mut values = [(0., 0.); 24];
        if let Some(data) = data.as_object() {
            for (k, n) in data {
                if let Some((t, kind)) = k.split_once(':')
                    && let Ok(t) = t.parse::<f64>()
                    && t.is_finite()
                {
                    let i = (t / if duration > 0. { duration } else { 1. } * 24.)
                        .floor()
                        .clamp(0., 23.) as usize;
                    values[i].0 += num(n);
                    if ["neutral", "cut", "skull", "bored"].contains(&kind) {
                        values[i].1 += num(n);
                    }
                }
            }
        }
        let max = values.iter().map(|v| v.0).fold(1., f64::max);
        let target = self.q(".heat")?;
        target.set_text_content(None);
        let mut listeners = vec![];
        for (i, (total, bad)) in values.into_iter().enumerate() {
            let t = i as f64 / 24. * duration;
            let b = node("button", "", "")?;
            b.style()
                .set_property("height", &format!("{}px", 8. + total / max * 28.))?;
            b.set_class_name(if total != 0. {
                if bad > total / 2. { "cut" } else { "hot" }
            } else {
                ""
            });
            disabled(&b, self.current().is_none());
            let title = format!("{} · {total} reactions", stamp(t));
            b.set_title(&title);
            b.set_attribute("aria-label", &title)?;
            listeners.push(self.listener(&b, "click", move |c, _| {
                c.video.set_current_time(t);
                c.video.focus()
            })?);
            append(&target, &b)?;
        }
        self.listeners.borrow_mut().insert("heat".into(), listeners);
        Ok(())
    }
    pub fn hide_poll(&self) -> Result<(), JsValue> {
        self.model.borrow_mut().poll_until = None;
        self.q(".poll")?.set_hidden(true);
        Ok(())
    }
    fn poll_tick(&self) -> Result<(), JsValue> {
        if let Some(until) = self.model.borrow().poll_until {
            let n = ((until - js_sys::Date::now()) / 1000.).ceil();
            if n <= 0. {
                self.q(".poll")?.set_hidden(true);
            } else {
                self.q(".poll-timer")?
                    .set_text_content(Some(&format!("{n}s to answer")));
            }
        }
        Ok(())
    }
    pub fn show_poll(self: &Rc<Self>, p: &Value, seconds: f64) -> Result<(), JsValue> {
        let Some(v) = self.current() else {
            return Ok(());
        };
        let app = self.app()?;
        let version = text(p, "version");
        let id = text(p, "id");
        let key = format!("{}:{id}", text(&v, "id"));
        if app.active() != self.slot
            || (!version.is_empty() && version != "all" && version != text(&v, "id"))
            || (version == "all" && app.global_polls.borrow().contains(id))
            || self.model.borrow().seen_polls.contains(&key)
            || seconds <= 0.
        {
            return Ok(());
        }
        self.model.borrow_mut().seen_polls.insert(key);
        if version == "all" {
            app.global_polls.borrow_mut().insert(id.into());
        }
        self.hide_poll()?;
        self.model.borrow_mut().poll_until = Some(
            js_sys::Date::now()
                + seconds.min(if id.starts_with("live-") { 120. } else { 5. }) * 1000.,
        );
        self.q(".poll-question")?
            .set_text_content(Some(text(p, "q")));
        let target = self.q(".poll-options")?;
        target.set_text_content(None);
        let mut listeners = vec![];
        for (i, o) in rows(p, "options").into_iter().enumerate() {
            let b = node("button", o.as_str().unwrap_or(""), "")?;
            let cb = b.clone();
            let id = id.to_owned();
            listeners.push(self.listener(&b, "click", move |c, _| {
                c.submit(
                    cb.clone(),
                    json!({"action":"poll","poll":id,"option":i}),
                    |c, _| c.hide_poll(),
                );
                Ok(())
            })?);
            append(&target, &b)?;
        }
        self.listeners.borrow_mut().insert("poll".into(), listeners);
        self.q(".poll")?.set_hidden(false);
        self.poll_tick()
    }
}
