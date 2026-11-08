import crypto from 'node:crypto';
import {redis,pipeline} from './_redis.js';
import {dailyIPHash,serverSecret,ORIGINS} from './_privacy.js';
import {getSession,safeEqual} from './_session.js';
export const RETENTION=60*86400;
const prefix=process.env.LIVE_INTERVIEW_TEST_PREFIX||(process.env.VERCEL_ENV==='production'?'live:interviews':'live:preview:interviews');
const mac=value=>crypto.createHmac('sha256',serverSecret()).update('live-interview:'+value).digest('hex');
export function challenge(now=Date.now()) {const value=now+'.'+crypto.randomBytes(12).toString('hex');return {token:value+'.'+mac(value),notBefore:now+3000};}
export function validChallenge(token,now=Date.now()) {
  if(typeof token!=='string'||token.length>120)return false;
  const [at,nonce,sig]=token.split('.'),age=now-Number(at);
  return /^\d{13}$/.test(at||'')&&/^[a-f0-9]{24}$/.test(nonce||'')&&age>=3000&&age<1800000&&safeEqual(sig,mac(at+'.'+nonce));
}
export function validate(body) {
  if(!body||Array.isArray(body)||typeof body!=='object'||body.website)throw Error('Please check the form.');
  const limits={name:80,project:160,handle:120},fields={};
  for(const [key,max]of Object.entries(limits)){
    if(typeof body[key]!=='string'||body[key].length>max)throw Error('Please fill in your name, project and handle.');
    fields[key]=body[key].replace(/[\u0000-\u001f\u007f]/g,' ').trim();
    if(!fields[key])throw Error('Please fill in your name, project and handle.');
  }
  return fields;
}
function sameOrigin(req){
  const extra=['VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL'].map(k=>process.env[k]&&'https://'+process.env[k]);
  if(process.env.NODE_ENV!=='production')extra.push('http://127.0.0.1:4417');
  return [...ORIGINS,...extra].filter(Boolean).includes(req.headers.origin);
}
export async function save(req,fields,token) {
  const now=Date.now(),id=crypto.randomUUID(),hash=dailyIPHash(req,'live-interview');
  const row={id,...fields,createdAt:new Date(now).toISOString()};
  const keys=[prefix+':submission:'+mac(token),prefix+':minute:'+hash,prefix+':hour:'+hash,prefix+':record:'+id,prefix+':index'];
  const result=await redis(['EVAL',`local saved=redis.call('GET',KEYS[1]);if saved then return {200,saved} end
local cooldown=redis.call('TTL',KEYS[2]);if cooldown>0 then return {429,tostring(cooldown)} end
if tonumber(redis.call('GET',KEYS[3]) or '0')>=3 then return {429,tostring(redis.call('TTL',KEYS[3]))} end
redis.call('INCR',KEYS[3]);if redis.call('TTL',KEYS[3])<0 then redis.call('EXPIRE',KEYS[3],3600) end
redis.call('SET',KEYS[2],'1','EX',60);redis.call('SET',KEYS[1],ARGV[1],'EX',1800)
redis.call('SET',KEYS[4],ARGV[2],'EX',ARGV[3]);redis.call('ZREMRANGEBYSCORE',KEYS[5],'-inf',ARGV[5])
redis.call('ZADD',KEYS[5],ARGV[4],ARGV[1]);redis.call('EXPIRE',KEYS[5],ARGV[3]);return {201,ARGV[1]}`,keys.length,...keys,id,JSON.stringify(row),RETENTION,now,now-RETENTION*1000]);
  return {status:Number(result[0]),value:result[1]};
}
export default async function interviews(req,res) {
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  try {
    if(req.query.interviews==='1'){
      if(req.method!=='GET')return res.status(405).json({error:'Use GET.'});
      if((await getSession(req))?.email!=='gabriel@corvus.gent')return res.status(401).json({error:'Owner login required.'});
      const ids=await redis(['ZREVRANGEBYSCORE',prefix+':index','+inf',Date.now()-RETENTION*1000,'LIMIT',0,200]);
      const rows=ids.length?await pipeline(ids.map(id=>['GET',prefix+':record:'+id])):[];
      return res.status(200).json({interviews:rows.filter(Boolean).map(JSON.parse)});
    }
    if(req.method==='GET')return res.status(200).json(challenge());
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Use POST.'});}
    if(!sameOrigin(req))return res.status(403).json({error:'Please use the form on corvus.gent.'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Use JSON.'});
    let body=req.body;
    if(typeof body==='string'){if(Buffer.byteLength(body)>2048)return res.status(413).json({error:'Please keep it short.'});try{body=JSON.parse(body);}catch{return res.status(400).json({error:'Please check the form.'});}}
    if(Buffer.byteLength(JSON.stringify(body||{}))>2048)return res.status(413).json({error:'Please keep it short.'});
    let fields;try{fields=validate(body);}catch(e){return res.status(400).json({error:e.message});}
    if(!validChallenge(body.token))return res.status(400).json({error:'Please reload the form and try again.'});
    const result=await save(req,fields,body.token);
    if(result.status===429){res.setHeader('Retry-After',String(result.value));return res.status(429).json({error:'One request at a time. Try again shortly.',retryAfter:Number(result.value)});}
    return res.status(result.status).json({ok:true,id:result.value});
  }catch{return res.status(503).json({error:'The form is taking a breather. Please DM Gabe instead.'});}
}
