import assert from 'node:assert/strict';
import { test } from 'node:test';

const { askModel, draftPersona } = await import('../lib/hackersbay/profile.js');
const endpoint = 'https://api.confidential.trustedrouter.com/v1/chat/completions';
const profile = new URL('https://github.com/sample');
const draft = { type: 'builder', builds: 'Demo', wants: 'A crew', offers: 'Ideas' };

test('Private Parrot makes a local draft without credentials or scout calls', async t => {
  for (const key of ['TRUSTEDROUTER_API_KEY', 'NYTEX_TRUSTEDROUTER_API_KEY']) {
    const prior = process.env[key];
    delete process.env[key];
    t.after(() => { if (prior !== undefined) process.env[key] = prior; });
  }
  t.mock.method(globalThis, 'fetch', () => assert.fail('private fallback should not fetch'));
  const card = await draftPersona(profile.href, {
    privateMode: true, scout: () => assert.fail('private mode must skip Boat')
  });
  assert.equal(card.source, 'private-demo');
  assert.equal(card.attestation, undefined);
});

test('a confidential success cannot claim a verified receipt without valid evidence', async t => {
  t.mock.method(globalThis, 'fetch', (url, options) => {
    assert.equal(url, endpoint);
    assert.equal(options.redirect, 'error');
    assert.match(options.headers['X-Inference-Receipt'], /^[0-9a-f]{32}$/);
    const request = JSON.parse(options.body);
    assert.equal(request.provider.min_privacy, 'confidential');
    assert.equal(request.stream, true);
    const content = JSON.stringify({ ...draft, attestation: 'verified', reader: 'context', scout: 'boat' });
    const message = JSON.stringify({ choices: [{ delta: { content } }] });
    const falseReceipt = JSON.stringify({ inference_receipt: { protected: 'x', payload: 'y', signature: 'z' } });
    return new Response('data: ' + message + '\n\ndata: ' + falseReceipt + '\n\ndata: [DONE]\n\n');
  });
  const card = await askModel({
    url: profile, text: 'Public profile', endpoint, key: 'test', model: 'nyte/trusted',
    provider: { min_privacy: 'confidential' }, source: 'private'
  });
  assert.equal(card.source, 'private');
  assert.equal(card.attestation, 'unverified');
  assert.equal(card.reader, undefined);
  assert.equal(card.scout, undefined);
});

test('a truncated confidential stream is discarded', async t => {
  t.mock.method(globalThis, 'fetch', () => new Response('data: {"choices":[]}\n\n'));
  await assert.rejects(askModel({
    url: profile, text: 'Public profile', endpoint, key: 'test', model: 'nyte/trusted',
    provider: { min_privacy: 'confidential' }, source: 'private'
  }), /Incomplete private draft/);
});

test('the public scout runs a bounded job in a private Boat sandbox', async t => {
  const env = {
    REDIS_TLS_URL: undefined, REDIS_URL: undefined, REDIS_MAINTENANCE: undefined,
    HACKERSBAY_REST_API_URL: 'https://parrot-budget.example', HACKERSBAY_REST_API_TOKEN: 'test-budget',
    BOAT_DEV_API_KEY: 'test-boat'
  };
  for (const [key, value] of Object.entries(env)) {
    const prior = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    t.after(() => { if (prior === undefined) delete process.env[key]; else process.env[key] = prior; });
  }

  const excerpt = "I build lightweight tools for other developers.\nA public page may contain a quote: 'example'.";
  t.mock.method(globalThis, 'fetch', (url, options) => {
    if (url === env.HACKERSBAY_REST_API_URL) return Response.json({ result: 1 });
    const body = JSON.parse(options.body);
    if (url === 'https://boat.dev/api/v1/sandboxes') {
      assert.equal(body.noEnv, true);
      assert.equal(body.snapshots, false);
      assert.equal(body.monitoring, false);
      assert.equal(body.visibility, 'private');
      assert.equal(body.ttlSeconds, 120);
      return Response.json({ sandbox: { id: 'test-scout' } });
    }
    assert.equal(url, 'https://boat.dev/api/v1/sandboxes/test-scout/commands');
    assert.equal(body.timeoutSeconds, 3);
    const encoded = /'([a-z0-9+/=]+)'$/i.exec(body.command)?.[1];
    assert.equal(Buffer.from(encoded, 'base64').toString(), excerpt);
    assert.ok(!body.command.includes(excerpt));
    return Response.json({ success: true, exitCode: 0, stdout: JSON.stringify({ brief: 'Builds tools for developers.' }) });
  });
  const { runParrotScout } = await import('../lib/hackersbay/boat.js');
  assert.equal(await runParrotScout(excerpt, 'test-network'), 'Builds tools for developers.');
});
