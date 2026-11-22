use super::{model, payments, security};
use crate::{
    AppState, Error,
    compound_v2::model::{now, number},
};
use corvus_core::army::truthy;
use serde_json::{Value, json};
use std::collections::HashSet;
use url::Url;
pub struct Editor<'a>(pub &'a AppState);
pub fn command(args: &[&str]) -> Vec<String> {
    args.iter().map(|s| (*s).into()).collect()
}
pub fn numeric(v: &Value) -> f64 {
    number(v).filter(|n| n.is_finite()).unwrap_or(0.)
}
pub fn text(v: &Value) -> &str {
    v.as_str().unwrap_or("")
}
pub fn object(v: &Value) -> Value {
    Value::Object(crate::compound_v2::store::object(v))
}
pub fn nums(v: &Value) -> Value {
    let mut out = object(v);
    if let Some(m) = out.as_object_mut() {
        for v in m.values_mut() {
            *v = json!(numeric(v));
        }
    }
    out
}
pub fn normal(mut v: Value) -> Value {
    if !truthy(&v) {
        return Value::Null;
    }
    if !v.is_object() {
        return Value::Null;
    }
    for k in ["slot", "iteration"] {
        if !truthy(&v[k]) {
            v[k] = json!(1);
        }
    }
    for k in ["cues", "transitions"] {
        if !v[k].is_array() {
            v[k] = json!([]);
        }
    }
    v
}
impl Editor<'_> {
    pub fn key(&self, part: &str) -> String {
        format!("{}:{part}", security::prefix(&self.0.settings))
    }
    pub async fn run(&self, args: &[&str]) -> Result<Value, Error> {
        Ok(self.0.store.command(command(args)).await?)
    }
    pub async fn batch(&self, commands: Vec<Vec<String>>) -> Result<Vec<Value>, Error> {
        Ok(self.0.store.pipeline(commands).await?)
    }
    pub async fn eval(
        &self,
        script: &str,
        keys: &[String],
        args: &[String],
    ) -> Result<Value, Error> {
        let mut cmd = vec!["EVAL".into(), script.into(), keys.len().to_string()];
        cmd.extend_from_slice(keys);
        cmd.extend_from_slice(args);
        Ok(self.0.store.command(cmd).await?)
    }
    pub async fn get(&self, part: &str) -> Result<Value, Error> {
        let raw = self.run(&["GET", &self.key(part)]).await?;
        if let Some(s) = raw.as_str() {
            Ok(serde_json::from_str(s)?)
        } else {
            Ok(Value::Null)
        }
    }
    pub async fn mget(&self, keys: &[String]) -> Result<Vec<Value>, Error> {
        if keys.is_empty() {
            return Ok(Vec::new());
        }
        let mut args = vec!["MGET".into()];
        args.extend_from_slice(keys);
        let raw = self.0.store.command(args).await?;
        raw.as_array()
            .ok_or("records unavailable")?
            .iter()
            .map(|v| {
                if let Some(s) = v.as_str() {
                    serde_json::from_str(s).map_err(Into::into)
                } else {
                    Ok(Value::Null)
                }
            })
            .collect()
    }
    pub async fn version(&self, id: &str) -> Result<Value, Error> {
        if !model::valid_version(&json!(id)) {
            return Ok(Value::Null);
        }
        Ok(normal(self.get(&format!("version:{id}")).await?))
    }
    pub async fn versions(&self) -> Result<Vec<Value>, Error> {
        let ids = self
            .run(&["LRANGE", &self.key("versions"), "0", "199"])
            .await?;
        let keys: Vec<_> = ids
            .as_array()
            .into_iter()
            .flatten()
            .map(|v| self.key(&format!("version:{}", text(v))))
            .collect();
        Ok(self
            .mget(&keys)
            .await?
            .into_iter()
            .filter(truthy)
            .map(normal)
            .collect())
    }
    pub async fn publish(&self, data: &Value) -> Result<Value, Error> {
        let url = Url::parse(text(&data["url"])).map_err(|_| "video")?;
        if url.scheme() != "https"
            || !url
                .host_str()
                .is_some_and(|h| h.ends_with(".public.blob.vercel-storage.com"))
            || !url.path().starts_with("/compound/")
        {
            return Err("video".into());
        }
        let duration = data["duration"]
            .as_f64()
            .filter(|n| n.is_finite() && *n > 0. && *n <= 600.)
            .ok_or("duration")?;
        let slot = if truthy(&data["slot"]) {
            numeric(&data["slot"])
        } else {
            1.
        };
        if ![1., 2., 3.].contains(&slot) {
            return Err("slot".into());
        }
        let cuts = if truthy(&data["cutlist"]) {
            &data["cutlist"]
        } else if truthy(&data["transitions"]) {
            &data["transitions"]
        } else {
            &Value::Null
        };
        let empty_cues = json!([]);
        let record = json!({"slot":slot,"transitions":model::cutlist(cuts,duration)?,"url":url.as_str(),"label":model::clean(&data["label"],100),"changelog":model::clean(if truthy(&data["changelog"]){&data["changelog"]}else{&data["label"]},600),"duration":duration,"width":if numeric(&data["width"])==0.{720.}else{numeric(&data["width"])},"height":if numeric(&data["height"])==0.{1280.}else{numeric(&data["height"])},"uploaded_at":now(),"cues":model::cues(if truthy(&data["cues"]){&data["cues"]}else{&empty_cues},duration)?});
        if text(&record["label"]).is_empty() {
            return Err("label".into());
        }
        if numeric(
            &self
                .run(&["HEXISTS", &self.key("iterations"), &slot.to_string()])
                .await?,
        ) == 0.
        {
            let old: Vec<_> = self
                .versions()
                .await?
                .into_iter()
                .filter(|v| numeric(&v["slot"]) == slot)
                .collect();
            let max = old
                .iter()
                .map(|v| numeric(&v["iteration"]))
                .fold(old.len() as f64, f64::max);
            self.run(&[
                "HSETNX",
                &self.key("iterations"),
                &slot.to_string(),
                &max.to_string(),
            ])
            .await?;
        }
        let script = "local n=redis.call('INCR',KEYS[1]);local id='v'..n;local v=cjson.decode(ARGV[1]);v.id=id;v.iteration=redis.call('HINCRBY',KEYS[5],tostring(v.slot),1);redis.call('HSET',KEYS[4],tostring(v.slot),id);redis.call('SET',ARGV[2]..id,cjson.encode(v));redis.call('LPUSH',KEYS[2],id);redis.call('SET',KEYS[3],id);return cjson.encode(v)";
        let out = self
            .eval(
                script,
                &[
                    self.key("sequence"),
                    self.key("versions"),
                    self.key("current_version"),
                    self.key("slots"),
                    self.key("iterations"),
                ],
                &[record.to_string(), self.key("version:")],
            )
            .await?;
        Ok(normal(serde_json::from_str(text(&out))?))
    }
    pub async fn rename_items(&self, id: &str, labels: &Value) -> Result<Value, Error> {
        let list = labels
            .as_array()
            .filter(|l| !l.is_empty() && l.len() <= 120)
            .ok_or("label")?;
        if !model::valid_version(&json!(id)) {
            return Err("label".into());
        }
        let v = self.version(id).await?;
        if v.is_null() {
            return Err("version".into());
        }
        let mut seen = HashSet::new();
        let mut safe = Vec::new();
        for item in list {
            let label = model::clean(&item["label"], 100);
            let id = &item["id"];
            if label.is_empty()
                || !seen.insert(id.to_string())
                || !v["transitions"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .any(|v| v["id"] == *id)
            {
                return Err("label".into());
            }
            safe.push(json!({"id":id,"label":label}));
        }
        let script = "local raw=redis.call('GET',KEYS[1]);if not raw then return nil end;local v=cjson.decode(raw);local labels=cjson.decode(ARGV[1]);for _,t in ipairs(v.transitions) do for _,l in ipairs(labels) do if t.id==l.id then t.label=l.label end end end;redis.call('SET',KEYS[1],cjson.encode(v),'KEEPTTL');return cjson.encode(v)";
        let raw = self
            .eval(
                script,
                &[self.key(&format!("version:{id}"))],
                &[json!(safe).to_string()],
            )
            .await?;
        if raw.is_null() {
            return Ok(Value::Null);
        }
        Ok(normal(serde_json::from_str(text(&raw))?))
    }
    pub async fn summary(&self, requested: &str) -> Result<Value, Error> {
        let history = self.versions().await?;
        let root = self
            .batch(vec![
                command(&["GET", &self.key("current_version")]),
                command(&["GET", &self.key("live-poll")]),
                command(&["ZREVRANGE", &self.key("scores"), "0", "49", "WITHSCORES"]),
                command(&["GET", &self.key("fund:live")]),
                command(&["GET", &self.key("fund:test")]),
                command(&["GET", &self.key("fund-late:live")]),
                command(&["GET", &self.key("fund-late:test")]),
                command(&["HGETALL", &self.key("slots")]),
                command(&["GET", &self.key("revolut")]),
                command(&["HGETALL", &self.key("standings")]),
            ])
            .await?;
        let current = &root[0];
        let poll: Value = if root[1].is_null() {
            Value::Null
        } else {
            serde_json::from_str(text(&root[1]))?
        };
        let scores = root[2].as_array().cloned().unwrap_or_default();
        let slots = object(&root[7]);
        let revolut: Value = if root[8].is_null() {
            Value::Null
        } else {
            serde_json::from_str(text(&root[8]))?
        };
        let selected = if requested == "none" {
            Value::Null
        } else {
            history
                .iter()
                .find(|v| v["id"] == requested)
                .or_else(|| history.iter().find(|v| v["id"] == *current))
                .or_else(|| history.first())
                .cloned()
                .unwrap_or(Value::Null)
        };
        let id = selected["id"].as_str().unwrap_or("none");
        let hashes = self
            .batch(vec![
                command(&["HGETALL", &self.key("global")]),
                command(&["HGETALL", &self.key("prediction")]),
                command(&["HGETALL", &self.key(&format!("stats:{id}"))]),
                command(&["HGETALL", &self.key(&format!("heat:{id}"))]),
            ])
            .await?;
        let keys: Vec<_> = scores
            .iter()
            .step_by(2)
            .map(|v| self.key(&format!("helper:{}", text(v))))
            .collect();
        let people = self.mget(&keys).await?;
        let helpers:Vec<_>=people.iter().enumerate().filter(|(_,p)|truthy(&p["handle"])&&!truthy(&p["hidden"])).take(10).map(|(i,p)|json!({"handle":p["handle"],"score":numeric(scores.get(i*2+1).unwrap_or(&Value::Null))})).collect();
        let cuts:Vec<_>=(1..=3).map(|slot|{let records:Vec<_>=history.iter().filter(|v|numeric(&v["slot"])==f64::from(slot)).cloned().collect();json!({"slot":slot,"current":history.iter().find(|v|v["id"]==slots[slot.to_string()]).or_else(||records.first()).cloned().unwrap_or(Value::Null),"history":records})}).collect();
        let mut visible = Vec::new();
        for id in cuts
            .iter()
            .map(|c| &c["current"]["id"])
            .chain([&selected["id"]])
        {
            if truthy(id) && !visible.contains(id) {
                visible.push(id.clone());
            }
        }
        let metrics = self
            .batch(
                visible
                    .iter()
                    .flat_map(|id| {
                        [
                            command(&["HGETALL", &self.key(&format!("stats:{}", text(id)))]),
                            command(&["HGETALL", &self.key(&format!("heat:{}", text(id)))]),
                        ]
                    })
                    .collect(),
            )
            .await?;
        let mut by_version = json!({});
        for (i, id) in visible.iter().enumerate() {
            by_version[text(id)] =
                json!({"stats":nums(&metrics[i*2]),"heat":nums(&metrics[i*2+1])});
        }
        let mode = payments::mode(&self.0.settings);
        let rev = &revolut[mode];
        let stripe = numeric(&root[if mode == "live" { 3 } else { 4 }]);
        let late = numeric(&root[if mode == "live" { 5 } else { 6 }]);
        Ok(
            json!({"cuts":cuts,"byVersion":by_version,"standings":nums(&root[9]),"current_version":current,"versions":history,"selected":selected,"global":nums(&hashes[0]),"prediction":nums(&hashes[1]),"stats":nums(&hashes[2]),"heat":nums(&hashes[3]),"helpers":helpers,"livePoll":if numeric(&poll["expires"])>(chrono::Utc::now().timestamp_millis()as f64){poll}else{Value::Null},"fund":{"revolut_url":revolut["url"].as_str().filter(|s|!s.is_empty()).or(self.0.settings.get("COMPOUND_REVOLUT_URL")),"revolut":numeric(&rev["total"]),"revolutLate":numeric(&rev["late"]),"stripe":stripe,"total":stripe+numeric(&rev["total"]),"late":late+numeric(&rev["late"]),"goal":model::GOAL,"deadline":model::FUND_DEADLINE,"mode":mode,"ready":self.0.settings.get(if mode=="live"{"COMPOUND_PAYMENT_LINK_LIVE"}else{"COMPOUND_PAYMENT_LINK_TEST"}).is_some()},"deadline":model::DEADLINE,"updated":now()}),
        )
    }
}
