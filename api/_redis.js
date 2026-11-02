// One tiny helper: run a Redis command, via REST (Upstash) or REDIS_URL (TCP).
import { createClient } from "redis";

const envEnding = end => Object.entries(process.env).find(([k, v]) => k.endsWith(end) && !k.includes("READ_ONLY") && v)?.[1];
const REST_URL = envEnding("_REST_API_URL") || envEnding("_REDIS_REST_URL");
const REST_TOKEN = envEnding("_REST_API_TOKEN") || envEnding("_REDIS_REST_TOKEN");
const REDIS_URL = process.env.REDIS_URL || envEnding("_REDIS_URL") || envEnding("KV_URL");

let client;

export const connected = () => Boolean((REST_URL && REST_TOKEN) || REDIS_URL);

export async function redis(cmd) {
  if (REST_URL && REST_TOKEN) {
    const r = await fetch(REST_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    return (await r.json()).result;
  }
  if (!client) {
    client = createClient({ url: REDIS_URL });
    client.on("error", () => {});
    await client.connect();
  }
  return client.sendCommand(cmd.map(String));
}
