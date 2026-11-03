// Counts CV opens and downloads, then serves the PDF.
import fs from "node:fs";
import path from "node:path";
import { redis, connected } from "./_redis.js";

const tzDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date());
const BOTS = /bot|crawl|spider|preview|slurp|facebookexternalhit|linkedinbot|whatsapp|telegram|discord|curl|wget/i;

export default async function handler(req, res) {
  const download = req.query && req.query.dl === "1";
  const kind = download ? "download" : "open";
  try {
    if (connected() && !BOTS.test(req.headers["user-agent"] || "")) {
      await redis(["INCR", `cv:${kind}`]);
      await redis(["INCR", `cv:${kind}:${tzDay()}`]);
    }
  } catch {}
  const file = fs.readFileSync(path.join(process.cwd(), "cv", "gabe.pdf"));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="Gabe-Van-Langenhove-CV.pdf"`);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(file);
}
