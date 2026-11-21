//! Shared impact keys and compare-and-swap updates, including the linked v2 metric rows.
use super::{model, samples};
use crate::{
    AppState, Error,
    compound_v2::{
        model as legacy,
        store::{Registry, object},
    },
};
use corvus_core::{army::truthy, impact, metrics};
use serde_json::{Map, Value, json};

pub struct Impact<'a>(pub &'a AppState);
#[derive(Default)]
pub struct SaveOptions<'a> {
    pub source: Option<&'a str>,
    pub expected: Option<&'a Value>,
    pub seed: bool,
    pub observed_at: Option<&'a str>,
    pub registry: Option<&'a [Value]>,
}
fn parse(v: &Value) -> Option<Value> {
    serde_json::from_str(v.as_str()?).ok()
}
fn merge(out: &mut Value, patch: &Value) {
    if let Some(o) = patch.as_object() {
        for (k, v) in o {
            out[k] = v.clone();
        }
    }
}
fn known(raw: &Value, k: &str) -> bool {
    !raw[k].is_null() && raw[k] != ""
}
fn has_metrics(raw: &Value) -> bool {
    metrics::FIELDS.iter().any(|k| known(raw, k))
}
fn later(a: &Value, b: &Value) -> bool {
    impact::timestamp(a)
        .zip(impact::timestamp(b))
        .is_some_and(|(a, b)| a > b)
}
fn fallback_time(v: &Value) -> Option<i64> {
    if truthy(v) {
        impact::timestamp(v)
    } else {
        Some(946684800000)
    }
}
fn same_post(row: &Value, id: &str) -> bool {
    truthy(&row["post_url"]) && model::post_info(&row["post_url"]).is_ok_and(|v| v["id"] == id)
}
impl Impact<'_> {
    pub fn key(&self, part: &str) -> String {
        Registry(self.0).key(&format!("impact:{part}"))
    }
    pub async fn records(&self, cached: Option<&[Value]>) -> Result<Vec<Value>, Error> {
        let owned;
        let registry = if let Some(rows) = cached {
            rows
        } else {
            owned = Registry(self.0).videos().await?;
            &owned
        };
        let raw = self
            .0
            .store
            .command(vec!["HVALS".into(), self.key("posts")])
            .await?;
        let mut overrides = Map::new();
        for row in raw
            .as_array()
            .ok_or("invalid impact registry")?
            .iter()
            .filter_map(parse)
        {
            if let Some(id) = row["id"].as_str() {
                overrides.insert(id.into(), row);
            }
        }
        let mut by_id = Map::new();
        for v in registry {
            if truthy(&v["is_example"]) || !truthy(&v["post_url"]) {
                continue;
            }
            let Ok(info) = model::post_info(&v["post_url"]) else {
                continue;
            };
            let id = legacy::text(&info["id"]);
            let mut row = info.clone();
            for key in [
                "slug",
                "posted_at",
                "views",
                "likes",
                "comments",
                "shares",
                "view_metric",
            ] {
                if let Some(value) = v.get(key) {
                    row[key] = value.clone();
                }
            }
            row["label"] = if truthy(&v["hook_line"]) {
                v["hook_line"].clone()
            } else {
                v["slug"].clone()
            };
            row["account"] = if truthy(&info["account"]) {
                info["account"].clone()
            } else {
                v["account"].clone()
            };
            row["made_with_compound"] = json!(false);
            row["metric_source"] = if truthy(&v["metric_source"]) {
                v["metric_source"].clone()
            } else {
                json!("manual")
            };
            if let Some(at) = v.get("updated_at") {
                row["metrics_at"] = at.clone();
            }
            row["saves"] = v["saves"].clone();
            if let Some(o) = overrides.get(id) {
                merge(&mut row, o);
                if truthy(&v["synced_at"])
                    && truthy(&v["metric_source"])
                    && impact::timestamp(&v["synced_at"])
                        .zip(fallback_time(&o["metrics_at"]))
                        .is_some_and(|(a, b)| a > b)
                {
                    let mut sources = object(&row["field_sources"]);
                    for key in metrics::FIELDS {
                        if !v[key].is_null() {
                            row[key] = v[key].clone();
                            sources.insert((*key).into(), v["metric_source"].clone());
                        }
                    }
                    row["field_sources"] = json!(sources);
                    row["metrics_at"] = v["synced_at"].clone();
                    row["metric_source"] = v["metric_source"].clone();
                }
            }
            if by_id.get(id).is_none_or(|old| {
                fallback_time(&row["metrics_at"])
                    .zip(fallback_time(&old["metrics_at"]))
                    .is_some_and(|(a, b)| a > b)
            }) {
                by_id.insert(id.into(), row);
            }
        }
        for (id, row) in overrides {
            if !by_id.contains_key(&id) {
                by_id.insert(id, row);
            }
        }
        Ok(by_id
            .into_values()
            .map(|mut row| {
                let linked = registry.iter().find(|v| {
                    !truthy(&v["is_example"])
                        && v["slug"] == row["slug"]
                        && same_post(v, legacy::text(&row["id"]))
                });
                row["account"] = json!(impact::account_handle(
                    legacy::text(&row["platform"]),
                    &row["account"]
                ));
                row["registry_match"] = json!(linked.is_some());
                row["vote_code"] = if let Some(v) = linked {
                    json!(legacy::vote_code(v))
                } else if truthy(&row["vote_code"]) {
                    row["vote_code"].clone()
                } else {
                    Value::Null
                };
                let classification = metrics::classification(&row);
                merge(&mut row, &classification);
                row["made_with_compound"] = metrics::eligibility(&row)["eligible"].clone();
                row
            })
            .collect())
    }
    pub async fn save(&self, raw: &Value, options: SaveOptions<'_>) -> Result<Value, Error> {
        let source = options.source.unwrap_or("manual");
        let owned;
        let registry = if let Some(rows) = options.registry {
            rows
        } else {
            owned = Registry(self.0).videos().await?;
            &owned
        };
        let info = model::post_info(&raw["post_url"])?;
        let id = legacy::text(&info["id"]);
        let old = self
            .0
            .store
            .command(vec!["HGET".into(), self.key("posts"), id.into()])
            .await?;
        let existing = self
            .records(Some(registry))
            .await?
            .into_iter()
            .find(|v| v["id"] == id)
            .unwrap_or(json!({}));
        let mut next = model::validate(raw, &existing)?;
        let classification = metrics::classification(&next);
        merge(&mut next, &classification);
        next["made_with_compound"] = metrics::eligibility(&next)["eligible"].clone();
        let current = legacy::now();
        let now = options
            .observed_at
            .filter(|s| !s.is_empty())
            .unwrap_or(&current);
        // Stored observations must have unambiguous ISO/RFC timestamps; never invent an observation time.
        if impact::timestamp(&json!(now)).is_none() {
            return Err("Invalid observation time.".into());
        }
        next["first_seen_at"] = if truthy(&existing["first_seen_at"]) {
            existing["first_seen_at"].clone()
        } else if truthy(&existing["metrics_at"]) {
            existing["metrics_at"].clone()
        } else {
            json!(now)
        };
        next["field_sources"] = json!(object(&existing["field_sources"]));
        next["field_observed"] = json!(object(&existing["field_observed"]));
        let mut raw = raw.clone();
        for key in metrics::FIELDS {
            if !existing[key].is_null() {
                if next["field_sources"][key].is_null() {
                    next["field_sources"][key] = if truthy(&existing["metric_source"]) {
                        existing["metric_source"].clone()
                    } else {
                        json!("unknown")
                    };
                }
                if truthy(&existing["metrics_at"]) && next["field_observed"][key].is_null() {
                    next["field_observed"][key] = existing["metrics_at"].clone();
                }
            }
            if known(&raw, key)
                && ((impact::source_kind(legacy::text(&next["field_sources"][key])) == "official"
                    && ["scraped", "provider"].contains(&impact::source_kind(source)))
                    || later(&next["field_observed"][key], &json!(now)))
            {
                if let Some(o) = raw.as_object_mut() {
                    o.remove(*key);
                }
                next[key] = existing[key].clone();
            }
            if known(&raw, key) {
                next["field_sources"][key] = json!(source);
                next["field_observed"][key] = json!(now);
            }
        }
        if has_metrics(&raw) {
            next["metric_source"] = json!(source);
            next["metrics_at"] = json!(now);
        } else {
            if next["metric_source"].is_null() {
                next["metric_source"] = json!("unreported");
            }
            if next.get("metrics_at").is_none() {
                next["metrics_at"] = Value::Null;
            }
        }
        if options.seed {
            if let Some(v) = raw.get("measured_date") {
                next["measured_date"] = v.clone();
            }
            next["metrics_at"] = Value::Null;
        } else if let Some(o) = next.as_object_mut() {
            o.remove("measured_date");
        }
        if let Some(sample) = metrics::first_day_sample(&next)
            && (!truthy(&next["first24_sample"])
                || impact::timestamp(&sample["at"])
                    .zip(impact::timestamp(&next["first24_sample"]["at"]))
                    .is_some_and(|(a, b)| a >= b))
        {
            next["first24_velocity"] = sample["velocity"].clone();
            next["first24_sample"] = sample;
        }
        // Compare decoded data, not serializer key order; the transaction still compares original bytes.
        if let Some(expected) = options.expected.filter(|v| truthy(v))
            && model::public_post(&existing) != model::public_post(expected)
        {
            return Ok(json!(false));
        }
        let mut changes = Vec::new();
        if !options.seed && has_metrics(&raw) {
            for row in registry.iter().filter(|v| same_post(v, id)) {
                let slug = legacy::text(&row["slug"]);
                let current = Registry(self.0).raw(slug).await?;
                let Some(mut patch) = parse(&current) else {
                    continue;
                };
                if !same_post(&patch, id) {
                    continue;
                }
                for key in metrics::FIELDS {
                    if known(&raw, key) {
                        patch[key] = next[key].clone();
                    }
                }
                if truthy(&raw["view_metric"]) {
                    patch["view_metric"] = next["view_metric"].clone();
                }
                patch["updated_at"] = json!(now);
                patch["metric_source"] = json!(source);
                if source != "manual" {
                    patch["synced_at"] = json!(now);
                }
                changes.push(json!({"slug":slug,"old":current,"next":patch.to_string()}));
            }
        }
        let mut sample = json!({});
        for key in ["platform", "posted_at", "metrics_at"] {
            if let Some(v) = next.get(key) {
                sample[key] = v.clone();
            }
        }
        for key in metrics::FIELDS {
            if !next[key].is_null() {
                sample[key] = next[key].clone();
            }
        }
        let hour = if !options.seed && has_metrics(&raw) {
            now.get(..13).ok_or("Invalid observation time.")?
        } else {
            ""
        };
        let result = Registry(self.0)
            .eval(
                include_str!("../../migration/impact-save.lua"),
                &[
                    self.key("posts"),
                    Registry(self.0).key("videos"),
                    self.key(&format!("history:{id}")),
                    self.key(&format!("hours:{id}")),
                ],
                &[
                    id.into(),
                    legacy::text(&old).into(),
                    next.to_string(),
                    if options.seed { "1" } else { "0" }.into(),
                    json!(changes).to_string(),
                    hour.into(),
                    sample.to_string(),
                ],
            )
            .await?;
        match legacy::count(&result) {
            -2 => {
                if options.expected.is_some() {
                    Ok(json!(false))
                } else {
                    Err("This post changed. Please save again.".into())
                }
            }
            n if n < 0 => Err("Impact registry is full.".into()),
            _ => Ok(next),
        }
    }
    pub async fn settings(&self) -> Result<Value, Error> {
        let raw = self.0.store.get(&self.key("settings")).await?;
        let mut out = json!({"include_twitch_archives":false});
        if let Some(v) = parse(&raw) {
            merge(&mut out, &v);
        }
        Ok(out)
    }
    pub async fn account_status(&self, all: &[Value]) -> Result<Vec<Value>, Error> {
        let raw = self
            .0
            .store
            .command(vec!["HGETALL".into(), self.key("account-sync")])
            .await?;
        let states = object(&raw);
        Ok(impact::configured_accounts().into_iter().map(|mut row|{
        let platform=legacy::text(&row["platform"]).to_owned();let account=legacy::text(&row["account"]).to_owned();
        let defaults=if platform=="li"{json!({"mode":"manual","note":"Manual import required. LinkedIn analytics API is not connected."})}else if platform=="tw"&&self.0.settings.get("TWITCH_CLIENT_ID").is_none(){json!({"mode":"not_configured","error":"TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not configured."})}else if ["tt","ig"].contains(&platform.as_str())&&self.0.settings.get("ORIANE_API_KEY").is_none(){json!({"mode":"not_configured","error":"ORIANE_API_KEY not configured. Public-browser fallback not checked yet."})}else{json!({"mode":"not_checked","note":"Not checked yet."})};merge(&mut row,&defaults);
        if let Some(v)=states.get(&format!("{platform}:{account}")).and_then(parse){merge(&mut row,&v);}
        let posts=all.iter().filter(|p|p["platform"]==platform&&impact::normalized_handle(&p["account"])==impact::normalized_handle(&json!(account))).collect::<Vec<_>>();row["ingested"]=json!(posts.len());row["counted"]=json!(posts.iter().filter(|p|truthy(&p["made_with_compound"])).count());row
    }).collect())
    }
    pub async fn save_status(
        &self,
        platform: &str,
        account: &str,
        state: &Value,
    ) -> Result<(), Error> {
        let mut value = state.clone();
        value["at"] = json!(legacy::now());
        self.0
            .store
            .command(vec![
                "HSET".into(),
                self.key("account-sync"),
                format!("{platform}:{account}"),
                value.to_string(),
            ])
            .await?;
        Ok(())
    }
    pub async fn click_report(&self) -> Result<Value, Error> {
        let day = legacy::now();
        let out = self
            .0
            .store
            .pipeline(vec![
                vec!["HGETALL".into(), self.key("clicks")],
                vec![
                    "HGETALL".into(),
                    self.key(&format!("clicks:{}", &day[..10])),
                ],
            ])
            .await?;
        let today = object(&out[1]);
        let mut rows=object(&out[0]).into_iter().map(|(id,total)|json!({"id":id,"label":id,"total":legacy::number(&total),"today":legacy::number(today.get(&id).unwrap_or(&json!(0))),"timeZone":"UTC"})).collect::<Vec<_>>();
        rows.sort_by(|a, b| {
            legacy::number(&b["total"])
                .unwrap_or(0.0)
                .total_cmp(&legacy::number(&a["total"]).unwrap_or(0.0))
        });
        Ok(
            json!({"total":rows.iter().filter_map(|r|r["total"].as_f64()).fold(0.0,|sum,n|sum+n),"rows":rows}),
        )
    }
    pub async fn report(&self, private: bool) -> Result<Value, Error> {
        let (all, clicks, history, status) = tokio::try_join!(
            self.records(None),
            self.click_report(),
            async {
                Ok::<_, Error>(
                    self.0
                        .store
                        .command(vec![
                            "LRANGE".into(),
                            self.key("snapshots"),
                            "0".into(),
                            "4319".into(),
                        ])
                        .await?,
                )
            },
            async { Ok::<_, Error>(self.0.store.get(&self.key("sync-status")).await?) }
        )?;
        let prefs = self.settings().await?;
        let mut posts = all
            .iter()
            .filter(|p| {
                (truthy(&prefs["include_twitch_archives"]) || p["video_kind"] != "archive")
                    && (private || truthy(&p["made_with_compound"]))
            })
            .map(|p| {
                let mut row = model::public_post(p);
                if private {
                    row["eligibility"] = metrics::eligibility(p);
                }
                row
            })
            .collect::<Vec<_>>();
        posts.sort_by(|a, b| {
            b["score"]
                .as_f64()
                .unwrap_or(-1.0)
                .total_cmp(&a["score"].as_f64().unwrap_or(-1.0))
                .then_with(|| legacy::text(&a["id"]).cmp(legacy::text(&b["id"])))
        });
        let counted = posts
            .iter()
            .filter(|p| truthy(&p["made_with_compound"]))
            .collect::<Vec<_>>();
        let mut totals = json!({"videos":counted.len(),"views_reported":counted.iter().filter(|p|!p["views"].is_null()).count(),"score_partial":counted.iter().any(|p|p["coverage"]["partial"]==true)});
        for key in ["views", "engagements", "score"] {
            let ns = counted
                .iter()
                .filter_map(|p| p[key].as_f64())
                .collect::<Vec<_>>();
            totals[key] = if counted.is_empty() {
                json!(0)
            } else if ns.is_empty() {
                Value::Null
            } else {
                json!(ns.iter().sum::<f64>())
            };
        }
        let history = history
            .as_array()
            .ok_or("invalid impact snapshots")?
            .iter()
            .filter_map(parse)
            .filter(|v| v["rule_version"] == 3)
            .rev()
            .collect::<Vec<_>>();
        let mut out = json!({"posts":posts,"totals":totals,"clicks":clicks,"history":history,"sync":parse(&status),"updated_at":legacy::now()});
        if private {
            out["accounts"] = json!(self.account_status(&all).await?);
            out["settings"] = self.settings().await?;
        }
        Ok(out)
    }
    pub async fn snapshot(&self) -> Result<Value, Error> {
        let report = self.report(false).await?;
        let mut s = json!({"at":legacy::now(),"rule_version":3});
        merge(&mut s, &report["totals"]);
        Registry(self.0)
            .eval(
                "redis.call('LPUSH',KEYS[1],ARGV[1]);redis.call('LTRIM',KEYS[1],0,4319);return 1",
                &[self.key("snapshots")],
                &[s.to_string()],
            )
            .await?;
        Ok(s)
    }
    pub async fn rebuild_history(&self, row: &Value) -> Result<Value, Error> {
        let id = legacy::text(&row["id"]);
        let raw = self
            .0
            .store
            .command(vec!["HGET".into(), self.key("posts"), id.into()])
            .await?;
        let Some(mut doc) = parse(&raw) else {
            return Ok(json!({"hours":0,"first":false}));
        };
        let history = self
            .0
            .store
            .command(vec![
                "LRANGE".into(),
                self.key(&format!("history:{id}")),
                "0".into(),
                "-1".into(),
            ])
            .await?;
        let mut rows = history
            .as_array()
            .ok_or("invalid impact history")?
            .iter()
            .map(|v| parse(v).ok_or("invalid impact history"))
            .collect::<Result<Vec<_>, _>>()?;
        rows.push(doc.clone());
        let hours = samples::hour_samples(&rows);
        let posted = impact::timestamp(&doc["posted_at"]);
        let first = impact::best_sample(
            &hours
                .values()
                .filter(|s| posted.is_some() && impact::timestamp(&s["posted_at"]) == posted)
                .cloned()
                .collect::<Vec<_>>(),
        );
        if !hours.is_empty() {
            let mut cmd = vec!["HSET".into(), self.key(&format!("hours:{id}"))];
            for (h, s) in &hours {
                cmd.push(h.into());
                cmd.push(s.to_string());
            }
            self.0.store.command(cmd).await?;
        }
        if let Some(sample) = &first
            && (!truthy(&doc["first24_sample"])
                || impact::timestamp(&sample["at"])
                    .zip(impact::timestamp(&doc["first24_sample"]["at"]))
                    .is_some_and(|(a, b)| a >= b))
        {
            doc["first24_sample"] = sample.clone();
            doc["first24_velocity"] = sample["velocity"].clone();
            Registry(self.0).eval("if redis.call('HGET',KEYS[1],ARGV[1])==ARGV[2] then return redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]) end; return -1",&[self.key("posts")],&[id.into(),legacy::text(&raw).into(),doc.to_string()]).await?;
        }
        Ok(json!({"hours":hours.len(),"first":first.is_some()}))
    }
}
