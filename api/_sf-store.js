import crypto from 'node:crypto';
import {redis as defaultRedis} from './_redis.js';
import {SF_DAYS,SF_LETS} from '../js/sf-trip.js';
export const SF_RETENTION=60*86400;
export const isEmail=value=>/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value)&&value.length<=254;
const clean=(value,max,required=false,multiline=false)=>{
 if(typeof value!=='string'||value.length>max||(!multiline&&/[\r\n]/.test(value))||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw Error('invalid_fields');
 const result=value.trim();if(required&&!result)throw Error('invalid_fields');return result;
};
export function validateLead(body){
 const name=clean(body.name,80,true),contact=clean(body.contact,300,true),what=clean(body.what??'',140),where=clean(body.where??'',60),message=clean(body.message??'',500,false,true);
 let validContact=isEmail(contact)||/^@[a-z0-9_]{1,15}$/i.test(contact);
 if(!validContact)try{const u=new URL(contact);validContact=u.protocol==='https:'&&['linkedin.com','www.linkedin.com'].includes(u.hostname)&&/^\/in\/[^/]+\/?$/.test(u.pathname)&&!u.username&&!u.password&&!u.port;}catch{}
 if(!validContact)throw Error('invalid_contact');
 const list=(value,allowed)=>{if(!Array.isArray(value)||!value.length||value.length>allowed.length||value.some(x=>!allowed.includes(x)))throw Error('invalid_fields');return [...new Set(value)];};
 const lets=list(body.lets,SF_LETS),when=list(body.when,[...SF_DAYS,'anytime']);
 if(when.includes('anytime')&&when.length!==1)throw Error('invalid_fields');
 return {name,contact,what,lets,when,where,message};
}
// The index has no contact details. Individual records expire at creation + 60d;
// later submissions or a done toggle never extend an older person's retention.
const SAVE=`
local old=redis.call('GET',KEYS[1]); if old then return {2,old} end
local cooldown=math.max(redis.call('TTL',KEYS[2]),redis.call('TTL',KEYS[3]))
if cooldown>0 then return {429,tostring(cooldown)} end
if tonumber(redis.call('GET',KEYS[4]) or '0')>=3 then return {429,ARGV[6]} end
redis.call('ZREMRANGEBYSCORE',KEYS[6],'-inf',ARGV[4])
if redis.call('ZCARD',KEYS[6])>=5000 then return {503,'0'} end
redis.call('SET',KEYS[2],1,'EX',60); redis.call('SET',KEYS[3],1,'EX',60)
redis.call('INCR',KEYS[4]); if redis.call('TTL',KEYS[4])<0 then redis.call('EXPIRE',KEYS[4],ARGV[6]) end
redis.call('SET',KEYS[5],ARGV[2],'EX',ARGV[5]);redis.call('ZADD',KEYS[6],ARGV[3],ARGV[1]);redis.call('EXPIRE',KEYS[6],ARGV[5])
redis.call('SET',KEYS[1],ARGV[1],'EX',86400)
redis.call('SET',KEYS[7],'pending','EX',ARGV[5]);redis.call('ZADD',KEYS[8],ARGV[3],ARGV[1]);redis.call('EXPIRE',KEYS[8],ARGV[5]);return {201,ARGV[1]}`;
const UPDATE=`local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local r=cjson.decode(raw);r.done=ARGV[1]=='1';redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 1`;
export function sfStore({redis=defaultRedis,now=Date.now,fetcher=fetch,mailKey=()=>process.env.RESEND_API_KEY}={}){
 async function save(data,{voter,ip,requestId}){
  const at=now(),id=crypto.randomUUID(),record={...data,date:new Date(at).toISOString(),done:false};
  const dayTTL=Math.max(1,Math.ceil((Date.parse(new Date(at).toISOString().slice(0,10))+86400000-at)/1000));
  return redis(['EVAL',SAVE,'8',`sf:receipt:${voter}:${requestId}`,`sf:cool:v:${voter}`,`sf:cool:ip:${ip}`,`sf:day:${ip}`,`sf:lead:${id}`,'sf:leads',`sf:mail:${id}`,'sf:outbox',id,JSON.stringify(record),String(at),String(at-SF_RETENTION*1000),String(SF_RETENTION),String(dayTTL)]);
 }
 async function notify(id){
  if(!/^[a-f0-9-]{36}$/.test(id))return false;
  const token=crypto.randomUUID(),lock=`sf:mail-lock:${id}`;
  if(!await redis(['SET',lock,token,'NX','EX','30']))return false;
  try{
   const raw=await redis(['GET',`sf:lead:${id}`]);
   if(!raw){await redis(['ZREM','sf:outbox',id]);return false;}
   if(await redis(['GET',`sf:mail:${id}`])==='sent'){await redis(['ZREM','sf:outbox',id]);return true;}
   if(!mailKey())return false;
   const lead=JSON.parse(raw),activities=lead.lets.map(x=>({bjj:'bjj open mat',intro:'intro to someone'})[x]||x).join(', '),body={from:'corvus <login@corvus.gent>',to:['gabriel@corvus.gent'],subject:`🐦 sf: ${lead.name} wants to ${activities}`,text:`name: ${lead.name}\ncontact: ${lead.contact}\nwhat: ${lead.what}\nlet's: ${activities}\nwhen: ${lead.when.join(', ')}\nwhere: ${lead.where}\nmessage: ${lead.message}\ndate: ${lead.date}\n\nprivate dashboard: https://stats.corvus.gent/private\nform record expires after 60 days. delete this notification on the same schedule.`};
   if(isEmail(lead.contact))body.reply_to=lead.contact;
   const r=await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${mailKey()}`,'Content-Type':'application/json','Idempotency-Key':`sf/${id}`},body:JSON.stringify(body)});
   if(!r.ok)throw Error('mail_failed');
   await redis(['SET',`sf:mail:${id}`,'sent','XX','KEEPTTL']);await redis(['ZREM','sf:outbox',id]);return true;
  }catch{await redis(['SET',`sf:mail:${id}`,'pending','XX','KEEPTTL']);return false;}
  finally{await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",'1',lock,token]);}
 }
 async function flush(limit=5){const ids=await redis(['ZRANGE','sf:outbox','0',String(limit-1)])||[];let sent=0;for(const id of ids)if(await notify(id))sent++;return sent;}
 async function list(page=1){
  await redis(['ZREMRANGEBYSCORE','sf:leads','-inf',String(now()-SF_RETENTION*1000)]);
  const total=Number(await redis(['ZCARD','sf:leads'])),pages=Math.max(1,Math.ceil(total/50));page=Math.max(1,Math.min(pages,Math.floor(Number(page)||1)));
  const ids=await redis(['ZREVRANGE','sf:leads',String((page-1)*50),String(page*50-1)])||[];
  const rows=(await Promise.all(ids.map(async id=>{const raw=await redis(['GET',`sf:lead:${id}`]);return raw?{id,...JSON.parse(raw),notified:await redis(['GET',`sf:mail:${id}`])==='sent'}:null;}))).filter(Boolean);
  return {rows,page,pages,total};
 }
 return {save,notify,flush,list,mark:async(id,done)=>Number(await redis(['EVAL',UPDATE,'1',`sf:lead:${id}`,done?'1':'0']))===1};
}
