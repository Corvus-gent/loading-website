// Leadhunter text parsing. Pure ES module: runs in the browser (Fiverr paste preview)
// and in Node (Reddit/X sources, API validation). No dependencies.

const CURRENCY_WORDS = [
  [/^(?:\$|usd|us\$|dollars?|bucks)$/i, 'USD'],
  [/^(?:€|eur|euros?)$/i, 'EUR'],
  [/^(?:£|gbp|pounds?|quid)$/i, 'GBP'],
  [/^(?:cad|c\$)$/i, 'CAD'],
  [/^(?:aud|a\$)$/i, 'AUD'],
  [/^(?:inr|₹|rs\.?)$/i, 'INR'],
];
const currencyOf = token => (token ? CURRENCY_WORDS.find(([re]) => re.test(token.trim()))?.[1] || null : null);

const CUR = String.raw`(?:us\$|c\$|a\$|\$|€|£|₹|usd|eur|gbp|cad|aud|inr)`;
const CUR_AFTER = String.raw`(?:usd|eur|gbp|cad|aud|inr|dollars?|euros?|pounds?|bucks|\$|€|£)`;
const NUM = String.raw`\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?`;
const K = String.raw`\s?(?:k|K)(?![a-z])`;
const HOURLY = /^\s*(?:\/\s*(?:h|hr|hour)\b|per\s+hour\b|an\s+hour\b|hourly\b|\/\s*hora\b|p\/h\b|ph\b)/i;

// "1,500" / "1.500" / "1 500" → 1500 ; "1.5" → 1.5 ; "2,5" → 2.5
export function parseAmount(raw, kilo = false) {
  let s = String(raw).trim();
  if (/^\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?$/.test(s)) {
    const dec = s.match(/[.,](\d{1,2})$/);
    const body = dec && !/[.,\s]\d{3}$/.test(s) ? s.slice(0, -dec[0].length) : s;
    s = body.replace(/[.,\s]/g, '') + (dec && body !== s ? '.' + dec[1] : '');
  } else s = s.replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(kilo ? n * 1000 : n);
}

/**
 * Extract a budget from free text.
 * @returns {{min:number,max:number,currency:string|null,period:'fixed'|'hour',raw:string}|null}
 */
export function extractBudget(text) {
  if (!text) return null;
  const t = String(text).replace(/ /g, ' ');
  const found = [];
  // Currency before the number: "$500", "€1.5k - €2k", "USD 300 to 600"
  const pre = new RegExp(String.raw`(${CUR})\s?(${NUM})(${K})?(?:\s*(?:-|–|—|to|and)\s*(?:${CUR})?\s?(${NUM})(${K})?)?`, 'gi');
  // Currency after the number: "500 euros", "300-600 USD", "1.5k EUR"
  const post = new RegExp(String.raw`(?<![\w$€£])(${NUM})(${K})?(?:\s*(?:-|–|—|to)\s*(${NUM})(${K})?)?\s?(${CUR_AFTER})(?![a-z])`, 'gi');
  for (const m of t.matchAll(pre)) found.push({ index: m.index, end: m.index + m[0].length, cur: m[1], a: m[2], ak: m[3], b: m[4], bk: m[5], raw: m[0] });
  for (const m of t.matchAll(post)) found.push({ index: m.index, end: m.index + m[0].length, cur: m[5], a: m[1], ak: m[2], b: m[3], bk: m[4], raw: m[0] });
  // "budget: 500" / "budget is 1-2k" without a currency
  if (!found.length) {
    const bare = new RegExp(String.raw`budget\D{0,20}?(${NUM})(${K})?(?:\s*(?:-|–|to)\s*(${NUM})(${K})?)?`, 'i').exec(t);
    if (bare) found.push({ index: bare.index, end: bare.index + bare[0].length, cur: null, a: bare[1], ak: bare[2], b: bare[3], bk: bare[4], raw: bare[0] });
  }
  const parsed = found.map(f => {
    const bk = Boolean(f.bk), ak = Boolean(f.ak) || (bk && !f.ak && Number(String(f.a).replace(',', '.')) < 100);
    let min = parseAmount(f.a, ak), max = f.b != null ? parseAmount(f.b, bk) : min;
    if (min == null || max == null) return null;
    if (min > max) [min, max] = [max, min];
    const period = HOURLY.test(t.slice(f.end, f.end + 14)) ? 'hour' : 'fixed';
    const nearBudget = /budget|pay|paying|offer|rate|price|compensation|\/h|hour/i.test(t.slice(Math.max(0, f.index - 40), f.end + 14));
    return { min, max, currency: currencyOf(f.cur), period, raw: f.raw.trim(), index: f.index, nearBudget };
  }).filter(p => p && p.max > 0 && p.max < 1e7 && !(p.currency == null && p.max < 5));
  if (!parsed.length) return null;
  // Prefer amounts next to "budget"/"pay", then fixed over hourly, then the largest.
  parsed.sort((x, y) => (y.nearBudget - x.nearBudget) || ((x.period === 'fixed' ? 0 : 1) - (y.period === 'fixed' ? 0 : 1)) || (y.max - x.max));
  const { min, max, currency, period, raw } = parsed[0];
  return { min, max, currency, period, raw };
}

