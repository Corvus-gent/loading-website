// Easter egg: guess tomorrow's visitor count. Exact guess wins a gift.
import crypto from "node:crypto";
import { redis, connected } from "./_redis.js";

const ORIGINS = ["https://corvus.gent", "https://www.corvus.gent", "https://stats.corvus.gent"];
const tzDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(d);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  if (!connected()) return res.status(503).json({ error: "storage not connected" });
  if (!ORIGINS.includes(req.headers.origin || "")) return res.status(403).json({ error: "forbidden" });
  const { guess, email: rawEmail } = req.body || {};
  const email = String(rawEmail || "").trim().toLowerCase().slice(0, 200);
  const n = Number(guess);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "bad email" });
  if (!Number.isInteger(n) || n < 0 || n > 1000000) return res.status(400).json({ error: "bad guess" });
  const tomorrow = tzDay(new Date(Date.now() + 86400000));
  const ip = crypto.createHash("sha256").update((req.headers["x-forwarded-for"] || "").split(",")[0]).digest("hex").slice(0, 24);
  const c = Number(await redis(["INCR", `guess:rl:${ip}`]));
  if (c === 1) await redis(["EXPIRE", `guess:rl:${ip}`, "86400"]);
  if (c > 5) return res.status(429).json({ error: "enough guesses for today" });
  const first = await redis(["HSETNX", `guesses:${tomorrow}`, email, JSON.stringify({ guess: n, at: new Date().toISOString() })]);
  if (!Number(first)) return res.status(409).json({ error: "you already guessed for this day" });
  await redis(["SADD", "guess_days", tomorrow]);
  return res.status(200).json({ ok: true, day: tomorrow });
}
