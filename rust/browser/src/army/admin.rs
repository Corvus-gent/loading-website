use super::*;
struct Admin {
    root: HtmlElement,
    status: HtmlElement,
    filter: HtmlSelectElement,
    search: HtmlInputElement,
    list: HtmlElement,
    payments: HtmlElement,
    prev: HtmlElement,
    next: HtmlElement,
    label: HtmlElement,
    offset: usize,
    sequence: u64,
    search_sequence: u64,
    revoked: bool,
    listeners: Vec<ui::Listener>,
}
type State = Rc<RefCell<Admin>>;
fn el(tag: &str, s: &str) -> Result<HtmlElement, JsValue> {
    node(tag, s, "")
}
async fn request(s: &State, body: Option<Value>) -> Result<Value, JsValue> {
    let q = {
        let a = s.borrow();
        if body.is_some() {
            "?admin=1".into()
        } else {
            format!(
                "?admin=1&status={}&search={}&offset={}",
                enc(&a.filter.value()),
                enc(&a.search.value()),
                a.offset
            )
        }
    };
    api(body, &q).await
}
fn problem(s: &State, e: &JsValue) {
    let revoked = js_sys::Reflect::get(e, &"status".into())
        .ok()
        .and_then(|v| v.as_f64())
        .is_some_and(|v| v == 401.0 || v == 403.0);
    let mut a = s.borrow_mut();
    a.status
        .set_text_content(Some(&format!("legion unavailable: {}", ui::message(e))));
    disabled(&a.prev, a.offset == 0);
    if revoked {
        a.revoked = true;
        a.sequence += 1;
        a.list.set_text_content(None);
        a.payments.set_text_content(None);
        a.label.set_text_content(None);
        a.listeners.clear();
        disabled(&a.prev, true);
        disabled(&a.next, true);
    }
}
fn action(s: State, body: Value, b: HtmlElement) {
    if s.borrow().revoked {
        return;
    }
    disabled(&b, true);
    spawn_local(async move {
        match request(&s, Some(body)).await {
            Ok(_) => load(s).await,
            Err(e) => {
                problem(&s, &e);
                disabled(&b, false);
            }
        }
    });
}
fn row_listener(s: &State, b: &HtmlElement, body: Value, reject: bool) -> Result<(), JsValue> {
    let weak = Rc::downgrade(s);
    let button = b.clone();
    let l = ui::scoped_listener(b.as_ref(), "click", move |_| {
        if let Some(s) = weak.upgrade() {
            let mut body = body.clone();
            if reject {
                body["notify"] = json!(web_sys::window().is_some_and(|w| {
                    w.confirm_with_message("send a polite rejection email?")
                        .unwrap_or(false)
                }));
            }
            action(s, body, button.clone());
        }
    })?;
    s.borrow_mut().listeners.push(l);
    Ok(())
}
fn render(s: &State, data: &Value) -> Result<(), JsValue> {
    let rows = arr(data, "rows");
    let mut a = s.borrow_mut();
    a.listeners.clear();
    let total = data["total"].as_u64().unwrap_or(0) as usize;
    a.label.set_text_content(Some(&if total > 0 {
        format!("{}–{} of {total}", a.offset + 1, a.offset + rows.len())
    } else {
        "0 members".into()
    }));
    disabled(&a.prev, a.offset == 0);
    disabled(&a.next, a.offset + rows.len() >= total);
    a.status.set_text_content(Some(&format!(
        "{}{} mail queue: {} · {}",
        if data["discordReady"] == true {
            "discord connected."
        } else {
            "discord not connected. approved invitations are queued."
        },
        if data["discordAudit"]["state"] == "unsafe" {
            " WARNING: Discord invite permissions changed. "
        } else {
            ""
        },
        string(
            data["mail"]
                .get("waiting")
                .filter(|v| !v.is_null())
                .unwrap_or(&json!(0))
        ),
        data["mail"]["state"]
            .as_str()
            .filter(|s| !s.is_empty())
            .unwrap_or("idle")
    )));
    a.list.set_text_content(None);
    a.payments.set_text_content(None);
    let list = a.list.clone();
    let payments = a.payments.clone();
    drop(a);
    for row in &rows {
        let e = el("article", "")?;
        e.style()
            .set_css_text("border-top:1px solid #333;padding:20px 0;overflow-wrap:anywhere");
        append(
            &e,
            &el(
                "h3",
                &format!(
                    "{} · {}",
                    if text(row, "username").is_empty() {
                        "subscriber"
                    } else {
                        text(row, "username")
                    },
                    text(row, "status")
                ),
            )?,
        )?;
        append(
            &e,
            &el(
                "p",
                &format!(
                    "{} · {}",
                    text(row, "email"),
                    if row["verified"] == true {
                        "email verified"
                    } else {
                        "email unconfirmed"
                    }
                ),
            )?,
        )?;
        append(
            &e,
            &el(
                "p",
                if text(row, "why").is_empty() {
                    "No gate application — joined as an account."
                } else {
                    text(row, "why")
                },
            )?,
        )?;
        append(
            &e,
            &el(
                "p",
                &format!(
                    "rank: {} · country: {} · recruits: {} · joined: {}",
                    if text(row, "rank").is_empty() {
                        "tiro"
                    } else {
                        text(row, "rank")
                    },
                    if text(row, "country").is_empty() {
                        "—"
                    } else {
                        text(row, "country")
                    },
                    string(
                        row.get("recruits")
                            .filter(|v| !v.is_null())
                            .unwrap_or(&json!(0))
                    ),
                    ["created", "applied"]
                        .iter()
                        .map(|k| text(row, k))
                        .find(|s| !s.is_empty())
                        .unwrap_or("—")
                ),
            )?,
        )?;
        if !text(row, "link").is_empty() {
            let a = el("a", text(row, "link"))?;
            a.set_attribute("href", text(row, "link"))?;
            a.set_attribute("target", "_blank")?;
            a.set_attribute("rel", "noopener noreferrer")?;
            append(&e, &a)?;
        }
        let controls = el("p", "")?;
        if corvus_core::army::truthy(&row["applied"]) {
            for name in ["approve", "reject", "later"] {
                let b = el("button", name)?;
                disabled(&b, name == "approve" && row["verified"] != true);
                b.style().set_property("min-height", "44px")?;
                row_listener(
                    s,
                    &b,
                    json!({"action":name,"id":row["id"],"notify":false}),
                    name == "reject",
                )?;
                append(&controls, &b)?;
            }
        }
        append(&e, &controls)?;
        append(&list, &e)?;
    }
    append(&payments, &el("h3", "unmatched payments")?)?;
    let unmatched = arr(data, "unmatched");
    for p in &unmatched {
        let e = el("div", "")?;
        let label = el(
            "span",
            &format!(
                "{} · {} · {} {} · {}",
                text(p, "date"),
                ["level", "type"]
                    .iter()
                    .map(|k| text(p, k))
                    .find(|s| !s.is_empty())
                    .unwrap_or(""),
                string(&p["amount"]),
                text(p, "currency"),
                if text(p, "username").is_empty() {
                    "no handle"
                } else {
                    text(p, "username")
                }
            ),
        )?;
        append(&e, &label)?;
        if !text(p, "review_reason").is_empty() {
            let review = el(
                "p",
                if p["review_reason"] == "consul_capacity" {
                    "Owner review required: both Consul seats are occupied. This payment was not granted a seat. Arrange a refund or another outcome with the payer."
                } else {
                    "Owner review required before matching this payment."
                },
            )?;
            review.set_attribute("role", "status")?;
            review.set_attribute("data-review-reason", text(p, "review_reason"))?;
            append(&e, &review)?;
        }
        let input = el("input", "")?.dyn_into::<HtmlInputElement>()?;
        input.set_placeholder("corvus username");
        input.set_attribute("aria-label", "match payment to username")?;
        let b = el("button", "link to username")?;
        let weak = Rc::downgrade(s);
        let bb = b.clone();
        let inp = input.clone();
        let event = p["event"].clone();
        let listener = ui::scoped_listener(b.as_ref(), "click", move |_| {
            if let Some(s) = weak.upgrade() {
                action(
                    s,
                    json!({"action":"link-toll","payment":event,"username":inp.value().trim()}),
                    bb.clone(),
                );
            }
        })?;
        s.borrow_mut().listeners.push(listener);
        append(&e, &input)?;
        append(&e, &b)?;
        append(&payments, &e)?;
    }
    if rows.is_empty() {
        append(&list, &el("p", "the gate is quiet.")?)?;
    }
    if unmatched.is_empty() {
        append(&payments, &el("p", "nothing waiting to be linked.")?)?;
    }
    Ok(())
}
async fn load(s: State) {
    let ticket = {
        let mut a = s.borrow_mut();
        if a.revoked || !a.root.is_connected() {
            return;
        }
        a.sequence += 1;
        disabled(&a.prev, true);
        disabled(&a.next, true);
        a.sequence
    };
    loop {
        match request(&s, None).await {
            Ok(data) => {
                if s.borrow().sequence != ticket
                    || s.borrow().revoked
                    || !s.borrow().root.is_connected()
                {
                    return;
                }
                if arr(&data, "rows").is_empty() && s.borrow().offset > 0 {
                    let next = s.borrow().offset.saturating_sub(40);
                    s.borrow_mut().offset = next;
                    continue;
                }
                if let Err(e) = render(&s, &data) {
                    problem(&s, &e);
                }
                return;
            }
            Err(e) => {
                if s.borrow().sequence == ticket {
                    problem(&s, &e);
                }
                return;
            }
        }
    }
}
#[wasm_bindgen]
pub async fn mount_army_admin(root: HtmlElement) -> Result<(), JsValue> {
    let heading = el("h2", "legion / gate")?;
    let status = el("p", "")?;
    let controls = el("div", "")?;
    let list = el("div", "")?;
    let payments = el("div", "")?;
    let filter = el("select", "")?.dyn_into::<HtmlSelectElement>()?;
    for name in [
        "all",
        "member",
        "subscriber",
        "unconfirmed",
        "waiting",
        "approved",
        "later",
        "rejected",
    ] {
        option(&filter, name, if name == "all" { "" } else { name })?;
    }
    filter.set_attribute("aria-label", "application status")?;
    let search = el("input", "")?.dyn_into::<HtmlInputElement>()?;
    search.set_placeholder("username or email");
    search.set_attribute("aria-label", "find application")?;
    search.set_type("search");
    let refresh = el("button", "refresh")?;
    append(&controls, &filter)?;
    append(&controls, &search)?;
    append(&controls, &refresh)?;
    root.set_text_content(None);
    for e in [&heading, &status, &controls, &list, &payments] {
        append(&root, e)?;
    }
    let pagination = el("div", "")?;
    let prev = el("button", "← Previous")?;
    let label = el("span", "")?;
    let next = el("button", "Next →")?;
    for e in [&prev, &next] {
        e.set_attribute("type", "button")?;
        e.style().set_property("min-height", "44px")?;
    }
    pagination
        .style()
        .set_css_text("display:flex;gap:12px;align-items:center;flex-wrap:wrap");
    for e in [&prev, &label, &next] {
        append(&pagination, e)?;
    }
    list.after_with_node_1(&pagination)?;
    let s = Rc::new(RefCell::new(Admin {
        root: root.clone(),
        status,
        filter: filter.clone(),
        search: search.clone(),
        list,
        payments,
        prev: prev.clone(),
        next: next.clone(),
        label,
        offset: 0,
        sequence: 0,
        search_sequence: 0,
        revoked: false,
        listeners: vec![],
    }));
    for (e, step) in [(&prev, -1), (&next, 1), (&refresh, 0)] {
        let s = s.clone();
        ui::listen(e.as_ref(), "click", move |_| {
            {
                let mut a = s.borrow_mut();
                if step < 0 {
                    a.offset = a.offset.saturating_sub(40);
                } else if step > 0 {
                    a.offset += 40;
                }
            }
            spawn_local(load(s.clone()));
        })?;
    }
    let ss = s.clone();
    ui::listen(filter.as_ref(), "change", move |_| {
        ss.borrow_mut().offset = 0;
        spawn_local(load(ss.clone()));
    })?;
    let ss = s.clone();
    ui::listen(search.as_ref(), "input", move |_| {
        let s = ss.clone();
        let ticket = {
            let mut a = s.borrow_mut();
            a.search_sequence += 1;
            a.search_sequence
        };
        spawn_local(async move {
            let _ = ui::sleep(300).await;
            if s.borrow().search_sequence == ticket {
                s.borrow_mut().offset = 0;
                load(s).await;
            }
        });
    })?;
    let f = el("form", "")?.dyn_into::<HtmlFormElement>()?;
    let title = el("h3", "confirm help or an intro")?;
    let name = el("input", "")?.dyn_into::<HtmlInputElement>()?;
    name.set_placeholder("corvus username");
    name.set_attribute("aria-label", "contributor username")?;
    name.set_required(true);
    name.set_max_length(24);
    let kind = el("select", "")?.dyn_into::<HtmlSelectElement>()?;
    for n in ["help", "intro"] {
        option(&kind, n, n)?;
    }
    kind.set_attribute("aria-label", "contribution type")?;
    let reference = el("input", "")?.dyn_into::<HtmlInputElement>()?;
    reference.set_placeholder("report or intro reference (one per contribution)");
    reference.set_attribute("aria-label", "contribution reference")?;
    reference.set_required(true);
    reference.set_min_length(8);
    reference.set_max_length(180);
    let b = el("button", "approve contribution (+25)")?;
    b.set_attribute("type", "submit")?;
    b.style().set_property("min-height", "44px")?;
    let hs = el("p", "")?;
    hs.set_attribute("role", "status")?;
    append(&f, &title)?;
    append(
        &f,
        &el(
            "p",
            "only confirm help you have checked. the same reference counts once; payment never counts.",
        )?,
    )?;
    for n in [
        name.as_ref(),
        kind.as_ref(),
        reference.as_ref(),
        b.as_ref(),
        hs.as_ref(),
    ] {
        f.append_child(n)?;
    }
    controls.after_with_node_1(&f)?;
    let ff = f.clone();
    let ss = s.clone();
    ui::listen(f.as_ref(), "submit", move |e| {
        e.prevent_default();
        if !ff.report_validity() || b.has_attribute("disabled") || ss.borrow().revoked {
            return;
        }
        disabled(&b, true);
        let body = json!({"action":"approve-help","username":name.value(),"kind":kind.value(),"reference":reference.value()});
        let (s, b, hs) = (ss.clone(), b.clone(), hs.clone());
        spawn_local(async move {
            match request(&s, Some(body)).await {
                Ok(v) => {
                    hs.set_text_content(Some(if v["credited"] == true {
                        "confirmed. +25 earned points."
                    } else {
                        "already counted. no extra points."
                    }));
                    load(s).await;
                }
                Err(e) => {
                    hs.set_text_content(Some(&ui::message(&e)));
                    problem(&s, &e);
                }
            }
            disabled(&b, false);
        });
    })?;
    load(s).await;
    root.set_attribute("data-rust-army-admin-ready", "")?;
    Ok(())
}
