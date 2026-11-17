// @ts-check
// Browser-safe source of truth. Never use OWNER_EMAIL for public contact links.
export const ROLE_ADDRESSES = Object.freeze({
  hello: 'hello@corvus.gent', billing: 'billing@corvus.gent', legion: 'legion@corvus.gent',
  hack: 'hack@corvus.gent', press: 'press@corvus.gent', security: 'security@corvus.gent',
});
// Owner authorization and the explicitly agreed marketing reply-to only.
export const OWNER_EMAIL = 'gabriel@corvus.gent';
export const SENDER_IDENTITIES = Object.freeze({
  transactional: Object.freeze({name: 'Corvus', local: 'hello', domain: 'mail.corvus.gent', replyTo: ROLE_ADDRESSES.hello}),
  marketing: Object.freeze({name: 'Gabe', local: 'gabe', domain: 'news.corvus.gent', replyTo: OWNER_EMAIL}),
});
/** @param {'transactional'|'marketing'} stream @param {Record<string, string | undefined>} env */
export function senderIdentity(stream, env = {}) {
  const sender = SENDER_IDENTITIES[stream];
  const domain = env[stream === 'marketing' ? 'EMAIL_MARKETING_DOMAIN' : 'EMAIL_TRANSACTIONAL_DOMAIN'] || sender.domain;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+corvus\.gent$/i.test(domain)) throw Error('Invalid email sending subdomain');
  return {from: `${sender.name} <${sender.local}@${domain}>`, reply_to: sender.replyTo};
}
