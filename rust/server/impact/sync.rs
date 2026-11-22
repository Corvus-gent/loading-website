//! One shared writer, bounded below the lock lifetime; old metrics survive provider outages.
use super::{
    providers::Provider,
    store::{Impact, SaveOptions},
};
use crate::{
    AppState, Error,
    compound_v2::{model, store::Registry},
};
use corvus_core::{army::truthy, impact};
use serde_json::{Value, json};
use std::time::Duration;

pub async fn run(
    state: &AppState,
    force: bool,
    platform: Option<&str>,
    fixture: Option<&str>,
) -> Result<Value, Error> {
    run_bounded(state, force, platform, fixture, Duration::from_secs(45)).await
}
pub async fn run_bounded(
    state: &AppState,
    force: bool,
    platform: Option<&str>,
    fixture: Option<&str>,
    budget: Duration,
) -> Result<Value, Error> {
    let platform = platform.filter(|s| !s.is_empty());
    if platform.is_some_and(|p| impact::config()["accounts"].get(p).is_none()) {
        return Err("Unknown platform.".into());
    }
    if budget > Duration::from_secs(90) {
        return Err("Invalid refresh budget.".into());
    }
    let impact = Impact(state);
    let token = uuid::Uuid::new_v4().to_string();
    let lock = state
        .store
        .command(vec![
            "SET".into(),
            impact.key("sync-lock"),
            token.clone(),
            "NX".into(),
            "EX".into(),
            "120".into(),
        ])
        .await?;
    if !truthy(&lock) {
        return Ok(json!({"busy":true}));
    }
    let outcome = tokio::time::timeout(budget, refresh(state, force, platform, fixture))
        .await
        .map_err(|_| -> Error {
            "The refresh reached its time limit. Saved observations are kept; retry to continue."
                .into()
        })
        .and_then(|v| v);
    Registry(state).eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",&[impact.key("sync-lock")],&[token]).await?;
    outcome
}
async fn refresh(
    state: &AppState,
    force: bool,
    platform: Option<&str>,
    fixture: Option<&str>,
) -> Result<Value, Error> {
    let store = Impact(state);
    let old = state.store.get(&store.key("sync-status")).await?;
    let now = chrono::Utc::now().timestamp_millis();
    if !force && let Some(s) = old.as_str() {
        let mut previous: Value = serde_json::from_str(s)?;
        if impact::timestamp(&previous["at"]).is_some_and(|t| now - t < 1790000) {
            previous["cached"] = json!(true);
            return Ok(previous);
        }
    }
    let registry = Registry(state).videos().await?;
    let all = store.records(Some(&registry)).await?;
    let settings = store.settings().await?;
    let mut status = json!({"at":model::now(),"platforms":{},"updated":0});
    let provider = Provider::new(state, fixture, now)?;
    for p in ["tt", "ig", "x", "li", "tw", "yt"] {
        if platform.is_some_and(|wanted| wanted != p) {
            continue;
        }
        let mut accounts = impact::configured_accounts()
            .into_iter()
            .filter(|a| a["platform"] == p)
            .map(|a| model::text(&a["account"]).to_string())
            .collect::<Vec<_>>();
        if p == "yt" {
            for row in all.iter().filter(|r| r["platform"] == "yt") {
                let a = model::text(&row["account"]);
                if !accounts.iter().any(|v| v == a) {
                    accounts.push(a.into());
                }
            }
        }
        for account in accounts {
            let account_rows = all
                .iter()
                .filter(|r| {
                    r["platform"] == p
                        && impact::normalized_handle(&r["account"])
                            == impact::normalized_handle(&json!(account))
                })
                .cloned()
                .collect::<Vec<_>>();
            let now = chrono::Utc::now().timestamp_millis();
            let cadence = |r: &Value| now / impact::refresh_ms(r, now);
            let mut rows = Vec::new();
            let backoff = store.key(&format!("provider-backoff:{p}:{account}"));
            if model::count(
                &state
                    .store
                    .command(vec!["EXISTS".into(), backoff.clone()])
                    .await?,
            ) > 0
            {
                continue;
            }
            for row in &account_rows {
                if force
                    || model::text(
                        &state
                            .store
                            .command(vec![
                                "HGET".into(),
                                store.key(&format!("refresh:{p}")),
                                model::text(&row["id"]).into(),
                            ])
                            .await?,
                    ) != cadence(row).to_string()
                {
                    rows.push(row.clone());
                }
            }
            if !account_rows.is_empty() && rows.is_empty() && !["tt", "ig", "tw"].contains(&p) {
                continue;
            }
            let result = provider
                .run(
                    p,
                    &rows,
                    &account_rows,
                    &account,
                    truthy(&settings["include_twitch_archives"]),
                )
                .await;
            let mut backoff_seconds = None;
            let result = match result {
                Ok(result) => {
                    let apply = async {
                        let mut updated = 0;
                        for entry in super::providers::list(&result, "updates") {
                            let row = &entry["row"];
                            let mut input = json!({"post_url":row["post_url"]});
                            super::providers::merge(&mut input, &entry["patch"]);
                            if truthy(
                                &store
                                    .save(
                                        &input,
                                        SaveOptions {
                                            source: result["mode"].as_str(),
                                            registry: Some(&registry),
                                            expected: Some(row),
                                            ..Default::default()
                                        },
                                    )
                                    .await?,
                            ) {
                                updated += 1;
                            }
                        }
                        for post in super::providers::list(&result, "posts") {
                            if let Some(existing) = account_rows
                                .iter()
                                .find(|r| r["post_url"] == post["post_url"])
                                && !rows.iter().any(|r| r["id"] == existing["id"])
                            {
                                continue;
                            }
                            if truthy(
                                &store
                                    .save(
                                        post,
                                        SaveOptions {
                                            source: result["mode"].as_str(),
                                            registry: Some(&registry),
                                            ..Default::default()
                                        },
                                    )
                                    .await?,
                            ) {
                                updated += 1;
                            }
                        }
                        for row in &rows {
                            state
                                .store
                                .command(vec![
                                    "HSET".into(),
                                    store.key(&format!("refresh:{p}")),
                                    model::text(&row["id"]).into(),
                                    cadence(row).to_string(),
                                ])
                                .await?;
                        }
                        Ok::<i64, Error>(updated)
                    }
                    .await;
                    match apply {
                        Ok(updated) => {
                            status["updated"] = json!(model::count(&status["updated"]) + updated);
                            json!({"mode":result["mode"],"updated":updated,"found":super::providers::list(&result,"posts").len()+super::providers::list(&result,"updates").len(),"note":result["note"],"error":if truthy(&result["error"]){result["error"].clone()}else{Value::Null}})
                        }
                        Err(e) => {
                            let message = e.to_string();
                            if message.contains("429") {
                                backoff_seconds = Some(3600);
                            }
                            json!({"mode":"error","error":message.chars().take(400).collect::<String>(),"found":0,"note":"Existing posts and metrics kept."})
                        }
                    }
                }
                Err(e) => {
                    if e.status == 429 || e.message.contains("429") {
                        backoff_seconds = Some((e.retry_after.ceil() as i64).clamp(3600, 86400));
                    }
                    json!({"mode":"error","error":e.message.chars().take(400).collect::<String>(),"found":0,"note":"Existing posts and metrics kept."})
                }
            };
            if let Some(seconds) = backoff_seconds {
                state
                    .store
                    .command(vec![
                        "SET".into(),
                        backoff,
                        "1".into(),
                        "EX".into(),
                        seconds.to_string(),
                    ])
                    .await?;
            }
            if ["tt", "ig"].contains(&p) {
                let account_key = format!("{p}:{account}");
                state
                    .store
                    .command(vec![
                        "SADD".into(),
                        store.key("browser-queue"),
                        account_key.clone(),
                    ])
                    .await?;
                let previous = state
                    .store
                    .command(vec![
                        "HGET".into(),
                        store.key("account-sync"),
                        account_key.clone(),
                    ])
                    .await?;
                if let Some(v) = previous.as_str() {
                    let mut prior: Value = serde_json::from_str(v)?;
                    prior["provider_error"] = result["error"].clone();
                    prior["queued_at"] = status["at"].clone();
                    state
                        .store
                        .command(vec![
                            "HSET".into(),
                            store.key("account-sync"),
                            account_key,
                            prior.to_string(),
                        ])
                        .await?;
                } else {
                    let mut queued = result.clone();
                    queued["mode"] = json!("queued");
                    queued["provider_error"] = result["error"].clone();
                    queued["note"] = json!(
                        "Public-profile browser check queued; no posts have been declared missing."
                    );
                    queued["queued_at"] = status["at"].clone();
                    store.save_status(p, &account, &queued).await?;
                }
            } else {
                store.save_status(p, &account, &result).await?;
            }
            status["platforms"][p] = json!({"mode":result["mode"],"note":if truthy(&result["note"]){result["note"].clone()}else{result["error"].clone()},"updated":model::count(&status["platforms"][p]["updated"])+model::count(&result["updated"])});
        }
    }
    status["completed_at"] = json!(model::now());
    status["next_at"] = json!(
        (chrono::Utc::now() + chrono::Duration::hours(1))
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
    );
    store.snapshot().await?;
    state
        .store
        .command(vec![
            "SET".into(),
            store.key("sync-status"),
            status.to_string(),
        ])
        .await?;
    Ok(status)
}
