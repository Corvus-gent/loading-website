// One tiny helper: run a Redis command, via REST (Upstash) or REDIS_URL (TCP).
import { createClient } from "redis";
import { isIP } from "node:net";

const envEnding = end => Object.entries(process.env).find(([k, v]) => k.endsWith(end) && !k.includes("READ_ONLY") && v)?.[1];
const REST_URL = envEnding("_REST_API_URL") || envEnding("_REDIS_REST_URL");
const REST_TOKEN = envEnding("_REST_API_TOKEN") || envEnding("_REDIS_REST_TOKEN");
const REDIS_URL = process.env.REDIS_URL || envEnding("_REDIS_URL") || envEnding("KV_URL");
// An explicit migration target wins over old Marketplace REST variables. Keep
// the previous REST preference when only an inferred/legacy TCP variable exists.
const USE_REST = !process.env.REDIS_URL && Boolean(REST_URL && REST_TOKEN);

const isLocal = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

// Also used by the migration tool, which validates its URLs before copying.
export function secureEndpoint(raw, rest = false) {
  const url = new URL(raw);
  if (rest ? url.protocol !== 'https:' : url.protocol !== 'rediss:' && !(isLocal(url.hostname) && url.protocol === 'redis:')) throw new Error('Redis requires encrypted transport');
  return raw;
}

export function plaintextExceptionUntil(raw = REDIS_URL, now = Date.now()) {
  if (USE_REST || !raw) return null;
  const until = process.env.REDIS_PLAINTEXT_UNTIL;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until || '')) return null;
  const deadline = Date.parse(until + 'T00:00:00.000Z');
  if (!Number.isFinite(deadline) || new Date(deadline).toISOString().slice(0, 10) !== until || now >= deadline)
    return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'redis:' && url.hostname === process.env.REDIS_PLAINTEXT_HOST ? until : null;
  } catch { return null; }
}

let plaintextWarningLogged = false;
export function connectionEndpoint(raw = REDIS_URL) {
  const until = plaintextExceptionUntil(raw);
  if (!until) return secureEndpoint(raw);
  if (!plaintextWarningLogged) {
    console.warn('redis plaintext exception active until ' + until);
    plaintextWarningLogged = true;
  }
  return raw;
}

let client, connecting;
async function connection() {
  // Preserve the existing time-bounded legacy exception and recheck it per call.
  const endpoint = new URL(REDIS_URL);
  if (!process.env.REDIS_PLAINTEXT_UNTIL && endpoint.protocol === 'redis:' && !isLocal(endpoint.hostname)) endpoint.protocol = 'rediss:';
  const url = connectionEndpoint(endpoint.href);
  if (!client) {
    const socket = { connectTimeout: 3000, reconnectStrategy: false };
    if (endpoint.protocol === 'rediss:') {
      socket.rejectUnauthorized = true;
      if (!isIP(endpoint.hostname.replace(/^\[|\]$/g, ''))) socket.servername = endpoint.hostname;
    }
    client = createClient({ url, socket });
    client.on('error', () => {});
    connecting = client.connect().catch(error => { client = null; connecting = null; throw error; });
  }
  await connecting;
  return client;

}

export const maintenance = () => process.env.REDIS_MAINTENANCE === '1';
export const connected = () => !maintenance() && Boolean(REDIS_URL || (REST_URL && REST_TOKEN));

export async function redis(cmd) {
  if (maintenance()) throw new Error('Redis temporarily paused');
  if (USE_REST) {
    const r = await fetch(secureEndpoint(REST_URL, true), {
      method: "POST",
      headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error("Redis command failed");
    return data.result;
  }
  return (await connection()).sendCommand(cmd.map(String));
}

export async function pipeline(commands) {
 if(maintenance())throw new Error('Redis temporarily paused');
 if(USE_REST){const r=await fetch(secureEndpoint(REST_URL, true)+'/pipeline',{method:'POST',headers:{Authorization:`Bearer ${REST_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(commands)});const rows=await r.json();if(!r.ok||rows.some(x=>x.error))throw Error('Redis pipeline failed');return rows.map(x=>x.result);}
 const c=await connection();const batch=c.multi();commands.forEach(cmd=>batch.addCommand(cmd.map(String)));return batch.execAsPipeline();
}
