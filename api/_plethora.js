import crypto from 'node:crypto';
import {redis,pipeline} from './_redis.js';
import {dailyIPHash} from './_privacy.js';
import {getSession,safeEqual} from './_session.js';
import {PLETHORA_PLACEMENTS,PLETHORA_ALIASES,PLETHORA_CATEGORIES,canonicalPlacement} from '../js/plethora-config.js';
// Retain v1 aggregate keys: the upgrade must not reset historical referrals.
const prefix=process.env.PLETHORA_TEST_PREFIX||(process.env.VERCEL_ENV==='production'?'plethora:v1':'plethora:preview:v1');
const DAY=86400000;
const object=value=>Array.isArray(value)?Object.fromEntries(Array.from({length:value.length/2},(_,i)=>[value[i*2],value[i*2+1]])):value||{};
export function publicConfig(){
 let playURL='';try{const u=new URL(process.env.PLETHORA_PLAY_URL);if(u.protocol==='https:'&&u.hostname==='play.google.com'&&u.pathname==='/store/apps/details'&&u.searchParams.get('id')&&!u.username&&!u.password)playURL=u.href;}catch{}
 return{pt:/^\d{1,32}$/.test(process.env.PLETHORA_PT||'')?process.env.PLETHORA_PT:'',playURL,referralCode:String(process.env.PLETHORA_REFERRAL_CODE||'').trim().slice(0,128)};
}
export function platform(req){const ua=String(req.headers['user-agent']||'');return /iPhone|iPad|iPod/i.test(ua)||req.query?.ios==='1'?'ios':/Android/i.test(ua)?'android':'desktop';}
export function storeURL(placement,os='ios'){
 const config=publicConfig();placement=canonicalPlacement(placement)||'bio-x';
 if(os==='android'){
  if(!config.playURL)return null;
  const url=new URL(config.playURL);url.searchParams.set('referrer',new URLSearchParams({utm_source:'corvus',utm_campaign:placement}).toString());
  if(config.referralCode)url.searchParams.set('ref',config.referralCode);return url.href;
 }
 const url=new URL('https://apps.apple.com/app/id6770844623');url.searchParams.set('ct','corvus-'+placement);if(config.pt)url.searchParams.set('pt',config.pt);if(config.referralCode)url.searchParams.set('ref',config.referralCode);return url.href;
}
export function destination(req,placement){
 const q=req.query||{},device=platform(req),chosen=q.store==='1'&&['ios','android'].includes(q.platform)?q.platform:device;
 if(chosen==='ios'||chosen==='android'||q.store==='1'){
  const target=storeURL(placement,chosen==='android'?'android':'ios');if(target)return target;
 }
 return '/plethora?from='+encodeURIComponent(placement)+(chosen==='android'?'&platform=android':'');
}
const human=req=>req.method==='GET'&&!/bot|crawler|spider|preview|facebookexternalhit|slack|discord|whatsapp|twitterbot|curl|wget|headless/i.test(String(req.headers['user-agent']||''))&&!/prefetch/i.test(String(req.headers.purpose||req.headers['sec-purpose']||''));
export async function track(req,placement,now=Date.now()){
 placement=canonicalPlacement(placement);if(!placement||!human(req)||req.query?.noCount==='1')return false;
 // Check the retired bio dedupe keys too, including yesterday's daily salt.
 const names=[placement,...Object.keys(PLETHORA_ALIASES).filter(id=>PLETHORA_ALIASES[id]===placement)],dedupe=names.flatMap(id=>[0,DAY].map(offset=>prefix+':dedupe:'+id+':'+dailyIPHash(req,'plethora-'+id,new Date(now-offset))));
 const keys=[...dedupe,prefix+':clicks',prefix+':recent:'+placement,prefix+':platforms',prefix+':day:'+new Date(now).toISOString().slice(0,10),prefix+':history-start'];
 const script=`local n=tonumber(ARGV[5]);for i=1,n do if redis.call('EXISTS',KEYS[i])==1 then return 0 end end
redis.call('SET',KEYS[1],'1','EX',1800)
redis.call('HINCRBY',KEYS[n+1],ARGV[1],1)
redis.call('ZREMRANGEBYSCORE',KEYS[n+2],'-inf',ARGV[3]);redis.call('ZADD',KEYS[n+2],ARGV[2],ARGV[4]);redis.call('EXPIRE',KEYS[n+2],90000)
redis.call('HINCRBY',KEYS[n+3],ARGV[6],1)
redis.call('HINCRBY',KEYS[n+4],ARGV[1],1);redis.call('EXPIRE',KEYS[n+4],777600)
redis.call('SET',KEYS[n+5],ARGV[2],'NX');return 1`;
 return Number(await redis(['EVAL',script,keys.length,...keys,placement,now,now-DAY,now+':'+crypto.randomBytes(8).toString('hex'),dedupe.length,platform(req)]))===1;
}
async function authorized(req){const token=String(req.headers.authorization||'').replace(/^Bearer /,''),expected=process.env.PLETHORA_ADMIN_KEY;if(expected&&safeEqual(token,expected))return true;return (await getSession(req))?.email==='gabriel@corvus.gent';}
export async function report(now=Date.now()){
 const ids=Object.keys(PLETHORA_PLACEMENTS),legacy=Object.keys(PLETHORA_ALIASES),all=[...ids,...legacy],days=Array.from({length:7},(_,i)=>new Date(now-(6-i)*DAY).toISOString().slice(0,10));
 const [totals,platformRows,started,...rest]=await pipeline([['HGETALL',prefix+':clicks'],['HGETALL',prefix+':platforms'],['GET',prefix+':history-start'],...all.map(id=>['ZCOUNT',prefix+':recent:'+id,now-DAY,'+inf']),...days.map(day=>['HGETALL',prefix+':day:'+day])]);
 const counts=object(totals),recent=Object.fromEntries(all.map((id,i)=>[id,Number(rest[i]||0)])),daily=rest.slice(all.length).map(object),startDay=started?new Date(Number(started)).toISOString().slice(0,10):null;
 const rows=ids.map(id=>{const names=[id,...legacy.filter(a=>PLETHORA_ALIASES[a]===id)];return{id:'plethora-'+id,label:PLETHORA_PLACEMENTS[id],category:Object.keys(PLETHORA_CATEGORIES).find(c=>PLETHORA_CATEGORIES[c].includes(id)),total:names.reduce((n,k)=>n+Number(counts[k]||0),0),last24h:names.reduce((n,k)=>n+recent[k],0),series:days.map((day,i)=>startDay&&day>=startDay?names.reduce((n,k)=>n+Number(daily[i][k]||0),0):null)};}).sort((a,b)=>b.total-a.total||b.last24h-a.last24h||a.id.localeCompare(b.id));
 const total=rows.reduce((n,r)=>n+r.total,0),platforms=Object.fromEntries(['ios','android','desktop'].map(p=>[p,Number(object(platformRows)[p]||0)]));platforms.unknown=Math.max(0,total-Object.values(platforms).reduce((a,b)=>a+b,0));
 return{rows,total,last24h:rows.reduce((n,r)=>n+r.last24h,0),platforms,categories:Object.keys(PLETHORA_CATEGORIES).map(name=>({name,total:rows.filter(r=>r.category===name).reduce((n,r)=>n+r.total,0),last24h:rows.filter(r=>r.category===name).reduce((n,r)=>n+r.last24h,0)})),history:days.map((day,i)=>({day,total:startDay&&day>=startDay?rows.reduce((n,r)=>n+(r.series[i]||0),0):null})),historyStarted:started?new Date(Number(started)).toISOString():null,updated:new Date(now).toISOString()};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'Use GET.'});}
 if(req.query.slug){const placement=canonicalPlacement(req.query.slug);if(!placement)return res.status(404).json({error:'Unknown placement.'});try{await track(req,placement);}catch{/* A counter outage must never break a referral link. */}res.setHeader('Vary','User-Agent');res.setHeader('Location',destination(req,placement));return res.status(302).end();}
 try{
  if(req.query.action==='admin'&&!await authorized(req))return res.status(401).json({error:'Sign in as Gabe or use the private access key.'});
  if(['stats','admin'].includes(req.query.action)){if(req.query.action==='stats')res.setHeader('Cache-Control','public, max-age=0, s-maxage=15, stale-while-revalidate=30');return res.status(200).json({...await report(),...publicConfig(),ready:true});}
  const counts=object(await redis(['HGETALL',prefix+':clicks']));res.setHeader('Cache-Control','public, max-age=0, s-maxage=15, stale-while-revalidate=30');return res.status(200).json({...publicConfig(),total:Object.values(counts).reduce((n,v)=>n+Number(v||0),0),ready:true});
 }catch{return res.status(req.query.action==='admin'?503:200).json({...publicConfig(),ready:false,error:'Click counts are reconnecting.'});}
}
