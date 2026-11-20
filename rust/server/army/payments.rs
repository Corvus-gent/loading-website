//! BMC event normalization and durable receipts. No payment/provider is created here.
use super::{
    model, security,
    store::{Army, DAY},
};
use crate::{Error, compound_v2::model::number};
use corvus_core::{army::truthy, impact};
use regex::Regex;
use serde_json::{Value, json};
pub struct Payments<'a, 's>(pub &'a Army<'s>);
fn text(v: &Value) -> String {
    if truthy(v) {
        impact::string(v)
    } else {
        String::new()
    }
}
fn date(v: &Value) -> Result<Value, Error> {
    Ok(match number(v).filter(|n| n.is_finite() && *n > 0.) {
        Some(n) => json!(model::iso((n * 1000.).trunc() as i64)?),
        None => Value::Null,
    })
}
pub fn tier_name(v: &Value) -> Option<String> {
    let raw = text(v);
    let name = impact::trimmed(&raw).to_lowercase();
    ["tiro", "miles", "centurio", "legatus", "senator", "consul"]
        .into_iter()
        .find(|tier| {
            name.strip_prefix(tier).is_some_and(|s| {
                s.is_empty()
                    || s.starts_with('(')
                    || s.chars()
                        .next()
                        .is_some_and(|c| impact::trimmed(&c.to_string()).is_empty())
            })
        })
        .map(str::to_owned)
}
impl Payments<'_, '_> {
    pub async fn normalize(&self, event: &Value) -> Result<Value, Error> {
        let d = if truthy(&event["data"]) {
            event["data"].clone()
        } else {
            json!({})
        };
        let kind = text(&event["type"]);
        if event["event_id"]
            .as_f64()
            .is_none_or(|n| n.fract() != 0. || !(1.0..=9_007_199_254_740_991.).contains(&n))
            || event["created"].as_f64().is_none_or(|n| {
                !n.is_finite() || (n * 1000. - self.0.now() as f64).abs() > 7. * DAY as f64 * 1000.
            })
            || d.is_array()
        {
            return Err("payload".into());
        }
        if !Regex::new(r"^(donation|membership|extra_purchase|commission_order|wishlist_payment|recurring_donation)\.(created|updated|started|refunded|cancelled|paused)$")?.is_match(&kind){return Err("payload".into());}
        if event["live_mode"] != true {
            return Ok(json!({"test":true}));
        }
        let raw = text(&d["support_note"]);
        let note = String::from_utf16_lossy(
            &impact::trimmed(&raw)
                .encode_utf16()
                .take(1000)
                .collect::<Vec<_>>(),
        );
        let clean = Regex::new(r"(?i)^@|^corvus\s*:\s*")?.replace(&note, "");
        let exact = model::username(&json!(clean));
        let mut username = model::valid_username(&exact).then_some(exact);
        let mut account = if let Some(name) = &username {
            self.0.by_name(name).await?
        } else {
            Value::Null
        };
        if !truthy(&account["verifiedAt"]) {
            let mut names = vec![];
            for capture in
                Regex::new(r"(?i)(?:^|\s)@([a-z][a-z0-9_-]{2,23})\b")?.captures_iter(&note)
            {
                let name = capture[1].to_lowercase();
                if !names.contains(&name) {
                    names.push(name);
                }
            }
            let mut found = vec![];
            for name in names.iter().take(10) {
                let user = self.0.by_name(name).await?;
                if truthy(&user["verifiedAt"]) {
                    found.push(user);
                }
            }
            account = if found.len() == 1 {
                found.remove(0)
            } else {
                Value::Null
            };
            if !account.is_null() {
                username = account["username"].as_str().map(str::to_owned);
            }
        }
        if let Ok(email) = model::email(&d["supporter_email"]) {
            let by_email = self.0.by_email(&email).await?;
            if truthy(&by_email["verifiedAt"]) {
                account = if !account.is_null() && account["id"] != by_email["id"] {
                    Value::Null
                } else {
                    by_email
                };
            }
        }
        let subscription = kind.starts_with("membership.");
        let tier = subscription
            .then(|| tier_name(&d["membership_level_name"]))
            .flatten();
        let amount = d
            .get("amount")
            .and_then(number)
            .filter(|n| n.is_finite() && (0.0..=1e8).contains(n))
            .ok_or("payload")?;
        let currency = text(&d["currency"]).to_uppercase();
        if currency.len() != 3 || !currency.bytes().all(|b| b.is_ascii_uppercase()) {
            return Err("payload".into());
        }
        let state =
            if kind.ends_with(".refunded") || d["refunded"] == true || d["refunded"] == "true" {
                "refunded"
            } else if kind.ends_with(".cancelled") || d["status"] == "canceled" {
                "cancelled"
            } else if kind.ends_with(".paused") || d["status"] == "paused" {
                "paused"
            } else {
                "active"
            };
        let object = if !d["id"].is_null() {
            Some(security::digest(
                &self.0.state.settings,
                &format!(
                    "{}:{}",
                    kind.split('.').next().unwrap_or(""),
                    impact::string(&d["id"])
                ),
            )?)
        } else {
            None
        };
        let count = number(&d["coffee_count"])
            .filter(|n| n.is_finite() && *n != 0.)
            .unwrap_or(1.)
            .floor()
            .clamp(0., 10000.);
        let mut row = json!({"event":impact::string(&event["event_id"]),"type":kind,"level":tier,"amount":amount,"currency":currency,"date":date(&event["created"])?,"username":account["username"].as_str().filter(|s|!s.is_empty()).map(str::to_owned).or(username),"uid":account["id"].as_str(),"state":state,"until":if subscription{date(&d["current_period_end"])?}else{Value::Null},"interval":if d["duration_type"]=="year"{"year"}else{"month"},"object":object,"coffees":if kind.starts_with("donation."){count}else{0.}});
        let extras = d["extras"].as_array().map(Vec::as_slice).unwrap_or(&[]);
        if kind.starts_with("extra_purchase.")
            && amount >= 1.
            && currency == "USD"
            && extras
                .iter()
                .any(|e| tier_name(&e["title"]).as_deref() == Some("tiro"))
        {
            row["level"] = json!("tiro");
            row["interval"] = json!("once");
        }
        if !subscription
            && state == "active"
            && amount >= 1000.
            && currency == "USD"
            && extras
                .iter()
                .any(|e| tier_name(&e["title"]).as_deref() == Some("senator"))
        {
            row["level"] = json!("senator");
        }
        if !subscription
            && state == "active"
            && amount >= 10000.
            && currency == "USD"
            && extras
                .iter()
                .any(|e| tier_name(&e["title"]).as_deref() == Some("consul"))
        {
            let held = self
                .0
                .all()
                .await?
                .iter()
                .filter(|u| {
                    u["membership"]["tier"] == "consul"
                        && u["membership"]["state"] != "refunded"
                        && u["id"] != account["id"]
                })
                .count();
            row["level"] = if held < 2 {
                json!("consul")
            } else {
                Value::Null
            };
            if held >= 2 {
                row["review_reason"] = json!("consul_capacity");
            }
        }
        Ok(row)
    }
    pub async fn accept(&self, event: &Value) -> Result<Value, Error> {
        let row = self.normalize(event).await?;
        if row["test"] == true {
            return Ok(row);
        }
        let id = row["event"].as_str().ok_or("payload")?;
        let uid = row["uid"].as_str().unwrap_or("none");
        let added = self
            .0
            .run(&[
                "EVAL",
                include_str!("scripts/payment-accept.lua"),
                "5",
                &self.0.key(&format!("bmc:seen:{id}")),
                &self.0.key(&format!("bmc:event:{id}")),
                &self.0.key("bmc:pending"),
                &self.0.key(&format!("u:{uid}")),
                &self.0.key(&format!("owned:{uid}")),
                &row.to_string(),
                &self.0.now().to_string(),
                &(400 * DAY).to_string(),
                &(30 * DAY).to_string(),
                id,
            ])
            .await?
            .as_i64()
            .ok_or("payment")?;
        Ok(json!({"accepted":added!=0,"event":id}))
    }
    pub async fn process(&self, id: &str) -> Result<Value, Error> {
        if id.is_empty() || id.len() > 20 || !id.bytes().all(|b| b.is_ascii_digit()) {
            return Err("payment".into());
        }
        self.0.locked(&format!("payment:{id}"),async {
            let mut p=self.0.get(&format!("bmc:event:{id}")).await?;
            if p.is_null(){self.0.run(&["ZREM",&self.0.key("bmc:pending"),id]).await?;return Ok(json!({"missing":true}));}
            let mut user=if let Some(uid)=p["uid"].as_str(){self.0.user(uid).await?}else if let Some(name)=p["username"].as_str(){self.0.by_name(name).await?}else{Value::Null};
            if !truthy(&user["verifiedAt"])||user["status"]=="deleting"{user=Value::Null;}
            if truthy(&p["coffees"])&&truthy(&p["object"]){self.0.run(&["EVAL",include_str!("scripts/coffee.lua"),"2",&self.0.key(&format!("bmc:coffee:{}",text(&p["object"]))),&self.0.key("bmc:coffees"),&text(&p["coffees"]),&text(&p["state"]),&(400*DAY).to_string()]).await?;}
            if let Some(uid)=user["id"].as_str(){
                // All matched entitlement changes use one short lease. The capacity check
                // happens at settlement, not only when a webhook enters the queue.
                let payment=&mut p;
                self.0.owned_lock("entitlements",15,|lease|async move { let p=payment; self.0.locked(uid,async {
                    let snapshot=self.0.state.store.get(&self.0.key(&format!("u:{uid}"))).await?;
                    let Some(snapshot)=snapshot.as_str() else {return Ok(());};
                    let mut current:Value=serde_json::from_str(snapshot)?;
                    if current.is_null()||current["status"]=="deleting"{return Ok(());}
                    if !current["feathers"].is_array(){current["feathers"]=json!([]);}
                    if p["level"]=="consul" && p["state"]!="refunded" {
                        let held=self.0.all().await?.iter().filter(|u|u["id"]!=uid && u["membership"]["tier"]=="consul" && u["membership"]["state"]!="refunded").count();
                        if held>=2 {p["level"]=Value::Null;p["review_reason"]=json!("consul_capacity");}
                    }
                    p["uid"]=json!(uid);p["username"]=current["username"].clone();
                    let last=&current["payment"];if last.is_null()||text(&p["date"])>=text(&last["date"]){current["paid"]=json!(p["state"]!="refunded");current["payment"]=json!({"date":p["date"],"amount":p["amount"],"currency":p["currency"]});}
                    let previous=&current["membership"];
                    let level=if truthy(&p["level"]){p["level"].clone()}else if previous.is_object()&&previous["object"]==p["object"]&&(text(&p["type"]).starts_with("membership.")||(previous["tier"]=="tiro"&&previous["interval"]=="once")||(p["state"]=="refunded"&&text(&p["type"]).starts_with("extra_purchase.")&&["senator","consul"].contains(&previous["tier"].as_str().unwrap_or("")))){previous["tier"].clone()}else{Value::Null};
                    let order=|v:&Value|["active","paused","cancelled","refunded"].iter().position(|s|v==s);
                    if truthy(&level)&&(previous.is_null()||text(&p["date"])>text(&previous["updated"])||p["date"]==previous["updated"]&&order(&p["state"]).zip(order(&previous["state"])).is_some_and(|(a,b)|a>=b)){
                        current["membership"]=json!({"tier":level,"state":p["state"],"until":if truthy(&p["until"]){p["until"].clone()}else{previous["until"].clone()},"interval":if level=="tiro"&&previous["object"]==p["object"]&&previous["interval"]=="once"{json!("once")}else{p["interval"].clone()},"amount":p["amount"],"currency":p["currency"],"updated":p["date"],"object":p["object"]});
                        current["expires"]=json!(model::iso(impact::timestamp(&current["expires"]).ok_or("expiry")?.max(self.0.now()+365*DAY*1000))?);
                    }
                    self.0.persist_guarded(&current,Some((snapshot,"entitlements",&lease))).await?;self.0.own(uid,&format!("bmc:event:{id}"),p,365*DAY).await?;
                    if let Some(object)=p["object"].as_str(){self.0.own(uid,&format!("bmc:owner:{object}"),&json!(uid),365*DAY).await?;}
                    Ok(())
                }).await }).await?;
                if p["review_reason"]=="consul_capacity" {
                    self.0.run(&["ZADD",&self.0.key("bmc:unmatched"),&self.0.now().to_string(),id]).await?;
                } else { self.0.run(&["ZREM",&self.0.key("bmc:unmatched"),id]).await?; }
            }else{
                if let Some(object)=p["object"].as_str(){let uid=self.0.get(&format!("bmc:owner:{object}")).await?;if let Some(uid)=uid.as_str() && !self.0.user(uid).await?.is_null(){p["uid"]=json!(uid);self.0.run(&["SET",&self.0.key(&format!("bmc:event:{id}")),&p.to_string(),"EX",&(30*DAY).to_string()]).await?;self.0.run(&["ZADD",&self.0.key("bmc:pending"),&self.0.now().to_string(),id]).await?;return Ok(json!({"retry":true}));}}
                self.0.run(&["ZADD",&self.0.key("bmc:unmatched"),&self.0.now().to_string(),id]).await?;
            }
            self.0.run(&["ZREM",&self.0.key("bmc:pending"),id]).await?;self.0.run(&["DEL",&self.0.key("public")]).await?;
            // Discord reconciliation belongs to the service boundary, still gated off.
            Ok(json!({"matched":!user.is_null()}))
        }).await
    }
    pub async fn drain(&self) -> Result<Value, Error> {
        let ids = self
            .0
            .run(&["ZRANGE", &self.0.key("bmc:pending"), "0", "99"])
            .await?;
        let ids = ids.as_array().ok_or("payments")?;
        let mut matched = 0;
        for id in ids.iter().filter_map(Value::as_str) {
            if self.process(id).await?["matched"] == true {
                matched += 1;
            }
        }
        Ok(json!({"processed":ids.len(),"matched":matched}))
    }
    pub async fn unmatched(&self) -> Result<Value, Error> {
        let ids = self
            .0
            .run(&["ZREVRANGE", &self.0.key("bmc:unmatched"), "0", "99"])
            .await?;
        let mut rows = vec![];
        for id in ids
            .as_array()
            .ok_or("payments")?
            .iter()
            .filter_map(Value::as_str)
        {
            let row = self.0.get(&format!("bmc:event:{id}")).await?;
            if row.is_null() {
                self.0
                    .run(&["ZREM", &self.0.key("bmc:unmatched"), id])
                    .await?;
            } else {
                let mut out = serde_json::Map::new();
                for k in [
                    "event",
                    "type",
                    "level",
                    "amount",
                    "currency",
                    "date",
                    "username",
                    "review_reason",
                ] {
                    if let Some(v) = row.get(k) {
                        out.insert(k.into(), v.clone());
                    }
                }
                rows.push(Value::Object(out));
            }
        }
        Ok(json!(rows))
    }
    pub async fn link(&self, id: &str, name: &Value) -> Result<Value, Error> {
        let user = self.0.by_name(&model::username(name)).await?;
        let mut p = self.0.get(&format!("bmc:event:{id}")).await?;
        if !truthy(&user["verifiedAt"]) || p.is_null() {
            return Err("missing".into());
        }
        if truthy(&p["uid"]) && p["uid"] != user["id"] {
            return Err("payment".into());
        }
        p["uid"] = user["id"].clone();
        p["username"] = user["username"].clone();
        let event = p["event"].as_str().ok_or("payment")?;
        self.0
            .run(&[
                "SET",
                &self.0.key(&format!("bmc:event:{event}")),
                &p.to_string(),
                "EX",
                &(30 * DAY).to_string(),
            ])
            .await?;
        self.process(event).await
    }
}
