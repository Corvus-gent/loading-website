use crate::Error;
use serde_json::{Value, json};
pub const ROLES: &[&str] = &[
    "imperator",
    "consul",
    "senator",
    "legatus",
    "centurio",
    "miles",
    "tiro",
    "recruit (unverified)",
];
pub const CHANNELS: &[&str] = &[
    "the-gate",
    "announcements",
    "general",
    "missions",
    "bangers",
    "build-in-public",
    "sf",
    "introductions",
    "campfire",
    "centurio-tent",
    "war-council",
];
pub fn snowflake(value: &Value) -> bool {
    value
        .as_str()
        .is_some_and(|s| (15..=22).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_digit()))
}
pub fn interaction(raw: &[u8], signature: &str, timestamp: &str, key: &str, now: i64) -> bool {
    if signature.len() != 128
        || !signature.bytes().all(|b| b.is_ascii_hexdigit())
        || timestamp.len() != 10
        || !timestamp.bytes().all(|b| b.is_ascii_digit())
        || timestamp
            .parse::<i64>()
            .ok()
            .is_none_or(|n| (now - n * 1000).abs() > 300000)
        || key.len() != 64
        || !key.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return false;
    }
    let (Ok(key), Ok(sig)) = (hex::decode(key), hex::decode(signature)) else {
        return false;
    };
    let mut message = timestamp.as_bytes().to_vec();
    message.extend_from_slice(raw);
    ring::signature::UnparsedPublicKey::new(&ring::signature::ED25519, key)
        .verify(&message, &sig)
        .is_ok()
}
fn bits(v: &Value) -> Result<u128, Error> {
    if v.is_null() {
        return Ok(0);
    }
    Ok(corvus_core::impact::string(v)
        .parse::<u128>()
        .map_err(|_| "discord_permissions")?)
}
pub fn role_above(a: &Value, b: &Value) -> Result<bool, Error> {
    Ok(a["position"].as_i64() > b["position"].as_i64()
        || (a["position"] == b["position"] && bits(&a["id"])? < bits(&b["id"])?))
}
pub fn plan(config: &Value) -> Result<Value, Error> {
    let owners = config["owners"].as_array().ok_or("discord_configuration")?;
    if !snowflake(&config["guild"])
        || !snowflake(&config["bot"])
        || owners.len() != 2
        || owners[0] == owners[1]
        || !owners.iter().all(snowflake)
    {
        return Err("discord_configuration".into());
    }
    let colors = [
        0xffd76a, 0xe8c25f, 0xd7ae59, 0xb8862b, 0x96805a, 0x777777, 0x555555, 0x333333,
    ];
    let roles=ROLES.iter().enumerate().map(|(i,name)|json!({"name":name,"permissions":"0","color":colors[i],"hoist":false,"mentionable":false})).collect::<Vec<_>>();
    let mut channels = vec![];
    let empty = vec![];
    for name in CHANNELS {
        let gate = *name == "the-gate";
        let announcement = *name == "announcements";
        let allowed = if *name == "war-council" {
            &ROLES[..2]
        } else if *name == "centurio-tent" {
            &ROLES[..5]
        } else {
            &ROLES[..7]
        };
        let mut overwrites = vec![
            json!({"id":config["guild"],"type":0,"deny":if gate{"2049"}else{"1025"},"allow":if gate{"2147550208"}else{"0"}}),
        ];
        overwrites.extend(
            config["restrictedBots"]
                .as_array()
                .unwrap_or(&empty)
                .iter()
                .map(|id| json!({"id":id,"type":1,"allow":"0","deny":"1"})),
        );
        overwrites.extend(
            owners
                .iter()
                .map(|id| json!({"id":id,"type":1,"allow":"3073","deny":"0"})),
        );
        overwrites.push(json!({"id":config["bot"],"type":1,"allow":"3073","deny":"0"}));
        for role in allowed
            .iter()
            .filter(|n| corvus_core::army::truthy(&config["roles"][**n]))
        {
            overwrites.push(json!({"id":config["roles"][*role],"type":0,"allow":if *name=="campfire"{"3146752"}else if announcement&&*role!="imperator"{"1024"}else{"3072"},"deny":if announcement&&*role!="imperator"{"2049"}else{"1"}}));
        }
        if gate {
            for row in overwrites.iter_mut().filter(|r| r["type"] == 0) {
                row["deny"] = json!((bits(&row["deny"])? | 2048).to_string());
            }
        }
        channels.push(json!({"name":name,"type":if *name=="campfire"{2}else{0},"permission_overwrites":overwrites}));
    }
    Ok(json!({"roles":roles,"channels":channels}))
}
pub fn findings(config: &Value, roles: &[Value], channels: &[Value]) -> Result<Vec<String>, Error> {
    let mut found = vec![];
    let empty = vec![];
    for role in roles {
        if role["tags"]["bot_id"] == config["bot"] {
            continue;
        }
        let permissions = bits(&role["permissions"])?;
        let blocked = corvus_core::army::truthy(&role["tags"]["bot_id"])
            && config["restrictedBots"]
                .as_array()
                .is_some_and(|a| a.contains(&role["tags"]["bot_id"]))
            && channels.iter().all(|c| {
                c["permission_overwrites"]
                    .as_array()
                    .unwrap_or(&empty)
                    .iter()
                    .any(|o| {
                        o["type"] == 1
                            && o["id"] == role["tags"]["bot_id"]
                            && bits(&o["deny"]).is_ok_and(|n| n & 1 != 0)
                    })
            });
        if permissions & 8 != 0 || (permissions & 1 != 0 && !blocked) {
            found.push(format!(
                "role:{}:invite_or_admin",
                corvus_core::impact::string(&role["id"])
            ));
        }
    }
    for channel in channels {
        for row in channel["permission_overwrites"]
            .as_array()
            .unwrap_or(&empty)
        {
            let allowed = row["id"] == config["bot"]
                || config["owners"]
                    .as_array()
                    .is_some_and(|a| a.contains(&row["id"]));
            if bits(&row["allow"])? & 1 != 0 && !(row["type"] == 1 && allowed) {
                found.push(format!(
                    "channel:{}:invite_override",
                    corvus_core::impact::string(&channel["id"])
                ));
            }
        }
    }
    Ok(found)
}
