// A storage outage must not hide aggregates from independent, healthy providers.
// Only these public projections may enter the regional fallback cache.
import { getCache } from '@vercel/functions';
import { snapshotTasks } from './_stats-build.js';
import { bounded, ttl } from './_stats-snap.js';
import { xReady } from './x-stats.js';

const regional = getCache({ namespace: 'corvus-gent-public-stats-recovery-v1' });
const active = new Map(),
  recent = new Map();
const eligible = {
  overview: [
    'visitors',
    'total',
    'hours',
    'countries',
    'sources',
    'browsers',
    'pages',
    'feathers',
    'terminal',
    'outbound'
  ],
  hunt: ['feathers', 'terminal'],
  map: ['cities', 'countries', 'tiles'],
  pidgy: ['crossings', 'signups'],
  music: ['genres'],
  coffee: ['coffee']
};

async function liveStatus() {
  const { default: health } = await import('./_health.js');
  const writer = {
    setHeader() {},
    status() {
      return this;
    },
    json(value) {
      return value;
    }
  };
  const sample = await health({ method: 'GET', query: {}, headers: {} }, writer);
  if (!sample?.checks) throw Error('health unavailable');
  return {
    status: sample.status,
    checked_at: sample.checked_at,
    liveOnly: true,
    checks: Object.entries(sample.checks).map(([name, c]) => ({
      name,
      ok: c.ok,
      skipped: c.skipped,
      ms: c.ms
    }))
  };
}
function tasksFor(page, day) {
  if (page === 'status') return { health: liveStatus };
  if (page === 'x' && !xReady()) return { log: () => ({ ready: false }) };
  const names = eligible[page];
  if (!names) return {};
  const tasks = snapshotTasks(page, day);
  return Object.fromEntries(names.map((name) => [name, tasks[name]]));
}

export async function recover(page, day, enqueue, { cache = regional, tasks = tasksFor } = {}) {
  const base = { page, day, reason: 'storage', data: null, updated: null, final: false };
  // Never use a public fallback for sessions, personal records or historic all-time totals.
  if (page === 'private') return { ...base, state: 'unavailable' };
  const sources = tasks(page, day);
  if (!Object.keys(sources).length) return { ...base, state: 'unavailable' };

  const key = page + ':' + day;
  let old = recent.get(key);
  if (old && Date.now()-Date.parse(old.checked)>86400000){recent.delete(key);old=null;}
  if (!old || Date.now() - Date.parse(old.checked) > ttl(page) * 1000) {
    const stored = await bounded(cache.get(key), 400).catch(() => null);
    if (stored?.day === day && stored.page === page && (!old || stored.checked > old.checked))
      old = stored;
  }
  if (old && Date.now() - Date.parse(old.checked) < (old.data ? ttl(page) : 20) * 1000) return old;
  if (!active.has(key) && active.size < 4) {
    const refresh = async () => {
      const data = { ...old?.data },
        dates = { ...old?.dates },
        missing = [];
      await Promise.all(
        Object.entries(sources).map(async ([name, run]) => {
          try {
            const part = await bounded(Promise.resolve().then(run), (name === 'coffee' || page === 'coffee') ? 23000 : 11000);
            Object.assign(data, part);
            dates[name] = new Date().toISOString();
          } catch {
            missing.push(name);
          }
        })
      );
      const hasData = Object.keys(data).length > 0;
      const result = {
        ...base,
        state: hasData ? 'partial' : 'unavailable',
        data: hasData ? data : null,
        reason: missing.length ? 'storage-and-source' : 'storage',
        checked: new Date().toISOString(),
        updated: Object.values(dates).sort()[0] || null,
        dates,
        missing
      };
      if (recent.size >= 64 && !recent.has(key)) recent.delete(recent.keys().next().value);
      recent.set(key, result);
      await bounded(cache.set(key, result, { ttl: hasData ? 86400 : 20 }), 800).catch(() => {});
    };
    const work = refresh().finally(() => active.delete(key));
    active.set(key, work);
    enqueue(work.catch(() => {}));
  }
  return old?.data ? { ...old, stale: true } : { ...base, state: 'warming' };
}
