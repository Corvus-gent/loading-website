#!/usr/bin/env node
// Gift a soldier a tier without a payment (friends, day ones).
// usage: node tools/gift-tier.mjs <username> <tier> [--dry-run]
// senator and consul are lifetime tiers; others need --until YYYY-MM-DD.
import {armyStore} from '../api/_army/_store.js';
import {TIERS, LIFETIME, activeTier} from '../js/army/domain.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const untilAt = args.indexOf('--until');
const until = untilAt >= 0 ? args[untilAt + 1] : null;
const [username, tier] = args.filter((v, i) => !v.startsWith('--') && i !== untilAt + 1);

try {
  if (!username || !tier) throw Error('usage: node tools/gift-tier.mjs <username> <tier> [--until YYYY-MM-DD] [--dry-run]');
  if (!TIERS.includes(tier) || tier === 'imperator') throw Error(`tier must be one of: ${TIERS.filter(t => t !== 'imperator').join(', ')}`);
  if (!LIFETIME.includes(tier) && !/^\d{4}-\d{2}-\d{2}$/.test(until || '')) throw Error(`${tier} is not lifetime: pass --until YYYY-MM-DD`);
  const store = armyStore();
  const found = await store.byName(username.toLowerCase().replace(/^@/, ''));
  if (!found) throw Error(`no soldier named ${username}`);
  const before = activeTier(found);
  const result = await store.lock(found.id, async () => {
    const user = await store.getUser(found.id);
    user.membership = {tier, state: 'gift', until: LIFETIME.includes(tier) ? null : new Date(until + 'T23:59:59Z').toISOString(), interval: null, amount: 0, currency: null, updated: new Date(store.now()).toISOString(), object: 'gift'};
    if (!dryRun) await store.persist(user);
    return user;
  });
  console.log(JSON.stringify({dryRun, username: result.username, verified: !!result.verifiedAt, status: result.status, before, after: activeTier(result)}));
  if (!result.verifiedAt) console.log('note: email not confirmed yet, so the tier only shows publicly once they confirm.');
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
