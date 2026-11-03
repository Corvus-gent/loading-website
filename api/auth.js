// Email one-time-code login, only for @corvus.gent addresses.
import crypto from "node:crypto";
import { redis, connected } from "./_redis.js";
import { hash, safeEqual, getSession, createSession, destroySession } from "./_session.js";

const ORIGINS = ["https://corvus.gent", "https://www.corvus.gent", "https://stats.corvus.gent"];
const ip = req => (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
const isAllowed = e => /^[a-z0-9._%+-]+@corvus\.gent$/i.test(e);

async function limit(key, max, seconds) {
  const n = Number(await redis(["INCR", key]));
  if (n === 1) await redis(["EXPIRE", key, String(seconds)]);
  return n <= max;
}

async function sendCode(email, code) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.LOGIN_FROM || "corvus <login@corvus.gent>",
      to: [email],
      subject: `${code} is your corvus.gent code`,
      text: `Your code: ${code}\n\nValid for 10 minutes. If you didn't ask for this, ignore it.\n\n— the crow`,
    }),
  });
  if (!r.ok) throw new Error("mail failed");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!connected()) return res.status(503).json({ error: "storage not connected" });

  if (req.method === "GET") {
    const s = await getSession(req);
    return res.status(200).json({ email: s ? s.email : null });
  }
  if (req.method !== "POST") return res.status(405).end();
  if (!ORIGINS.includes(req.headers.origin || "")) return res.status(403).json({ error: "forbidden" });

  const { action, email: rawEmail, code } = req.body || {};
  const email = String(rawEmail || "").trim().toLowerCase();

  if (action === "logout") { await destroySession(req, res); return res.status(200).json({ ok: true }); }

  if (action === "request") {
    // same answer for every address, so nobody can probe which mailboxes exist
    const ok = { ok: true, message: "if that address is allowed, a code is on its way." };
    if (!isAllowed(email)) return res.status(200).json(ok);
    if (!(await limit(`otp:rl:ip:${hash(ip(req))}`, 10, 3600))) return res.status(429).json({ error: "slow down" });
    if (!(await limit(`otp:rl:mail:${hash(email)}`, 3, 900))) return res.status(429).json({ error: "slow down" });
    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await redis(["SET", `otp:${hash(email)}`, JSON.stringify({ h: hash(otp), tries: 0 }), "EX", "600"]);
    try { await sendCode(email, otp); } catch { return res.status(500).json({ error: "could not send" }); }
    return res.status(200).json(ok);
  }

  if (action === "verify") {
    if (!isAllowed(email) || !/^\d{6}$/.test(String(code || ""))) return res.status(400).json({ error: "wrong code" });
    const key = `otp:${hash(email)}`;
    const raw = await redis(["GET", key]);
    if (!raw) return res.status(400).json({ error: "code expired" });
    const rec = JSON.parse(raw);
    if (rec.tries >= 5) { await redis(["DEL", key]); return res.status(429).json({ error: "too many tries" }); }
    if (!safeEqual(rec.h, hash(String(code)))) {
      rec.tries++;
      await redis(["SET", key, JSON.stringify(rec), "KEEPTTL"]);
      return res.status(400).json({ error: "wrong code" });
    }
    await redis(["DEL", key]);
    await createSession(res, email);
    await redis(["LPUSH", "logins", JSON.stringify({ email, at: new Date().toISOString() })]);
    await redis(["LTRIM", "logins", "0", "99"]);
    return res.status(200).json({ ok: true, email });
  }
  return res.status(400).json({ error: "unknown action" });
}
