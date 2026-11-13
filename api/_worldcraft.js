import crypto from 'node:crypto';
import {redis} from './_redis.js';
import {rateLimit,dailyIPHash} from './_privacy.js';
const ids=['teach-the-village','bloom-quest','leaf-commander','storyrealm','fraction-kingdom','space-station','reef-rescue','boss-battle','teach-the-robot','memory-palace'];
const prefix=process.env.VERCEL_ENV==='preview'?'worldcraft:preview:v1':'worldcraft:v1';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const obj=x=>Array.isArray(x)?Object.fromEntries(Array.from({length:x.length/2},(_,i)=>[x[i*2],Number(x[i*2+1])])):x||{};
const cookie=req=>String(req.headers.cookie||'').match(/(?:^|;\s*)wc_visitor=([a-f0-9-]{36})(?:;|$)/)?.[1];
async function snapshot(visitor){const counts=obj(await redis(['HGETALL',prefix+':counts']));const comments=(await redis(['LRANGE',prefix+':public',0,19])||[]).map(JSON.parse);const pick=visitor?await redis(['HGET',prefix+':voters',hash(visitor)]):null;const done=visitor?Boolean(await redis(['HEXISTS',prefix+':commented',hash(visitor)])):false;return {counts:Object.fromEntries(ids.map(id=>[id,Number(counts[id]||0)])),comments,pick,commented:done,...(done?{reveal:'/sf/larp/photos/giant-duck.webp'}:{})};}
export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
try{
 if(req.query.admin==='1'){
  const password=process.env.WORLDCRAFT_ADMIN_PASSWORD||process.env.ADMIN_PASSWORD;
  if(!password)return res.status(503).json({error:'Set WORLDCRAFT_ADMIN_PASSWORD in Vercel to enable admin.'});
  if(!await rateLimit(prefix+':admin:'+dailyIPHash(req,'worldcraft-admin'),20,60))return res.status(429).json({error:'Try again in a minute.'});
  if(hash(req.headers.authorization||'')!==hash('Bearer '+password))return res.status(401).json({error:'Incorrect admin password.'});
  if(req.method!=='GET')return res.status(405).json({error:'Use GET.'});
  return res.status(200).json({...(await snapshot()),votes:await redis(['HGETALL',prefix+':voters']),entries:(await redis(['LRANGE',prefix+':private',0,999])||[]).map(JSON.parse),limit:1000});
 }
 if(req.method==='GET'){const id=String(req.headers['x-worldcraft-visitor']||'');return res.status(200).json(await snapshot(cookie(req)||(/^[a-f0-9-]{36}$/.test(id)?id:null)));}
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Use GET or POST.'});}
 const origin=req.headers.origin;
 const allowed=['https://corvus.gent','https://www.corvus.gent',...[process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL].filter(Boolean).map(x=>'https://'+x)];
 if(process.env.NODE_ENV!=='production')allowed.push('http://127.0.0.1:'+(process.env.WORLDCRAFT_TEST_PORT||4176));
 if(!allowed.includes(origin)||!String(req.headers['content-type']).startsWith('application/json'))return res.status(403).json({error:'Please use the voting page.'});
 if(!await rateLimit(prefix+':rate:'+dailyIPHash(req,'worldcraft'),30,60))return res.status(429).json({error:'Please wait a minute before trying again.'});
 if(Number(req.headers['content-length']||0)>4096)return res.status(413).json({error:'Message too long.'});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(b.visitor||''))return res.status(400).json({error:'Invalid visitor.'});
 const visitor=cookie(req)||b.visitor,voter=hash(visitor);
 res.setHeader('Set-Cookie',`wc_visitor=${visitor}; Path=/api/worldcraft; HttpOnly; SameSite=Lax; Max-Age=31536000${process.env.NODE_ENV==='production'?'; Secure':''}`);
 if(b.action==='vote'){
  if(!ids.includes(b.demo))return res.status(400).json({error:'Choose a demo.'});
  await redis(['EVAL',"local pick=redis.call('HGET',KEYS[1],ARGV[1]); if pick then return pick end; redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]); redis.call('HINCRBY',KEYS[2],ARGV[2],1); return ARGV[2]",2,prefix+':voters',prefix+':counts',voter,b.demo]);
 }else if(b.action==='comment'){
  const pick=await redis(['HGET',prefix+':voters',voter]);if(!pick)return res.status(409).json({error:'Vote before sharing your reason.'});
  const text=String(b.text||'').trim(),email=String(b.email||'').trim();
  if(text.length<3||text.length>600)return res.status(400).json({error:'Write 3–600 characters.'});
  if(/(?:@|https?:\/\/|www\.)/i.test(text)||/(?:\+?\d[\s().-]*){7,}/.test(text))return res.status(400).json({error:'Please keep contact details and links out of public comments.'});
  if(email&&(!b.adult||!b.consent||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return res.status(400).json({error:'An adult or parent must consent and enter a valid email for the raffle.'});
  const publicEntry={demo:pick,text,at:new Date().toISOString()};
  const privateEntry={...publicEntry,email:email||null,raffle:Boolean(email),adultConsent:Boolean(email&&b.adult&&b.consent)};
  await redis(['EVAL',"if redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 0 end; redis.call('HSET',KEYS[1],ARGV[1],1); redis.call('LPUSH',KEYS[2],ARGV[2]); redis.call('LTRIM',KEYS[2],0,19); redis.call('LPUSH',KEYS[3],ARGV[3]); return 1",3,prefix+':commented',prefix+':public',prefix+':private',voter,JSON.stringify(publicEntry),JSON.stringify(privateEntry)]);
 }else return res.status(400).json({error:'Unknown action.'});
 return res.status(200).json(await snapshot(visitor));
}catch{return res.status(503).json({error:'Voting is reconnecting. Nothing is confirmed until you see confirmation. Please try again.'});}
}
