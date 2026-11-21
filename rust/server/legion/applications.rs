use super::{mail, model, security, store::Legion};
use crate::{
    AppState, Error,
    army::{model as identity, store::Army},
    compound::store::command,
    compound_v2::model::now,
    crypto,
};
use regex::Regex;
use serde_json::{Value, json};
pub struct Applications<'a>(pub &'a AppState);
impl Applications<'_> {
    fn key(&self, s: &str) -> String {
        security::key(&self.0.settings, s)
    }
    pub async fn puzzle(&self, answer: &Value) -> Result<Value, Error> {
        if model::clean(answer, 80)
            .to_lowercase()
            .chars()
            .filter(char::is_ascii_lowercase)
            .collect::<String>()
            != "thecrowopensdoors"
        {
            return Err("answer".into());
        }
        let raw = security::token();
        self.0
            .store
            .command(command(&[
                "SET",
                &self.key(&format!("puzzle:{}", crypto::sha(&raw))),
                "solved",
                "EX",
                "1800",
            ]))
            .await?;
        Ok(json!({"claim":raw}))
    }
    pub async fn apply(&self, b: &Value) -> Result<Value, Error> {
        let source = match model::text(b, "source") {
            s @ ("hack" | "call") => s,
            _ => "application",
        };
        let rank = match source {
            "hack" => "centurio",
            "call" => "legatus",
            _ => "miles",
        };
        let who = model::clean(&b["who"], 220);
        let build = model::clean(&b["build"], 600);
        let why = model::clean(&b["why"], 600);
        let pattern = Regex::new(r"[^\s\u{feff}<>]+@[^\s\u{feff}<>]+\.[^\s\u{feff}<>]+")?;
        let email = identity::email(&json!(pattern.find(&who).map(|m| m.as_str())))?;
        if who.encode_utf16().count() < 5
            || build.encode_utf16().count() < 3
            || why.encode_utf16().count() < 3
        {
            return Err("fields".into());
        }
        if source == "hack"
            && self
                .0
                .store
                .get(&self.key(&format!("puzzle:{}", crypto::sha(model::text(b, "claim")))))
                .await?
                .is_null()
        {
            return Err("answer".into());
        }
        let id = security::token();
        let row = json!({"id":id,"who":who,"email":email,"build":build,"why":why,"source":source,"rank":rank,"status":"new","created_at":now()});
        let inserted=self.0.store.command(command(&["EVAL","if not redis.call('SET',KEYS[1],'1','NX','EX',86400) then return 0 end;redis.call('SET',KEYS[2],ARGV[1],'EX',7776000);redis.call('ZADD',KEYS[3],ARGV[2],ARGV[3]);return 1","3",&self.key(&format!("application-dedupe:{}",crypto::sha(&format!("{email}{source}")))),&self.key(&format!("application:{id}")),&self.key("applications"),&row.to_string(),&chrono::Utc::now().timestamp_millis().to_string(),&id])).await?;
        if inserted.as_i64() != Some(1) {
            return Ok(json!({"ok":true,"message":"Your claim is already with Gabe."}));
        }
        let notified=mail::send(self.0,"gabriel@corvus.gent",&format!("Legion · {rank} application"),&format!("{who}\n\nBuild: {build}\n\nWhy: {why}\n\nSource: {source}\nReview in corvus.gent/admin"),&format!("application-{id}")).await?;
        Ok(json!({"ok":true,"notified":notified,"message":"Received. Gabe reads these himself."}))
    }
    pub async fn all(&self) -> Result<Value, Error> {
        let ids = self
            .0
            .store
            .command(command(&[
                "ZREVRANGE",
                &self.key("applications"),
                "0",
                "499",
            ]))
            .await?;
        let commands = ids
            .as_array()
            .ok_or("application index")?
            .iter()
            .filter_map(Value::as_str)
            .map(|s| command(&["GET", &self.key(&format!("application:{s}"))]))
            .collect();
        let mut rows = vec![];
        for raw in self.0.store.pipeline(commands).await? {
            if let Some(s) = raw.as_str() {
                rows.push(serde_json::from_str::<Value>(s)?);
            }
        }
        Ok(json!(rows))
    }
    pub async fn decide(&self, id: &str, decision: &str) -> Result<Value, Error> {
        if !["approve", "decline"].contains(&decision)
            || id.len() != 43
            || !security::valid_token(&json!(id))
        {
            return Err("fields".into());
        }
        let lock = self.key(&format!("review:{id}"));
        let owner = security::token();
        if self
            .0
            .store
            .command(command(&["SET", &lock, &owner, "NX", "EX", "30"]))
            .await?
            .is_null()
        {
            return Err("busy".into());
        }
        let result=async{let legion=Legion(self.0);let mut row=legion.get(&format!("application:{id}")).await?;if row.is_null(){return Err::<Value,Error>("missing".into());}
if row["status"]!="new"{return Ok(json!({"ok":true}));}
            if decision=="approve"{let s=Army::new(self.0)?;let u=s.by_email(model::text(&row,"email")).await?;if !u.is_null(){legion.set_rank(model::text(&u,"id"),&row["rank"],&row["source"]).await?;}else{let name=model::text(&row,"who").replacen(model::text(&row,"email"),"",1);legion.admit(&json!({"email":row["email"],"name":corvus_core::impact::trimmed(&name),"rank":row["rank"],"source":row["source"],"receipt":format!("application:{id}")})).await?;}}
            row["status"]=json!(if decision=="approve"{"approved"}else{"declined"});row["reviewed_at"]=json!(now());legion.put(&format!("application:{id}"),&row,Some(90*86400)).await?;Ok(json!({"ok":true}))}.await;
        let released=self.0.store.command(command(&["EVAL","if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end","1",&lock,&owner])).await;
        match result {
            Err(e) => Err(e),
            Ok(v) => {
                released?;
                Ok(v)
            }
        }
    }
}
