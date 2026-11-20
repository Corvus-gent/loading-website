use super::{model, security};
use crate::{AppState, Error, compound::store::command, crypto};
use axum::http::HeaderMap;
use corvus_core::army::truthy;
use serde_json::{Value, json};
pub struct Senate<'a>(pub &'a AppState);
impl Senate<'_> {
    pub fn key(&self, suffix: &str) -> String {
        security::key(&self.0.settings, suffix)
    }
    pub async fn get(&self, suffix: &str) -> Result<Value, Error> {
        let raw = self.0.store.get(&self.key(suffix)).await?;
        Ok(match raw.as_str() {
            Some(s) => serde_json::from_str(s)?,
            None => Value::Null,
        })
    }
    pub async fn profile(&self, slug: &str) -> Result<Value, Error> {
        if !model::valid_slug(&json!(slug)) {
            return Ok(Value::Null);
        }
        let mut p = self.get(&format!("spotlight:{slug}")).await?;
        if p.is_object() {
            p["content"] = model::stored_content(&p["content"]);
        }
        Ok(p)
    }
    pub async fn reserve(&self, b: &Value) -> Result<Value, Error> {
        let now = crate::compound_v2::model::now();
        let p = model::reservation(b, &now)?;
        let slug = model::text(&p, "slug");
        // Keep the profile and its public-list index together on interrupted writes.
        let wrote=self.0.store.command(command(&["EVAL","if not redis.call('SET',KEYS[1],ARGV[1],'NX') then return 0 end;redis.call('ZADD',KEYS[2],ARGV[2],ARGV[3]);return 1","2",&self.key(&format!("spotlight:{slug}")),&self.key("spotlights"),&p.to_string(),&chrono::Utc::now().timestamp_millis().to_string(),slug])).await?;
        if wrote.as_i64() != Some(1) {
            return Err("spotlight_exists".into());
        }
        Ok(p)
    }
    async fn ids(&self) -> Result<Vec<String>, Error> {
        let v = self
            .0
            .store
            .command(command(&["ZREVRANGE", &self.key("spotlights"), "0", "499"]))
            .await?;
        Ok(v.as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default())
    }
    pub async fn public_list(&self) -> Result<Value, Error> {
        let ids = self.ids().await?;
        let rows = self
            .0
            .store
            .pipeline(
                ids.iter()
                    .map(|s| command(&["GET", &self.key(&format!("spotlight:{s}"))]))
                    .collect(),
            )
            .await?;
        let mut profiles = vec![];
        for raw in rows {
            if let Some(raw) = raw.as_str() {
                let p: Value = serde_json::from_str(raw)?;
                if p["status"] == "active" {
                    profiles.push(model::public_profile(&p));
                }
            }
        }
        Ok(json!(profiles))
    }
    pub async fn editing(&self, raw: &str) -> Result<Value, Error> {
        if !security::valid_token(&json!(raw)) {
            return Err("edit_token".into());
        }
        let hash = crypto::sha(raw);
        let slug = self
            .0
            .store
            .get(&self.key(&format!("spotlight-edit:{hash}")))
            .await?;
        let p = self.profile(slug.as_str().unwrap_or("")).await?;
        if p.is_null() || p["status"] != "active" || p["edit_hash"] != hash {
            return Err("edit_token".into());
        }
        Ok(p)
    }
    pub async fn validate_images(&self, p: &Value, c: &Value) -> Result<(), Error> {
        for image in [
            model::text(c, "photo"),
            model::text(&c["highlight"], "image"),
        ]
        .into_iter()
        .filter(|s| !s.is_empty())
        {
            if image == model::text(&p["content"], "photo")
                || image == model::text(&p["content"]["highlight"], "image")
                || p["slug"] == model::config()["simon"]["slug"]
                    && image == model::text(&model::config()["simon"]["content"], "photo")
            {
                continue;
            }
            let allowed = self
                .0
                .store
                .command(command(&[
                    "SISMEMBER",
                    &self.key(&format!("spotlight-images:{}", model::text(p, "slug"))),
                    image,
                ]))
                .await?;
            if allowed.as_i64() != Some(1) {
                return Err("image".into());
            }
        }
        Ok(())
    }
    pub async fn publish(
        &self,
        p: &Value,
        raw: &Value,
        actor: Option<&str>,
        expected: &Value,
        admin: bool,
    ) -> Result<Value, Error> {
        if !admin && truthy(&p["locked"]) {
            return Err("locked".into());
        }
        let revision = crate::compound_v2::model::number(expected)
            .filter(|n| n.fract() == 0. && n.abs() <= 9_007_199_254_740_991.)
            .ok_or("conflict")?;
        if p["revision"].as_f64() != Some(revision) {
            return Err("conflict".into());
        }
        let c = model::content(raw)?;
        self.validate_images(p, &c).await?;
        let at = crate::compound_v2::model::now();
        let by = actor
            .filter(|s| !s.is_empty())
            .unwrap_or(model::text(p, "name"));
        let version = json!({"revision":revision+1.,"content":c,"at":at,"by":by});
        let mut next = p.clone();
        next["content"] = c;
        next["revision"] = version["revision"].clone();
        next["last_edited_at"] = json!(at);
        next["last_edited_by"] = json!(by);
        let result = self
            .0
            .store
            .command(command(&[
                "EVAL",
                PUBLISH,
                "2",
                &self.key(&format!("spotlight:{}", model::text(p, "slug"))),
                &self.key(&format!("spotlight-versions:{}", model::text(p, "slug"))),
                &revision.to_string(),
                &next.to_string(),
                &version.to_string(),
                if admin { "admin" } else { "member" },
                model::text(p, "edit_hash"),
                if truthy(&p["locked"]) { "1" } else { "0" },
            ]))
            .await?;
        if result.as_i64() == Some(-2) {
            return Err("locked".into());
        }
        if result.as_i64() != Some(1) {
            return Err("conflict".into());
        }
        Ok(next)
    }
    pub async fn versions(&self, slug: &str) -> Result<Vec<Value>, Error> {
        let raw = self
            .0
            .store
            .command(command(&[
                "LRANGE",
                &self.key(&format!("spotlight-versions:{slug}")),
                "0",
                "-1",
            ]))
            .await?;
        let mut rows = vec![];
        if let Some(a) = raw.as_array() {
            for r in a {
                let mut v: Value = serde_json::from_str(r.as_str().ok_or("stored version")?)?;
                v["content"] = model::stored_content(&v["content"]);
                rows.push(v);
            }
        }
        Ok(rows)
    }
    pub async fn admin_list(&self) -> Result<Value, Error> {
        let mut rows = vec![];
        for slug in self.ids().await? {
            let p = self.profile(&slug).await?;
            if p.is_null() {
                continue;
            }
            let mut row = model::public_profile(&p);
            row["status"] = p["status"].clone();
            row["locked"] = p["locked"].clone();
            row["edit_status"] = json!(if truthy(&p["edit_hash"]) {
                "active"
            } else {
                "revoked"
            });
            let counts = self
                .0
                .store
                .command(command(&[
                    "HGETALL",
                    &self.key(&format!("spotlight-counts:{slug}")),
                ]))
                .await?;
            row["counts"] = Value::Object(crate::compound_v2::store::object(&counts));
            let versions = self
                .versions(&slug)
                .await?
                .into_iter()
                .map(|v| json!({"revision":v["revision"],"at":v["at"],"by":v["by"]}))
                .collect::<Vec<_>>();
            row["versions"] = json!(versions);
            rows.push(row);
        }
        Ok(json!(rows))
    }
    pub async fn manage(&self, slug: &str, action: &str, value: &Value) -> Result<Value, Error> {
        let p = self.profile(slug).await?;
        if p.is_null() {
            return Err("missing".into());
        }
        match action {
            "revert" => {
                let requested = crate::compound_v2::model::number(value);
                let v = self
                    .versions(slug)
                    .await?
                    .into_iter()
                    .find(|v| v["revision"].as_f64() == requested)
                    .ok_or("missing")?;
                self.publish(&p, &v["content"], Some("Gabe"), &p["revision"], true)
                    .await
            }
            "lock" => {
                self.0.store.command(command(&["EVAL","local p=cjson.decode(redis.call('GET',KEYS[1]));p.locked=ARGV[1]=='1';redis.call('SET',KEYS[1],cjson.encode(p));return 1","1",&self.key(&format!("spotlight:{slug}")),if truthy(value){"1"}else{"0"}])).await?;
                Ok(json!({"ok":true}))
            }
            "revoke_edit" => {
                self.0.store.command(command(&["EVAL","local p=cjson.decode(redis.call('GET',KEYS[1]));if p.edit_hash and p.edit_hash~=cjson.null then redis.call('DEL',ARGV[1]..p.edit_hash) end;p.edit_hash=cjson.null;redis.call('SET',KEYS[1],cjson.encode(p));return 1","1",&self.key(&format!("spotlight:{slug}")),&self.key("spotlight-edit:")])).await?;
                Ok(json!({"ok":true}))
            }
            _ => Err("fields".into()),
        }
    }
    pub async fn count(&self, h: &HeaderMap, slug: &str, kind: &str) -> Result<(), Error> {
        if !model::valid_slug(&json!(slug))
            || !["view", "link-0", "link-1", "link-2", "link-3", "cta"].contains(&kind)
        {
            return Ok(());
        }
        let ua = security::header(h, "user-agent").to_ascii_lowercase();
        let purpose = if security::header(h, "purpose").is_empty() {
            security::header(h, "sec-purpose")
        } else {
            security::header(h, "purpose")
        };
        if ["bot", "crawler", "preview", "curl", "headless"]
            .iter()
            .any(|s| ua.contains(s))
            || purpose.to_ascii_lowercase().contains("prefetch")
        {
            return Ok(());
        }
        let hash = crypto::daily_ip_hash(
            &crypto::server_secret(&self.0.settings)?,
            security::header(h, "x-forwarded-for"),
            &format!("senate:{slug}:{kind}"),
            &chrono::Utc::now().format("%Y-%m-%d").to_string(),
        );
        self.0.store.command(command(&["EVAL","if redis.call('SET',KEYS[1],'1','NX','EX',1800) then redis.call('HINCRBY',KEYS[2],ARGV[1],1) end;return 1","2",&self.key(&format!("spotlight-counted:{slug}:{kind}:{hash}")),&self.key(&format!("spotlight-counts:{slug}")),kind])).await?;
        Ok(())
    }
}
// Byte-for-byte legacy race contract; works while either runtime handles a request.
const PUBLISH: &str = "local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local p=cjson.decode(raw);if p.revision~=tonumber(ARGV[1]) then return -1 end;if ARGV[4]~='admin' and (p.locked or p.edit_hash~=ARGV[5]) then return -2 end;local hash=p.edit_hash;if not hash or hash==cjson.null then hash='' end;if hash~=ARGV[5] or p.locked~=(ARGV[6]=='1') then return -1 end;redis.call('SET',KEYS[1],ARGV[2]);redis.call('RPUSH',KEYS[2],ARGV[3]);return 1";
