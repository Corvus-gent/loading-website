// The existing public store only receives authenticated ciphertext. Fixed-size
// records let the review API seek without downloading or decrypting earlier records.
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';

const block = 256 * 1024;
const tagSize = 16;
const saltSize = 16;
const recordSize = block + tagSize;

function keyFor(name, salt) {
  const secret = process.env.OLI_AGENT_TOKEN;
  if (!secret) throw new Error('The public-store fallback needs OLI_AGENT_TOKEN.');
  return createHmac('sha256', secret).update('oli-media-v1\0').update(name).update('\0').update(salt).digest();
}

function nonce(index) {
  const bytes = Buffer.alloc(12);
  bytes.writeUInt32BE(index, 8);
  return bytes;
}

async function* records(input, size) {
  let pending = Buffer.alloc(0);
  for await (const chunk of input) {
    pending = pending.length ? Buffer.concat([pending, chunk]) : Buffer.from(chunk);
    while (pending.length >= size) {
      yield pending.subarray(0, size);
      pending = pending.subarray(size);
    }
  }
  if (pending.length) yield pending;
}

export function sealMedia(input, name) {
  const salt = randomBytes(saltSize);
  const key = keyFor(name, salt);
  return Readable.from((async function* () {
    yield salt;
    let index = 0;
    for await (const raw of records(input, block)) {
      const cipher = createCipheriv('aes-256-gcm', key, nonce(index++));
      yield Buffer.concat([cipher.update(raw), cipher.final(), cipher.getAuthTag()]);
    }
  })());
}

function requestedRange(range, size) {
  if (!range) return [0, size - 1];
  const [first, last] = range.slice(6).split('-');
  if (!first && Number(last) > 0) return [Math.max(0, size - Number(last)), size - 1];
  const start = Number(first);
  const end = last ? Math.min(size - 1, Number(last)) : size - 1;
  if (!first || !Number.isSafeInteger(start) || start > end) return null;
  return [start, end];
}

function openRecords(input, key, first, last, start, end) {
  return Readable.from((async function* () {
    let index = first;
    for await (const record of records(input, recordSize)) {
      const offset = index * block;
      const decipher = createDecipheriv('aes-256-gcm', key, nonce(index++));
      decipher.setAuthTag(record.subarray(-tagSize));
      const clear = Buffer.concat([decipher.update(record.subarray(0, -tagSize)), decipher.final()]);
      yield clear.subarray(Math.max(0, start - offset), end - offset + 1);
    }
    if (index !== last + 1) throw new Error('Incomplete media response.');
  })());
}

export async function openMedia(fetchRange, name, range) {
  const header = await fetchRange(`bytes=0-${saltSize - 1}`);
  if (header.status === 404) return { status: 404 };
  const match = /^bytes 0-15\/(\d+)$/.exec(header.headers.get('content-range') || '');
  if (header.status !== 206 || !match) {
    await header.body?.cancel();
    return { status: 502 };
  }
  const salt = Buffer.from(await header.arrayBuffer());
  const encryptedSize = Number(match[1]) - saltSize;
  const size = encryptedSize - Math.ceil(encryptedSize / recordSize) * tagSize;
  if (salt.length !== saltSize || !Number.isSafeInteger(size) || size <= 0) return { status: 502 };
  const bounds = requestedRange(range, size);
  if (!bounds) return { status: 416, contentRange: `bytes */${size}` };
  const [start, end] = bounds;
  const first = Math.floor(start / block);
  const last = Math.floor(end / block);
  const low = saltSize + first * recordSize;
  const high = saltSize + Math.min(encryptedSize, (last + 1) * recordSize) - 1;
  const encrypted = await fetchRange(`bytes=${low}-${high}`);
  if (encrypted.status !== 206 || !encrypted.body ||
      encrypted.headers.get('content-range') !== `bytes ${low}-${high}/${encryptedSize + saltSize}`) {
    await encrypted.body?.cancel();
    return { status: 502 };
  }
  return {
    status: range ? 206 : 200,
    length: end - start + 1,
    contentRange: range ? `bytes ${start}-${end}/${size}` : null,
    stream: openRecords(Readable.fromWeb(encrypted.body), keyFor(name, salt), first, last, start, end)
  };
}
