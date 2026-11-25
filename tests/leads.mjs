// Leadhunter: brief parser, budget/urgency extraction, hiring filter, dedupe, signals, local score, API store.
import assert from 'node:assert/strict';
import { extractBudget, extractUrgency, isHiringPost, parseFiverrBrief, parseAmount } from '../js/leads/parse.js';
import { canonicalUrl, textHash, dedupeLeads } from '../lib/leads/dedupe.js';
import { redditPostToLead, _test } from '../lib/leads/sources/reddit.js';
import { tweetToLead, findTweets } from '../lib/leads/sources/x.js';
import { placeToLead } from '../lib/leads/sources/maps.js';
import { redFlags, trustScore, markDuplicates } from '../lib/leads/signals.js';
import { scoreLead, topLeads, topLeadsMarkdown } from '../lib/leads/score-local.js';
import { suggestOffer, draftText, draftLink } from '../lib/leads/offer-fallback.js';
import { makeLead } from '../lib/leads/schema-stub.js';

// --- amounts & budgets
assert.equal(parseAmount('1,500'), 1500);
assert.equal(parseAmount('1.500'), 1500);
assert.equal(parseAmount('1.5', true), 1500);
assert.equal(parseAmount('2,5'), 3); // rounded
const b = t => { const r = extractBudget(t); return r && [r.min, r.max, r.currency, r.period]; };
assert.deepEqual(b('Budget is $500'), [500, 500, 'USD', 'fixed']);
assert.deepEqual(b('paying €300-€600 for a landing page'), [300, 600, 'EUR', 'fixed']);
assert.deepEqual(b('$1.5k - 3k'), [1500, 3000, 'USD', 'fixed']);
assert.deepEqual(b('budget 2-3k'), [2000, 3000, null, 'fixed']);
assert.deepEqual(b('I can pay 800 euros'), [800, 800, 'EUR', 'fixed']);
assert.deepEqual(b('$25/hr, about 10 hours'), [25, 25, 'USD', 'hour']);
assert.deepEqual(b('£40 per hour'), [40, 40, 'GBP', 'hour']);
assert.deepEqual(b('300 to 600 USD'), [300, 600, 'USD', 'fixed']);
assert.deepEqual(b('Budget: 1,200'), [1200, 1200, null, 'fixed']);
assert.deepEqual(b('$75 quick fix'), [75, 75, 'USD', 'fixed']);
assert.equal(extractBudget('I need 5 pages and a contact form in 2026'), null);
assert.equal(extractBudget(''), null);

// --- urgency
assert.equal(extractUrgency('Need it ASAP'), 'high');
assert.equal(extractUrgency('must be live today'), 'high');
assert.equal(extractUrgency('done by tomorrow please'), 'medium');
assert.equal(extractUrgency('deadline is this week'), 'medium');
assert.equal(extractUrgency('Delivery: 2 days'), 'medium');
assert.equal(extractUrgency('whenever, no rush, a month or two'), 'low');

// --- hiring filter
assert.ok(isHiringPost('[Hiring] Need a Shopify website for my bakery', ''));
assert.ok(isHiringPost('Looking for someone to build a landing page', 'budget $400'));
assert.ok(!isHiringPost('[For Hire] Full-stack web developer, low rates', ''));
assert.ok(!isHiringPost("I'm a web developer, hire me", ''));
assert.ok(!isHiringPost('Need a website', '', 'For Hire'));
assert.ok(!isHiringPost('[Hiring] Logo designer for t-shirts', '')); // not web work

// --- Fiverr brief
const brief = parseFiverrBrief(`Title: Website for my cleaning company
Budget: $150 - $300
Delivery time: 2 days
Buyer: maria_cleans
I need a simple 3 page site with a booking form. Urgent, we launch Monday.`);
assert.equal(brief.source, 'fiverr');
assert.equal(brief.name, 'maria_cleans');
assert.equal(brief.budget_min, 150);
assert.equal(brief.budget_max, 300);
assert.equal(brief.currency, 'USD');
assert.equal(brief.urgency, 'high');
assert.match(brief.need, /cleaning company/);
assert.match(brief.need, /booking form/);
assert.equal(brief.deadline, '2 days');
const loose = parseFiverrBrief('hi i need someone to fix my wordpress contact form, can pay 50 dollars, today if possible');
assert.deepEqual([loose.budget_max, loose.currency, loose.urgency, loose.name], [50, 'USD', 'high', 'Fiverr buyer']);

