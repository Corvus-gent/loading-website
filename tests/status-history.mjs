// Only run on a dedicated, empty loopback Redis DB.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
const target = new URL(process.env.STATS_TEST_REDIS);
assert.equal(target.hostname, '127.0.0.1');
assert.match(target.pathname, /^\/[1-9]\d*$/);
process.env.REDIS_URL = target.href;
const { redis, pipeline } = await import('../api/_redis.js');
assert.equal(await redis(['DBSIZE']), 0);
const {
  default: endpoint,
  record,
  history,
  importLegacy,
  names
} = await import('../api/_health-history.js');
const H = 3600000,
  D = 24 * H,
  S = 300000,
  now = Date.now(),
  slot = Math.floor(now / S) * S;
function sample(at, ms = 30, ok = true) {
  return {
    checked_at: new Date(at).toISOString(),
    status: ok ? (ms >= 1500 ? 'degraded' : 'ok') : 'degraded',
    checks: { site: { ok: true, ms: 10 }, redis: { ok, ms }, notion: { skipped: true, ok: null, ms: 0 } }
  };
}
const server = http.createServer((req, res) => {
  req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
  res.status = (n) => {
    res.statusCode = n;
    return res;
  };
  res.json = (b) => res.end(JSON.stringify(b));
  endpoint(req, res).catch(() => {
    res.statusCode = 500;
    res.end();
  });
});
try {
  assert.equal((await history()).uptime[0], null);
  const base = slot - 2 * H;
  await Promise.all(Array.from({ length: 8 }, () => record(sample(base))));
  await record(sample(base + S, 2000));
  await record(sample(base + 2 * S, 2700, false));
  await record(sample(base + 3 * S));
  const legacy = base - 2 * D;
  for (const at of [legacy, legacy + S])
    await redis([
      'ZADD',
      'health:log',
      at,
      JSON.stringify({ at, checks: { site: [1, 20], redis: [1, 40], notion: [2, 0] }, status: 'ok' })
    ]);
  await importLegacy();
  await importLegacy();
  for (const range of ['24h', '7d', '30d']) {
    const b = await history(now, range);
    const r = b.checks.find((c) => c.name === 'redis');
    assert.equal(b.uptime[0], 75);
    assert.equal(b.uptime[1], 500 / 6);
    assert.equal(r.days.length, 90);
    assert.equal(r.days.filter(Boolean).length >= 2, true);
    assert.deepEqual(b.checks.find((c) => c.name === 'notion').uptime, [null, null, null, null]);
    assert.equal(b.incidents.length, 1);
    assert.deepEqual(b.incidents[0], {
      name: 'redis',
      start: base + S,
      last: base + 2 * S,
      finish: base + 3 * S,
      worst: 3
    });
    if (range === '24h') {
      assert.deepEqual(b.series.redis, [
        [30, 30, 1],
        [2000, 2000, 2],
        [2700, 2700, 3],
        [30, 30, 1]
      ]);
      assert.deepEqual(b.series.overall[2], [1355, 1355, 3]);
    } else assert(b.series.redis.some((v) => v?.[1] === 2700 && v[2] === 3));
  }
  const ttl = async (key) => Number(await redis(['TTL', key]));
  assert.equal(await redis(['ZCARD', 'health:v2:raw']), 4);
  assert((await ttl('health:v2:raw')) <= 172800);
  const hk = 'health:v2:h:' + Math.floor(base / H) * H;
  assert((await ttl(hk)) > 29 * 86400 && (await ttl(hk)) <= 30 * 86400 + 3600);
  const dk =
    'health:v2:d:' + new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(base);
  assert((await ttl(dk)) > 119 * 86400 && (await ttl(dk)) <= 120 * 86400);
  // A visitor within the same slot cannot displace an external monitor ping.
  await record(sample(slot));
  await record(sample(slot + 1, 1700), now, true);
  await record(sample(slot + 1, 1700), now, true);
  assert.equal(await redis(['ZCARD', 'health:v2:raw']), 6);

  // Fill the full public response shape for the warm-read measurement.
  const aggregate = Object.fromEntries(['overall', ...names].map((n) => [n, [12, 12, 1200, 140, 1, 0]]));
  const rawCell = Object.fromEntries(['overall', ...names].map((n) => [n, [1, 100, 1]]));
  const commands = [];
  for (let i = 0; i < 288; i++) {
    const at = slot - i * S;
    commands.push(['ZADD', 'health:v2:raw', at, JSON.stringify({ at, cells: rawCell })]);
  }
  for (let i = 0; i <= 720; i++)
    commands.push([
      'SET',
      'health:v2:h:' + (Math.floor(now / H) * H - i * H),
      JSON.stringify(aggregate),
      'EX',
      '2592000'
    ]);
  for (const day of (await history()).days)
    commands.push(['SET', 'health:v2:d:' + day, JSON.stringify(aggregate), 'EX', '10368000']);
  await pipeline(commands);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/api/health/history?range=';
  for (const range of ['24h', '7d', '30d']) {
    const fresh = await fetch(url + range);
    assert.match(fresh.headers.get('cache-control'), /stale-while-revalidate/);
    const body = await fresh.json();
    assert.equal(body.checks.length, names.length);
    assert(body.series.overall.length >= 168);
    const latency = [];
    for (let i = 0; i < 40; i++) {
      const t = performance.now(),
        r = await fetch(url + range);
      latency.push(performance.now() - t);
      await r.arrayBuffer();
    }
    latency.sort((a, b) => a - b);
    console.log(
      range,
      'warm localhost HTTP TTFB p50/p95',
      latency[19].toFixed(2),
      latency[37].toFixed(2),
      'ms'
    );
    assert(latency[37] < 100);
    await redis([
      'SET',
      'health:v2:view:' + range,
      JSON.stringify({ ...body, built_at: now - 120000 }),
      'EX',
      3600
    ]);
    const stale = await (await fetch(url + range)).json();
    assert.equal(stale.built_at, now - 120000);
    for (let i = 0; i < 100; i++) {
      if (JSON.parse(await redis(['GET', 'health:v2:view:' + range])).built_at > now - 120000) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert(JSON.parse(await redis(['GET', 'health:v2:view:' + range])).built_at > now - 120000);
  }
  assert.equal((await fetch(url + 'bad')).status, 400);
  assert.equal((await fetch(url + '24h', { method: 'POST' })).status, 405);
  console.log(
    'passed slot deduplication, monitor priority, retention, migration, sparse buckets, incidents, three ranges and stale-while-revalidate'
  );
} finally {
  server.close();
  await redis(['FLUSHDB']);
}
process.exit(0);
