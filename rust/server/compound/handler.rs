use super::{
    events::uuid_like,
    links, model, payments, security,
    store::{Editor, numeric, text},
};
use crate::{AppState, Error};
use axum::{
    Json,
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
};
use corvus_core::army::truthy;
use serde_json::{Value, json};
fn reply(status: StatusCode, body: Value) -> Response {
    (
        status,
        [
            ("cache-control", "no-store"),
            ("x-content-type-options", "nosniff"),
        ],
        Json(body),
    )
        .into_response()
}
fn ok(body: Value) -> Response {
    reply(StatusCode::OK, body)
}
fn error(status: StatusCode, message: &str) -> Response {
    reply(status, json!({"error":message}))
}
fn cookie(mut response: Response, value: Option<HeaderValue>) -> Response {
    if let Some(value) = value {
        response.headers_mut().append("set-cookie", value);
    }
    response
}
fn cached(mut response: Response, value: &'static str) -> Response {
    response
        .headers_mut()
        .insert("cache-control", HeaderValue::from_static(value));
    response
}
fn mapped_error(e: Error) -> Response {
    let message = e.to_string();
    const SAFE: &[&str] = &[
        "chip",
        "version",
        "vote",
        "category",
        "timestamp",
        "reaction",
        "poll",
        "poll expired",
        "prediction",
        "text",
        "event",
        "watch",
        "handle",
        "label",
        "video",
        "duration",
        "cues",
        "action",
        "payments not connected yet",
        "revolut not connected yet",
        "revolut link",
        "amount",
        "slot",
        "cutlist",
        "transition",
        "tag",
        "battle",
        "watch two cuts first",
    ];
    if SAFE.contains(&message.as_str()) {
        error(StatusCode::BAD_REQUEST, &message)
    } else {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "the crow lost its connection. please try again.",
        )
    }
}
pub async fn handle(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    q: &Value,
    body: &[u8],
) -> Result<Response, Error> {
    Ok(inner(state, method, h, q, body)
        .await
        .unwrap_or_else(mapped_error))
}
async fn inner(
    state: &AppState,
    method: &Method,
    h: &HeaderMap,
    q: &Value,
    body: &[u8],
) -> Result<Response, Error> {
    let editor = Editor(state);
    let role = if q["role"] == "admin" {
        "admin"
    } else {
        "stats"
    };
    let now = chrono::Utc::now().timestamp_millis();
    if method == Method::GET {
        if q["session"] == "1" {
            return Ok(ok(
                json!({"authorized":security::authorized(&state.settings,h,role,now)?}),
            ));
        }
        if truthy(&q["slug"]) {
            let slug = text(&q["slug"]);
            let Some(path) = links::destination(slug, &q["c"], q) else {
                return Ok(error(StatusCode::NOT_FOUND, "missing"));
            };
            if state.settings.write_enabled() {
                let _=async{
                    if security::limit(state,h,"short-links",120,60).await?{
                        let spec=links::spec(slug).ok_or("missing")?;
                        let url=url::Url::parse(&format!("https://corvus.gent{path}"))?;
                        let content=url.query_pairs().find(|(k,_)|k=="utm_content").map(|(_,v)|v.into_owned());
                        editor.event("link_click","",&json!({"source":spec[0],"medium":spec[1],"campaign":"compound-1000","term":slug,"content":content,"source_confidence":"utm"}),None,&json!({})).await?;
                    }Ok::<_,Error>(())
                }.await;
            }
            let mut response = (
                StatusCode::FOUND,
                [
                    ("cache-control", "no-store"),
                    ("x-content-type-options", "nosniff"),
                ],
            )
                .into_response();
            response.headers_mut().insert("location", path.parse()?);
            return Ok(response);
        }
        if q["private"] == "1" {
            if !security::authorized(&state.settings, h, role, now)? {
                return Ok(error(StatusCode::UNAUTHORIZED, "sign in first"));
            }
            let mut data = editor.private_stats(text(&q["version"])).await?;
            data["feedback"] = json!(editor.feedback_feed(100).await?);
            data["admin"] = json!(security::authorized(&state.settings, h, "admin", now)?);
            return Ok(ok(data));
        }
        if q["feed"] == "1" {
            return Ok(ok(json!({"feedback":editor.feedback_feed(5).await?})));
        }
        if q["live"] == "1" {
            return Ok(cached(
                ok(json!({"poll":editor.get("live-poll").await?})),
                "public, s-maxage=1",
            ));
        }
        return Ok(cached(
            ok(editor.summary(text(&q["version"])).await?),
            "public, s-maxage=3, stale-while-revalidate=10",
        ));
    }
    if method != Method::POST {
        return Ok(error(StatusCode::METHOD_NOT_ALLOWED, "method not allowed"));
    }
    if !state.settings.write_enabled() {
        return Ok(error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Rust writes are disabled.",
        ));
    }
    let api_admin = security::authorized(&state.settings, h, "admin", now)?
        && security::header(h, "authorization").starts_with("Bearer ");
    if (!security::same_origin(&state.settings, h) && !api_admin)
        || !security::header(h, "content-type").starts_with("application/json")
    {
        return Ok(error(StatusCode::FORBIDDEN, "please use the page"));
    }
    let mut b: Value = if body.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(body)?
    };
    if !truthy(&b) {
        b = json!({});
    }
    if b.is_array() || b.to_string().encode_utf16().count() > 20000 {
        return Ok(error(StatusCode::PAYLOAD_TOO_LARGE, "too much data"));
    }
    if !security::limit(state, h, "all", 150, 60).await? {
        return Ok(error(
            StatusCode::TOO_MANY_REQUESTS,
            "take a breath. try again in a minute.",
        ));
    }
    let action = text(&b["action"]).to_owned();
    let action = action.as_str();
    if ![
        "rename_items",
        "login",
        "publish",
        "live_poll",
        "hide_text",
        "revolut",
        "event",
        "donate",
        "watched",
        "pick",
        "battle",
        "profile",
        "prediction",
        "transition",
        "transition_tag",
        "transition_text",
        "vote",
        "category",
        "text",
        "reaction",
        "poll",
        "quick",
        "note_text",
    ]
    .contains(&action)
    {
        return Err("action".into());
    }
    if truthy(&b["website"]) {
        return Ok(error(
            StatusCode::BAD_REQUEST,
            "please leave the hidden field empty",
        ));
    }
    if action == "login" {
        if !security::limit(state, h, "login", 5, 60).await? {
            return Ok(error(
                StatusCode::TOO_MANY_REQUESTS,
                "try again in a minute",
            ));
        }
        let role = if b["role"] == "admin" {
            "admin"
        } else {
            "stats"
        };
        return Ok(
            match security::login(&state.settings, role, &b["password"], now)? {
                Some(c) => cookie(ok(json!({"ok":true})), Some(c)),
                None => error(StatusCode::UNAUTHORIZED, "wrong password"),
            },
        );
    }
    if [
        "rename_items",
        "publish",
        "live_poll",
        "hide_text",
        "revolut",
    ]
    .contains(&action)
    {
        if !security::authorized(&state.settings, h, "admin", now)? {
            return Ok(error(StatusCode::UNAUTHORIZED, "admin sign-in required"));
        }
        return Ok(match action {
            "rename_items" => {
                ok(json!({"version":editor.rename_items(text(&b["version"]),&b["labels"]).await?}))
            }
            "revolut" => ok(json!({"revolut":editor.set_revolut(&b).await?})),
            "publish" => ok(json!({"version":editor.publish(&b).await?})),
            "hide_text" => {
                if !uuid_like(&b["id"]) {
                    return Err("text".into());
                }
                if !editor.hide_text(text(&b["id"])).await? {
                    error(StatusCode::NOT_FOUND, "missing")
                } else {
                    ok(json!({"ok":true}))
                }
            }
            _ => {
                let v = text(&b["version"]);
                if v != "all" && editor.version(v).await?.is_null() {
                    return Err("version".into());
                }
                ok(json!({"poll":editor.push_poll(v,&b).await?}))
            }
        });
    }
    if !uuid_like(&b["visit"])
        && let Some(m) = b.as_object_mut()
    {
        m.remove("visit");
    }
    let tags = model::attribution(&b["attribution"], true, now);
    let consented = (b["analytics"] == true || b["analytics"] == "session")
        && security::header(h, "sec-gpc") != "1"
        && security::header(h, "dnt") != "1";
    let visitor = if consented && uuid_like(&b["visitor"]) {
        b["visitor"].as_str()
    } else {
        None
    };
    let version = editor.version(text(&b["version"])).await?;
    let v = text(&version["id"]);
    if action == "event" {
        let event = text(&b["event"]);
        if !model::EVENTS.contains(&event) {
            return Err("event".into());
        }
        if ["play", "watch", "dropoff"].contains(&event) && version.is_null() {
            return Err("version".into());
        }
        let name = match event {
            "watch" => {
                let percent = b["percent"]
                    .as_f64()
                    .filter(|n| [25., 50., 75., 100.].contains(n))
                    .ok_or("watch")?;
                format!("watch:{percent}")
            }
            "dropoff" => format!(
                "dropoff:{}",
                (model::time_bucket(b.get("t"), numeric(&version["duration"]))? / 5.).floor() * 5.
            ),
            _ => event.into(),
        };
        editor.event(&name, v, &tags, visitor, &b).await?;
        return Ok(ok(json!({"ok":true})));
    }
    if action == "donate" {
        if !security::limit(state, h, "checkout", 10, 60).await? {
            return Ok(error(StatusCode::TOO_MANY_REQUESTS, "try again shortly"));
        }
        let method = if b["method"] == "revolut" {
            "revolut"
        } else {
            "stripe"
        };
        let link = if method == "revolut" {
            let rev = editor.get("revolut").await?;
            let url = rev["url"]
                .as_str()
                .filter(|s| !s.is_empty())
                .or(state.settings.get("COMPOUND_REVOLUT_URL"))
                .ok_or("revolut not connected yet")?;
            json!({"url":url})
        } else {
            editor.donation_link(&tags,&json!({"visitor":visitor,"visit":if visitor.is_some(){b["visit"].clone()}else{Value::Null},"version":v})).await?
        };
        let mut details = json!({"method":method});
        if let Some(visit) = b.get("visit") {
            details["visit"] = visit.clone();
        }
        editor
            .event("donation_click", v, &tags, visitor, &details)
            .await?;
        editor
            .event(
                &format!("donation_click_{method}"),
                v,
                &tags,
                None,
                &json!({}),
            )
            .await?;
        return Ok(ok(link));
    }
    if !security::limit(state, h, "contributions", 200, 86400).await? {
        return Ok(error(
            StatusCode::TOO_MANY_REQUESTS,
            "enough chaos for today. come back tomorrow.",
        ));
    }
    let (uid, c) = security::identity(&state.settings, h)?;
    // Identity is issued before action validation in the legacy handler, including invalid votes.
    let result: Result<Response, Error> = async {
        if action == "watched" {
            if version.is_null()
                || !b["percent"]
                    .as_f64()
                    .is_some_and(|n| (25. ..=100.).contains(&n))
            {
                return Err("watch".into());
            }
            return Ok(ok(editor.watched(&uid, v).await?));
        }
        if ["pick", "battle"].contains(&action) {
            let result = editor.duel(&uid, &b).await?;
            if result["added"] == true {
                editor
                    .event(action, text(&b["winner"]), &tags, visitor, &b)
                    .await?;
            }
            return Ok(ok(result));
        }
        if action == "profile" {
            return Ok(ok(
                json!({"handle":editor.profile(&uid,&b["handle"]).await?}),
            ));
        }
        if action == "prediction" {
            let result = editor.predict(&uid, &b).await?;
            if result["added"] == true {
                editor
                    .event("prediction", v, &tags, visitor, &json!({"choice":b["win"]}))
                    .await?;
            }
            return Ok(ok(result));
        }
        if version.is_null() && action != "text" {
            return Err("version".into());
        }
        let result = match action {
            "quick" | "note_text" => {
                if !security::limit(state, h, "quick", 15, 60).await? {
                    return Ok(error(
                        StatusCode::TOO_MANY_REQUESTS,
                        "give the editor a moment. try again in a minute.",
                    ));
                }
                if action == "quick" {
                    editor.quick_note(&uid, v, &b).await?
                } else {
                    editor
                        .note_text(&uid, v, text(&b["id"]), &b["text"])
                        .await?
                }
            }
            "transition" | "transition_tag" | "transition_text" => {
                if action == "transition_text" && !security::limit(state, h, "text", 3, 60).await? {
                    return Ok(error(
                        StatusCode::TOO_MANY_REQUESTS,
                        "three ideas per minute",
                    ));
                }
                editor.transition(&uid, &version, &b).await?
            }
            "vote" | "category" => editor.feedback(&uid, v, &b).await?,
            "text" => {
                if !security::limit(state, h, "text", 3, 60).await? {
                    return Ok(error(
                        StatusCode::TOO_MANY_REQUESTS,
                        "three ideas per minute. make them count.",
                    ));
                }
                editor
                    .save_text(
                        &uid,
                        if v.is_empty() { "none" } else { v },
                        &b["text"],
                        "idea",
                        3,
                    )
                    .await?
            }
            "reaction" => {
                if !security::limit(state, h, "reactions", 60, 60).await? {
                    return Ok(error(
                        StatusCode::TOO_MANY_REQUESTS,
                        "give that reaction a moment",
                    ));
                }
                editor
                    .reaction(
                        &uid,
                        v,
                        text(&b["type"]),
                        model::time_bucket(b.get("t"), numeric(&version["duration"]))?,
                    )
                    .await?
            }
            "poll" => {
                editor
                    .answer(&uid, v, text(&b["poll"]), &b["option"])
                    .await?
            }
            _ => return Err("action".into()),
        };
        if result["added"] == true {
            editor.event(action, v, &tags, visitor, &b).await?;
        }
        Ok(ok(result))
    }
    .await;
    Ok(cookie(result.unwrap_or_else(mapped_error), c))
}
pub async fn webhook(state: &AppState, method: &Method, h: &HeaderMap, body: &[u8]) -> Response {
    if method != Method::POST {
        return error(StatusCode::METHOD_NOT_ALLOWED, "method not allowed");
    }
    if !state.settings.write_enabled() {
        return error(StatusCode::SERVICE_UNAVAILABLE, "Rust writes are disabled.");
    }
    match payments::verified_event(
        body,
        security::header(h, "stripe-signature"),
        &state.settings,
        chrono::Utc::now().timestamp_millis(),
    ) {
        Ok(event) => match Editor(state).stripe_event(&event).await {
            Ok(v) => ok(v),
            Err(_) => error(StatusCode::SERVICE_UNAVAILABLE, "temporarily unavailable"),
        },
        Err(e) => match e.to_string().as_str() {
            "not configured" => error(StatusCode::SERVICE_UNAVAILABLE, "not configured"),
            "too much data" => StatusCode::PAYLOAD_TOO_LARGE.into_response(),
            _ => error(StatusCode::BAD_REQUEST, "invalid signature"),
        },
    }
}
