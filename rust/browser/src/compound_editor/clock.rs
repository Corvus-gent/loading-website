use super::{dom::*, *};
fn tick() -> Result<(), JsValue> {
    let now = js_sys::Date::now();
    let s = ((1794243600000. - now) / 1000.).floor().max(0.) as i64;
    for (key, v) in [
        ("days", s / 86400),
        ("hours", s / 3600 % 24),
        ("minutes", s / 60 % 60),
        ("seconds", s % 60),
    ] {
        if let Some(e) = ui::doc()?.query_selector(&format!("[data-unit=\"{key}\"]"))? {
            e.set_text_content(Some(&format!("{v:02}")));
        }
    }
    if s == 0 {
        ui::text(
            "deadline-note",
            "deadline reached. the edit lives on. keep the feedback coming.",
        );
    }
    let f = ((1794123000000. - now) / 1000.).floor().max(0.) as i64;
    ui::text(
        "fund-clock",
        &if f > 0 {
            format!(
                "{}d {:02}h {:02}m {:02}s · sat 11:30pm sf",
                f / 86400,
                f / 3600 % 24,
                f / 60 % 60,
                f % 60
            )
        } else {
            "deadline passed. the result stays.".into()
        },
    );
    Ok(())
}
pub(super) fn start() -> Result<(), JsValue> {
    let reload = ui::element("reload-cuts")?;
    reload.remove_attribute("onclick")?;
    on(reload.as_ref(), "click", |_| {
        web_sys::window().ok_or(JsValue::NULL)?.location().reload()
    })?;
    tick()?;
    interval(1000, tick)?;
    later(14000, || {
        if ui::doc()?
            .document_element()
            .is_some_and(|e| e.has_attribute("data-compound-ready"))
        {
            return Ok(());
        }
        ui::text(
            "connection",
            "the cuts are taking too long. reload to try again.",
        );
        ui::element("connection")?.class_list().add_1("error")?;
        ui::hidden("reload-cuts", false);
        Ok(())
    });
    Ok(())
}
