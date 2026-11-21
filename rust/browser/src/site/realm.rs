use super::*;
use std::cell::RefCell;
#[derive(Default)]
struct Night {
    scene: Option<web_sys::HtmlElement>,
    places: Vec<web_sys::Element>,
    boxes: Vec<(f64, f64)>,
    focused: Option<web_sys::Element>,
    point: Option<(f64, f64)>,
    tour: Option<usize>,
    step: usize,
    touched: bool,
    frame: i32,
    drift: i32,
    idle: i32,
    idle_reached: bool,
    last_activity: f64,
    reduced: Option<web_sys::MediaQueryList>,
    touch: Option<web_sys::MediaQueryList>,
    draw: Option<js_sys::Function>,
}
thread_local! {static NIGHT:RefCell<Night>=RefCell::new(Night::default());static STARTED:RefCell<bool>=const{RefCell::new(false)};static SF_TIMER:RefCell<i32>=const{RefCell::new(0)};static REDIRECT:RefCell<i32>=const{RefCell::new(0)};}
fn hidden() -> bool {
    ui::doc().map(|d| d.hidden()).unwrap_or(true)
}
fn measure() {
    NIGHT.with_borrow_mut(|s| {
        if let Some(scene) = &s.scene {
            let outer = scene.get_bounding_client_rect();
            s.boxes = s
                .places
                .iter()
                .map(|p| {
                    let r = p.get_bounding_client_rect();
                    (
                        r.left() - outer.left() + r.width() / 2.0,
                        r.top() - outer.top() + r.height() / 2.0,
                    )
                })
                .collect();
        }
    });
    schedule();
}
fn draw() {
    NIGHT.with_borrow_mut(|s| {
        s.frame = 0;
        let Some(scene) = &s.scene else { return };
        let bounds = scene.get_bounding_client_rect();
        let target = s
            .focused
            .as_ref()
            .and_then(|f| s.places.iter().position(|p| p == f))
            .and_then(|i| s.boxes.get(i));
        let stop = s.tour.and_then(|i| s.boxes.get(i));
        let pointer = s
            .point
            .filter(|_| !s.reduced.as_ref().is_some_and(|m| m.matches()))
            .map(|(x, y)| (x - bounds.left(), y - bounds.top()));
        let (x, y) = target
            .or(stop)
            .copied()
            .or(pointer)
            .unwrap_or((bounds.width() * 0.49, 150.0_f64.min(bounds.height() * 0.32)));
        if let Ok(Some(light)) = scene.query_selector(".night-light") {
            let _ = light.set_attribute(
                "style",
                &format!("transform:translate3d({}px,{}px,0)", x - 160.0, y - 160.0),
            );
        }
        for (i, p) in s.places.iter().enumerate() {
            let lit = s.boxes.get(i).is_some_and(|(bx, by)| {
                s.focused.as_ref() == Some(p) || ((bx - x).hypot(by - y) < 128.0)
            });
            let _ = p.class_list().toggle_with_force("lit", lit);
        }
    });
}
fn schedule() {
    if hidden() {
        return;
    }
    NIGHT.with_borrow_mut(|s| {
        if s.frame == 0
            && let Some(f) = &s.draw
            && let Ok(w) = window()
        {
            s.frame = w.request_animation_frame(f).unwrap_or(0);
        }
    });
}
fn show_crow() {
    let hour = (|| -> Result<f64, JsValue> {
        let opts = js(&json!({"timeZone":"Europe/Brussels","hour":"2-digit","hourCycle":"h23"}))?
            .dyn_into::<js_sys::Object>()?;
        let locales = js_sys::Array::of1(&"en-GB".into());
        let clock = js_sys::Intl::DateTimeFormat::new(&locales, &opts);
        let value = clock
            .format()
            .call1(&JsValue::UNDEFINED, &js_sys::Date::new_0())?;
        Ok(value
            .as_string()
            .unwrap_or_default()
            .parse()
            .unwrap_or(24.0))
    })();
    let visible = NIGHT.with_borrow(|s| s.idle_reached) || hour.is_ok_and(|h| h < 5.0);
    for crow in nodes(".night-crow") {
        let _ = crow.toggle_attribute_with_force("hidden", !visible);
    }
}
fn restart_idle() {
    let timer = NIGHT.with_borrow_mut(|s| std::mem::take(&mut s.idle));
    cancel(timer);
    if hidden() {
        return;
    }
    if !NIGHT.with_borrow(|s| s.idle_reached)
        && let Ok(timer) = later(30000, || {
            NIGHT.with_borrow_mut(|s| s.idle_reached = true);
            show_crow();
        })
    {
        NIGHT.with_borrow_mut(|s| s.idle = timer);
    }
    show_crow();
}
fn wander() {
    cancel(NIGHT.with_borrow_mut(|s| std::mem::take(&mut s.drift)));
    if hidden() {
        return;
    }
    let delay = NIGHT.with_borrow_mut(|s| {
        if !s.touch.as_ref().is_some_and(|m| m.matches())
            || s.reduced.as_ref().is_some_and(|m| m.matches())
            || s.focused.is_some()
        {
            None
        } else {
            Some(if std::mem::take(&mut s.touched) {
                4500
            } else if s.tour.is_none() {
                1200
            } else {
                2600
            })
        }
    });
    if let Some(delay) = delay
        && let Ok(timer) = later(delay, || {
            NIGHT.with_borrow_mut(|s| {
                if !s.boxes.is_empty() {
                    s.tour = Some(s.step % s.boxes.len());
                    s.step += 1;
                    s.point = None;
                    if let Some(scene) = &s.scene {
                        let _ = scene.class_list().add_1("drifting");
                    }
                }
            });
            schedule();
            wander();
        })
    {
        NIGHT.with_borrow_mut(|s| s.drift = timer);
    }
}
fn pointer(e: web_sys::Event) {
    let Some(p) = e.dyn_ref::<web_sys::PointerEvent>() else {
        return;
    };
    NIGHT.with_borrow_mut(|s| {
        s.focused = None;
        s.tour = None;
        s.touched = true;
        s.point = Some((p.client_x() as f64, p.client_y() as f64));
        if let Some(scene) = &s.scene {
            let _ = scene.class_list().remove_1("drifting");
        }
    });
    schedule();
    wander();
}
fn refresh() {
    if hidden() {
        NIGHT.with_borrow_mut(|s| {
            if let Ok(w) = window() {
                let _ = w.cancel_animation_frame(s.frame);
            }
            s.frame = 0;
            cancel(std::mem::take(&mut s.idle));
            cancel(std::mem::take(&mut s.drift));
        });
        return;
    }
    measure();
    restart_idle();
    wander();
}
fn activity() {
    let now = window()
        .ok()
        .and_then(|w| w.performance())
        .map(|p| p.now())
        .unwrap_or_else(js_sys::Date::now);
    if !NIGHT.with_borrow_mut(|s| {
        if now - s.last_activity < 100.0 {
            false
        } else {
            s.last_activity = now;
            true
        }
    }) {
        return;
    }
    restart_idle();
}
fn passive(
    target: &web_sys::EventTarget,
    name: &str,
    capture: bool,
    f: impl FnMut(web_sys::Event) + 'static,
) -> Result<(), JsValue> {
    let f = Closure::wrap(Box::new(f) as Box<dyn FnMut(web_sys::Event)>);
    let opts = web_sys::AddEventListenerOptions::new();
    opts.set_passive(true);
    opts.set_capture(capture);
    target.add_event_listener_with_callback_and_add_event_listener_options(
        name,
        f.as_ref().unchecked_ref(),
        &opts,
    )?;
    f.forget();
    Ok(())
}
pub(super) fn night() -> Result<(), JsValue> {
    if NIGHT.with_borrow(|s| s.scene.is_some()) {
        return Ok(());
    }
    let Some(scene) = nodes(".night-scene").first().cloned() else {
        return Ok(());
    };
    let scene = scene.dyn_into::<web_sys::HtmlElement>()?;
    let nav = scene.query_selector("nav")?.ok_or(JsValue::NULL)?;
    let places = nav.query_selector_all("a")?;
    let places = (0..places.length())
        .filter_map(|i| places.item(i)?.dyn_into::<web_sys::Element>().ok())
        .collect::<Vec<_>>();
    let light = element("div", None, Some("night-light"))?;
    light.set_attribute("aria-hidden", "true")?;
    let stars = element("div", None, Some("night-stars"))?;
    stars.set_attribute("aria-hidden", "true")?;
    for (x, y, delay) in [
        (8, 9, 0.0),
        (41, 7, 0.3),
        (72, 23, 0.6),
        (94, 14, 1.2),
        (54, 61, 2.0),
    ] {
        let star = element("i", None, None)?;
        star.set_attribute(
            "style",
            &format!("left:{x}%;top:{y}%;animation-delay:{delay}s"),
        )?;
        stars.append_child(&star)?;
    }
    scene.insert_before(&stars, scene.first_child().as_ref())?;
    scene.insert_before(&light, scene.first_child().as_ref())?;
    for (name, label, drawing) in [
        (
            "night-door",
            "Open door",
            "<path d=\"M7 29V11a9 9 0 0 1 18 0v18M9 29V12a7 7 0 0 1 14 0v17Z\" fill=\"none\" stroke=\"currentColor\"/><circle cx=\"19\" cy=\"19\" r=\"1\" fill=\"currentColor\"/>",
        ),
        (
            "night-crow",
            "Greet the crow",
            "<path fill=\"currentColor\" d=\"m2 24 8-9q4-6 9-5 4-8 9-4l1 2 3 1-4 2q-1 10-10 11l-1 4h4v1h-7l2-5-4-1-8 4 2-3z\"/>",
        ),
    ] {
        let b = element("button", None, Some(name))?;
        b.set_attribute("type", "button")?;
        b.set_attribute("aria-label", label)?;
        b.set_inner_html(&format!(
            "<svg aria-hidden=\"true\" viewBox=\"0 0 32 32\">{drawing}</svg>"
        ));
        ui::listen(&b.clone().into(), "click", move |_| {
            let _ = if name == "night-door" {
                terminal::open("")
            } else {
                eggs::realm()
            };
        })?;
        scene.append_child(&b)?;
    }
    let whispers = [
        "someone was here before you.",
        "the crow knows your name.",
        "not everything here is a link.",
    ];
    let mut index = (js_sys::Math::random() * 3.0).floor() as usize;
    if let Ok(Some(s)) = window()?.session_storage() {
        if s.get_item("realm:whisper")?.as_deref() == Some(&index.to_string()) {
            index = (index + 1) % 3;
        }
        let _ = s.set_item("realm:whisper", &index.to_string());
    }
    for e in nodes(".night-whisper") {
        e.set_text_content(Some(whispers[index]));
    }
    let reduced = window()?.match_media("(prefers-reduced-motion: reduce)")?;
    let touch = window()?.match_media("(pointer: coarse)")?;
    let cb = Closure::<dyn FnMut()>::new(draw);
    let f = cb.as_ref().unchecked_ref::<js_sys::Function>().clone();
    cb.forget();
    NIGHT.with_borrow_mut(|s| {
        s.scene = Some(scene.clone());
        s.places = places;
        s.reduced = reduced.clone();
        s.touch = touch;
        s.draw = Some(f);
        s.last_activity = -1000.0;
    });
    for event in ["pointermove", "pointerdown"] {
        passive(scene.as_ref(), event, false, pointer)?;
    }
    ui::listen(&scene.clone().into(), "pointerleave", move |e| {
        if e.dyn_ref::<web_sys::PointerEvent>()
            .is_some_and(|p| p.pointer_type() == "touch")
        {
            return;
        }
        NIGHT.with_borrow_mut(|s| s.point = None);
        schedule();
    })?;
    ui::listen(&scene.clone().into(), "focusin", move |e| {
        NIGHT.with_borrow_mut(|s| {
            s.focused = e
                .target()
                .and_then(|t| t.dyn_into::<web_sys::Element>().ok())
                .and_then(|t| t.closest("a").ok().flatten());
            if let Some(scene) = &s.scene {
                let _ = scene.class_list().remove_1("drifting");
            }
        });
        schedule();
        wander();
    })?;
    ui::listen(&scene.clone().into(), "focusout", move |_| {
        NIGHT.with_borrow_mut(|s| s.focused = None);
        schedule();
        wander();
    })?;
    let d = ui::doc()?;
    for event in ["pointermove", "pointerdown", "keydown", "wheel"] {
        passive(d.as_ref(), event, true, move |_| activity())?;
    }
    passive(d.as_ref(), "scroll", true, move |_| schedule())?;
    ui::listen(&d.into(), "visibilitychange", move |_| refresh())?;
    if let Some(reduced) = reduced {
        ui::listen(&reduced.into(), "change", move |_| refresh())?;
    }
    let cb = Closure::<dyn FnMut(js_sys::Array)>::new(|_| measure());
    let observer = web_sys::ResizeObserver::new(cb.as_ref().unchecked_ref())?;
    observer.observe(&nav);
    cb.forget();
    scene.class_list().add_1("awake")?;
    refresh();
    Ok(())
}
fn sf() {
    cancel(SF_TIMER.replace(0));
    let now = js_sys::Date::now();
    let begin = js_sys::Date::parse("2026-11-06T00:00:00-08:00");
    let end = js_sys::Date::parse("2026-11-16T00:00:00-08:00");
    ui::hidden("sf-realm", now < begin || now >= end);
    let boundary = if now < begin {
        begin
    } else if now < end {
        end
    } else {
        0.0
    };
    if boundary > 0.0
        && let Ok(t) = later((boundary - now).clamp(0.0, 2147483647.0) as i32, sf)
    {
        SF_TIMER.replace(t);
    }
}
pub(super) fn start() -> Result<(), JsValue> {
    if STARTED.replace(true) {
        return Ok(());
    }
    terminal::start()?;
    eggs::start()?;
    let dialog = ui::element("realm-share")?.dyn_into::<web_sys::HtmlDialogElement>()?;
    for a in nodes("[href=\"#realm-share\"]") {
        let d = dialog.clone();
        ui::listen(&a.into(), "click", move |e| {
            e.prevent_default();
            let _ = d.show_modal();
        })?;
    }
    ui::listen(&dialog.into(), "click", move |e| {
        let Some(b) = e
            .target()
            .and_then(|t| t.dyn_into::<web_sys::Element>().ok())
            .and_then(|t| t.closest("[data-share]").ok().flatten())
        else {
            return;
        };
        let what = b.get_attribute("data-share").unwrap_or_default();
        let gabe = what == "gabe";
        let url = if gabe {
            "https://corvus.gent/links/gabe/self"
        } else {
            "https://corvus.gent/self"
        };
        wasm_bindgen_futures::spawn_local(async move {
            let copied = if let Ok(w) = window() {
                JsFuture::from(w.navigator().clipboard().write_text(url))
                    .await
                    .is_ok()
            } else {
                false
            };
            ui::text(
                "realm-share-message",
                &if copied {
                    crate::language::translate("m.copied")
                } else {
                    url.to_owned()
                },
            );
            capture("share_click", &json!({"what":what}));
            if gabe {
                cancel(REDIRECT.replace(0));
                if let Ok(t) = later(2000, move || {
                    if let Ok(w) = window() {
                        let _ = w.location().assign("/links/gabe");
                    }
                }) {
                    REDIRECT.replace(t);
                }
            }
        });
    })?;
    sf();
    ui::listen(&ui::doc()?.into(), "visibilitychange", move |_| sf())?;
    night()
}
