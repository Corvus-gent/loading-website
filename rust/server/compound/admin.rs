use super::{
    payments,
    store::{Editor, command, numeric, nums, text},
};
use crate::{Error, compound_v2::model::now};
use corvus_core::army::truthy;
use serde_json::{Value, json};
use std::collections::HashSet;
use url::Url;
impl Editor<'_> {
    pub async fn private_stats(&self, requested: &str) -> Result<Value, Error> {
        let history = self.versions().await?;
        let current = self.run(&["GET", &self.key("current_version")]).await?;
        let v = if !requested.is_empty() {
            requested
        } else {
            current.as_str().unwrap_or("none")
        };
        let ids = self
            .run(&["LRANGE", &self.key(&format!("texts:{v}")), "0", "199"])
            .await?;
        let keys = ids
            .as_array()
            .into_iter()
            .flatten()
            .map(|id| self.key(&format!("text:{}", text(id))))
            .collect::<Vec<_>>();
        let texts = self
            .mget(&keys)
            .await?
            .into_iter()
            .filter(|n| truthy(n) && !truthy(&n["hidden"]))
            .map(|mut n| {
                if let Some(m) = n.as_object_mut() {
                    m.remove("uid");
                }
                n
            })
            .collect::<Vec<_>>();
        let lists = self
            .batch(vec![
                command(&["LRANGE", &self.key(&format!("polls:{v}")), "0", "99"]),
                command(&["LRANGE", &self.key("polls:all"), "0", "99"]),
            ])
            .await?;
        let mut seen = HashSet::new();
        let keys = lists
            .iter()
            .filter_map(Value::as_array)
            .flatten()
            .filter(|id| truthy(id) && seen.insert(text(id).to_owned()))
            .map(|id| self.key(&format!("poll:{}", text(id))))
            .collect::<Vec<_>>();
        let mut polls = history
            .iter()
            .find(|row| row["id"] == v)
            .and_then(|row| row["cues"].as_array())
            .cloned()
            .unwrap_or_default();
        polls.extend(self.mget(&keys).await?.into_iter().filter(truthy));
        let stats = self
            .batch(
                history
                    .iter()
                    .map(|v| command(&["HGETALL", &self.key(&format!("stats:{}", text(&v["id"])))]))
                    .collect(),
            )
            .await?;
        let mut out = self.summary(v).await?;
        out["campaigns"] = json!(self.campaign_stats().await?);
        out["polls"] = json!(polls);
        out["perVersion"] = json!(
            history
                .into_iter()
                .zip(stats)
                .map(|(mut row, n)| {
                    row["stats"] = nums(&n);
                    row
                })
                .collect::<Vec<_>>()
        );
        out["sources"] = nums(&self.run(&["HGETALL", &self.key("sources")]).await?);
        out["donations"] = nums(
            &self
                .run(&[
                    "HGETALL",
                    &self.key(&format!(
                        "donation-sources:{}",
                        payments::mode(&self.0.settings)
                    )),
                ])
                .await?,
        );
        out["texts"] = json!(texts);
        Ok(out)
    }
    pub async fn hide_text(&self, id: &str) -> Result<bool, Error> {
        let mut item = self.get(&format!("text:{id}")).await?;
        if item.is_null() {
            return Ok(false);
        }
        if !truthy(&item["hidden"]) {
            item["hidden"] = json!(true);
            self.run(&[
                "SET",
                &self.key(&format!("text:{id}")),
                &item.to_string(),
                "KEEPTTL",
            ])
            .await?;
            if numeric(&item["points"]) != 0. {
                self.score(text(&item["uid"]), -(numeric(&item["points"]) as i64))
                    .await?;
            }
        }
        Ok(true)
    }
    pub async fn set_revolut(&self, data: &Value) -> Result<Value, Error> {
        let mode = payments::mode(&self.0.settings);
        // Number(undefined) is NaN; unlike explicit null it must not be accepted as zero.
        let total = data
            .get("total")
            .and_then(crate::compound_v2::model::number)
            .ok_or("amount")?;
        let late = if truthy(&data["late"]) {
            crate::compound_v2::model::number(&data["late"]).ok_or("amount")?
        } else {
            0.
        };
        if [total, late]
            .iter()
            .any(|n| !n.is_finite() || n.fract() != 0. || *n < 0. || *n > 10000000.)
        {
            return Err("amount".into());
        }
        let url = if truthy(&data["url"]) {
            let url = Url::parse(text(&data["url"])).map_err(|_| "revolut link")?;
            if url.scheme() != "https"
                || !url
                    .host_str()
                    .is_some_and(|h| ["revolut.me", "www.revolut.me"].contains(&h))
                || !url.username().is_empty()
                || url.password().is_some()
                || url.path() == "/"
            {
                return Err("revolut link".into());
            }
            Some(url.to_string())
        } else {
            None
        };
        let old = self.get("revolut").await?;
        let mut next = if old.is_object() {
            old.clone()
        } else {
            json!({})
        };
        next["url"] = url.map(Value::String).unwrap_or_else(|| {
            if truthy(&old["url"]) {
                old["url"].clone()
            } else {
                self.0
                    .settings
                    .get("COMPOUND_REVOLUT_URL")
                    .map(|s| json!(s))
                    .unwrap_or(Value::Null)
            }
        });
        next[mode] = json!({"total":total,"late":late,"updated":now()});
        let raw=self.eval("local old=redis.call('GET',KEYS[1]);redis.call('SET',KEYS[1],ARGV[1]);return old or '{}'",&[self.key("revolut")],&[next.to_string()]).await?;
        let before: Value = serde_json::from_str(text(&raw))?;
        let delta = total + late - numeric(&before[mode]["total"]) - numeric(&before[mode]["late"]);
        if delta != 0. {
            let fallback = json!({"source":"other","content":"manual-revolut"});
            self.event(
                "donation_adjustment",
                "none",
                if truthy(&data["attribution"]) {
                    &data["attribution"]
                } else {
                    &fallback
                },
                None,
                &json!({"method":"revolut","amount":delta}),
            )
            .await?;
        }
        Ok(next[mode].clone())
    }
}
