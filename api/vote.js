// Public language vote with layered abuse protection:
// 1. signed, HttpOnly voter cookie (one vote per voter during the 365-day retention window)
// 2. one-time server challenge + proof-of-work (scripts pay CPU per vote)
// 3. same-origin check
// 4. per-IP limits (shared wifi friendly): 5 votes / day; daily, unlinkable network hashes
import crypto from "node:crypto";
import { redis, connected } from "./_redis.js";
import { dailyIPHash, rateLimit } from "./_privacy.js";

import {languageVoteSecret as secret} from "./_secrets.js";

const BITS = 16;                     // proof-of-work difficulty (~65k hashes)
const ORIGINS = ["https://corvus.gent", "https://www.corvus.gent"];

const sign = v => crypto.createHmac("sha256", secret()).update(v).digest("base64url");
const makeVoter = () => { const id = crypto.randomBytes(16).toString("base64url"); return `${id}.${sign(id)}`; };
function readVoter(req) {
  const m = /(?:^|;\s*)vid=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [id, sig] = m[1].split(".");
  if (!id || !sig) return null;
  const good = sign(id);
  return Buffer.byteLength(sig) === Buffer.byteLength(good) && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? id : null;
}
const leadingZeroBits = buf => {
  let n = 0;
  for (const byte of buf) { if (byte === 0) { n += 8; continue; } n += Math.clz32(byte) - 24; break; }
  return n;
};
function toObject(arr) {
  const o = {};
  for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = Number(arr[i + 1]);
  return o;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();
  if (!connected()) return res.status(503).json({ error: "storage not connected" });
  try {
    let voter = readVoter(req);
    if (!voter) {
      const cookie = makeVoter();
      voter = cookie.split(".")[0];
      res.setHeader("Set-Cookie", `vid=${cookie}; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`);
    }

    if (req.method === "POST") {
      const origin = req.headers.origin || "";
      if (!ORIGINS.includes(origin)) return res.status(403).json({ error: "forbidden" });
      if (!readVoter(req)) return res.status(403).json({ error: "no voter cookie" });

      const { lang, challenge, nonce } = req.body || {};
      const code = String(lang || "").toLowerCase();
      if (!/^[a-z]{2,3}$/.test(code)) return res.status(400).json({ error: "bad language" });

      const salt = await redis(["GETDEL", `ch:${String(challenge || "").slice(0, 64)}`]);
      if (!salt) return res.status(403).json({ error: "challenge expired" });
      const hash = crypto.createHash("sha256").update(`${salt}:${nonce}`).digest();
      if (leadingZeroBits(hash) < BITS) return res.status(403).json({ error: "bad proof" });

      if (!await rateLimit(`voted:ipday:${dailyIPHash(req, 'language')}`, 5, 86400)) return res.status(429).json({ error: "too many votes from this network today" });
      const first = await redis(['EVAL', "if redis.call('SET',KEYS[1],ARGV[1],'NX','EX',31536000) then redis.call('HINCRBY',KEYS[2],ARGV[1],1); return 1 end; return 0", '2', `voted:v:${voter}`, 'lang_votes', code]);
      if (!Number(first)) return res.status(409).json({ error: 'already voted' });

    }

    // fresh one-time challenge for the next vote (valid 5 minutes)
    const id = crypto.randomBytes(12).toString("base64url");
    const salt = crypto.randomBytes(16).toString("hex");
    await redis(["SET", `ch:${id}`, salt, "EX", "300"]);

    const votes = toObject(await redis(["HGETALL", "lang_votes"]));
    return res.status(200).json({ votes, challenge: { id, salt, bits: BITS } });
  } catch (e) {
    return res.status(500).json({ error: "storage error" });
  }
}
