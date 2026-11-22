import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { put } from '@vercel/blob';
import sharp from 'sharp';

export const imagePath = /^oli\/uploads\/[a-f0-9-]{36}\.jpg$/;
export const videoPath = /^oli\/(?:en|zh|long)\/[a-f0-9-]{36}\.mp4$/;
export const blobOptions = () => ({ access: 'private', token: process.env.OLI_BLOB_READ_WRITE_TOKEN });

function blobOrigin() {
  const store = /^vercel_blob_rw_([a-z\d]+)_/i.exec(process.env.OLI_BLOB_READ_WRITE_TOKEN || '')?.[1];
  return store ? `https://${store.toLowerCase()}.private.blob.vercel-storage.com` : null;
}

export function versionPath(value, variant) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const path = url.pathname.slice(1);
    if (url.origin === blobOrigin() &&
        !url.username && !url.password && !url.search && !url.hash &&
        videoPath.test(path) && (!variant || path.startsWith(`oli/${variant}/`))) return path;
  } catch { /* Invalid URL. */ }
  return null;
}

export async function uploadPhoto(req, res) {
  const data = req.body?.photo;
  if (typeof data !== 'string' || data.length > 3_900_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return res.status(400).json({ error: 'Choose a JPEG, PNG or WebP photo up to 8 MB.' });
  }
  let jpeg;
  try {
    const photo = sharp(Buffer.from(data, 'base64'), { limitInputPixels: 20_000_000, failOn: 'warning' });
    if (!['jpeg', 'png', 'webp'].includes((await photo.metadata()).format)) throw new Error();
    jpeg = await photo.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 83 }).toBuffer();
  } catch {
    return res.status(400).json({ error: 'This photo could not be decoded.' });
  }
  const pathname = `oli/uploads/${randomUUID()}.jpg`;
  if (!blobOptions().token) return res.status(503).json({ error: 'Photo storage is unavailable.' });
  await put(pathname, jpeg, { ...blobOptions(), contentType: 'image/jpeg' });
  return res.status(201).json({ image: pathname });
}

function readBlob(path, signal, headers = {}) {
  return fetch(blobOrigin() + '/' + path, {
    signal, redirect: 'error', headers: { authorization: `Bearer ${blobOptions().token}`, ...headers }
  });
}

export async function imageForModel(path) {
  if (!blobOrigin()) throw new Error('Photo storage unavailable');
  const blob = await readBlob(path, AbortSignal.timeout(10_000));
  if (!blob.ok) throw new Error('Photo unavailable');
  const bytes = Buffer.from(await blob.arrayBuffer());
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

export async function serveMedia(req, res) {
  const { file } = req.query;
  if (typeof file !== 'string' || (!imagePath.test(file) && !videoPath.test(file))) return res.status(404).end();
  if (!blobOrigin()) return res.status(503).end();
  const range = req.headers.range;
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return res.status(416).end();
  const controller = new AbortController();
  const stop = () => controller.abort();
  res.once('close', stop);
  try {
    const blob = await readBlob(file, controller.signal, range ? { Range: range } : {});
    if (blob.status === 416) {
      const contentRange = blob.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      return res.status(416).end();
    }
    if (blob.status === 404) return res.status(404).end();
    if (!blob.ok || !blob.body) return res.status(502).end();
    res.status(blob.status);
    res.setHeader('Content-Type', videoPath.test(file) ? 'video/mp4' : 'image/jpeg');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    for (const header of ['content-length', 'content-range', 'accept-ranges']) {
      const value = blob.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    await pipeline(Readable.fromWeb(blob.body), res);
  } catch (error) {
    if (controller.signal.aborted || res.headersSent) return;
    throw error;
  } finally {
    res.off('close', stop);
  }
}
