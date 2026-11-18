import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { catalog, cities, summary } from './_openrisk/engine/index.js';
import { coverageNews, identify } from './_openrisk/engine/enrich.js';
import land from './_openrisk/land.js';
import { login, workspace } from './_openrisk/view.js';
import { client } from './_openrisk/client.js';

const root = '/project-cto';
const cookie = 'openrisk_session';
const lifetime = 7 * 86400;
const cookieFlags = '; Path=' + root + '; HttpOnly; Secure; SameSite=Strict';
const equal = (a, b) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const sign = (payload, key) => createHmac('sha256', key).update(payload).digest('base64url');
const validRoles = ['Investor', 'Founder', 'Admin'];

function session(req, key) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(cookie + '='))?.slice(cookie.length + 1) || '';
  const [id, exp, role, mac, extra] = value.split('.');
  if (extra || !/^[0-9a-f]{32}$/.test(id || '') || !validRoles.includes(role) || !/^\d{10}$/.test(exp || '') || !mac
    || Number(exp) <= Math.floor(Date.now() / 1000) || !equal(mac, sign([id, exp, role].join('.'), key))) return null;
  return { id, exp, role };
}

function setSession(res, { id, exp, role }, key) {
  const payload = [id, exp, role].join('.');
  const maxAge = Number(exp) - Math.floor(Date.now() / 1000);
  res.setHeader('Set-Cookie', cookie + '=' + payload + '.' + sign(payload, key) + cookieFlags + '; Max-Age=' + maxAge);
}

function routeOf(req) {
  const url = new URL(req.url, 'http://openrisk.local');
  if (url.pathname.startsWith(root + '/')) return url.pathname.slice(root.length + 1).replace(/\/+$/, '');
  const rewritten = req.query?.route ?? url.searchParams.get('route');
  return typeof rewritten === 'string' ? rewritten.replace(/\/+$/, '') : '';
}

function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return false;
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.host; }
  catch { return false; }
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : await new Promise((resolve, reject) => {
    let text = '';
    req.on('data', chunk => {
      text += chunk;
      if (text.length > 24000) reject(new Error('Payload too large'));
    });
    req.on('end', () => resolve(text));
    req.on('error', reject);
  });
  if (raw.length > 24000) throw new Error('Payload too large');
  return String(req.headers['content-type']).startsWith('application/json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
}

const attempts = new Map();
function allowLogin(req) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 96);
  const window = Math.floor(Date.now() / 600000);
  if (attempts.size > 2000) attempts.clear();
  const bucket = attempts.get(ip);
  if (bucket?.window === window) return ++bucket.count <= 15;
  attempts.set(ip, { window, count: 1 });
  return true;
}

function send(res, code, value, type = 'application/json; charset=utf-8') {
  res.statusCode = code;
  res.setHeader('Content-Type', type);
  res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
}

const coldCache = new Map();
async function cold(res, name) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('X-Accel-Buffering', 'no');
  const write = event => res.write(JSON.stringify(event) + '\n');
  write({ key: 'start', value: name });
  const key = name.toLowerCase();
  const existing = coldCache.get(key);
  if (existing && existing.until > Date.now()) {
    for (const event of existing.events) write(event);
    return res.end();
  }
  const events = [];
  await Promise.all([['identity', identify], ['news', coverageNews]].map(async ([key, lookup]) => {
    let value = null;
    try { value = await lookup(name); } catch {}
    const event = { key, value, status: value ? 'observed' : 'unavailable' };
    events.push(event);
    write(event);
  }));
  if (coldCache.size > 300) coldCache.clear();
  coldCache.set(key, { until: Date.now() + 900000, events });
  res.end();
}

export default async function handle(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' https:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  const html = 'text/html; charset=utf-8';
  const route = routeOf(req);
  const key = process.env.OPENRISK_SESSION_KEY;
  const password = process.env.OPENRISK_PASSWORD;
  if (!key || !password) return send(res, 503, login('This deployment is awaiting its private demo configuration.'), html);
  if (route === 'login' && req.method === 'POST') {
    if (!sameOrigin(req) || !allowLogin(req)) return send(res, 429, login('Try again from the workspace in a few minutes.'), html);
    try {
      const body = await readBody(req);
      if (typeof body.password === 'string' && body.password.length <= 128 && equal(body.password, password)) {
        setSession(res, { id: randomBytes(16).toString('hex'), exp: Math.floor(Date.now() / 1000) + lifetime, role: 'Investor' }, key);
        res.statusCode = 303;
        res.setHeader('Location', root);
        return res.end();
      }
    } catch {}
    return send(res, 401, login('That password did not match.'), html);
  }
  const auth = session(req, key);
  const asset = route === 'workspace.js';
  if (!auth) return route.startsWith('api/') || asset ? send(res, 401, { error: 'Sign in to OpenRisk.' }) : send(res, 401, login(), html);
  if (req.method === 'GET' && asset) return send(res, 200, '(' + client.toString() + ')();', 'application/javascript; charset=utf-8');
  if (req.method === 'GET' && route === 'api/bootstrap') return send(res, 200, { catalog: catalog.map(item => ({ ...item, summary: summary(item) })), cities, land, role: auth.role });
  if (req.method === 'GET' && route === 'api/cold') {
    const url = new URL(req.url, 'http://openrisk.local');
    const name = String(req.query?.name ?? url.searchParams.get('name') ?? '').trim();
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .&'’+_()-]{0,79}$/u.test(name)) return send(res, 400, { error: 'Enter a company name up to 80 characters.' });
    return cold(res, name);
  }
  if (req.method === 'POST' && route === 'api/role') {
    if (!sameOrigin(req)) return send(res, 403, { error: 'Use the OpenRisk workspace.' });
    try {
      const { role } = await readBody(req);
      if (!validRoles.includes(role)) throw new Error('Unknown role');
      setSession(res, { ...auth, role }, key);
      return send(res, 200, { role });
    } catch { return send(res, 400, { error: 'Choose a demo role.' }); }
  }
  if (['GET','HEAD'].includes(req.method) && (!route || route === 'login' || route === 'index.html')) return send(res, 200, workspace(), html);
  return send(res, 404, { error: 'OpenRisk route not found.' });
}
