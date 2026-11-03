// Song suggestions + votes for /music.
// Same protection as the language vote: signed voter cookie, one-time proof-of-work
// challenge, origin check, per-IP limits. Only Spotify track IDs are stored; the title
// comes from Spotify's own oEmbed, so there is no free text from visitors.
import crypto from "node:crypto";
import { redis, connected } from "./_redis.js";

const BITS = 16;
const ORIGINS = ["https://corvus.gent", "https://www.corvus.gent"];
const SECRET = process.env.VOTE_SECRET || crypto.createHash("sha256").update(String(process.env.REDIS_URL || "corvus")).digest("hex");
const MAX_SUGGESTIONS = 300;

const sign = v => crypto.createHmac("sha256", SECRET).update(v).digest("base64url");
const makeVoter = () => { const id = crypto.randomBytes(16).toString("base64url"); return `${id}.${sign(id)}`; };
function readVoter(req) {
  const m = /(?:^|;\s*)vid=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [id, sig] = m[1].split(".");
  if (!id || !sig) return null;
  const good = sign(id);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? id : null;
}
const zeroBits = buf => { let n = 0; for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; } return n; };
const trackId = s => (/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/.exec(String(s || "")) || [])[1] || null;

async function spotifyTitle(id) {
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${id}`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const d = await r.json();
    return String(d.title || "").slice(0, 120) || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!connected()) return res.status(503).json({ error: "storage not connected" });
  try {
    let voter = readVoter(req);
    if (!voter) {
      const cookie = makeVoter();
      voter = cookie.split(".")[0];
      res.setHeader("Set-Cookie", `vid=${cookie}; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`);
    }
    let message = null;

    if (req.method === "POST") {
      if (!ORIGINS.includes(req.headers.origin || "")) return res.status(403).json({ error: "forbidden" });
      if (!readVoter(req)) return res.status(403).json({ error: "no voter cookie" });
      const { action, url, id: rawId, challenge, nonce } = req.body || {};

      const salt = await redis(["GETDEL", `ch:${String(challenge || "").slice(0, 64)}`]);
      if (!salt) return res.status(403).json({ error: "challenge expired" });
      if (zeroBits(crypto.createHash("sha256").update(`${salt}:${nonce}`).digest()) < BITS) return res.status(403).json({ error: "bad proof" });

      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const ipKey = crypto.createHash("sha256").update(ip + SECRET).digest("hex").slice(0, 32);
      const day = Number(await redis(["INCR", `music:ipday:${ipKey}`]));
      if (day === 1) await redis(["EXPIRE", `music:ipday:${ipKey}`, "86400"]);
      if (day > 30) return res.status(429).json({ error: "easy, DJ. try again tomorrow." });

      let id = null;
      if (action === "suggest") {
        id = trackId(url);
        if (!id) return res.status(400).json({ error: "that's not a spotify track link" });
        if (!(await redis(["HEXISTS", "music:sugg", id]))) {
          const sDay = Number(await redis(["INCR", `music:suggday:${ipKey}`]));
          if (sDay === 1) await redis(["EXPIRE", `music:suggday:${ipKey}`, "86400"]);
          if (sDay > 5) return res.status(429).json({ error: "max 5 suggestions a day" });
          if (Number(await redis(["HLEN", "music:sugg"])) >= MAX_SUGGESTIONS) return res.status(429).json({ error: "suggestion box is full" });
          const title = await spotifyTitle(id);
          if (!title) return res.status(400).json({ error: "spotify doesn't know that track" });
          await redis(["HSET", "music:sugg", id, title]);
          message = "added. you voted for it too.";
        } else message = "already suggested, counted as a vote.";
      } else if (action === "vote") {
        id = /^[A-Za-z0-9]{22}$/.test(String(rawId || "")) ? rawId : null;
        if (!id || !(await redis(["HEXISTS", "music:sugg", id]))) return res.status(400).json({ error: "unknown track" });
      } else return res.status(400).json({ error: "bad action" });

      if (Number(await redis(["SADD", `music:voted:${voter}`, id])) === 1) await redis(["ZINCRBY", "music:votes", "1", id]);
      else if (action === "vote") message = "you already voted for this one.";
    }

    const ch = crypto.randomBytes(12).toString("base64url");
    const chSalt = crypto.randomBytes(16).toString("hex");
    await redis(["SET", `ch:${ch}`, chSalt, "EX", "300"]);

    const titles = await redis(["HGETALL", "music:sugg"]) || [];
    const scores = await redis(["ZRANGE", "music:votes", "0", "-1", "WITHSCORES"]) || [];
    const mine = new Set(await redis(["SMEMBERS", `music:voted:${voter}`]) || []);
    const score = {};
    for (let i = 0; i < scores.length; i += 2) score[scores[i]] = Number(scores[i + 1]);
    const suggestions = [];
    for (let i = 0; i < titles.length; i += 2) suggestions.push({ id: titles[i], title: titles[i + 1], votes: score[titles[i]] || 0, mine: mine.has(titles[i]) });
    suggestions.sort((a, b) => b.votes - a.votes);
    return res.status(200).json({ suggestions, message, challenge: { id: ch, salt: chSalt, bits: BITS } });
  } catch (e) {
    return res.status(500).json({ error: "storage error" });
  }
}
