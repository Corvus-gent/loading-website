// Goodreads "request access": stores emails in Upstash Redis (no emails sent).
// Works with any prefix Vercel gives the Upstash vars (KV_, STORAGE_, UPSTASH_REDIS_ ...)
const envEnding = end => Object.entries(process.env).find(([k, v]) => k.endsWith(end) && !k.includes("READ_ONLY") && v)?.[1];
const URL_ = envEnding("_REST_API_URL") || envEnding("_REDIS_REST_URL");
const TOKEN = envEnding("_REST_API_TOKEN") || envEnding("_REDIS_REST_TOKEN");

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
