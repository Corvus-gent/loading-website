// Operator-only entry point: job() checks CRON_SECRET and requires POST.
// Return aggregate comparisons, never credentials, event rows or identities.
import { build, pages, firstDay } from './_stats-snap.js';
import { snapshotTasks } from './_stats-build.js';
import { brusselsDay } from './_stats-daily.js';
import { hogql, REAL } from './_posthog.js';
import { redis } from './_redis.js';
import { hostCategory } from '../js/analytics-policy.js';

export async function rebuildDay(day, {
  refresh = build, tasks = snapshotTasks, query = hogql, store = redis, today = brusselsDay()
} = {}) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < firstDay || day > today ||
      new Date(day + 'T12:00:00Z').toJSON()?.slice(0, 10) !== day) throw Error('invalid day');
  const started = Date.now();
  const historical = day < today;
  // Only the overview and hunt have reconstructible historical day projections.
  // Do not create fake old all-time rankings, health samples or provider totals.
  const selected = historical ? ['overview', 'hunt'] : pages;
  const shared = new Map();
  await Promise.all(selected.map(page => refresh(page, day, {
    force: true, shared,
    makeTasks: (p, d) => Object.fromEntries(Object.entries(tasks(p, d))
      .filter(([name]) => !historical || name !== 'counters'))
  })));
  // These are fresh independent PostHog requests, not reads of the snapshot cache.
  const scope = `${REAL} AND toDate(toTimeZone(timestamp,'Europe/Brussels'))=toDate('${day}')`;
  const [summary, hosts, raw, source] = await Promise.all([
    query(`SELECT count(DISTINCT if(event='$pageview',distinct_id,NULL)), countIf(event='$pageview'), countIf(event='outbound_click'), countIf(event='links_click'), countIf(event='short_link_out'), countIf(event='outbound_click' AND properties.host IN ('pidgy-ai.com','app.pidgy-ai.com')) FROM events WHERE ${scope}`),
    query(`SELECT properties.host, count() n FROM events WHERE event='outbound_click' AND ${scope} GROUP BY 1 ORDER BY n DESC LIMIT 5`),
    store(['MGET', ...selected.map(page => `stats:snap:${page}:${day}`)]),
    query(`SELECT countIf(event='$pageview' AND toDate(toTimeZone(timestamp,'Europe/Brussels'))=toDate('${day}')), maxIf(timestamp,event='$pageview') FROM events`)
  ]);
  if (!Array.isArray(summary[0]) || summary[0].length !== 6) throw Error('invalid source');
  const [visitors, pageviews, outboundClicks, linksClicks, shortLinkOut, pidgyClicks] = summary[0].map(Number);
  const snapshots = raw.map(value => JSON.parse(value || 'null'));
  const overview = snapshots[selected.indexOf('overview')];
  const normalize = rows => (rows || []).map(([host, n]) => [host, Number(n)])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
  const directHosts = hosts.map(([host, n]) => [hostCategory(host), Number(n)]);
  const publishedHosts = overview?.data?.outbound?.hosts;
  const result = {
    day, timezone: 'Europe/Brussels', checked_at: new Date().toISOString(),
    snapshots: selected.map((page, i) => ({ page, state: snapshots[i]?.state || 'missing',
      checked: snapshots[i]?.checked || null, refreshed: Date.parse(snapshots[i]?.checked) >= started,
      missing: snapshots[i]?.missing || [] })),
    direct: { visitors, pageviews, outboundClicks, linksClicks, shortLinkOut, pidgyClicks, hosts: directHosts },
    sourceCoverage: { projectPageviewsOnDay: Number(source[0]?.[0] || 0), lastProjectPageview: source[0]?.[1] || null },
    snapshot: { visitors: overview?.data?.visitors ?? null, hosts: publishedHosts ?? null },
    matches: { visitors: overview?.data?.visitors === visitors,
      visibleOutbound: Array.isArray(publishedHosts) && JSON.stringify(normalize(publishedHosts)) === JSON.stringify(normalize(directHosts)) },
    historicalRedisCountersReconstructed: false,
    skippedHistoricalPages: historical ? pages.filter(page => !selected.includes(page)) : []
  };
  await store(['SET', `stats:rebuild:${day}`, JSON.stringify(result), 'EX', '7776000']);
  return result;
}
