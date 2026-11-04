import crypto from 'node:crypto';
import { redis } from './_redis.js';

export const DAY = 86400;
export const LOG_RETENTION = 90 * DAY;
export const VOTER_RETENTION = 365 * DAY;
export const ORIGINS = ['https://corvus.gent', 'https://www.corvus.gent', 'https://stats.corvus.gent'];

// Secrets never fall back to a public constant. Redis credentials are supported
// for existing installations; a dedicated SESSION_SECRET is preferred.
export function serverSecret() {
  let value = process.env.PRIVACY_SECRET || process.env.SESSION_SECRET || process.env.VOTE_SECRET
    || Object.entries(process.env).find(([key, value]) => /(?:REST_API_TOKEN|REDIS_REST_TOKEN)$/.test(key) && value)?.[1];
  if (!value && process.env.REDIS_URL) {
    try { if (new URL(process.env.REDIS_URL).password) value = process.env.REDIS_URL; } catch {}
  }
  if (!value) throw new Error('server secret missing');
  return value;
}

export function dailyIPHash(req, scope = 'abuse', now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const salt = crypto.createHmac('sha256', serverSecret()).update(`corvus:rate-limit:${day}:${scope}`).digest();
  const address = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  // Only the derived, daily value leaves this function. Never log address/salt.
  return 'd1:' + crypto.createHmac('sha256', salt).update(address).digest('hex');
}

export async function rateLimit(key, max, seconds) {
  const script = "local n=redis.call('INCR',KEYS[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
  return Number(await redis(['EVAL', script, '1', key, String(seconds)])) <= max;
}

// A list-wide sliding TTL would retain old emails indefinitely on a busy site.
// Each record therefore has its own absolute maximum age; the index has no email.
export async function appendPrivateLog(kind, email, at = new Date().toISOString(), recordId) {
  if (!['logins', 'access'].includes(kind)) throw new Error('invalid log kind');
  const time = Date.parse(at), remaining = Math.floor((time + LOG_RETENTION * 1000 - Date.now()) / 1000);
  if (!Number.isFinite(time) || remaining <= 0 || time > Date.now() + 1000) return;
  const id = recordId || crypto.randomBytes(16).toString('hex');
  if (!/^[a-f0-9]{32,64}$/.test(id)) throw new Error('invalid log id');
  const script = `redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2])
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[5])
redis.call('ZADD',KEYS[2],ARGV[3],ARGV[4]); redis.call('EXPIRE',KEYS[2],ARGV[6]); return 1`;
  await redis(['EVAL', script, '2', `privacy:log:${kind}:${id}`, `privacy:log-index:${kind}`,
    JSON.stringify({ email: email.trim().toLowerCase(), at }), String(Math.min(remaining, LOG_RETENTION)), String(time), id,
    String(Date.now() - LOG_RETENTION * 1000), String(LOG_RETENTION)]);
}

export async function privateLogs(kind) {
  const key = `privacy:log-index:${kind}`;
  await redis(['ZREMRANGEBYSCORE', key, '-inf', String(Date.now() - LOG_RETENTION * 1000)]);
  const ids = await redis(['ZREVRANGE', key, '0', '49']) || [];
  const records = await Promise.all(ids.map(id => redis(['GET', `privacy:log:${kind}:${id}`])));
  return records.filter(Boolean).map(JSON.parse).filter(r => Date.parse(r.at) > Date.now() - LOG_RETENTION * 1000);
}
