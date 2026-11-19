// Owner-only migration diagnostics. No credentials, keys or user records leave
// this endpoint: keyed fingerprints verify that a database move preserves auth.
import { createHmac } from 'node:crypto';
import { safeEqual } from './_session.js';
import { serverSecret, sessionSecret, languageVoteSecret, musicVoteSecret, gameSecret } from './_secrets.js';
import { redis, maintenance } from './_redis.js';
export default async function storageAudit(req,res) {
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'method'});
 const token=process.env.ADMIN_TOKEN;
 if(!token||!safeEqual(req.headers.authorization||'','Bearer '+token))return res.status(401).json({error:'unauthorized'});
 const env=process.env;
 const fallback=Object.entries(env).find(([key,value])=>/(?:REST_API_TOKEN|REDIS_REST_TOKEN)$/.test(key)&&value)?.[0];
 const privacySource=['PRIVACY_SECRET','SESSION_SECRET','VOTE_SECRET','REDIS_PRIVACY_SEED'].find(key=>env[key])||(env.REDIS_PRIVACY_SEED_ENV&&env[env.REDIS_PRIVACY_SEED_ENV]?env.REDIS_PRIVACY_SEED_ENV:null)||fallback||'REDIS_URL';
 const fingerprints=Object.fromEntries(Object.entries({session:sessionSecret(),language:languageVoteSecret(),music:musicVoteSecret(),game:gameSecret(),privacy:serverSecret()}).map(([name,value])=>[name,createHmac('sha256',token).update(value).digest('hex')]));
 let tls=false;try{tls=new URL(env.REDIS_URL).protocol==='rediss:';}catch{}
 return res.status(200).json({tls,identityAnchored:Boolean(env.REDIS_IDENTITY_SEED),privacySource,fingerprints,storagePaused:maintenance(),keys:maintenance()?null:Number(await redis(['DBSIZE']))});
}
