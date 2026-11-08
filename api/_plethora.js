import crypto from 'node:crypto';
import {redis,pipeline} from './_redis.js';
import {dailyIPHash} from './_privacy.js';
import {getSession,safeEqual} from './_session.js';
import {PLETHORA_PLACEMENTS,PLETHORA_ALIASES,PLETHORA_CATEGORIES,canonicalPlacement,destinationKind,officialURL} from '../js/plethora-config.js';
// Existing aggregate keys are retained. Preview/test traffic is isolated.
const prefix=process.env.PLETHORA_TEST_PREFIX||(process.env.VERCEL_ENV==='production'?'plethora:v1':'plethora:preview:v1');
const snapshotPrefix=process.env.PLETHORA_TEST_PREFIX?prefix+':snapshot':process.env.VERCEL_ENV==='production'?'stats:plethora':'stats:plethora:preview';
const DAY=86400000,ids=Object.keys(PLETHORA_PLACEMENTS),aliases=Object.keys(PLETHORA_ALIASES),all=[...ids,...aliases];
const object=v=>Array.isArray(v)?Object.fromEntries(Array.from({length:v.length/2},(_,i)=>[v[i*2],v[i*2+1]])):v||{};
const sum=v=>Object.values(v).reduce((n,x)=>n+Number(x||0),0);
const ptFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
function ptParts(now){return Object.fromEntries(ptFormat.formatToParts(new Date(now)).map(p=>[p.type,p.value]));}
export function ptDay(now=Date.now()){const p=ptParts(now);return `${p.year}-${p.month}-${p.day}`;}
const previousDays=(day,count)=>Array.from({length:count},(_,i)=>new Date(Date.parse(day+'T12:00:00Z')-(count-1-i)*DAY).toISOString().slice(0,10));
export const publicConfig=()=>({referralCode:'GABE'});
export function platform(req){const ua=String(req.headers['user-agent']||'');return /iPhone|iPad|iPod/i.test(ua)?'ios':/Android/i.test(ua)?'android':'desktop';}
export const destination=(_req,placement)=>officialURL(placement);
const human=req=>req.method==='GET'&&!/bot|crawler|spider|preview|facebookexternalhit|slack|discord|whatsapp|twitterbot|curl|wget|headless/i.test(String(req.headers['user-agent']||''))&&!/prefetch/i.test(String(req.headers.purpose||req.headers['sec-purpose']||''));
export async function track(req,placement,now=Date.now()){
 placement=canonicalPlacement(placement);if(!placement||!human(req))return false;
 const names=[placement,...aliases.filter(a=>PLETHORA_ALIASES[a]===placement)],dedupe=names.flatMap(id=>[0,DAY].map(offset=>prefix+':dedupe:'+id+':'+dailyIPHash(req,'plethora-'+id,new Date(now-offset))));
 const device=platform(req),kind=destinationKind(placement),country=/^[A-Z]{2}$/.test(String(req.headers['x-vercel-ip-country']||''))?req.headers['x-vercel-ip-country']:'ZZ',day=ptDay(now);
 const entry={placement,destination:kind,device,country,timestamp:new Date(now).toISOString(),nonce:crypto.randomBytes(8).toString('hex')};
 const fields=[placement,kind,device,country].join('|');
 const keys=[...dedupe,...['clicks','raw','platforms','destinations','recent:'+placement,'events:'+new Date(now).toISOString().slice(0,10),'ptday:'+day,'ptdays','official-start','legacy:clicks'].map(k=>prefix+':'+k)];
 // One atomic write: raw clicks always increment, even when the deduped click does not.
 // No IP/hash is included in event records. Raw records expire after seven days;
 // non-identifying daily totals and historical snapshots have no TTL.
 const lua=`local n=tonumber(ARGV[1]);local k=n;local unique=1
if redis.call('SET',KEYS[k+9],ARGV[3],'NX') then
 local old=redis.call('HGETALL',KEYS[k+1]);for i=1,#old,2 do redis.call('HSET',KEYS[k+10],old[i],old[i+1]) end
end
for i=1,n do if redis.call('EXISTS',KEYS[i])==1 then unique=0 end end
redis.call('HINCRBY',KEYS[k+2],ARGV[2],1)
redis.call('ZREMRANGEBYSCORE',KEYS[k+6],'-inf',ARGV[8]);redis.call('ZADD',KEYS[k+6],ARGV[3],ARGV[4]);redis.call('EXPIREAT',KEYS[k+6],ARGV[12])
redis.call('HINCRBY',KEYS[k+7],'r|'..ARGV[5],1);redis.call('ZADD',KEYS[k+8],ARGV[10],ARGV[9])
if unique==1 then
 redis.call('SET',KEYS[1],'1','EX',1800)
 redis.call('HINCRBY',KEYS[k+1],ARGV[2],1);redis.call('HINCRBY',KEYS[k+3],ARGV[6],1);redis.call('HINCRBY',KEYS[k+4],ARGV[7],1)
 redis.call('ZREMRANGEBYSCORE',KEYS[k+5],'-inf',ARGV[11]);redis.call('ZADD',KEYS[k+5],ARGV[3],ARGV[4]);redis.call('EXPIRE',KEYS[k+5],90000)
 redis.call('HINCRBY',KEYS[k+7],'u|'..ARGV[5],1)
end
return unique`;
 return Number(await redis(['EVAL',lua,keys.length,...keys,dedupe.length,placement,now,JSON.stringify(entry),fields,device,kind,now-7*DAY,day,Date.parse(day+'T00:00:00Z'),now-DAY,Math.floor(now/DAY)*86400+7*86400]))===1;
}
async function authorized(req){const token=String(req.headers.authorization||'').replace(/^Bearer /,''),expected=process.env.PLETHORA_ADMIN_KEY;if(expected&&safeEqual(token,expected))return true;return (await getSession(req))?.email==='gabriel@corvus.gent';}
function dailyRows(hash){
 const rows=new Map();for(const [field,count]of Object.entries(object(hash))){const[mode,placement,destination,device,country]=field.split('|');if(!['r','u'].includes(mode)||!country)continue;const key=[placement,destination,device,country].join('|');if(!rows.has(key))rows.set(key,{placement,destination,device,country,total:0,raw:0});rows.get(key)[mode==='u'?'total':'raw']+=Number(count);}
 return [...rows.values()].sort((a,b)=>b.total-a.total||a.placement.localeCompare(b.placement));
}
function daySummary(day,hash,now){const rows=dailyRows(hash),destinations={download:0,ossman:0},platforms={ios:0,android:0,desktop:0};for(const row of rows){destinations[row.destination]+=row.total;platforms[row.device]+=row.total;}return{day,timeZone:'America/Los_Angeles',total:rows.reduce((n,r)=>n+r.total,0),raw:rows.reduce((n,r)=>n+r.raw,0),destinations,platforms,rows,savedAt:new Date(now).toISOString()};}
export async function report(now=Date.now()){
 const days=previousDays(ptDay(now),7),commands=[['HGETALL',prefix+':clicks'],['HGETALL',prefix+':raw'],['HGETALL',prefix+':platforms'],['HGETALL',prefix+':destinations'],['GET',prefix+':official-start'],['GET',prefix+':snapshot-last'],...all.map(id=>['ZCOUNT',prefix+':recent:'+id,now-DAY,'+inf']),...days.map(day=>['HGETALL',prefix+':ptday:'+day])];
 const[totals,rawTotals,platformRows,destinationRows,started,lastSnapshot,...rest]=await pipeline(commands);
 const counts=object(totals),raw=object(rawTotals),recent=Object.fromEntries(all.map((id,i)=>[id,Number(rest[i]||0)])),daily=rest.slice(all.length).map(dailyRows),startDay=started?ptDay(Number(started)):null;
 const rows=ids.map(id=>{const names=[id,...aliases.filter(a=>PLETHORA_ALIASES[a]===id)];return{id:'plethora-'+id,label:PLETHORA_PLACEMENTS[id],category:Object.keys(PLETHORA_CATEGORIES).find(c=>PLETHORA_CATEGORIES[c].includes(id)),destination:destinationKind(id),total:names.reduce((n,k)=>n+Number(counts[k]||0),0),raw:Number(raw[id]||0),last24h:names.reduce((n,k)=>n+recent[k],0),series:days.map((day,i)=>startDay&&day>=startDay?daily[i].filter(r=>r.placement===id).reduce((n,r)=>n+r.total,0):null)};}).sort((a,b)=>b.total-a.total||b.last24h-a.last24h||a.id.localeCompare(b.id));
 const total=rows.reduce((n,r)=>n+r.total,0),platforms=Object.fromEntries(['ios','android','desktop'].map(p=>[p,Number(object(platformRows)[p]||0)])),destinations=Object.fromEntries(['download','ossman'].map(p=>[p,Number(object(destinationRows)[p]||0)]));
 platforms.unknown=Math.max(0,total-sum(platforms));destinations.unknown=Math.max(0,total-sum(destinations));
 return{rows,total,raw:sum(raw),last24h:rows.reduce((n,r)=>n+r.last24h,0),platforms,destinations,categories:Object.keys(PLETHORA_CATEGORIES).map(name=>({name,total:rows.filter(r=>r.category===name).reduce((n,r)=>n+r.total,0),last24h:rows.filter(r=>r.category===name).reduce((n,r)=>n+r.last24h,0)})),history:days.map((day,i)=>({day,total:startDay&&day>=startDay?rows.reduce((n,r)=>n+(r.series[i]||0),0):null})),historyStarted:started?new Date(Number(started)).toISOString():null,snapshotAt:lastSnapshot?new Date(Number(lastSnapshot)).toISOString():null,timeZone:'America/Los_Angeles',updated:new Date(now).toISOString()};
}
export async function snapshot(now=Date.now(),catchup=false){
 if(!catchup&&ptParts(now).hour!=='00')return{skipped:true,reason:'not midnight Pacific'};
 const today=ptDay(now),started=await redis(['GET',prefix+':official-start']);
 // Archive surviving pre-upgrade UTC history before its former 9-day TTL expires.
 const legacyDays=previousDays(new Date(now).toISOString().slice(0,10),9),legacy=await pipeline(legacyDays.map(day=>['HGETALL',prefix+':day:'+day]));
 const archive=legacy.flatMap((h,i)=>Object.keys(object(h)).length?[['SET',snapshotPrefix+':legacy-utc:'+legacyDays[i],JSON.stringify({day:legacyDays[i],timeZone:'UTC',placements:object(h)}),'NX']]:[]);
 if(archive.length)await pipeline(archive);
 if(!started){await redis(['SET',prefix+':snapshot-last',now]);return{saved:0,legacyArchived:archive.length};}
 const indexed=await redis(['ZRANGE',prefix+':ptdays',0,-1]),yesterday=previousDays(today,2)[0];
 // Include yesterday even with zero clicks. Daily hashes are permanent, so a missed
 // cron can always catch up. Re-write recent days to include in-flight late writes.
 const days=[...new Set([...indexed.filter(day=>day<today),...(ptDay(Number(started))<=yesterday?[yesterday]:[])])].sort();
 let saved=0;
 for(let i=0;i<days.length;i+=100){const batch=days.slice(i,i+100),hashes=await pipeline(batch.map(day=>['HGETALL',prefix+':ptday:'+day]));await pipeline(batch.map((day,j)=>['SET',snapshotPrefix+':'+day,JSON.stringify(daySummary(day,hashes[j],now))]));saved+=batch.length;}
 await redis(['SET',prefix+':snapshot-last',now]);return{saved,legacyArchived:archive.length};
}
export async function csv(){
 const days=await redis(['ZRANGE',prefix+':ptdays',0,-1]);const lines=['day_pt,placement,destination,device,country,deduped_clicks,raw_clicks'];
 const started=await redis(['GET',prefix+':official-start']);
 const legacy=object(await redis(['HGETALL',prefix+(started?':legacy:clicks':':clicks')]));
 // Historical totals remain available, but unknown old dimensions are never invented.
 for(const[id,count]of Object.entries(legacy))if(Number(count))lines.push(['legacy',canonicalPlacement(id)||'unknown','unknown','unknown','unknown',Number(count),''].join(','));
 for(let i=0;i<days.length;i+=100){const batch=days.slice(i,i+100),hashes=await pipeline(batch.map(day=>['HGETALL',prefix+':ptday:'+day]));batch.forEach((day,j)=>{for(const r of dailyRows(hashes[j]))lines.push([day,r.placement,r.destination,r.device,r.country,r.total,r.raw].join(','));});}
 return lines.join('\r\n')+'\r\n';
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'Use GET.'});}
 if(req.query.slug){const placement=canonicalPlacement(req.query.slug);if(!placement)return res.status(404).json({error:'Unknown placement.'});try{await track(req,placement);}catch{/* Counter outages must never break official links. */}res.setHeader('Location',destination(req,placement));return res.status(302).end();}
 try{
  if(req.query.action==='snapshot'){
   const cron=process.env.CRON_SECRET&&safeEqual(req.headers.authorization||'','Bearer '+process.env.CRON_SECRET),admin=cron?false:await authorized(req);
   if(!cron&&!admin)return res.status(401).json({error:'Unauthorized'});
   return res.status(200).json(await snapshot(Date.now(),admin&&req.query.catchup==='1'));
  }
  if(req.query.action==='admin'&&!await authorized(req))return res.status(401).json({error:'Sign in as Gabe or use the private access key.'});
  if(req.query.action==='csv'){res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="plethora-stats.csv"');res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');return res.status(200).end(await csv());}
  if(['stats','admin'].includes(req.query.action)){if(req.query.action==='stats')res.setHeader('Cache-Control','public, max-age=0, s-maxage=15, stale-while-revalidate=30');return res.status(200).json({...await report(),...publicConfig(),ready:true});}
  const counts=object(await redis(['HGETALL',prefix+':clicks']));res.setHeader('Cache-Control','public, max-age=0, s-maxage=15, stale-while-revalidate=30');return res.status(200).json({...publicConfig(),total:sum(counts),ready:true});
 }catch{return res.status(['admin','csv','snapshot'].includes(req.query.action)?503:200).json({...publicConfig(),ready:false,error:'Click counts are reconnecting.'});}
}
