import {redis,pipeline} from '../_redis.js';
import {dailyIPHash} from '../_privacy.js';
import {PARTNERS} from '../../js/site/legion-config.js';
import {key} from './security.js';
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());
const obj=r=>Array.isArray(r)?Object.fromEntries(Array.from({length:r.length/2},(_,i)=>[r[i*2],r[i*2+1]])):r||{};
export async function count(req,id){if(!PARTNERS[id]||req.method!=='GET'||/bot|crawler|spider|preview|curl|wget|headless/i.test(req.headers['user-agent']||''))return false;
 const h=dailyIPHash(req,'partner-'+id),keys=[key('partner-dedupe:'+id+':'+h),key('partner-total'),key('partner-day:'+day())];return redis(['EVAL',"if not redis.call('SET',KEYS[1],'1','NX','EX',1800) then return 0 end;redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('HINCRBY',KEYS[3],ARGV[1],1);redis.call('EXPIRE',KEYS[3],34560000);return 1",3,...keys,id]);}
export async function report(){const [t,d]=await pipeline([['HGETALL',key('partner-total')],['HGETALL',key('partner-day:'+day())]]),totals=obj(t),today=obj(d);return {rows:Object.keys(PARTNERS).map(id=>({id,label:PARTNERS[id].label,total:Number(totals[id]||0),today:Number(today[id]||0)})),total:Object.values(totals).reduce((a,v)=>a+Number(v),0)};}
export async function countShort(req,path){
 if(typeof path!=='string'||!/^\/go\/(?:ig|li|tt|x|luma|dc|wa|mail|qr|bmc|corvus)(?:\/[a-z0-9-]{1,48}){0,2}\/?$/.test(path))throw Error('fields');
 if(/bot|crawler|spider|preview|curl|wget|headless/i.test(req.headers['user-agent']||''))return {ok:true};
 const id=path.replace(/^\/go\/|\/$/g,''),ip=dailyIPHash(req,'short-'+id);await redis(['EVAL',"if redis.call('SET',KEYS[1],'1','NX','EX',1800) then redis.call('HINCRBY',KEYS[2],ARGV[1],1);redis.call('HINCRBY',KEYS[3],ARGV[1],1);redis.call('EXPIRE',KEYS[3],34560000) end;return 1",3,key('short-dedupe:'+id+':'+ip),key('short-total'),key('short-day:'+day()),id]);return {ok:true};
}
export async function allPartners(){const local=await report(),rows=[...local.rows];
 try{const p=await (await import('../_plethora.js')).report();rows.push(...p.rows.map(r=>({id:r.id,label:r.label,total:r.total,today:r.series?.at(-1)??null,last24h:r.last24h})));}catch{}
 // Existing trackers retain their own keys. A missing historical day is unknown, not zero.
 try{const {supportReport}=await import('../_support.js');const p=await supportReport();for(const r of p.rows||[])rows.push({...r,today:r.day});}catch{}
 try{const[a,d]=await pipeline([['HGETALL',key('short-total')],['HGETALL',key('short-day:'+day())]]);const today=obj(d);for(const[id,total]of Object.entries(obj(a)))rows.push({id,label:id,total:Number(total),today:Number(today[id]||0),note:'Aggregate tracking from 9 Nov 2026'});}catch{}
 const prod=process.env.VERCEL_ENV==='production',utcDay=new Date().toISOString().slice(0,10);
 try{const prefix=prod?'live:clicks':'live:preview:clicks';const [a,d]=await pipeline([['HGETALL',prefix+':all'],['HGETALL',prefix+':'+utcDay]]);const all=obj(a),today=obj(d);for(const id of ['twitch','instagram','twitter'])rows.push({id,label:id,total:Number(all[id]||0),today:Number(today[id]||0),timeZone:'UTC'});}catch{}
 try{const prefix=process.env.BATTLE_TEST_PREFIX||(prod?'battle:v1':'battle:preview:v1');const [a,d,started]=await pipeline([['HGETALL',prefix+':clicks'],['HGETALL',prefix+':clicks-day:'+utcDay],['GET',prefix+':clicks-daily-start']]);const all=obj(a),today=obj(d);for(const [short,fighter]of Object.entries({cx:'codex',cp:'compound',bio:'bio'}))for(const [p,platform]of Object.entries({tt:'tiktok',ig:'instagram',x:'x',li:'linkedin'})){const k=fighter+':'+platform;rows.push({id:short+'-'+p,label:'Battle · '+fighter+' · '+platform,total:Number(all[k]||0),today:started===utcDay?null:Number(today[k]||0),timeZone:'UTC',note:started===utcDay?'daily tracking starts today':undefined});}}catch{}
 return rows.sort((a,b)=>Number(b.total)-Number(a.total));}
