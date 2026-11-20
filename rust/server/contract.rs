use serde_json::{Value, json};
use std::io::{self, BufRead};

#[tokio::main]
async fn main() -> Result<(), corvus_server::Error> {
    for line in io::stdin().lock().lines() {
        let row: Value = serde_json::from_str(&line?)?;
        let value = row["value"].as_str().unwrap_or("");
        let result = match row["operation"].as_str() {
            Some("impact-model") => {
                use corvus_core::impact;
                use corvus_server::impact::{model, samples};
                let result: Result<Value, corvus_server::Error> = (|| match row["action"].as_str() {
                    Some("target") => corvus_server::impact::links::target(
                        &corvus_server::config::Settings::new(serde_json::from_value(
                            row["env"].clone(),
                        )?),
                        value,
                    )
                    .map(|v| json!(v)),
                    Some("post-info") => model::post_info(&row["body"]),
                    Some("validate") => model::validate(&row["body"], &row["previous"]),
                    Some("public") => Ok(model::public_post(&row["body"])),
                    Some("bulk") => model::bulk_rows(
                        &row["body"],
                        row.get("made").unwrap_or(&Value::Bool(true)),
                        row["allow_unmeasured"] == true,
                    )
                    .map(|v| json!(v)),
                    Some("linkedin-bulk") => {
                        model::linkedin_bulk(&row["body"], &row["options"]).map(|v| json!(v))
                    }
                    Some("linkedin-post") => model::linkedin_post(&row["body"]),
                    Some("normalize") => Ok(impact::normalize(
                        row["platform"].as_str().unwrap_or(""),
                        &row["body"],
                        row["oriane"] == true,
                    )),
                    Some("source") => Ok(json!(impact::source_kind(value))),
                    Some("accounts") => Ok(
                        json!({"platform":impact::platform_id(&row["platform"]),"account":impact::account_handle(row["platform"].as_str().unwrap_or(""),&row["account"]),"configured":impact::configured(row["platform"].as_str().unwrap_or(""),&row["account"]),"list":impact::configured_accounts()}),
                    ),
                    Some("filter") => Ok(json!(impact::filtered(
                        row["body"].as_array().ok_or("posts")?,
                        row["platform"].as_str().unwrap_or(""),
                        row["account"].as_str().unwrap_or("")
                    ))),
                    Some("history") => Ok(
                        json!({"hours":samples::hour_samples(row["body"].as_array().ok_or("history")?),"best":impact::best_sample(row["body"].as_array().ok_or("history")?)}),
                    ),
                    Some("refresh") => Ok(json!(impact::refresh_ms(
                        &row["body"],
                        row["now"].as_i64().ok_or("now")?
                    ))),
                    _ => Err("Unknown impact contract".into()),
                })();
                match result {
                    Ok(v) => v,
                    Err(e) => json!({"error":e.to_string()}),
                }
            }
            Some("interview-fields") => {
                match corvus_server::interviews::store::fields(&row["body"]) {
                    Ok(v) => v,
                    Err(e) => json!({"error":e.to_string()}),
                }
            }
            Some("interview-photo") => {
                use base64::{Engine, engine::general_purpose::STANDARD};
                match corvus_server::interviews::photos::reencode(value) {
                    Ok(v) => json!({"data":STANDARD.encode(v)}),
                    Err(e) => json!({"error":e.to_string()}),
                }
            }
            Some("compound-summary") => corvus_server::compound_v2::summary::summarize(
                &row["report"],
                row["events"].as_array().ok_or("events")?,
                row["now"].as_i64().ok_or("now")?,
            )?,
            Some("compound-platform-id") => {
                json!({"id":corvus_server::compound_v2::sync::platform_id(&row["body"])})
            }
            Some("compound-report") => corvus_server::compound_v2::reports::build(
                row["videos"].as_array().ok_or("videos")?,
                row["samples"].as_array().ok_or("samples")?,
                row["now"].as_i64().ok_or("now")?,
            )?,
            Some("compound-export") => {
                use corvus_server::compound_v2::{push, uploads};
                match uploads::validate_export(&row["body"]) {
                    Ok(v) => json!({"asset":v,"post":push::post_url(value)}),
                    Err(e) => json!({"error":e.to_string()}),
                }
            }
            Some("compound-queue") => corvus_server::compound_v2::queue::upload_queue(
                row["videos"].as_array().ok_or("videos")?,
                row["now"].as_i64().ok_or("now")?,
            ),
            Some("compound-stripe") => {
                use corvus_server::compound::payments;
                let env = corvus_server::config::Settings::new(serde_json::from_value(
                    row["env"].clone(),
                )?);
                let result = if row["action"] == "checkout" {
                    payments::checkout(
                        &env,
                        &row["body"],
                        &row["journey"],
                        "compound_fixture",
                        row["now"].as_i64().unwrap_or(0),
                    )
                } else {
                    payments::verified_event(
                        row["payload"].as_str().unwrap_or("").as_bytes(),
                        row["signature"].as_str().unwrap_or(""),
                        &env,
                        row["now"].as_i64().unwrap_or(0),
                    )
                };
                match result {
                    Ok(v) => v,
                    Err(e) => json!({"error":e.to_string()}),
                }
            }
            Some("compound-original") => {
                use corvus_server::compound::{model as m, security as s};
                let body = &row["body"];
                let result: Result<Value, corvus_server::Error> = match row["action"].as_str() {
                    Some("clean") => Ok(json!(m::clean(
                        body,
                        row["max"].as_u64().unwrap_or(280) as usize
                    ))),
                    Some("links") => Ok(json!(corvus_server::compound::links::destination(
                        row["slug"].as_str().unwrap_or(""),
                        &row["content"],
                        body
                    ))),
                    Some("version") => Ok(json!(m::valid_version(body))),
                    Some("source") => Ok(json!(m::source(body))),
                    Some("attribution") => Ok(m::attribution(
                        body,
                        row["nested"] != false,
                        row["now"].as_i64().unwrap_or(0),
                    )),
                    Some("poll") => m::poll(body),
                    Some("cues") => m::cues(body, row["duration"].as_f64().unwrap_or(60.)),
                    Some("cutlist") => m::cutlist(body, row["duration"].as_f64().unwrap_or(60.)),
                    Some("bucket") => {
                        m::time_bucket(row.get("body"), row["duration"].as_f64().unwrap_or(60.))
                            .map(|v| json!(v))
                    }
                    Some("security") => {
                        let env = corvus_server::config::Settings::new(serde_json::from_value(
                            row["env"].clone(),
                        )?);
                        let mut headers = axum::http::HeaderMap::new();
                        if let Some(h) = row["headers"].as_object() {
                            for (k, v) in h {
                                headers.insert(
                                    axum::http::HeaderName::try_from(k)?,
                                    v.as_str().unwrap_or("").parse()?,
                                );
                            }
                        }
                        Ok(
                            json!({"authorized":s::authorized(&env,&headers,row["role"].as_str().unwrap_or("stats"),row["now"].as_i64().unwrap_or(0))?,"origin":s::same_origin(&env,&headers)}),
                        )
                    }
                    _ => Err("operation".into()),
                };
                match result {
                    Ok(v) => v,
                    Err(e) => json!({"error":e.to_string()}),
                }
            }
            Some("compound-share") => {
                use corvus_core::compound_share as s;
                let slug = row["slug"].as_str().unwrap_or("");
                let result:Result<Value,&str>=match row["action"].as_str(){
                    Some("copy")=>s::share_copy(slug).map(|v|json!(v)),
                    Some("tracked")=>s::tracked(slug,row["source"].as_str().unwrap_or(""),row["medium"].as_str().unwrap_or("post")).map(|v|json!(v)),
                    Some("reply")=>Ok(json!(s::reply_id(value))),
                    Some("draft")=>s::draft(slug,row["platform"].as_str().unwrap_or(""),row["reply"].as_str().unwrap_or("")).map(|v|json!(v)),
                    Some("today")=>Ok(json!(s::today(row["videos"].as_array().map(Vec::as_slice).unwrap_or(&[]),row["day"].as_str().unwrap_or("")))),
                    _=>corvus_core::videos::parse_slug(slug).ok_or("Invalid video slug.").map(|v|json!({"code":s::code_url(&v),"full":s::full(&v,row["medium"].as_str().unwrap_or("post")),"pinned":s::pinned(&v)}))
                };
                match result {
                    Ok(v) => v,
                    Err(e) => json!({"error":e}),
                }
            }
            Some("compound-model") => {
                use corvus_server::compound_v2::model;
                let result = model::video(
                    &row["body"],
                    row["pending"] == true,
                    row["at"].as_str().unwrap_or("2026-11-20T00:00:00.000Z"),
                );
                match result {
                    Ok(v) => {
                        json!({"video":v,"public":model::public_video(&v),"attribution":model::attribution(&row["tags"])})
                    }
                    Err(e) => json!({"error":e.to_string()}),
                }
            }
            Some("compound-security") => {
                use corvus_server::compound_v2::security;
                let env = corvus_server::config::Settings::new(serde_json::from_value(
                    row["env"].clone(),
                )?);
                let mut headers = axum::http::HeaderMap::new();
                for (k, v) in row["headers"].as_object().ok_or("headers")? {
                    headers.insert(
                        axum::http::HeaderName::from_bytes(k.as_bytes())?,
                        v.as_str().ok_or("header")?.parse()?,
                    );
                }
                json!({"authorized":security::authorized(&env,&headers,row["now"].as_i64().ok_or("now")?)?,"origin":security::same_origin(&env,&headers),"analytics":security::analytics(&row["body"],&headers)})
            }
            Some("compound-store" | "compound-editor") => {
                use corvus_server::compound_v2::{security, store::Registry};
                let settings = std::sync::Arc::new(corvus_server::config::Settings::from_env());
                if settings.production()
                    || settings.get("CORVUS_RUST_WRITES") != Some("isolated")
                    || !settings.write_enabled()
                {
                    return Err("storage contracts require isolated local storage".into());
                }
                let http = reqwest::Client::new();
                let state = corvus_server::AppState {
                    store: corvus_server::store::Store::new(settings.clone(), http.clone()),
                    http,
                    settings,
                    live: corvus_server::live::LiveService::new()?,
                    compound_summary: Default::default(),
                };
                if row["operation"] == "compound-editor" {
                    let result = editor_contract(&state, &row).await;
                    println!(
                        "{}",
                        match result {
                            Ok(v) => v,
                            Err(e) => json!({"error":e.to_string()}),
                        }
                    );
                    continue;
                }
                let registry = Registry(&state);
                let slug = row["slug"].as_str().unwrap_or("");
                let uid = row["uid"].as_str().unwrap_or("");
                let output: Result<Value, corvus_server::Error> = match row["action"].as_str() {
                    Some("impact-sync") => {
                        corvus_server::impact::sync::run_bounded(
                            &state,
                            row["force"] == true,
                            row["platform"].as_str(),
                            if value.is_empty() { None } else { Some(value) },
                            std::time::Duration::from_millis(
                                row["budget"].as_u64().unwrap_or(90000),
                            ),
                        )
                        .await
                    }
                    Some("impact-provider") => {
                        use corvus_server::impact::providers::Provider;
                        match Provider::new(
                            &state,
                            if value.is_empty() { None } else { Some(value) },
                            row["now"]
                                .as_i64()
                                .unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
                        ) {
                            Ok(provider) => Ok(
                                match provider
                                    .run(
                                        row["platform"].as_str().unwrap_or(""),
                                        row["rows"].as_array().map(Vec::as_slice).unwrap_or(&[]),
                                        row["registered"]
                                            .as_array()
                                            .map(Vec::as_slice)
                                            .unwrap_or(&[]),
                                        row["account"].as_str().unwrap_or(""),
                                        row["archives"] == true,
                                    )
                                    .await
                                {
                                    Ok(v) => v,
                                    Err(e) => e.json(),
                                },
                            ),
                            Err(e) => Ok(e.json()),
                        }
                    }
                    Some("impact-records") => corvus_server::impact::store::Impact(&state)
                        .records(None)
                        .await
                        .map(|v| json!(v)),
                    Some("impact-save") => {
                        corvus_server::impact::store::Impact(&state)
                            .save(
                                &row["body"],
                                corvus_server::impact::store::SaveOptions {
                                    source: row["source"].as_str(),
                                    expected: row.get("expected"),
                                    seed: row["seed"] == true,
                                    observed_at: row["at"].as_str(),
                                    registry: None,
                                },
                            )
                            .await
                    }
                    Some("impact-report") => {
                        corvus_server::impact::store::Impact(&state)
                            .report(row["private"] == true)
                            .await
                    }
                    Some("impact-snapshot") => {
                        corvus_server::impact::store::Impact(&state)
                            .snapshot()
                            .await
                    }
                    Some("impact-history") => {
                        corvus_server::impact::store::Impact(&state)
                            .rebuild_history(&row["body"])
                            .await
                    }
                    Some("impact-clicks") => {
                        corvus_server::impact::store::Impact(&state)
                            .click_report()
                            .await
                    }
                    Some("impact-click") => {
                        let mut headers = axum::http::HeaderMap::new();
                        for (k, v) in row["headers"].as_object().ok_or("headers")? {
                            headers.insert(
                                axum::http::HeaderName::from_bytes(k.as_bytes())?,
                                v.as_str().ok_or("header")?.parse()?,
                            );
                        }
                        corvus_server::impact::links::count(
                            &state,
                            &row["method"].as_str().unwrap_or("GET").parse()?,
                            &headers,
                            value,
                        )
                        .await
                    }
                    Some("interview-save") => {
                        corvus_server::interviews::store::Interviews(&state)
                            .save(
                                &row["body"],
                                row["photo_url"].as_str().unwrap_or(""),
                                row["remove_photo"] == true,
                            )
                            .await
                    }
                    Some("interview-delete") => {
                        corvus_server::interviews::store::Interviews(&state)
                            .remove(&row["n"], &row["updated_at"])
                            .await
                    }
                    Some("interview-get") => corvus_server::interviews::store::Interviews(&state)
                        .get(&row["n"])
                        .await
                        .map(|v| v.unwrap_or(Value::Null)),
                    Some("interview-list") => corvus_server::interviews::store::Interviews(&state)
                        .list()
                        .await
                        .map(Value::Array),
                    Some("photo-upload") => {
                        match corvus_server::interviews::photos::Photos::isolated(&state, value) {
                            Ok(photos) => photos
                                .upload(row["data"].as_str().unwrap_or(""))
                                .await
                                .map(|v| json!({"url":v})),
                            Err(e) => Err(e),
                        }
                    }
                    Some("photo-delete") => {
                        match corvus_server::interviews::photos::Photos::isolated(&state, value) {
                            Ok(photos) => photos
                                .delete(row["url"].as_str().unwrap_or(""))
                                .await
                                .map(|_| json!({"ok":true})),
                            Err(e) => Err(e),
                        }
                    }
                    Some("photo-cleanup") => {
                        match corvus_server::interviews::photos::Photos::isolated(&state, value) {
                            Ok(photos) => photos.cleanup().await.map(|_| json!({"ok":true})),
                            Err(e) => Err(e),
                        }
                    }
                    Some("sync-status") => {
                        corvus_server::compound_v2::sync::status(&registry).await
                    }
                    Some("sync-due") => {
                        corvus_server::compound_v2::sync::with_endpoint(&registry, value).await
                    }
                    Some("latest-report") => {
                        corvus_server::compound_v2::reports::latest(&registry).await
                    }
                    Some("run-report") => {
                        corvus_server::compound_v2::reports::run(
                            &registry,
                            row["force"] == true,
                            row["trigger"].as_str().unwrap_or("cron"),
                        )
                        .await
                    }
                    Some("import-export") => {
                        corvus_server::compound_v2::uploads::import_export(&registry, &row["body"])
                            .await
                    }
                    Some("mark-posted") => {
                        corvus_server::compound_v2::uploads::mark_posted(
                            &registry,
                            slug,
                            &row["url"],
                            row["at"].as_str().unwrap_or("2026-11-20T00:00:00Z"),
                        )
                        .await
                    }
                    Some("winner") => corvus_server::compound_v2::push::winner(&registry).await,
                    Some("set-winner") => {
                        corvus_server::compound_v2::push::select(&registry, slug).await
                    }
                    Some("videos") => registry.videos().await.map(Value::Array),
                    Some("get") => registry.get(slug).await.map(|v| v.unwrap_or(Value::Null)),
                    Some("save") => registry.save(&row["body"], row["update"] == true).await,
                    Some("report") => registry.report(row["private"] == true).await,
                    Some("event") => registry
                        .event(value, slug, &row["detail"])
                        .await
                        .map(|_| json!({"ok":true})),
                    Some("vote") => registry.vote(uid, slug, value).await,
                    Some("feedback") => {
                        registry
                            .feedback(uid, slug, value, row["handle"].as_str().unwrap_or(""))
                            .await
                    }
                    Some("private-feedback") => registry.private_feedback().await,
                    Some("hide-feedback") => registry
                        .hide_feedback(value)
                        .await
                        .map(|_| json!({"ok":true})),
                    Some("sync") => registry
                        .apply_synced_metrics(&row["previous"], &row["metrics"])
                        .await
                        .map(|v| json!({"updated":v})),
                    Some("latest-votes") => registry.latest_votes().await,
                    Some("login") => security::login(
                        &state.settings,
                        &row["password"],
                        chrono::Utc::now().timestamp_millis(),
                    )
                    .map(|v| json!({"cookie":v.and_then(|v|v.to_str().ok().map(str::to_string))})),
                    Some("identity") => {
                        let mut h = axum::http::HeaderMap::new();
                        h.insert("cookie", value.parse()?);
                        security::identity(&state.settings,&h).map(|(uid,c)|json!({"uid":uid,"cookie":c.and_then(|v|v.to_str().ok().map(str::to_string))}))
                    }
                    _ => Err("Unknown storage contract".into()),
                };
                match output {
                    Ok(v) => v,
                    Err(e) => json!({"error":e.to_string()}),
                }
            }
            Some("voter-proof") => {
                let settings = std::sync::Arc::new(corvus_server::config::Settings::from_env());
                if settings.production()
                    || settings.get("CORVUS_RUST_WRITES") != Some("isolated")
                    || !settings.write_enabled()
                {
                    return Err("proof contract requires isolated local storage".into());
                }
                let http = reqwest::Client::new();
                let state = corvus_server::AppState {
                    store: corvus_server::store::Store::new(settings.clone(), http.clone()),
                    http,
                    settings,
                    live: corvus_server::live::LiveService::new()?,
                    compound_summary: Default::default(),
                };
                if row["make"] == true {
                    corvus_server::voter::make_challenge(
                        &state,
                        value,
                        row["action"].as_str().unwrap_or("vote"),
                    )
                    .await?
                } else {
                    json!({"valid":corvus_server::voter::verify_challenge(&state,value,&row["body"]).await?})
                }
            }
            Some("voter-cookie") => {
                let env = corvus_server::config::Settings::new(serde_json::from_value(
                    row["env"].clone(),
                )?);
                json!({"music":corvus_server::voter::read_music(&env,value)?,"language":corvus_server::voter::read_language(&env,value)?,"musicSecret":corvus_server::crypto::music_vote_secret(&env)?,"languageSecret":corvus_server::crypto::language_vote_secret(&env)?,"gameSecret":corvus_server::crypto::game_secret(&env)?})
            }
            Some("battle-order") => {
                json!({"order":corvus_server::battle::order(row["secret"].as_str().unwrap_or(""),value)})
            }
            Some("routing") => match corvus_core::routing::decide(
                value,
                row["method"].as_str().unwrap_or("GET"),
                row["ua"].as_str().unwrap_or(""),
                row["cookie"].as_str().unwrap_or(""),
            ) {
                Ok(result) => serde_json::to_value(result)?,
                Err(_) => json!({"error":true}),
            },
            Some("support-form") => {
                match corvus_server::support::Config::embedded()?.validate(&row["body"]) {
                    Ok(fields) => json!({"fields":fields}),
                    Err(message) => json!({"error":message}),
                }
            }
            Some("support-config") => {
                let env = corvus_server::config::Settings::new(serde_json::from_value(
                    row["env"].clone(),
                )?);
                let c = corvus_server::support::Config::embedded()?;
                let q = serde_json::from_value(row["query"].clone())?;
                json!({"config":c.configuration(&env),"url":c.destination(value,&q,&env)})
            }
            Some("live-form") => {
                let result = corvus_server::live_interviews::validate(&row["body"]);
                match result {
                    Ok(fields) => json!({"fields":fields}),
                    Err(message) => json!({"error":message}),
                }
            }
            Some("live-challenge") => {
                json!({"valid":corvus_server::live_interviews::valid_challenge(row["secret"].as_str().unwrap_or(""),value,row["now"].as_i64().ok_or("now")?)})
            }
            Some("hack-mode") => corvus_server::live::Config::embedded()?
                .hack_mode(row["mode"].as_str(), row["now"].as_i64().ok_or("now")?),
            Some("plethora") => {
                json!({"canonical":corvus_core::plethora::canonical(value),"url":corvus_core::plethora::official_url(value)})
            }
            Some("crypto") => {
                let secret = row["secret"].as_str().unwrap_or("");
                json!({"sign":corvus_server::crypto::sign(secret,value),"hash":corvus_server::crypto::hash(secret,value)})
            }
            Some("metrics") => {
                let p = &row["post"];
                json!({"coverage":corvus_core::metrics::coverage(p),"engagements":corvus_core::metrics::engagements(p),"eligibility":corvus_core::metrics::eligibility(p),"classification":corvus_core::metrics::classification(p),"sample":corvus_core::metrics::first_day_sample(p)})
            }
            Some("slug") => {
                json!({"parsed":corvus_core::videos::parse_slug(value),"destination":corvus_core::videos::destination(value,&row["query"])})
            }
            Some("code") => {
                let videos = row["slugs"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|v| v.as_str().and_then(corvus_core::videos::parse_slug))
                    .collect::<Vec<_>>();
                corvus_core::videos::resolve_code(
                    value,
                    &videos,
                    &row["query"],
                    row["source"].as_str().unwrap_or("url"),
                )
            }
            Some("army") => {
                let p = &row["user"];
                json!({"points":corvus_core::army::points(p),"rank":corvus_core::army::rank(p),"tier":corvus_core::army::member_tier(p)})
            }
            Some("day") => {
                json!({"day":corvus_server::layers::local_day(row["now"].as_i64().ok_or("now")?,value)})
            }
            Some("tier") => json!({"path":corvus_core::tiers::tier_path(value).map(|x| x.0)}),
            _ => return Err("Unknown contract operation".into()),
        };
        println!("{}", serde_json::to_string(&result)?);
    }
    Ok(())
}

