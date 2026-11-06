import {redis,connected} from './_redis.js';
import {ORIGINS} from './_privacy.js';
import {pathCategory} from '../js/analytics-policy.js';
export const countDay=(at=Date.now())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(at);
const increment=`
 local n=redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],120)
 if n>6000 then return 0 end
 redis.call('INCR',KEYS[2]);redis.call('EXPIRE',KEYS[2],34560000)
 redis.call('INCR',KEYS[3])
 if ARGV[1]~='' then redis.call('HINCRBY',KEYS[4],ARGV[1],1);redis.call('EXPIRE',KEYS[4],34560000) end
 return 1`;
// No identifier, IP hash, cookie or request headers are persisted. Abuse limits
// are global minute buckets, deliberately not per-person limits.
export function createCountHandler({store=redis,ready=connected,now=Date.now,soldier=false}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'method'});
  if(!ORIGINS.includes(req.headers.origin||''))return res.status(403).json({error:'origin'});
  const body=req.body,day=countDay(now());
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['page','day'].includes(k))||body.day!==day||(!soldier&&(typeof body.page!=='string'||body.page.length>160)))return res.status(400).json({error:'invalid hit'});
  if(!ready())return res.status(503).json({error:'count unavailable'});
  const page=soldier?'':pathCategory(body.page);
  if(!soldier&&/^\/(?:stats\/)?private(?:\/|$)|^\/music\/admin(?:\/|$)/.test(body.page))return res.status(204).end();
  const prefix=soldier?'soldiers:ok':'unseen:hits';
  try{
   const ok=await store(['EVAL',increment,'4',`counting:limit:${Math.floor(now()/60000)}`,`${prefix}:${day}`,`${prefix}:all`,`unseen:pages:${day}`,page]);
   if(!ok){res.setHeader('Retry-After','60');return res.status(429).json({error:'busy'});}
   return res.status(204).end();
  }catch{return res.status(503).json({error:'count unavailable'});}
 };
}
export const bareHit=createCountHandler();
export const noticeOK=createCountHandler({soldier:true});
export async function visitorCounters(day,store=redis){
 const [unseen,all,today,total]=await store(['MGET',`unseen:hits:${day}`,'unseen:hits:all',`soldiers:ok:${day}`,'soldiers:ok:all']);
 return {unseen:{day:Number(unseen||0),all:Number(all||0)},soldiers:{day:Number(today||0),all:Number(total||0)}};
}
export async function armyHistory(query,store=redis,at=Date.now()){
 const days=Array.from({length:30},(_,i)=>countDay(at-i*86400000));
 const [ph,values]=await Promise.all([query(`SELECT toString(toDate(toTimeZone(timestamp,'Europe/Brussels'))),count(DISTINCT distinct_id) FROM events WHERE event='$pageview' AND properties.$host IN ('corvus.gent','www.corvus.gent','stats.corvus.gent') AND toDate(toTimeZone(timestamp,'Europe/Brussels'))>=toDate('${days.at(-1)}') GROUP BY 1`),store(['MGET',...days.flatMap(d=>['unseen:hits:'+d,'soldiers:ok:'+d])])]);
 return days.map((day,i)=>{const visitors=Number(ph.find(r=>r[0]===day)?.[1]||0)+Number(values[i*2]||0),soldiers=Number(values[i*2+1]||0);return [day,visitors,soldiers,visitors?(soldiers/visitors*100).toFixed(1)+'%':'—'];});
}
