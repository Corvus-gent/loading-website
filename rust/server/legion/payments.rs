//! The Legion's existing one-dollar checkout and raw Stripe webhook contract.
use super::{model, security, store::Legion};
use crate::{AppState, Error, army::model as identity, config::Settings, crypto};
use corvus_core::army::truthy;
use serde_json::{Value, json};
use url::Url;
pub fn mode(env: &Settings) -> &str {
    env.get("LEGION_STRIPE_MODE")
        .unwrap_or(if env.production() { "LIVE" } else { "TEST" })
}
pub fn ready(env: &Settings) -> bool {
    env.get(&format!("LEGION_PAYMENT_LINK_{}", mode(env)))
        .is_some()
}
pub async fn checkout(state: &AppState, b: &Value) -> Result<Value, Error> {
    let email = identity::email(&b["email"])?;
    let name = model::clean(&b["handle"], 40);
    let link = state
        .settings
        .get(&format!("LEGION_PAYMENT_LINK_{}", mode(&state.settings)))
        .ok_or("payment_unavailable")?;
    if !name.is_empty() && !identity::valid_username(&identity::username(&json!(name))) {
        return Err("handle".into());
    }
    let mut url = Url::parse(link).map_err(|_| "payment_unavailable")?;
    if url.scheme() != "https" || url.host_str() != Some("buy.stripe.com") {
        return Err("payment_unavailable".into());
    }
    let raw = format!("legion_{}", security::token());
    Legion(state)
        .put(
            &format!("checkout:{}", crypto::sha(&raw)),
            &json!({"email":email,"name":name,"created_at":crate::compound_v2::model::now()}),
            Some(7 * 86400),
        )
        .await?;
    // URLSearchParams.set keeps the first occurrence's position and removes duplicates.
    for (key, value) in [
        ("client_reference_id", raw.as_str()),
        ("prefilled_email", email.as_str()),
    ] {
        let mut found = false;
        let mut pairs: Vec<(String, String)> = url.query_pairs().into_owned().collect();
        pairs.retain_mut(|(k, v)| {
            if k != key {
                return true;
            }
            if found {
                return false;
            }
            found = true;
            *v = value.into();
            true
        });
        if !found {
            pairs.push((key.into(), value.into()));
        }
        url.set_query(None);
        url.query_pairs_mut().extend_pairs(pairs);
    }
    Ok(json!({"url":url.as_str()}))
}
pub async fn process(state: &AppState, event: &Value) -> Result<Value, Error> {
    let s = &event["data"]["object"];
    let mode = mode(&state.settings);
    let expected = state
        .settings
        .get(&format!("LEGION_PAYMENT_LINK_ID_{mode}"));
    let id = model::text(s, "id");
    let valid_id = id.strip_prefix("cs_").is_some_and(|v| {
        let v = v
            .strip_prefix("test_")
            .or_else(|| v.strip_prefix("live_"))
            .unwrap_or(v);
        !v.is_empty() && v.bytes().all(|c| c.is_ascii_alphanumeric())
    });
    if event["livemode"] != json!(mode == "LIVE")
        || ![
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
        ]
        .contains(&model::text(event, "type"))
        || s["payment_status"] != "paid"
        || s["amount_total"].as_f64() != Some(100.)
        || s["currency"] != "usd"
        || !expected.is_some_and(|id| s["payment_link"] == id)
        || !truthy(&s["payment_intent"])
        || !valid_id
    {
        return Ok(json!({"ignored":true}));
    }
    let legion = Legion(state);
    let pending = legion
        .get(&format!(
            "checkout:{}",
            crypto::sha(model::text(s, "client_reference_id"))
        ))
        .await?;
    if pending.is_null() {
        return Ok(json!({"ignored":true}));
    }
    let result=legion.admit(&json!({"email":pending["email"],"handle":pending["name"],"name":pending["name"],"rank":"tiro","source":"paid","receipt":s["payment_intent"]})).await?;
    let name = result["user"]["legion"]["name"]
        .as_str()
        .filter(|s| !s.is_empty())
        .unwrap_or("soldier");
    legion
        .put(
            &format!("paid-session:{}", crypto::sha(id)),
            &json!({"ok":true,"rank":"tiro","name":name}),
            Some(7 * 86400),
        )
        .await?;
    Ok(json!({"ok":true,"duplicate":result["duplicate"]==true}))
}
pub fn verified_event(
    payload: &[u8],
    header: &str,
    env: &Settings,
    now: i64,
) -> Result<Value, Error> {
    let secret = env
        .get(&format!("LEGION_STRIPE_WEBHOOK_SECRET_{}", mode(env)))
        .ok_or("unavailable")?;
    crate::compound::payments::verify_signature(payload, header, secret, now)
}