async fn editor_contract(
    state: &corvus_server::AppState,
    row: &Value,
) -> Result<Value, corvus_server::Error> {
    use corvus_server::compound::store::{Editor, text};
    let editor = Editor(state);
    let uid = text(&row["uid"]);
    let v = text(&row["version"]);
    let body = &row["body"];
    match text(&row["action"]) {
        "get" => editor.get(text(&row["key"])).await,
        "version" => editor.version(v).await,
        "versions" => editor.versions().await.map(|v| json!(v)),
        "publish" => editor.publish(body).await,
        "rename" => editor.rename_items(v, &row["labels"]).await,
        "summary" => editor.summary(v).await,
        "private" => editor.private_stats(v).await,
        "campaigns" => editor.campaign_stats().await.map(|v| json!(v)),
        "event" => {
            editor
                .event(
                    text(&row["name"]),
                    v,
                    body,
                    row["visitor"].as_str(),
                    &row["details"],
                )
                .await?;
            Ok(json!({"ok":true}))
        }
        "profile" => editor.profile(uid, &row["value"]).await.map(|v| json!(v)),
        "feedback" => editor.feedback(uid, v, body).await,
        "text" => {
            editor
                .save_text(
                    uid,
                    v,
                    &row["value"],
                    row["category"].as_str().unwrap_or("idea"),
                    row["points"].as_i64().unwrap_or(3),
                )
                .await
        }
        "reaction" => {
            editor
                .reaction(uid, v, text(&row["kind"]), row["t"].as_f64().unwrap_or(0.))
                .await
        }
        "push-poll" => editor.push_poll(v, body).await,
        "answer" => {
            editor
                .answer(uid, v, text(&row["id"]), &row["option"])
                .await
        }
        "predict" => editor.predict(uid, body).await,
        "watched" => editor.watched(uid, v).await,
        "duel" => editor.duel(uid, body).await,
        "transition" => editor.transition(uid, &row["record"], body).await,
        "quick" => editor.quick_note(uid, v, body).await,
        "note-text" => {
            editor
                .note_text(uid, v, text(&row["id"]), &row["value"])
                .await
        }
        "feed" => editor
            .feedback_feed(row["limit"].as_u64().unwrap_or(5) as usize)
            .await
            .map(|v| json!(v)),
        "hide" => editor.hide_text(text(&row["id"])).await.map(|v| json!(v)),
        "revolut" => editor.set_revolut(body).await,
        "checkout" => editor.donation_link(body, &row["journey"]).await,
        "stripe" => editor.stripe_event(body).await,
        _ => Err("unknown editor fixture".into()),
    }
}
