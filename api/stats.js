import {category, sourceCategory, pathCategory, countryCategory, BROWSERS, COMMANDS} from '../js/analytics-policy.js';
// Public stats per day (Brussels time). Past days cached a week, today five minutes.
import sections from "./_stats-sections.js";
import { redis, connected } from "./_redis.js";
import { hogql, posthogReady, REAL } from "./_posthog.js";

const FIRST = "2026-11-02";
const tzDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(d);

function group(rows, key, label) {
  const totals = new Map();
  for (const [raw, n] of rows) if (Number.isSafeInteger(Number(n)) && Number(n) >= 0) {
    const value = label(raw); totals.set(value, (totals.get(value) || 0) + Number(n));
  }
  return [...totals].map(([value,n])=>({[key]:value,n})).sort((a,b)=>b.n-a.n);
}

async function compute(day) {
  const inDay = `toDate(toTimeZone(timestamp, 'Europe/Brussels')) = toDate('${day}')`;
  const pv = `event = '$pageview' AND ${REAL} AND ${inDay}`;
  const [[visitors]] = await hogql(`SELECT count(DISTINCT distinct_id) FROM events WHERE ${pv}`);
  const [[total]] = await hogql(`SELECT sum(c) FROM (SELECT count(DISTINCT distinct_id) c FROM events WHERE event = '$pageview' AND ${REAL} AND toDate(toTimeZone(timestamp, 'Europe/Brussels')) <= toDate('${day}') GROUP BY toDate(toTimeZone(timestamp, 'Europe/Brussels')))`);
  const hours = await hogql(`SELECT toHour(toTimeZone(timestamp, 'Europe/Brussels')) h, count(DISTINCT distinct_id) n FROM events WHERE ${pv} GROUP BY h ORDER BY h`);
  const countries = await hogql(`SELECT coalesce(nullIf(properties.corvus_country_code, ''), nullIf(properties.$geoip_country_code, ''), nullIf(properties.$geoip_country_name, ''), '?') c, count(DISTINCT distinct_id) n FROM events WHERE ${pv} GROUP BY c ORDER BY n DESC, c ASC LIMIT 300`);
  const sources = await hogql(`SELECT multiIf(properties.links_source IS NOT NULL, properties.links_source, properties.utm_source IS NOT NULL, properties.utm_source, properties.$referring_domain LIKE '%instagram%', 'instagram', properties.$referring_domain LIKE '%linkedin%' OR properties.$referring_domain = 'lnkd.in', 'linkedin', properties.$referring_domain LIKE '%tiktok%', 'tiktok', properties.$referring_domain LIKE '%facebook%', 'facebook', properties.$referring_domain LIKE '%discord%', 'discord', properties.$referring_domain IN ('t.co', 'x.com', 'twitter.com'), 'x', properties.$referring_domain IN ('$direct', '') OR properties.$referring_domain IS NULL, 'direct', properties.$referring_domain) s, count() n FROM events WHERE ${pv} AND coalesce(properties.$referring_domain, '') NOT LIKE '%corvus.gent' GROUP BY s ORDER BY n DESC LIMIT 6`);
  const browsers = await hogql(`SELECT coalesce(properties.$browser, '?') b, count(DISTINCT distinct_id) n FROM events WHERE ${pv} GROUP BY b ORDER BY n DESC LIMIT 6`);
  const pages = await hogql(`SELECT properties.$pathname p, count() n FROM events WHERE ${pv} GROUP BY p ORDER BY n DESC LIMIT 5`);
  const [[feathers, hunters]] = await hogql(`SELECT count(), count(DISTINCT distinct_id) FROM events WHERE event = 'feather_found' AND ${REAL} AND ${inDay}`);
  const terminal = await hogql(`SELECT properties.command c, count() n FROM events WHERE event = 'terminal_command' AND ${REAL} AND ${inDay} GROUP BY c ORDER BY n DESC LIMIT 3`);
  return {
    day, first: FIRST, today: tzDay(), visitors, total: Number(total || 0),
    hours: hours.map(([h, n]) => ({ h, n })),
    countries: group(countries, "c", countryCategory),
    sources: group(sources, "s", sourceCategory),
    pages: group(pages, "p", pathCategory),
    browsers: group(browsers, "b", value => category(value, BROWSERS, "Other")),
    feathers, hunters,
    terminal: group(terminal, "c", value => category(value, COMMANDS, "unknown")),
    updated: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if(req.query.sf === "1") return (await import("./_sf.js")).default(req,res);
  if(req.query.hit === "1") return (await import("./_hit.js")).default(req,res);
  if(req.query.game === "1") return (await import("./_game.js")).default(req,res);
  if(req.query.section) return sections(req,res);
  if (!connected() || !posthogReady()) return res.status(503).json({ error: "stats not connected yet" });
  const today = tzDay();
  let day = String((req.query && req.query.day) || today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < FIRST || day > today) day = today;
  res.setHeader("Cache-Control", day === today ? "public, max-age=60" : "public, max-age=86400");
  try {
    const key = `stats:v5:${day}`;
    let body = await redis(["GET", key]);
    if (!body) {
      const data = await compute(day);
      const [o, dl, oT, dlT] = await Promise.all([`cv:open:${day}`, `cv:download:${day}`, "cv:open", "cv:download"].map(k => redis(["GET", k])));
      const toObj = a => { const o = {}; for (let i = 0; i < (a || []).length; i += 2) o[a[i]] = Number(a[i + 1]); return o; };
      data.cli = { day: toObj(await redis(["HGETALL", `cli:${day}`])), all: toObj(await redis(["HGETALL", "cli:all"])) };
      data.cv = { open: Number(o || 0), download: Number(dl || 0), openTotal: Number(oT || 0), downloadTotal: Number(dlT || 0) };
      if (day === today) {
        const raw = (await redis(["HGETALL", "lang_votes"])) || [];
        data.votes = {};
        for (let i = 0; i < raw.length; i += 2) data.votes[raw[i]] = Number(raw[i + 1]);
        data.unpaid_days = Math.floor((Date.now() - Date.parse("2026-10-15T12:40:00Z")) / 86400000);
      }
      body = JSON.stringify(data);
      await redis(["SET", key, body, "EX", day === today ? "300" : String(7 * 86400)]);
    }
    return res.status(200).send(body);
  } catch {
    return res.status(500).json({ error: "stats error" });
  }
}
