// Goodreads "request access": stores emails in Upstash Redis (no emails sent).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!URL_ || !TOKEN) return res.status(503).json({ error: "storage not connected" });
  const email = String((req.body && req.body.email) || "").trim().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "bad email" });
  const entry = JSON.stringify({ email, at: new Date().toISOString() });
  await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(["LPUSH", "access_requests", entry]),
  });
  return res.status(200).json({ ok: true });
}