// --- dedupe
assert.equal(canonicalUrl('https://old.reddit.com/r/forhire/comments/AbC123/need_site/?utm=1'), 'reddit.com/comments/abc123');
assert.equal(canonicalUrl('https://redd.it/abc123'), 'reddit.com/comments/abc123');
assert.equal(canonicalUrl('https://twitter.com/foo/status/123?s=20'), 'x.com/status/123');
assert.equal(textHash('[Hiring] Need a WEBSITE!! https://x.co/a'), textHash('need a website'));
const older = makeLead({ id: 'reddit:abc123', source: 'reddit', need: 'Need a website for my bakery, budget $400, asap please', url: 'https://www.reddit.com/r/forhire/comments/abc123/x/', created_at: '2026-11-24T10:00:00Z', status: 'contacted' });
const newer = makeLead({ id: 'reddit:abc123b', source: 'reddit', need: 'Need a website for my bakery, budget $400, asap please', url: 'https://old.reddit.com/r/forhire/comments/abc123/', created_at: '2026-11-24T12:00:00Z', contact: 'u/baker', budget_min: 400, budget_max: 400 });
const crossSource = makeLead({ id: 'x:9', source: 'x', need: 'need a website for my bakery budget 400 asap please', url: 'https://x.com/b/status/9', created_at: '2026-11-24T09:00:00Z' });
let d = dedupeLeads([older], [newer]);
assert.equal(d.length, 1);
assert.equal(d[0].id, 'reddit:abc123');
assert.equal(d[0].status, 'contacted');
assert.equal(d[0].contact, 'u/baker');
assert.equal(d[0].budget_max, 400);
d = dedupeLeads([newer], [older, crossSource]);
assert.equal(d.length, 1, 'same text across sources collapses');
assert.equal(d[0].id, 'x:9', 'oldest id wins');
assert.equal(d[0].status, 'contacted', 'worked status survives');
assert.equal(dedupeLeads([older], [makeLead({ id: 'reddit:zzz', need: 'Completely different request for a Shopify store', url: 'https://reddit.com/comments/zzz' })]).length, 2);

// --- sources
const now = Date.parse('2026-11-25T08:00:00Z');
const post = { id: 'p1', title: '[Hiring] Website for my plumbing business, $500', selftext: 'Need it this week. https://joesplumbing.be', author: 'joe', subreddit: 'forhire', permalink: '/r/forhire/comments/p1/x/', created_utc: now / 1000 - 3600 };
const rl = redditPostToLead(post, now);
assert.equal(rl.id, 'reddit:p1');
assert.equal(rl.budget_max, 500);
assert.equal(rl.urgency, 'medium');
assert.equal(rl.signals.business_site, 'https://joesplumbing.be');
assert.equal(redditPostToLead({ ...post, created_utc: now / 1000 - 3 * 86400 }, now), null, 'older than 48h dropped');
assert.equal(redditPostToLead({ ...post, title: '[For Hire] I build websites' }, now), null);
const rss = _test.rssToPosts(`<feed><entry><author><name>/u/amy</name></author><category term="x" label="Hiring"/><id>t3_q9</id><link href="https://www.reddit.com/r/hiring/comments/q9/x/"/><updated>2026-11-25T07:00:00+00:00</updated><title>Need a website &amp; logo</title><content>&lt;p&gt;asap&lt;/p&gt;</content></entry></feed>`, 'hiring');
assert.deepEqual([rss[0].id, rss[0].author, rss[0].title], ['q9', 'amy', 'Need a website & logo']);
const tweets = findTweets({ data: { results: [{ id_str: '77', full_text: 'Who can build me a website for my gym? Need it asap', created_at: '2026-11-25T06:00:00Z', user: { screen_name: 'gymowner', id_str: '5', followers_count: 1200 } }, { id: '78', text: 'RT @x: need a website', created_at: '2026-11-25T06:00:00Z' }] } });
assert.equal(tweets.length, 2);
const xl = tweets.map(t => tweetToLead(t, now)).filter(Boolean);
assert.equal(xl.length, 1, 'retweets dropped');
assert.equal(xl[0].urgency, 'high');
assert.equal(xl[0].signals.followers, 1200);
const place = placeToLead({ id: 'g1', displayName: { text: 'Bakkerij Jan' }, userRatingCount: 87, rating: 4.6, businessStatus: 'OPERATIONAL', internationalPhoneNumber: '+32 9 123 45 67', formattedAddress: 'Gent' }, 'Ghent', now);
assert.equal(place.source, 'maps');
assert.equal(place.signals.reviews, 87);
assert.equal(placeToLead({ id: 'g2', websiteUri: 'https://x.be', userRatingCount: 50 }, 'Ghent', now), null);

