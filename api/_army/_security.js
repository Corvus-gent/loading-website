import crypto from 'node:crypto';
import {serverSecret} from '../_secrets.js';
import {safeEqual} from '../_session.js';
import {ORIGINS, dailyIPHash} from '../_privacy.js';
export const armySecret = () => process.env.ARMY_SECRET || serverSecret();
export const digest = value => crypto.createHmac('sha256', armySecret()).update('army:v1:' + value).digest('hex');
export const id = () => crypto.randomBytes(18).toString('base64url');
export function recruitCode() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  return Array.from(crypto.randomBytes(8), n => alphabet[n & 31]).join('');
}
export const validID = value => typeof value === 'string' && /^[A-Za-z0-9_-]{24}$/.test(value);
export const validCode = value => typeof value === 'string' && /^[a-z2-7]{8}$/.test(value);
export function signed(value, scope) { return value + '.' + digest(scope + ':' + value); }
export function readCookie(req, name, scope) {
  const match = new RegExp('(?:^|;\\s*)' + name + '=([^;]+)').exec(req.headers.cookie || '');
  if (!match) return null;
  const [value, sig, extra] = match[1].split('.');
  return !extra && value && sig && safeEqual(sig, digest(scope + ':' + value)) ? value : null;
}
export function cookie(res, name, value, seconds, scope = name) {
  const current = res.getHeader?.('Set-Cookie');
  const next = `${name}=${value ? signed(value, scope) : ''}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`;
  res.setHeader('Set-Cookie', [...(current ? Array.isArray(current) ? current : [current] : []), next]);
}
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin)) return true;
  // Preview requests must match their own hostname, never arbitrary *.vercel.app.
  return process.env.VERCEL_ENV === 'preview' && typeof origin === 'string' && origin === `https://${req.headers.host}`;
}
export const rateHash = (req, scope, now) => dailyIPHash(req, 'army:' + scope, new Date(now));
export function country(req) {
  const code = req.headers['x-vercel-ip-country'];
  return typeof code === 'string' && /^[A-Z]{2}$/.test(code) ? code : null;
}
export function seal(value) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(digest('mail-encryption'), 'hex'), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function open(value) {
  const b = Buffer.from(value, 'base64url'), decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(digest('mail-encryption'), 'hex'), b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28)); return Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString('utf8');
}
export const namespace = () => process.env.ARMY_NAMESPACE || (process.env.VERCEL_ENV === 'preview' ? 'army:preview:' + digest(process.env.VERCEL_GIT_COMMIT_REF || 'preview').slice(0, 12) + ':' : 'army:v1:');
