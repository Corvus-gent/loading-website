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
            Some("compound-store") => {
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
                let registry = Registry(&state);
                let slug = row["slug"].as_str().unwrap_or("");
                let uid = row["uid"].as_str().unwrap_or("");
                let output: Result<Value, corvus_server::Error> = match row["action"].as_str() {
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
