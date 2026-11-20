import { createHash } from 'node:crypto';
import { connected, redis } from '../../api/_redis.js';

const counters = new Map();
const increment = `
  local n = redis.call('INCR', KEYS[1])
  if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return n
`;

export function networkId(req) {
  const header = req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'local';
  return createHash('sha256').update(String(header).split(',')[0].trim()).digest('hex').slice(0, 20);
}

export async function available(action, scope, limit, seconds) {
  const time = Math.floor(Date.now() / 1000);
  const window = Math.floor(time / seconds);
  const expires = (window + 1) * seconds;
  const key = `hackersbay:v1:quota:${action}:${scope}:${window}`;
  if (connected()) {
    try { return Number(await redis(['EVAL', increment, 1, key, expires - time + 1])) <= limit; }
    catch { if (process.env.VERCEL) return false; }
  }
  for (const [name, counter] of counters) if (counter.expires <= time) counters.delete(name);
  const count = (counters.get(key)?.count || 0) + 1;
  if (counters.size >= 2500 && !counters.has(key)) return false;
  counters.set(key, { count, expires });
  return count <= limit;
}
