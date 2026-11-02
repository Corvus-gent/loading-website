// Goodreads "request access": stores emails in Redis (no emails sent).
import { redis, connected } from "./_redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!connected()) return res.status(503).json({ error: "storage not connected" });
  const email = String((req.body && req.body.email) || "").trim().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "bad email" });
  try {
    await redis(["LPUSH", "access_requests", JSON.stringify({ email, at: new Date().toISOString() })]);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "storage error" });
  }
}
