//! Bounded, retry-safe scheduled work. Never outlive the shared job lease.
use super::{
    auth::Auth,
    discord::Discord,
    mail::Mail,
    model,
    payments::Payments,
    security,
    store::{Army, DAY},
};
use crate::Error;
use chrono::{Datelike, Timelike};
use corvus_core::army::{active_tier, truthy};
use serde_json::{Value, json};
use std::time::Duration;
pub struct Jobs<'a, 's> {
    pub army: &'a Army<'s>,
    pub fixture: Option<&'a str>,
}
impl Jobs<'_, '_> {
    pub async fn run(&self, dry: bool) -> Result<Value, Error> {
        Box::pin(self.bounded(dry, Duration::from_secs(50))).await
    }
    pub async fn bounded(&self, dry: bool, budget: Duration) -> Result<Value, Error> {
        Box::pin(self.army.locked_for("jobs", 60, async {
            match Box::pin(tokio::time::timeout(
                budget.min(Duration::from_secs(50)),
                self.inner(dry),
            ))
            .await
            {
                Ok(result) => result,
                Err(_) => Ok(json!({"dryRun":dry,"state":"retry","reason":"deadline"})),
            }
        }))
        .await
    }
    async fn inner(&self, dry: bool) -> Result<Value, Error> {
        let now = self.army.now();
        let day = model::day_key(now)?;
        let hour = chrono::DateTime::from_timestamp_millis(now)
            .ok_or("time")?
            .with_timezone(&chrono_tz::Europe::Brussels)
            .hour();
        let users = self.army.all().await?;
        let mut queued = 0;
        if !dry {
            for user in &users {
                if active_tier(user, now).is_some()
                    && corvus_core::impact::timestamp(&user["expires"])
                        .is_some_and(|n| n < now + 30 * DAY * 1000)
                {
                    let uid = user["id"].as_str().ok_or("session")?;
                    Box::pin(self.army.locked(uid, async {
                        let mut current = self.army.user(uid).await?;
                        if !current.is_null()
                            && current["status"] != "deleting"
                            && active_tier(&current, now).is_some()
                        {
                            current["expires"] = json!(model::iso(now + 365 * DAY * 1000)?);
                            self.army.persist(&current).await?;
                        }
                        Ok(())
                    }))
                    .await?;
                }
            }
        }
        if hour >= 8 {
            let date = chrono::NaiveDate::parse_from_str(&day, "%Y-%m-%d")?;
            let start = chrono::NaiveDate::from_ymd_opt(2026, 11, 4).ok_or("time")?;
            let number = (date - start).num_days().saturating_add(1).max(1);
            let kind = [
                "babel", "borders", "wordle", "flags", "combo", "bangle", "pingle", "lantern",
            ][((number - 1) % 8) as usize];
            for user in users.iter().filter(|u| {
                truthy(&u["verifiedAt"]) && truthy(&u["email"]) && u["status"] != "deleting"
            }) {
                for frequency in if date.weekday() == chrono::Weekday::Sun {
                    &["daily", "weekly"][..]
                } else {
                    &["daily"][..]
                } {
                    let uid = user["id"].as_str().ok_or("session")?;
                    let sub = self.army.get(&format!("sub:{uid}:{frequency}")).await?;
                    if !truthy(&sub["confirmed"]) || sub["lastSent"] == day {
                        continue;
                    }
                    let id = security::digest(
                        &self.army.state.settings,
                        &format!("reminder:{uid}:{frequency}:{day}"),
                    )?[..24]
                        .to_string();
                    if !self.army.get(&format!("mail:{id}")).await?.is_null() {
                        continue;
                    }
                    if !dry {
                        Auth(self.army).queue(uid,frequency,&json!({"day":day,"number":number,"type":kind,"winner":"the legion","song":"https://corvus.gent/music/"}),2*DAY,Some(&id)).await?;
                    }
                    queued += 1;
                }
            }
        }
        let payments = if dry {
            json!({"processed":0})
        } else {
            Box::pin(Payments(self.army).drain()).await?
        };
        // Payments may change entitlement/rank after the reminder scan.
        let users = if dry { users } else { self.army.all().await? };
        // Provider phases have separate deadlines so one outage cannot starve all maintenance.
        let discord = if dry {
            json!({"state":"dry_run"})
        } else {
            tokio::time::timeout(
                Duration::from_secs(12),
                Discord::new(self.army, self.fixture)?.refresh(&users),
            )
            .await
            .ok()
            .and_then(Result::ok)
            .unwrap_or(json!({"state":"retry"}))
        };
        let delivery = Box::pin(tokio::time::timeout(
            Duration::from_secs(25),
            Mail::new(self.army, self.fixture)?.flush(dry, None),
        ))
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or(json!({"state":"retry","sent":0}));
        let removed = if dry {
            0
        } else {
            Box::pin(self.army.cleanup()).await?
        };
        if !dry {
            self.army
                .run(&[
                    "SET",
                    &self.army.key("job-last"),
                    &self.army.timestamp()?,
                    "EX",
                    &(7 * DAY).to_string(),
                ])
                .await?;
        }
        Ok(
            json!({"dryRun":dry,"queued":queued,"payments":payments,"discord":discord,"delivery":delivery,"removed":removed}),
        )
    }
}
