use super::{
    model,
    store::{Editor, command, numeric, nums, object, text},
};
use crate::{Error, compound_v2::model::now};
use corvus_core::army::truthy;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

pub fn digest(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}
pub fn uuid_like(value: &Value) -> bool {
    value.as_str().is_some_and(|s| {
        s.len() == 36
            && s.bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b) || b == b'-')
    })
}
impl Editor<'_> {
    pub async fn event(
        &self,
        name: &str,
        version: &str,
        raw: &Value,
        visitor: Option<&str>,
        details: &Value,
    ) -> Result<(), Error> {
        let a = model::attribution(raw, true, chrono::Utc::now().timestamp_millis());
        let v = if model::valid_version(&json!(version)) {
            version
        } else {
            "none"
        };
        let mut commands = vec![
            command(&["HINCRBY", &self.key("global"), name, "1"]),
            command(&["HINCRBY", &self.key(&format!("stats:{v}")), name, "1"]),
            command(&[
                "HINCRBY",
                &self.key("sources"),
                &format!("{}:{name}", text(&a["source"])),
                "1",
            ]),
        ];
        let mut safe = json!({});
        if visitor.is_some() && uuid_like(&details["visit"]) {
            safe["visit"] = details["visit"].clone();
        }
        for field in [
            "chip",
            "choice",
            "category",
            "transition",
            "tag",
            "poll",
            "option",
            "type",
            "t",
            "percent",
            "method",
            "amount",
            "opponent",
            "winner",
        ] {
            if let Some(value) = details.get(field) {
                safe[field] = if value.is_number() {
                    value.clone()
                } else {
                    json!(model::clean(value, 60))
                };
            }
        }
        if let Some(visitor) = visitor {
            let at = now();
            let day = &at[..10];
            let bucket = self.key(&format!("events:{v}:{day}"));
            let expiry = chrono::Utc::now()
                .date_naive()
                .and_hms_opt(0, 0, 0)
                .ok_or("date")?
                .and_utc()
                .timestamp()
                + model::RETENTION;
            let mut row = json!({"event":name,"version":v,"visitor":visitor});
            if let Some(m) = row.as_object_mut() {
                for source in [&a, &safe] {
                    if let Some(fields) = source.as_object() {
                        m.extend(fields.clone());
                    }
                }
            }
            row["at"] = json!(at);
            commands.extend([
                command(&["LPUSH", &bucket, &row.to_string()]),
                command(&["LTRIM", &bucket, "0", "9999"]),
                command(&["EXPIREAT", &bucket, &expiry.to_string()]),
            ]);
        }
        self.batch(commands).await?;
        self.measure(name, v, &a, safe["visit"].as_str().or(visitor), &safe)
            .await
    }
    async fn measure(
        &self,
        name: &str,
        v: &str,
        a: &Value,
        visitor: Option<&str>,
        details: &Value,
    ) -> Result<(), Error> {
        let retention = model::RETENTION.to_string();
        let engaged =
            !["view", "link_click", "donation_success", "donation_refund"].contains(&name);
        for touch in ["first", "last"] {
            let tags = if truthy(&a[touch]) { &a[touch] } else { a };
            let group = json!([
                touch,
                tags["source"],
                text(&tags["term"]),
                text(&tags["content"])
            ])
            .to_string();
            let hash = digest(&group);
            let id = &hash[..24];
            let k = self.key(&format!("campaign:{id}"));
            let mut commands = vec![
                command(&["HSET", &self.key("campaigns"), id, &group]),
                command(&["EXPIRE", &self.key("campaigns"), &retention]),
                command(&["EXPIRE", &k, &retention]),
            ];
            let mut counts: Vec<(&str, f64)> = Vec::new();
            match name {
                "view" => {
                    counts.push(("visits", 1.));
                    if visitor.is_some() {
                        counts.push(("linkedVisits", 1.));
                    }
                }
                "link_click" => counts.push(("clicks", 1.)),
                "vote" | "category" | "transition" | "battle" | "pick" | "poll" | "prediction"
                | "quick" => counts.push(("votes", 1.)),
                "army_join" => counts.push(("army", 1.)),
                "donation_click" => counts.push(("donationClicks", 1.)),
                "donation_success" => {
                    counts.push(("donations", 1.));
                    counts.push(("cents", numeric(&details["amount"])));
                }
                "donation_refund" => counts.push(("cents", -numeric(&details["amount"]))),
                "donation_adjustment" => counts.push(("cents", numeric(&details["amount"]))),
                _ => (),
            }
            for (field, n) in counts {
                commands.insert(0, command(&["HINCRBY", &k, field, &n.to_string()]));
            }
            if let Some(visitor) = visitor {
                if engaged {
                    commands.insert(0,command(&["EVAL","if redis.call('SET',KEYS[1],'1','NX','EX',ARGV[1]) then redis.call('HINCRBY',KEYS[2],'engaged',1) end;return 1","2",&self.key(&format!("engaged:{id}:{visitor}")),&k,&retention]));
                }
                if name == "play" || name.starts_with("watch:") {
                    let percent = if name == "play" {
                        "0"
                    } else {
                        name.split(':').nth(1).unwrap_or("0")
                    };
                    commands.insert(0,command(&["EVAL","local old=redis.call('GET',KEYS[1]);local n=tonumber(ARGV[1]);if not old then redis.call('HINCRBY',KEYS[2],'watchSamples',1) end;if not old or n>tonumber(old) then redis.call('SET',KEYS[1],n,'EX',ARGV[2]);redis.call('HINCRBY',KEYS[2],'watchSum',n-tonumber(old or '0')) end;return 1","2",&self.key(&format!("watch:{id}:{visitor}:{v}")),&k,percent,&retention]));
                }
            }
            self.batch(commands).await?;
        }
        Ok(())
    }
    pub async fn campaign_stats(&self) -> Result<Vec<Value>, Error> {
        let groups = object(&self.run(&["HGETALL", &self.key("campaigns")]).await?);
        let pairs: Vec<_> = groups.as_object().into_iter().flatten().collect();
        let values = self
            .batch(
                pairs
                    .iter()
                    .map(|(id, _)| command(&["HGETALL", &self.key(&format!("campaign:{id}"))]))
                    .collect(),
            )
            .await?;
        let mut rows = Vec::new();
        for ((_, group), value) in pairs.into_iter().zip(values) {
            let group: Value = serde_json::from_str(text(group))?;
            let n = nums(&value);
            let mut row =
                json!({"touch":group[0],"source":group[1],"slug":group[2],"content":group[3]});
            if let (Some(m), Some(n)) = (row.as_object_mut(), n.as_object()) {
                m.extend(n.clone());
            }
            row["engagementRate"] = json!(if numeric(&n["linkedVisits"]) != 0. {
                (numeric(&n["engaged"]) / numeric(&n["linkedVisits"])).min(1.)
            } else {
                0.
            });
            row["avgWatch"] = if numeric(&n["watchSamples"]) != 0. {
                json!(numeric(&n["watchSum"]) / numeric(&n["watchSamples"]))
            } else {
                Value::Null
            };
            rows.push(row);
        }
        rows.sort_by(|a, b| {
            numeric(&b["engagementRate"])
                .total_cmp(&numeric(&a["engagementRate"]))
                .then_with(|| numeric(&b["engaged"]).total_cmp(&numeric(&a["engaged"])))
        });
        Ok(rows)
    }
}
