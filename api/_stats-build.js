import { dailyTasks, counters, brusselsDay } from './_stats-daily.js';
import { sectionTasks } from './_stats-sections.js';
import { redis } from './_redis.js';
import { hogql } from './_posthog.js';
import { GEO_QUERY, cityRows } from './geo.js';
import { loadTracks, suggestions } from './_music-store.js';
import { privateTasks } from './private-stats.js';
import { SF_FUNNEL_SQL } from './_sf.js';
import xHandler, { xReady } from './x-stats.js';
import coffeeHandler from './_coffee.js';

// Reuse the provider adapters and their existing privacy boundaries/caches.
async function fromHandler(handler) {
  const res = {
    code: 200,
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(value) {
      if (this.code >= 400) throw Error('source unavailable');
      return value;
    }
  };
  return handler({ method: 'GET', query: {}, headers: {} }, res);
}
async function publicX() {
  if (!xReady()) return { ready: false };
  const body = await fromHandler(xHandler);
  if (!body.all || body.stale) throw Error('x sync pending');
  return body;
}
async function topMusic() {
  const [{ tracks }, list, scores] = await Promise.all([
    loadTracks(),
    suggestions(),
    redis(['ZRANGE', 'music:votes', '0', '-1', 'WITHSCORES'])
  ]);
  const votes = new Map();
  for (let i = 0; i < scores.length; i += 2) votes.set(scores[i], Number(scores[i + 1]));
  return {
    loved: tracks
      .map((t) => [t.title + ' · ' + t.artist, votes.get(t.id) || 0])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    suggestions: list
      .slice(-10)
      .reverse()
      .map((t) => [t.title + ' · ' + t.artist, ''])
  };
}
export function snapshotTasks(page, day) {
  const daily = dailyTasks(day);
  if (page === 'overview') {
    const tasks = {
      ...daily,
      counters: () => counters(day),
      outbound: async () => ({ outbound: await sectionTasks('outbound', day).outbound() })
    };
    if (day === brusselsDay()) {
      tasks.coffee = async () => ({ coffee: await fromHandler(coffeeHandler) });
      tasks.uptime = async () => ({
        uptime: JSON.parse(await redis(['GET', 'health:summary']))?.uptime ?? null
      });
    }
    return tasks;
  }
  if (page === 'hunt')
    return { feathers: daily.feathers, terminal: daily.terminal, counters: () => counters(day) };
  if (page === 'map')
    return {
      countries: daily.countries,
      cities: async () => ({ cities: cityRows(await hogql(GEO_QUERY)) }),
      tiles: () => ({ tiles: !!process.env.CARTO_BASEMAPS_KEY })
    };
  if (page === 'music') return { ...sectionTasks('music', day), songs: topMusic };
  if (page === 'games' || page === 'pidgy') return sectionTasks(page, day);
  if (page === 'coffee') return { coffee: () => fromHandler(coffeeHandler) };
  if (page === 'x') return { log: publicX };
  if (page === 'private')
    return {
      ...privateTasks(),
      funnelSF: async () => ({ funnelSF: Object.fromEntries(await hogql(SF_FUNNEL_SQL)) })
    };
  if (page === 'status')
    return {
      history: async () => {
        const { history } = await import('./_health-history.js');
        const h = await history();
        await redis(['SET', 'health:summary', JSON.stringify({ uptime: h.uptime[2] }), 'EX', '2592000']);
        // Keep existing overview / snapshot consumers on their small, original projection.
        return {
          status: h.status,
          checked_at: h.checked_at,
          uptime: h.uptime[2],
          checks: h.checks.map((c) => ({
            name: c.name,
            ok: c.state ? c.state < 3 : null,
            skipped: !c.state,
            days: c.days.slice(-30).map((d) => ['unknown', 'ok', 'degraded', 'down'][d?.[0] || 0]),
            uptime: c.uptime.slice(0, 3),
            average: c.average,
            lastIncident: c.lastIncident
          }))
        };
      }
    };
  throw Error('unknown snapshot');
}
