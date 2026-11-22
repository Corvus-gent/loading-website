//! Snapshot presentation decisions, separate from storage/auth/provider effects.
use super::snapshot::{TABLES, fresh, valid};
use crate::{Error, visitors};
use serde::Serialize;
use serde_json::{Value, json};

#[derive(Serialize)]
pub struct View {
    pub status: u16,
    pub cache: &'static str,
    pub body: Value,
    pub refresh: bool,
    pub recover: bool,
}
impl View {
    fn new(body: Value) -> Self {
        Self {
            status: 200,
            cache: "private, no-store",
            body,
            refresh: false,
            recover: false,
        }
    }
    fn invalid(message: &str) -> Self {
        Self {
            status: 400,
            ..Self::new(json!({"error":message}))
        }
    }
}
pub enum Viewer<'a> {
    Public,
    LoggedIn(&'a str),
    Unavailable,
}
pub struct Read<'a> {
    pub page: &'a str,
    pub day: &'a str,
    pub snapshot: Option<Value>,
    pub storage_failed: bool,
    pub lease: Option<&'a str>,
    pub viewer: Viewer<'a>,
    pub part: Option<&'a str>,
    pub now: i64,
    pub plaintext_until: Value,
}
pub fn project(input: Read<'_>) -> Result<View, Error> {
    let Read {
        page,
        day,
        mut snapshot,
        storage_failed,
        lease,
        viewer,
        part,
        now,
        plaintext_until,
    } = input;
    if !valid(page, day, now) {
        return Ok(View::invalid("invalid page or day"));
    }
    let private = page == "private";
    let email = match viewer {
        Viewer::Unavailable if private => {
            return Ok(View::new(
                json!({"page":page,"day":day,"state":"unavailable","reason":"storage","data":null,"storage_plaintext_until":plaintext_until}),
            ));
        }
        Viewer::LoggedIn(s) => Some(s),
        _ if private => {
            return Ok(View::new(
                json!({"page":page,"day":day,"state":"login","data":null,"storage_plaintext_until":plaintext_until}),
            ));
        }
        _ => None,
    };
    if page == "map"
        && snapshot
            .as_ref()
            .is_some_and(|s| s["data"]["geoVersion"] != 6)
    {
        snapshot = None;
    }
    let past = day < visitors::day(now).as_str();
    let historical_build = !past || ["overview", "hunt", "map"].contains(&page);
    let sealed = past
        && !historical_build
        && snapshot
            .as_ref()
            .is_some_and(|s| s["day"] == day && s["state"] == "ready");
    let stale = !sealed && !snapshot.as_ref().is_some_and(|s| fresh(s, page, day, now));
    if storage_failed && snapshot.is_none() && !private && historical_build {
        return Ok(View {
            recover: true,
            ..View::new(Value::Null)
        });
    }
    let refresh = !storage_failed && stale && historical_build && lease != Some("retry");
    let Some(snap) = snapshot else {
        let mut body = json!({"page":page,"day":day,"state":if historical_build&&!storage_failed&&lease!=Some("retry"){"warming"}else{"unavailable"},"data":null,"updated":null});
        let reason = if storage_failed {
            Some("storage")
        } else if lease == Some("retry") {
            Some("source")
        } else if !historical_build {
            Some("history")
        } else {
            None
        };
        if let Some(reason) = reason {
            body["reason"] = json!(reason);
        }
        if private {
            body["storage_plaintext_until"] = plaintext_until;
            body["viewer"] = json!(email);
        }
        return Ok(View {
            refresh,
            ..View::new(body)
        });
    };
    let mut body = snap.as_object().ok_or("invalid snapshot")?.clone();
    body.shift_remove("dates");
    if sealed && !["status", "x", "private"].contains(&page) {
        body.insert("final".into(), json!(true));
    }
    if private {
        if part.is_some_and(|s| !TABLES.contains(&s)) {
            return Ok(View {
                refresh,
                ..View::invalid("invalid table")
            });
        }
        let payload = snap["data"].as_object().ok_or("invalid private snapshot")?;
        let data = if let Some(part) = part {
            json!({part:payload.get(part).unwrap_or(&Value::Null)})
        } else {
            let tables = TABLES
                .iter()
                .filter(|k| payload.get(**k).is_some_and(Value::is_array))
                .collect::<Vec<_>>();
            let mut data = json!({"tables":tables});
            for k in ["outbound", "funnel"] {
                if let Some(v) = payload.get(k).filter(|v| corvus_core::army::truthy(v)) {
                    data[k] = v.clone();
                }
            }
            if email.is_some_and(|s| s.eq_ignore_ascii_case("gabriel@corvus.gent"))
                && let Some(v) = payload.get("funnelSF")
            {
                data["funnelSF"] = v.clone();
            }
            data
        };
        // The object is always projected; cached private payloads are never returned wholesale.
        body.insert("data".into(), data);
    }
    body.insert("stale".into(), json!(stale || storage_failed));
    if storage_failed {
        body.insert("reason".into(), json!("storage"));
    } else if snap["state"] == "partial" {
        let locked = lease.is_some_and(|s| !s.is_empty());
        body.insert(
            "reason".into(),
            json!(if locked { "building" } else { "source" }),
        );
        body.insert("working".into(), json!(locked && lease != Some("retry")));
    }
    if private {
        body.insert("storage_plaintext_until".into(), plaintext_until);
        body.insert("viewer".into(), json!(email));
    }
    let cache = if !private && snap["state"] != "partial" {
        if past && (snap["final"] == true || sealed) && !["status", "x"].contains(&page) {
            "public, max-age=0, s-maxage=31536000, immutable"
        } else {
            "public, max-age=0, s-maxage=30, stale-while-revalidate=300"
        }
    } else {
        "private, no-store"
    };
    Ok(View {
        cache,
        refresh,
        ..View::new(Value::Object(body))
    })
}