// --- signals & score
assert.deepEqual(redFlags('Paid in USDT, contact me on telegram. Great exposure!'), ['exposure', 'crypto_or_giftcard_pay', 'off_platform_ask']);
assert.deepEqual(redFlags('Equity only, free test task first'), ['equity_only', 'unpaid_test']);
assert.deepEqual(redFlags('Budget $500, need a landing page'), []);
assert.ok(trustScore({ account_age_days: 1500, karma: 5000, business_site: 'x' }) > trustScore({ account_age_days: 3, karma: 1 }));
assert.ok(trustScore({ red_flags: ['exposure'] }) < 0.5);
const dup = markDuplicates([{ name: 'u/spam' }, { name: 'u/spam' }, { name: 'u/spam' }, { name: 'u/ok' }]);
assert.ok(dup[0].signals.red_flags.includes('spam_duplicates'));
assert.equal(dup[3].signals.duplicate_posts, 1);
const sRich = scoreLead({ ...rl, signals: { ...rl.signals, account_age_days: 900, karma: 3000 } }, now);
const sFlag = scoreLead({ ...rl, signals: { ...rl.signals, red_flags: ['equity_only'] } }, now);
assert.ok(sRich.score >= 0 && sRich.score <= 100);
assert.ok(sRich.expected_value > sFlag.expected_value);
assert.equal(suggestOffer({ need: 'fix my broken contact form' }).tier, 'quick_fix');
assert.equal(suggestOffer({ need: 'shopify store', budget_max: 3000, currency: 'EUR' }).tier, 'pro');
assert.equal(suggestOffer({ need: 'site', budget_max: 400, currency: 'USD' }).tier, 'landing');
const fv = makeLead({ source: 'fiverr', name: 'maria', need: 'site' });
const ft = draftText(fv, suggestOffer(fv));
assert.doesNotMatch(ft, /corvus\.gent|revolut|paypal|whatsapp|email|outside/i, 'Fiverr drafts stay on-platform');
assert.equal(draftLink(fv, ft), null);
assert.match(draftLink(rl, 'hi'), /^https:\/\/www\.reddit\.com\/message\/compose\/\?to=joe&/);
assert.match(draftLink(xl[0], 'hi'), /^https:\/\/x\.com\/intent\/post\?in_reply_to=77&/);
assert.match(draftLink(place, 'hi'), /^https:\/\/wa\.me\/3291234567\?text=/);
assert.match(draftText(rl, suggestOffer(rl)), /SF hackathon winner.*30 min/);
const warm = makeLead({ id: 'w', source: 'warm', warm: true, name: 'Pieter', need: 'site for his shop', created_at: '2026-11-20T00:00:00Z' });
const top = topLeads([place, rl, xl[0], warm, makeLead({ ...rl, id: 'lost', status: 'lost', url: 'https://reddit.com/comments/lost' })], 15, now);
assert.equal(top[0].lead.id, 'w', 'warm contacts first');
assert.ok(!top.some(t => t.lead.status === 'lost'));
assert.equal(top.at(-1).lead.source, 'maps', 'cold businesses last');
assert.match(topLeadsMarkdown(top), /\| 1 \| \[warm\]/);

// --- API store (in-memory Redis stand-in)
process.env.LEADS_PASSWORD = 'correct-horse-battery';
process.env.LEADS_INGEST_TOKEN = 'x'.repeat(40);
const api = await import('../api/leads.js');
const mem = new Map();
const store = async ([cmd, key, ...rest]) => {
  const h = mem.get(key) || new Map(); mem.set(key, h);
  if (cmd === 'HGETALL') return [...h].flat();
};
const batch = async cmds => { for (const [cmd, key, ...rest] of cmds) { const h = mem.get(key) || new Map(); mem.set(key, h); if (cmd === 'HSET') for (let i = 0; i < rest.length; i += 2) h.set(rest[i], rest[i + 1]); if (cmd === 'HDEL') rest.forEach(k => h.delete(k)); } };
let r = await api.upsertLeads([rl, xl[0]], { store, batch, now });
assert.deepEqual([r.added, r.total], [2, 2]);
r = await api.upsertLeads([{ ...rl, id: 'reddit:p1-again' }], { store, batch, now });
assert.deepEqual([r.added, r.total], [0, 2], 'rerun dedupes');
const stored = await api.loadLeads(store);
assert.ok(stored.every(l => l.signals), 'signals persist');
assert.ok(api.passwordOk({ headers: { 'x-leads-password': 'correct-horse-battery' } }));
assert.ok(!api.passwordOk({ headers: { 'x-leads-password': 'nope' } }));
assert.ok(api.ingestOk({ headers: { authorization: 'Bearer ' + 'x'.repeat(40) } }));
assert.ok(!api.ingestOk({ headers: {} }));

console.log('Passed: leadhunter parser, budgets, urgency, hiring filter, sources, dedupe, signals, local score, drafts, store.');
