import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { sealMedia } from '../api/_oli/sealed-media.js';
import { applyEdit, validateTimeline } from '../api/_oli/timeline.js';

const timeline = [
  { clip: 'opening.mp4', a: 2, b: 5, cx: 0.4, cap_en: null, cap_zh: ['原文'], hook: 1, cam: 1, split: 1 },
  { clip: 'grip.mp4', a: 7, b: 12, cx: 0.5, cap_en: null, cap_zh: null, fight: 1 },
  { clip: 'wake.mp4', a: 1, b: 3, cx: 0.6, cap_en: null, cap_zh: null, hook: 1, hook_en: ['Original'], hook_zh: ['保留'] }
];
validateTimeline(timeline);
assert.throws(() => validateTimeline({ segments: timeline }), /must be an array/);
assert.throws(() => validateTimeline([{ ...timeline[0], cap_en: 'invalid' }]), /must be an array/);
const trim = { type: 'trim', seg: 0, a: 1, b: 6 };
const edit = { summary: 'Adjust the first clip', ops: [trim] };
assert.equal(applyEdit(timeline, edit, 'en')[0].a, 1);
assert.equal(timeline[0].a, 2);
for (const [op, reason] of [
  [{ ...trim, a: 0.99 }, /1\.0 s/],
  [{ ...trim, b: 6.01 }, /1\.0 s/],
  [{ ...trim, seg: 8 }, /position/],
  [{ ...trim, type: 'upload' }, /unsupported/],
  [{ type: 'caption', seg: 0, lang: 'zh', lines: ['a'] }, /language/]
]) {
  assert.throws(() => applyEdit(timeline, { ...edit, ops: [op] }, 'en'), reason);
}
assert.throws(() => applyEdit(timeline, { ...edit, ops: [trim, { ...trim, a: 0.5 }] }, 'en'), /1\.0 s/);
const recut = applyEdit(timeline, { summary: 'Update the caption and opening', ops: [
  { type: 'reorder', from: 0, to: 1 },
  { type: 'caption', seg: 1, lang: 'en', lines: ['New'] },
  { type: 'hook', lang: 'en', lines: ['Updated hook'] },
  { type: 'toggle', seg: 1, flag: 'cam', on: false }
] }, 'en');
assert.deepEqual(recut[1], { ...timeline[0], cap_en: ['New'], hook_en: ['Updated hook'], cam: 0 });
assert.deepEqual(recut[2], { ...timeline[2], hook_en: ['Updated hook'] });
assert.deepEqual(recut[0], timeline[1]);
assert.throws(() => applyEdit([timeline[1]], {
  summary: 'Update hook', ops: [{ type: 'hook', lang: 'en', lines: ['New'] }]
}, 'en'), /no hook segments/);

assert.equal(process.env.REDIS_URL, 'redis://127.0.0.1:16380/10', 'Use the disposable Oli database only');
Object.assign(process.env, {
  SESSION_SECRET: 'oli-session-test', OLI_REVIEW_CODE: 'oli-passcode-test', OLI_AGENT_TOKEN: 'oli-agent-test',
  OLI_BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_mockstore_test', OPENAI_API_KEY: 'oli-openai-test'
});
const { default: handler } = await import('../api/stats.js');
const db = createClient({ url: process.env.REDIS_URL });
await db.connect();
await db.flushDb();

