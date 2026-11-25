// Trust signals for Codex's scorer. Stored on lead.signals (extra field, not in schema yet).
// {account_age_days, karma, followers, past_hiring_posts, business_site, linkedin, red_flags[], duplicate_posts}

const RED_FLAGS = [
  ['exposure', /\b(?:for|in exchange for|great) exposure\b|\bportfolio piece\b|\bgood for your portfolio\b/i],
  ['equity_only', /\b(?:equity[- ]only|for equity|equity in exchange|revenue[- ]share only|rev[- ]?share|profit[- ]share|no (?:upfront )?pay(?:ment)? (?:until|upfront))\b/i],
  ['unpaid_test', /\b(?:free|unpaid) (?:test|trial|sample|mock ?up)\b|\btest task\b(?![^.]*\bpaid\b)/i],
  ['crypto_or_giftcard_pay', /\b(?:usdt|crypto(?:currency)?|bitcoin|btc|eth(?:ereum)?|gift ?cards?|steam cards?)\b/i],
  ['off_platform_ask', /\b(?:telegram|whats ?app me|signal me|contact me on (?:telegram|whatsapp|discord)|t\.me\/)\b/i],
  ['task_farm', /\bearn \$?\d+ (?:per|a) task\b|\bget me clients\b|\blinkedin (?:users|accounts)\b|\brent (?:your|an) account\b/i],
  ['no_budget', /\b(?:no budget|low budget|cheap as possible|for free)\b/i],
];

export function redFlags(text) {
  const t = String(text || '');
  return RED_FLAGS.filter(([, re]) => re.test(t)).map(([k]) => k);
}

const SOCIAL = /(?:reddit\.com|redd\.it|x\.com|twitter\.com|t\.co|imgur\.com|youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com|discord\.gg|t\.me|fiverr\.com|upwork\.com)/i;
export function links(text) {
  const urls = [...String(text || '').matchAll(/https?:\/\/[^\s)\]>"']+/gi)].map(m => m[0].replace(/[.,;]+$/, ''));
  return {
    linkedin: urls.find(u => /linkedin\.com\/(?:in|company)\//i.test(u)) || null,
    business_site: urls.find(u => !SOCIAL.test(u) && !/linkedin\.com/i.test(u)) || null,
  };
}

/** Base signals derivable from text alone; sources add account data. */
export function textSignals(lead, extra = {}) {
  const text = lead.need || '';
  return { ...links(text), red_flags: redFlags(text), ...extra };
}

/** Flag the same poster spamming many subs / identical texts within one batch. */
export function markDuplicates(leads) {
  const byPoster = new Map();
  for (const l of leads) if (l.name && /^(?:u\/|@)/.test(l.name)) byPoster.set(l.name, (byPoster.get(l.name) || 0) + 1);
  for (const l of leads) {
    const n = byPoster.get(l.name) || 1;
    l.signals = { ...(l.signals || {}), duplicate_posts: n };
    if (n >= 3 && !l.signals.red_flags?.includes('spam_duplicates')) l.signals.red_flags = [...(l.signals.red_flags || []), 'spam_duplicates'];
  }
  return leads;
}

/** 0..1 trust from signals. Unknowns are neutral (0.5), not punished. */
export function trustScore(s = {}) {
  let t = 0.5;
  if (s.account_age_days != null) t += s.account_age_days > 730 ? 0.15 : s.account_age_days > 180 ? 0.08 : s.account_age_days < 14 ? -0.2 : 0;
  if (s.karma != null) t += s.karma > 2000 ? 0.1 : s.karma > 200 ? 0.05 : s.karma < 10 ? -0.1 : 0;
  if (s.followers != null) t += s.followers > 1000 ? 0.1 : s.followers > 100 ? 0.05 : s.followers < 10 ? -0.05 : 0;
  if (s.past_hiring_posts) t += Math.min(0.1, s.past_hiring_posts * 0.03);
  if (s.business_site) t += 0.1;
  if (s.linkedin) t += 0.08;
  if (s.reviews != null) t += s.reviews > 50 ? 0.15 : s.reviews > 10 ? 0.08 : 0;
  t -= 0.25 * (s.red_flags?.length || 0);
  return Math.max(0, Math.min(1, Number(t.toFixed(2))));
}
