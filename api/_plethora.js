import crypto from 'node:crypto';
import {redis,pipeline} from './_redis.js';
import {dailyIPHash} from './_privacy.js';
import {getSession,safeEqual} from './_session.js';
import {PLETHORA_PLACEMENTS} from '../js/plethora-config.js';
const prefix=process.env.PLETHORA_TEST_PREFIX||(process.env.VERCEL_ENV==='production'?'plethora:v1':'plethora:preview:v1');
const DAY=86400000;
const object=value=>Array.isArray(value)?Object.fromEntries(Array.from({length:value.length/2},(_,i)=>[value[i*2],value[i*2+1]])):value||{};
export function publicConfig(){return{pt:/^\d{1,32}$/.test(process.env.PLETHORA_PT||'')?process.env.PLETHORA_PT:'',referralCode:String(process.env.PLETHORA_REFERRAL_CODE||'').trim().slice(0,128)};}
export function storeURL(placement){const config=publicConfig(),url=new URL('https://apps.apple.com/app/id6770844623');url.searchParams.set('ct','corvus-'+placement);if(config.pt)url.searchParams.set('pt',config.pt);if(config.referralCode)url.searchParams.set('ref',config.referralCode);return url.href;}
export function destination(req,placement){const ua=String(req.headers['user-agent']||'');return /iPhone|iPad|iPod/i.test(ua)||req.query.ios==='1'||req.query.store==='1'?storeURL(placement):'/plethora/?placement='+encodeURIComponent(placement)+'#get';}
const human=req=>req.method==='GET'&&!/bot|crawler|spider|preview|facebookexternalhit|slack|discord|whatsapp|twitterbot|curl|wget|headless/i.test(String(req.headers['user-agent']||''))&&!/prefetch/i.test(String(req.headers.purpose||req.headers['sec-purpose']||''));
export async function track(req,placement,now=Date.now()){
 if(!human(req))return false;
 const keys=[0,DAY].map(offset=>prefix+':dedupe:'+placement+':'+dailyIPHash(req,'plethora-'+placement,new Date(now-offset)));
 // Anonymous aggregate counters persist; unlinkable anti-repeat hashes expire in 30m.
 // Recent random samples contain no identity and expire after 25h. ZCOUNT makes a
 // rolling 24h window exact, including across Brussels midnight and DST changes.
 return Number(await redis(['EVAL',`if redis.call('EXISTS',KEYS[1])==1 or redis.call('EXISTS',KEYS[2])==1 then return 0 end
redis.call('SET',KEYS[1],'1','EX',1800)
redis.call('HINCRBY',KEYS[3],ARGV[1],1)
redis.call('ZREMRANGEBYSCORE',KEYS[4],'-inf',ARGV[3])
redis.call('ZADD',KEYS[4],ARGV[2],ARGV[4]);redis.call('EXPIRE',KEYS[4],90000)
return 1`,4,...keys,prefix+':clicks',prefix+':recent:'+placement,placement,now,now-DAY,now+':'+crypto.randomBytes(8).toString('hex')]))===1;
}
async function authorized(req){const token=String(req.headers.authorization||'').replace(/^Bearer /,''),expected=process.env.PLETHORA_ADMIN_KEY;if(expected&&safeEqual(token,expected))return true;return (await getSession(req))?.email==='gabriel@corvus.gent';}
export async function report(){const ids=Object.keys(PLETHORA_PLACEMENTS),[totals,...recent]=await pipeline([['HGETALL',prefix+':clicks'],...ids.map(id=>['ZCOUNT',prefix+':recent:'+id,Date.now()-DAY,'+inf'])]);const counts=object(totals);const rows=ids.map((id,i)=>({id:'plethora-'+id,label:PLETHORA_PLACEMENTS[id],total:Number(counts[id]||0),last24h:Number(recent[i]||0)})).sort((a,b)=>b.total-a.total||b.last24h-a.last24h||a.id.localeCompare(b.id));return{rows,total:rows.reduce((n,r)=>n+r.total,0),last24h:rows.reduce((n,r)=>n+r.last24h,0),updated:new Date().toISOString()};}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'Use GET.'});}
 if(req.query.slug){const placement=String(req.query.slug).replace(/^plethora-/,'');if(!Object.hasOwn(PLETHORA_PLACEMENTS,placement))return res.status(404).json({error:'Unknown placement.'});try{await track(req,placement);}catch{/* A counter outage must never break a referral link. */}res.setHeader('Vary','User-Agent');res.setHeader('Location',destination(req,placement));return res.status(302).end();}
 try{
  if(req.query.action==='admin'){if(!await authorized(req))return res.status(401).json({error:'Sign in as Gabe or use the private access key.'});return res.status(200).json({...await report(),...publicConfig()});}
  const counts=object(await redis(['HGETALL',prefix+':clicks']));res.setHeader('Cache-Control','public, max-age=30, s-maxage=60, stale-while-revalidate=300');return res.status(200).json({...publicConfig(),total:Object.values(counts).reduce((n,v)=>n+Number(v||0),0),ready:true});
 }catch{return res.status(req.query.action==='admin'?503:200).json({...publicConfig(),ready:false,error:'Click counts are reconnecting.'});}
}
