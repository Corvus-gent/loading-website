import {redis,pipeline} from '../_redis.js';
import {dailyIPHash} from '../_privacy.js';
import {PARTNERS} from '../../js/site/legion-config.js';
import {key} from './security.js';
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());
const obj=r=>Array.isArray(r)?Object.fromEntries(Array.from({length:r.length/2},(_,i)=>[r[i*2],r[i*2+1]])):r||{};
export async function count(req,id){if(!PARTNERS[id]||req.method!=='GET'||/bot|crawler|spider|preview|curl|wget|headless/i.test(req.headers['user-agent']||''))return false;
 const h=dailyIPHash(req,'partner-'+id),keys=[key('partner-dedupe:'+id+':'+h),key('partner-total'),key('partner-day:'+day())];return redis(['EVAL',"if not redis.call('SET',KEYS[1],'1','NX','EX',1800) then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('HINCRBY',KEYS[3],ARGV[1],1);redis.call('EXPIRE',KEYS[3],34560000);return 1",3,...keys,id]);}
export async function report(){const [t,d]=await pipeline([['HGETALL',key('partner-total')],['HGETALL',key('partner-day:'+day())]]),totals=obj(t),today=obj(d);return {rows:Object.keys(PARTNERS).map(id=>({id,label:PARTNERS[id].label,total:Number(totals[id]||0),today:Number(today[id]||0)})),total:Object.values(totals).reduce((a,v)=>a+Number(v),0)};}
export async function allPartners(){const local=await report(),rows=[...local.rows];
 try{const p=await (await import('../_plethora.js')).report();rows.push(...p.rows.map(r=>({id:r.id,label:r.label,total:r.total,today:r.series?.at(-1)??null,last24h:r.last24h})));}catch{}
 // Existing support and battle trackers retain their own data; no guessed counts.
 try{const {supportReport}=await import('../_support.js');const p=await supportReport();for(const r of p.rows||[])rows.push({...r,today:r.day});}catch{}
 return rows.sort((a,b)=>Number(b.total)-Number(a.total));}
