// Goodreads "request access": stores emails in Redis (no emails sent).
import { connected } from "./_redis.js";

import { ORIGINS, dailyIPHash, rateLimit, appendPrivateLog } from "./_privacy.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  if (!connected()) return res.status(503).json({ error: "storage not connected" });
  if (!ORIGINS.includes(req.headers.origin || "")) return res.status(403).json({ error: "forbidden" });
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "bad email" });
  try {
    if (!await rateLimit(`access:rate:${dailyIPHash(req, "access")}`, 5, 3600)) return res.status(429).json({ error: "slow down" });
    await appendPrivateLog("access", email);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "storage error" });
  }
}
