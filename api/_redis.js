// One tiny helper: run a Redis command, via REST (Upstash) or REDIS_URL (TCP).
import { createClient } from "redis";

const envEnding = end => Object.entries(process.env).find(([k, v]) => k.endsWith(end) && !k.includes("READ_ONLY") && v)?.[1];
const REST_URL = envEnding("_REST_API_URL") || envEnding("_REDIS_REST_URL");
const REST_TOKEN = envEnding("_REST_API_TOKEN") || envEnding("_REDIS_REST_TOKEN");
const REDIS_URL = process.env.REDIS_URL || envEnding("_REDIS_URL") || envEnding("KV_URL");

// Personal records must not travel in clear text to a remote storage service.
export function secureEndpoint(raw, rest = false) {
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (rest ? url.protocol !== 'https:' : url.protocol !== 'rediss:' && !(local && url.protocol === 'redis:')) throw new Error('Redis requires encrypted transport');
  return raw;
}

let client, connecting;
async function connection(){
  if(!client){client=createClient({url:secureEndpoint(REDIS_URL)});client.on("error",()=>{});connecting=client.connect().catch(error=>{client=null;connecting=null;throw error;});}
  await connecting;return client;
}

export const connected = () => Boolean((REST_URL && REST_TOKEN) || REDIS_URL);

export async function redis(cmd) {
  if (REST_URL && REST_TOKEN) {
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
 if(REST_URL&&REST_TOKEN){const r=await fetch(secureEndpoint(REST_URL, true)+'/pipeline',{method:'POST',headers:{Authorization:`Bearer ${REST_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(commands)});const rows=await r.json();if(!r.ok||rows.some(x=>x.error))throw Error('Redis pipeline failed');return rows.map(x=>x.result);}
 const c=await connection();const batch=c.multi();commands.forEach(cmd=>batch.addCommand(cmd.map(String)));return batch.execAsPipeline();
}
