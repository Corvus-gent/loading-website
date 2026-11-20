use super::store::{Interviews, RETENTION};
use crate::{AppState, Error, config::is_loopback};
use base64::{Engine, engine::general_purpose::STANDARD};
use image::{
    DynamicImage, ImageDecoder, ImageFormat, ImageReader, codecs::jpeg::JpegEncoder,
    imageops::FilterType,
};
use serde_json::{Value, json};
use std::{
    io::Cursor,
    sync::{Arc, LazyLock},
    time::Duration,
};
use tokio::sync::Semaphore;
use url::Url;

const API: &str = "https://vercel.com/api/blob";
const CHOOSE: &str = "Choose a JPEG, PNG or WebP photo under 1.7 MB.";
const INVALID: &str = "This photo could not be read. Try a JPEG instead.";
static DECODERS: LazyLock<Arc<Semaphore>> = LazyLock::new(|| Arc::new(Semaphore::new(2)));
pub fn reencode(data: &str) -> Result<Vec<u8>, Error> {
    let (header, body) = data.split_once(',').ok_or(CHOOSE)?;
    if data.len() > 2400000
        || ![
            "data:image/jpeg;base64",
            "data:image/png;base64",
            "data:image/webp;base64",
        ]
        .contains(&header)
        || body.is_empty()
        || !body
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'='))
    {
        return Err(CHOOSE.into());
    }
    let raw = STANDARD.decode(body).map_err(|_| INVALID)?;
    let mut reader = ImageReader::new(Cursor::new(&raw))
        .with_guessed_format()
        .map_err(|_| INVALID)?;
    if !matches!(
        reader.format(),
        Some(ImageFormat::Jpeg | ImageFormat::Png | ImageFormat::WebP)
    ) {
        return Err(INVALID.into());
    }
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(160 * 1024 * 1024);
    limits.max_image_width = Some(20000);
    limits.max_image_height = Some(20000);
    reader.limits(limits);
    let mut decoder = reader.into_decoder().map_err(|_| INVALID)?;
    let (w, h) = decoder.dimensions();
    if w == 0 || h == 0 || u64::from(w) * u64::from(h) > 20000000 {
        return Err(INVALID.into());
    }
    let orientation = decoder.orientation().map_err(|_| INVALID)?;
    let mut image = DynamicImage::from_decoder(decoder).map_err(|_| INVALID)?;
    image.apply_orientation(orientation);
    if image.width() > 1400 || image.height() > 1400 {
        image = image.resize(1400, 1400, FilterType::Lanczos3);
    }
    // JPEG has no alpha: match Sharp's black background while discarding metadata.
    let rgba = image.to_rgba8();
    let mut rgb = image::RgbImage::new(rgba.width(), rgba.height());
    for (out, source) in rgb.pixels_mut().zip(rgba.pixels()) {
        for i in 0..3 {
            out[i] = ((u16::from(source[i]) * u16::from(source[3]) + 127) / 255) as u8;
        }
    }
    let mut output = Vec::new();
    JpegEncoder::new_with_quality(&mut output, 82)
        .encode_image(&rgb)
        .map_err(|_| INVALID)?;
    Ok(output)
}

