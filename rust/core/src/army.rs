use crate::tiers::Tier;
use serde_json::Value;
pub fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|n| n != 0.0),
        Value::String(s) => !s.is_empty(),
        _ => true,
    }
}
fn number(v: &Value) -> f64 {
    let value = match v {
        Value::Null => 0.0,
        Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        Value::String(s) => {
            if s.trim().is_empty() {
                0.0
            } else {
                s.trim().parse().unwrap_or(f64::NAN)
            }
        }
        Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        _ => f64::NAN,
    };
    if value.fract() == 0.0 && value.abs() <= 9_007_199_254_740_991.0 {
        value.max(0.0)
    } else {
        0.0
    }
}
pub fn points(user: &Value) -> f64 {
    number(&user["approvedHelp"]) * 25.0
        + (number(&user["recruits"]) + number(&user["pidgyTrials"])) * 100.0
        + number(&user["missionPoints"])
}
pub fn rank(user: &Value) -> &str {
    if truthy(&user["verifiedAt"]) && user["general"] == true {
        return "imperator";
    }
    if let Some(rank) = user["legion"]["rank"].as_str().filter(|r| {
        [
            "tiro",
            "miles",
            "centurio",
            "legatus",
            "praetor",
            "senator",
            "consul",
            "imperator",
        ]
        .contains(r)
    }) {
        return rank;
    }
    let p = points(user);
    for (rank, min) in [
        ("legatus", 3000.0),
        ("tribunus", 1500.0),
        ("centurio", 700.0),
        ("optio", 300.0),
        ("decanus", 100.0),
        ("miles", 30.0),
    ] {
        if p >= min {
            return rank;
        }
    }
    "tiro"
}
pub fn member_tier(user: &Value) -> Tier {
    if user.is_null() || user["status"] == "deleting" {
        return Tier::Visitor;
    }
    let member = truthy(&user["legion"])
        || user["status"] == "approved"
        || (truthy(&user["verifiedAt"])
            && truthy(&user["membership"])
            && user["membership"]["state"] != "refunded");
    if member {
        match rank(user) {
            "legatus" | "praetor" | "senator" | "consul" | "imperator" => Tier::Call,
            "centurio" => Tier::Hacker,
            _ => Tier::Soldier,
        }
    } else if truthy(&user["verifiedAt"]) {
        Tier::Email
    } else {
        Tier::Visitor
    }
}
