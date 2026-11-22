//! Fenced snapshot construction. Not routed until source/recovery parity is complete.
use crate::{AppState, Error, visitors};
use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use serde_json::{Map, Value, json};
use std::{collections::HashMap, future::Future, pin::Pin, sync::Arc, time::Duration};
use tokio::{
    sync::{Mutex, OnceCell},
    task::JoinSet,
    time::Instant,
};

pub const PAGES: &[&str] = &[
    "overview", "army", "pidgy", "games", "map", "music", "hunt", "x", "coffee", "private",
    "status",
];
pub const TABLES: &[&str] = &[
    "army",
    "outbound",
    "funnel",
    "links",
    "pidgy_out",
    "calls",
    "search",
    "terminal",
    "hours",
    "pages",
    "feathers",
    "referrers",
];
pub const FIRST_DAY: &str = "2026-11-02";
const PUBLISH: &str = "if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('SET',KEYS[2],ARGV[2]) if tonumber(ARGV[3])>0 then redis.call('EXPIRE',KEYS[2],ARGV[3]) end if ARGV[4]=='1' then redis.call('SET',KEYS[3],ARGV[2]);if tonumber(ARGV[5])>0 then redis.call('EXPIRE',KEYS[3],ARGV[5]) end end return 1";
const RELEASE: &str =
    "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end";
const RETRY: &str = "if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('SET',KEYS[1],'retry','EX','10') end return 1";

pub fn ttl(page: &str) -> i64 {
    match page {
        "x" => 900,
        "coffee" => 1800,
        _ => 60,
    }
}
pub fn key(page: &str, day: &str) -> String {
    format!("stats:snap:{page}:{day}")
}
pub fn valid(page: &str, day: &str, now: i64) -> bool {
    PAGES.contains(&page)
        && day >= FIRST_DAY
        && day <= visitors::day(now).as_str()
        && visitors::model::valid_day(day)
        && NaiveDate::parse_from_str(day, "%Y-%m-%d").is_ok()
        && day != "all"
}
pub fn fresh(s: &Value, page: &str, day: &str, now: i64) -> bool {
    if s.is_null() || s["day"] != day || (page == "map" && s["data"]["geoVersion"] != 6) {
        return false;
    }
    let missing = s["missing"].as_array().is_some_and(|a| !a.is_empty());
    let age = s["checked"]
        .as_str()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| now as i128 - d.timestamp_millis() as i128);
    if day < visitors::day(now).as_str() && s["final"] != true {
        return missing && age.is_some_and(|n| n < 15000);
    }
    s["final"] == true
        || age.is_some_and(|n| n < (if missing { 15 } else { ttl(page) }) as i128 * 1000)
}
pub fn shared_key(page: &str, day: &str, name: &str) -> String {
    if page != "private" && ["countries", "feathers", "terminal", "counters"].contains(&name) {
        format!("{day}:{name}")
    } else {
        format!("{}:{name}", key(page, day))
    }
}
fn iso(now: i64) -> Result<String, Error> {
    Ok(DateTime::from_timestamp_millis(now)
        .ok_or("invalid time")?
        .to_rfc3339_opts(SecondsFormat::Millis, true))
}
fn copy_map(v: &Value) -> Map<String, Value> {
    v.as_object().cloned().unwrap_or_default()
}

pub struct Draft {
    page: String,
    day: String,
    at: String,
    data: Map<String, Value>,
    dates: Map<String, Value>,
    timings: Map<String, Value>,
    missing: Vec<String>,
    successes: usize,
}
impl Draft {
    pub fn new(
        page: &str,
        day: &str,
        previous: &Value,
        names: Vec<String>,
        now: i64,
    ) -> Result<Self, Error> {
        if !valid(page, day, now) {
            return Err("invalid snapshot page or day".into());
        }
        let previous = if page == "map" && previous["data"]["geoVersion"] != 6 {
            &Value::Null
        } else {
            previous
        };
        if names.iter().any(|n| {
            n.is_empty()
                || n.len() > 64
                || !n.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
        }) {
            return Err("invalid snapshot task".into());
        }
        if names
            .iter()
            .enumerate()
            .any(|(i, n)| names[..i].contains(n))
        {
            return Err("duplicate snapshot task".into());
        }
        Ok(Self {
            page: page.into(),
            day: day.into(),
            at: iso(now)?,
            data: copy_map(&previous["data"]),
            dates: copy_map(&previous["dates"]),
            timings: copy_map(&previous["timings"]),
            missing: names,
            successes: 0,
        })
    }
    pub fn apply(&mut self, name: &str, result: Option<Value>, ms: u64) {
        if let Some(values) = result.and_then(|v| v.as_object().cloned()) {
            self.data.extend(values);
            self.dates.insert(name.into(), json!(self.at));
            self.missing.retain(|k| k != name);
            self.successes += 1;
        }
        self.timings.insert(name.into(), json!(ms));
    }
    pub fn snapshot(&self, now: i64) -> Value {
        let historic = self.day < visitors::day(now);
        let mut data = self.data.clone();
        if historic && self.page == "overview" {
            for k in ["coffee", "uptime", "votes", "unpaid_days"] {
                data.shift_remove(k);
            }
        }
        let updated = self
            .dates
            .values()
            .filter_map(Value::as_str)
            .min()
            .unwrap_or(&self.at);
        json!({"page":self.page,"day":self.day,"data":data,"dates":self.dates,"timings":self.timings,"missing":self.missing,"updated":updated,"checked":self.at,"state":if self.missing.is_empty(){"ready"}else{"partial"},"final":historic&&self.missing.is_empty()})
    }
}

