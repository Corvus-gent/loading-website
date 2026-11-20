use super::security;
use crate::{AppState, Error, compound::store::command};
use serde_json::json;
pub async fn send(
    state: &AppState,
    to: &str,
    subject: &str,
    text: &str,
    id: &str,
) -> Result<bool, Error> {
    // Provider writes share the datastore's explicit environment boundary.
    if !state.settings.write_enabled() {
        return Err("mail is disabled in read-only migration mode".into());
    }
    if state.settings.get("LEGION_TEST_MAIL") == Some("1")
        && state.settings.get("CORVUS_RUST_WRITES") == Some("isolated")
    {
        return Ok(true);
    }
    let Some(key) = state.settings.get("RESEND_API_KEY") else {
        return Ok(false);
    };
    let day = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let count=state.store.command(command(&["EVAL","local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],86400) end;return n","1",&security::key(&state.settings,&format!("mail:{day}"))])).await?;
    if count.as_i64().is_none_or(|n| n > 80) {
        return Ok(false);
    }
    let result = state
        .http
        .post("https://api.resend.com/emails")
        .timeout(std::time::Duration::from_secs(7))
        .bearer_auth(key)
        .header("Idempotency-Key", format!("legion-{id}"))
        .json(&json!({"from":"Corvus <crow@corvus.gent>","to":[to],"subject":subject,"text":text}))
        .send()
        .await;
    Ok(result.is_ok_and(|r| r.status().is_success()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn read_only_mode_denies_email_before_io() -> Result<(), Error> {
        let settings = std::sync::Arc::new(crate::config::Settings::new(
            [("RESEND_API_KEY".into(), "fixture-unused".into())].into(),
        ));
        let http = reqwest::Client::new();
        let state = AppState {
            settings: settings.clone(),
            store: crate::store::Store::new(settings, http.clone()),
            http,
            live: crate::live::LiveService::new()?,
            compound_summary: Default::default(),
        };
        assert!(
            send(
                &state,
                "nobody@example.test",
                "fixture",
                "fixture",
                "fixture"
            )
            .await
            .is_err()
        );
        Ok(())
    }
}
