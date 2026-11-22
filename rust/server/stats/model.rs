//! Existing aggregate queries/projections and retention-neutral counter reads.
use crate::{Error, visitors};
use chrono::NaiveDate;
use corvus_core::analytics;
use serde_json::{Map, Value, json};
use std::sync::LazyLock;
static QUERIES: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../migration/stats-queries.json")).unwrap_or(Value::Null)
});
pub const GAMES: &[&str] = &[
    "babel", "borders", "wordle", "flags", "combo", "bangle", "pingle", "lantern",
];
pub fn check_day(day: &str) -> Result<(), Error> {
    if day != "all" && visitors::model::valid_day(day) {
        Ok(())
    } else {
        Err("invalid day".into())
    }
}
pub fn query(group: &str, name: &str, day: &str) -> Result<String, Error> {
    check_day(day)?;
    let map = match group {
        "daily" | "private" => &QUERIES[group],
        _ => &QUERIES["sections"][group],
    };
    let sql = map[name].as_str().ok_or("unknown statistics task")?;
    Ok(sql.replace("__CORVUS_STATS_DAY__", day))
}
pub fn number(value: Option<&Value>) -> f64 {
    value.map(visitors::model::number).unwrap_or(f64::NAN)
}
fn object(fields: &[(&str, Option<&Value>)]) -> Value {
    Value::Object(
        fields
            .iter()
            .filter_map(|(k, v)| v.map(|v| ((*k).into(), v.clone())))
            .collect(),
    )
}
fn array(row: &Value) -> Result<&[Value], Error> {
    row.as_array()
        .map(Vec::as_slice)
        .ok_or_else(|| "invalid aggregate row".into())
}
fn category(v: &Value, list: &str, fallback: &str) -> Value {
    if analytics::config()[list]
        .as_array()
        .is_some_and(|allowed| allowed.contains(v))
    {
        v.clone()
    } else {
        json!(fallback)
    }
}
fn group(rows: &[Value], key: &str, label: impl Fn(&Value) -> Value) -> Result<Value, Error> {
    let mut groups: Vec<(Value, f64)> = Vec::new();
    for row in rows {
        let row = array(row)?;
        let n = number(row.get(1));
        if !n.is_finite() || n < 0.0 || n.fract() != 0.0 || n > 9_007_199_254_740_991.0 {
            continue;
        }
        let value = label(row.first().unwrap_or(&Value::Null));
        if let Some((_, total)) = groups.iter_mut().find(|(v, _)| *v == value) {
            *total += n
        } else {
            groups.push((value, n));
        }
    }
    groups.sort_by(|a, b| b.1.total_cmp(&a.1));
    Ok(Value::Array(
        groups
            .into_iter()
            .map(|(v, n)| json!({key:v,"n":if n==0.0 {0.0} else {n}}))
            .collect(),
    ))
}
pub fn project(kind: &str, name: &str, day: &str, rows: &[Value]) -> Result<Value, Error> {
    // Valid task names share one source-checked registry with the query producer.
    query(kind, name, day)?;
    if kind == "private" {
        return Ok(json!({name:rows}));
    }
    if kind == "daily" {
        return Ok(match name {
            "visitors" | "total" => {
                let first = array(rows.first().ok_or("missing aggregate row")?)?;
                let n = if name == "total"
                    && first.first().is_none_or(|v| !corvus_core::army::truthy(v))
                {
                    0.0
                } else {
                    number(first.first())
                };
                json!({name:n})
            }
            "hours" => {
                json!({"hours":rows.iter().map(|r| {let r=array(r)?;Ok(object(&[("h",r.first()),("n",r.get(1))]))}).collect::<Result<Vec<_>,Error>>()?})
            }
            "countries" => json!({"countries":group(rows,"c",analytics::country)?}),
            "sources" => json!({"sources":group(rows,"s",analytics::source)?}),
            "pages" => json!({"pages":group(rows,"p",|v| json!(analytics::path(v)))?}),
            "browsers" => json!({"browsers":group(rows,"b",|v| category(v,"BROWSERS","Other"))?}),
            "terminal" => json!({"terminal":group(rows,"c",|v| category(v,"COMMANDS","unknown"))?}),
            "feathers" => {
                let row = array(rows.first().ok_or("missing aggregate row")?)?;
                object(&[("feathers", row.first()), ("hunters", row.get(1))])
            }
            _ => return Err("unknown statistics task".into()),
        });
    }
    match (kind, name) {
        ("outbound", "outbound") | ("music", "genres") => {
            let rows = rows
                .iter()
                .map(|r| {
                    let r = array(r)?;
                    let key = r.first().unwrap_or(&Value::Null);
                    let value = if kind == "outbound" {
                        analytics::host(key)
                    } else {
                        category(key, "GENRES", "other")
                    };
                    Ok(json!([value, r.get(1).unwrap_or(&Value::Null)]))
                })
                .collect::<Result<Vec<_>, Error>>()?;
            Ok(json!({if kind=="outbound" {"hosts"} else {"genres"}:rows}))
        }
        ("pidgy", "crossings") => {
            let row = array(rows.first().ok_or("missing aggregate row")?)?;
            let date = NaiveDate::parse_from_str(day, "%Y-%m-%d").ok();
            let epoch = NaiveDate::from_ymd_opt(1970, 1, 1).ok_or("epoch")?;
            let start = NaiveDate::from_ymd_opt(2026, 11, 4).ok_or("scene start")?;
            Ok(
                json!({"all":object(&[("visitors",row.first()),("clickers",row.get(1)),("clicks",row.get(2))]),"today":object(&[("visitors",row.get(3)),("clickers",row.get(4)),("clicks",row.get(5))]),"scene":date.map(|d| (d-start).num_days()%3),"variant":date.map(|d| (d-epoch).num_days()%2)}),
            )
        }
        _ => Err("unknown statistics task".into()),
    }
}
pub fn pairs(raw: &Value) -> Result<Value, Error> {
    if raw.is_null() {
        return Ok(json!({}));
    }
    let values = array(raw)?;
    let mut out = Map::new();
    for p in values.chunks_exact(2) {
        let key = corvus_core::impact::string(&p[0]);
        out.insert(key, json!(number(p.get(1))));
    }
    Ok(Value::Object(out))
}
pub fn counters(rows: &[Value], today: bool, now: i64) -> Result<Value, Error> {
    if rows.len() != if today { 7 } else { 6 } {
        return Err("incomplete counters".into());
    }
    let mut result = json!({"cv":{"open":number(rows.first()),"download":number(rows.get(1)),"openTotal":number(rows.get(2)),"downloadTotal":number(rows.get(3))},"cli":{"day":pairs(&rows[4])?,"all":pairs(&rows[5])?}});
    if today {
        result["votes"] = pairs(&rows[6])?;
        result["unpaid_days"] = json!(((now as f64 - 1_792_068_000_000.0) / 86_400_000.0).floor());
    }
    Ok(result)
}

pub fn private_names() -> Result<Vec<String>, Error> {
    Ok(QUERIES["private"]
        .as_object()
        .ok_or("private statistics configuration unavailable")?
        .keys()
        .cloned()
        .collect())
}
