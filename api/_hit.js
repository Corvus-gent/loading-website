// Logs non-browser visits (curl, wget, scripts) reported by the middleware.
import { redis, connected } from "./_redis.js";

const TOOLS = ["curl", "wget", "httpie", "python", "go", "node", "postman", "insomnia", "powershell", "other"];
const tzDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date());

export default async function handler(req, res) {
  if (req.method !== "POST" || !connected()) return res.status(204).end();
  const tool = TOOLS.includes((req.body || {}).tool) ? req.body.tool : "other";
  const day = tzDay();
  await redis(["HINCRBY", `cli:${day}`, tool, "1"]);
  await redis(["HINCRBY", "cli:all", tool, "1"]);
  return res.status(204).end();
}
