//! Public Army aggregates. Private identities/credentials never enter this projection.
use super::{model, store::Army};
use crate::Error;
use corvus_core::army::{active_tier, points, public_soldier, rank, truthy};
use serde_json::{Value, json};
use std::collections::BTreeMap;
fn text(v: &Value) -> &str {
    v.as_str().unwrap_or("")
}
fn count(v: &Value) -> f64 {
    crate::compound_v2::model::number(v)
        .filter(|n| n.is_finite())
        .unwrap_or(0.)
}
// Usernames are validated ASCII. ICU's default collation orders '_' before '-'.
fn name_key(v: &Value) -> Vec<u8> {
    text(v)
        .bytes()
        .map(|b| match b {
            b'_' => 1,
            b'-' => 2,
            _ => b,
        })
        .collect()
}
pub struct Public<'a, 's>(pub &'a Army<'s>);
impl Public<'_, '_> {
    async fn cache(&self, suffix: &str, revision: &Value, result: &Value) -> Result<(), Error> {
        if self.0.state.settings.write_enabled() {
            self.0.run(&["EVAL","if (redis.call('GET',KEYS[1]) or '0')==ARGV[1] then redis.call('SET',KEYS[2],ARGV[2],'EX',30);return 1 end return 0","2",&self.0.key("revision"),&self.0.key(suffix),revision.as_str().unwrap_or("0"),&result.to_string()]).await?;
        }
        Ok(())
    }
    pub async fn summary(&self) -> Result<Value, Error> {
        let cached = self.0.get("public").await?;
        if !cached.is_null() {
            Ok(cached)
        } else {
            self.build().await
        }
    }
    pub async fn build(&self) -> Result<Value, Error> {
        let revision = self.0.run(&["GET", &self.0.key("revision")]).await?;
        let users = self
            .0
            .all()
            .await?
            .into_iter()
            .filter(|u| u["status"] != "deleting")
            .collect::<Vec<_>>();
        let now = self.0.now();
        let today = model::day_key(now)?;
        let week = model::week_key(now)?;
        let utc = self.0.timestamp()?.chars().take(10).collect::<String>();
        let weekly_rows = self
            .0
            .run(&[
                "ZRANGE",
                &self.0.key(&format!("week:{week}")),
                "0",
                "-1",
                "WITHSCORES",
            ])
            .await?;
        let weekly = weekly_rows
            .as_array()
            .ok_or("weekly")?
            .chunks_exact(2)
            .map(|pair| (text(&pair[0]).to_string(), count(&pair[1]).max(0.)))
            .collect::<BTreeMap<_, _>>();
        let sent = self
            .0
            .run(&["GET", &self.0.key(&format!("mail-count:{utc}"))])
            .await?;
        let mail_status = self.0.get("mail-status").await?;
        let winner = self.0.get(&format!("winner:{week}")).await?;
        let named = users
            .iter()
            .filter(|u| truthy(&u["verifiedAt"]) && truthy(&u["username"]))
            .collect::<Vec<_>>();
        let entry = |u: &Value| json!({"username":if truthy(&u["verifiedAt"])&&!truthy(&u["hidden"])&&truthy(&u["username"]){u["username"].clone()}else{Value::Null},"rank":rank(u),"tier":active_tier(u,now),"points":points(u),"recruits":count(&u["recruits"]),"weekRecruits":weekly.get(text(&u["id"])).copied().unwrap_or(0.)});
        let mut ranks = serde_json::Map::new();
        for row in corvus_core::army::config()["RANKS"]
            .as_array()
            .ok_or("configuration")?
        {
            ranks.insert(text(&row[0]).into(), json!(0));
        }
        ranks.insert("imperator".into(), json!(0));
        let mut countries: Vec<(String, usize)> = vec![];
        for user in &users {
            let rank = rank(user);
            let current = ranks.get(rank).and_then(Value::as_u64).unwrap_or(0);
            ranks.insert(rank.into(), json!(current + 1));
            if let Some(code) = user["country"].as_str().filter(|s| !s.is_empty()) {
                if let Some(row) = countries.iter_mut().find(|(c, _)| c == code) {
                    row.1 += 1;
                } else {
                    countries.push((code.into(), 1));
                }
            }
        }
        let top = |score: &dyn Fn(&Value) -> f64| {
            let mut rows = named
                .iter()
                .copied()
                .filter(|u| !truthy(&u["hidden"]))
                .collect::<Vec<_>>();
            rows.sort_by(|a, b| {
                score(b)
                    .total_cmp(&score(a))
                    .then_with(|| name_key(&a["username"]).cmp(&name_key(&b["username"])))
            });
            rows.into_iter().take(25).map(entry).collect::<Vec<_>>()
        };
        let mut tree_users = users.iter().collect::<Vec<_>>();
        tree_users.sort_by(|a, b| {
            count(&b["recruits"])
                .total_cmp(&count(&a["recruits"]))
                .then_with(|| text(&a["created"]).cmp(text(&b["created"])))
        });
        tree_users.truncate(120);
        let tree_ids = tree_users
            .iter()
            .enumerate()
            .map(|(i, u)| (text(&u["id"]), format!("s{i}")))
            .collect::<BTreeMap<_, _>>();
        let mut subscriptions = 0;
        let sub_keys = users
            .iter()
            .flat_map(|u| {
                ["daily", "weekly"]
                    .map(|kind| self.0.key(&format!("sub:{}:{kind}", text(&u["id"]))))
            })
            .collect::<Vec<_>>();
        for chunk in sub_keys.chunks(500) {
            let mut args = vec!["MGET"];
            args.extend(chunk.iter().map(String::as_str));
            let values = self.0.run(&args).await?;
            for raw in values
                .as_array()
                .ok_or("subscriptions")?
                .iter()
                .filter_map(Value::as_str)
            {
                let value: Value = serde_json::from_str(raw)?;
                if truthy(&value["confirmed"]) {
                    subscriptions += 1;
                }
            }
        }
        let empty = json!({"created":today,"feathers":[]});
        let soldier_of_week = if winner.is_null() {
            Value::Null
        } else {
            entry(
                users
                    .iter()
                    .find(|u| u["id"] == winner["uid"])
                    .unwrap_or(&empty),
            )
        };
        let tiers = corvus_core::army::config()["TIERS"]
            .as_array()
            .ok_or("configuration")?
            .iter()
            .filter_map(Value::as_str)
            .map(|tier| {
                (
                    tier.to_string(),
                    json!(
                        users
                            .iter()
                            .filter(|u| active_tier(u, now) == Some(tier))
                            .count()
                    ),
                )
            })
            .collect::<serde_json::Map<_, _>>();
        let mrr = users
            .iter()
            .filter(|u| {
                active_tier(u, now).is_some()
                    && u["membership"]["currency"] == "USD"
                    && !["senator", "consul"].contains(&text(&u["membership"]["tier"]))
                    && ["month", "year"].contains(&text(&u["membership"]["interval"]))
            })
            .map(|u| {
                count(&u["membership"]["amount"])
                    / if u["membership"]["interval"] == "year" {
                        12.
                    } else {
                        1.
                    }
            })
            .sum::<f64>();
        let coffees = count(&self.0.run(&["GET", &self.0.key("bmc:coffees")]).await?).max(0.)
            + count(&json!(
                self.0.state.settings.get("COFFEE_BASELINE").unwrap_or("")
            ))
            .max(0.);
        let result = json!({"updated":self.0.timestamp()?,"soldiers":named.len(),"anonymous":users.len()-named.len(),"atGate":users.iter().filter(|u|truthy(&u["applied"])&&["unconfirmed","waiting","later"].contains(&text(&u["status"]))).count(),"approved":users.iter().filter(|u|u["status"]=="approved").count(),"paid":users.iter().filter(|u|truthy(&u["paid"])).count(),"recruits":users.iter().fold(0.0,|sum,u|sum+count(&u["recruits"])),"recruitedToday":users.iter().filter(|u|corvus_core::impact::timestamp(&u["qualifiedAt"]).and_then(|n|model::day_key(n).ok()).is_some_and(|day|day==today)).count(),"subscribers":subscriptions,"mailsToday":count(&sent),"leaderboard":top(&points),"weekly":top(&|u|weekly.get(text(&u["id"])).copied().unwrap_or(0.)),"recruiters":top(&|u|count(&u["recruits"])),"ranks":ranks,"countries":countries.into_iter().map(|(code,count)|json!({"code":code,"count":count})).collect::<Vec<_>>(),"soldierOfWeek":soldier_of_week,"tree":tree_users.iter().map(|u|json!({"key":tree_ids.get(text(&u["id"])),"username":if truthy(&u["verifiedAt"])&&!truthy(&u["hidden"])&&truthy(&u["username"]){u["username"].clone()}else{Value::Null},"rank":rank(u),"parent":tree_ids.get(text(&u["parent"]))})).collect::<Vec<_>>(),"treeTotal":users.len(),"remindersWaiting":if truthy(&mail_status["waiting"]){mail_status["waiting"].clone()}else{json!(0)},"tiers":tiers,"mrr":(mrr+0.5).floor(),"coffees":coffees});
        self.cache("public", &revision, &result).await?;
        Ok(result)
    }
    pub async fn legion(&self) -> Result<Value, Error> {
        let cached = self.0.get("legion").await?;
        if !cached.is_null() {
            return Ok(cached);
        }
        let revision = self.0.run(&["GET", &self.0.key("revision")]).await?;
        let everyone = self.0.all().await?;
        let users = everyone.iter().filter(|u| {
            truthy(&u["verifiedAt"])
                && truthy(&u["username"])
                && !truthy(&u["hidden"])
                && u["status"] != "deleting"
        });
        let tiers = corvus_core::army::config()["TIERS"]
            .as_array()
            .ok_or("configuration")?;
        let mut members = users
            .map(|u| {
                let full = public_soldier(u, true, self.0.now());
                let mut row = serde_json::Map::new();
                for key in ["username", "tier", "rank", "country", "link", "created"] {
                    if let Some(v) = full.get(key) {
                        row.insert(key.into(), v.clone());
                    }
                }
                Value::Object(row)
            })
            .collect::<Vec<_>>();
        let tier = |row: &Value| {
            tiers
                .iter()
                .position(|v| v == &row["tier"])
                .map(|i| i as i64)
                .unwrap_or(-1)
        };
        members.sort_by(|a, b| {
            tier(b)
                .cmp(&tier(a))
                .then_with(|| text(&a["created"]).cmp(text(&b["created"])))
        });
        let all = everyone
            .iter()
            .filter(|u| u["status"] != "deleting")
            .collect::<Vec<_>>();
        let hidden = all
            .iter()
            .filter(|u| truthy(&u["verifiedAt"]) && truthy(&u["username"]) && truthy(&u["hidden"]))
            .count();
        let gate = all
            .iter()
            .filter(|u| {
                !truthy(&u["verifiedAt"]) && truthy(&u["username"]) && truthy(&u["applied"])
            })
            .count();
        let result =
            json!({"updated":self.0.timestamp()?,"members":members,"hidden":hidden,"atGate":gate});
        self.cache("legion", &revision, &result).await?;
        Ok(result)
    }
}
