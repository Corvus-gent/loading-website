import crypto from 'node:crypto';
import { redis } from './_redis.js';
import {musicVoteSecret} from './_secrets.js';
const sign = value => crypto.createHmac('sha256',musicVoteSecret()).update(value).digest('base64url');
export function readVoter(req) {
  const match = /(?:^|;\s*)mvid=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
  if (!match) return null;
  const expected = sign(match[1]);
  return match[2].length === expected.length && crypto.timingSafeEqual(Buffer.from(match[2]), Buffer.from(expected)) ? match[1] : null;
}
export function ensureVoter(req,res,adopt=null) {
  const existing = readVoter(req);
  if (existing) return existing;
  // adopt: an id this device already used today (lost cookie, second tab, private window on the same network)
  const id = typeof adopt === 'string' && /^[A-Za-z0-9_-]{16,40}$/.test(adopt) ? adopt : crypto.randomBytes(18).toString('base64url');
  res.setHeader('Set-Cookie', `mvid=${id}.${sign(id)}; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`);
  return id;
}
export { dailyIPHash as ipHash, rateLimit } from './_privacy.js';
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
