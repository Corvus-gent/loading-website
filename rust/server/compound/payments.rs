//! Stripe wire validation. No Stripe SDK/network call is needed to verify signed bytes.
use super::model;
use super::store::{Editor, numeric, text};
use crate::{Error, config::Settings, crypto};
use corvus_core::army::truthy;
use serde_json::{Value, json};
use url::Url;
impl Editor<'_> {
    pub async fn donation_link(&self, raw: &Value, journey: &Value) -> Result<Value, Error> {
        let reference = format!("compound_{}", hex::encode(rand::random::<[u8; 16]>()));
        let link = checkout(
            &self.0.settings,
            raw,
            journey,
            &reference,
            chrono::Utc::now().timestamp_millis(),
        )?;
        self.run(&[
            "SET",
            &self.key(&format!("checkout:{reference}")),
            &link["record"].to_string(),
            "EX",
            "604800",
        ])
        .await?;
        Ok(json!({"url":link["url"],"test":link["test"]}))
    }
    pub async fn stripe_event(&self, e: &Value) -> Result<Value, Error> {
        let mode = mode(&self.0.settings);
        if truthy(&e["livemode"]) != (mode == "live") {
            return Ok(json!({"ignored":true}));
        }
        let s = &e["data"]["object"];
        if [
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
        ]
        .contains(&text(&e["type"]))
        {
            let expected = self.0.settings.get(if mode == "live" {
                "COMPOUND_PAYMENT_LINK_ID_LIVE"
            } else {
                "COMPOUND_PAYMENT_LINK_ID_TEST"
            });
            let amount = s["amount_total"]
                .as_f64()
                .filter(|n| n.fract() == 0. && *n >= 100. && *n <= 1000000.);
            if !expected.is_some_and(|id| s["payment_link"] == id)
                || s["payment_status"] != "paid"
                || s["currency"] != "eur"
                || amount.is_none()
                || !truthy(&s["payment_intent"])
            {
                return Ok(json!({"ignored":true}));
            }
            let amount = amount.ok_or("amount")?;
            let reference = if truthy(&s["client_reference_id"]) {
                text(&s["client_reference_id"])
            } else {
                "none"
            };
            let mut tags = self.get(&format!("checkout:{reference}")).await?;
            if tags.is_null() {
                tags = json!({});
            }
            let source = if truthy(&tags["source"]) {
                text(&tags["source"])
            } else {
                "direct"
            };
            let deadline =
                chrono::DateTime::parse_from_rfc3339(model::FUND_DEADLINE)?.timestamp_millis();
            // Missing created is NaN in the legacy comparison, so routes to the late fund.
            let before =
                signed_number(e.get("created")).is_some_and(|n| n * 1000. <= deadline as f64);
            let fund = self.key(&format!(
                "{}:{mode}",
                if before { "fund" } else { "fund-late" }
            ));
            let mut receipt_tags = tags.clone();
            if let Some(m) = receipt_tags.as_object_mut() {
                m.remove("visitor");
                m.remove("visit");
            }
            let data = json!({"amount":amount,"refunded":0,"source":source,"fund":fund,"tags":receipt_tags});
            let script = "if not redis.call('SET',KEYS[1],ARGV[1],'NX','EX',31536000) then return 0 end;redis.call('INCRBY',KEYS[2],ARGV[2]);redis.call('HINCRBY',KEYS[3],ARGV[3],ARGV[2]);redis.call('HINCRBY',KEYS[3],ARGV[4],1);return 1";
            let added = numeric(
                &self
                    .eval(
                        script,
                        &[
                            self.key(&format!("payment:{mode}:{}", text(&s["payment_intent"]))),
                            fund,
                            self.key(&format!("donation-sources:{mode}")),
                        ],
                        &[
                            data.to_string(),
                            amount.to_string(),
                            format!("{source}:cents"),
                            format!("{source}:payments"),
                        ],
                    )
                    .await?,
            ) != 0.;
            if added {
                self.event(
                    "donation_success",
                    text(&tags["version"]),
                    &tags,
                    tags["visitor"].as_str(),
                    &json!({"method":"stripe","amount":amount,"visit":tags["visit"]}),
                )
                .await?;
            }
            return Ok(json!({"added":added}));
        }
        if e["type"] == "charge.refunded"
            && truthy(&s["payment_intent"])
            && s["amount_refunded"]
                .as_f64()
                .is_some_and(|n| n.fract() == 0.)
        {
            let script = "local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local r=cjson.decode(raw);local target=math.min(r.amount,tonumber(ARGV[1]));local diff=target-r.refunded;if diff<=0 then return 0 end;r.refunded=target;redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');redis.call('DECRBY',r.fund,diff);redis.call('HINCRBY',KEYS[2],r.source..':cents',-diff);return cjson.encode({amount=diff,tags=r.tags})";
            let raw = self
                .eval(
                    script,
                    &[
                        self.key(&format!("payment:{mode}:{}", text(&s["payment_intent"]))),
                        self.key(&format!("donation-sources:{mode}")),
                    ],
                    &[numeric(&s["amount_refunded"]).to_string()],
                )
                .await?;
            if truthy(&raw) {
                let refund: Value = serde_json::from_str(text(&raw))?;
                let tags = &refund["tags"];
                self.event(
                    "donation_refund",
                    text(&tags["version"]),
                    tags,
                    tags["visitor"].as_str(),
                    &json!({"method":"stripe","amount":refund["amount"],"visit":tags["visit"]}),
                )
                .await?;
            }
            return Ok(json!({"refunded":truthy(&raw)}));
        }
        Ok(json!({"ignored":true}))
    }
}
fn signed_number(value: Option<&Value>) -> Option<f64> {
    value.and_then(crate::compound_v2::model::number)
}
pub fn mode(env: &Settings) -> &str {
    env.get("COMPOUND_STRIPE_MODE")
        .unwrap_or(if env.production() { "live" } else { "test" })
}
pub fn checkout(
    env: &Settings,
    raw: &Value,
    journey: &Value,
    reference: &str,
    now: i64,
) -> Result<Value, Error> {
    let mode = mode(env);
    let url = env
        .get(if mode == "live" {
            "COMPOUND_PAYMENT_LINK_LIVE"
        } else {
            "COMPOUND_PAYMENT_LINK_TEST"
        })
        .ok_or("payments not connected yet")?;
    let mut url = Url::parse(url).map_err(|_| "payment configuration")?;
    if url.scheme() != "https" || url.host_str() != Some("buy.stripe.com") {
        return Err("payment configuration".into());
    }
    let mut pairs: Vec<(String, String)> = url.query_pairs().into_owned().collect();
    let mut found = false;
    pairs.retain_mut(|(k, v)| {
        if k != "client_reference_id" {
            return true;
        }
        if found {
            return false;
        }
        found = true;
        *v = reference.into();
        true
    });
    if !found {
        pairs.push(("client_reference_id".into(), reference.into()));
    }
    url.set_query(None);
    url.query_pairs_mut().extend_pairs(pairs);
    let mut tags = model::attribution(raw, true, now);
    for k in ["visitor", "visit", "version"] {
        tags[k] = if truthy(&journey[k]) {
            journey[k].clone()
        } else {
            Value::Null
        };
    }
    Ok(json!({"url":url.as_str(),"test":mode=="test","record":tags}))
}
/// The application uses Stripe's default 300s past-age tolerance, including multiple v1 signatures.
/// Verify raw bytes before parsing. The request path additionally bounds the streaming body.
pub fn verified_event(
    payload: &[u8],
    header: &str,
    env: &Settings,
    now: i64,
) -> Result<Value, Error> {
    let secret = env
        .get(if mode(env) == "live" {
            "STRIPE_WEBHOOK_SECRET_LIVE"
        } else {
            "STRIPE_WEBHOOK_SECRET_TEST"
        })
        .ok_or("not configured")?;
    verify_signature(payload, header, secret, now)
}
/// Shared raw-byte validator; each application selects its own environment-scoped secret.
pub fn verify_signature(
    payload: &[u8],
    header: &str,
    secret: &str,
    now: i64,
) -> Result<Value, Error> {
    if payload.len() > 128000 {
        return Err("too much data".into());
    }
    let mut time = None;
    let mut signatures = Vec::new();
    for item in header.split(',') {
        let mut kv = item.trim().split('=');
        let k = kv.next().unwrap_or("");
        let v = kv.next().unwrap_or("");
        match k {
            "t" => {
                let t = v.trim_start();
                let digits = t
                    .trim_start_matches(['-', '+'])
                    .bytes()
                    .take_while(u8::is_ascii_digit)
                    .count();
                let sign = usize::from(t.starts_with(['-', '+']));
                time = t
                    .get(..sign + digits)
                    .filter(|_| digits > 0)
                    .and_then(|s| s.parse::<i64>().ok());
            }
            "v1" => signatures.push(v),
            _ => (),
        }
    }
    let timestamp = time.filter(|n| *n != -1).ok_or("invalid signature")?;
    let body = std::str::from_utf8(payload).map_err(|_| "invalid signature")?;
    let expected = hex::encode(crypto::hmac(
        secret.as_bytes(),
        format!("{timestamp}.{body}").as_bytes(),
    ));
    if !signatures.iter().any(|s| crypto::safe_equal(s, &expected))
        || now.div_euclid(1000).saturating_sub(timestamp) > 300
    {
        return Err("invalid signature".into());
    }
    serde_json::from_slice(payload).map_err(|_| "invalid signature".into())
}
