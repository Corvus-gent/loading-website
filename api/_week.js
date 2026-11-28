import {allowedOrigin, hasWeekSession} from './_week-auth.js';
import {readRecord, writeRecord} from './_week-store.js';
import {DAYS, INITIAL} from '../week/itinerary.js';
const KEY = '2026-W48';

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
  if (req.method === 'GET') {
    const {data} = await readRecord(KEY);
    return res.status(200).json(data || {revision:0, itinerary:INITIAL});
  }
  if (!allowedOrigin(req.headers.origin)) return res.status(403).json({error:'Origin denied.'});
  if (!await hasWeekSession(req)) return res.status(401).json({error:'Owner login required.'});
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') return res.status(415).end();
  const revision = req.body?.revision;
  if (!Number.isSafeInteger(revision) || revision < 0) return res.status(400).json({error: 'Invalid revision.'});
  let data;
  try { data = itinerary(req.body.itinerary); }
  catch { return res.status(400).json({error: 'Check the times and text lengths for each day.'}); }
  const stored = await readRecord(KEY);
  const next = {revision:revision+1, itinerary:data};
  if ((stored.data?.revision || 0) !== revision || !await writeRecord(KEY,next,stored.etag)) {
    return res.status(409).json({error:'A newer edit was published. Reload before saving again.'});
  }
  return res.status(200).json(next);
}
