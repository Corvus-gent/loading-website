import {
  category,
  sourceCategory,
  pathCategory,
  countryCategory,
  BROWSERS,
  COMMANDS
} from '../js/analytics-policy.js';
import { hogql, REAL } from './_posthog.js';
import { pipeline } from './_redis.js';
export const brusselsDay = (date = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(date);
function group(rows, key, label) {
  const totals = new Map();
  for (const [raw, n] of rows)
    if (Number.isSafeInteger(Number(n)) && Number(n) >= 0) {
      const value = label(raw);
      totals.set(value, (totals.get(value) || 0) + Number(n));
    }
  return [...totals].map(([value, n]) => ({ [key]: value, n })).sort((a, b) => b.n - a.n);
}

export function dailyTasks(day, query = hogql) {
  const inDay = `toDate(toTimeZone(timestamp, 'Europe/Brussels')) = toDate('${day}')`;
  const pv = `event = '$pageview' AND ${REAL} AND ${inDay}`;
  const tasks = {};
  tasks.visitors = () =>
    query(`SELECT count(DISTINCT distinct_id) FROM events WHERE ${pv}`).then((rows) => ({
      visitors: Number(rows[0][0])
    }));
  tasks.total = () =>
    query(
      `SELECT sum(c) FROM (SELECT count(DISTINCT distinct_id) c FROM events WHERE event = '$pageview' AND ${REAL} AND toDate(toTimeZone(timestamp, 'Europe/Brussels')) <= toDate('${day}') GROUP BY toDate(toTimeZone(timestamp, 'Europe/Brussels')))`
    ).then((rows) => ({ total: Number(rows[0][0] || 0) }));
  tasks.hours = () =>
    query(
      `SELECT toHour(toTimeZone(timestamp, 'Europe/Brussels')) h, count(DISTINCT distinct_id) n FROM events WHERE ${pv} GROUP BY h ORDER BY h`
    ).then((rows) => ({ hours: rows.map(([h, n]) => ({ h, n })) }));
  tasks.countries = () =>
    query(
      `SELECT coalesce(nullIf(properties.corvus_country_code, ''), nullIf(properties.$geoip_country_code, ''), nullIf(properties.$geoip_country_name, ''), '?') c, count(DISTINCT distinct_id) n FROM events WHERE ${pv} GROUP BY c ORDER BY n DESC, c ASC LIMIT 300`
    ).then((rows) => ({ countries: group(rows, 'c', countryCategory) }));
  tasks.sources = () =>
    query(
      `SELECT multiIf(properties.links_source IS NOT NULL, properties.links_source, properties.utm_source IS NOT NULL, properties.utm_source, properties.$referring_domain LIKE '%instagram%', 'instagram', properties.$referring_domain LIKE '%linkedin%' OR properties.$referring_domain = 'lnkd.in', 'linkedin', properties.$referring_domain LIKE '%tiktok%', 'tiktok', properties.$referring_domain LIKE '%facebook%', 'facebook', properties.$referring_domain LIKE '%discord%', 'discord', properties.$referring_domain IN ('t.co', 'x.com', 'twitter.com'), 'x', properties.$referring_domain IN ('$direct', '') OR properties.$referring_domain IS NULL, 'direct', properties.$referring_domain) s, count() n FROM events WHERE ${pv} AND coalesce(properties.$referring_domain, '') NOT LIKE '%corvus.gent' GROUP BY s ORDER BY n DESC LIMIT 6`
    ).then((rows) => ({ sources: group(rows, 's', sourceCategory) }));
  tasks.browsers = () =>
    query(
      `SELECT coalesce(properties.$browser, '?') b, count(DISTINCT distinct_id) n FROM events WHERE ${pv} GROUP BY b ORDER BY n DESC LIMIT 6`
    ).then((rows) => ({ browsers: group(rows, 'b', (v) => category(v, BROWSERS, 'Other')) }));
  tasks.pages = () =>
    query(
      `SELECT properties.$pathname p, count() n FROM events WHERE ${pv} GROUP BY p ORDER BY n DESC LIMIT 5`
    ).then((rows) => ({ pages: group(rows, 'p', pathCategory) }));
  tasks.feathers = () =>
    query(
      `SELECT count(), count(DISTINCT distinct_id) FROM events WHERE event = 'feather_found' AND ${REAL} AND ${inDay}`
    ).then((rows) => ({ feathers: rows[0][0], hunters: rows[0][1] }));
  tasks.terminal = () =>
    query(
      `SELECT properties.command c, count() n FROM events WHERE event = 'terminal_command' AND ${REAL} AND ${inDay} GROUP BY c ORDER BY n DESC LIMIT 3`
    ).then((rows) => ({ terminal: group(rows, 'c', (v) => category(v, COMMANDS, 'unknown')) }));
  return tasks;
}

export async function counters(day) {
  const isToday = day === brusselsDay();
  const cmds = [
    ['GET', 'cv:open:' + day],
    ['GET', 'cv:download:' + day],
    ['GET', 'cv:open'],
    ['GET', 'cv:download'],
    ['HGETALL', 'cli:' + day],
    ['HGETALL', 'cli:all']
  ];
  if (isToday) cmds.push(['HGETALL', 'lang_votes']);
  const [open, download, openTotal, downloadTotal, daily, all, votes] = await pipeline(cmds);
  const result = {
    cv: {
      open: Number(open),
      download: Number(download),
      openTotal: Number(openTotal),
      downloadTotal: Number(downloadTotal)
    },
    cli: { day: pairs(daily), all: pairs(all) }
  };
  if (isToday) {
    result.votes = pairs(votes);
    result.unpaid_days = Math.floor((Date.now() - Date.parse('2026-10-15T12:40:00Z')) / 86400000);
  }
  return result;
}
export const pairs = (raw) =>
  Object.fromEntries(
    Array.from({ length: (raw || []).length / 2 }, (_, i) => [raw[2 * i], Number(raw[2 * i + 1])])
  );
