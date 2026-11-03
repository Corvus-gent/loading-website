// Public stats, cached for an hour.
import { redis, connected } from "./_redis.js";
import { hogql, posthogReady, REAL } from "./_posthog.js";

async function compute() {
  const pv = `event = '$pageview' AND ${REAL}`;
  const [[today]] = await hogql(`SELECT count(DISTINCT distinct_id) FROM events WHERE ${pv} AND timestamp >= toStartOfDay(now('Europe/Brussels'))`);
  const daily = await hogql(`SELECT toDate(toTimeZone(timestamp, 'Europe/Brussels')) d, count(DISTINCT distinct_id) FROM events WHERE ${pv} GROUP BY d ORDER BY d`);
  const countries = await hogql(`SELECT coalesce(properties.$geoip_country_name, '?') c, count(DISTINCT distinct_id) n FROM events WHERE ${pv} GROUP BY c ORDER BY n DESC LIMIT 6`);
  const sources = await hogql(`SELECT coalesce(properties.links_source, properties.utm_source, nullIf(properties.$referring_domain, '$direct'), 'direct') s, count() n FROM events WHERE ${pv} GROUP BY s ORDER BY n DESC LIMIT 5`);
  const pages = await hogql(`SELECT properties.$pathname p, count() n FROM events WHERE ${pv} GROUP BY p ORDER BY n DESC LIMIT 5`);
  const [[feathers, hunters]] = await hogql(`SELECT count(), count(DISTINCT distinct_id) FROM events WHERE event = 'feather_found' AND ${REAL}`);
  const terminal = await hogql(`SELECT properties.command c, count() n FROM events WHERE event = 'terminal_command' AND ${REAL} GROUP BY c ORDER BY n DESC LIMIT 3`);
  const votesRaw = await redis(["HGETALL", "lang_votes"]);
  const votes = {};
  for (let i = 0; i < (votesRaw || []).length; i += 2) votes[votesRaw[i]] = Number(votesRaw[i + 1]);
  return {
    today, total: daily.reduce((a, r) => a + Number(r[1]), 0),
    daily: daily.map(([d, n]) => ({ d, n })),
    countries: countries.map(([c, n]) => ({ c, n })),
    sources: sources.map(([s, n]) => ({ s, n })),
    pages: pages.map(([p, n]) => ({ p, n })),
    feathers, hunters,
    terminal: terminal.map(([c, n]) => ({ c, n })),
    votes,
    unpaid_days: Math.floor((Date.now() - Date.parse("2026-10-15T12:40:00Z")) / 86400000),
    updated: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  if (!connected() || !posthogReady()) return res.status(503).json({ error: "stats not connected yet" });
  try {
    const cached = await redis(["GET", "stats:public"]);
    if (cached) return res.status(200).send(cached);
    const body = JSON.stringify(await compute());
    await redis(["SET", "stats:public", body, "EX", "3600"]);
    return res.status(200).send(body);
  } catch {
    return res.status(500).json({ error: "stats error" });
  }
}
