// Email one-time-code login, only for @corvus.gent addresses.
import crypto from "node:crypto";
import { redis, connected } from "./_redis.js";
import { hash, getSession, createSession, destroySession } from "./_session.js";

import { ORIGINS, dailyIPHash, rateLimit as limit, appendPrivateLog } from "./_privacy.js";
const isAllowed = e => e.length <= 254 && /^[a-z0-9._%+-]+@corvus\.gent$/i.test(e);

async function sendCode(email, code) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.LOGIN_FROM || "corvus <login@corvus.gent>",
      to: [email],
      subject: `${code} is your corvus.gent code`,
      text: `Your code: ${code}\n\nValid for 3 minutes. If you didn't ask for this, ignore it.\n\n— the crow`,
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
    if (!(await limit(`otp:rl:ip:${dailyIPHash(req, "login")}`, 10, 3600))) return res.status(429).json({ error: "slow down" });
    if (!(await limit(`otp:rl:mail:${hash(email)}`, 3, 900))) return res.status(429).json({ error: "slow down" });
    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await redis(["SET", `otp:${hash(email)}`, JSON.stringify({ h: hash(otp), tries: 0 }), "EX", "180"]);
    try { await sendCode(email, otp); } catch { return res.status(500).json({ error: "could not send" }); }
    return res.status(200).json(ok);
  }

  if (action === "verify") {
    if (!isAllowed(email) || !/^\d{6}$/.test(String(code || ""))) return res.status(400).json({ error: "wrong code" });
    const key = `otp:${hash(email)}`;
    // One transaction: a code cannot be reused or recreated after its expiry.
    const verify = `local raw=redis.call('GET',KEYS[1]); if not raw then return -2 end
local ttl=redis.call('PTTL',KEYS[1]); if ttl<=0 then redis.call('DEL',KEYS[1]); return -2 end
local r=cjson.decode(raw); if r.tries>=3 then redis.call('DEL',KEYS[1]); return -1 end
if r.h==ARGV[1] then redis.call('DEL',KEYS[1]); return 1 end
r.tries=r.tries+1
if r.tries>=3 then redis.call('DEL',KEYS[1]) else redis.call('SET',KEYS[1],cjson.encode(r),'PX',ttl) end
return 0`;
    const result = Number(await redis(['EVAL', verify, '1', key, hash(String(code))]));
    if (result !== 1) return res.status(result === -1 ? 429 : 400).json({ error: result === -2 ? 'code expired' : result === -1 ? 'too many tries' : 'wrong code' });
    await createSession(res, email);
    await appendPrivateLog("logins", email);
    return res.status(200).json({ ok: true, email });
  }
  return res.status(400).json({ error: "unknown action" });
}
