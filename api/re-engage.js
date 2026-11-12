import {safeEqual} from './_session.js';
import {sameOrigin} from './_legion/security.js';
import {recordVisit, runReengagement} from './_legion/re-engage.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method === 'GET') {
    if (!process.env.CRON_SECRET || !safeEqual(req.headers.authorization || '', 'Bearer ' + process.env.CRON_SECRET)) return res.status(401).json({error:'unauthorized'});
    const offset = Number(req.query?.offset || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) return res.status(400).end();
    try { return res.status(200).json(await runReengagement({dryOffset:offset})); }
    catch { return res.status(503).json({error:'re-engagement unavailable'}); }
  }
  if (req.method !== 'POST') { res.setHeader('Allow','GET, POST'); return res.status(405).end(); }
  if (!sameOrigin(req)) return res.status(403).end();
  let body;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (raw.length > 1024) return res.status(413).end();
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).end();
  } catch { return res.status(400).end(); }
  try {
    await recordVisit(req, body);
    return res.status(204).end();
  } catch { return res.status(503).end(); }
}
