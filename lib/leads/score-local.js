// TEMPORARY local scorer until Codex's lib/leads/score.ts is on main. Same weights:
// pay 30, urgency 25, trust 25, fit 10, reachability 10 → score 0..100.
// expected value = mid-budget (EUR) × close probability.
import { trustScore } from './signals.js';
import { suggestOffer, draftText, draftLink, toEur } from './offer-fallback.js';

const WEB_FIT = /\b(?:web ?site|landing|home ?page|shopify|wordpress|wix|webflow|squarespace|small business|portfolio|bakery|restaurant|salon|online store|redesign)\b/i;
const OFF_FIT = /\b(?:react native|ios|android|flutter|golang|rag|langchain|pinecone|blockchain|smart contract|full[- ]time|salary|senior|years? of experience)\b/i;
const HOURS = 20; // rough hours for an hourly gig, to compare with fixed budgets

export function midBudgetEur(lead) {
  if (lead.budget_max == null) return null;
  const mid = (Number(lead.budget_min ?? lead.budget_max) + Number(lead.budget_max)) / 2;
  return toEur(lead.budget_period === 'hour' ? mid * HOURS : mid, lead.currency);
}

export function scoreLead(lead, now = Date.now()) {
  const s = lead.signals || {};
  const mid = midBudgetEur(lead);
  const pay = mid == null ? 0.35 : Math.min(1, Math.log10(Math.max(mid, 10)) / 4);
  const ageH = (now - (Date.parse(lead.created_at) || now)) / 36e5;
  const urgency = Math.min(1, ({ high: 1, medium: 0.6, low: 0.2 }[lead.urgency] ?? 0.2) + (ageH < 2 ? 0.2 : ageH < 12 ? 0.1 : 0));
  const trust = trustScore(s);
  const text = lead.need || '';
  const fit = OFF_FIT.test(text) ? 0.2 : WEB_FIT.test(text) ? 1 : 0.6;
  const reach = lead.source === 'fiverr' ? 0.9 : /^mailto:|@/.test(lead.contact || '') || /^\+?\d[\d\s]{7,}$/.test(lead.contact || '') ? 1 : /compose|messages/.test(lead.contact || '') ? 0.8 : 0.5;
  const score = Math.round(30 * pay + 25 * urgency + 25 * trust + 10 * fit + 10 * reach);
  const flags = s.red_flags?.length || 0;
  const close = Number(Math.max(0.01, (score / 100) * (flags ? 0.3 ** flags : 1) * (lead.warm ? 1.5 : 1)).toFixed(3));
  const offer = suggestOffer(lead);
  const ev = Math.round((mid ?? offer.price) * Math.min(close, 0.95));
  return { score, close_probability: close, expected_value: ev, parts: { pay, urgency, trust, fit, reach }, offer };
}

const OPEN = new Set(['new', 'contacted', 'call', 'offer_sent']);

/** Top N contactable leads: warm first (product decision), then expected value. */
export function topLeads(leads, n = 15, now = Date.now()) {
  return leads
    .filter(l => OPEN.has(l.status || 'new') && (!l.signals?.red_flags || l.signals.red_flags.length < 2))
    .map(l => {
      const r = scoreLead(l, now);
      const offer = l.offer && l.offer.price ? l.offer : r.offer;
      const text = draftText(l, offer);
      return { lead: l, ...r, offer, draft: text, draft_link: draftLink(l, text), why_now: whyNow(l, now) };
    })
    .sort((a, b) => (b.lead.warm - a.lead.warm) || (b.expected_value - a.expected_value) || (b.score - a.score))
    .slice(0, n)
    .map((x, i) => ({ rank: i + 1, ...x }));
}

export function whyNow(l, now = Date.now()) {
  const h = Math.round((now - (Date.parse(l.created_at) || now)) / 36e5);
  const fresh = h < 1 ? 'posted <1h ago' : h < 48 ? `posted ${h}h ago` : null;
  if (l.warm) return 'Warm contact — they already know you.';
  if (l.source === 'maps') return `No website, ${l.signals?.reviews ?? 'some'} Google reviews — customers are searching for them.`;
  if (l.urgency === 'high') return `Urgent ask${fresh ? ', ' + fresh : ''} — first credible reply usually wins.`;
  if (l.budget_max != null) return `Stated budget${fresh ? ', ' + fresh : ''} — ready to pay.`;
  return fresh ? `Fresh request, ${fresh} — few replies yet.` : 'Open request.';
}

export function topLeadsMarkdown(top, generated = new Date()) {
  const money = l => l.budget_max == null ? '—' : `${l.currency || ''} ${l.budget_min === l.budget_max ? l.budget_max : `${l.budget_min}–${l.budget_max}`}${l.budget_period === 'hour' ? '/h' : ''}`.trim();
  const cell = s => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  const rows = top.map(t => `| ${t.rank} | [${cell(t.lead.source)}](${t.lead.url || '#'}) | ${cell(t.lead.name)} | ${cell(t.lead.need.slice(0, 120))} | ${cell(money(t.lead))} | ${t.lead.urgency} | ${Math.round(t.parts.trust * 100)}${t.lead.signals?.red_flags?.length ? ' ⚠ ' + t.lead.signals.red_flags.join(', ') : ''} | ${t.offer.name} €${t.offer.price} · ${cell(t.offer.delivery)} | ${cell(t.why_now)} | ${t.draft_link ? `[draft](${t.draft_link})` : `copy: “${cell(t.draft)}”`} |`);
  return [`# Top leads — ${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC`, '', 'Drafts only — nothing is sent automatically.', '',
    '| # | Source | Who | Need | Budget | Urgency | Trust | Offer | Why now | Draft |', '|---|---|---|---|---|---|---|---|---|---|', ...rows, ''].join('\n');
}
