// Leadhunter store for corvus.gent/scraper/fiverr-leads. Private: leads never live in this public repo.
//   GET                       → {top, leads, updated} (header x-leads-password = LEADS_PASSWORD)
//   GET ?format=md            → top 15 as markdown (data/top-leads.md format)
//   POST {action:'add', lead} → save one manual lead (same password; used by the Fiverr paste box)
//   POST {action:'ingest', leads} → cron upsert       (Bearer LEADS_INGEST_TOKEN, falls back to BUILD_INGEST_TOKEN)
// Nothing here sends messages: the page only builds drafts/links Gabe clicks himself.
import crypto from 'node:crypto';
import { redis, pipeline, connected } from './_redis.js';
import { makeLead } from '../lib/leads/schema-stub.js';
import { dedupeLeads } from '../lib/leads/dedupe.js';
import { textSignals } from '../lib/leads/signals.js';
import { topLeads, topLeadsMarkdown } from '../lib/leads/score-local.js';

export const KEY = 'leads:v1';
const MAX_LEADS = 3000;
const COLD_DAYS = 21;

const same = (given, expected) => {
  if (!expected || expected.length < 8) return false;
  const a = Buffer.from(String(given || '')), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
export const passwordOk = req => same(req.headers['x-leads-password'], process.env.LEADS_PASSWORD || '');
export const ingestOk = req => {
  const token = process.env.LEADS_INGEST_TOKEN || process.env.BUILD_INGEST_TOKEN || '';
  return token.length >= 32 && same(String(req.headers.authorization || '').replace(/^Bearer /, ''), token);
};

export async function loadLeads(store = redis) {
  const raw = (await store(['HGETALL', KEY])) || [];
  const pairs = Array.isArray(raw) ? raw : Object.entries(raw).flat();
  const out = [];
  for (let i = 0; i < pairs.length; i += 2) { try { out.push(JSON.parse(pairs[i + 1])); } catch {} }
  return out;
}

/** Merge incoming leads into the store. Returns {added, total}. */
export async function upsertLeads(incoming, { store = redis, batch = pipeline, now = Date.now() } = {}) {
  const existing = await loadLeads(store);
  const fresh = incoming.map(makeLead).map(l => ({ ...l, id: l.id || `${l.source}:${crypto.randomUUID().slice(0, 12)}` }));
  let merged = dedupeLeads(existing, fresh);
  // Drop untouched cold scrapes after three weeks; keep anything Gabe worked, warm contacts and manual input.
  merged = merged.filter(l => l.warm || l.status !== 'new' || ['fiverr', 'manual', 'warm'].includes(l.source) || now - (Date.parse(l.created_at) || now) < COLD_DAYS * 864e5);
  merged.sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  merged = merged.slice(0, MAX_LEADS);
  const keep = new Set(merged.map(l => l.id));
  const before = new Set(existing.map(l => l.id));
  const gone = existing.map(l => l.id).filter(id => id && !keep.has(id));
  const cmds = [];
  if (gone.length) cmds.push(['HDEL', KEY, ...gone]);
  const byId = new Map(existing.map(l => [l.id, JSON.stringify(l)]));
  const changed = merged.filter(l => byId.get(l.id) !== JSON.stringify(l));
  for (let i = 0; i < changed.length; i += 200) cmds.push(['HSET', KEY, ...changed.slice(i, i + 200).flatMap(l => [l.id, JSON.stringify(l)])]);
  if (cmds.length) await batch(cmds);
  return { added: merged.filter(l => !before.has(l.id)).length, updated: changed.length, removed: gone.length, total: merged.length, ids: fresh.map(f => merged.find(m => m.id === f.id || m.url && m.url === f.url)?.id || null) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!connected()) return res.status(503).json({ error: 'storage not connected' });
  try {
    if (req.method === 'GET') {
      if (!passwordOk(req)) { await new Promise(r => setTimeout(r, 600)); return res.status(401).json({ error: 'password required' }); }
      const leads = await loadLeads();
      const top = topLeads(leads, 15);
      if (req.query?.format === 'md') { res.setHeader('Content-Type', 'text/markdown; charset=utf-8'); return res.status(200).send(topLeadsMarkdown(top)); }
      return res.status(200).json({ top, leads, updated: await redis(['GET', KEY + ':updated']) });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (body.action === 'ingest') {
      if (!ingestOk(req)) return res.status(401).json({ error: 'token required' });
      if (!Array.isArray(body.leads) || body.leads.length > 2000) return res.status(400).json({ error: 'leads array required' });
      const result = await upsertLeads(body.leads);
      await redis(['SET', KEY + ':updated', new Date().toISOString()]);
      const { ids, ...summary } = result;
      return res.status(200).json(summary);
    }
    if (body.action === 'add') {
      if (!passwordOk(req)) { await new Promise(r => setTimeout(r, 600)); return res.status(401).json({ error: 'password required' }); }
      const lead = makeLead({ ...body.lead, status: 'new', offer: null, created_at: new Date().toISOString() });
      if (!lead.need) return res.status(400).json({ error: 'need is required' });
      lead.signals = textSignals(lead);
      const result = await upsertLeads([lead]);
      return res.status(200).json({ id: result.ids[0], total: result.total });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e) {
    console.error('leads', e);
    return res.status(500).json({ error: 'leads error' });
  }
}
