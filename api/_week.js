import {getSession} from './_session.js';
import {connected, redis} from './_redis.js';
import {DAYS, INITIAL} from '../week/itinerary.js';

export const OWNER = 'gabriel@corvus.gent';
export const ADMIN_ORIGIN = 'https://admin.corvus.gent';
const KEY = 'week:itinerary:2026-W48';
const SAVE = `
local revision = tonumber(redis.call('HGET', KEYS[1], 'revision') or '0')
if revision ~= tonumber(ARGV[1]) then return -1 end
redis.call('HSET', KEYS[1], 'revision', revision + 1, 'data', ARGV[2])
return revision + 1`;

function text(value, limit, required = false) {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new Error('invalid');
  return value.trim();
}

function itinerary(value) {
  if (!Array.isArray(value?.days) || value.days.length !== DAYS.length) throw new Error('invalid');
  return {
    title: text(value.title, 160, true), intro: text(value.intro, 1200),
    days: value.days.map(day => {
      if (!Array.isArray(day?.events) || day.events.length > 48) throw new Error('invalid');
      const events = day.events.map(event => {
        if (typeof event?.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)) throw new Error('invalid');
        return {time: event.time, text: text(event.text, 240, true)};
      }).sort((a, b) => a.time.localeCompare(b.time));
      return {route: text(day.route, 300), note: text(day.note, 1600), events};
    })
  };
}

export default async function week(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET','PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).end();
  }
  if (!connected()) return res.status(503).json({error: 'Storage unavailable.'});
  if (req.method === 'GET') {
    const [revision, data] = await redis(['HMGET', KEY, 'revision', 'data']);
    return res.status(200).json({revision: Number(revision || 0), itinerary: data ? JSON.parse(data) : INITIAL});
  }
  if (![ADMIN_ORIGIN, 'https://corvus.gent'].includes(req.headers.origin)) return res.status(403).json({error: 'Origin denied.'});
  const session = await getSession(req);
  if (session?.email !== OWNER) return res.status(session ? 403 : 401).json({error: 'Owner login required.'});
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') return res.status(415).end();
  const revision = req.body?.revision;
  if (!Number.isSafeInteger(revision) || revision < 0) return res.status(400).json({error: 'Invalid revision.'});
  let data;
  try { data = itinerary(req.body.itinerary); }
  catch { return res.status(400).json({error: 'Check the times and text lengths for each day.'}); }
  const next = Number(await redis(['EVAL', SAVE, 1, KEY, revision, JSON.stringify(data)]));
  if (next === -1) return res.status(409).json({error: 'A newer edit was published. Reload before saving again.'});
  return res.status(200).json({revision: next, itinerary: data});
}
