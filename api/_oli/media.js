import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { blobOptions } from './blob-config.js';
import { openMedia, sealMedia } from './sealed-media.js';

export const imagePath = /^oli\/uploads\/[a-f0-9-]{36}\.jpg$/;
export const videoPath = /^oli\/(?:en|zh|long)\/[a-f0-9-]{36}\.mp4$/;

function blobOrigin() {
  const { access, token } = blobOptions();
  const store = /^vercel_blob_rw_([a-z\d]+)_/i.exec(token || '')?.[1];
  return store ? `https://${store.toLowerCase()}.${access}.blob.vercel-storage.com` : null;
}

export function versionPath(value, variant) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const storedPath = url.pathname.slice(1);
    const publicStore = blobOptions().access === 'public';
    if (publicStore && !storedPath.endsWith('.enc')) return null;
    const path = publicStore ? storedPath.slice(0, -4) : storedPath;
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
  const options = blobOptions();
  if (options.access === 'public') {
    await put(pathname + '.enc', sealMedia([jpeg], pathname), { ...options, contentType: 'application/octet-stream' });
  } else {
    await put(pathname, jpeg, { ...options, contentType: 'image/jpeg' });
  }
  return res.status(201).json({ image: pathname });
}

function readBlob(path, signal, range) {
  const options = blobOptions();
  const publicStore = options.access === 'public';
  const headers = {};
  if (range) headers.Range = range;
  if (!publicStore) headers.authorization = `Bearer ${options.token}`;
  return fetch(blobOrigin() + '/' + path + (publicStore ? '.enc' : ''), {
    signal, redirect: 'error', headers
  });
}

async function readMedia(path, signal, range) {
  if (blobOptions().access === 'public') return openMedia(value => readBlob(path, signal, value), path, range);
  const blob = await readBlob(path, signal, range);
  return {
    status: blob.status, length: blob.headers.get('content-length'),
    contentRange: blob.headers.get('content-range'),
    stream: blob.ok && blob.body ? Readable.fromWeb(blob.body) : null
  };
}

export async function imageForModel(path) {
  if (!blobOrigin()) throw new Error('Photo storage unavailable');
  const blob = await readMedia(path, AbortSignal.timeout(10_000));
  if (!blob.stream) throw new Error('Photo unavailable');
  const bytes = Buffer.from(await new Response(Readable.toWeb(blob.stream)).arrayBuffer());
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
    const blob = await readMedia(file, controller.signal, range);
    res.status(blob.status);
    if (blob.contentRange) res.setHeader('Content-Range', blob.contentRange);
    if (!blob.stream) return res.end();
    res.setHeader('Content-Type', videoPath.test(file) ? 'video/mp4' : 'image/jpeg');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    if (blob.length != null) res.setHeader('Content-Length', blob.length);
    await pipeline(blob.stream, res);
  } catch (error) {
    if (controller.signal.aborted || res.headersSent) return;
    throw error;
  } finally {
    res.off('close', stop);
  }
}
