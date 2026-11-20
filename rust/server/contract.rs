use serde_json::{Value, json};
use std::io::{self, BufRead};

#[tokio::main]
async fn main() -> Result<(), corvus_server::Error> {
    for line in io::stdin().lock().lines() {
        let row: Value = serde_json::from_str(&line?)?;
        let value = row["value"].as_str().unwrap_or("");
        let result = match row["operation"].as_str() {
            Some("og-model") => {
                use corvus_server::og::model as m;
                let result: Result<Value, corvus_server::Error> = (|| {
                    Ok(match row["action"].as_str() {
                        Some("duration") => json!(corvus_server::og::render::duration(
                            row["seconds"].as_f64().unwrap_or(0.0),
                            row["avg"] == true
                        )),
                        Some("curiosity") => {
                            use base64::{Engine, engine::general_purpose::STANDARD};
                            json!(
                                STANDARD
                                    .encode(corvus_server::og::render::curiosity(&row["body"])?)
                            )
                        }
                        Some("render") => {
                            use base64::{Engine, engine::general_purpose::STANDARD};
                            let photo = row["photo"]
                                .as_str()
                                .map(|b| STANDARD.decode(b))
                                .transpose()?;
                            json!(STANDARD.encode(corvus_server::og::render::render(
                                &row["body"],
                                row["now"].as_i64().ok_or("time")?,
                                photo.as_deref()
                            )?))
                        }
                        Some("photo-url") => json!(corvus_server::og::render::allowed_photo(value)),
                        Some("countdown") => {
                            json!(m::countdown(row["now"].as_i64().ok_or("time")?))
                        }
                        Some("interview") => m::interview_card(&row["body"]),
                        Some("image-url") => json!(m::image_url(&row["body"])?),
                        Some("metadata") => json!(m::metadata(value, &row["body"])?),
                        Some("resolve") => m::resolve_data(
                            &row["query"],
                            row["rows"].as_array().map(Vec::as_slice).unwrap_or(&[]),
                            row.get("video").filter(|v| !v.is_null()),
                        )?,
                        _ => return Err("action".into()),
                    })
                })();
                result.unwrap_or_else(|e| json!({"error":e.to_string()}))
            }
            Some("army-model") => {
                use corvus_server::army::{model as m, security as s};
                let result: Result<Value, corvus_server::Error> = (|| {
                    let env = corvus_server::config::Settings::new(serde_json::from_value(
                        row["env"].clone(),
                    )?);
                    let b = &row["body"];
                    let now = row["now"].as_i64().ok_or("time")?;
                    Ok(match row["action"].as_str() {
                        Some("application") => m::application(b)?,
                        Some("tier-name") => json!(corvus_server::army::payments::tier_name(b)),
                        Some("discord-plan") => corvus_server::army::discord_model::plan(b)?,
                        Some("discord-findings") => {
                            json!(corvus_server::army::discord_model::findings(
                                &b["config"],
                                b["roles"].as_array().ok_or("roles")?,
                                b["channels"].as_array().ok_or("channels")?
                            )?)
                        }
                        Some("discord-above") => json!(
                            corvus_server::army::discord_model::role_above(&b["a"], &b["b"])?
                        ),
                        Some("discord-signature") => {
                            json!(corvus_server::army::discord_model::interaction(
                                value.as_bytes(),
                                b["signature"].as_str().unwrap_or(""),
                                b["timestamp"].as_str().unwrap_or(""),
                                b["key"].as_str().unwrap_or(""),
                                now
                            ))
                        }
                        Some("pidgy-code") => {
                            json!(corvus_server::army::pidgy::handle_from_code(b))
                        }
                        Some("webhook") => json!(s::verify_webhook(
                            value.as_bytes(),
                            b.as_str().unwrap_or(""),
                            env.get("WEBHOOK_SECRET").unwrap_or("")
                        )),
                        Some("link") => json!(m::link(b)?),
                        Some("tier") => json!(m::active_tier(b, now)),
                        Some("public") => m::public_soldier(b, row["link"] != false, now),
                        Some("day") => json!(m::day_key(now)?),
                        Some("week") => json!(m::week_key(now)?),
                        Some("mission") => m::daily_mission(
                            b["day"].as_str().unwrap_or(""),
                            b["type"].as_str().unwrap_or(""),
                        )?,
                        Some("reward") => json!(m::mission_reward(b, now)?),
                        Some("seal") => json!(s::seal(&env, b.as_str().ok_or("value")?)?),
                        Some("open") => json!(s::open(&env, b.as_str().ok_or("value")?)?),
                        _ => return Err("action".into()),
                    })
                })();
                result.unwrap_or_else(|e| json!({"error":e.to_string()}))
            }
            Some("legion-model") => {
                use corvus_server::legion::{model as m, security as s};
                let result: Result<Value, corvus_server::Error> = (|| {
                    let env = corvus_server::config::Settings::new(serde_json::from_value(
                        row["env"].clone(),
                    )?);
                    let body = &row["body"];
                    Ok(match row["action"].as_str() {
                        Some("photo") => {
                            use base64::Engine;
                            json!(base64::engine::general_purpose::STANDARD.encode(
                                corvus_server::legion::photos::reencode(body, &row["size"])?
                            ))
                        }
                        Some("photo-url") => json!(corvus_server::legion::photos::owned_url(
                            value,
                            body.as_str().unwrap_or("")
                        )),
                        Some("army-email") => Ok::<_, corvus_server::Error>(json!(
                            corvus_server::army::model::email(body)?
                        ))?,
                        Some("army-username") => json!(corvus_server::army::model::username(body)),
                        Some("army-valid-username") => json!(
                            corvus_server::army::model::valid_username(body.as_str().unwrap_or(""))
                        ),
                        Some("army-digest") => {
                            json!(corvus_server::army::security::digest(&env, value)?)
                        }
                        Some("army-prefix") => {
                            json!(corvus_server::army::security::namespace(&env)?)
                        }
                        Some("stripe") => corvus_server::legion::payments::verified_event(
                            value.as_bytes(),
                            body.as_str().unwrap_or(""),
                            &env,
                            row["now"].as_i64().ok_or("now")?,
                        )?,
                        Some("plain") => {
                            json!(m::plain(body, row["max"].as_u64().unwrap_or(80) as usize)?)
                        }
                        Some("clean") => {
                            json!(m::clean(body, row["max"].as_u64().unwrap_or(300) as usize))
                        }
                        Some("https") => json!(m::https(body)?),
                        Some("slug") => json!(m::valid_slug(body)),
                        Some("content") => m::content(body)?,
                        Some("public") => m::public_profile(body),
                        Some("reserve") => m::reservation(body, value)?,
                        Some("member") => m::member_row(body).unwrap_or(Value::Null),
                        Some("csv") => json!(m::csv_cell(Some(body))),
                        Some("token") => json!(s::valid_token(body)),
                        Some("prefix") => json!(s::prefix(&env)),
                        Some("stamp") => json!(s::password_stamp(&env)?),
                        Some("origin") => {
                            let mut h = axum::http::HeaderMap::new();
                            if let Some(o) = body.as_str() {
                                h.insert("origin", o.parse()?);
                            }
                            json!(s::same_origin(&env, &h))
                        }
                        _ => return Err("Unknown legion contract".into()),
                    })
                })();
                result.unwrap_or_else(|e| json!({"error":e.to_string()}))
            }
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
            Some(
                "compound-store" | "compound-editor" | "legion-store" | "army-store" | "og-store",
            ) => {
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
                if row["operation"] == "og-store" {
                    let value = corvus_server::og::model::resolve(&state, &row["query"]).await;
                    println!(
                        "{}",
                        value.unwrap_or_else(|e| json!({"error":e.to_string()}))
                    );
                    continue;
                }
                if row["operation"] == "army-store" {
                    let result = army_contract(&state, &row).await;
                    println!(
                        "{}",
                        result.unwrap_or_else(|e| json!({"error":e.to_string()}))
                    );
                    continue;
                }
                if row["operation"] == "legion-store" {
                    let result = legion_contract(&state, &row).await;
                    println!(
                        "{}",
                        result.unwrap_or_else(|e| json!({"error":e.to_string()}))
                    );
                    continue;
                }
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

async fn legion_contract(
    state: &corvus_server::AppState,
    row: &Value,
) -> Result<Value, corvus_server::Error> {
    use corvus_server::legion::{security, senate::Senate};
    let store = Senate(state);
    let legion = corvus_server::legion::store::Legion(state);
    let army = corvus_server::army::store::Army::new(state)?;
    let slug = row["slug"].as_str().unwrap_or("");
    let body = &row["body"];
    let mut h = axum::http::HeaderMap::new();
    if let Some(headers) = row["headers"].as_object() {
        for (k, v) in headers {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes())?,
                v.as_str().ok_or("header")?.parse()?,
            );
        }
    }
    match row["action"].as_str() {
        Some("upload") => corvus_server::legion::photos::upload(state, &row["record"], body).await,
        Some("partners") => {
            corvus_server::legion::partners::Partners(state)
                .report()
                .await
        }
        Some("all-partners") => corvus_server::legion::partners::Partners(state).all().await,
        Some("partner-count") => {
            corvus_server::legion::partners::Partners(state)
                .count(
                    &row["method"].as_str().unwrap_or("GET").parse()?,
                    &h,
                    row["id"].as_str().unwrap_or(""),
                )
                .await
        }
        Some("short-count") => {
            corvus_server::legion::partners::Partners(state)
                .count_short(&h, body)
                .await
        }
        Some("checkout") => corvus_server::legion::payments::checkout(state, body).await,
        Some("payment") => corvus_server::legion::payments::process(state, body).await,
        Some("apply") => {
            corvus_server::legion::applications::Applications(state)
                .apply(body)
                .await
        }
        Some("puzzle") => {
            corvus_server::legion::applications::Applications(state)
                .puzzle(body)
                .await
        }
        Some("applications") => {
            corvus_server::legion::applications::Applications(state)
                .all()
                .await
        }
        Some("decide") => {
            corvus_server::legion::applications::Applications(state)
                .decide(
                    row["id"].as_str().unwrap_or(""),
                    row["decision"].as_str().unwrap_or(""),
                )
                .await
        }
        Some("subscribe") => {
            corvus_server::legion::newsletter::Newsletter(state)
                .subscribe(
                    body,
                    row["origin"].as_str().unwrap_or("https://corvus.gent"),
                )
                .await
        }
        Some("confirm") => {
            let r = corvus_server::legion::newsletter::Newsletter(state)
                .confirm(row["token"].as_str().unwrap_or(""))
                .await?;
            Ok(json!({"body":r.body,"subscriber":r.subscriber}))
        }
        Some("unsubscribe") => {
            corvus_server::legion::newsletter::Newsletter(state)
                .unsubscribe(row["token"].as_str().unwrap_or(""))
                .await
        }
        Some("subscribers") => {
            corvus_server::legion::newsletter::Newsletter(state)
                .subscribers()
                .await
        }
        Some("create-invite") => {
            legion
                .create_invite(
                    body,
                    row["origin"].as_str().unwrap_or("https://corvus.gent"),
                )
                .await
        }
        Some("invite") => {
            legion
                .invite(row["token"].as_str().unwrap_or(""), row["open"] == true)
                .await
        }
        Some("invitations") => legion.invitations().await,
        Some("revoke-invite") => Ok(json!(
            legion.revoke(row["id"].as_str().unwrap_or("")).await?
        )),
        Some("admit") => legion.admit(body).await,
        Some("claim") => {
            let result = legion.claim(&h, body).await?;
            Ok(
                json!({"body":result.body,"cookies":result.cookies.iter().map(|h|h.to_str().unwrap_or("")).collect::<Vec<_>>()}),
            )
        }
        Some("members") => Ok(json!(legion.members().await?)),
        Some("rank") => {
            legion
                .set_rank(
                    row["id"].as_str().unwrap_or(""),
                    &row["rank"],
                    &row["source"],
                )
                .await
        }
        Some("army-user") => army.user(row["id"].as_str().unwrap_or("")).await,
        Some("army-session") => army.session(&h).await,
        Some("army-email") => army.by_email(row["email"].as_str().unwrap_or("")).await,
        Some("army-name") => army.by_name(row["name"].as_str().unwrap_or("")).await,
        Some("army-persist") => army.persist(body).await,
        Some("reserve") => store.reserve(body).await,
        Some("profile") => store.profile(slug).await,
        Some("public") => store.public_list().await,
        Some("editing") => store.editing(row["token"].as_str().unwrap_or("")).await,
        Some("publish") => {
            store
                .publish(
                    &row["record"],
                    body,
                    row["actor"].as_str(),
                    &row["expected"],
                    row["admin"] == true,
                )
                .await
        }
        Some("versions") => Ok(json!(store.versions(slug).await?)),
        Some("admin") => store.admin_list().await,
        Some("manage") => {
            store
                .manage(slug, row["kind"].as_str().unwrap_or(""), &row["value"])
                .await
        }
        Some("count") => {
            store
                .count(&h, slug, row["kind"].as_str().unwrap_or(""))
                .await?;
            Ok(Value::Null)
        }
        Some("authorized") => Ok(json!(security::authorized(state, &h).await?)),
        Some("login") => Ok(json!(security::login(state, &h, body).await?.to_str()?)),
        Some("logout") => Ok(json!(security::logout(state, &h).await?.to_str()?)),
        _ => Err("Unknown Senate contract".into()),
    }
}

async fn army_contract(
    state: &corvus_server::AppState,
    row: &Value,
) -> Result<Value, corvus_server::Error> {
    use corvus_server::army::store::Army;
    let army = Army::with_now(state, row["now"].as_i64().ok_or("fixture time")?)?;
    let uid = row["uid"].as_str().unwrap_or("");
    let body = &row["body"];
    let value = row["value"].as_str().unwrap_or("");
    let ip = row["ip"].as_str().unwrap_or("fixture-ip-hash");
    if row["action"] == "jobs" {
        return corvus_server::army::jobs::Jobs {
            army: &army,
            fixture: row["fixture"].as_str(),
        }
        .bounded(
            row["dry"] == true,
            std::time::Duration::from_millis(row["budget"].as_u64().unwrap_or(50_000)),
        )
        .await;
    }
    if row["action"] == "service" {
        use corvus_server::army::service::Service;
        let service = Service::new(
            &army,
            row["fixture"].as_str(),
            row["bits"].as_u64().unwrap_or(16) as u32,
        )?;
        let mut request = axum::http::HeaderMap::new();
        for (key, value) in row["headers"].as_object().into_iter().flatten() {
            request.insert(
                axum::http::HeaderName::from_bytes(key.as_bytes())?,
                value.as_str().ok_or("header")?.parse()?,
            );
        }
        let mut response = axum::http::HeaderMap::new();
        let result = match row["method"].as_str().unwrap_or("") {
            "identity" => {
                service
                    .identity(&request, &mut response, row["create"] == true)
                    .await?
            }
            "self" => {
                service
                    .own_profile(&army.user(uid).await?, row["logged"] == true)
                    .await?
            }
            "challenge" => service.challenge(&request, &mut response, value).await?,
            "proof" => service.verify_proof(&request, body).await?,
            "submit" => service.submit(&request, body).await?,
            "claim" => service.claim(&request, &mut response, value).await?,
            "admin" => service.admin(value, uid, body).await?,
            "admin-list" => service.admin_list(body).await?,
            "origin" => json!(corvus_server::army::security::same_origin(
                &state.settings,
                &request
            )),
            _ => return Err("unknown service fixture".into()),
        };
        return Ok(
            json!({"body":result,"cookies":response.get_all("set-cookie").iter().filter_map(|v|v.to_str().ok()).collect::<Vec<_>>()}),
        );
    }
    match row["action"].as_str().unwrap_or("") {
        "create" => {
            army.create(&body["country"], body["existingBrowser"] == true)
                .await
        }
        "user" => army.user(uid).await,
        "all" => Ok(json!(army.all().await?)),
        "public-build" => corvus_server::army::public::Public(&army).build().await,
        "public-summary" => corvus_server::army::public::Public(&army).summary().await,
        "public-legion" => corvus_server::army::public::Public(&army).legion().await,
        "art" => Ok(json!(corvus_core::army_art::tag(
            body,
            value,
            row["poster"] == true,
            &row["labels"]
        )?)),
        "insignia" => Ok(json!(corvus_core::army_art::insignia(
            value,
            row["size"].as_u64().unwrap_or(40) as u32
        ))),
        "art-png" => {
            use base64::Engine;
            Ok(json!(base64::engine::general_purpose::STANDARD.encode(
                corvus_server::army::images::png(body, value, row["poster"] == true)?
            )))
        }
        "profile-html" => Ok(json!(corvus_server::army::images::profile(body))),
        "persist" => army.persist(body).await,
        "persist-guarded" => {
            army.persist_guarded(
                body,
                Some((
                    row["snapshot"].as_str().ok_or("snapshot")?,
                    "entitlements",
                    value,
                )),
            )
            .await
        }
        "by-code" => army.by_code(value).await,
        "by-email" => army.by_email(value).await,
        "by-name" => army.by_name(value).await,
        "enlist" => army.enroll(uid, body, true).await,
        "register" => army.enroll(uid, body, false).await,
        "attach-email" => {
            army.attach_email(uid, value, row["lang"].as_str().unwrap_or("en"))
                .await
        }
        "verify" => army.verify(uid).await,
        "own" => {
            army.own(uid, value, body, row["seconds"].as_i64().unwrap_or(60))
                .await
        }
        "rate" => Ok(json!(
            army.rate(
                value,
                ip,
                row["max"].as_i64().unwrap_or(3),
                row["seconds"].as_i64().unwrap_or(60)
            )
            .await?
        )),
        "remember" => Ok(json!(army.remember_referral(uid, value, ip).await?)),
        "qualify" => Ok(json!(army.qualify(uid, ip).await?)),
        "complete" => army.complete(uid, body, ip).await,
        "help" => army.approve_help(uid, body).await,
        "feather" => army.feather(uid, &row["value"]).await,
        "remove" => Ok(json!(army.remove(uid).await?)),
        "export" => army.export_data(uid).await,
        "cleanup" => Ok(json!(army.cleanup().await?)),
        "seen" => {
            army.seen(uid, ip).await?;
            Ok(Value::Null)
        }
        "pidgy" => army.pidgy_trial(body).await,
        "payment-normalize" => {
            corvus_server::army::payments::Payments(&army)
                .normalize(body)
                .await
        }
        "payment-accept" => {
            corvus_server::army::payments::Payments(&army)
                .accept(body)
                .await
        }
        "payment-process" => {
            corvus_server::army::payments::Payments(&army)
                .process(value)
                .await
        }
        "payment-link" => {
            corvus_server::army::payments::Payments(&army)
                .link(value, body)
                .await
        }
        "payment-drain" => corvus_server::army::payments::Payments(&army).drain().await,
        "payment-unmatched" => {
            corvus_server::army::payments::Payments(&army)
                .unmatched()
                .await
        }
        action if action.starts_with("mail-") => {
            let mail = corvus_server::army::mail::Mail::new(&army, row["fixture"].as_str())?;
            match action {
                "mail-quota" => mail.quota().await,
                "mail-compose" => mail.compose(body, &row["user"], row["dry"] == true).await,
                "mail-flush" => mail.flush(row["dry"] == true, row["only"].as_str()).await,
                _ => Err("mail fixture".into()),
            }
        }
        action if action.starts_with("discord-") => {
            let discord =
                corvus_server::army::discord::Discord::new(&army, row["fixture"].as_str())?;
            match action {
                "discord-config" => discord.configuration().await,
                "discord-invite" => Ok(json!(discord.invite(body, row["dry"] == true).await?)),
                "discord-issue" => discord.issue(body).await,
                "discord-sync" => discord.sync(body).await,
                "discord-claim" => {
                    discord
                        .claim(
                            value,
                            row["id"].as_str().unwrap_or(""),
                            row["guild"].as_str().unwrap_or(""),
                        )
                        .await
                }
                "discord-audit" => discord.audit().await,
                "discord-refresh" => discord.refresh(body.as_array().ok_or("users")?).await,
                "discord-respond" => Ok(json!(discord.respond(body).await?)),
                "discord-complete" => {
                    discord.complete(body).await?;
                    Ok(Value::Null)
                }
                _ => Err("discord fixture".into()),
            }
        }
        "issue" => {
            corvus_server::army::auth::Auth(&army)
                .issue(uid, value)
                .await
        }
        "queue" => Ok(json!(
            corvus_server::army::auth::Auth(&army)
                .queue(
                    uid,
                    value,
                    body,
                    row["seconds"].as_i64().unwrap_or(172800),
                    row["job"].as_str()
                )
                .await?
        )),
        "consume" => {
            let mut headers = axum::http::HeaderMap::new();
            let body = corvus_server::army::auth::Auth(&army)
                .consume(value, &mut headers)
                .await?;
            Ok(
                json!({"body":body,"cookies":headers.get_all("set-cookie").iter().map(|s|s.to_str().unwrap_or("")).collect::<Vec<_>>()}),
            )
        }
        "session" => {
            let mut headers = axum::http::HeaderMap::new();
            headers.insert("cookie", value.parse()?);
            army.session(&headers).await
        }
        "unsubscribe-token" => Ok(json!(
            corvus_server::army::auth::Auth(&army)
                .unsubscribe_token(uid, value)
                .await?
        )),
        "unsubscribe" => Ok(json!(
            corvus_server::army::auth::Auth(&army)
                .unsubscribe(value)
                .await?
        )),
        _ => Err("unknown Army fixture".into()),
    }
}
