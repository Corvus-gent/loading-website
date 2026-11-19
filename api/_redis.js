// One tiny helper: run a Redis command, via REST (Upstash) or REDIS_URL (TCP).
import { createClient } from "redis";

const envEnding = end => Object.entries(process.env).find(([k, v]) => k.endsWith(end) && !k.includes("READ_ONLY") && v)?.[1];
const REST_URL = envEnding("_REST_API_URL") || envEnding("_REDIS_REST_URL");
const REST_TOKEN = envEnding("_REST_API_TOKEN") || envEnding("_REDIS_REST_TOKEN");
const REDIS_URL = process.env.REDIS_URL || envEnding("_REDIS_URL") || envEnding("KV_URL");
// An explicit migration target wins over old Marketplace REST variables. Keep
// the previous REST preference when only an inferred/legacy TCP variable exists.
const USE_REST = !process.env.REDIS_URL && Boolean(REST_URL && REST_TOKEN);

// Personal records must not travel in clear text to a remote storage service.
export function secureEndpoint(raw, rest = false) {
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (rest ? url.protocol !== 'https:' : url.protocol !== 'rediss:' && !(local && url.protocol === 'redis:')) throw new Error('Redis requires encrypted transport');
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

const IO_TIMEOUT = 5000;
let client, connecting;
function deadline(work, ms, cancel) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try { cancel?.(); } catch { /* Cleanup must not hide the timeout. */ }
      reject(new Error('Redis request timed out'));
    }, ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
function discard(current) {
  if (client === current) { client = null; connecting = null; }
  if (current.isOpen) Promise.resolve().then(() => current.disconnect()).catch(() => {});
}
async function connection() {
  // Recheck the deadline on every operation, including an already-open connection.
  const url = connectionEndpoint();
  if (!client) {
    const current = createClient({
      url, disableOfflineQueue: true,
      socket: { connectTimeout: 3000, reconnectStrategy: retries => retries < 2 ? 100 * (retries + 1) : false }
    });
    client = current;
    current.on('error', () => {});
    connecting = deadline(current.connect(), IO_TIMEOUT, () => discard(current)).catch(error => {
      discard(current);
      throw error;
    });
  }
  const current = client;
  await connecting;
  return current;
}
async function tcp(run) {
  const current = await connection();
  return deadline(Promise.resolve().then(() => run(current)), IO_TIMEOUT, () => discard(current));
}
async function rest(commands, batch = false) {
  const controller = new AbortController();
  return deadline((async () => {
    const r = await fetch(secureEndpoint(REST_URL, true) + (batch ? '/pipeline' : ''), {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    const data = await r.json();
    if (!r.ok || (batch ? !Array.isArray(data) || data.some(x => x.error) : data.error))
      throw new Error(batch ? 'Redis pipeline failed' : 'Redis command failed');
    return batch ? data.map(x => x.result) : data.result;
  })(), IO_TIMEOUT, () => controller.abort());
}

export const maintenance = () => process.env.REDIS_MAINTENANCE === '1';
export const connected = () => !maintenance() && Boolean(REDIS_URL || (REST_URL && REST_TOKEN));

export async function redis(cmd) {
  if (maintenance()) throw new Error('Redis temporarily paused');
  if (USE_REST) return rest(cmd);
  return tcp(current => current.sendCommand(cmd.map(String)));
}

export async function pipeline(commands) {
  if (maintenance()) throw new Error('Redis temporarily paused');
  if (!commands.length) return [];
  if (USE_REST) return rest(commands, true);
  return tcp(current => {
    const batch = current.multi();
    commands.forEach(cmd => batch.addCommand(cmd.map(String)));
    return batch.execAsPipeline();
  });
}
