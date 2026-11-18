// No credentials or live services: exercise the actual status-check deadline.
import assert from 'node:assert/strict';
import { checks, inspect } from '../api/_health.js';
const delayed = checks({ query: async (_sql, signal) => {
  await new Promise(resolve => setTimeout(resolve, 3100));
  assert.equal(signal.aborted, false, 'query must survive the old 2.9s deadline');
  return [[1]];
} });
const sample = await inspect({ posthog: delayed.posthog });
assert.equal(sample.checks.posthog.ok, true);
assert.equal(sample.status, 'degraded', 'slow responses must remain visible');
const unavailable = await inspect({ posthog: () => Promise.reject(new Error('posthog 503')) });
assert.equal(unavailable.checks.posthog.ok, false);
await assert.rejects(checks({ query: async () => [[0]] }).posthog(), /unexpected query result/);
const hung = await inspect({ posthog: () => new Promise(() => {}) });
assert.equal(hung.checks.posthog.ok, false, 'a stalled provider must still fail');
assert.equal(hung.checks.posthog.detail, 'timeout');
assert(hung.checks.posthog.ms < 9000, 'the probe must have a finite deadline');
console.log('PostHog health: slow, unavailable, invalid and stalled responses passed.');
