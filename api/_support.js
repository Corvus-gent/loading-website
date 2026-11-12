import crypto from 'node:crypto';
import {redis,pipeline} from './_redis.js';
import {dailyIPHash,rateLimit,serverSecret} from './_privacy.js';
import {getSession,safeEqual} from './_session.js';
import {CONFIG,CALL_TIERS,BMC_URL,LINKEDIN_PROFILE_URL,SUPPORT_LINKS,SUPPORT_STEPS} from '../js/support-config.js';
const prefix=process.env.SUPPORT_TEST_PREFIX||(process.env.VERCEL_ENV==='production'?'support:diogenes:v1':'support:diogenes:preview:v1');
const dayOf=(n=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels'}).format(new Date(n));
const obj=x=>Array.isArray(x)?Object.fromEntries(Array.from({length:x.length/2},(_,i)=>[x[i*2],x[i*2+1]])):x||{};
const source=x=>['linkedin','x'].includes(x)?x:'direct';
function secureURL(value,fallback=''){try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}return fallback;}
export function configuration(){
 const x=/^\d{5,25}$/.test(process.env.X_USER_ID||'')?'https://x.com/messages/compose?recipient_id='+process.env.X_USER_ID:'https://x.com/gabe_maxxing';
 return{...CONFIG,bmcURL:secureURL(process.env.BMC_URL,BMC_URL),linkedinURL:secureURL(process.env.LINKEDIN_PROFILE_URL,LINKEDIN_PROFILE_URL),instagramURL:'https://ig.me/m/gabe.maxxing',xURL:x};
}
export function shortDestination(id,query={}){
 const rule=SUPPORT_LINKS[id];if(!rule)return null;const c=configuration(),u=new URL({call:'/call/',bmc:c.bmcURL,dinner:'/dinner/',roll:'/gabinho-rolls/'}[rule.kind],'https://corvus.gent');
 // Preserve harmless campaign labels; never forward arbitrary form data or secrets.
 for(const key of ['utm_content','utm_term','utm_id'])if(typeof query[key]==='string'&&/^[a-zA-Z0-9._-]{1,80}$/.test(query[key]))u.searchParams.set(key,query[key]);
 for(const[k,v]of Object.entries({utm_source:rule.source,utm_medium:'social',utm_campaign:'diogenes'}))u.searchParams.set(k,v);
 if(rule.kind==='roll')u.searchParams.set('from','support');return rule.kind==='bmc'?u.href:u.pathname+u.search;
}
const human=req=>req.method==='GET'&&!/bot|crawler|spider|preview|facebookexternalhit|slack|discord|whatsapp|curl|wget|headless/i.test(String(req.headers['user-agent']||''))&&!/prefetch/i.test(String(req.headers.purpose||req.headers['sec-purpose']||''));
export async function count(req,id,now=Date.now()){
 if(!human(req))return;const day=dayOf(now),dedupe=[0,86400000].map(offset=>prefix+':dedupe:'+id+':'+dailyIPHash(req,'support-'+id,new Date(now-offset)));
 const keys=[...dedupe,prefix+':all',prefix+':day:'+day,prefix+':unique',prefix+':unique:'+day];
 return redis(['EVAL',`local fresh=1;for i=1,2 do if redis.call('EXISTS',KEYS[i])==1 then fresh=0 end end
redis.call('HINCRBY',KEYS[3],ARGV[1],1);redis.call('HINCRBY',KEYS[4],ARGV[1],1)
if fresh==1 then redis.call('SET',KEYS[1],'1','EX',1800);redis.call('HINCRBY',KEYS[5],ARGV[1],1);redis.call('HINCRBY',KEYS[6],ARGV[1],1) end;return fresh`,6,...keys,id]);
}
export async function supportReport(day=dayOf()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))day=dayOf();const[a,d,u]=await pipeline([['HGETALL',prefix+':all'],['HGETALL',prefix+':day:'+day],['HGETALL',prefix+':unique']]);const all=obj(a),daily=obj(d),unique=obj(u);
 const rows=Object.entries(SUPPORT_LINKS).map(([id,r])=>({id,label:r.label,source:r.source,total:Number(all[id]||0),day:Number(daily[id]||0),unique:Number(unique[id]||0)}));
 const steps=Object.entries(SUPPORT_STEPS).map(([id,label])=>({id,label,total:['linkedin','x','direct'].reduce((n,s)=>n+Number(all[id+':'+s]||0),0),day:['linkedin','x','direct'].reduce((n,s)=>n+Number(daily[id+':'+s]||0),0)}));
 return{day,rows:rows.sort((a,b)=>b.day-a.day||b.total-a.total),steps,total:rows.reduce((n,r)=>n+r.total,0),clicks:rows.reduce((n,r)=>n+r.day,0)};
}
function stepDestination(step,c){return {'call-coffee':c.bmcURL,'dinner-linkedin':c.linkedinURL,'dinner-instagram':c.instagramURL,'dinner-x':c.xURL,'roll-instagram':c.instagramURL,'roll-x':c.xURL}[step]||null;}
function sameOrigin(req){return ['https://corvus.gent','https://www.corvus.gent',...['VERCEL_URL','VERCEL_BRANCH_URL'].map(k=>process.env[k]&&'https://'+process.env[k]),...(process.env.NODE_ENV!=='production'?['http://127.0.0.1:4395']:[])].includes(req.headers.origin);}
const RETENTION=60*86400;
const clean=(v,max)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
function sign(v){return crypto.createHmac('sha256',serverSecret()).update('call-form:'+v).digest('hex');}
export function challenge(now=Date.now()){const value=now+'.'+crypto.randomBytes(12).toString('hex');return{token:value+'.'+sign(value),notBefore:now+3000};}
function challengeOK(token){if(typeof token!=='string'||token.length>120)return false;const[at,nonce,sig]=token.split('.'),age=Date.now()-Number(at);return /^\d{13}$/.test(at||'')&&/^[a-f0-9]{24}$/.test(nonce||'')&&age>=3000&&age<1800000&&safeEqual(sig,sign(at+'.'+nonce));}
async function admin(req){const key=String(req.headers.authorization||'').replace(/^Bearer /,'');return(process.env.CALL_ADMIN_KEY&&safeEqual(key,process.env.CALL_ADMIN_KEY))||(await getSession(req))?.email==='gabriel@corvus.gent';}
export function validateRequest(b){
 const fields={name:80,contact:160,pain:600,times:250};for(const[k,max]of Object.entries(fields))if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>max)throw Error('Please fill in your name, contact, what hurts and preferred times.');
 if(!Object.hasOwn(CALL_TIERS,b.tier))throw Error('Choose a call or meet-up.');if(CALL_TIERS[b.tier].paid&&b.coffeePaid!==true)throw Error('Sort the coffee first, then tick the checkbox.');
 return{...Object.fromEntries(Object.entries(fields).map(([k,max])=>[k,clean(b[k],max)])),tier:b.tier,coffeePaid:CALL_TIERS[b.tier].paid&&b.coffeePaid===true,source:source(b.source)};
}
export async function notifyRequest(id,send=fetch){
 const key=prefix+':request:'+id,raw=await redis(['GET',key]);if(!raw)return false;const row=JSON.parse(raw);if(row.mailSent)return true;if(!process.env.RESEND_API_KEY)return false;
 const tier=CALL_TIERS[row.tier],payload={from:'corvus <login@corvus.gent>',to:'gabriel@corvus.gent',subject:'💊 '+tier.short+': '+row.name,text:['New call / SF request','Name: '+row.name,'Contact: '+row.contact,'Tier: '+tier.label,'Coffee: '+(tier.paid?(row.coffeePaid?'self-reported yes (honor system)':'not confirmed'):'not required'),'What hurts: '+row.pain,'Preferred times: '+row.times,'Source: '+row.source,'Submitted: '+row.createdAt,tier.paid?'Includes 1 PARACETAMAIL after the call.':'','Manage: https://corvus.gent/call/admin/'].join('\n')};
 if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contact))payload.reply_to=row.contact;
 try{const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'call-request-'+id},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});if(!response.ok)return false;
  await redis(['EVAL',"local v=redis.call('GET',KEYS[1]);if not v then return 0 end;local r=cjson.decode(v);r.mailSent=true;redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 1",1,key]);return true;
 }catch{return false;}
}
async function saveRequest(req,data,requestId){
 const id=crypto.randomUUID(),now=Date.now(),ip=dailyIPHash(req,'call-form'),dedupe=prefix+':submit:'+sign(requestId),row={id,...data,status:'new',mailSent:false,createdAt:new Date(now).toISOString()};
 const keys=[dedupe,prefix+':cool:'+ip,prefix+':hour:'+ip,prefix+':request:'+id,prefix+':requests',prefix+':all',prefix+':day:'+dayOf(now)];
 const result=await redis(['EVAL',`local existing=redis.call('GET',KEYS[1]);if existing then return {200,existing} end
local cool=redis.call('TTL',KEYS[2]);if cool>0 then return {429,tostring(cool)} end
local n=tonumber(redis.call('GET',KEYS[3]) or '0');if n>=3 then return {429,tostring(redis.call('TTL',KEYS[3]))} end
redis.call('INCR',KEYS[3]);if redis.call('TTL',KEYS[3])<0 then redis.call('EXPIRE',KEYS[3],3600) end
redis.call('SET',KEYS[2],'1','EX',60);redis.call('SET',KEYS[1],ARGV[1],'EX',600)
redis.call('SET',KEYS[4],ARGV[2],'EX',ARGV[3]);redis.call('ZREMRANGEBYSCORE',KEYS[5],'-inf',ARGV[5]);redis.call('ZADD',KEYS[5],ARGV[4],ARGV[1]);redis.call('EXPIRE',KEYS[5],ARGV[3])
redis.call('HINCRBY',KEYS[6],ARGV[6],1);redis.call('HINCRBY',KEYS[7],ARGV[6],1);return {201,ARGV[1]}`,keys.length,...keys,id,JSON.stringify(row),RETENTION,now,now-RETENTION*1000,'request-'+data.tier+':'+data.source]);
 return{code:Number(result[0]),value:result[1]};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');const q=req.query||{},c=configuration();
 if(q.slug&&['GET','HEAD'].includes(req.method)){const target=shortDestination(q.slug,q);if(!target)return res.status(404).json({error:'Unknown support link.'});try{await count(req,q.slug);}catch{}res.setHeader('Location',target);return res.status(302).end();}
 try{
  if(q.action==='admin'){
   if(!await admin(req))return res.status(401).json({error:'Sign in as Gabe or enter the private key.'});
   if(req.method==='GET'){const offset=Math.max(0,Math.min(10000,Number(q.offset)||0)),ids=await redis(['ZREVRANGE',prefix+':requests',offset,offset+49]),rows=ids.length?await pipeline(ids.map(id=>['GET',prefix+':request:'+id])):[];return res.status(200).json({rows:rows.filter(Boolean).map(JSON.parse),more:ids.length===50,offset});}
   if(req.method!=='POST'||!sameOrigin(req))return res.status(403).json({error:'Use the admin page.'});
   let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{}if(!b||!/^[a-f0-9-]{36}$/.test(b.id||''))return res.status(400).json({error:'Invalid request.'});
   if(b.action==='retry-mail')return res.status(200).json({ok:await notifyRequest(b.id)});
   if(!['new','scheduled','done'].includes(b.status))return res.status(400).json({error:'Choose new, scheduled or done.'});const changed=await redis(['EVAL',"local v=redis.call('GET',KEYS[1]);if not v then return 0 end;local r=cjson.decode(v);r.status=ARGV[1];redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 1",1,prefix+':request:'+b.id,b.status]);return res.status(changed?200:404).json({ok:!!changed});
  }
  if(req.method==='GET'||req.method==='HEAD'){
   if(q.action==='stats'){res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=300');return res.status(200).json({ready:true,...await supportReport(q.day)});}
   if(q.action==='out'){const target=stepDestination(q.step,c);if(!target)return res.status(404).json({error:'Unknown support action.'});try{await count(req,q.step+':'+source(q.source));}catch{}res.setHeader('Location',target);return res.status(302).end();}
   return res.status(200).json({...CONFIG,tiers:CALL_TIERS});
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, HEAD, POST');return res.status(405).json({error:'Method not allowed.'});}
  if(!sameOrigin(req)||!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(403).json({error:'Use the call page.'});
  if(Number(req.headers['content-length']||0)>5000)return res.status(413).json({error:'Please keep it short.'});let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{}if(!b||JSON.stringify(b).length>5000)return res.status(400).json({error:'Invalid request.'});
  if(b.action==='challenge'){if(!await rateLimit(prefix+':challenge:'+dailyIPHash(req,'call-challenge'),20,600))return res.status(429).json({error:'Please try again shortly.'});return res.status(200).json(challenge());}
  if(b.website||!challengeOK(b.challenge)||!/^[a-f0-9-]{36}$/.test(b.requestId||''))return res.status(400).json({error:'Please wait a moment and try the form again.'});
  let data;try{data=validateRequest(b);}catch(e){return res.status(400).json({error:e.message});}const saved=await saveRequest(req,data,b.requestId);
  if(saved.code===429){res.setHeader('Retry-After',String(saved.value));return res.status(429).json({error:'One request at a time. Please wait before sending another.',retryAfter:Number(saved.value)});}
  const notified=await notifyRequest(saved.value);return res.status(saved.code).json({ok:true,notified,message:"Got it 💊 I'll reply within a few hours to lock a time."});
 }catch{return res.status(503).json({error:'The form is reconnecting. Your request is not confirmed. Please retry, or email gabriel@corvus.gent.'});}
}
