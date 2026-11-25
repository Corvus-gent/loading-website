// Cron entry: collect Reddit + X (+ Maps once a day) leads from the last 48h, add trust signals,
// dedupe, and push them to the private store. Never sends messages. Never touches Fiverr or Upwork.
// Usage: LEADS_INGEST_URL=https://corvus.gent/api/leads LEADS_INGEST_TOKEN=… node tools/leads/refresh.mjs
//        LEADS_DRY_RUN=1 node tools/leads/refresh.mjs   → writes data/top-leads.md locally (gitignored)
import fs from 'node:fs';
import { fetchRedditLeads } from '../../lib/leads/sources/reddit.js';
import { fetchXLeads } from '../../lib/leads/sources/x.js';
import { fetchMapsLeads } from '../../lib/leads/sources/maps.js';
import { dedupeLeads } from '../../lib/leads/dedupe.js';
import { markDuplicates } from '../../lib/leads/signals.js';
import { topLeads, topLeadsMarkdown } from '../../lib/leads/score-local.js';

const only = (process.env.LEADS_SOURCES || 'reddit,x,maps').split(',');
const now = new Date();
// Maps leads don't change by the minute: once a day (first run after 06:00 UTC) unless forced.
const mapsDue = process.env.LEADS_MAPS === '1' || (now.getUTCHours() === 6 && now.getUTCMinutes() < 15);
const batches = await Promise.all([
  only.includes('reddit') ? fetchRedditLeads() : [],
  only.includes('x') && process.env.LEADS_X !== '0' ? fetchXLeads() : [],
  only.includes('maps') && mapsDue ? fetchMapsLeads() : [],
]);
const leads = markDuplicates(dedupeLeads(...batches));
console.log(`collected ${leads.length} leads (${leads.filter(l => l.budget_max != null).length} with budget, ${leads.filter(l => l.urgency === 'high').length} urgent)`);

if (process.env.LEADS_DRY_RUN) {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/top-leads.md', topLeadsMarkdown(topLeads(leads)));
  console.log('wrote data/top-leads.md');
  process.exit(0);
}
const url = process.env.LEADS_INGEST_URL, token = process.env.LEADS_INGEST_TOKEN;
if (!url || !token) throw new Error('LEADS_INGEST_URL and LEADS_INGEST_TOKEN are required (or set LEADS_DRY_RUN=1)');
if (!leads.length) { console.log('nothing to publish'); process.exit(0); }
const r = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ action: 'ingest', leads }),
  signal: AbortSignal.timeout(30000),
});
const out = await r.text();
if (!r.ok) throw new Error(`ingest failed: ${r.status} ${out.slice(0, 200)}`);
console.log('ingested', out);
