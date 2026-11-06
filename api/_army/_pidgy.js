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
  // One trial email counts once, ever, for one recruiter; one event id once.
  const fresh=Number(await store.run(['EVAL',`if redis.call('EXISTS',KEYS[1])==1 then return 0 end
if redis.call('SET',KEYS[2],ARGV[1],'NX','EX',ARGV[2])==false then redis.call('SET',KEYS[1],'1','EX',ARGV[2]);return 0 end
redis.call('SET',KEYS[1],'1','EX',ARGV[2]);return 1`,2,store.key('pidgy:event:'+digest('pidgy-event:'+eventID)),store.key('pidgy:email:'+digest('pidgy:'+email)),account.id,400*DAY]));
  if(!fresh)return {counted:false,reason:'duplicate'};
  let trials=0;
  await store.lock(account.id,async()=>{
   const current=await store.getUser(account.id);if(!current||current.status==='deleting')return;
   current.pidgyTrials=Math.max(0,Number(current.pidgyTrials||0))+1;trials=current.pidgyTrials;
   await store.persist(current);
  });
  return {counted:!!trials,trials};
 }
 return {accept};
}
