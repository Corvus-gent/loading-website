import { createHash } from 'node:crypto';
import { safeEqual, sign } from '../_session.js';
import { dailyIPHash, rateLimit } from '../_privacy.js';
import chat from './chat.js';
import { serveMedia, uploadPhoto, versionPath } from './media.js';
import { claim, finish, seed, state } from './store.js';
import { validateTimeline, variants } from './timeline.js';

const lifetime = 7 * 86400;
const methods = { access: 'POST', state: 'GET', chat: 'POST', upload: 'POST', media: 'GET', next: 'GET', result: 'POST', seed: 'POST' };
const agents = new Set(['next', 'result', 'seed']);
const uuid = /^[a-f0-9-]{36}$/;
const digest = value => createHash('sha256').update(value).digest('hex');
const seal = (expires, code) => sign(`oli-review:${expires}:${code}`);

function unlocked(req, code) {
  const cookie = /(?:^|;\s*)oli_review=(\d+)\.([A-Za-z0-9_-]+)(?:;|$)/.exec(req.headers.cookie || '');
  return Boolean(code && cookie && Number(cookie[1]) > Date.now() / 1000 && safeEqual(cookie[2], seal(cookie[1], code)));
}

function error(res, status, message) {
  return res.status(status).json({ error: message });
}

async function agent(action, req, res) {
  const body = req.body || {};
  if (action === 'next') return res.status(200).json({ job: await claim() });
  if (action === 'seed') {
    const { variant, timeline, versionUrl, label } = body;
    const path = versionPath(versionUrl, variant);
    if (!variants.includes(variant) || !path || !/^v[1-9]\d{0,5}$/.test(label)) return error(res, 400, 'Invalid seed.');
    try { validateTimeline(timeline); } catch (err) { return error(res, 400, err.message); }
    if (!await seed(variant, timeline, { path, label, changelog: 'First review cut' })) return error(res, 409, 'Cut already seeded.');
    return res.status(200).json({ ok: true });
  }
  const { id, claim: lease, status, versionUrl, changelog, timeline, reason } = body;
  if (!uuid.test(id) || !uuid.test(lease) || !['live', 'failed'].includes(status)) return error(res, 400, 'Invalid job result.');
  const path = status === 'live' ? versionPath(versionUrl) : null;
  if (status === 'live') {
    if (!path || typeof changelog !== 'string' || changelog.length > 240) return error(res, 400, 'Invalid version.');
    try { validateTimeline(timeline); } catch (err) { return error(res, 400, err.message); }
  }
  if (!await finish({ id, claim: lease, status, path, changelog, timeline,
    reason: typeof reason === 'string' ? reason.slice(0, 240) : 'The Mac could not complete the render.' })) {
    return error(res, 409, 'This render claim is no longer active.');
  }
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const action = req.query.oli;
  if (typeof action !== 'string' || !Object.hasOwn(methods, action)) return error(res, 404, 'Unknown review route.');
  if (req.method !== methods[action]) {
    res.setHeader('Allow', methods[action]);
    return error(res, 405, 'Method not allowed.');
  }
  if (agents.has(action)) {
    const token = process.env.OLI_AGENT_TOKEN;
    if (!token || !safeEqual(req.headers.authorization, `Bearer ${token}`)) return error(res, 401, 'Agent authorization required.');
    return agent(action, req, res);
  }
  const code = process.env.OLI_REVIEW_CODE;
  if (action === 'access') {
    if (!code) return error(res, 503, 'The review room is unavailable.');
    if (!await rateLimit(`oli:access:${dailyIPHash(req, 'oli-access')}`, 8, 900)) return error(res, 429, 'Too many attempts. Try again later.');
    const passcode = req.body?.passcode;
    if (typeof passcode !== 'string' || passcode.length > 256 || !safeEqual(digest(passcode), digest(code))) {
      return error(res, 401, 'Incorrect passcode.');
    }
    const expires = Math.floor(Date.now() / 1000) + lifetime;
    res.setHeader('Set-Cookie', `oli_review=${expires}.${seal(expires, code)}; Path=/; Max-Age=${lifetime}; HttpOnly; Secure; SameSite=Strict`);
    return res.status(200).json({ ok: true });
  }
  if (!unlocked(req, code)) return error(res, 401, 'Enter the review passcode.');
  if (action === 'media') return serveMedia(req, res);
  if (['upload', 'chat'].includes(action) &&
      !await rateLimit(`oli:${action}:${dailyIPHash(req, `oli-${action}`)}`, action === 'chat' ? 12 : 36, 60)) {
    return error(res, 429, 'Too many requests. Try again in a minute.');
  }
  if (action === 'upload') return uploadPhoto(req, res);
  const variant = action === 'state' ? req.query.variant : req.body?.variant;
  if (!variants.includes(variant)) return error(res, 400, 'Choose an edit.');
  if (action === 'state') return res.status(200).json(await state(variant));
  return chat(req, res, variant);
}
