use super::*;
#[derive(Default)]
struct Account {
    user: Value,
    token: String,
    epoch: u64,
}
type State = Rc<RefCell<Account>>;
fn status(e: &JsValue) {
    ui::text("account-status", &error(e));
}
fn claim_screen(s: &State) {
    if !s.borrow().token.is_empty() {
        ui::hidden("claim-box", false);
        for id in ["account-forms", "account-pending", "account-settings"] {
            ui::hidden(id, true);
        }
    }
}
fn take_token() -> Result<String, JsValue> {
    let w = web_sys::window().ok_or(JsValue::NULL)?;
    let early = js_sys::Reflect::get(&w, &"__armyClaimToken".into())?.as_string();
    let _ = js_sys::Reflect::delete_property(&w, &"__armyClaimToken".into());
    let hash = w.location().hash()?;
    let token = early
        .or_else(|| {
            web_sys::UrlSearchParams::new_with_str(hash.trim_start_matches('#'))
                .ok()
                .and_then(|q| q.get("token"))
        })
        .unwrap_or_default();
    if !token.is_empty() {
        w.history()?.replace_state_with_url(
            &JsValue::NULL,
            "",
            Some(&format!(
                "{}{}",
                w.location().pathname()?,
                w.location().search()?
            )),
        )?;
    }
    Ok(token)
}
fn show(s: &State) -> Result<(), JsValue> {
    let user = s.borrow().user.clone();
    let manage = user["canManage"] == true;
    ui::hidden("account-forms", manage);
    ui::hidden("account-settings", !manage);
    ui::hidden("account-pending", true);
    if !manage {
        return Ok(());
    }
    benefit("account-next-rank", text(&user, "tier"))?;
    ui::hidden("account-pidgy", text(&user, "pidgyCode").is_empty());
    ui::text("account-pidgy-code", text(&user, "pidgyCode"));
    ui::text(
        "account-pidgy-trials",
        &tf(
            "pidgyTrials",
            &json!({"count":user.get("pidgyTrials").filter(|v|!v.is_null()).cloned().unwrap_or(json!(0))}),
        ),
    );
    let p = ui::element("public-profile")?;
    p.set_attribute(
        "href",
        &format!("/soldier/{}", enc(text(&user, "username"))),
    )?;
    p.set_hidden(text(&user, "username").is_empty());
    let d = match ui::element("account-discord") {
        Ok(d) => d,
        Err(_) => {
            let d = node("button", "discord →", "")?;
            d.set_id("account-discord");
            d.set_attribute("type", "button")?;
            ui::element("account-ranks")?.after_with_node_1(&d)?;
            let s = s.clone();
            ui::listen(d.as_ref(), "click", move |_| {
                let epoch = s.borrow().epoch;
                let s = s.clone();
                spawn_local(async move {
                    let r = api(Some(json!({"action":"discord-code"})), "").await;
                    if s.borrow().epoch != epoch {
                        return;
                    }
                    match r {
                        Ok(v) => {
                            ui::text("account-status", &format!("/claim {}", text(&v, "code")))
                        }
                        Err(e) => status(&e),
                    }
                });
            })?;
            d
        }
    };
    d.set_hidden(user["discordReady"] != true);
    badges(&ui::element("account-ranks")?, &user, false)?;
    tag("account-tag", &user, text(&user, "code"))?;
    input("edit-link")?.set_value(text(&user, "link"));
    countries("edit-country", text(&user, "country"))?;
    query(form("profile-form")?.as_ref(), "input[name=hidden]")?
        .dyn_into::<HtmlInputElement>()?
        .set_checked(user["hidden"] == true);
    ui::text("account-recruit-url", &recruit(text(&user, "code")));
    Ok(())
}
fn clear(s: &State) {
    let mut v = s.borrow_mut();
    v.epoch += 1;
    v.user = Value::Null;
    v.token.clear();
    for id in [
        "account-tag",
        "pending-tag",
        "account-pidgy-code",
        "account-pidgy-trials",
        "account-recruit-url",
        "account-ranks",
    ] {
        ui::text(id, "");
    }
    ui::hidden("account-settings", true);
    ui::hidden("account-pending", true);
}
#[wasm_bindgen]
pub fn start_army_access() -> Result<(), JsValue> {
    if !once("access")? {
        return Ok(());
    }
    let s = Rc::new(RefCell::new(Account {
        token: take_token()?,
        ..Default::default()
    }));
    let ss = s.clone();
    init(move || {
        countries("account-country", &select("account-country")?.value())?;
        countries("edit-country", text(&ss.borrow().user, "country"))?;
        if ss.borrow().user["canManage"] == true {
            show(&ss)?;
        }
        Ok(())
    })?;
    countries("account-country", "")?;
    let ss = s.clone();
    wire("register-form", "register", "account-status", move |v| {
        let s = ss.clone();
        async move {
            s.borrow_mut().user = v["self"].clone();
            s.borrow_mut().epoch += 1;
            ui::hidden("account-forms", true);
            ui::hidden("account-pending", false);
            ui::text(
                "account-status",
                &t(if v["mail"] == "sent" {
                    "verifyNote"
                } else {
                    "mailQueued"
                }),
            );
            tag("pending-tag", &v["self"], text(&v["self"], "code"))
        }
    })?;
    wire("login-form", "login", "account-status", move |_| async {
        ui::text("account-status", &t("checkMail"));
        Ok(())
    })?;
    let ss = s.clone();
    ui::listen(
        web_sys::window().ok_or(JsValue::NULL)?.as_ref(),
        "hashchange",
        move |_| {
            report((|| {
                let token = take_token()?;
                if !token.is_empty() {
                    let mut s = ss.borrow_mut();
                    s.token = token;
                    s.epoch += 1;
                    drop(s);
                    claim_screen(&ss);
                }
                Ok(())
            })());
        },
    )?;
    let ss = s.clone();
    ui::listen(ui::element("claim-button")?.as_ref(), "click", move |_| {
        let Ok(b) = ui::element("claim-button") else {
            return;
        };
        if b.has_attribute("disabled") {
            return;
        }
        disabled(&b, true);
        ui::text("account-status", &t("working"));
        let s = ss.clone();
        let token = s.borrow().token.clone();
        let epoch = {
            let mut v = s.borrow_mut();
            v.epoch += 1;
            v.epoch
        };
        spawn_local(async move {
            let r = api(Some(json!({"action":"claim","token":token})), "").await;
            if s.borrow().epoch != epoch {
                disabled(&b, false);
                return;
            }
            match r {
                Ok(v) => {
                    s.borrow_mut().user = v["self"].clone();
                    s.borrow_mut().token.clear();
                    ui::hidden("claim-box", true);
                    report(show(&s));
                    ui::text("account-status", &t("saved"));
                }
                Err(e) => {
                    status(&e);
                    ui::hidden("account-forms", false);
                }
            }
            disabled(&b, false);
        });
    })?;
    if !s.borrow().token.is_empty() {
        claim_screen(&s);
    } else {
        let ss = s.clone();
        let epoch = s.borrow().epoch;
        spawn_local(async move {
            match api(None, "").await {
                Ok(v) => {
                    if ss.borrow().epoch == epoch && ss.borrow().token.is_empty() {
                        ss.borrow_mut().user = v["self"].clone();
                        report(show(&ss));
                    }
                }
                Err(e) => {
                    if ss.borrow().epoch == epoch {
                        status(&e);
                    }
                }
            }
        });
    }
    let f = form("profile-form")?;
    let f2 = f.clone();
    let ss = s.clone();
    ui::listen(f.as_ref(), "submit", move |e| {
        e.prevent_default();
        if !f2.report_validity() {
            return;
        }
        let Ok(b) = query(f2.as_ref(), "button") else {
            return;
        };
        if b.has_attribute("disabled") {
            return;
        }
        disabled(&b, true);
        let s = ss.clone();
        let f = f2.clone();
        let epoch = s.borrow().epoch;
        spawn_local(async move {
            let r = async {
                let mut fields = fields(&f)?;
                fields["action"] = json!("profile");
                fields["hidden"] = json!(
                    query(f.as_ref(), "input[name=hidden]")?
                        .dyn_into::<HtmlInputElement>()?
                        .checked()
                );
                api(Some(fields), "").await
            }
            .await;
            if s.borrow().epoch == epoch {
                match r {
                    Ok(v) => {
                        s.borrow_mut().user = v["self"].clone();
                        ui::text("account-status", &t("saved"));
                    }
                    Err(e) => status(&e),
                }
            }
            disabled(&b, false);
        });
    })?;
    for (id, kind) in [
        ("account-copy", 0),
        ("account-share", 1),
        ("account-save", 2),
        ("account-poster", 3),
    ] {
        let s = s.clone();
        ui::listen(ui::element(id)?.as_ref(), "click", move |_| {
            let u = s.borrow().user.clone();
            if u.is_null() {
                return;
            }
            spawn_local(async move {
                let code = text(&u, "code");
                match kind {
                    0 => copy(code, "account-status").await,
                    1 => share(code, "account-status").await,
                    _ => save_art(&u, code, kind == 3, "account-status").await,
                }
            });
        })?;
    }
    let ss = s.clone();
    ui::listen(
        ui::element("account-export")?.as_ref(),
        "click",
        move |_| {
            let epoch = ss.borrow().epoch;
            let s = ss.clone();
            spawn_local(async move {
                let r = async {
                    let v = api(Some(json!({"action":"export"})), "").await?;
                    if s.borrow().epoch != epoch {
                        return Ok(());
                    }
                    download(
                        &blob(
                            &serde_json::to_string_pretty(&v).map_err(|_| JsValue::NULL)?,
                            "application/json",
                        )?,
                        "corvus-my-data.json",
                    )
                }
                .await;
                if let Err(e) = r {
                    status(&e);
                }
            });
        },
    )?;
    let ss = s.clone();
    ui::listen(
        ui::element("account-delete")?.as_ref(),
        "click",
        move |_| {
            if !web_sys::window()
                .is_some_and(|w| w.confirm_with_message(&t("deleteConfirm")).unwrap_or(false))
            {
                return;
            }
            let s = ss.clone();
            spawn_local(async move {
                match api(Some(json!({"action":"delete","confirm":true})), "").await {
                    Ok(_) => {
                        clear(&s);
                        ui::hidden("account-forms", true);
                        ui::text("account-status", &t("deleted"));
                    }
                    Err(e) => status(&e),
                }
            });
        },
    )?;
    let ss = s.clone();
    ui::listen(
        ui::element("account-logout")?.as_ref(),
        "click",
        move |_| {
            let s = ss.clone();
            spawn_local(async move {
                match api(Some(json!({"action":"logout"})), "").await {
                    Ok(_) => {
                        clear(&s);
                        if let Some(w) = web_sys::window() {
                            let _ = w.location().reload();
                        }
                    }
                    Err(e) => status(&e),
                }
            });
        },
    )?;
    let ss = s.clone();
    ui::listen(
        ui::element("account-pidgy-copy")?.as_ref(),
        "click",
        move |_| {
            let u = ss.borrow().user.clone();
            if u["canManage"] != true || text(&u, "pidgyCode").is_empty() {
                return;
            }
            spawn_local(async move {
                let code = text(&u, "pidgyCode");
                ui::text(
                    "account-pidgy-status",
                    &if ui::copy(code).await {
                        t("codeCopied")
                    } else {
                        code.into()
                    },
                );
            });
        },
    )?;
    ready("access");
    Ok(())
}
