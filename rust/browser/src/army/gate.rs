use super::*;
#[derive(Default)]
struct Gate {
    user: Value,
    epoch: u64,
    crow_timer: i32,
}
type State = Rc<RefCell<Gate>>;
fn reduced() -> bool {
    web_sys::window()
        .and_then(|w| {
            w.match_media("(prefers-reduced-motion: reduce)")
                .ok()
                .flatten()
        })
        .is_some_and(|m| m.matches())
}
fn links() -> Result<(), JsValue> {
    let enlisted = !ui::element("ceremony")?.hidden();
    let nodes = ui::doc()?.query_selector_all("[data-gate-enlist]")?;
    for i in 0..nodes.length() {
        if let Some(e) = nodes.item(i).and_then(|n| n.dyn_into::<HtmlElement>().ok()) {
            e.set_attribute("href", if enlisted { "#ceremony" } else { "#enlist" })?;
            let key = if enlisted {
                "gateAlready".into()
            } else {
                e.get_attribute("data-gate-enlist").unwrap_or_default()
            };
            e.set_attribute("data-army", &key)?;
            e.set_text_content(Some(&t(&key)));
        }
    }
    Ok(())
}
fn ranks() -> Result<(), JsValue> {
    let cfg = corvus_core::army::config();
    let root = ui::element("rank-ladder")?;
    root.set_text_content(None);
    for r in arr(cfg, "RANKS") {
        append(
            &root,
            &node(
                "span",
                &format!(
                    "{} {} · {}",
                    t("rankLabel"),
                    string(&r[0]),
                    tf("rankPoints", &json!({"n":r[1]}))
                ),
                "",
            )?,
        )?;
    }
    let root = ui::element("rank-rules")?;
    root.set_text_content(None);
    for (key, w) in [
        ("rankHelp", "help"),
        ("rankMission", "daily"),
        ("rankRecruit", "recruit"),
        ("rankPidgyRecruit", "recruit"),
    ] {
        let r = node("tr", "", "")?;
        append(&r, &node("td", &t(key), "")?)?;
        append(
            &r,
            &node("td", &format!("+{}", string(&cfg["WEIGHTS"][w])), "")?,
        )?;
        append(&root, &r)?;
    }
    Ok(())
}
fn identity_render(s: &State) -> Result<(), JsValue> {
    let u = s.borrow().user.clone();
    for id in ["ceremony-ranks", "toll-ranks", "stripes-ranks"] {
        if let Ok(e) = ui::element(id) {
            e.set_hidden(u.is_null());
            if !u.is_null() {
                badges(&e, &u, false)?;
            }
        }
    }
    Ok(())
}
async fn frame() -> Result<(), JsValue> {
    let p = js_sys::Promise::new(&mut |resolve, reject| {
        if let Some(w) = web_sys::window() {
            if let Err(e) = w.request_animation_frame(&resolve) {
                let _ = reject.call1(&JsValue::NULL, &e);
            }
        } else {
            let _ = reject.call1(&JsValue::NULL, &"window".into());
        }
    });
    JsFuture::from(p).await?;
    Ok(())
}
async fn ceremony(s: &State, u: Value) -> Result<(), JsValue> {
    s.borrow_mut().user = u.clone();
    s.borrow_mut().epoch += 1;
    if let Some(e) = ui::doc()?
        .active_element()
        .and_then(|n| n.dyn_into::<HtmlElement>().ok())
    {
        e.blur()?;
    }
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let start = js_sys::Date::now();
    while let Some(vv) = w.visual_viewport() {
        if vv.height() > w.inner_height()?.as_f64().unwrap_or(1.0) * 0.85
            || js_sys::Date::now() - start >= 600.0
        {
            break;
        }
        ui::sleep(30).await?;
    }
    tag("dog-tag", &u, text(&u, "code"))?;
    ui::hidden("enlist", true);
    ui::hidden("ceremony", false);
    identity_render(s)?;
    links()?;
    frame().await?;
    frame().await?;
    let e = ui::element("ceremony")?;
    let rect = e.get_bounding_client_rect();
    let top = (w.scroll_y()? + rect.top()
        - ((w.inner_height()?.as_f64().unwrap_or(0.0) - rect.height()) / 2.0).max(0.0))
    .max(0.0);
    let options = web_sys::ScrollToOptions::new();
    options.set_top(top);
    options.set_behavior(web_sys::ScrollBehavior::Instant);
    w.scroll_to_with_scroll_to_options(&options);
    let options = web_sys::FocusOptions::new();
    options.set_prevent_scroll(true);
    e.focus_with_options(&options)
}
async fn identity(s: &State) -> Result<Value, JsValue> {
    if s.borrow().user.is_null() {
        let v = api(Some(json!({"action":"begin"})), "").await?;
        if s.borrow().user.is_null() {
            s.borrow_mut().user = v["self"].clone();
        }
    }
    Ok(s.borrow().user.clone())
}
fn dialog(id: &str) -> Result<web_sys::HtmlDialogElement, JsValue> {
    ui::element(id)?.dyn_into().map_err(Into::into)
}
async fn counts() {
    if ui::doc().is_ok_and(|d| d.hidden()) {
        return;
    }
    let result=async{let v=api(None,"?view=public").await?;for(id,key)in[("count-soldiers","soldiers"),("count-gate","atGate"),("count-today","recruitedToday")]{let e=ui::element(id)?;let s=string(v.get(key).filter(|v|corvus_core::army::truthy(v)).unwrap_or(&json!(0)));if e.text_content().as_deref()!=Some(&s){e.set_text_content(Some(&s));if !reduced(){let f=js_sys::Reflect::get(&e,&"animate".into())?.dyn_into::<js_sys::Function>()?;let _=f.call2(&e,&js(&json!([{"opacity":0.3,"transform":"translateY(5px)"},{"opacity":1,"transform":"translateY(0)"}]))?,&js(&json!({"duration":400}))?);}}}Ok::<(),JsValue>(())}.await;
    if result.is_err() {
        ui::text("count-status", &t("resting"));
    }
}
#[wasm_bindgen]
pub fn start_army_gate() -> Result<(), JsValue> {
    if !once("gate")? {
        return Ok(());
    }
    let s = Rc::new(RefCell::new(Gate::default()));
    let ss = s.clone();
    init(move || {
        identity_render(&ss)?;
        let u = ss.borrow().user.clone();
        if !u.is_null() && !ui::element("ceremony")?.hidden() {
            tag("dog-tag", &u, text(&u, "code"))?;
        }
        links()?;
        ranks()?;
        benefit("toll-next-rank", text(&u, "tier"))?;
        if let Ok(e) = select("enlist-country") {
            countries("enlist-country", &e.value())?;
        }
        Ok(())
    })?;
    ranks()?;
    let e = node("div", "", "")?;
    e.set_inner_html("<label for=\"enlist-country\" data-army=\"country\"></label><select id=\"enlist-country\" name=\"country\"></select><small data-army=\"countryNote\"></small>");
    let before = ui::element("enlist-why")?.previous_element_sibling();
    form("enlist-form")?.insert_before(&e, before.as_ref().map(|n| n.as_ref()))?;
    translate()?;
    countries("enlist-country", "")?;
    ui::listen(ui::element("enlist-why")?.as_ref(), "input", move |_| {
        if let Ok(e) = ui::element("enlist-why").and_then(|n| {
            n.dyn_into::<web_sys::HtmlTextAreaElement>()
                .map_err(Into::into)
        }) {
            ui::text("why-count", &format!("{}/280", e.value().chars().count()));
        }
    })?;
    let ss = s.clone();
    wire("enlist-form", "enlist", "enlist-status", move |v| {
        let s = ss.clone();
        async move {
            ceremony(&s, v["self"].clone()).await?;
            ui::text(
                "ceremony-note",
                &t(if v["mail"] == "sent" {
                    "verifyNote"
                } else {
                    "mailQueued"
                }),
            );
            spawn_local(counts());
            Ok(())
        }
    })?;
    let ss = s.clone();
    ui::listen(ui::element("stripes-door")?.as_ref(), "click", move |_| {
        report(dialog("stripes-dialog").and_then(|d| d.show_modal()));
        ui::text("stripes-status", &t("working"));
        let s = ss.clone();
        spawn_local(async move {
            let r = async {
                let u = identity(&s).await?;
                identity_render(&s)?;
                ui::text("recruit-link", &recruit(text(&u, "code")));
                ui::text("stripes-status", "");
                Ok::<(), JsValue>(())
            }
            .await;
            if let Err(e) = r {
                ui::text("stripes-status", &error(&e));
            }
        });
    })?;
    let ss = s.clone();
    ui::listen(ui::element("toll-door")?.as_ref(), "click", move |_| {
        report(benefit("toll-next-rank", text(&ss.borrow().user, "tier")));
        report(dialog("toll-dialog").and_then(|d| d.show_modal()));
    })?;
    let nodes = ui::doc()?.query_selector_all("[data-close]")?;
    for i in 0..nodes.length() {
        if let Some(e) = nodes.item(i).and_then(|n| n.dyn_into::<HtmlElement>().ok()) {
            let e2 = e.clone();
            ui::listen(e.as_ref(), "click", move |_| {
                if let Ok(Some(d)) = e2.closest("dialog")
                    && let Ok(d) = d.dyn_into::<web_sys::HtmlDialogElement>()
                {
                    d.close();
                }
            })?;
        }
    }
    let nodes = ui::doc()?.query_selector_all("dialog")?;
    for i in 0..nodes.length() {
        if let Some(d) = nodes
            .item(i)
            .and_then(|n| n.dyn_into::<web_sys::HtmlDialogElement>().ok())
        {
            let d2 = d.clone();
            ui::listen(d.as_ref(), "click", move |e| {
                if e.target().is_some_and(|t| js_sys::Object::is(&t, &d2))
                    && let Some(m) = e.dyn_ref::<web_sys::MouseEvent>()
                {
                    let r = d2.get_bounding_client_rect();
                    let (x, y) = (f64::from(m.client_x()), f64::from(m.client_y()));
                    if x < r.left() || x > r.right() || y < r.top() || y > r.bottom() {
                        d2.close();
                    }
                }
            })?;
        }
    }
    for (id, kind, status) in [
        ("stripes-copy", 0, "stripes-status"),
        ("stripes-share", 1, "stripes-status"),
        ("copy-recruit", 0, "share-status"),
        ("share-tag", 1, "share-status"),
        ("save-tag", 2, "share-status"),
    ] {
        let s = s.clone();
        ui::listen(ui::element(id)?.as_ref(), "click", move |_| {
            let u = s.borrow().user.clone();
            if u.is_null() {
                return;
            }
            spawn_local(async move {
                match kind {
                    0 => copy(text(&u, "code"), status).await,
                    1 => share(text(&u, "code"), status).await,
                    _ => save_art(&u, text(&u, "code"), false, status).await,
                }
            });
        })?;
    }
    spawn_local(counts());
    let cb = Closure::<dyn FnMut()>::new(move || spawn_local(counts()));
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let timer = w.set_interval_with_callback_and_timeout_and_arguments_0(
        cb.as_ref().unchecked_ref(),
        30000,
    )?;
    cb.forget();
    let w2 = w.clone();
    ui::listen(w.as_ref(), "pagehide", move |_| {
        w2.clear_interval_with_handle(timer)
    })?;
    ui::listen(ui::doc()?.as_ref(), "visibilitychange", move |_| {
        if let Ok(d) = ui::doc() {
            if let Some(b) = d.body() {
                let _ = b.class_list().toggle_with_force("army-paused", d.hidden());
            }
            if !d.hidden() {
                spawn_local(counts());
            }
        }
    })?;
    let ss = s.clone();
    let epoch = s.borrow().epoch;
    spawn_local(async move {
        if let Ok(d) = api(None, "").await {
            if ss.borrow().epoch != epoch {
                return;
            }
            let u = d["self"].clone();
            ss.borrow_mut().user = u.clone();
            report(identity_render(&ss));
            report(benefit("toll-next-rank", text(&u, "tier")));
            if !text(&u, "referrer").is_empty() {
                ui::text(
                    "invitation",
                    &tf("invitation", &json!({"name":u["referrer"]})),
                );
                ui::hidden("invitation", false);
            }
            if corvus_core::army::truthy(&u["serial"])
                && ["unconfirmed", "waiting", "approved", "later"].contains(&text(&u, "status"))
            {
                report(ceremony(&ss, u).await);
            }
        }
    });
    let f = form("reminder-form")?;
    let f2 = f.clone();
    ui::listen(f.as_ref(), "submit", move |e| {
        e.prevent_default();
        if !f2.report_validity() {
            return;
        }
        let kinds = ["daily", "weekly"]
            .into_iter()
            .filter(|k| {
                query(f2.as_ref(), &format!("[name={k}]"))
                    .ok()
                    .and_then(|e| e.dyn_into::<HtmlInputElement>().ok())
                    .is_some_and(|e| e.checked())
            })
            .collect::<Vec<_>>();
        if kinds.is_empty() {
            ui::text("reminder-status", &t("fields"));
            return;
        }
        let Ok(b) = query(f2.as_ref(), "button") else {
            return;
        };
        if b.has_attribute("disabled") {
            return;
        }
        disabled(&b, true);
        ui::text("reminder-status", &t("working"));
        let f = f2.clone();
        spawn_local(async move {
            let r = async {
                let data = fields(&f)?;
                for kind in kinds {
                    submit("subscribe", json!({"email":data["email"],"kind":kind})).await?;
                }
                Ok::<(), JsValue>(())
            }
            .await;
            match r {
                Ok(_) => ui::text("reminder-status", &t("verifyNote")),
                Err(e) => ui::text("reminder-status", &error(&e)),
            }
            disabled(&b, false);
        });
    })?;
    if let Some(e) = ui::doc()?.query_selector(".crow-tap")? {
        let e = e.dyn_into::<HtmlElement>()?;
        let tap = e.clone();
        ui::listen(e.as_ref(), "click", move |_| {
            if let Ok(Some(a)) = ui::doc().and_then(|d| d.query_selector(".napoleon-crow")) {
                let _ = a.class_list().remove_1("hop");
                if let Some(h) = a.dyn_ref::<HtmlElement>() {
                    let _ = h.offset_width();
                }
                let _ = a.class_list().add_1("hop");
            }
            let _ = tap.class_list().add_1("cawing");
            if let Some(w) = web_sys::window() {
                w.clear_timeout_with_handle(s.borrow().crow_timer);
                let tap = tap.clone();
                let cb = Closure::once_into_js(move || {
                    let _ = tap.class_list().remove_1("cawing");
                    ui::scroll("doors", !reduced(), false);
                });
                if let Ok(id) =
                    w.set_timeout_with_callback_and_timeout_and_arguments_0(cb.unchecked_ref(), 900)
                {
                    s.borrow_mut().crow_timer = id;
                }
            }
        })?;
    }
    ready("gate");
    Ok(())
}
