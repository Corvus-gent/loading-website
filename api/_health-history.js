import { redis, pipeline } from './_redis.js';
const DAY = 86400000,
  RETENTION = 30 * DAY;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
export async function record(sample) {
  const at = Date.parse(sample.checked_at);
  const checks = Object.fromEntries(
    Object.entries(sample.checks).map(([name, c]) => [name, [c.skipped ? 2 : Number(c.ok), c.ms]])
  );
  const compact = JSON.stringify({ at, checks, status: sample.status });
  await pipeline([
    ['ZADD', 'health:log', String(at), compact],
    ['ZREMRANGEBYSCORE', 'health:log', '-inf', String(at - RETENTION)],
    ['EXPIRE', 'health:log', '2592000']
  ]);
}
function add(bucket, name, state, ms, at) {
  const c = (bucket[name] ??= { n: 0, good: 0, ms: 0, last: 0 });
  if (state === 2) return;
  c.n++;
  c.good += state;
  c.ms += ms;
  if (!state) c.last = Math.max(c.last, at);
}
function merge(target, source) {
  for (const [name, c] of Object.entries(source)) {
    const t = (target[name] ??= { n: 0, good: 0, ms: 0, last: 0 });
    t.n += c.n;
    t.good += c.good;
    t.ms += c.ms;
    t.last = Math.max(t.last, c.last);
  }
}
async function interval(start, end, complete) {
  const k = 'health:day:' + iso(start);
  if (complete) {
    const saved = await redis(['GET', k]);
    if (saved) return JSON.parse(saved);
  }
  const out = {};
  for (let offset = 0; ; offset += 240) {
    const rows = await redis([
      'ZRANGEBYSCORE',
      'health:log',
      String(start),
      '(' + end,
      'LIMIT',
      String(offset),
      '240'
    ]);
    for (const row of rows) {
      const { at, checks, status } = JSON.parse(row);
      add(out, '_overall', Number(status === 'ok'), 0, at);
      for (const [name, [s, ms]] of Object.entries(checks)) add(out, name, s, ms, at);
    }
    if (rows.length < 240) break;
  }
  if (complete && Object.keys(out).length) await redis(['SET', k, JSON.stringify(out), 'EX', '2592000']);
  return out;
}
const pct = (c) => (c?.n ? (100 * c.good) / c.n : null);
export async function history(at = Date.now()) {
  const today = Date.parse(iso(at)),
    cutoffs = [at - DAY, at - 7 * DAY, at - 30 * DAY],
    periods = [{}, {}, {}],
    days = [];
  // Split at exact window boundaries. Read completed UTC days from compact summaries.
  const boundaries = new Set([at + 1, ...cutoffs]);
  for (let t = today; t > cutoffs[2]; t -= DAY) boundaries.add(t);
  const times = [...boundaries].sort((a, b) => a - b),
    daily = new Map();
  const parts = await Promise.all(
    times
      .slice(0, -1)
      .map((start, i) =>
        interval(start, times[i + 1], start % DAY === 0 && times[i + 1] - start === DAY)
      )
  );
  parts.forEach((part, i) => {
    const start = times[i];
    cutoffs.forEach((c, n) => {
      if (start >= c) merge(periods[n], part);
    });
    const day = iso(start);
    if (!daily.has(day)) daily.set(day, {});
    merge(daily.get(day), part);
  });
  for (let i = 29; i >= 0; i--) days.push(daily.get(iso(today - i * DAY)) || {});
  const latest = JSON.parse(await redis(['GET', 'health:last']));
  const names = Object.keys({ ...periods[2], ...latest?.checks })
    .filter((k) => k !== '_overall')
    .sort();
  const checks = names.map((name) => {
    const c = periods[2][name];
    return {
      name,
      ok: latest?.checks[name]?.ok ?? null,
      skipped: !!latest?.checks[name]?.skipped,
      days: days.map((d) => {
        const v = d[name];
        return !v?.n ? 'unknown' : v.good === v.n ? 'ok' : v.good === 0 ? 'down' : 'degraded';
      }),
      uptime: periods.map((p) => pct(p[name])),
      average: c?.n ? Math.round(c.ms / c.n) : null,
      lastIncident: c?.last ? new Date(c.last).toISOString() : null
    };
  });
  const summary = {
    status: latest?.status || 'unknown',
    checked_at: latest?.checked_at || null,
    uptime: pct(periods[2]._overall),
    checks
  };
  await redis(['SET', 'health:summary', JSON.stringify({ uptime: summary.uptime }), 'EX', '2592000']);
  return summary;
}
