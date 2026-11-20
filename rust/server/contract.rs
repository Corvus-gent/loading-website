use serde_json::{Value, json};
use std::io::{self, BufRead};

#[tokio::main]
async fn main() -> Result<(), corvus_server::Error> {
    for line in io::stdin().lock().lines() {
        let row: Value = serde_json::from_str(&line?)?;
        let value = row["value"].as_str().unwrap_or("");
        let result = match row["operation"].as_str() {
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
