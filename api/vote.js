// Public language vote. Storage: Upstash Redis (Vercel Marketplace, free tier).
// Works with any prefix Vercel gives the Upstash vars (KV_, STORAGE_, UPSTASH_REDIS_ ...)
const envEnding = end => Object.entries(process.env).find(([k, v]) => k.endsWith(end) && !k.includes("READ_ONLY") && v)?.[1];
const URL_ = envEnding("_REST_API_URL") || envEnding("_REDIS_REST_URL");
const TOKEN = envEnding("_REST_API_TOKEN") || envEnding("_REDIS_REST_TOKEN");

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  return (await r.json()).result;
}

function toObject(arr) {
  const o = {};
  for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = Number(arr[i + 1]);
  return o;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(503).json({ error: "storage not connected" });

  if (req.method === "POST") {
    const code = String((req.body && req.body.lang) || "").toLowerCase();
    if (!/^[a-z]{2,3}$/.test(code)) return res.status(400).json({ error: "bad language" });
    // light abuse protection: one vote per IP per language per day
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
    const key = `voted:${ip}:${code}`;
    const fresh = await redis(["SET", key, "1", "NX", "EX", "86400"]);
    if (fresh) await redis(["HINCRBY", "lang_votes", code, "1"]);
  }
  const votes = toObject(await redis(["HGETALL", "lang_votes"]));
  return res.status(200).json({ votes });
}
