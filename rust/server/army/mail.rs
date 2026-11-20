//! Existing encrypted mail queue and provider idempotency protocol.
use super::{
    auth::Auth,
    copy,
    discord::Discord,
    security,
    store::{Army, DAY},
    transport::{Reply, Transport},
};
use crate::Error;
use corvus_core::army::{active_tier, rank, truthy};
use reqwest::Method;
use serde_json::{Value, json};
use std::time::Duration;
const BASE: &str = "https://corvus.gent";
struct Job {
    id: String,
    job: Value,
    payload: Value,
}
pub struct Mail<'a, 's> {
    pub army: &'a Army<'s>,
    transport: Transport<'s>,
    fixture: Option<String>,
}
impl<'a, 's> Mail<'a, 's> {
    pub fn new(army: &'a Army<'s>, fixture: Option<&str>) -> Result<Self, Error> {
        Ok(Self {
            army,
            transport: Transport::new(army.state, fixture)?,
            fixture: fixture.map(str::to_owned),
        })
    }
    async fn request(
        &self,
        path: &str,
        method: Method,
        body: Option<&Value>,
        id: Option<&str>,
    ) -> Result<Reply, Error> {
        let token = self
            .army
            .state
            .settings
            .get("RESEND_API_KEY")
            .ok_or("mail_not_configured")?;
        let bearer = format!("Bearer {token}");
        let mut headers = vec![
            ("Authorization", bearer.as_str()),
            ("Content-Type", "application/json"),
        ];
        if let Some(id) = id {
            headers.push(("Idempotency-Key", id));
        }
        self.transport
            .request(
                &format!("https://api.resend.com{path}"),
                method,
                &headers,
                body,
            )
            .await
    }
    async fn status(&self, mut value: Value) -> Result<(), Error> {
        value["checked"] = json!(self.army.timestamp()?);
        self.army
            .run(&[
                "SET",
                &self.army.key("mail-status"),
                &value.to_string(),
                "EX",
                &(7 * DAY).to_string(),
            ])
            .await?;
        Ok(())
    }
    pub async fn quota(&self) -> Result<Value, Error> {
        let day = self.army.timestamp()?.chars().take(10).collect::<String>();
        let month = &day[..7];
        let counts = self
            .army
            .run(&[
                "MGET",
                &self.army.key(&format!("mail-count:{day}")),
                &self.army.key(&format!("mail-month:{month}")),
            ])
            .await?;
        let count = |v: &Value| crate::compound_v2::model::number(v).unwrap_or(0.);
        let conservative = (100. - count(&counts[0]))
            .min(3000. - count(&counts[1]))
            .max(0.);
        let fallback = json!({"remaining":conservative,"verified":false});
        let Ok(response) = self.request("/usage", Method::GET, None, None).await else {
            return Ok(fallback);
        };
        if !response.ok() {
            return Ok(fallback);
        }
        let Ok(body) = response.json() else {
            return Ok(fallback);
        };
        let emails = &body["emails"];
        if !truthy(&emails["daily"]) || !truthy(&emails["monthly"]) {
            return Ok(fallback);
        }
        let available = |row: &Value| {
            if row.get("limit") == Some(&Value::Null) {
                100.
            } else {
                row["limit"]
                    .as_f64()
                    .zip(row["used"].as_f64())
                    .filter(|(a, b)| a.is_finite() && b.is_finite())
                    .map(|(a, b)| (a - b).max(0.))
                    .unwrap_or(0.)
            }
        };
        Ok(
            json!({"remaining":100f64.min(available(&emails["daily"])).min(available(&emails["monthly"])),"verified":true}),
        )
    }
    pub async fn compose(&self, job: &Value, user: &Value, dry: bool) -> Result<Value, Error> {
        let lang = if corvus_core::army::includes("LANGUAGES", &user["lang"]) {
            user["lang"].as_str().unwrap_or("en")
        } else {
            "en"
        };
        let copy = copy::copy("mail", lang);
        let badges = copy::copy("army", lang);
        let mut values = job["data"]
            .as_object()
            .cloned()
            .map(Value::Object)
            .unwrap_or_else(|| json!({}));
        values["rank"] = json!(rank(user));
        values["streak"] = if truthy(&user["streak"]) {
            user["streak"].clone()
        } else {
            json!(0)
        };
        let kind = job["kind"].as_str().ok_or("mail_kind")?;
        let uid = user["id"].as_str().ok_or("session")?;
        let mut unsubscribe = None;
        if kind == "claim" || kind == "confirm" {
            let token = security::open(
                &self.army.state.settings,
                job["data"]["secret"].as_str().ok_or("cipher")?,
            )?;
            if !truthy(
                &self
                    .army
                    .get(&format!(
                        "token:{}",
                        security::digest(&self.army.state.settings, &format!("token:{token}"))?
                    ))
                    .await?,
            ) {
                return Ok(Value::Null);
            }
            values["url"] = json!(format!("{BASE}/army/access/#token={token}"));
            let labels = match lang {
                "nl" => ["dagelijkse herinneringen", "de wekelijkse drop"],
                "es" => ["recordatorios diarios", "la entrega semanal"],
                "fr" => ["les rappels quotidiens", "le rendez-vous hebdomadaire"],
                "pt" => ["lembretes diários", "a entrega semanal"],
                "de" => ["tägliche erinnerungen", "die wöchentliche lieferung"],
                "zh" => ["每日提醒", "每周来信"],
                _ => ["daily reminders", "the weekly drop"],
            };
            values["kind"] = json!(labels[usize::from(job["data"]["purpose"] == "weekly")]);
        } else if kind == "welcome" {
            if user["status"] != "approved" {
                return Ok(Value::Null);
            }
            let Some(invitation) = Discord::new(self.army, self.fixture.as_deref())?
                .invite(user, dry)
                .await?
            else {
                return Ok(Value::Null);
            };
            let Ok(url) = url::Url::parse(&invitation) else {
                return Ok(Value::Null);
            };
            if url.scheme() != "https"
                || !matches!(url.host_str(), Some("discord.gg" | "discord.com"))
            {
                return Ok(Value::Null);
            }
            values["url"] = json!(url.to_string());
        } else if kind == "daily" || kind == "weekly" {
            let suffix = format!("sub:{uid}:{kind}");
            let mut sub = self.army.get(&suffix).await?;
            if !truthy(&sub["confirmed"]) || sub["lastSent"] == job["data"]["day"] {
                return Ok(Value::Null);
            }
            if !truthy(&sub["unsubscribeSecret"]) && !dry {
                let token = Auth(self.army).unsubscribe_token(uid, kind).await?;
                sub["unsubscribeSecret"] =
                    json!(security::seal(&self.army.state.settings, &token)?);
                self.army.own(uid, &suffix, &sub, 365 * DAY).await?;
            }
            let token = if dry {
                "preview-only".to_string()
            } else {
                security::open(
                    &self.army.state.settings,
                    sub["unsubscribeSecret"].as_str().ok_or("cipher")?,
                )?
            };
            let url = format!("{BASE}/api/army?unsubscribe={token}");
            values["unsubscribe"] = json!(url);
            unsubscribe = Some(url);
            values["url"] = json!(if kind == "daily" {
                format!(
                    "{BASE}/games/?utm_source=email&utm_medium=reminder&utm_campaign=gabe-daily-{}",
                    job["data"]["type"].as_str().unwrap_or("undefined")
                )
            } else {
                format!("{BASE}/army/")
            });
        } else {
            values["url"] = json!(format!("{BASE}/army/access/"));
        }
        let (Some(subject), Some(body)) = (
            copy[format!("{kind}.subject")].as_str(),
            copy[format!("{kind}.body")].as_str(),
        ) else {
            return Ok(Value::Null);
        };
        if subject.is_empty() || body.is_empty() {
            return Ok(Value::Null);
        }
        let mut rank_lines = vec![format!(
            "{} {} · {}",
            badges["rankLabel"].as_str().unwrap_or(""),
            rank(user),
            badges["rankWhy"].as_str().unwrap_or("")
        )];
        if let Some(tier) = active_tier(user, self.army.now()).filter(|t| *t != "imperator") {
            rank_lines.push(format!(
                "{} {} · {}{}",
                badges["tierLabel"].as_str().unwrap_or(""),
                tier,
                badges["tierWhy"].as_str().unwrap_or(""),
                if ["senator", "consul"].contains(&tier) {
                    format!(" · {}", badges["supporterLifetime"].as_str().unwrap_or(""))
                } else {
                    String::new()
                }
            ));
        }
        let text = format!(
            "{}{}",
            copy::fill(body, &values)?,
            if ["claim", "welcome", "daily"].contains(&kind) {
                format!("\n\n{}", rank_lines.join("\n"))
            } else {
                String::new()
            }
        );
        let mut out = json!({"from":format!("{} <crow@corvus.gent>",if kind=="weekly"{"diogenes"}else{"the crow"}),"to":[user["email"]],"subject":subject,"text":text});
        if let Some(url) = unsubscribe {
            out["headers"] = json!({"List-Unsubscribe":format!("<{url}>"),"List-Unsubscribe-Post":"List-Unsubscribe=One-Click"});
        }
        Ok(out)
    }
    async fn finish(&self, jobs: &[Job]) -> Result<(), Error> {
        let day = self.army.timestamp()?.chars().take(10).collect::<String>();
        let month = &day[..7];
        self.army.run(&["EVAL","redis.call('INCRBY',KEYS[1],ARGV[1]);redis.call('EXPIRE',KEYS[1],34560000);redis.call('INCRBY',KEYS[2],ARGV[1]);redis.call('EXPIRE',KEYS[2],34560000);return 1","2",&self.army.key(&format!("mail-count:{day}")),&self.army.key(&format!("mail-month:{month}")),&jobs.len().to_string()]).await?;
        for row in jobs {
            let uid = row.job["uid"].as_str().ok_or("session")?;
            let mut user = self.army.user(uid).await?;
            let kind = row.job["kind"].as_str().unwrap_or("");
            if !user.is_null() && ["daily", "weekly"].contains(&kind) {
                let suffix = format!("sub:{uid}:{kind}");
                let mut sub = self.army.get(&suffix).await?;
                if !sub.is_null() {
                    sub["lastSent"] = row.job["data"]["day"].clone();
                    self.army.own(uid, &suffix, &sub, 365 * DAY).await?;
                }
            }
            if !user.is_null() && kind == "welcome" {
                user["invitedAt"] = json!(self.army.timestamp()?);
                self.army.persist(&user).await?;
            }
            self.army
                .run(&["ZREM", &self.army.key("outbox"), &row.id])
                .await?;
            self.army
                .run(&["DEL", &self.army.key(&format!("mail:{}", row.id))])
                .await?;
        }
        self.army
            .run(&[
                "DEL",
                &self.army.key("mail-batch"),
                &self.army.key("public"),
            ])
            .await?;
        Ok(())
    }
    async fn waiting(&self) -> Result<i64, Error> {
        Ok(self
            .army
            .run(&["ZCARD", &self.army.key("outbox")])
            .await?
            .as_i64()
            .ok_or("outbox")?)
    }
    pub async fn flush(&self, dry: bool, only: Option<&str>) -> Result<Value, Error> {
        // An invocation cannot retain this lease past its 60s TTL. Uncertain sends retain the same batch key.
        Box::pin(self.army.locked_for("mailer", 60, async {
            match tokio::time::timeout(Duration::from_secs(50), self.flush_inner(dry, only)).await {
                Ok(value) => value,
                Err(_) => {
                    self.status(json!({"state":"retry","waiting":self.waiting().await?}))
                        .await?;
                    Ok(json!({"sent":0,"state":"retry"}))
                }
            }
        }))
        .await
    }
    async fn flush_inner(&self, dry: bool, only: Option<&str>) -> Result<Value, Error> {
        if self.army.state.settings.get("RESEND_API_KEY").is_none() {
            self.status(json!({"state":"not_configured","waiting":self.waiting().await?}))
                .await?;
            return Ok(json!({"sent":0,"state":"not_configured"}));
        }
        let budget = self.quota().await?;
        let remaining = budget["remaining"].as_f64().unwrap_or(0.);
        if remaining == 0. {
            let waiting = self.waiting().await?;
            self.status(json!({"state":"quota","waiting":waiting,"upgradeNeeded":waiting>0,"remaining":remaining,"verified":budget["verified"]})).await?;
            return Ok(json!({"sent":0,"state":"quota","waiting":waiting}));
        }
        let mut batch = self.army.get("mail-batch").await?;
        let ids = if batch["ids"].is_array() {
            batch["ids"].clone()
        } else if let Some(only) = only {
            json!([only])
        } else {
            self.army
                .run(&["ZRANGE", &self.army.key("outbox"), "0", "99"])
                .await?
        };
        let ids = ids.as_array().ok_or("outbox")?;
        let mut jobs = vec![];
        for id in ids.iter().filter_map(Value::as_str) {
            let mut job = self.army.get(&format!("mail:{id}")).await?;
            let uid = job["uid"].as_str().unwrap_or("").to_string();
            let user = self.army.user(&uid).await?;
            if job.is_null()
                || user.is_null()
                || job["expires"]
                    .as_i64()
                    .is_some_and(|n| n <= self.army.now())
            {
                if !dry {
                    self.army
                        .run(&["ZREM", &self.army.key("outbox"), id])
                        .await?;
                }
                continue;
            }
            let kind = job["kind"].as_str().ok_or("mail_kind")?;
            if ["daily", "weekly"].contains(&kind)
                && self.army.get(&format!("sub:{uid}:{kind}")).await?.is_null()
            {
                continue;
            }
            let payload = if let Some(delivery) = job["delivery"].as_str().filter(|s| !s.is_empty())
            {
                serde_json::from_str(&security::open(&self.army.state.settings, delivery)?)?
            } else {
                self.compose(&job, &user, dry).await?
            };
            if payload.is_null() {
                continue;
            }
            if !truthy(&job["delivery"]) && !dry {
                job["delivery"] = json!(security::seal(
                    &self.army.state.settings,
                    &payload.to_string()
                )?);
                let ttl = ((job["expires"].as_i64().ok_or("expiry")? - self.army.now()) as f64
                    / 1000.)
                    .ceil()
                    .max(1.) as i64;
                self.army
                    .own(&uid, &format!("mail:{id}"), &job, ttl)
                    .await?;
            }
            jobs.push(Job {
                id: id.into(),
                job,
                payload,
            });
            if batch.is_null() && jobs.len() as f64 >= remaining.min(100.) {
                break;
            }
        }
        let job_ids = jobs.iter().map(|j| j.id.clone()).collect::<Vec<_>>();
        if !batch.is_null() && batch["ids"] != json!(job_ids) {
            if truthy(&batch["uncertain"]) {
                self.status(json!({"state":"review","waiting":jobs.len()}))
                    .await?;
                return Ok(json!({"sent":0,"state":"review"}));
            }
            batch = Value::Null;
            if !dry {
                self.army
                    .run(&["DEL", &self.army.key("mail-batch")])
                    .await?;
            }
        }
        if dry {
            return Ok(
                json!({"sent":0,"wouldSend":jobs.len(),"queued":ids.len(),"remaining":remaining,"kinds":jobs.iter().map(|j|&j.job["kind"]).collect::<Vec<_>>()}),
            );
        }
        if jobs.is_empty() {
            self.status(json!({"state":if self.army.state.settings.get("DISCORD_BOT_TOKEN").is_some(){"idle"}else{"waiting_for_discord"},"waiting":self.waiting().await?})).await?;
            return Ok(json!({"sent":0,"state":"idle"}));
        }
        if batch.is_null() {
            batch = json!({"ids":job_ids,"key":format!("army/{}",security::digest(&self.army.state.settings,&job_ids.join(":"))?),"created":self.army.now(),"uncertain":false});
        }
        if batch["created"]
            .as_i64()
            .is_some_and(|n| self.army.now() - n > 23 * 3600000)
        {
            self.status(json!({"state":"review","waiting":jobs.len()}))
                .await?;
            return Ok(json!({"sent":0,"state":"review"}));
        }
        batch["uncertain"] = json!(true);
        self.army
            .run(&[
                "SET",
                &self.army.key("mail-batch"),
                &batch.to_string(),
                "EX",
                &(2 * DAY).to_string(),
            ])
            .await?;
        let payload = json!(jobs.iter().map(|j| &j.payload).collect::<Vec<_>>());
        let response = self
            .request(
                "/emails/batch",
                Method::POST,
                Some(&payload),
                batch["key"].as_str(),
            )
            .await;
        let Ok(response) = response else {
            self.status(json!({"state":"retry","waiting":jobs.len()}))
                .await?;
            return Ok(json!({"sent":0,"state":"retry"}));
        };
        if !response.ok() {
            if response.status == 429 {
                batch["uncertain"] = json!(false);
                self.army
                    .run(&[
                        "SET",
                        &self.army.key("mail-batch"),
                        &batch.to_string(),
                        "EX",
                        &(2 * DAY).to_string(),
                    ])
                    .await?;
            }
            let state = if response.status == 429 {
                "quota"
            } else {
                "retry"
            };
            self.status(json!({"state":state,"waiting":self.waiting().await?,"providerStatus":response.status,"upgradeNeeded":response.status==429})).await?;
            return Ok(json!({"sent":0,"state":state}));
        }
        let result = response.json()?;
        if result["data"]
            .as_array()
            .is_none_or(|a| a.len() != jobs.len())
        {
            self.status(json!({"state":"review","waiting":jobs.len()}))
                .await?;
            return Ok(json!({"sent":0,"state":"review"}));
        }
        self.finish(&jobs).await?;
        let waiting = self.waiting().await?;
        self.status(json!({"state":if waiting>0{"queued"}else{"ok"},"waiting":waiting,"sent":jobs.len(),"remaining":(remaining-jobs.len() as f64).max(0.),"quotaVerified":budget["verified"]})).await?;
        Ok(json!({"sent":jobs.len(),"waiting":waiting,"state":"ok"}))
    }
}