const openFetch = globalThis.fetch;
const requests = [];
const encryptedPath = `oli/zh/${randomUUID()}.mp4`;
const preview = Buffer.alloc(300_000, 0x54);
const boundary = 256 * 1024;
preview.write('across boundary', boundary - 6);
const sealedParts = [];
for await (const part of sealMedia([preview], encryptedPath)) sealedParts.push(part);
const sealed = Buffer.concat(sealedParts);
assert.equal(sealed.includes('across boundary'), false);
let tampered = false;
let nextEdit = edit;
globalThis.fetch = async (target, options) => {
  const url = String(target);
  assert.ok(!url.includes('drive.google.com'), 'Drive links stay unfetched');
  if (url === 'https://api.openai.com/v1/chat/completions') {
    requests.push(JSON.parse(options.body));
    return Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'propose_edit', arguments: JSON.stringify(nextEdit) } }] } }] });
  }
  if (url.startsWith('https://mockstore.private.blob.vercel-storage.com/')) {
    assert.equal(options.headers.authorization, 'Bearer vercel_blob_rw_mockstore_test');
    assert.equal(options.headers.Range, 'bytes=0-3');
    return new Response('clip', { status: 206, headers: { 'Content-Range': 'bytes 0-3/10', 'Content-Length': '4' } });
  }
  if (url === `https://mockstore.public.blob.vercel-storage.com/${encryptedPath}.enc`) {
    assert.equal(options.headers.authorization, undefined);
    const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
    const bytes = Buffer.from(sealed.subarray(Number(from), Number(to) + 1));
    if (tampered && Number(from) > 0) bytes[0] ^= 1;
    return new Response(bytes, { status: 206, headers: { 'Content-Range': `bytes ${from}-${to}/${sealed.length}` } });
  }
  return openFetch(target, options);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const action = url.pathname.split('/').at(-1);
  req.query = { ...Object.fromEntries(url.searchParams), oli: action };
  let raw = '';
  for await (const chunk of req) raw += chunk;
  req.body = raw ? JSON.parse(raw) : undefined;
  res.status = code => { res.statusCode = code; return res; };
  res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  await handler(req, res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const root = `http://127.0.0.1:${server.address().port}/api/oli/`;
const request = (route, body, headers) => fetch(root + route, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body)
});
const bearer = { Authorization: 'Bearer oli-agent-test' };
const videoUrl = () => `https://mockstore.private.blob.vercel-storage.com/oli/en/${randomUUID()}.mp4`;
const attachment = 'https://drive.google.com/file/d/123/view';

