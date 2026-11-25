// X source via API Anything (github.com/goodnight000/api-anything), read-only, no browser.
// Site/op are configurable because API Anything's catalogue can change:
//   LEADS_X_SITE (default "x"), LEADS_X_OP (default "search"), LEADS_X_ARGS (extra CLI args).
import { execFile } from 'node:child_process';
import { extractBudget, extractUrgency, isHiringPost, clip } from '../../../js/leads/parse.js';
import { makeLead } from '../schema-stub.js';
import { textSignals } from '../signals.js';

export const X_QUERIES = [
  '"need a website"',
  '"looking for a web developer"',
  '"who can build me a website"',
  '"need someone to build" website',
  '"looking for someone to build" website',
  '"need a landing page"',
];
const DAY_MS = Number(process.env.LEADS_MAX_AGE_H || 48) * 3600e3;

const run = (args, timeout) => new Promise((resolve, reject) =>
  execFile('npx', ['-y', 'api-anything', ...args], { timeout, maxBuffer: 8 << 20, env: process.env }, (err, stdout, stderr) =>
    err ? reject(new Error((stderr || err.message).split('\n').filter(Boolean).slice(-1)[0] || 'api-anything failed')) : resolve(stdout)));

// API Anything output shapes vary by adapter: find the array of tweet-like objects.
export function findTweets(json) {
  const seen = new Set();
  const out = [];
  const walk = v => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const text = v.full_text || v.text || v.content;
    const id = v.id_str || v.rest_id || v.id || v.tweet_id;
    if (typeof text === 'string' && id != null) { out.push(v); return; }
    Object.values(v).forEach(walk);
  };
  walk(json);
  return out;
}

export function tweetToLead(t, now = Date.now()) {
  const text = String(t.full_text || t.text || t.content || '');
  if (/^RT @/.test(text) || t.retweeted_status || t.is_retweet) return null;
  if (!isHiringPost(text, '', '')) return null;
  const created = new Date(t.created_at || t.date || t.timestamp || now);
  if (!Number.isFinite(created.getTime()) || now - created.getTime() > DAY_MS) return null;
  const user = t.user?.screen_name || t.author?.username || t.username || t.screen_name || t.author_handle || null;
  const id = String(t.id_str || t.rest_id || t.id || t.tweet_id);
  const url = t.url && /\/status\//.test(t.url) ? t.url : `https://x.com/${user || 'i'}/status/${id}`;
  const budget = extractBudget(text);
  const lead = makeLead({
    id: `x:${id}`,
    source: 'x',
    name: user ? `@${user}` : 'X user',
    contact: (t.user?.id_str || t.author_id) ? `https://x.com/messages/compose?recipient_id=${encodeURIComponent(t.user?.id_str || t.author_id)}` : url,
    need: clip(text.replace(/\s+/g, ' '), 600),
    budget_min: budget?.min, budget_max: budget?.max, currency: budget?.currency, budget_period: budget?.period,
    urgency: extractUrgency(text),
    next_action: 'Reply on X',
    url,
    created_at: created.toISOString(),
    seen_at: new Date(now).toISOString(),
  });
  const u = t.user || t.author || {};
  const created_user = Date.parse(u.created_at || '');
  lead.signals = textSignals(lead, {
    followers: u.followers_count ?? u.public_metrics?.followers_count ?? t.followers ?? null,
    account_age_days: Number.isFinite(created_user) ? Math.floor((now - created_user) / 864e5) : null,
    verified: Boolean(u.verified || u.is_blue_verified),
  });
  if (u.url && !lead.signals.business_site) lead.signals.business_site = u.url;
  return lead;
}

export async function fetchXLeads({ queries = X_QUERIES, runImpl = run, now = Date.now(), log = console } = {}) {
  const site = process.env.LEADS_X_SITE || 'x';
  const op = process.env.LEADS_X_OP || 'search';
  const extra = (process.env.LEADS_X_ARGS || '').split(' ').filter(Boolean);
  const since = new Date(now - DAY_MS).toISOString().slice(0, 10);
  const leads = [];
  for (const q of queries) {
    const query = `${q} -is:retweet -filter:retweets lang:en since:${since}`;
    try {
      const stdout = await runImpl(['call', site, op, '--query', query, '--fields', 'id,id_str,text,full_text,created_at,user.screen_name,user.id_str,user.followers_count,user.created_at,user.url,author_id,username,url', '--max-tier', '1', '--json', ...extra], 90000);
      const tweets = findTweets(JSON.parse(stdout.slice(stdout.search(/[[{]/))));
      const kept = tweets.map(t => tweetToLead(t, now)).filter(Boolean);
      log.log(`x ${q}: ${tweets.length} posts, ${kept.length} leads`);
      leads.push(...kept);
    } catch (e) { log.warn(`x ${q} skipped: ${e.message}`); }
  }
  return leads;
}
