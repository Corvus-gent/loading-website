import crypto from 'node:crypto';
import {digest} from './_security.js';
import {DAY,cleanUsername,validUsername,normalizeEmail} from '../../js/army/domain.js';

// Pidgy (Alkmist) reports trials started with a Corvus referral code.
// Body: {"event_id":"<unique>","referral_code":"corvus-<handle>","email":"<trial email>","started_at":<unix s>}
// Header: x-signature-sha256 = hex HMAC-SHA256(raw body, PIDGY_WEBHOOK_SECRET).
// The trial email is used only transiently: hashed for dedupe/self-referral, never stored raw.
export function verifyPidgy(raw,signature,secret){
 if(!secret||typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const expected=crypto.createHmac('sha256',secret).update(raw).digest();
 return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
export const referralCode=username=>'corvus-'+username;
export function handleFromCode(code){
 const m=/^corvus-([a-z][a-z0-9_-]{2,23})$/.exec(cleanUsername(code));
 return m&&validUsername(m[1])?m[1]:null;
}
export function pidgyTrials(store){
 async function accept(event){
  const eventID=String(event?.event_id||'');
  if(!/^[A-Za-z0-9_.:-]{1,80}$/.test(eventID)||!Number.isFinite(event.started_at)||Math.abs(event.started_at*1000-store.now())>30*DAY*1000)throw Error('payload');
  const handle=handleFromCode(event.referral_code);if(!handle)return {counted:false,reason:'code'};
  let email;try{email=normalizeEmail(event.email);}catch{throw Error('payload');}
  const account=await store.byName(handle);
  if(!account?.verifiedAt||account.status==='deleting')return {counted:false,reason:'account'};
  const self=await store.byEmail(email);if(self?.id===account.id)return {counted:false,reason:'self'};
  // Atomically award one recruiting credit per distinct signed trial email.
  // Deduplication and the counter commit together, including concurrent retries.
  const result=await store.lock(account.id,()=>store.run(['EVAL',`local raw=redis.call('GET',KEYS[3]);if not raw then return {-1,0} end
local user=cjson.decode(raw);if not user.verifiedAt or user.status=='deleting' then return {-1,0} end
if redis.call('EXISTS',KEYS[1])==1 then return {0,0} end
if redis.call('SET',KEYS[2],ARGV[1],'NX','EX',ARGV[2])==false then redis.call('SET',KEYS[1],'1','EX',ARGV[2]);return {0,0} end
redis.call('SET',KEYS[1],'1','EX',ARGV[2]);user.pidgyTrials=(user.pidgyTrials or 0)+1
redis.call('SET',KEYS[3],cjson.encode(user),'KEEPTTL');redis.call('SADD',KEYS[4],KEYS[2]);redis.call('EXPIRE',KEYS[4],ARGV[2]);redis.call('INCR',KEYS[5]);redis.call('DEL',KEYS[6],KEYS[7]);return {1,user.pidgyTrials}`,7,
    store.key('pidgy:event:'+digest('pidgy-event:'+eventID)),store.key('pidgy:email:'+digest('pidgy:'+email)),store.key('u:'+account.id),store.key('owned:'+account.id),store.key('revision'),store.key('public'),store.key('legion'),account.id,400*DAY]));
  return Number(result[0])===1?{counted:true,trials:Number(result[1])}:{counted:false,reason:Number(result[0])===0?'duplicate':'account'};
 }
 return {accept};
}
