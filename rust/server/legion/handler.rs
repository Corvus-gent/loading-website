use super::{
    applications::Applications, model, newsletter::Newsletter, partners::Partners, payments,
    security, senate::Senate, store::Legion,
};
use crate::{AppState, Error, crypto};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
};
use corvus_core::army::truthy;
use serde_json::{Value, json};
use std::collections::HashMap;
use url::Url;
fn ok(v: Value) -> Response {
    Json(v).into_response()
}
fn error(status: StatusCode, text: &str) -> Response {
    (status, Json(json!({"error":text}))).into_response()
}
fn query<'a>(q: &'a HashMap<String, String>, key: &str) -> &'a str {
    q.get(key).map(String::as_str).unwrap_or("")
}
fn secure(mut r: Response, senate: bool) -> Response {
    for (k, v) in [
        (
            "cache-control",
            if senate {
                "no-store"
            } else {
                "private, no-store"
            },
        ),
        ("referrer-policy", "no-referrer"),
        ("x-content-type-options", "nosniff"),
        (
            "x-robots-tag",
            if senate {
                "noindex"
            } else {
                "noindex, nofollow"
            },
        ),
    ] {
        if !r.headers().contains_key(k) {
            r.headers_mut()
                .insert(k, axum::http::HeaderValue::from_static(v));
        }
    }
    r
}
fn cache(mut r: Response, value: &'static str) -> Response {
    r.headers_mut()
        .insert("cache-control", axum::http::HeaderValue::from_static(value));
    r
}
fn origin<'a>(state: &'a AppState, h: &'a HeaderMap) -> &'a str {
    if state.settings.production() {
        "https://corvus.gent"
    } else {
        security::header(h, "origin")
    }
}
async fn owner(state: &AppState, h: &HeaderMap) -> Result<(), Error> {
    if !security::authorized(state, h).await? {
        return Err("unauthorized".into());
    }
    Ok(())
}
async fn limit(
    state: &AppState,
    h: &HeaderMap,
    scope: &str,
    max: i64,
    seconds: i64,
) -> Result<(), Error> {
    if !security::limited(state, h, scope, max, seconds).await? {
        return Err("rate".into());
    }
    Ok(())
}
fn body(h: &HeaderMap, raw: &[u8], max: usize) -> Result<Value, Error> {
    if !security::header(h, "content-type").starts_with("application/json") {
        return Err("forbidden".into());
    }
    let b: Value = serde_json::from_slice(raw).map_err(|_| "fields")?;
    if !b.is_object() || b.to_string().encode_utf16().count() > max {
        return Err("fields".into());
    }
    Ok(b)
}
pub async fn handle(
    state: &AppState,
    m: &Method,
    h: &HeaderMap,
    q: &HashMap<String, String>,
    raw: &[u8],
) -> Result<Response, Error> {
    let senate = query(q, "senate") == "1";
    let result = if senate {
        senate_inner(state, m, h, q, raw).await
    } else {
        inner(state, m, h, q, raw).await
    };
    Ok(secure(result.unwrap_or_else(|e| mapped(e, senate)), senate))
}
async fn inner(
    state: &AppState,
    m: &Method,
    h: &HeaderMap,
    q: &HashMap<String, String>,
    raw: &[u8],
) -> Result<Response, Error> {
    let action = query(q, "action");
    let legion = Legion(state);
    if action == "layer_page" && [*m == Method::GET, *m == Method::HEAD].contains(&true) {
        return crate::layers::handle(state, m, h, q, raw).await;
    }
    if !query(q, "partner").is_empty() && (*m == Method::GET || *m == Method::HEAD) {
        let id = query(q, "partner");
        let Some(target) = model::config()["partners"].get(id) else {
            return Ok(error(StatusCode::NOT_FOUND, "Unknown card."));
        };
        if state.settings.write_enabled() {
            let _ = Partners(state).count(m, h, id).await;
        }
        return Ok((
            StatusCode::FOUND,
            [("location", model::text(target, "url"))],
        )
            .into_response());
    }
    if *m == Method::GET {
        match action {
            "session" => {
                return Ok(ok(
                    json!({"authorized":security::authorized(state,h).await?}),
                ));
            }
            "invite" => {
                if state.settings.write_enabled() {
                    limit(state, h, "open-invite", 60, 60).await?;
                }
                let ua = security::header(h, "user-agent").to_ascii_lowercase();
                let open = state.settings.write_enabled()
                    && !(["bot", "preview", "crawler"].iter().any(|s| ua.contains(s)));
                return Ok(ok(legion.invite(query(q, "token"), open).await?));
            }
            "partners" => {
                return Ok(cache(
                    ok(Partners(state).report().await?),
                    "public, s-maxage=30, stale-while-revalidate=60",
                ));
            }
            "paid" => {
                if state.settings.write_enabled() {
                    limit(state, h, "paid-status", 60, 60).await?;
                }
                let p = legion
                    .get(&format!(
                        "paid-session:{}",
                        crypto::sha(query(q, "session"))
                    ))
                    .await?;
                return Ok(ok(if p.is_null() {
                    json!({"pending":true})
                } else {
                    p
                }));
            }
            "admin" | "csv" => {
                owner(state, h).await?;
                let members = legion.members().await?;
                if action == "csv" {
                    let fields = ["name", "handle", "email", "rank", "source", "joined_at"];
                    let mut lines = vec![fields.join(",")];
                    lines.extend(members.iter().map(|m| {
                        fields
                            .iter()
                            .map(|k| model::csv_cell(m.get(*k)))
                            .collect::<Vec<_>>()
                            .join(",")
                    }));
                    return Ok((
                        [
                            ("content-type", "text/csv; charset=utf-8"),
                            (
                                "content-disposition",
                                "attachment; filename=\"corvus-legion.csv\"",
                            ),
                        ],
                        lines.join("\r\n"),
                    )
                        .into_response());
                }
                let applications = Applications(state);
                let newsletter = Newsletter(state);
                let partners = Partners(state);
                let (invites, apps, emails, links) = tokio::try_join!(
                    legion.invitations(),
                    applications.all(),
                    newsletter.subscribers(),
                    partners.all()
                )?;
                let today = crate::plethora::pt_day(chrono::Utc::now().timestamp_millis())?;
                let mut ranks = model::config()["ranks"].as_array().ok_or("ranks")?.clone();
                for m in &members {
                    if !ranks.contains(&m["rank"]) {
                        ranks.push(m["rank"].clone());
                    }
                }
                let mut by_rank = serde_json::Map::new();
                for rank in ranks {
                    by_rank.insert(
                        rank.as_str().ok_or("rank")?.into(),
                        json!(members.iter().filter(|m| m["rank"] == rank).count()),
                    );
                }
                let mut new_today = 0;
                for m in &members {
                    if crate::plethora::pt_day(
                        corvus_core::impact::timestamp(&m["joined_at"]).ok_or("date")?,
                    )? == today
                    {
                        new_today += 1;
                    }
                }
                let invites_array = invites.as_array().ok_or("invites")?;
                let emails_array = emails.as_array().ok_or("emails")?;
                let summary = json!({"total":members.len(),"by_rank":by_rank,"new_today":new_today,"emails_collected":emails_array.len(),"emails_confirmed":emails_array.iter().filter(|r|r["status"]=="confirmed").count(),"invites_created":invites_array.len(),"invites_opened":invites_array.iter().filter(|r|truthy(&r["opened_at"])).count(),"invites_claimed":invites_array.iter().map(|r|r["uses"].as_u64().unwrap_or(0)).sum::<u64>()});
                return Ok(ok(
                    json!({"members":members,"invites":invites,"applications":apps,"partners":links,"summary":summary}),
                ));
            }
            _ => {}
        }
        let fields = [
            "name",
            "handle",
            "rank",
            "joined_at",
            "honorary",
            "title",
            "spotlight_slug",
        ];
        let members = legion
            .members()
            .await?
            .iter()
            .filter(|m| !truthy(&m["hidden"]))
            .map(|m| {
                Value::Object(
                    fields
                        .iter()
                        .filter_map(|k| m.get(*k).map(|v| ((*k).into(), v.clone())))
                        .collect(),
                )
            })
            .collect::<Vec<_>>();
        return Ok(cache(
            ok(json!({"members":members,"payment_ready":payments::ready(&state.settings)})),
            if action == "wall" {
                "private, no-store"
            } else {
                "public, s-maxage=15, stale-while-revalidate=60"
            },
        ));
    }
    if *m != Method::POST {
        return Ok(error(StatusCode::METHOD_NOT_ALLOWED, "Use the page."));
    }
    if !state.settings.write_enabled() {
        return Ok(error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Rust writes are disabled.",
        ));
    }
    if !security::same_origin(&state.settings, h) {
        return Err("forbidden".into());
    }
    let b = body(h, raw, 6000)?;
    if truthy(&b["website"]) {
        return Err("fields".into());
    }
    let action = model::text(&b, "action");
    if action == "layer_tick" {
        return crate::layers::handle(state, m, h, q, raw).await;
    }
    limit(state, h, "all", 90, 60).await?;
    match action {
        "short_click" => return Ok(ok(Partners(state).count_short(h, &b["path"]).await?)),
        "login" | "logout" => {
            let cookie = if action == "login" {
                security::login(state, h, &b["password"]).await?
            } else {
                security::logout(state, h).await?
            };
            let mut r = ok(json!({"ok":true}));
            r.headers_mut().append("set-cookie", cookie);
            return Ok(r);
        }
        _ => {}
    }
    if ["create_invite", "revoke_invite", "rank", "decide"].contains(&action) {
        owner(state, h).await?;
        return Ok(ok(match action {
            "create_invite" => legion.create_invite(&b, origin(state, h)).await?,
            "revoke_invite" => json!({"ok":legion.revoke(model::text(&b,"id")).await?}),
            "rank" => {
                legion
                    .set_rank(model::text(&b, "id"), &b["rank"], &Value::Null)
                    .await?
            }
            _ => {
                Applications(state)
                    .decide(model::text(&b, "id"), model::text(&b, "decision"))
                    .await?
            }
        }));
    }
    match action {
        "claim" => {
            limit(state, h, "claim", 10, 600).await?;
            let claim = legion.claim(h, &b).await?;
            let mut r = ok(claim.body);
            for c in claim.cookies {
                r.headers_mut().append("set-cookie", c);
            }
            Ok(r)
        }
        "checkout" => {
            limit(state, h, "checkout", 8, 600).await?;
            Ok(ok(payments::checkout(state, &b).await?))
        }
        "apply" => {
            limit(state, h, "apply", 3, 600).await?;
            Ok(ok(Applications(state).apply(&b).await?))
        }
        "puzzle" => {
            limit(state, h, "puzzle", 10, 600).await?;
            Ok(ok(Applications(state).puzzle(&b["answer"]).await?))
        }
        "subscribe" => {
            if b["consent"] != true {
                return Err("consent".into());
            }
            limit(state, h, "subscribe", 3, 600).await?;
            Ok(ok(Newsletter(state)
                .subscribe(&b["email"], origin(state, h))
                .await?))
        }
        "confirm" => {
            let c = Newsletter(state).confirm(model::text(&b, "token")).await?;
            let mut r = ok(c.body);
            crate::layers::confirm_email(state, h, &mut r, &c.subscriber)?;
            Ok(r)
        }
        "unsubscribe" => Ok(ok(Newsletter(state)
            .unsubscribe(model::text(&b, "token"))
            .await?)),
        _ => Err("fields".into()),
    }
}
async fn senate_inner(
    state: &AppState,
    m: &Method,
    h: &HeaderMap,
    q: &HashMap<String, String>,
    raw: &[u8],
) -> Result<Response, Error> {
    let senate = Senate(state);
    if *m == Method::GET {
        match query(q, "action") {
            "click" => {
                let p = senate.profile(query(q, "slug")).await?;
                if p["status"] != "active" {
                    return Err("missing".into());
                }
                let slot = query(q, "slot");
                let link = if slot == "cta" {
                    &p["content"]["cta"]
                } else {
                    let n = crate::compound_v2::model::number(&json!(slot))
                        .filter(|n| *n >= 0. && *n < 4. && n.fract() == 0.)
                        .ok_or("missing")?;
                    &p["content"]["links"][n as usize]
                };
                let target = model::text(link, "url");
                if target.is_empty() {
                    return Err("missing".into());
                }
                if state.settings.write_enabled() {
                    senate
                        .count(
                            h,
                            model::text(&p, "slug"),
                            &if slot == "cta" {
                                "cta".into()
                            } else {
                                format!("link-{slot}")
                            },
                        )
                        .await?;
                }
                let u = Url::parse(target)?;
                let target = if matches!(u.host_str(), Some("compound.mov" | "www.compound.mov")) {
                    let slug = model::text(&p, "slug");
                    let mut go = Url::parse(&format!(
                        "https://corvus.gent/go/compound-{}",
                        if slug == "simon-lorenzo" {
                            "simon"
                        } else {
                            slug
                        }
                    ))?;
                    go.query_pairs_mut().append_pair("to", u.as_str());
                    go.to_string()
                } else {
                    target.into()
                };
                return Ok((StatusCode::FOUND, [("location", target)]).into_response());
            }
            "admin" => {
                owner(state, h).await?;
                return Ok(ok(json!({"profiles":senate.admin_list().await?})));
            }
            _ => {}
        }
        if !query(q, "slug").is_empty() {
            let p = senate.profile(query(q, "slug")).await?;
            if p["status"] != "active" {
                return Err("missing".into());
            }
            return Ok(ok(model::public_profile(&p)));
        }
        return Ok(ok(json!({"profiles":senate.public_list().await?})));
    }
    if *m != Method::POST {
        return Ok(StatusCode::METHOD_NOT_ALLOWED.into_response());
    }
    if !state.settings.write_enabled() {
        return Ok(error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Rust writes are disabled.",
        ));
    }
    if !security::same_origin(&state.settings, h) {
        return Err("forbidden".into());
    }
    let b = body(h, raw, 4_000_000)?;
    let action = model::text(&b, "action");
    if action != "upload" && b.to_string().encode_utf16().count() > 16000 {
        return Err("fields".into());
    }
    if action == "view" {
        let p = senate.profile(model::text(&b, "slug")).await?;
        if p["status"] == "active" {
            senate.count(h, model::text(&b, "slug"), "view").await?;
        }
        return Ok(ok(json!({"ok":true})));
    }
    if ["lock", "revoke_edit", "revert"].contains(&action) {
        owner(state, h).await?;
        return Ok(ok(senate
            .manage(model::text(&b, "slug"), action, &b["value"])
            .await?));
    }
    limit(state, h, "spotlight", 100, 3600).await?;
    let token = model::text(&b, "token");
    let p = senate.editing(token).await?;
    match action {
        "load" => {
            let mut v = model::public_profile(&p);
            v["locked"] = p["locked"].clone();
            Ok(ok(v))
        }
        "upload" | "publish" => {
            let (scope, max) = if action == "upload" {
                ("upload", 10)
            } else {
                ("save", 30)
            };
            if !security::rate(
                state,
                &senate.key(&format!("spotlight-{scope}:{}", crypto::sha(token))),
                max,
                3600,
            )
            .await?
            {
                return Err("rate".into());
            }
            Ok(ok(if action == "upload" {
                super::photos::upload(state, &p, &b).await?
            } else {
                model::public_profile(
                    &senate
                        .publish(&p, &b["content"], None, &b["revision"], false)
                        .await?,
                )
            }))
        }
        _ => Err("fields".into()),
    }
}
fn mapped(e: Error, senate: bool) -> Response {
    let code = e.to_string();
    let text = if senate {
        match code.as_str() {
            "image_size" => "Use a JPG, PNG or WebP up to 5 MB.",
            "image_format" => "Use a still JPG, PNG or WebP photo.",
            "missing" => "This spotlight is not public yet.",
            "unauthorized" => "Sign in first.",
            "forbidden" => "Please use this page.",
            "edit_token" => "This private edit link is invalid or has been revoked.",
            "locked" => "Gabe has locked editing for this spotlight.",
            "conflict" => "This spotlight changed. Reload before publishing.",
            "plain_text" => "Use plain text within the character limits; no HTML.",
            "headline" => "Add a headline (up to 80 characters).",
            "links" => "Use up to four labelled HTTPS links.",
            "url" => "Use a full https:// URL.",
            "image" => "Upload your image through this editor.",
            "fields" => "Check the form fields.",
            "rate" => "Too many saves. Please retry later.",
            _ => "Could not save. Please retry.",
        }
    } else {
        match code.as_str() {
            "spotlight_exists" => {
                "A spotlight with that address already exists. Edit its existing invitation."
            }
            "slug" => "Use a unique page slug with lowercase letters and dashes.",
            "title" => "Add an honorary title (up to 80 characters).",
            "name" => "Add a name.",
            "plain_text" => "Use plain text within the limits.",
            "unauthorized" => "Sign in first.",
            "forbidden" => "Please use this page.",
            "rate" => "A little too fast. Try again in a few minutes.",
            "invite" => "This invitation has expired, was used, or is no longer available.",
            "account_login" => {
                "That email already has an account. Sign in to your dog tag, then open this invitation again."
            }
            "handle" => {
                "Use 3–24 letters, numbers or underscores for your handle, starting with a letter."
            }
            "email" => "Please enter a valid email.",
            "fields" => "Check the fields and try again.",
            "rank" => "Choose an existing rank.",
            "missing" => "That entry was not found.",
            "answer" => "Not quite. Follow the lantern and try again.",
            "consent" => "Please agree to receive the confirmation email.",
            "expired" => "This confirmation has expired or was already used.",
            "mail" => "The confirmation email could not be sent. Please retry shortly.",
            "payment_unavailable" => "The checkout is reconnecting. Please retry shortly.",
            _ => "The crow lost its connection. Please retry.",
        }
    };
    let status = match code.as_str() {
        "unauthorized" | "edit_token" => StatusCode::UNAUTHORIZED,
        "forbidden" | "locked" => StatusCode::FORBIDDEN,
        "rate" => StatusCode::TOO_MANY_REQUESTS,
        "invite" => StatusCode::GONE,
        "account_login" | "conflict" => StatusCode::CONFLICT,
        "missing" if senate => StatusCode::NOT_FOUND,
        _ if text == "Could not save. Please retry."
            || text == "The crow lost its connection. Please retry." =>
        {
            StatusCode::SERVICE_UNAVAILABLE
        }
        _ => StatusCode::BAD_REQUEST,
    };
    let mut r = error(status, text);
    if status == StatusCode::TOO_MANY_REQUESTS && !senate {
        r.headers_mut()
            .insert("retry-after", axum::http::HeaderValue::from_static("600"));
    }
    r
}
pub async fn webhook(state: &AppState, m: &Method, h: &HeaderMap, raw: &[u8]) -> Response {
    if *m != Method::POST {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    if !state.settings.write_enabled() {
        return error(StatusCode::SERVICE_UNAVAILABLE, "Rust writes are disabled.");
    }
    match payments::verified_event(
        raw,
        security::header(h, "stripe-signature"),
        &state.settings,
        chrono::Utc::now().timestamp_millis(),
    ) {
        Ok(e) => match payments::process(state, &e).await {
            Ok(v) => ok(v),
            Err(_) => error(StatusCode::SERVICE_UNAVAILABLE, "retry"),
        },
        Err(e) => match e.to_string().as_str() {
            "unavailable" => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
            "too much data" => error(StatusCode::PAYLOAD_TOO_LARGE, "size"),
            _ => error(StatusCode::BAD_REQUEST, "signature"),
        },
    }
}
