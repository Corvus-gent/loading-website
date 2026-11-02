// Temporary: lists storage-related env var NAMES only (no values).
export default function handler(req, res) {
  const names = Object.keys(process.env).filter(k => /KV|REDIS|UPSTASH|STORAGE|_URL$|_TOKEN$/.test(k) && !/^VERCEL|^NODE|^PATH/.test(k));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ names, deployedAt: process.env.VERCEL_GIT_COMMIT_SHA || null });
}
