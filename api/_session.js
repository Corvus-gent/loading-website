// Signed session cookies for the private dashboard.
import crypto from "node:crypto";
import { redis } from "./_redis.js";
import { sessionSecret as secret } from "./_secrets.js";

export const sign = v => crypto.createHmac("sha256", secret()).update(v).digest("base64url");
export const hash = v => crypto.createHash("sha256").update(v + secret()).digest("hex");
export const safeEqual = (a, b) => typeof a === "string" && typeof b === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function getSession(req) {
  const m = /(?:^|;\s*)sess=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [id, sig] = m[1].split(".");
  if (!id || !sig || !safeEqual(sig, sign(id))) return null;
  const email = await redis(["GET", `sess:${id}`]);
  return email ? { id, email } : null;
}

export async function createSession(res, email) {
  const id = crypto.randomBytes(24).toString("base64url");
  await redis(["SET", `sess:${id}`, email, "EX", String(7 * 86400)]);
  res.setHeader("Set-Cookie", `sess=${id}.${sign(id)}; Path=/; Max-Age=${7 * 86400}; HttpOnly; Secure; SameSite=Strict`);
}

export async function destroySession(req, res) {
  const s = await getSession(req);
  if (s) await redis(["DEL", `sess:${s.id}`]);
  res.setHeader("Set-Cookie", "sess=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict");
}
