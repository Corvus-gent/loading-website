// TEMPORARY mirror of Codex's config/offers.json tiers + a short draft, used only until his
// offer generator is on main. Swap for his module; do not grow this file.
export const TIERS = [
  { id: 'quick_fix', name: 'Quick Fix', min: 75, max: 150, delivery: 'same day' },
  { id: 'landing', name: 'Landing', min: 300, max: 500, delivery: '1 page live in 24h' },
  { id: 'business', name: 'Business', min: 800, max: 1500, delivery: 'up to 5 pages + form + basic SEO in 3 days' },
  { id: 'pro', name: 'Pro', min: 2500, max: 5000, delivery: 'custom design + CMS/shop in 1–2 weeks (50% upfront)' },
  { id: 'premium', name: 'Premium', min: 5000, max: 10000, delivery: 'full custom, scoped on call (50% upfront)' },
];

const FX = { USD: 0.93, EUR: 1, GBP: 1.17, CAD: 0.67, AUD: 0.6, INR: 0.011 };
export const toEur = (n, cur) => (n == null ? null : Math.round(n * (FX[cur] ?? 1)));

export function suggestOffer(lead) {
  const need = String(lead.need || '').toLowerCase();
  const hourly = lead.budget_period === 'hour';
  const max = hourly ? null : toEur(lead.budget_max, lead.currency);
  let tier;
  if (max != null) tier = [...TIERS].reverse().find(t => max >= t.min) || TIERS[0];
  else if (/\b(?:fix|bug|broken|update|change|tweak|domain|dns|ssl|small)\b/.test(need)) tier = TIERS[0];
  else if (/\b(?:shop|store|e-?commerce|shopify|woocommerce|cms|booking|membership|dashboard|web ?app|platform)\b/.test(need)) tier = TIERS[3];
  else if (/\b(?:landing|one[- ]page|single page|simple|bakery|portfolio)\b/.test(need) || lead.source === 'maps') tier = TIERS[1];
  else tier = TIERS[2];
  const price = max != null ? Math.max(tier.min, Math.min(tier.max, max)) : Math.round((tier.min + tier.max) / 2 / 50) * 50;
  return { tier: tier.id, name: tier.name, price, currency: 'EUR', delivery: tier.delivery };
}

const shortNeed = need => String(need || '').split(/ — |[.!?\n]/)[0].replace(/\[[^\]]*\]/g, '').trim().slice(0, 70) || 'your website';

/** Short English draft. Fiverr drafts never mention links or payment outside Fiverr. */
export function draftText(lead, offer) {
  const hi = /^(?:u\/|@)/.test(lead.name) ? 'Hi' : `Hi ${String(lead.name).split(/\s+/)[0]}`;
  const pitch = "I'm Gabe, a European builder and multiple-time SF hackathon winner.";
  const deal = `${offer.name}: €${offer.price}, ${offer.delivery}.`;
  if (lead.source === 'fiverr') return `${hi}! ${pitch} I can take this on: ${deal} Happy to hop on a quick call here and have a first version live ~30 min after.`;
  if (lead.source === 'maps') return `${hi}, I noticed ${lead.name} has no website yet. ${pitch} I can put a clean site live for you: ${deal} After a 10-min call the first version is live ~30 min later. Interested? — Gabe, corvus.gent`;
  return `${hi}, saw your post about "${shortNeed(lead.need)}". ${pitch} ${deal} Quick call? First version live ~30 min after we talk. — Gabe, corvus.gent`;
}

/** One-click prefilled draft link. Gabe clicks send himself; nothing is sent automatically. */
export function draftLink(lead, text) {
  const e = encodeURIComponent;
  if (lead.source === 'reddit') {
    const user = /^u\/(.+)/.exec(lead.name)?.[1];
    return user ? `https://www.reddit.com/message/compose/?to=${e(user)}&subject=${e('Your website request')}&message=${e(text)}` : lead.url;
  }
  if (lead.source === 'x') {
    const id = /\/status\/(\d+)/.exec(lead.url || '')?.[1];
    return id ? `https://x.com/intent/post?in_reply_to=${id}&text=${e(text.slice(0, 270))}` : lead.url;
  }
  const contact = String(lead.contact || '');
  if (/@/.test(contact) && !/^https?:/.test(contact)) return `mailto:${contact}?subject=${e('A website for ' + lead.name)}&body=${e(text)}`;
  const phone = contact.replace(/[^\d+]/g, '');
  if (lead.source === 'maps' && phone.length >= 8) return `https://wa.me/${phone.replace(/^\+/, '')}?text=${e(text)}`;
  return null; // fiverr: copy the text, reply on-platform
}
