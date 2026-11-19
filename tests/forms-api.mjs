import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { formHandler } from '../api/_forms/handler.js';
const form = { slug: 'fixture', title: 'Fixture form', emailSubject: 'Fixture feedback', questions: [{ id: 'vote', label: 'Vote?', type: 'thumbs' }] };
const rows = new Map(), locks = new Set(), sent = [];
const store = {
  async get(_slug, id) { return rows.get(id); },
  async save(row) { const previous = rows.get(row.sessionId); const value = { ...previous, ...row, createdAt: previous?.createdAt || row.receivedAt }; rows.set(row.sessionId, value); return value; },
  async list() { return [...rows.values()]; },
  async acquire(key) { if (locks.has(key)) return false; locks.add(key); return true; },
  async release(key) { locks.delete(key); },
  async emailed(row, hash, at) { Object.assign(rows.get(row.sessionId), { lastEmailedHash: hash, lastEmailedAt: at }); }
};
const env = { NODE_ENV: 'test', ADMIN_TOKEN: 'fixture-secret', VERCEL_URL: 'deployment-fixture.vercel.app', VERCEL_BRANCH_URL: 'branch-fixture.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'project-fixture.vercel.app' };
const handler = formHandler({ forms: { fixture: form }, store, send: async email => sent.push(email), env, throttle: async () => true, ipHash: () => 'fixture' });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'); req.query = { ...Object.fromEntries(url.searchParams), action: url.pathname.split('/').at(-1) };
  const chunks = []; for await (const chunk of req) chunks.push(chunk); req.body = Buffer.concat(chunks);
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
  res.send = value => { res.end(value); return res; };
  await handler(req, res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const input = { slug: 'fixture', sessionId: randomUUID(), updatedAt: new Date().toISOString(), answers: { vote: { vote: 'down', comment: 'test response' } } };
const post = (action, body, origin = 'http://localhost:3000') => fetch(base + '/api/forms/' + action, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
try {
  assert.equal((await post('save', input)).status, 200);
  assert.equal(rows.size, 1);
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) assert.equal((await post('save', input, 'https://' + host)).status, 200, 'this project alias may save');
  assert.equal((await post('save', input, 'https://attacker.vercel.app')).status, 403);
  assert.equal((await post('save', { ...input, sessionId: [input.sessionId] })).status, 400);
  assert.equal((await post('save', { ...input, updatedAt: 0 })).status, 400);
  assert.equal((await post('save', input, 'https://attacker.test')).status, 403);
  assert.equal((await post('flush', input)).status, 200);
  assert.equal(sent.length, 1);
  await post('flush', input); assert.equal(sent.length, 1);
  assert.match(sent[0].text, /👎\ntest response/);
  assert.equal((await fetch(base + '/api/forms/export?slug=fixture')).status, 401);
  const exported = await fetch(base + '/api/forms/export?slug=fixture&token=fixture-secret');
  assert.equal(exported.status, 200); assert.match(await exported.text(), /test response/);
  console.log('PASS: local HTTP submit, flush, email adapter, duplicate prevention, origin checks and protected CSV export.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
