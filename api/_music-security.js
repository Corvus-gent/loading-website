import crypto from 'node:crypto';
import { redis } from './_redis.js';
const privateEnv = Object.entries(process.env).find(([k,v]) => /(?:REST_API_TOKEN|REDIS_REST_TOKEN)$/.test(k) && v)?.[1];
const secret = process.env.VOTE_SECRET || process.env.SESSION_SECRET || process.env.REDIS_URL || privateEnv;
const sign = value => {
  if (!secret) throw new Error('vote secret unavailable');
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
};
export function readVoter(req) {
  const match = /(?:^|;\s*)mvid=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
  if (!match) return null;
  const expected = sign(match[1]);
  return match[2].length === expected.length && crypto.timingSafeEqual(Buffer.from(match[2]), Buffer.from(expected)) ? match[1] : null;
}
export function ensureVoter(req,res) {
  const existing = readVoter(req);
  if (existing) return existing;
  const id = crypto.randomBytes(18).toString('base64url');
  res.setHeader('Set-Cookie', `mvid=${id}.${sign(id)}; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`);
  return id;
}
export const ipHash = req => sign(String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown');
export async function rateLimit(key, max, seconds) {
  return Number(await redis(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", '1', key, String(seconds)])) <= max;
}
export const zeroBits = buffer => { let n=0; for (const b of buffer) { if (!b) n+=8; else { n+=Math.clz32(b)-24; break; } } return n; };
export async function makeChallenge(voter,action) {
  const id = crypto.randomBytes(18).toString('base64url'), salt = crypto.randomBytes(24).toString('hex');
  const seenKey = `music:seen:${voter}`;
  await redis(['SET', seenKey, String(Date.now()), 'NX', 'EX', '3600']);
  const notBefore = Number(await redis(['GET', seenKey])) + 2000;
  const bits = action === 'suggest' ? 18 : 16;
  await redis(['SET',`music:challenge:${id}`, JSON.stringify({voter,action,salt,bits,notBefore}), 'EX','300']);
  return {id,salt,bits,notBefore};
}
export async function verifyChallenge(voter,body) {
  if (typeof body.challenge !== 'string' || !/^[A-Za-z0-9_-]{24}$/.test(body.challenge) || !Number.isSafeInteger(body.nonce) || body.nonce < 0) return false;
  const raw = await redis(['GETDEL',`music:challenge:${body.challenge}`]);
  if (!raw) return false;
  const ch = JSON.parse(raw);
  if (ch.voter !== voter || ch.action !== body.action || (body.action === 'suggest' && Date.now() < ch.notBefore)) return false;
  return zeroBits(crypto.createHash('sha256').update(`${ch.salt}:${body.nonce}`).digest()) >= ch.bits;
}
