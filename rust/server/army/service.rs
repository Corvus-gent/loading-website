//! Army application service, preserving the email proof and public/private projections.
use super::{
    auth::Auth,
    mail::Mail,
    model,
    payments::Payments,
    security,
    store::{Army, DAY},
};
use crate::{Error, voter};
use axum::http::{HeaderMap, header::SET_COOKIE};
use corvus_core::army::{active_tier, public_soldier, rank, truthy};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
pub struct Service<'a, 's> {
    pub store: &'a Army<'s>,
    pub mail: Mail<'a, 's>,
    bits: u32,
}
fn text(v: &Value) -> &str {
    v.as_str().unwrap_or("")
}
impl<'a, 's> Service<'a, 's> {
    pub fn new(store: &'a Army<'s>, fixture: Option<&str>, bits: u32) -> Result<Self, Error> {
        if bits > 256 {
            return Err("configuration".into());
        }
        Ok(Self {
            store,
            mail: Mail::new(store, fixture)?,
            bits,
        })
    }
    pub async fn limit(
        &self,
        h: &HeaderMap,
        scope: &str,
        max: i64,
        seconds: i64,
    ) -> Result<(), Error> {
        let hash = security::rate_hash(&self.store.state.settings, h, scope, self.store.now())?;
        if !self.store.rate(scope, &hash, max, seconds).await? {
            return Err("rate".into());
        }
        Ok(())
    }
    pub async fn identity(
        &self,
        h: &HeaderMap,
        response: &mut HeaderMap,
        create: bool,
    ) -> Result<Value, Error> {
        let logged = self.store.session(h).await?;
        if !logged.is_null() {
            return Ok(logged);
        }
        let env = &self.store.state.settings;
        let uid = security::read_cookie(env, h, "army_id", "army_id")?.unwrap_or_default();
        let mut user = self.store.user(&uid).await?;
        let vid = voter::read_music(env, voter::cookies(h))?;
        if user.is_null()
            && let Some(vid) = &vid
        {
            let owner = self
                .store
                .get(&format!("game-owner:{}", security::digest(env, vid)?))
                .await?;
            user = self.store.user(text(&owner)).await?;
        }
        if user.is_null() && create {
            self.limit(h, "begin", 30, 600).await?;
            let old = if let Some(vid) = &vid {
                self.store
                    .run(&["GET", &format!("game:streak:{vid}")])
                    .await?
            } else {
                Value::Null
            };
            user = self.store.create(&Value::Null, truthy(&old)).await?;
            if let Some(raw) = old.as_str()
                && let Ok(old) = serde_json::from_str::<Value>(raw)
            {
                let streak = crate::compound_v2::model::number(&old["streak"])
                    .unwrap_or(0.)
                    .max(0.);
                user["streak"] = json!(streak);
                user["best"] = json!(streak);
                self.store.persist(&user).await?;
            }
        }
        if !user.is_null() && create {
            let uid = text(&user["id"]);
            response.append(
                SET_COOKIE,
                security::cookie(env, "army_id", uid, 90 * DAY, "army_id")?,
            );
            let ip = security::rate_hash(env, h, "referral", self.store.now())?;
            self.store.seen(uid, &ip).await?;
            if let Some(vid) = vid {
                self.store
                    .own(
                        uid,
                        &format!("game-owner:{}", security::digest(env, &vid)?),
                        &json!(uid),
                        365 * DAY,
                    )
                    .await?;
            }
            if let Some(code) = security::read_cookie(env, h, "army_ref", "army_ref")?
                .filter(|s| security::valid_code(s))
            {
                Box::pin(self.store.remember_referral(uid, &code, &ip)).await?;
            }
        }
        Ok(user)
    }
    pub async fn own_profile(&self, user: &Value, logged: bool) -> Result<Value, Error> {
        if user.is_null() {
            return Ok(Value::Null);
        }
        let uid = text(&user["id"]);
        let mut result = public_soldier(user, true, self.store.now());
        let daily = self.store.get(&format!("sub:{uid}:daily")).await?;
        let weekly = self.store.get(&format!("sub:{uid}:weekly")).await?;
        let referrer = if truthy(&user["referral"]) {
            self.store.by_code(text(&user["referral"]["code"])).await?
        } else {
            Value::Null
        };
        for (key,value) in json!({"username":if truthy(&user["username"]){user["username"].clone()}else{Value::Null},"code":user["code"],"status":user["status"],"verified":truthy(&user["verifiedAt"]),"paid":truthy(&user["paid"]),"canManage":logged,"featherSpots":user["feathers"],"discordReady":self.store.state.settings.get("DISCORD_BOT_TOKEN").is_some()&&user["status"]=="approved","subscriptions":{"daily":truthy(&daily["confirmed"]),"weekly":truthy(&weekly["confirmed"])},"referrer":if truthy(&referrer["verifiedAt"])&&truthy(&referrer["username"]){referrer["username"].clone()}else{Value::Null}}).as_object().ok_or("fields")? { result[key] = value.clone(); }
        if logged {
            result["email"] = json!(text(&user["email"]));
            result["why"] = json!(text(&user["why"]));
            result["expires"] = user["expires"].clone();
            result["pidgyCode"] = if truthy(&user["verifiedAt"]) && truthy(&user["username"]) {
                json!(format!("corvus-{}", text(&user["username"])))
            } else {
                Value::Null
            };
            result["pidgyTrials"] = json!(
                crate::compound_v2::model::number(&user["pidgyTrials"])
                    .unwrap_or(0.)
                    .max(0.)
            );
        }
        Ok(result)
    }
    pub async fn challenge(
        &self,
        h: &HeaderMap,
        response: &mut HeaderMap,
        action: &str,
    ) -> Result<Value, Error> {
        if !["enlist", "register", "login", "subscribe", "feather"].contains(&action) {
            return Err("action".into());
        }
        let user = Box::pin(self.identity(h, response, true)).await?;
        self.limit(h, "challenge", 30, 600).await?;
        let id = security::id();
        let challenge = json!({"id":id,"salt":hex::encode(rand::random::<[u8;20]>()),"bits":self.bits,"notBefore":self.store.now()+3000});
        let mut saved = challenge.clone();
        saved["uid"] = user["id"].clone();
        saved["action"] = json!(action);
        self.store
            .own(text(&user["id"]), &format!("challenge:{id}"), &saved, 300)
            .await?;
        Ok(
            json!({"challenge":challenge,"self":self.own_profile(&user,!self.store.session(h).await?.is_null()).await?}),
        )
    }
    pub async fn verify_proof(&self, h: &HeaderMap, body: &Value) -> Result<Value, Error> {
        let user = Box::pin(self.identity(h, &mut HeaderMap::new(), false)).await?;
        let nonce = body["nonce"]
            .as_f64()
            .filter(|n| n.is_finite() && n.fract() == 0. && *n >= 0. && *n <= 9007199254740991.)
            .ok_or("verification")? as u64;
        let id = text(&body["challenge"]);
        if user.is_null() || !security::valid_id(id) {
            return Err("verification".into());
        }
        let raw = self
            .store
            .run(&["GETDEL", &self.store.key(&format!("challenge:{id}"))])
            .await?;
        let ch: Value = serde_json::from_str(raw.as_str().ok_or("verification")?)?;
        if ch["uid"] != user["id"]
            || ch["action"] != body["action"]
            || self.store.now() < ch["notBefore"].as_i64().ok_or("verification")?
            || voter::zero_bits(&Sha256::digest(format!("{}:{nonce}", text(&ch["salt"]))))
                < ch["bits"].as_u64().ok_or("verification")? as u32
        {
            return Err("verification".into());
        }
        Ok(user)
    }
    pub async fn submit(&self, h: &HeaderMap, body: &Value) -> Result<Value, Error> {
        if truthy(&body["website"]) || body.to_string().encode_utf16().count() > 5000 {
            return Err("fields".into());
        }
        let user = Box::pin(self.verify_proof(h, body)).await?;
        let action = text(&body["action"]);
        let uid = text(&user["id"]);
        self.limit(h, action, if action == "feather" { 20 } else { 5 }, 3600)
            .await?;
        if ["enlist", "register", "login", "subscribe"].contains(&action) {
            if ["enlist", "register"].contains(&action)
                && truthy(&user["verifiedAt"])
                && self.store.session(h).await?.is_null()
            {
                return Err("login".into());
            }
            let email = model::email(&body["email"])?;
            let scope = if action == "subscribe" {
                "subscription"
            } else {
                "mail"
            };
            if !self
                .store
                .rate(
                    scope,
                    &security::digest(&self.store.state.settings, &email)?,
                    3,
                    3600,
                )
                .await?
            {
                return Err("rate".into());
            }
            let auth = Auth(self.store);
            if action == "enlist" || action == "register" {
                let enlisted = Box::pin(self.store.enroll(uid, body, action == "enlist")).await?;
                let issued = auth.issue(uid, "claim").await?;
                let delivery = Box::pin(self.mail.flush(false, Some(text(&issued["job"]))))
                    .await
                    .unwrap_or(json!({"sent":0}));
                return Ok(
                    json!({"self":self.own_profile(&enlisted,false).await?,"mail":if truthy(&delivery["sent"]){"sent"}else{"queued"}}),
                );
            }
            let mut target = self.store.by_email(&email).await?;
            if action == "login" {
                if !target.is_null() {
                    let issued = auth.issue(text(&target["id"]), "claim").await?;
                    let _ = Box::pin(self.mail.flush(false, Some(text(&issued["job"])))).await;
                }
                return Ok(json!({"ok":true}));
            }
            let kind = text(&body["kind"]);
            if !["daily", "weekly"].contains(&kind) {
                return Err("fields".into());
            }
            let lang = if corvus_core::army::includes("LANGUAGES", &body["lang"]) {
                text(&body["lang"])
            } else {
                "en"
            };
            if target.is_null() {
                target = Box::pin(self.store.attach_email(uid, &email, lang)).await?;
            }
            let target_id = text(&target["id"]);
            let suffix = format!("sub:{target_id}:{kind}");
            if !truthy(&self.store.get(&suffix).await?["confirmed"]) {
                self.store.own(target_id,&suffix,&json!({"confirmed":false,"lang":lang,"created":self.store.timestamp()?,"lastSent":null}),7*DAY).await?;
                let issued = auth.issue(target_id, kind).await?;
                let _ = Box::pin(self.mail.flush(false, Some(text(&issued["job"])))).await;
            }
            return Ok(json!({"ok":true}));
        }
        if action == "feather" {
            return Ok(
                json!({"self":self.own_profile(&Box::pin(self.store.feather(uid,&body["spot"])).await?,false).await?}),
            );
        }
        Err("action".into())
    }
    pub async fn claim(
        &self,
        h: &HeaderMap,
        response: &mut HeaderMap,
        token: &str,
    ) -> Result<Value, Error> {
        self.limit(h, "claim", 20, 600).await?;
        let result = Box::pin(Auth(self.store).consume(token, response)).await?;
        let uid = text(&result["user"]["id"]);
        if result["purpose"] == "claim" && truthy(&result["user"]["applied"]) {
            self.store
                .qualify(
                    uid,
                    &security::rate_hash(
                        &self.store.state.settings,
                        h,
                        "referral",
                        self.store.now(),
                    )?,
                )
                .await?;
        }
        Ok(
            json!({"purpose":result["purpose"],"self":self.own_profile(&self.store.user(uid).await?,true).await?}),
        )
    }
    pub async fn admin(&self, action: &str, uid: &str, body: &Value) -> Result<Value, Error> {
        Box::pin(self.store.locked(uid, async {
            let mut user = self.store.user(uid).await?;
            if !truthy(&user["applied"]) {
                return Err("missing".into());
            }
            let auth = Auth(self.store);
            let welcome = security::digest(&self.store.state.settings, &format!("welcome:{uid}"))?
                [..24]
                .to_string();
            match action {
                "approve" => {
                    if !truthy(&user["verifiedAt"]) {
                        return Err("unverified".into());
                    }
                    user["status"] = json!("approved");
                    user["expires"] = json!(model::iso(self.store.now() + 365 * DAY * 1000)?);
                    self.store.persist(&user).await?;
                    if !truthy(&user["invitedAt"]) {
                        auth.queue(uid, "welcome", &json!({}), 365 * DAY, Some(&welcome))
                            .await?;
                    }
                }
                "reject" => {
                    self.store
                        .run(&["ZREM", &self.store.key("outbox"), &welcome])
                        .await?;
                    self.store
                        .run(&["DEL", &self.store.key(&format!("mail:{welcome}"))])
                        .await?;
                    user["status"] = json!("rejected");
                    user["expires"] = json!(model::iso(self.store.now() + 30 * DAY * 1000)?);
                    self.store.persist(&user).await?;
                    if body["notify"] == true {
                        auth.queue(uid, "reject", &json!({}), 2 * DAY, None).await?;
                    }
                }
                "later" => {
                    user["status"] = json!("later");
                    user["expires"] = json!(model::iso(
                        corvus_core::impact::timestamp(&user["applied"]).ok_or("missing")?
                            + 90 * DAY * 1000
                    )?);
                    self.store.persist(&user).await?;
                }
                _ => return Err("action".into()),
            }
            Ok(json!({"ok":true}))
        }))
        .await
    }
    pub async fn admin_list(&self, filters: &Value) -> Result<Value, Error> {
        let search = corvus_core::impact::trimmed(text(&filters["search"]))
            .to_lowercase()
            .chars()
            .take(100)
            .collect::<String>();
        let mut users = self
            .store
            .all()
            .await?
            .into_iter()
            .filter(|u| {
                (truthy(&u["applied"]) || truthy(&u["username"]) || truthy(&u["email"]))
                    && u["status"] != "deleting"
                    && (!truthy(&filters["status"]) || u["status"] == filters["status"])
                    && (search.is_empty()
                        || format!("{} {}", text(&u["username"]), text(&u["email"]))
                            .to_lowercase()
                            .contains(&search))
            })
            .collect::<Vec<_>>();
        let date = |u: &Value| {
            if truthy(&u["applied"]) {
                text(&u["applied"]).to_owned()
            } else {
                text(&u["created"]).to_owned()
            }
        };
        users.sort_by(|a, b| {
            date(a)
                .cmp(&date(b))
                .then_with(|| model::ascii_compare(text(&a["id"]), text(&b["id"])))
        });
        let offset = crate::compound_v2::model::number(&filters["offset"])
            .unwrap_or(0.)
            .floor()
            .max(0.)
            .min(users.len() as f64) as usize;
        let rows = users.iter().skip(offset).take(40).map(|u| { let mut row = serde_json::Map::new(); for key in ["id","username","email","link","why","status","recruits","created","expires"] { if let Some(v)=u.get(key) {row.insert(key.into(),v.clone());} }
            for (k,v) in json!({"verified":truthy(&u["verifiedAt"]),"paid":truthy(&u["paid"]),"pidgyTrials":if truthy(&u["pidgyTrials"]){u["pidgyTrials"].clone()}else{json!(0)},"applied":u["applied"],"country":u["country"],"rank":rank(u),"tier":active_tier(u,self.store.now()),"inviteSent":truthy(&u["invitedAt"])}).as_object().into_iter().flatten() {row.insert(k.clone(),v.clone());} Value::Object(row)
        }).collect::<Vec<_>>();
        Ok(
            json!({"discordAudit":self.store.get("discord:audit").await?,"total":users.len(),"offset":offset,"limit":40,"rows":rows,"mail":self.store.get("mail-status").await?,"discordReady":self.store.state.settings.get("DISCORD_BOT_TOKEN").is_some(),"unmatched":Payments(self.store).unmatched().await?}),
        )
    }
}