pub fn photo_url(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    let Some(filename) = url
        .path()
        .strip_prefix("/hack3/interviews/")
        .and_then(|s| s.strip_suffix(".jpg"))
    else {
        return false;
    };
    url.scheme() == "https"
        && url
            .host_str()
            .is_some_and(|s| s.ends_with(".public.blob.vercel-storage.com"))
        && !filename.is_empty()
        && filename
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b) || b == b'-')
}
pub struct Photos<'a> {
    state: &'a AppState,
    endpoint: String,
}
impl<'a> Photos<'a> {
    pub fn configured(state: &'a AppState) -> Result<Self, Error> {
        if let Some(endpoint) = state.settings.get("CORVUS_RUST_BLOB_FIXTURE_URL") {
            Self::isolated(state, endpoint)
        } else {
            Ok(Self::new(state))
        }
    }
    pub fn new(state: &'a AppState) -> Self {
        Self {
            state,
            endpoint: API.into(),
        }
    }
    pub fn isolated(state: &'a AppState, endpoint: &str) -> Result<Self, Error> {
        let url = Url::parse(endpoint)?;
        if state.settings.get("CORVUS_RUST_WRITES") != Some("isolated")
            || !state.settings.write_enabled()
            || !is_loopback(&url)
            || url.scheme() != "http"
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err("invalid blob fixture endpoint".into());
        }
        Ok(Self {
            state,
            endpoint: endpoint.trim_end_matches('/').into(),
        })
    }
    fn token(&self) -> Result<&str, Error> {
        if !self.state.settings.write_enabled() {
            return Err("Writes are disabled during migration validation".into());
        }
        if self.endpoint == API && self.state.settings.get("CORVUS_RUST_WRITES") == Some("isolated")
        {
            return Err("External blob writes are unavailable in isolated tests".into());
        }
        self.state
            .settings
            .get("BLOB_READ_WRITE_TOKEN")
            .ok_or_else(|| "missing blob token".into())
    }
    pub(crate) fn request(
        &self,
        method: reqwest::Method,
        path: &str,
    ) -> Result<reqwest::RequestBuilder, Error> {
        let token = self.token()?;
        let store = token.split('_').nth(3).unwrap_or("");
        Ok(self
            .state
            .http
            .request(method, format!("{}{path}", self.endpoint))
            .bearer_auth(token)
            .header("x-vercel-blob-store-id", store)
            .header(
                "x-api-blob-request-id",
                format!(
                    "{store}:{}:{}",
                    chrono::Utc::now().timestamp_millis(),
                    uuid::Uuid::new_v4()
                ),
            )
            .header("x-api-blob-request-attempt", "0")
            .header("x-api-version", "13")
            .timeout(Duration::from_secs(10)))
    }
    pub async fn upload(&self, data: &str) -> Result<String, Error> {
        self.token()?;
        let permit = tokio::time::timeout(Duration::from_secs(5), DECODERS.clone().acquire_owned())
            .await??;
        let data = data.to_string();
        let bytes = tokio::task::spawn_blocking(move || {
            let _permit = permit;
            reencode(&data)
        })
        .await??;
        let name = format!("hack3/interviews/{}.jpg", uuid::Uuid::new_v4());
        let response = self
            .request(reqwest::Method::PUT, "/")?
            .query(&[("pathname", &name)])
            .header("x-vercel-blob-access", "public")
            .header("x-add-random-suffix", "0")
            .header("x-content-type", "image/jpeg")
            .header("x-cache-control-max-age", "3600")
            .header("content-type", "image/jpeg")
            .body(bytes)
            .send()
            .await?
            .error_for_status()?;
        let blob: Value = response.json().await?;
        let url = blob["url"]
            .as_str()
            .filter(|s| photo_url(s) && Url::parse(s).is_ok_and(|u| u.path() == format!("/{name}")))
            .ok_or("invalid blob response")?
            .to_string();
        // Put expiry bookkeeping immediately; if it fails, make a best-effort direct deletion.
        if let Err(e) = self
            .state
            .store
            .command(vec![
                "ZADD".into(),
                Interviews(self.state).key("photos"),
                (chrono::Utc::now().timestamp_millis() + RETENTION * 1000).to_string(),
                url.clone(),
            ])
            .await
        {
            let _ = self.delete_blob(&url).await;
            return Err(e.into());
        }
        Ok(url)
    }
    async fn delete_blob(&self, url: &str) -> Result<(), Error> {
        self.request(reqwest::Method::POST, "/delete")?
            .json(&json!({"urls":[url]}))
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }
    pub async fn delete(&self, url: &str) -> Result<(), Error> {
        if !photo_url(url) {
            return Ok(());
        }
        self.token()?;
        let key = Interviews(self.state).key("photos");
        self.state
            .store
            .command(vec![
                "ZADD".into(),
                key.clone(),
                chrono::Utc::now().timestamp_millis().to_string(),
                url.into(),
            ])
            .await?;
        self.delete_blob(url).await?;
        self.state
            .store
            .command(vec!["ZREM".into(), key, url.into()])
            .await?;
        Ok(())
    }
    pub async fn cleanup(&self) -> Result<(), Error> {
        if self.state.settings.get("BLOB_READ_WRITE_TOKEN").is_none() {
            return Ok(());
        }
        self.token()?;
        let store = Interviews(self.state);
        if self
            .state
            .store
            .command(vec![
                "SET".into(),
                store.key("photo-cleanup"),
                "1".into(),
                "NX".into(),
                "EX".into(),
                "3600".into(),
            ])
            .await?
            .is_null()
        {
            return Ok(());
        }
        let urls = self
            .state
            .store
            .command(vec![
                "ZRANGEBYSCORE".into(),
                store.key("photos"),
                "-inf".into(),
                chrono::Utc::now().timestamp_millis().to_string(),
                "LIMIT".into(),
                "0".into(),
                "200".into(),
            ])
            .await?;
        // Bounded batches avoid a burst of 200 concurrent Blob operations.
        for batch in urls.as_array().ok_or("invalid photo index")?.chunks(4) {
            let mut jobs = tokio::task::JoinSet::new();
            for url in batch {
                if let Some(url) = url.as_str() {
                    let state = self.state.clone();
                    let endpoint = self.endpoint.clone();
                    let url = url.to_string();
                    jobs.spawn(async move {
                        Photos {
                            state: &state,
                            endpoint,
                        }
                        .delete(&url)
                        .await
                    });
                }
            }
            while jobs.join_next().await.is_some() {}
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn read_only_uploads_and_deletes_stop_before_image_or_network_work() -> Result<(), Error>
    {
        let settings = Arc::new(crate::config::Settings::new(
            [("BLOB_READ_WRITE_TOKEN".into(), "fixture-token".into())].into(),
        ));
        let http = reqwest::Client::new();
        let state = AppState {
            store: crate::store::Store::new(settings.clone(), http.clone()),
            settings,
            http,
            live: crate::live::LiveService::new()?,
            compound_summary: Default::default(),
            coffee: Default::default(),
        };
        let photos = Photos::new(&state);
        assert_eq!(
            photos
                .upload("not even an image")
                .await
                .err()
                .ok_or("expected refusal")?
                .to_string(),
            "Writes are disabled during migration validation"
        );
        assert_eq!(
            photos
                .delete("https://fixture.public.blob.vercel-storage.com/hack3/interviews/abc.jpg")
                .await
                .err()
                .ok_or("expected refusal")?
                .to_string(),
            "Writes are disabled during migration validation"
        );
        assert!(Photos::isolated(&state, "http://127.0.0.1:1").is_err());
        Ok(())
    }
    #[test]
    fn only_interview_photos_can_be_deleted() {
        assert!(photo_url(
            "https://fixture.public.blob.vercel-storage.com/hack3/interviews/abc-123.jpg"
        ));
        for bad in [
            "https://evil.test/hack3/interviews/abc.jpg",
            "http://fixture.public.blob.vercel-storage.com/hack3/interviews/abc.jpg",
            "https://fixture.public.blob.vercel-storage.com/senate/abc.jpg",
            "https://fixture.public.blob.vercel-storage.com/hack3/interviews/../senate/abc.jpg",
            "https://fixture.public.blob.vercel-storage.com/hack3/interviews/abc.svg",
            "https://fixture.public.blob.vercel-storage.com.evil.test/hack3/interviews/abc.jpg",
        ] {
            assert!(!photo_url(bad));
        }
    }
}
