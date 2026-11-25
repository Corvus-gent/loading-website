/** Stable v1 contract. Changes after merge require an explicit migration. */
export const SCHEMA_VERSION = 1;
export const STATUSES = ['new', 'contacted', 'call', 'offer_sent', 'won', 'lost'];
const plain = (x, max = 400) => String(x ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max);
const amount = (x) => { if (x === null || x === '' || x === undefined)
    return null; const n = Number(x); if (!Number.isFinite(n) || n < 0 || n > 1000000)
    throw Error('Invalid budget'); return n; };
export function validHttps(value) { try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
}
catch {
    return '';
} }
export function validateLead(input, now = new Date().toISOString()) {
    if (!/^[a-zA-Z0-9_-]{6,80}$/.test(input.id || ''))
        throw new Error('Invalid lead id');
    if (!['reddit', 'x', 'places', 'warm'].includes(input.source || ''))
        throw new Error('Invalid source');
    const name = plain(input.name, 100), need = plain(input.need, 1400), contact = plain(input.contact, 300);
    if (!name || !need)
        throw new Error('Name and need are required');
    if (!STATUSES.includes(input.status))
        throw new Error('Invalid status');
    if (!['urgent', 'this_week', 'normal', 'unknown'].includes(input.urgency || ''))
        throw new Error('Invalid urgency');
    const budget_min = amount(input.budget_min), budget_max = amount(input.budget_max);
    if (budget_min !== null && budget_max !== null && budget_max < budget_min)
        throw new Error('Budget maximum must be at least the minimum');
    const currency = plain(input.currency || 'EUR', 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency))
        throw new Error('Use a three-letter currency');
    const evidence = {};
    for (const key of ['account_created_at', 'karma', 'followers', 'past_hires', 'payment_verified', 'business_url', 'linkedin_url', 'responded_in_thread', 'copy_paste_spam', 'origin_platform', 'hourly']) {
        const v = input.evidence?.[key];
        if (['string', 'number', 'boolean'].includes(typeof v))
            evidence[key] = typeof v === 'string' ? plain(v, 500) : v;
    }
    return { evidence, id: input.id, source: input.source, name, contact, need, budget_min, budget_max, currency, urgency: input.urgency, warm: input.warm === true || input.source === 'warm', next_action: plain(input.next_action || 'Review and open a draft', 300), status: input.status, offer: null, url: validHttps(input.url), snippet: plain(input.snippet, 1400), score: Math.max(0, Math.min(100, Number(input.score) || 0)), posted_at: input.posted_at && Number.isFinite(Date.parse(input.posted_at)) ? new Date(input.posted_at).toISOString() : null, first_seen_at: input.first_seen_at && Number.isFinite(Date.parse(input.first_seen_at)) ? input.first_seen_at : now, expires_at: input.expires_at && Number.isFinite(Date.parse(input.expires_at)) ? input.expires_at : undefined, updated_at: now, revision: Number.isInteger(input.revision) ? input.revision : 0, contact_kind: plain(input.contact_kind, 20), handle: plain(input.handle, 80), reasons: (input.reasons || []).slice(0, 5).map(x => ({ label: plain(x.label, 40), points: Number(x.points) || 0 })), note: plain(input.note, 300), city: plain(input.city, 80) };
}
export function makeOffer(lead, tiers, payLink = '') {
    const need = lead.need.toLowerCase();
    const target = /\b(app|platform|full custom|marketplace|saas)\b/.test(need) ? 4 : /\b(shop|store|ecommerce|e-commerce|cms|custom design)\b/.test(need) ? 3 : /\b(5 pages|multi.page|business website|company website)\b/.test(need) ? 2 : /\b(fix|bug|section|broken|repair)\b/.test(need) ? 0 : 1;
    const budget = lead.currency === 'EUR' ? (lead.budget_max ?? lead.budget_min) : null;
    let index = target;
    while (index > 0 && budget !== null && budget < tiers[index].min)
        index--;
    const tier = tiers[index];
    const price = budget === null ? tier.price : Math.max(tier.min, Math.min(tier.price, budget, tier.max));
    const note = index < target ? 'This budget fits a smaller scope; the extra functionality is not included.' : budget !== null && budget < tier.min ? 'This offer is above the stated budget.' : lead.currency !== 'EUR' && lead.budget_max !== null ? 'Quote is in EUR; no exchange-rate assumption was made.' : '';
    const pay = validHttps(payLink) || '{REVOLUT_LINK}';
    const upfront = Math.round(price * tier.upfront_percent) / 100;
    const payment = tier.upfront_percent ? `50% upfront (€${upfront}), balance on approval.` : 'Pay only when you are happy.';
    const text = `Hey ${lead.name}, here is one concrete option for ${lead.need}: ${tier.name} — €${price} fixed. ${tier.scope}. Delivery: ${tier.delivery}${index < 4 ? ', after we agree the scope and I have your content' : ''}. ${payment} Payment: ${pay}.${note ? ' ' + note : ''}`;
    return { tier: tier.id, title: tier.name, scope: tier.scope, price, currency: 'EUR', delivery: tier.delivery, upfront_percent: tier.upfront_percent, upfront_amount: upfront, pay_link: validHttps(payLink), text, note };
}
export function canStartBuild(lead) { return lead.status === 'call'; }
export function draftLink(contact, kind, body, subject = 'Your website — a concrete offer') {
    const e = encodeURIComponent;
    if (kind === 'reddit' && /^[\w-]{3,30}$/.test(contact))
        return `https://www.reddit.com/message/compose?to=${e(contact)}&subject=${e(subject)}&message=${e(body)}`;
    if (kind === 'x' && /^\d+$/.test(contact))
        return `https://x.com/messages/compose?recipient_id=${contact}&text=${e(body)}`;
    if (/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(contact))
        return `mailto:${e(contact)}?subject=${e(subject)}&body=${e(body)}`;
    if (/^\+?[1-9]\d{6,14}$/.test(contact))
        return `https://wa.me/${contact.replace('+', '')}?text=${e(body)}`;
    try {
        const u = new URL(contact);
        if (['wa.me', 'www.wa.me'].includes(u.hostname) && /^\/\d{7,15}$/.test(u.pathname))
            return `https://wa.me${u.pathname}?text=${e(body)}`;
        if (['x.com', 'twitter.com', 'www.x.com'].includes(u.hostname) && /^\/[\w]{1,15}\/?$/.test(u.pathname))
            return `https://x.com/intent/post?text=${e('@' + u.pathname.split('/')[1] + ' ' + body)}`;
    }
    catch { }
    return '';
}
