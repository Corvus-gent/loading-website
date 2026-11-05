// Easter egg: guess tomorrow's visitor count. Exact guess wins a gift.
import { dailyIPHash, rateLimit, LOG_RETENTION, DAY } from "./_privacy.js";
import { redis, connected } from "./_redis.js";

const ORIGINS = ["https://corvus.gent", "https://www.corvus.gent", "https://stats.corvus.gent"];
const tzDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(d);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  if (!connected()) return res.status(503).json({ error: "storage not connected" });
  if (!ORIGINS.includes(req.headers.origin || "")) return res.status(403).json({ error: "forbidden" });
  const { guess, email: rawEmail } = req.body || {};
  const email = String(rawEmail || "").trim().toLowerCase();
  const n = Number(guess);
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "bad email" });
  if (!Number.isInteger(n) || n < 0 || n > 1000000) return res.status(400).json({ error: "bad guess" });
  const tomorrow = tzDay(new Date(Date.now() + 86400000));
  if (!await rateLimit(`guess:rl:${dailyIPHash(req, 'guess')}`, 5, DAY)) return res.status(429).json({ error: "enough guesses for today" });
  // Fixed expiry per contest day: later guesses cannot extend earlier emails.
  const expires = Math.floor(Date.parse(tomorrow) / 1000) + LOG_RETENTION - DAY - 2 * 3600;
  const script = `local first=redis.call('HSETNX',KEYS[1],ARGV[1],ARGV[2]); redis.call('EXPIREAT',KEYS[1],ARGV[3]);
redis.call('SADD',KEYS[2],ARGV[4]); redis.call('EXPIRE',KEYS[2],ARGV[5]);
for _,d in ipairs(redis.call('SMEMBERS',KEYS[2])) do if d<ARGV[6] then redis.call('SREM',KEYS[2],d) end end; return first`;
  const first = await redis(['EVAL', script, '2', `guesses:${tomorrow}`, 'guess_days', email,
    JSON.stringify({ guess: n, at: new Date().toISOString() }), String(expires), tomorrow, String(LOG_RETENTION),
    new Date(Date.now() - LOG_RETENTION * 1000).toISOString().slice(0, 10)]);
  if (!Number(first)) return res.status(409).json({ error: "you already guessed for this day" });
  return res.status(200).json({ ok: true, day: tomorrow });
}
