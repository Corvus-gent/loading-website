//! Senate image upload. The public API still accepts a base64 still image, max 5 MB.
use super::{model, senate::Senate};
use crate::{AppState, Error, compound::store::command, interviews::photos::Photos};
use base64::{Engine, engine::general_purpose::STANDARD};
use image::{
    DynamicImage, ImageDecoder, ImageFormat, ImageReader,
    codecs::{
        png::PngDecoder,
        webp::{WebPDecoder, WebPEncoder},
    },
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
static DECODERS: LazyLock<Arc<Semaphore>> = LazyLock::new(|| Arc::new(Semaphore::new(1)));
pub fn reencode(data: &Value, original_size: &Value) -> Result<Vec<u8>, Error> {
    let size = original_size
        .as_f64()
        .filter(|n| n.fract() == 0. && *n >= 1. && *n <= 5. * 1024. * 1024.)
        .ok_or("image_size")?;
    let data = data
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 3_800_000)
        .ok_or("image_size")?;
    let body = data.trim_end_matches('=');
    if data.len() - body.len() > 2
        || body.is_empty()
        || !body
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/')
    {
        return Err("image_size".into());
    }
    let mut padded = body.to_string();
    while padded.len() % 4 != 0 {
        padded.push('=');
    }
    let bytes = STANDARD.decode(padded).map_err(|_| "image_format")?;
    if bytes.len() > 5 * 1024 * 1024 || size < 1. {
        return Err("image_size".into());
    }
    let mut reader = ImageReader::new(Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|_| "image_format")?;
    match reader.format() {
        Some(ImageFormat::WebP) => {
            if WebPDecoder::new(Cursor::new(&bytes))
                .map_err(|_| "image_format")?
                .has_animation()
            {
                return Err("image_format".into());
            }
        }
        Some(ImageFormat::Png) => {
            if PngDecoder::new(Cursor::new(&bytes))
                .map_err(|_| "image_format")?
                .is_apng()
                .map_err(|_| "image_format")?
            {
                return Err("image_format".into());
            }
        }
        Some(ImageFormat::Jpeg) => {}
        _ => return Err("image_format".into()),
    }
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(256 * 1024 * 1024);
    limits.max_image_width = Some(40000);
    limits.max_image_height = Some(40000);
    reader.limits(limits);
    let mut decoder = reader.into_decoder().map_err(|_| "image_format")?;
    let (w, h) = decoder.dimensions();
    if w == 0 || h == 0 || u64::from(w) * u64::from(h) > 40_000_000 {
        return Err("image_format".into());
    }
    let orientation = decoder.orientation().map_err(|_| "image_format")?;
    let mut image = DynamicImage::from_decoder(decoder).map_err(|_| "image_format")?;
    image.apply_orientation(orientation);
    let rgba = image
        .resize_to_fill(800, 800, FilterType::Lanczos3)
        .to_rgba8();
    let mut out = vec![];
    // Pure Rust encoder: lossless WebP rather than libvips' quality-85 lossy output.
    // Same 800px crop/alpha/orientation, fresh pixels only: no EXIF/ICC/source metadata.
    WebPEncoder::new_lossless(&mut out)
        .encode(rgba.as_raw(), 800, 800, image::ExtendedColorType::Rgba8)
        .map_err(|_| "image_format")?;
    Ok(out)
}
pub fn owned_url(raw: &str, slug: &str) -> bool {
    if !model::valid_slug(&json!(slug)) {
        return false;
    }
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    let prefix = format!("/senate/{slug}/");
    let Some(file) = url
        .path()
        .strip_prefix(&prefix)
        .and_then(|s| s.strip_suffix(".webp"))
    else {
        return false;
    };
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && url
            .host_str()
            .is_some_and(|h| h.ends_with(".public.blob.vercel-storage.com"))
        && uuid::Uuid::parse_str(file).is_ok()
}
pub async fn upload(state: &AppState, p: &Value, b: &Value) -> Result<Value, Error> {
    if !state.settings.write_enabled() {
        return Err("Writes are disabled during migration validation".into());
    }
    if p["locked"] == true {
        return Err("locked".into());
    }
    let photos = Photos::configured(state)?;
    // Check Blob configuration before decoding; request building performs no network I/O.
    let request = photos.request(reqwest::Method::PUT, "/")?;
    let permit =
        tokio::time::timeout(Duration::from_secs(5), DECODERS.clone().acquire_owned()).await??;
    let (data, size) = (b["data"].clone(), b["original_size"].clone());
    let bytes = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        reencode(&data, &size)
    })
    .await??;
    let slug = model::text(p, "slug");
    if !model::valid_slug(&json!(slug)) {
        return Err("missing".into());
    }
    let name = format!("senate/{slug}/{}.webp", uuid::Uuid::new_v4());
    let response = request
        .query(&[("pathname", &name)])
        .header("x-vercel-blob-access", "public")
        .header("x-add-random-suffix", "0")
        .header("x-content-type", "image/webp")
        .header("x-cache-control-max-age", "31536000")
        .header("content-type", "image/webp")
        .body(bytes)
        .send()
        .await?
        .error_for_status()?;
    let blob: Value = response.json().await?;
    let url = blob["url"]
        .as_str()
        .filter(|u| {
            owned_url(u, slug) && Url::parse(u).is_ok_and(|u| u.path() == format!("/{name}"))
        })
        .ok_or("invalid blob response")?;
    let senate = Senate(state);
    let current = senate.editing(model::text(b, "token")).await;
    // Recheck the capability after Blob returns: revocation/locking during an upload wins.
    let result=async{let current=current.map_err(|_|"locked")?;if current["locked"]==true||model::text(&current,"slug")!=slug{return Err::<(),Error>("locked".into());}
        let accepted=state.store.command(command(&["EVAL","local s=redis.call('GET',KEYS[1]);if not s then return 0 end;local p=cjson.decode(s);if p.locked or p.status~='active' or p.edit_hash~=ARGV[1] then return 0 end;redis.call('SADD',KEYS[2],ARGV[2]);return 1","2",&senate.key(&format!("spotlight:{slug}")),&senate.key(&format!("spotlight-images:{slug}")),model::text(&current,"edit_hash"),url])).await?;
        if accepted.as_i64()!=Some(1){return Err("locked".into());}Ok(())}.await;
    if let Err(e) = result {
        let _ = photos
            .request(reqwest::Method::POST, "/delete")?
            .json(&json!({"urls":[url]}))
            .send()
            .await;
        return Err(e);
    }
    Ok(json!({"url":url,"width":800,"height":800}))
}
