use crate::tiers::Tier;
use serde_json::Value;
pub fn config() -> &'static Value {
    static CONFIG: std::sync::OnceLock<Value> = std::sync::OnceLock::new();
    CONFIG.get_or_init(|| {
        serde_json::from_str(include_str!("../../migration/army-config.json"))
            .unwrap_or(Value::Null)
    })
}
pub fn includes(group: &str, value: &Value) -> bool {
    config()[group]
        .as_array()
        .is_some_and(|a| a.contains(value))
}
pub fn active_tier(user: &Value, now: i64) -> Option<&str> {
    if truthy(&user["general"]) && truthy(&user["verifiedAt"]) {
        return Some("imperator");
    }
    let p = &user["membership"];
    let tier = p["tier"].as_str()?;
    (includes("TIERS", &p["tier"])
        && tier != "imperator"
        && p["state"] != "refunded"
        && (includes("LIFETIME", &p["tier"])
            || (tier == "tiro" && p["interval"] == "once")
            || crate::impact::timestamp(&p["until"]).is_some_and(|t| t > now)))
    .then_some(tier)
}
pub fn public_soldier(user: &Value, link: bool, now: i64) -> Value {
    use serde_json::json;
    let named =
        (truthy(&user["verifiedAt"]) || truthy(&user["legion"])) && truthy(&user["username"]);
    let otherwise = |k: &str, fallback: Value| {
        if truthy(&user[k]) {
            user[k].clone()
        } else {
            fallback
        }
    };
    let mut p = json!({"username":if named{user["username"].clone()}else{Value::Null},"serial":otherwise("serial",Value::Null),"rank":rank(user),"points":points(user),"rankGranted":truthy(&user["legion"]),"created":user["created"].as_str().unwrap_or("").chars().take(10).collect::<String>(),"streak":otherwise("streak",json!(0)),"best":otherwise("best",json!(0)),"feathers":user["feathers"].as_array().map(Vec::len).unwrap_or(0),"recruits":otherwise("recruits",json!(0)),"approved":user["status"]=="approved","tier":active_tier(user,now),"country":otherwise("country",Value::Null),"hidden":truthy(&user["hidden"])});
    if link && named {
        p["link"] = otherwise("link", json!(""));
    }
    p
}
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
