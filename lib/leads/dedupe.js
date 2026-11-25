// Dedupe leads across sources and runs: canonical URL + normalised-text hash.
// The oldest lead keeps its id (and Gabe's status/offer); empty fields are filled from newer copies.

export function canonicalUrl(raw) {
  if (!raw) return null;
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  let host = u.hostname.toLowerCase().replace(/^(?:www|m|mobile|old|new|np|i)\./, '');
  let path = u.pathname.replace(/\/+$/, '') || '/';
  if (host === 'redd.it') { host = 'reddit.com'; path = `/comments/${path.slice(1)}`; }
  if (host === 'reddit.com') {
    const id = path.match(/\/comments\/([a-z0-9]+)/i)?.[1];
    if (id) return `reddit.com/comments/${id.toLowerCase()}`;
  }
  if (host === 'twitter.com' || host === 'x.com') {
    const id = path.match(/\/status(?:es)?\/(\d+)/)?.[1];
    if (id) return `x.com/status/${id}`;
    host = 'x.com';
  }
  return `${host}${path.toLowerCase()}`;
}

export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 400);
}

// 2×32-bit FNV-1a → 16 hex chars. Deterministic in Node and the browser.
export function textHash(text) {
  const s = normalizeText(text);
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

const time = l => Date.parse(l.created_at || '') || Number.MAX_SAFE_INTEGER;
const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

export function leadKeys(lead) {
  const keys = [];
  const url = canonicalUrl(lead.url);
  if (url) keys.push('u:' + url);
  if (normalizeText(lead.need).length >= 25) keys.push('t:' + textHash(lead.need));
  return keys;
}

function merge(older, newer) {
  const out = { ...older };
  for (const [k, v] of Object.entries(newer)) if (empty(out[k]) && !empty(v)) out[k] = v;
  // Newer budget/urgency information wins only when the older copy had none.
  out.warm = Boolean(older.warm || newer.warm);
  // Never reset Gabe's progress: a worked copy beats a fresh scrape.
  if ((!older.status || older.status === 'new') && newer.status && newer.status !== 'new') {
    out.status = newer.status;
    if (!empty(newer.next_action)) out.next_action = newer.next_action;
  }
  out.seen_at = [older.seen_at, newer.seen_at].filter(Boolean).sort().pop() || out.seen_at;
  return out;
}

/** Merge lead lists; returns a deduped array. Existing leads should come first. */
export function dedupeLeads(...lists) {
  const all = lists.flat().filter(Boolean);
  const byKey = new Map();
  const groups = [];
  for (const lead of all) {
    const keys = leadKeys(lead);
    let group = keys.map(k => byKey.get(k)).find(Boolean) || groups.find(g => g.lead.id && g.lead.id === lead.id);
    if (!group) { group = { lead }; groups.push(group); }
    else {
      const [older, newer] = time(lead) < time(group.lead) ? [lead, group.lead] : [group.lead, lead];
      group.lead = merge(older, newer);
    }
    for (const k of [...keys, ...leadKeys(group.lead)]) byKey.set(k, group);
  }
  return groups.map(g => g.lead);
}
