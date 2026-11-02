// Public language vote.
import { redis, connected } from "./_redis.js";

function toObject(arr) {
  const o = {};
  for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = Number(arr[i + 1]);
  return o;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!connected()) return res.status(503).json({ error: "storage not connected" });
  try {
    if (req.method === "POST") {
      const code = String((req.body && req.body.lang) || "").toLowerCase();
      if (!/^[a-z]{2,3}$/.test(code)) return res.status(400).json({ error: "bad language" });
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
      const fresh = await redis(["SET", `voted:${ip}:${code}`, "1", "NX", "EX", "86400"]);
      if (fresh) await redis(["HINCRBY", "lang_votes", code, "1"]);
    }
    const votes = toObject(await redis(["HGETALL", "lang_votes"]));
    return res.status(200).json({ votes });
  } catch (e) {
    return res.status(500).json({ error: "storage error" });
  }
}