const HIGH = /\b(?:asap|a\.s\.a\.p|urgent(?:ly)?|today|tonight|immediately|right away|right now|need(?:ed)? (?:it )?now|start now|within (?:\d+|a few|24|48) ?h(?:ou)?rs?|same[- ]day|24 ?h(?:ours?)?)\b/i;
const MEDIUM = /\b(?:tomorrow|this week(?:end)?|deadline|by (?:mon|tues|wednes|thurs|fri|satur|sun)day|by (?:the )?end of (?:the )?week|within (?:[1-7]|a|one|two|three|few) days?|in (?:[1-7]|two|three|a few) days|next few days|quick(?:ly)?|now)\b/i;

/** @returns {'high'|'medium'|'low'} */
export function extractUrgency(text) {
  if (!text) return 'low';
  if (HIGH.test(text)) return 'high';
  if (MEDIUM.test(text)) return 'medium';
  const days = /(?:delivery|deadline|due|deliver(?:ed)?|done)\D{0,25}?(\d{1,2})\s*days?/i.exec(text);
  if (days) return Number(days[1]) <= 1 ? 'high' : Number(days[1]) <= 7 ? 'medium' : 'low';
  return 'low';
}

const WEB = /\b(?:web ?sites?|web ?pages?|web ?dev(?:eloper|elopment)?|web ?designer|landing ?pages?|home ?page|site|shopify|wordpress|wix|webflow|squarespace|framer|wooc?ommerce|e-?commerce|online store|web ?app|front[- ]?end|full[- ]?stack|next\.?js|react|html|css|domain|seo)\b/i;
const OFFERING = /\[(?:for ?hire|fh|offer|offering)\]|\bfor hire\b|\bhire me\b|\bi will (?:build|design|create|make)\b|\bi(?:'m| am) (?:a|an) (?:freelance |experienced |senior |junior )?(?:web ?)?(?:dev|developer|designer)\b|\bmy services\b|\boffering\b|\bportfolio review\b|\bavailable for (?:work|hire|projects)\b|\blooking for (?:work|clients|projects|gigs)\b/i;
const HIRING_TAG = /\[(?:hiring|h|task|paid|job|request|seeking|looking)\]/i;
const NEED = /\b(?:need(?:s|ed|ing)? (?:a|an|some|someone|help|my)|looking for (?:a|an|someone|somebody|help|freelancer|developer|dev|designer)|who can (?:build|make|create|design|fix)|hiring|seeking (?:a|an)|recommend (?:a|an) (?:web|developer)|can someone (?:build|make|help)|want (?:a|someone to)|paying)\b/i;

/** Keep only people asking for website work; drop sellers and [For Hire] posts. */
export function isHiringPost(title = '', body = '', flair = '') {
  const head = `${flair} ${title}`;
  if (OFFERING.test(head) || /for ?hire/i.test(flair)) return false;
  const text = `${title}\n${body}`;
  if (!WEB.test(text)) return false;
  return HIRING_TAG.test(head) || /hiring|task|paid|job|request/i.test(flair) || NEED.test(text);
}

const LABEL = /^\s*(budget|price|delivery(?: time)?|deadline|due(?: date)?|expected delivery|timeline|buyer|client|from|username|title|category|subcategory|description|request|brief)\s*[:\-–]\s*(.*)$/i;

/**
 * Parse a pasted Fiverr brief (buyer request / message / project brief) into lead fields.
 * Pure: never touches Fiverr.
 */
export function parseFiverrBrief(raw) {
  const text = String(raw || '').replace(/\r/g, '').trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const labelled = {};
  const free = [];
  for (const line of lines) {
    const m = LABEL.exec(line);
    if (m && m[2]) labelled[m[1].toLowerCase().replace(/ .*/, '')] ??= m[2].trim();
    else if (!m) free.push(line);
  }
  const budget = extractBudget(labelled.budget || labelled.price ? `budget ${labelled.budget || labelled.price}` : text) || extractBudget(text);
  const deadlineText = [labelled.delivery, labelled.deadline, labelled.due, labelled.expected, labelled.timeline].filter(Boolean).join(' ');
  const urgency = rankUrgency(extractUrgency(deadlineText ? `deadline ${deadlineText}` : ''), extractUrgency(text));
  const body = labelled.description || labelled.request || labelled.brief || free.join(' ');
  const title = labelled.title || free[0] || body;
  const need = clip((title && body && !body.startsWith(title) ? `${title} — ${body}` : body || title).replace(/\s+/g, ' '), 280);
  const name = labelled.buyer || labelled.client || labelled.from || labelled.username || 'Fiverr buyer';
  return {
    source: 'fiverr',
    name: clip(name, 80),
    contact: null,
    need,
    budget_min: budget?.min ?? null,
    budget_max: budget?.max ?? null,
    currency: budget?.currency ?? (budget ? 'USD' : null),
    budget_period: budget?.period ?? null,
    urgency,
    deadline: deadlineText || null,
  };
}

const ORDER = { low: 0, medium: 1, high: 2 };
export const rankUrgency = (...levels) => levels.reduce((a, b) => (ORDER[b] > ORDER[a] ? b : a), 'low');
export const clip = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