try {
  for (const [route, body] of [
    ['agent/next'], ['agent/result', {}], ['agent/seed', {}], ['state?variant=en'],
    ['chat', {}], ['upload', {}], ['media?file=oli/en/' + randomUUID() + '.mp4']
  ]) assert.equal((await request(route, body)).status, 401, route);
  assert.equal((await request('agent/next', undefined, { Authorization: 'Bearer not-the-token' })).status, 401);
  assert.equal((await request('access', { passcode: 'wrong' })).status, 401);
  const gate = await request('access', { passcode: 'oli-passcode-test' });
  assert.equal(gate.status, 200);
  const signed = gate.headers.get('set-cookie');
  assert.match(signed, /HttpOnly; Secure; SameSite=Strict/);
  const auth = { Cookie: signed.split(';')[0] };
  assert.equal((await request('state?variant=en', undefined, { Cookie: auth.Cookie + 'tampered' })).status, 401);
  process.env.OLI_REVIEW_CODE = 'rotated-code';
  assert.equal((await request('state?variant=en', undefined, auth)).status, 401);
  process.env.OLI_REVIEW_CODE = 'oli-passcode-test';
  const blank = await request('state?variant=long', undefined, auth);
  assert.equal(blank.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(blank.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await blank.json(), { versions: [], chat: [], jobs: [] });
  const seed = { variant: 'en', versionUrl: videoUrl(), timeline, label: 'v2' };
  assert.equal((await request('agent/seed', { ...seed, versionUrl: seed.versionUrl.replace('.private.', '.public.') }, bearer)).status, 400);
  assert.equal((await request('agent/seed', seed, bearer)).status, 200);
  const seeded = await (await request('state?variant=en', undefined, auth)).json();
  assert.deepEqual(Object.keys(seeded.versions[0]).sort(), ['changelog', 'label', 'url']);
  const media = await request(seeded.versions[0].url.split('/api/oli/')[1], undefined, { ...auth, Range: 'bytes=0-3' });
  assert.equal(media.status, 206);
  assert.equal(media.headers.get('content-range'), 'bytes 0-3/10');
  assert.equal(await media.text(), 'clip');
  const dedicated = process.env.OLI_BLOB_READ_WRITE_TOKEN;
  delete process.env.OLI_BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = dedicated;
  const encryptedUrl = `https://mockstore.public.blob.vercel-storage.com/${encryptedPath}`;
  const fallbackSeed = { variant: 'zh', timeline, label: 'v2', versionUrl: encryptedUrl + '.enc' };
  assert.equal((await request('agent/seed', { ...fallbackSeed, versionUrl: encryptedUrl }, bearer)).status, 400);
  assert.equal((await request('agent/seed', fallbackSeed, bearer)).status, 200);
  const track = await (await request('state?variant=zh', undefined, auth)).json();
  const route = track.versions[0].url.split('/api/oli/')[1];
  const range = `bytes=${boundary - 6}-${boundary + 8}`;
  assert.equal((await request(route, undefined, { Range: range })).status, 401);
  const fallback = await request(route, undefined, { ...auth, Range: range });
  assert.equal(fallback.status, 206);
  assert.equal(fallback.headers.get('content-range'), `bytes ${boundary - 6}-${boundary + 8}/${preview.length}`);
  assert.equal(await fallback.text(), 'across boundary');
  const suffix = await request(route, undefined, { ...auth, Range: 'bytes=-5' });
  assert.equal(await suffix.text(), 'TTTTT');
  const invalidRange = await request(route, undefined, { ...auth, Range: 'bytes=400000-' });
  assert.equal(invalidRange.status, 416);
  assert.equal(invalidRange.headers.get('content-range'), `bytes */${preview.length}`);
  tampered = true;
  await assert.rejects(async () => (await request(route, undefined, { ...auth, Range: range })).arrayBuffer());
  process.env.OLI_BLOB_READ_WRITE_TOKEN = dedicated;
  delete process.env.BLOB_READ_WRITE_TOKEN;

  assert.equal((await request('upload', { photo: Buffer.from('not a photo').toString('base64') }, auth)).status, 400);
  const payload = { variant: 'en', messages: [{ role: 'user', content: 'Adjust the first clip' }], driveLinks: [attachment], atTime: 1.5 };
  const queued = await (await request('chat', payload, auth)).json();
  assert.equal(queued.jobs[0].status, 'queued');
  assert.equal(queued.chat[0].atTime, 1.5);
  assert.deepEqual(queued.chat[0].driveLinks, [attachment]);
  assert.match(requests[0].messages[0].content, /10x BJJ world champ.*\n[\s\S]+Current timeline.json: \[\{"clip":/);
  assert.equal(requests[0].store, false);
  assert.equal((await (await request('chat', payload, auth)).json()).jobs.length, 1, 'Only one queued edit per timeline');
  const claimed = await Promise.all([1, 2].map(async () =>
    (await (await request('agent/next', undefined, bearer)).json()).job
  ));
  assert.equal(claimed.filter(Boolean).length, 1, 'Only one worker can claim the job');
  const job = claimed.find(Boolean);
  assert.equal(job.status, 'rendering');
  assert.deepEqual(job.timeline, timeline);
  const result = {
    id: job.id, claim: job.claim, status: 'live', versionUrl: videoUrl(), changelog: job.summary,
    timeline: applyEdit(job.timeline, job, 'en')
  };
  assert.equal((await request('agent/result', { ...result, claim: randomUUID() }, bearer)).status, 409);
  assert.equal((await request('agent/result', { ...result, versionUrl: result.versionUrl.replace('/en/', '/zh/') }, bearer)).status, 409);
  assert.equal((await request('agent/result', result, bearer)).status, 200);
  assert.equal((await request('agent/result', result, bearer)).status, 200, 'Retry is idempotent');
  assert.equal((await request('agent/seed', seed, bearer)).status, 200, 'Retry seeding preserves later versions');
  const live = await (await request('state?variant=en', undefined, auth)).json();
  assert.deepEqual(live.versions.map(v => v.label), ['v3', 'v2']);
  assert.equal(live.jobs[0].status, 'live');
  assert.equal(live.jobs[0].label, 'v3');
  nextEdit = { ...edit, ops: [{ ...trim, b: 7.1 }] };
  const rejected = await (await request('chat', payload, auth)).json();
  assert.match(rejected.chat.at(-1).content, /1\.0 s/);
  assert.equal(rejected.jobs.length, 1, 'Invalid tools never queue');
  nextEdit = edit;
  await request('chat', payload, auth);
  const second = (await (await request('agent/next', undefined, bearer)).json()).job;
  assert.equal((await request('agent/result', { id: second.id, claim: second.claim, status: 'failed', reason: 'Fixture render failed.' }, bearer)).status, 200);
  const failed = await (await request('state?variant=en', undefined, auth)).json();
  assert.equal(failed.jobs[0].reason, 'Fixture render failed.');
  assert.equal(failed.versions[0].label, 'v3');
  console.log('Oli API, trim validation and queue lifecycle passed.');
} finally {
  globalThis.fetch = openFetch;
  await new Promise(resolve => server.close(resolve));
  await db.flushDb();
  await db.quit();
  // The deployed Redis helper keeps its connection open.
  setImmediate(() => process.exit(process.exitCode || 0));
}
