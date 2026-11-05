import { randomUUID } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { redis } from './_redis.js';
import { brusselsDay } from './_stats-daily.js';
import { getSession, safeEqual } from './_session.js';

export const pages = [
  'overview',
  'pidgy',
  'games',
  'map',
  'music',
  'hunt',
  'x',
  'coffee',
  'private',
  'status'
];
// The first screen has its own small payload. Detail tables are projected only
// after a fresh session check, when the dashboard scrolls to that section.
const dashboardTables = [
  'outbound',
  'funnel',
  'links',
  'pidgy_out',
  'calls',
  'search',
  'terminal',
  'hours',
  'pages',
  'feathers',
  'referrers'
];
export const firstDay = '2026-11-02';
export const ttl = (page) => ({ x: 900, coffee: 1800, status: 60 })[page] || 60;
const timestamp = () => new Date().toISOString();
const key = (page, day) => `stats:snap:${page}:${day}`;
const memo = new Map();
export async function bounded(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('timeout')), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const publish = `
 if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
 redis.call('SET',KEYS[2],ARGV[2])
 if tonumber(ARGV[3])>0 then redis.call('EXPIRE',KEYS[2],ARGV[3]) end
 if ARGV[4]=='1' then redis.call('SET',KEYS[3],ARGV[2]);if tonumber(ARGV[5])>0 then redis.call('EXPIRE',KEYS[3],ARGV[5]) end end
 return 1`;
