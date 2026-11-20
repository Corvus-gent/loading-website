//! Public aggregates only; the source query never returns visitor identifiers.
use crate::Error;
use corvus_core::analytics;
use serde_json::{Map, Value, json};
use std::{collections::HashMap, sync::LazyLock};
use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};

static DATA: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../migration/geo-config.json")).unwrap_or(Value::Null)
});
pub const COUNTRY_SQL: &str = "coalesce(nullIf(properties.corvus_country_code, ''), nullIf(properties.$geoip_country_code, ''), nullIf(properties.$geoip_country_name, ''), '?')";
pub const REAL: &str = "properties.$host IN ('corvus.gent', 'www.corvus.gent', 'stats.corvus.gent') AND timestamp >= toDateTime('2026-11-02 00:00:00')";
pub fn number(v: &Value) -> f64 {
    match v {
        Value::Null => 0.0,
        Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        Value::String(s) => {
            let s = s.trim();
            if s.is_empty() {
                return 0.0;
            }
            for (prefix, base) in [("0x", 16), ("0b", 2), ("0o", 8)] {
                if let Some(v) = s.to_ascii_lowercase().strip_prefix(prefix) {
                    return u64::from_str_radix(v, base)
                        .map(|v| v as f64)
                        .unwrap_or(f64::NAN);
                }
            }
            s.parse().unwrap_or(f64::NAN)
        }
        Value::Array(a) if a.is_empty() => 0.0,
        Value::Array(a) if a.len() == 1 => number(&a[0]),
        _ => f64::NAN,
    }
}
fn field<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
fn norm(s: &str) -> String {
    s.nfd()
        .filter(|c| !is_combining_mark(*c))
        .flat_map(char::to_lowercase)
        .filter(|c| c.is_alphanumeric())
        .collect()
}
static REGIONS: LazyLock<HashMap<String, Value>> = LazyLock::new(|| {
    let mut regions = HashMap::new();
    for r in DATA["regions"].as_array().into_iter().flatten() {
        let country = r[0].as_str().unwrap_or("");
        let code = r[1].as_str().unwrap_or("");
        let value =
            json!({"countryCode":country,"region":code,"regionName":r[2],"lat":r[3],"lng":r[4]});
        let mut aliases = r[5].as_array().cloned().unwrap_or_default();
        aliases.push(json!(format!("{country}-{code}")));
        for alias in aliases {
            let alias = norm(alias.as_str().unwrap_or(""));
            if !alias.is_empty() {
                regions.insert(format!("{country}:{alias}"), value.clone());
            }
        }
    }
    regions
});
pub fn region(country: &str, name: &str) -> Option<Value> {
    let n = norm(name);
    if n.is_empty() {
        None
    } else {
        REGIONS.get(&format!("{country}:{n}")).cloned()
    }
}
fn valid_coords(lat: f64, lng: f64) -> bool {
    lat.is_finite() && lat.abs() <= 90.0 && lng.is_finite() && lng.abs() <= 180.0
}
pub fn distance(lat: f64, lng: f64, other_lat: f64, other_lng: f64) -> f64 {
    let r = std::f64::consts::PI / 180.0;
    let dy = (other_lat - lat) * r;
    let dx = (other_lng - lng) * r;
    let h = (dy / 2.0).sin().powi(2)
        + (lat * r).cos() * (other_lat * r).cos() * (dx / 2.0).sin().powi(2);
    12742.0 * h.sqrt().min(1.0).asin()
}
pub fn city_area(country: &str, raw_region: &str, city: &str, lat: f64, lng: f64) -> Option<Value> {
    let state = region(country, raw_region);
    let candidates: Vec<_> = DATA["cities"]
        .as_array()?
        .iter()
        .filter(|c| c[0] == country && state.as_ref().is_none_or(|r| c[1] == r["region"]))
        .collect();
    let found = if !valid_coords(lat, lng) {
        candidates
            .iter()
            .find(|c| norm(c[2].as_str().unwrap_or("")) == norm(city))
            .copied()
    } else if city.is_empty() {
        None
    } else {
        candidates
            .into_iter()
            .map(|c| (distance(lat, lng, number(&c[3]), number(&c[4])), c))
            .min_by(|a, b| a.0.total_cmp(&b.0))
            .filter(|(km, _)| *km <= 200.0)
            .map(|(_, c)| c)
    }?;
    Some(
        json!({"countryCode":found[0],"region":found[1],"city":found[2],"lat":found[3],"lng":found[4],"precision":"metro","approximate":true}),
    )
}
pub fn valid_day(day: &str) -> bool {
    day == "all"
        || (day.len() == 10
            && day.bytes().enumerate().all(|(i, b)| {
                if i == 4 || i == 7 {
                    b == b'-'
                } else {
                    b.is_ascii_digit()
                }
            }))
}
pub fn query(day: &str) -> Result<String, Error> {
    if !valid_day(day) {
        return Err("invalid day".into());
    }
    let scope = if day == "all" {
        String::new()
    } else {
        format!(" AND toDate(toTimeZone(timestamp, 'Europe/Brussels')) = toDate('{day}')")
    };
    let city =
        "toString(coalesce(nullIf(properties.corvus_city, ''), properties.$geoip_city_name, ''))";
    let region = "toString(coalesce(nullIf(properties.corvus_region, ''), properties.$geoip_subdivision_1_name, ''))";
    let lat = "toString(coalesce(properties.corvus_latitude, properties.$geoip_latitude, ''))";
    let lng = "toString(coalesce(properties.corvus_longitude, properties.$geoip_longitude, ''))";
    Ok(format!(
        "SELECT country, tupleElement(place,1), tupleElement(place,2), tupleElement(place,3), tupleElement(place,4), count()\nFROM (SELECT toString({COUNTRY_SQL}) country, distinct_id,\nargMax(tuple({region},{city},{lat},{lng}), tuple(multiIf({city} != '' AND {lat} != '' AND {lng} != '', 2, {region} != '', 1, 0), timestamp)) place\nFROM events WHERE event = '$pageview' AND {REAL}{scope} GROUP BY country, distinct_id)\nGROUP BY country, place LIMIT 10000"
    ))
}
pub fn country_query(day: &str) -> Result<String, Error> {
    if !valid_day(day) {
        return Err("invalid day".into());
    }
    let scope = if day == "all" {
        String::new()
    } else {
        format!(" AND toDate(toTimeZone(timestamp,'Europe/Brussels'))=toDate('{day}')")
    };
    Ok(format!(
        "SELECT {COUNTRY_SQL} c, count(DISTINCT distinct_id) n FROM events WHERE event='$pageview' AND {REAL}{scope} GROUP BY c ORDER BY n DESC, c ASC LIMIT 300"
    ))
}
fn clean(v: &Value) -> String {
    let Some(s) = v.as_str() else {
        return String::new();
    };
    if s.contains(['@', '<', '>', '\r', '\n']) {
        String::new()
    } else {
        String::from_utf16_lossy(&s.trim().encode_utf16().take(100).collect::<Vec<_>>())
    }
}
fn increment(map: &mut Map<String, Value>, key: String, n: f64) {
    let next = number(map.get(&key).unwrap_or(&Value::Null)) + n;
    map.insert(key, json!(next));
}
fn add(groups: &mut Map<String, Value>, p: Value, n: f64) {
    let key = json!([p["countryCode"], p["precision"], p["region"], p["city"]]).to_string();
    let g = groups.entry(key).or_insert(p);
    g["visitors"] = json!(number(&g["visitors"]) + n);
}
fn merge(mut a: Value, b: Value) -> Value {
    if let (Some(a), Some(b)) = (a.as_object_mut(), b.as_object()) {
        a.extend(b.clone());
    }
    a
}
fn sum(rows: &[Value], key: &str) -> f64 {
    rows.iter().map(|p| number(&p[key])).fold(0.0, |a, n| a + n)
}
pub fn rows(rows: &[Value]) -> Result<Value, Error> {
    if !DATA.is_object() {
        return Err("geography configuration unavailable".into());
    }
    if rows.len() >= 10000 {
        return Err("geo result limit reached".into());
    }
    let (mut countries, mut groups, mut unknown) = (Map::new(), Map::new(), Map::new());
    for row in rows {
        let n = number(&row[5]);
        if !n.is_finite() || n.fract() != 0.0 || !(1.0..=9_007_199_254_740_991.0).contains(&n) {
            continue;
        }
        let code = analytics::country(&row[0]);
        let code = code.as_str().unwrap_or("?");
        let state_name = clean(&row[1]);
        let city = clean(&row[2]);
        let coord = |v: &Value| {
            if v.is_null() || v == "" {
                f64::NAN
            } else {
                number(v)
            }
        };
        let (lat, lng) = (coord(&row[3]), coord(&row[4]));
        increment(&mut countries, code.into(), n);
        let shared = json!({"countryCode":code,"country":if code=="?"{"unknown location"}else{DATA["names"][code].as_str().unwrap_or(code)},"unknown":false});
        let state = region(code, &state_name);
        if let Some(area) = city_area(code, &state_name, &city, lat, lng) {
            add(&mut groups, merge(shared, area), n);
        } else if !city.is_empty() && valid_coords(lat, lng) {
            let region = state
                .as_ref()
                .map(|s| field(s, "region"))
                .unwrap_or(&state_name);
            add(
                &mut groups,
                merge(
                    shared,
                    json!({"region":region,"city":city,"lat":(lat*10.0+0.5).floor()/10.0,"lng":(lng*10.0+0.5).floor()/10.0,"precision":"city"}),
                ),
                n,
            );
        } else if let Some(state) = state {
            add(
                &mut groups,
                merge(
                    merge(shared, state),
                    json!({"city":"","precision":"region","approximate":true}),
                ),
                n,
            );
        } else {
            increment(&mut unknown, code.into(), n);
        }
    }
    let (mut cities, mut regional) = (Vec::new(), Map::new());
    for g in groups.values() {
        if g["precision"] != "region" && number(&g["visitors"]) >= 2.0 {
            cities.push(g.clone());
            continue;
        }
        let Some(state) = region(field(g, "countryCode"), field(g, "region")) else {
            increment(
                &mut unknown,
                field(g, "countryCode").into(),
                number(&g["visitors"]),
            );
            continue;
        };
        let key = format!("{}:{}", field(g, "countryCode"), field(&state, "region"));
        let r = regional.entry(key).or_insert_with(|| {
            merge(
                merge(g.clone(), state),
                json!({"city":"","visitors":0,"precision":"region","approximate":true}),
            )
        });
        r["visitors"] = json!(number(&r["visitors"]) + number(&g["visitors"]));
    }
    for g in regional.values() {
        if number(&g["visitors"]) >= 2.0 {
            cities.push(g.clone());
        } else {
            increment(
                &mut unknown,
                field(g, "countryCode").into(),
                number(&g["visitors"]),
            );
        }
    }
    let mut unlocated = 0.0;
    for (code, n) in unknown {
        let coords = &DATA["centroids"][&code];
        if !coords.is_array() {
            unlocated += number(&n);
            continue;
        }
        cities.push(json!({"countryCode":code,"country":DATA["names"][&code],"region":"","city":"","lat":coords[0],"lng":coords[1],"visitors":n,"unknown":true,"precision":"country"}));
    }
    let mut list: Vec<Value> = countries
        .into_iter()
        .map(|(c, n)| json!({"c":c,"n":n}))
        .collect();
    list.sort_by(|a, b| {
        number(&b["n"])
            .total_cmp(&number(&a["n"]))
            .then_with(|| field(a, "c").cmp(field(b, "c")))
    });
    Ok(
        json!({"geoVersion":6,"total":sum(&list,"n"),"countries":list,"mapped":sum(&cities,"visitors"),"unlocated":unlocated,"located":cities.iter().filter(|c|c["unknown"]!=true).map(|c|number(&c["visitors"])).fold(0.0, |a, n| a + n),"cities":cities}),
    )
}
pub fn combine(counts: &[Value], locations: Option<&[Value]>) -> Result<Value, Error> {
    let country_rows: Vec<_> = counts
        .iter()
        .map(|r| json!([r[0], "", "", null, null, r[1]]))
        .collect();
    let mut base = rows(&country_rows)?;
    let Some(locations) = locations else {
        base["cityUnavailable"] = json!(true);
        return Ok(base);
    };
    let located = rows(locations)?;
    let mut cities = Vec::new();
    for c in base["countries"].as_array().into_iter().flatten() {
        let points: Vec<Value> = located["cities"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|p| p["countryCode"] == c["c"])
            .cloned()
            .collect();
        if sum(&points, "visitors") == number(&c["n"]) {
            cities.extend(points)
        } else {
            cities.extend(
                base["cities"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|p| p["countryCode"] == c["c"])
                    .cloned(),
            )
        }
    }
    base["mapped"] = json!(sum(&cities, "visitors"));
    base["located"] = json!(
        cities
            .iter()
            .filter(|c| c["unknown"] != true)
            .map(|c| number(&c["visitors"]))
            .fold(0.0, |a, n| a + n)
    );
    base["cities"] = json!(cities);
    base["cityUnavailable"] = json!(false);
    Ok(base)
}
