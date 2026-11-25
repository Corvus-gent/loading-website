// Reddit source: public JSON listing per subreddit (RSS fallback). Read-only.
import { extractBudget, extractUrgency, isHiringPost, clip } from '../../../js/leads/parse.js';
import { makeLead } from '../schema-stub.js';
import { textSignals } from '../signals.js';

export const SUBREDDITS = ['forhire', 'slavelabour', 'smallbusiness', 'Entrepreneur', 'startups', 'webdev', 'hiring', 'freelance_forhire', 'WebDeveloperJobs'];
const UA = 'web:gent.corvus.leadhunter:1.0 (read-only; contact gabriel@corvus.gent)';
const MAX_AGE_MS = Number(process.env.LEADS_MAX_AGE_H || 48) * 3600e3;

/** Turn one Reddit post (listing `data`) into a Lead, or null when it is not a web-work request. */
export function redditPostToLead(p, now = Date.now()) {
  if (!p || p.stickied || p.removed_by_category || p.over_18) return null;
  const title = p.title || '', body = p.selftext || '', flair = p.link_flair_text || '';
  if (!isHiringPost(title, body, flair)) return null;
  const created = p.created_utc ? new Date(p.created_utc * 1000) : new Date(now);
  if (now - created.getTime() > MAX_AGE_MS) return null;
  const text = `${title}\n${body}`;
  const budget = extractBudget(text);
  const url = p.permalink ? `https://www.reddit.com${p.permalink}` : p.url;
  const author = p.author && p.author !== '[deleted]' ? p.author : null;
  const lead = makeLead({
    id: `reddit:${p.id}`,
    source: 'reddit',
    name: author ? `u/${author}` : `r/${p.subreddit}`,
    contact: author ? `https://www.reddit.com/message/compose/?to=${encodeURIComponent(author)}` : url,
    need: clip(`${title.replace(/\s+/g, ' ')}${body ? ' — ' + body.replace(/\s+/g, ' ') : ''}`, 600),
    budget_min: budget?.min, budget_max: budget?.max, currency: budget?.currency, budget_period: budget?.period,
    urgency: extractUrgency(text),
    next_action: author ? 'Reply / DM on Reddit' : 'Reply on Reddit',
    url,
    created_at: created.toISOString(),
    seen_at: new Date(now).toISOString(),
  });
  lead.signals = textSignals(lead, { subreddit: p.subreddit, score: p.score ?? null, comments: p.num_comments ?? null });
  return lead;
}

function rssToPosts(xml, sub) {
  const entries = [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1]);
  const pick = (s, tag) => s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || '';
  const decode = s => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return entries.map(e => {
    const link = e.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
    return {
      id: (pick(e, 'id').match(/t3_(\w+)/) || [])[1] || link.match(/comments\/(\w+)/)?.[1],
      title: decode(pick(e, 'title')),
      selftext: decode(pick(e, 'content')).replace(/<[^>]+>/g, ' '),
      author: decode(pick(e, 'name')).replace(/^\/?u\//, ''),
      permalink: link.replace(/^https?:\/\/(?:www|old)\.reddit\.com/, ''),
      created_utc: Date.parse(pick(e, 'updated') || pick(e, 'published')) / 1000,
      subreddit: sub,
      link_flair_text: (e.match(/<category[^>]*label="([^"]+)"/) || [])[1] || '',
    };
  }).filter(p => p.id);
}

// Reddit blocks most datacenter IPs for anonymous reads. With REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET
// (a free "script"/"web" app at reddit.com/prefs/apps) we use app-only OAuth, which works from CI.
let tokenCache = null;
async function oauthToken(fetchImpl) {
  const id = process.env.REDDIT_CLIENT_ID, secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (tokenCache && tokenCache.until > Date.now()) return tokenCache.token;
  const r = await fetchImpl('https://www.reddit.com/api/v1/access_token', {
    method: 'POST', body: 'grant_type=client_credentials',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`reddit oauth: HTTP ${r.status}`);
  const j = await r.json();
  tokenCache = { token: j.access_token, until: Date.now() + (j.expires_in - 60) * 1000 };
  return tokenCache.token;
}

async function getJson(path, fetchImpl) {
  const token = await oauthToken(fetchImpl).catch(() => null);
  const url = token ? `https://oauth.reddit.com${path}` : `https://www.reddit.com${path.replace(/^(\/[^?]+)/, '$1.json')}`;
  const r = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchSub(sub, fetchImpl) {
  try {
    const j = await getJson(`/r/${sub}/new?limit=75&raw_json=1`, fetchImpl);
    return j?.data?.children?.map(c => c.data) || [];
  } catch {}
  const r = await fetchImpl(`https://old.reddit.com/r/${sub}/new/.rss?limit=75`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000), redirect: 'manual' });
  if (!r.ok) throw new Error(`r/${sub}: HTTP ${r.status}`);
  return rssToPosts(await r.text(), sub);
}

/** Poster trust: account age, karma, past [Hiring] posts. */
export async function enrichRedditLead(lead, { fetchImpl = fetch, now = Date.now() } = {}) {
  const user = /^u\/(.+)/.exec(lead.name)?.[1];
  if (!user) return lead;
  try {
    const about = (await getJson(`/user/${encodeURIComponent(user)}/about?raw_json=1`, fetchImpl))?.data || {};
    const posts = (await getJson(`/user/${encodeURIComponent(user)}/submitted?limit=50&raw_json=1`, fetchImpl))?.data?.children?.map(c => c.data) || [];
    lead.signals = {
      ...lead.signals,
      account_age_days: about.created_utc ? Math.floor((now / 1000 - about.created_utc) / 86400) : null,
      karma: about.total_karma ?? ((about.link_karma || 0) + (about.comment_karma || 0)),
      past_hiring_posts: posts.filter(p => p.id !== lead.id.slice(7) && /\[(?:hiring|task|paid)\]/i.test(`${p.link_flair_text || ''} ${p.title || ''}`)).length,
      past_for_hire_posts: posts.filter(p => /for ?hire/i.test(`${p.link_flair_text || ''} ${p.title || ''}`)).length,
    };
    if (lead.signals.past_for_hire_posts >= 2 && !lead.signals.red_flags.includes('seller_account')) lead.signals.red_flags.push('seller_account');
  } catch (e) { lead.signals = { ...lead.signals, enrich_error: e.message.slice(0, 60) }; }
  return lead;
}

export async function fetchRedditLeads({ subreddits = SUBREDDITS, fetchImpl = fetch, now = Date.now(), log = console, enrich = true } = {}) {
  const leads = [];
  for (const sub of subreddits) {
    try {
      const posts = await fetchSub(sub, fetchImpl);
      const kept = posts.map(p => redditPostToLead(p, now)).filter(Boolean);
      log.log(`reddit r/${sub}: ${posts.length} posts, ${kept.length} leads`);
      leads.push(...kept);
    } catch (e) { log.warn(`reddit r/${sub} skipped: ${e.message}`); }
    await new Promise(r => setTimeout(r, 1200)); // stay well under the rate limit
  }
  if (enrich) for (const l of leads.slice(0, 60)) { await enrichRedditLead(l, { fetchImpl, now }); await new Promise(r => setTimeout(r, 700)); }
  return leads;
}

export const _test = { rssToPosts };
