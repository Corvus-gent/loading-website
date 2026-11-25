// LOCAL STUB of Codex's lib/leads/schema.ts (owned by Codex, branch leadhunter-offers).
// Replace imports of this file with the real schema once it lands on main.
//
// Extra fields this branch sets that are NOT in the schema yet (requested in the PR):
//   url, created_at, budget_period ('fixed'|'hour'), seen_at, signals (trust data for the scorer).

/**
 * @typedef {'new'|'contacted'|'call'|'offer_sent'|'won'|'lost'} LeadStatus
 * @typedef {Object} Lead
 * @property {string} id
 * @property {string} source
 * @property {string} name
 * @property {string|null} contact
 * @property {string} need
 * @property {number|null} budget_min
 * @property {number|null} budget_max
 * @property {string|null} currency
 * @property {string} urgency
 * @property {boolean} warm
 * @property {string} next_action
 * @property {LeadStatus} status
 * @property {any} offer
 */

export const STATUSES = ['new', 'contacted', 'call', 'offer_sent', 'won', 'lost'];
const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));
const str = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

/** Normalise untrusted input into a Lead (plus the extra fields listed above). */
export function makeLead(input) {
  const i = input || {};
  let min = num(i.budget_min), max = num(i.budget_max);
  if (min != null && max == null) max = min;
  if (max != null && min == null) min = max;
  if (min != null && max != null && min > max) [min, max] = [max, min];
  const lead = {
    id: str(i.id, 120),
    source: str(i.source, 30) || 'manual',
    name: str(i.name, 120) || 'Unknown',
    contact: str(i.contact, 300),
    need: str(i.need, 1000) || '',
    budget_min: min,
    budget_max: max,
    currency: str(i.currency, 3)?.toUpperCase() || null,
    urgency: ['high', 'medium', 'low'].includes(i.urgency) ? i.urgency : 'low',
    warm: i.warm === true,
    next_action: str(i.next_action, 200) || 'Review',
    status: STATUSES.includes(i.status) ? i.status : 'new',
    offer: i.offer ?? null,
    url: str(i.url, 500),
    created_at: str(i.created_at, 40) || new Date().toISOString(),
    budget_period: i.budget_period === 'hour' ? 'hour' : min != null ? 'fixed' : null,
  };
  if (i.seen_at) lead.seen_at = str(i.seen_at, 40);
  if (i.signals && typeof i.signals === 'object' && JSON.stringify(i.signals).length < 2000) lead.signals = i.signals;
  return lead;
}
