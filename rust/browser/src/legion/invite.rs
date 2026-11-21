use super::*;
use std::{cell::Cell, rc::Rc};
#[wasm_bindgen]
pub fn start_legion_invite() -> Result<(), JsValue> {
    let f = form("invite-form")?;
    if f.has_attribute("data-rust-invite") {
        return Ok(());
    }
    f.set_attribute("data-rust-invite", "")?;
    let token = last_path()?;
    let t = token.clone();
    spawn_local(async move {
        let r = async {
            let d = api(None, &format!("?action=invite&token={}", enc(&t)), false).await?;
            let name = text(&d, "name");
            let honorary = text(&d, "type") == "honorary";
            let who = if name.is_empty() {
                "Gabe".into()
            } else {
                format!(
                    "{}, Gabe",
                    if honorary {
                        name.split(' ').next().unwrap_or("")
                    } else {
                        name
                    }
                )
            };
            ui::text(
                "invite-title",
                &format!(
                    "{who} thinks you deserve the rank of {}.",
                    if honorary {
                        format!("Senator: {}", text(&d, "title"))
                    } else {
                        text(&d, "rank").into()
                    }
                ),
            );
            ui::text("invite-note", text(&d, "note"));
            ui::text("invite-status", "Your invitation is open.");
            ui::hidden("invite-form", false);
            if honorary {
                query(&ui::element("invite-form")?, "button")?
                    .set_text_content(Some("Claim your seat"));
            }
            Ok::<(), JsValue>(())
        }
        .await;
        if let Err(e) = r {
            ui::text("invite-title", "this door has closed.");
            ui::text("invite-status", &ui::message(&e));
        }
    });
    let busy = Rc::new(Cell::new(false));
    let form = f.clone();
    ui::listen(f.as_ref(), "submit", move |event| {
        event.prevent_default();
        if busy.get() || !form.report_validity() {
            return;
        }
        busy.set(true);
        let f = form.clone();
        let token = token.clone();
        let busy = busy.clone();
        spawn_local(async move {
            let r=async{
            let b=query(f.as_ref(),"button")?;disabled(&b,true);ui::text("invite-status","claiming your place…");
            let d=api(Some(json!({"action":"claim","token":token,"email":get(&f,"email")?,"handle":get(&f,"handle")?})),"",false).await?;
            ui::hidden("invite-form",true);ui::hidden("invite-welcome",false);ui::text("invite-meaning",text(&d,"meaning"));ui::text("invite-title",&format!("welcome, {}.",text(&d,"name")));
            ui::text("invite-status",&format!("rank: {}{} · invited by Gabe",text(&d,"rank"),if text(&d,"title").is_empty(){String::new()}else{format!(" · {}",text(&d,"title"))}));
            if !text(&d,"edit_link").is_empty(){
                let b=node("div","","site-card")?;append(&b,&node("h2","Your seat. Your story.","")?)?;
                let a=node("a","Edit your spotlight →","site-button")?;a.set_attribute("href",text(&d,"edit_link"))?;append(&b,&a)?;
                append(&b,&node("p",if d["email_sent"]==true{"Your private edit link is also in your email. Keep it private."}else{"Save this private link now. Email delivery is delayed."},"")?)?;
                append(&ui::element("invite-welcome")?,&b)?;
            }Ok::<(),JsValue>(())
        }.await;
            if let Err(e) = r {
                ui::text("invite-status", &ui::message(&e));
            }
            if let Ok(b) = query(f.as_ref(), "button") {
                disabled(&b, false);
            }
            busy.set(false);
        });
    })
}
