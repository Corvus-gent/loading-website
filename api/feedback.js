// Public feedback on corvus.gent: pins and text suggestions on any page.
// Everything stored here is shown publicly. Plain text only, rendered as text.
import crypto from 'node:crypto';
import {redis, pipeline} from './_redis.js';
import {dailyIPHash, rateLimit} from './_privacy.js';
import {getSession} from './_session.js';

const OWNER = 'gabriel@corvus.gent';
const K = s => 'feedback:' + s;
const clean = (v, max) => typeof v === 'string' ? v.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const num = v => Number.isFinite(+v) ? Math.max(0, Math.min(100, +v)) : 0;
export const validPage = p => typeof p === 'string' && p.length <= 200 && /^\/[a-z0-9\-_/.]*$/i.test(p) && !p.includes('..');
export const validName = n => typeof n === 'string' && /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,23}$/u.test(n);
const FLAG = /^(?:\p{Regional_Indicator}{2}|🏴‍☠️|🏳️‍🌈|🌍)$/u;
const nameKey = n => n.toLowerCase().replace(/\s+/g, ' ');
const origins = () => ['https://corvus.gent', 'https://www.corvus.gent', ...['VERCEL_URL', 'VERCEL_BRANCH_URL'].map(k => process.env[k] && 'https://' + process.env[k])];

export function createHandler({db = redis, many = pipeline, limit = rateLimit, ip = dailyIPHash, session = getSession, now = () => Date.now()} = {}) {
  async function list(page) {
    const ids = await db(['ZREVRANGE', page ? K('page:' + page) : K('index'), '0', page ? '199' : '299']);
    if (!ids?.length) return [];
    const rows = await many(ids.map(id => ['HGET', K('items'), id]));
    return rows.filter(Boolean).map(r => JSON.parse(r)).filter(r => !r.hidden);
  }
  async function contributors() {
    const keys = await db(['SMEMBERS', K('people')]) || [];
    if (!keys.length) return [];
    const rows = await many(keys.flatMap(k => [['HGETALL', K('person:' + k)], ['HGETALL', K('days:' + k)]]));
    const out = [];
    for (let i = 0; i < keys.length; i++) {
      const raw = rows[i * 2], days = rows[i * 2 + 1];
      const p = Array.isArray(raw) ? Object.fromEntries(raw.reduce((a, v, j) => (j % 2 ? a[a.length - 1].push(v) : a.push([v]), a), [])) : raw || {};
      const d = Array.isArray(days) ? Object.fromEntries(days.reduce((a, v, j) => (j % 2 ? a[a.length - 1].push(v) : a.push([v]), a), [])) : days || {};
      if (!p.name) continue;
      out.push({name: p.name, flag: p.flag || '🌍', verified: p.verified === '1', count: Number(p.count || 0), days: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Number(v)]))});
    }
    return out.sort((a, b) => b.count - a.count).slice(0, 100);
  }
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method === 'GET') {
        const q = req.query || {};
        if (q.page !== undefined) { if (!validPage(q.page)) return res.status(400).json({error: 'page'}); return res.status(200).json({items: await list(q.page)}); }
        const s = await session(req).catch(() => null);
        return res.status(200).json({items: await list(null), contributors: await contributors(), me: {signedIn: Boolean(s), owner: s?.email?.toLowerCase() === OWNER}});
      }
      if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({error: 'method'}); }
      if (!origins().includes(req.headers.origin) || !String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(403).json({error: 'origin'});
      const b = typeof req.body === 'object' && req.body ? req.body : {};
      const s = await session(req).catch(() => null);
      if (b.action === 'hide') {
        if (s?.email?.toLowerCase() !== OWNER || typeof b.id !== 'string' || !/^[a-f0-9]{16}$/.test(b.id)) return res.status(403).json({error: 'forbidden'});
        const raw = await db(['HGET', K('items'), b.id]); if (!raw) return res.status(404).json({error: 'missing'});
        const item = JSON.parse(raw); item.hidden = true; await db(['HSET', K('items'), b.id, JSON.stringify(item)]);
        return res.status(200).json({ok: true});
      }
      const page = b.page, name = clean(b.name, 24), flag = typeof b.flag === 'string' && FLAG.test(b.flag) ? b.flag : '🌍';
      const note = clean(b.note, 600), suggestion = clean(b.suggestion, 600), quote = clean(b.quote, 240), selector = clean(b.selector, 300);
      if (!validPage(page) || !validName(name) || (!note && !suggestion)) return res.status(400).json({error: 'fields'});
      if (!await limit('feedback:hour:' + ip(req, 'feedback'), 30, 3600) || !await limit('feedback:global', 3000, 86400)) return res.status(429).json({error: 'Too much feedback at once. Try again later.'});
      const at = now(), id = crypto.randomBytes(8).toString('hex'), verified = Boolean(s);
      const item = {id, page, x: num(b.x), y: num(b.y), selector, quote, note, suggestion, name, flag, verified, at};
      const who = (verified ? 'v:' : 'g:') + nameKey(name), day = new Date(at).toISOString().slice(0, 10);
      await many([
        ['HSET', K('items'), id, JSON.stringify(item)],
        ['ZADD', K('index'), String(at), id], ['ZADD', K('page:' + page), String(at), id],
        ['SADD', K('people'), who],
        ['HSET', K('person:' + who), 'name', name, 'flag', flag, 'verified', verified ? '1' : '0'],
        ['HINCRBY', K('person:' + who), 'count', '1'],
        ['HINCRBY', K('days:' + who), day, '1']
      ]);
      return res.status(200).json({item});
    } catch (e) {
      return res.status(503).json({error: 'Feedback is resting. Try again in a moment.'});
    }
  };
}
export default createHandler();