const release = "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end";
export async function build(
  page,
  day,
  { store = redis, makeTasks, shared = new Map(), force = false } = {}
) {
  const k = key(page, day),
    lock = k + ':lock',
    token = randomUUID();
  if (!(await store(['SET', lock, token, 'NX', 'EX', '55']))) return;
  try {
    const previous = JSON.parse(await store(['GET', k]));
    if (previous?.final || (!force && fresh(previous, page, day))) return;
    const tasks = (makeTasks || (await import('./_stats-build.js')).snapshotTasks)(page, day);
    const data = { ...previous?.data },
      dates = { ...previous?.dates },
      missing = new Set(Object.keys(tasks));
    const now = timestamp();
    let successes = 0;
    async function save() {
      const historic = day < brusselsDay();
      if (historic && page === 'overview') {
        delete data.coffee;
        delete data.uptime;
        delete data.votes;
        delete data.unpaid_days;
      }
      const snapshot = {
        page,
        day,
        data: { ...data },
        dates: { ...dates },
        missing: [...missing],
        updated: Object.values(dates).sort()[0] || now,
        checked: now,
        state: missing.size ? 'partial' : 'ready',
        final: historic && !missing.size
      };
      const personal = page === 'private' || page === 'x';
      const expiry = personal || page === 'status' ? 86400 : 0;
      if (
        await store([
          'EVAL',
          publish,
          '3',
          lock,
          k,
          key(page, 'last'),
          token,
          JSON.stringify(snapshot),
          String(expiry),
          historic ? '0' : '1',
          String(expiry)
        ])
      ) {
        memo.set(page, snapshot);
      }
    }
    const work = Promise.all(
      Object.entries(tasks).map(async ([name, run]) => {
        // Reuse identical day-level source queries across pages during a cron run.
        const sharedName =
          ['countries', 'feathers', 'terminal', 'counters'].includes(name) && page !== 'private'
            ? day + ':' + name
            : k + ':' + name;
        if (!shared.has(sharedName))
          shared.set(
            sharedName,
            bounded(Promise.resolve().then(run), page === 'coffee' || name === 'coffee' ? 23000 : 12000)
          );
        try {
          Object.assign(data, await shared.get(sharedName));
          dates[name] = now;
          missing.delete(name);
          successes++;
        } catch {
          /* Retain the previous value and its timestamp. */
        }
      })
    );
    // Publish early results while slower providers are still running. Each write
    // checks the same lease and is awaited before publishing the next version.
    for (const ms of [300, 1500]) {
      let timer;
      const complete = await Promise.race([
        work.then(() => true),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(false), ms);
        })
      ]);
      clearTimeout(timer);
      if (complete) break;
      if (successes && missing.size) await save();
    }
    await work;
    if (!successes) {
      await store([
        'EVAL',
        "if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('SET',KEYS[1],'retry','EX','10') end",
        '1',
        lock,
        token
      ]);
      return;
    }
    await save();
  } finally {
    await store(['EVAL', release, '1', lock, token]).catch(() => {});
  }
}
export function fresh(s, page, day) {
  if (!s || s.day !== day) return false;
  if (day < brusselsDay() && !s.final)
    return s.missing?.length && Date.now() - Date.parse(s.checked) < 15000;
  return s.final || Date.now() - Date.parse(s.checked) < (s.missing?.length ? 15 : ttl(page)) * 1000;
}
export async function serve(
  req,
  res,
  { store = redis, session = getSession, enqueue = waitUntil, refresh = build } = {}
) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  const page = req.query.page,
    today = brusselsDay(),
    day = req.query.day ?? today;
  if (
    !pages.includes(page) ||
    typeof day !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    day < firstDay ||
    day > today ||
    new Date(day + 'T12:00Z').toJSON()?.slice(0, 10) !== day
  )
    return res.status(400).json({ error: 'invalid page or day' });
  const priv = page === 'private';
  let user;
  if (priv) {
    res.setHeader('Vary', 'Cookie');
    try {
      user = await bounded(session(req), 800);
    } catch {
      return res.status(200).json({ page, day, state: 'unavailable', reason: 'storage', data: null });
    }
    if (!user) return res.status(200).json({ page, day, state: 'login', data: null });
  }
  const past = day < today;
  let snap,
    storageFailed = false,
    lock;
  try {
    const started = performance.now();
    const [raw, last, lease] = await bounded(
      store(['MGET', key(page, day), key(page, 'last'), key(page, day) + ':lock']),
      800
    );
    lock = lease;
    res.setHeader('Server-Timing', 'redis;dur=' + (performance.now() - started).toFixed(1));
    snap = JSON.parse(raw || (!past && last) || 'null');
    if (snap) memo.set(page, snap);
  } catch {
    storageFailed = true;
    const last = memo.get(page);
    if (
      last &&
      last.day === day &&
      Date.now() - Date.parse(last.checked) < (priv || page === 'x' ? 1 : 7) * 86400000
    )
      snap = last;
  }
  const historicalBuild = !past || ['overview', 'hunt'].includes(page);
  // As-of snapshots for cumulative pages cannot be reconstructed retroactively.
  const sealed = past && snap?.day === day && snap.state === 'ready' && !historicalBuild;
  const stale = !sealed && !fresh(snap, page, day);
  if (storageFailed && !snap && !priv && historicalBuild) {
    const { recover } = await import('./_stats-recovery.js');
    const result = await recover(page, day, enqueue);
    if (result.data)
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=60');
    const { dates, ...body } = result;
    return res.status(200).json(body);
  }
  if (!storageFailed && stale && historicalBuild && lock !== 'retry')
    enqueue(refresh(page, day).catch(() => {}));
  if (!snap)
    return res.status(200).json({
      page,
      day,
      state: historicalBuild && !storageFailed && lock !== 'retry' ? 'warming' : 'unavailable',
      reason: storageFailed
        ? 'storage'
        : lock === 'retry'
          ? 'source'
          : historicalBuild
            ? undefined
            : 'history',
      data: null,
      updated: null,
      ...(priv ? { viewer: user.email } : {})
    });
  if (!priv && snap.state !== 'partial')
    res.setHeader(
      'Cache-Control',
      past && (snap.final || sealed) && !['status', 'x'].includes(page)
        ? 'public, max-age=0, s-maxage=31536000, immutable'
        : 'public, max-age=0, s-maxage=30, stale-while-revalidate=300'
    );
  const { dates, ...publicFields } = snap;
  if (sealed && !['status', 'x', 'private'].includes(page)) publicFields.final = true;
  if (priv) {
    const part = req.query.part,
      payload = publicFields.data;
    if (part !== undefined && !dashboardTables.includes(part))
      return res.status(400).json({ error: 'invalid table' });
    if (part) publicFields.data = { [part]: payload[part] ?? null };
    else {
      publicFields.data = { tables: dashboardTables.filter((k) => Array.isArray(payload[k])) };
      for (const k of ['outbound', 'funnel']) if (payload[k]) publicFields.data[k] = payload[k];
      if (user.email.toLowerCase() === 'gabriel@corvus.gent')
        publicFields.data.funnelSF = payload.funnelSF;
    }
  }
  return res
    .status(200)
    .json({
      ...publicFields,
      stale: stale || storageFailed,
      ...(storageFailed
        ? { reason: 'storage' }
        : snap.state === 'partial'
          ? { reason: lock ? 'building' : 'source', working: !!lock && lock !== 'retry' }
          : {}),
      ...(priv ? { viewer: user.email } : {})
    });
}
export default serve;

export async function job(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (
    !process.env.CRON_SECRET ||
    !safeEqual(req.headers.authorization || '', 'Bearer ' + process.env.CRON_SECRET)
  )
    return res.status(401).json({ error: 'unauthorized' });
  const today = brusselsDay(),
    yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
  const work = async () => {
    const shared = new Map(),
      cursor = (await redis(['GET', 'stats:backfill'])) || firstDay;
    await Promise.all(pages.map((page) => build(page, today, { shared, force: true })));
    for (const day of new Set([yesterday, cursor]))
      if (day >= firstDay && day < today) {
        await Promise.all(['overview', 'hunt'].map((page) => build(page, day, { shared })));
      }
    if (cursor < today && JSON.parse(await redis(['GET', key('overview', cursor)]))?.final)
      await redis([
        'SET',
        'stats:backfill',
        new Date(Date.parse(cursor) + 86400000).toISOString().slice(0, 10)
      ]);
    await redis(['SET', 'stats:job:last', timestamp(), 'EX', '259200']);
  };
  enqueueJob(work());
  return res.status(202).json({ queued: true });
}
function enqueueJob(task) {
  waitUntil(task.catch(() => {}));
}
