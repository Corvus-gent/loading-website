use super::{
    copy, discord_model as model, security,
    store::{Army, DAY},
    transport::Transport,
};
use crate::Error;
use corvus_core::army::{active_tier, truthy};
use reqwest::Method;
use serde_json::{Value, json};
pub struct Discord<'a, 's> {
    pub army: &'a Army<'s>,
    transport: Transport<'s>,
}
impl<'a, 's> Discord<'a, 's> {
    pub fn new(army: &'a Army<'s>, fixture: Option<&str>) -> Result<Self, Error> {
        Ok(Self {
            army,
            transport: Transport::new(army.state, fixture)?,
        })
    }
    fn token(&self) -> Option<&str> {
        self.army.state.settings.get("DISCORD_BOT_TOKEN")
    }
    pub async fn api(
        &self,
        path: &str,
        method: Method,
        body: Option<&Value>,
    ) -> Result<Value, Error> {
        let token = self.token().ok_or("discord_not_configured")?;
        let response = self
            .transport
            .request(
                &format!("https://discord.com/api/v10{path}"),
                method,
                &[
                    ("Authorization", &format!("Bot {token}")),
                    ("Content-Type", "application/json"),
                ],
                body,
            )
            .await?;
        if !response.ok() {
            return Err(if response.status == 429 {
                "discord_rate".to_string()
            } else {
                format!("discord_http_{}", response.status)
            }
            .into());
        }
        if response.status == 204 {
            Ok(Value::Null)
        } else {
            response.json()
        }
    }
    pub async fn configuration(&self) -> Result<Value, Error> {
        let c = self.army.get("discord:config").await?;
        if self.token().is_none()
            || !model::snowflake(&c["guild"])
            || !model::snowflake(&c["channels"]["the-gate"])
        {
            return Err("discord_not_configured".into());
        }
        Ok(c)
    }
    pub async fn invite(&self, user: &Value, dry: bool) -> Result<Option<String>, Error> {
        if self.token().is_none() || user["status"] != "approved" {
            return Ok(None);
        }
        if dry {
            return Ok(Some("https://discord.gg/preview-only".into()));
        }
        let c = self.configuration().await?;
        let uid = user["id"].as_str().ok_or("session")?;
        let suffix = format!("discord:invite:{uid}");
        let cached = self.army.get(&suffix).await?;
        if cached["until"]
            .as_i64()
            .is_some_and(|n| n > self.army.now() + 60000)
        {
            return Ok(Some(security::open(
                &self.army.state.settings,
                cached["secret"].as_str().ok_or("cipher")?,
            )?));
        }
        let value = self
            .api(
                &format!(
                    "/channels/{}/invites",
                    c["channels"]["the-gate"]
                        .as_str()
                        .ok_or("discord_configuration")?
                ),
                Method::POST,
                Some(&json!({"max_age":604800,"max_uses":1,"unique":true})),
            )
            .await?;
        let code = value["code"]
            .as_str()
            .filter(|c| {
                (2..=100).contains(&c.len())
                    && c.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
            })
            .ok_or("discord_unavailable")?;
        let url = format!("https://discord.gg/{code}");
        self.army.own(uid,&suffix,&json!({"secret":security::seal(&self.army.state.settings,&url)?,"until":self.army.now()+7*DAY*1000}),7*DAY).await?;
        let day = self.army.timestamp()?.chars().take(10).collect::<String>();
        self.army
            .run(&["INCR", &self.army.key(&format!("discord:invites:{day}"))])
            .await?;
        self.army
            .run(&[
                "EXPIRE",
                &self.army.key(&format!("discord:invites:{day}")),
                &(120 * DAY).to_string(),
            ])
            .await?;
        Ok(Some(url))
    }
    pub async fn issue(&self, user: &Value) -> Result<Value, Error> {
        self.configuration().await?;
        if !truthy(&user["verifiedAt"]) || user["status"] != "approved" {
            return Err("unverified".into());
        }
        let uid = user["id"].as_str().ok_or("session")?;
        if !self.army.rate("discord-code", uid, 5, 600).await? {
            return Err("rate".into());
        }
        let code = hex::encode(rand::random::<[u8; 12]>());
        self.army
            .own(
                uid,
                &format!(
                    "discord:code:{}",
                    security::digest(&self.army.state.settings, &code)?
                ),
                &json!({"uid":uid}),
                600,
            )
            .await?;
        Ok(json!({"code":code,"expires":600}))
    }
    pub async fn sync(&self, user: &Value) -> Result<Value, Error> {
        if !model::snowflake(&user["discordId"]) {
            return Ok(json!({"skipped":true}));
        }
        let c = self.configuration().await?;
        let guild = c["guild"].as_str().ok_or("discord_configuration")?;
        let id = user["discordId"].as_str().ok_or("discord_configuration")?;
        let path = format!("/guilds/{guild}/members/{id}");
        let member = self.api(&path, Method::GET, None).await?;
        let wanted = if user["status"] == "approved" {
            active_tier(user, self.army.now()).unwrap_or("tiro")
        } else {
            "recruit (unverified)"
        };
        let role = &c["roles"][wanted];
        if !model::snowflake(role) {
            return Err("discord_configuration".into());
        }
        let managed = c["roles"].as_object().ok_or("discord_configuration")?;
        let roles = member["roles"].as_array().ok_or("discord_configuration")?;
        for old in roles
            .iter()
            .filter(|r| managed.values().any(|v| v == *r) && *r != role)
        {
            if !model::snowflake(old) {
                return Err("discord_configuration".into());
            }
            self.api(
                &format!(
                    "{path}/roles/{}",
                    old.as_str().ok_or("discord_configuration")?
                ),
                Method::DELETE,
                None,
            )
            .await?;
        }
        if !roles.contains(role) {
            self.api(
                &format!(
                    "{path}/roles/{}",
                    role.as_str().ok_or("discord_configuration")?
                ),
                Method::PUT,
                None,
            )
            .await?;
        }
        Ok(json!({"ok":true}))
    }
    pub async fn claim(&self, code: &str, id: &str, guild: &str) -> Result<Value, Error> {
        let c = self.configuration().await?;
        if c["guild"] != guild
            || !model::snowflake(&json!(id))
            || code.len() != 24
            || !code
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err("verification".into());
        }
        let raw = self
            .army
            .run(&[
                "GETDEL",
                &self.army.key(&format!(
                    "discord:code:{}",
                    security::digest(&self.army.state.settings, code)?
                )),
            ])
            .await?;
        let record: Value = serde_json::from_str(raw.as_str().ok_or("expired")?)?;
        let uid = record["uid"].as_str().ok_or("expired")?;
        self.army
            .locked(uid, async {
                let mut user = self.army.user(uid).await?;
                if !truthy(&user["verifiedAt"])
                    || user["status"] != "approved"
                    || truthy(&user["discordId"]) && user["discordId"] != id
                {
                    return Err("unverified".into());
                }
                let suffix = format!("discord:owner:{id}");
                let owner = self.army.get(&suffix).await?;
                if truthy(&owner) && owner != uid {
                    return Err("verification".into());
                }
                let reserved = self
                    .army
                    .run(&[
                        "SET",
                        &self.army.key(&suffix),
                        &json!(uid).to_string(),
                        "NX",
                        "EX",
                        &self.army.remaining(&user)?.min(365 * DAY).to_string(),
                    ])
                    .await?;
                if reserved.is_null() && self.army.get(&suffix).await? != uid {
                    return Err("verification".into());
                }
                self.army.own(uid, &suffix, &json!(uid), 365 * DAY).await?;
                user["discordId"] = json!(id);
                self.army.persist(&user).await?;
                self.sync(&user).await?;
                Ok(json!({"ok":true}))
            })
            .await
    }
    pub async fn audit(&self) -> Result<Value, Error> {
        if self.token().is_none() {
            return Ok(json!({"state":"not_configured"}));
        }
        let c = self.configuration().await?;
        let guild = c["guild"].as_str().ok_or("discord_configuration")?;
        let role_path = format!("/guilds/{guild}/roles");
        let channel_path = format!("/guilds/{guild}/channels");
        let (roles, channels) = tokio::try_join!(
            self.api(&role_path, Method::GET, None),
            self.api(&channel_path, Method::GET, None)
        )?;
        let findings = model::findings(
            &c,
            roles.as_array().ok_or("discord_configuration")?,
            channels.as_array().ok_or("discord_configuration")?,
        )?;
        let result = json!({"state":if findings.is_empty(){"ok"}else{"unsafe"},"findings":findings,"checked":self.army.timestamp()?});
        self.army
            .run(&[
                "SET",
                &self.army.key("discord:audit"),
                &result.to_string(),
                "EX",
                &(2 * DAY).to_string(),
            ])
            .await?;
        if !findings.is_empty()
            && let Some(token) = self.army.state.settings.get("RESEND_API_KEY")
            && !truthy(&self.army.get("discord:alert").await?)
        {
            let day = self.army.timestamp()?.chars().take(10).collect::<String>();
            let text = format!(
                "the daily audit found {} unsafe permission settings. review the legion section on your private dashboard.\n\n{}",
                findings.len(),
                findings.join("\n")
            );
            let result=self.transport.request("https://api.resend.com/emails",Method::POST,&[("Authorization",&format!("Bearer {token}")),("Content-Type","application/json"),("Idempotency-Key",&format!("discord-audit-{day}"))],Some(&json!({"from":"the crow <crow@corvus.gent>","to":["gabriel@corvus.gent"],"subject":"corvus: discord invite permissions changed","text":text}))).await?;
            if result.ok() {
                self.army
                    .run(&[
                        "SET",
                        &self.army.key("discord:alert"),
                        "true",
                        "EX",
                        &DAY.to_string(),
                    ])
                    .await?;
            }
        }
        Ok(result)
    }
    pub async fn refresh(&self, users: &[Value]) -> Result<Value, Error> {
        if self.token().is_none() {
            return Ok(json!({"state":"not_configured","synced":0}));
        }
        let c = self.configuration().await?;
        let linked = users
            .iter()
            .filter(|u| truthy(&u["discordId"]))
            .collect::<Vec<_>>();
        let offset = self
            .army
            .get("discord:sync-offset")
            .await?
            .as_u64()
            .unwrap_or(0) as usize
            % linked.len().max(1);
        let mut synced = 0;
        let mut failed = 0;
        for user in linked
            .iter()
            .cycle()
            .skip(offset)
            .take(linked.len().min(10))
        {
            if self.sync(user).await.is_ok() {
                synced += 1;
            } else {
                failed += 1;
            }
        }
        self.army
            .run(&[
                "SET",
                &self.army.key("discord:sync-offset"),
                &((offset + 10) % linked.len().max(1)).to_string(),
                "EX",
                &DAY.to_string(),
            ])
            .await?;
        let after = self.army.get("discord:member-cursor").await?;
        let guild = c["guild"].as_str().ok_or("discord_configuration")?;
        let query = if model::snowflake(&after) {
            format!("&after={}", after.as_str().unwrap_or(""))
        } else {
            String::new()
        };
        let members = self
            .api(
                &format!("/guilds/{guild}/members?limit=100{query}"),
                Method::GET,
                None,
            )
            .await?;
        let members = members.as_array().ok_or("discord_configuration")?;
        let managed = c["roles"].as_object().ok_or("discord_configuration")?;
        let owners = c["owners"].as_array().ok_or("discord_configuration")?;
        let mut removed = 0;
        for member in members {
            let id = &member["user"]["id"];
            if owners.contains(id) || id == &c["bot"] {
                continue;
            }
            let roles = member["roles"].as_array().ok_or("discord_configuration")?;
            if !roles.iter().any(|id| {
                managed.values().any(|v| v == id) && id != &c["roles"]["recruit (unverified)"]
            }) {
                continue;
            }
            if !model::snowflake(id) {
                return Err("discord_configuration".into());
            }
            let id = id.as_str().ok_or("discord_configuration")?;
            let owner = self.army.get(&format!("discord:owner:{id}")).await?;
            let user = self.army.user(owner.as_str().unwrap_or("")).await?;
            if user["status"] == "approved" {
                continue;
            }
            for role in roles.iter().filter(|id| managed.values().any(|v| v == *id)) {
                if !model::snowflake(role) {
                    return Err("discord_configuration".into());
                }
                self.api(
                    &format!(
                        "/guilds/{guild}/members/{id}/roles/{}",
                        role.as_str().ok_or("discord_configuration")?
                    ),
                    Method::DELETE,
                    None,
                )
                .await?;
            }
            removed += 1;
        }
        let cursor = if members.len() == 100 {
            members
                .last()
                .map(|m| m["user"]["id"].clone())
                .unwrap_or(Value::Null)
        } else {
            Value::Null
        };
        self.army
            .run(&[
                "SET",
                &self.army.key("discord:member-cursor"),
                &cursor.to_string(),
                "EX",
                &DAY.to_string(),
            ])
            .await?;
        let last = self.army.get("discord:audit").await?;
        if last.is_null()
            || corvus_core::impact::timestamp(&last["checked"])
                .is_some_and(|n| n < self.army.now() - DAY * 1000)
        {
            self.audit().await?;
        }
        Ok(json!({"synced":synced,"failed":failed,"removed":removed}))
    }
    pub async fn respond(&self, interaction: &Value) -> Result<String, Error> {
        let c = self.configuration().await?;
        if interaction["guild_id"] != c["guild"] || interaction["data"]["name"] != "claim" {
            return Err("verification".into());
        }
        let code = interaction["data"]["options"]
            .as_array()
            .and_then(|a| a.iter().find(|o| o["name"] == "code"))
            .and_then(|o| o["value"].as_str())
            .unwrap_or("");
        self.claim(
            code,
            interaction["member"]["user"]["id"].as_str().unwrap_or(""),
            interaction["guild_id"].as_str().unwrap_or(""),
        )
        .await?;
        let lang = interaction["locale"]
            .as_str()
            .unwrap_or("en")
            .split('-')
            .next()
            .unwrap_or("en");
        let copy = copy::copy("army", lang);
        Ok(format!(
            "{}\n\n{}",
            copy["discordLinked"].as_str().unwrap_or(""),
            copy["discordRoleNote"].as_str().unwrap_or("")
        ))
    }
    pub async fn complete(&self, interaction: &Value) -> Result<(), Error> {
        let content=self.respond(interaction).await.unwrap_or_else(|_|"the code expired or could not be linked. get a fresh code on corvus.gent/army/access/.".into());
        let id = &interaction["application_id"];
        let token = interaction["token"].as_str().unwrap_or("");
        if !model::snowflake(id)
            || token.is_empty()
            || token.len() > 400
            || !token
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b))
        {
            return Err("verification".into());
        }
        self.transport
            .request(
                &format!(
                    "https://discord.com/api/v10/webhooks/{}/{token}/messages/@original",
                    id.as_str().unwrap_or("")
                ),
                Method::PATCH,
                &[("Content-Type", "application/json")],
                Some(&json!({"content":content,"allowed_mentions":{"parse":[]}})),
            )
            .await?;
        Ok(())
    }
}