type TaskResult = Result<Value, String>;
pub type TaskFuture = Pin<Box<dyn Future<Output = Result<Value, Error>> + Send + 'static>>;
pub struct Task {
    pub name: String,
    pub run: TaskFuture,
}
impl Task {
    pub fn new(
        name: impl Into<String>,
        run: impl Future<Output = Result<Value, Error>> + Send + 'static,
    ) -> Self {
        Self {
            name: name.into(),
            run: Box::pin(run),
        }
    }
}
/// Scoped to one build/cron batch, never shared between viewers or dates globally.
#[derive(Clone, Default)]
pub struct Shared(Arc<Mutex<HashMap<String, Arc<OnceCell<TaskResult>>>>>);
impl Shared {
    async fn cell(&self, key: String) -> Arc<OnceCell<TaskResult>> {
        self.0.lock().await.entry(key).or_default().clone()
    }
}
async fn record_error(s: &AppState, page: &str, name: &str) {
    let code = format!("{page}:{name}");
    if code.len() > 80
        || !code
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b":_-".contains(&b))
    {
        return;
    }
    let value = json!({"at":Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true),"area":"snapshot","code":code});
    let _=s.store.command(vec!["EVAL".into(),"redis.call('LPUSH',KEYS[1],ARGV[1]);redis.call('LTRIM',KEYS[1],0,9);redis.call('EXPIRE',KEYS[1],604800);return 1".into(),"1".into(),"report:errors".into(),value.to_string()]).await;
}
async fn publish(
    s: &AppState,
    draft: &Draft,
    lock: &str,
    token: &str,
) -> Result<Option<Value>, Error> {
    let now = Utc::now().timestamp_millis();
    let value = draft.snapshot(now);
    let expiry = if ["private", "x", "status"].contains(&draft.page.as_str()) {
        "86400"
    } else {
        "0"
    };
    let result = s
        .store
        .command(vec![
            "EVAL".into(),
            PUBLISH.into(),
            "3".into(),
            lock.into(),
            key(&draft.page, &draft.day),
            key(&draft.page, "last"),
            token.into(),
            value.to_string(),
            expiry.into(),
            if draft.day < visitors::day(now) {
                "0"
            } else {
                "1"
            }
            .into(),
            expiry.into(),
        ])
        .await?;
    Ok((result.as_i64() == Some(1)).then_some(value))
}
/// Every partial/final write checks the same lease, including midnight rollover.
/// The factory is lazy: a fresh cache or an existing lease never starts providers.
pub async fn build(
    s: &AppState,
    page: &str,
    day: &str,
    force: bool,
    shared: Shared,
    make: impl FnOnce() -> Result<Vec<Task>, Error>,
) -> Result<Option<Value>, Error> {
    if !s.settings.write_enabled() {
        return Err("snapshot writes disabled".into());
    }
    if !valid(page, day, Utc::now().timestamp_millis()) {
        return Err("invalid snapshot page or day".into());
    }
    let k = key(page, day);
    let lock = format!("{k}:lock");
    let token = uuid::Uuid::new_v4().to_string();
    if s.store
        .command(vec![
            "SET".into(),
            lock.clone(),
            token.clone(),
            "NX".into(),
            "EX".into(),
            "55".into(),
        ])
        .await?
        .is_null()
    {
        return Ok(None);
    }
    let result=async{
        let raw=s.store.get(&k).await?;
        let previous=raw.as_str().map(serde_json::from_str).transpose()?.unwrap_or(Value::Null);
        if !force&&fresh(&previous,page,day,Utc::now().timestamp_millis()){return Ok(None);}
        let tasks=make()?;
        let mut draft=Draft::new(page,day,&previous,tasks.iter().map(|t|t.name.clone()).collect(),Utc::now().timestamp_millis())?;
        let mut running=JoinSet::new();
        for task in tasks{
            let cell=shared.cell(shared_key(page,day,&task.name)).await;
            let limit=if page=="coffee"||task.name=="coffee"{23000}else{12000};
            let state=s.clone();let page=page.to_owned();
            running.spawn(async move{
                let start=Instant::now();
                let result=cell.get_or_init(||async{
                    match tokio::time::timeout(Duration::from_millis(limit),task.run).await {
                        Ok(Ok(value)) if value.is_object()=>Ok(value),
                        _=>Err("source unavailable".into()),
                    }
                }).await.clone();
                if result.is_err(){record_error(&state,&page,&task.name).await;}
                (task.name,result,(start.elapsed().as_secs_f64() * 1000.0).round() as u64)
            });
        }
        let mut phase=0;let mut deadline=Instant::now()+Duration::from_millis(300);
        while !running.is_empty(){
            tokio::select!{
                item=running.join_next()=>{
                    if let Some(result)=item{
                        let (name,value,ms)=result?;
                        draft.apply(&name,value.ok(),ms);
                    }
                }
                _=tokio::time::sleep_until(deadline),if phase<2=>{
                    if draft.successes>0&&!draft.missing.is_empty(){publish(s,&draft,&lock,&token).await?;}
                    phase+=1;deadline=Instant::now()+Duration::from_millis(1500);
                }
            }
        }
        if draft.successes==0{
            s.store.command(vec!["EVAL".into(),RETRY.into(),"1".into(),lock.clone(),token.clone()]).await?;
            return Ok(None);
        }
        publish(s,&draft,&lock,&token).await
    }.await;
    // Expired/replaced leases are never deleted by a stale builder.
    let _ = s
        .store
        .command(vec!["EVAL".into(), RELEASE.into(), "1".into(), lock, token])
        .await;
    result
}
