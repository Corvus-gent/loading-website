// Public stats per day (Brussels time). Past days cached a week, today five minutes.
import sections from "./_stats-sections.js";
import { redis, connected } from "./_redis.js";
import { hogql, posthogReady, REAL } from "./_posthog.js";

const FIRST = "2026-11-02";
const tzDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(d);

export default async function handler(req, res) {
  if(req.query.hack === "1") return (await import("./_hack/handler.js")).default(req,res);
  if(req.query.healthHistory==="1")return (await import('./_health-history.js')).default(req,res);
  if(req.query.health==="1")return (await import('./_health.js')).default(req,res);
  if(req.query.snapJob==="1")return (await import('./_stats-snap.js')).job(req,res);
  if(req.query.sf === "1") return (await import("./_sf.js")).default(req,res);
  if(req.query.hit === "1") return (await import("./_hit.js")).default(req,res);
  if(req.query.game === "1") return (await import("./_game.js")).default(req,res);
  if(req.query.section === "coffee") return (await import("./_coffee.js")).default(req,res);
  if(req.query.section) return sections(req,res);
  if(req.query.page)return (await import('./_stats-snap.js')).default(req,res);
  if (!connected() || !posthogReady()) return res.status(503).json({ error: "stats not connected yet" });
  const today = tzDay();
  let day = String((req.query && req.query.day) || today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < FIRST || day > today) day = today;
  res.setHeader("Cache-Control", day === today ? "public, max-age=60" : "public, max-age=86400");
  try {
    const key = `stats:v5:${day}`;
    let body = await redis(["GET", key]);
    if (!body) {
      const {dailyTasks,counters}=await import('./_stats-daily.js');
      const parts=await Promise.all([...Object.values(dailyTasks(day)).map(task=>task()),counters(day)]);
      const data=Object.assign({day,first:FIRST,today,updated:new Date().toISOString()},...parts);
      body = JSON.stringify(data);
      await redis(["SET", key, body, "EX", day === today ? "300" : String(7 * 86400)]);
    }
    return res.status(200).send(body);
  } catch {
    return res.status(500).json({ error: "stats error" });
  }
}
