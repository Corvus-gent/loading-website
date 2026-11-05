// Private stats, only with a valid @corvus.gent session. Cached 10 minutes.
import { redis, connected } from "./_redis.js";
import { hogql, posthogReady, REAL } from "./_posthog.js";
import { getSession } from "./_session.js";
import { privateLogs } from "./_privacy.js";

export const privateTasks=()=>({
  outbound: async()=>({outbound:await hogql(`SELECT properties.path, properties.host, properties.href, count() n FROM events WHERE event='outbound_click' AND ${REAL} GROUP BY 1,2,3 ORDER BY n DESC LIMIT 100`)}),
  funnel: async()=>({funnel:await hogql(`SELECT properties.links_source s, properties.links_campaign c, countIf(event = '$pageview') views, countIf(event = 'links_click') clicks, countIf(event = 'links_click' AND properties.link IN ('pidgy', 'pidgy-trial')) pidgy, countIf(event = 'links_click' AND properties.link = 'pidgy-trial') trial, countIf(event = 'links_qr_open') qr FROM events WHERE properties.links_source IS NOT NULL AND ${REAL} GROUP BY s, c ORDER BY views DESC LIMIT 40`)}),
  links: async()=>({links:await hogql(`SELECT properties.link l, count() n FROM events WHERE event = 'links_click' AND ${REAL} GROUP BY l ORDER BY n DESC`)}),
  pidgy_out: async()=>({pidgy_out:await hogql(`SELECT properties.source s, properties.campaign c, count() n FROM events WHERE event = 'short_link_out' AND ${REAL} GROUP BY s, c ORDER BY n DESC LIMIT 20`)}),
  calls: async()=>({calls:await hogql(`SELECT properties.$current_url u, count() n FROM events WHERE event = 'link_click' AND (properties.link_href LIKE '%pidgy-ai.com/portal/booking%' OR properties.link_href LIKE '%pidgy-ai.com/book/gabe-maxxer/%' OR properties.link_href LIKE '%buymeacoffee%') AND ${REAL} GROUP BY u ORDER BY n DESC LIMIT 10`)}),
  search: async()=>({search:await hogql(`SELECT 'searches', count() FROM events WHERE event = 'site_search' AND ${REAL}`)}),
  terminal: async()=>({terminal:await hogql(`SELECT properties.command c, count() n FROM events WHERE event = 'terminal_command' AND ${REAL} GROUP BY c ORDER BY n DESC LIMIT 25`)}),
  hours: async()=>({hours:await hogql(`SELECT toHour(toTimeZone(timestamp, 'Europe/Brussels')) h, count() n FROM events WHERE event = '$pageview' AND ${REAL} GROUP BY h ORDER BY h`)}),
  pages: async()=>({pages:await hogql(`SELECT properties.$pathname p, count() n, count(DISTINCT distinct_id) v FROM events WHERE event = '$pageview' AND ${REAL} GROUP BY p ORDER BY n DESC LIMIT 25`)}),
  feathers: async()=>({feathers:await hogql(`SELECT properties.id f, count() n FROM events WHERE event = 'feather_found' AND ${REAL} GROUP BY f ORDER BY n DESC`)}),
  referrers: async()=>({referrers:await hogql(`SELECT properties.$referring_domain r, count() n FROM events WHERE event = '$pageview' AND ${REAL} GROUP BY r ORDER BY n DESC LIMIT 15`)}),
});
async function compute(){return Object.assign({updated:new Date().toISOString()},...await Promise.all(Object.values(privateTasks()).map(task=>task())));}
async function personalRecords() {
  const out = { access_requests: await privateLogs('access'), logins: await privateLogs('logins') };
  const days = (await redis(["SMEMBERS", "guess_days"])) || [];
  out.guesses = [];
  for (const d of days.sort()) {
    const raw = (await redis(["HGETALL", `guesses:${d}`])) || [];
    for (let i = 0; i < raw.length; i += 2) { const g = JSON.parse(raw[i + 1]); out.guesses.push({ day: d, email: raw[i], guess: g.guess }); }
  }
  out.updated = new Date().toISOString();
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!connected()) return res.status(503).json({ error: "storage not connected" });
  const s = await getSession(req);
  if (!s) return res.status(401).json({ error: "login required" });
  if(req.query?.records==='1')return res.status(200).json(await personalRecords());
  if (!posthogReady()) return res.status(503).json({ error: "posthog not connected yet" });
  try {
    const cached = await redis(["GET", "stats:private:v2"]);
    const aggregate = cached ? JSON.parse(cached) : await compute();
    if (!cached) await redis(["SET", "stats:private:v2", JSON.stringify(aggregate), "EX", "600"]);
    return res.status(200).json({ ...aggregate, ...await personalRecords() });
  } catch {
    return res.status(500).json({ error: "stats error" });
  }
}
