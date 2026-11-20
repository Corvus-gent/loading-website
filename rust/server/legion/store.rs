use super::{model, security, senate::Senate};
use crate::{
    AppState, Error,
    army::{
        model as identity, security as army_security,
        store::{Army, DAY},
    },
    compound::store::command,
    compound_v2::model::{now, number},
    crypto,
};
use axum::http::{HeaderMap, HeaderValue};
use corvus_core::army::truthy;
use serde_json::{Value, json};
pub struct Legion<'a>(pub &'a AppState);
pub struct Claim {
    pub body: Value,
    pub cookies: Vec<HeaderValue>,
}
impl Legion<'_> {
    pub fn key(&self, suffix: &str) -> String {
        security::key(&self.0.settings, suffix)
    }
    pub async fn get(&self, suffix: &str) -> Result<Value, Error> {
        Senate(self.0).get(suffix).await
    }
    pub async fn put(
        &self,
        suffix: &str,
        value: &Value,
        seconds: Option<i64>,
    ) -> Result<(), Error> {
        let mut cmd = command(&["SET", &self.key(suffix), &value.to_string()]);
        if let Some(n) = seconds {
            cmd.extend(["EX".into(), n.to_string()]);
        }
        self.0.store.command(cmd).await?;
        Ok(())
    }
    pub fn valid_rank(rank: &Value) -> bool {
        model::config()["ranks"]
            .as_array()
            .is_some_and(|r| r.contains(rank))
    }
    pub async fn members(&self) -> Result<Vec<Value>, Error> {
        Ok(Army::new(self.0)?
            .all()
            .await?
            .iter()
            .filter_map(model::member_row)
            .collect())
    }
    pub async fn create_invite(&self, b: &Value, origin: &str) -> Result<Value, Error> {
        if !Self::valid_rank(&b["rank"]) {
            return Err("rank".into());
        }
        let bounded = |v: &Value, default, high| -> Result<i64, Error> {
            let n = if v.is_null() {
                default
            } else {
                number(v).ok_or("fields")?
            };
            if !n.is_finite() || n.fract() != 0. || n < 1. || n > high {
                return Err("fields".into());
            }
            Ok(n as i64)
        };
        let max = bounded(&b["max_uses"], 1., 100.)?;
        let days = bounded(&b["days"], 30., 90.)?;
        let honorary = b["type"] == "honorary";
        if honorary && (b["rank"] != "senator" || max != 1) {
            return Err("fields".into());
        }
        let raw = security::token();
        let hash = crypto::sha(&raw);
        let created = now();
        let mut entry = json!({"id":hash,"rank":b["rank"],"name":model::clean(&b["name"],80),"note":model::clean(&b["note"],600),"max_uses":max,"uses":0,"expires_at":(chrono::Utc::now()+chrono::Duration::days(days)).to_rfc3339_opts(chrono::SecondsFormat::Millis,true),"created_at":created,"opened_at":null,"claimed_at":null,"revoked_at":null});
        let p = if honorary {
            model::reservation(b, &created)?
        } else {
            Value::Null
        };
        if honorary {
            entry["type"] = json!("honorary");
            entry["title"] = p["title"].clone();
            entry["spotlight_slug"] = p["slug"].clone();
        }
        // Reserve the spotlight and issue its invitation together: no stranded pending seat on an interrupted write.
        let result = self
            .0
            .store
            .command(command(&[
                "EVAL",
                CREATE,
                "4",
                &self.key(&format!("invite:{hash}")),
                &self.key("invites"),
                &self.key(&format!("spotlight:{}", model::text(&p, "slug"))),
                &self.key("spotlights"),
                &entry.to_string(),
                &((days + 90) * DAY).to_string(),
                &chrono::Utc::now().timestamp_millis().to_string(),
                &hash,
                if honorary { "1" } else { "0" },
                &p.to_string(),
                model::text(&p, "slug"),
            ]))
            .await?;
        if result.as_i64() != Some(1) {
            return Err("spotlight_exists".into());
        }
        entry["link"] = json!(format!("{origin}/legion/join/{raw}"));
        Ok(entry)
    }
    pub async fn invite(&self, raw: &str, open: bool) -> Result<Value, Error> {
        if !security::valid_token(&json!(raw)) {
            return Err("invite".into());
        }
        let hash = crypto::sha(raw);
        let e = self.get(&format!("invite:{hash}")).await?;
        if e.is_null()
            || truthy(&e["revoked_at"])
            || corvus_core::impact::timestamp(&e["expires_at"])
                .is_some_and(|t| t <= chrono::Utc::now().timestamp_millis())
            || number(&e["uses"]).unwrap_or(0.) >= number(&e["max_uses"]).unwrap_or(0.)
        {
            return Err("invite".into());
        }
        if open {
            self.0
                .store
                .command(command(&[
                    "EVAL",
                    OPEN,
                    "1",
                    &self.key(&format!("invite:{hash}")),
                    &now(),
                ]))
                .await?;
        }
        Ok(
            json!({"type":e["type"].as_str().unwrap_or("standard"),"title":e["title"].as_str().unwrap_or(""),"spotlight_slug":e["spotlight_slug"].as_str().unwrap_or(""),"rank":e["rank"],"name":e["name"],"note":e["note"],"meaning":model::config()["meanings"][e["rank"].as_str().unwrap_or("")],"expires_at":e["expires_at"]}),
        )
    }
    pub async fn invitations(&self) -> Result<Value, Error> {
        let ids = self
            .0
            .store
            .command(command(&["ZREVRANGE", &self.key("invites"), "0", "499"]))
            .await?;
        let cmds = ids
            .as_array()
            .ok_or("invite index")?
            .iter()
            .filter_map(Value::as_str)
            .map(|s| command(&["GET", &self.key(&format!("invite:{s}"))]))
            .collect();
        let mut rows = vec![];
        for v in self.0.store.pipeline(cmds).await? {
            if let Some(s) = v.as_str() {
                rows.push(serde_json::from_str::<Value>(s)?);
            }
        }
        Ok(json!(rows))
    }
    pub async fn revoke(&self, hash: &str) -> Result<bool, Error> {
        if hash.len() != 64
            || !hash
                .bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
        {
            return Err("fields".into());
        }
        Ok(self
            .0
            .store
            .command(command(&[
                "EVAL",
                REVOKE,
                "1",
                &self.key(&format!("invite:{hash}")),
                &now(),
            ]))
            .await?
            .as_i64()
            == Some(1))
    }
    /// Compatible atomic admission. The invite/payment receipt, aliases, membership,
    /// edit token hash and first spotlight version commit in one Redis operation.
    pub async fn admit(&self, b: &Value) -> Result<Value, Error> {
        let source = model::text(b, "source");
        if !["invite", "paid", "application", "hack", "call"].contains(&source)
            || !Self::valid_rank(&b["rank"])
        {
            return Err("fields".into());
        }
        let rank = model::text(b, "rank");
        let s = Army::new(self.0)?;
        let email = identity::email(&b["email"])?;
        let mut username = identity::username(&b["handle"]);
        if !username.is_empty() && !identity::valid_username(&username) {
            return Err("handle".into());
        }
        let existing = s.by_email(&email).await?;
        if !existing.is_null() && source != "paid" && existing["id"] != b["existingUid"] {
            return Err("account_login".into());
        }
        let uid = existing["id"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(army_security::id);
        let code = existing["code"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(army_security::recruit_code);
        let created = now();
        let ttl = 365 * DAY;
        if source == "paid"
            && existing.is_null()
            && !username.is_empty()
            && !s.by_name(&username).await?.is_null()
        {
            username.clear();
        }
        username = existing["username"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .unwrap_or(username);
        if username.is_empty() {
            username = format!(
                "soldier_{}",
                uid.to_ascii_lowercase()
                    .chars()
                    .filter(char::is_ascii_alphanumeric)
                    .take(12)
                    .collect::<String>()
            );
        }
        let mut user = if existing.is_null() {
            json!({"id":uid,"code":code,"created":created,"status":"approved","streak":0,"best":0,"feathers":[],"recruits":0,"missionPoints":0,"weeklyWins":0,"username":username,"email":email,"lang":"en"})
        } else {
            existing.clone()
        };
        user["expires"] = json!(
            (chrono::Utc::now() + chrono::Duration::seconds(ttl))
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        );
        let mut grant = if source == "paid" && truthy(&user["legion"]) {
            user["legion"].clone()
        } else {
            let name = model::clean(&b["name"], 80);
            json!({"rank":rank,"source":source,"name":if name.is_empty(){&username}else{&name},"joined_at":user["legion"]["joined_at"].as_str().filter(|s|!s.is_empty()).unwrap_or(&created),"updated_at":created})
        };
        let raw = model::text(b, "inviteToken");
        let invitation = if raw.is_empty() {
            Value::Null
        } else {
            self.get(&format!("invite:{}", crypto::sha(raw))).await?
        };
        let mut edit_raw = String::new();
        let mut spotlight = Value::Null;
        if invitation["type"] == "honorary" {
            spotlight = Senate(self.0)
                .profile(model::text(&invitation, "spotlight_slug"))
                .await?;
            if spotlight.is_null() || spotlight["status"] != "pending" {
                return Err("invite".into());
            }
            edit_raw = security::token();
            spotlight["status"] = json!("active");
            spotlight["member_uid"] = json!(uid);
            spotlight["email"] = json!(email);
            spotlight["edit_hash"] = json!(crypto::sha(&edit_raw));
            spotlight["revision"] = json!(1);
            spotlight["published_at"] = json!(created);
            spotlight["last_edited_at"] = json!(created);
            spotlight["last_edited_by"] = json!("Gabe");
            grant["type"] = json!("honorary");
            grant["title"] = invitation["title"].clone();
            grant["spotlight_slug"] = spotlight["slug"].clone();
        }
        let gate = if !raw.is_empty() {
            self.key(&format!("invite:{}", crypto::sha(raw)))
        } else {
            self.key(&format!(
                "payment:{}",
                crypto::sha(model::text(b, "receipt"))
            ))
        };
        let keys = [
            gate,
            s.key(&format!("u:{uid}")),
            s.key(&format!(
                "email:{}",
                army_security::digest(&self.0.settings, &email)?
            )),
            s.key(&format!("name:{username}")),
            s.key(&format!("code:{code}")),
            s.key("users"),
            s.key(&format!("owned:{uid}")),
            s.key("revision"),
            s.key("legion"),
            s.key("public"),
            self.key("members"),
            self.key(&format!(
                "spotlight:{}",
                spotlight["slug"].as_str().unwrap_or("unused")
            )),
            self.key(&format!(
                "spotlight-edit:{}",
                spotlight["edit_hash"].as_str().unwrap_or("unused")
            )),
            self.key(&format!(
                "spotlight-versions:{}",
                spotlight["slug"].as_str().unwrap_or("unused")
            )),
        ];
        let mut args = command(&["EVAL", include_str!("admit.lua"), "14"]);
        args.extend(keys);
        args.extend([
            user.to_string(),
            grant.to_string(),
            json!(uid).to_string(),
            ttl.to_string(),
            source.into(),
            chrono::Utc::now().timestamp_millis().to_string(),
            created.clone(),
            rank.into(),
            model::text(&user, "expires").into(),
            username,
            email,
            if spotlight.is_null() {
                String::new()
            } else {
                spotlight.to_string()
            },
            model::text(&spotlight, "slug").into(),
            if spotlight.is_null() {
                String::new()
            } else {
                json!({"revision":1,"content":spotlight["content"],"at":created,"by":"Gabe"})
                    .to_string()
            },
        ]);
        let result = self.0.store.command(args).await?;
        match result.as_str() {
            Some("duplicate") => return Ok(json!({"duplicate":true})),
            Some("invite") => return Err("invite".into()),
            Some("account_login") => return Err("account_login".into()),
            Some(id) if id == uid => {}
            _ => return Err("admission".into()),
        }
        Ok(
            json!({"user":s.user(&uid).await?,"newAccount":existing.is_null(),"editRaw":edit_raw,"spotlight":spotlight}),
        )
    }
    pub async fn claim(&self, h: &HeaderMap, b: &Value) -> Result<Claim, Error> {
        let item = self.invite(model::text(b, "token"), false).await?;
        let s = Army::new(self.0)?;
        let session = s.session(h).await?;
        let result=self.admit(&json!({"email":b["email"],"handle":b["handle"],"name":if truthy(&item["name"]){&item["name"]}else{&b["handle"]},"rank":item["rank"],"source":"invite","inviteToken":b["token"],"existingUid":session["id"]})).await?;
        let user = &result["user"];
        let uid = model::text(user, "id");
        let sid = army_security::id();
        s.own(
            uid,
            &format!("session:{}", army_security::digest(&self.0.settings, &sid)?),
            &json!({"uid":uid}),
            7 * DAY,
        )
        .await?;
        let mut out = json!({"ok":true,"rank":user["legion"]["rank"],"name":user["legion"]["name"],"meaning":model::config()["meanings"][model::text(&user["legion"],"rank")]});
        let raw = model::text(&result, "editRaw");
        if !raw.is_empty() {
            let p = &result["spotlight"];
            let origin = if self.0.settings.production() {
                "https://corvus.gent"
            } else {
                security::header(h, "origin")
            };
            let edit_link = format!("{origin}/legion/edit/{raw}");
            let path = format!("/legion/senate/{}", model::text(p, "slug"));
            let text = format!(
                "Welcome, {}.\n\nYour spotlight: {origin}{path}\n\nYour private edit link (keep it private): {edit_link}\n\nThis link edits only your spotlight. Gabe can revoke it at any time.\n\nGabe",
                model::text(&user["legion"], "name")
            );
            let mail = super::mail::send(
                self.0,
                model::text(user, "email"),
                &format!("Your Corvus Senate seat · {}", model::text(p, "title")),
                &text,
                &format!("senate-{uid}"),
            )
            .await?;
            out["edit_link"] = json!(edit_link);
            out["email_sent"] = json!(mail);
            out["spotlight"] = json!(path);
            out["title"] = p["title"].clone();
        }
        Ok(Claim {
            body: out,
            cookies: vec![
                army_security::cookie(
                    &self.0.settings,
                    "army_session",
                    &sid,
                    7 * DAY,
                    "army_session",
                )?,
                army_security::cookie(&self.0.settings, "army_id", uid, 90 * DAY, "army_id")?,
            ],
        })
    }
    pub async fn set_rank(&self, uid: &str, rank: &Value, source: &Value) -> Result<Value, Error> {
        if !Self::valid_rank(rank) {
            return Err("rank".into());
        }
        let s = Army::new(self.0)?;
        let lock = s.acquire(uid, 15).await?;
        let result = async {
            let mut u = s.user(uid).await?;
            if u.is_null() {
                return Err::<Value, Error>("missing".into());
            }
            let mut grant = if truthy(&u["legion"]) {
                u["legion"].clone()
            } else {
                json!({"name":u["username"],"joined_at":now()})
            };
            grant["rank"] = rank.clone();
            grant["source"] = if truthy(source) {
                source.clone()
            } else {
                grant["source"]
                    .as_str()
                    .map(|s| json!(s))
                    .unwrap_or(json!("invite"))
            };
            grant["updated_at"] = json!(now());
            u["legion"] = grant;
            u["status"] = json!("approved");
            let expiry = corvus_core::impact::timestamp(&u["expires"])
                .ok_or("expiry")?
                .max(chrono::Utc::now().timestamp_millis() + 365 * DAY * 1000);
            u["expires"] = json!(
                chrono::DateTime::from_timestamp_millis(expiry)
                    .ok_or("expiry")?
                    .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
            );
            s.persist(&u).await?;
            Ok(json!({"ok":true}))
        }
        .await;
        let released = s.release(uid, &lock).await;
        match result {
            Err(e) => Err(e),
            Ok(v) => {
                released?;
                Ok(v)
            }
        }
    }
}
const CREATE: &str = "if ARGV[5]=='1' and redis.call('EXISTS',KEYS[3])==1 then return 0 end;if ARGV[5]=='1' then redis.call('SET',KEYS[3],ARGV[6]);redis.call('ZADD',KEYS[4],ARGV[3],ARGV[7]) end;redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);redis.call('ZADD',KEYS[2],ARGV[3],ARGV[4]);return 1";
const OPEN: &str = "local s=redis.call('GET',KEYS[1]);if not s then return 0 end;local r=cjson.decode(s);if not r.opened_at or r.opened_at==cjson.null then r.opened_at=ARGV[1];redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL') end;return 1";
const REVOKE: &str = "local s=redis.call('GET',KEYS[1]);if not s then return 0 end;local r=cjson.decode(s);r.revoked_at=ARGV[1];redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 1";
