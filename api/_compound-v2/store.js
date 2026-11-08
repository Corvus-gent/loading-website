import crypto from 'node:crypto';
import {redis,pipeline} from '../_redis.js';
import {prefix} from './security.js';
import {EXAMPLES,RETENTION,video as validate,METRICS} from './model.js';
export const key=(part)=>prefix+':'+part;
const object=x=>Array.isArray(x)?Object.fromEntries(Array.from({length:x.length/2},(_,i)=>[x[i*2],x[i*2+1]])):x||{};
export async function videos(){const rows=(await redis(['HVALS',key('videos')])).map(JSON.parse);const used=new Set(rows.map(v=>v.slug));return [...rows,...EXAMPLES.filter(v=>!used.has(v.slug))];}
export async function get(slug){const raw=await redis(['HGET',key('videos'),slug]);return raw?JSON.parse(raw):EXAMPLES.find(v=>v.slug===slug)||null;}
export async function save(raw,update=false){
 const row=validate(raw),exists=await redis(['HEXISTS',key('videos'),row.slug]);
 if(!update&&Number(exists))throw Error('slug already exists');
 const fields=JSON.stringify(row);
 const result=await redis(['EVAL',`if ARGV[3]=='create' and redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 0 end
+if redis.call('HLEN',KEYS[1])>=1000 and redis.call('HEXISTS',KEYS[1],ARGV[1])==0 then return -1 end
+redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]);redis.call('LPUSH',KEYS[2],ARGV[2]);redis.call('LTRIM',KEYS[2],0,199);redis.call('EXPIRE',KEYS[2],ARGV[4]);return 1`.replaceAll('\n+','\n'),2,key('videos'),key('metrics-history:'+row.slug),row.slug,fields,update?'update':'create',RETENTION]);
 if(Number(result)<=0)throw Error('slug exists or registry is full');return row;
}
export async function report(){
 const rows=await videos(),counts=rows.length?await pipeline(rows.map(v=>['HGETALL',key('counts:'+v.slug)])):[];
 const all=rows.map((v,i)=>{const c=object(counts[i]);const stats=Object.fromEntries(['pageview','up','down','feedback','share_click','outbound_click','code_entered','redirect'].map(k=>[k,Number(c[k]||0)]));return{...v,stats,votes:stats.up+stats.down,site_visits:stats.pageview,feedback_count:stats.feedback,ctr:v.views?stats.pageview/v.views:null};});
 const real=all.filter(v=>!v.is_example),totals={videos:real.length,views:0,likes:0,comments:0,shares:0,site_visits:0,votes:0,feedback_count:0};for(const v of real)for(const k of Object.keys(totals))if(k!=='videos')totals[k]+=v[k]||0;
 return{videos:all,totals,updated_at:new Date().toISOString(),metric_note:'Social views are reported per post; they are not unique people. Site visits are page opens. Examples are excluded from totals.'};
}
// Detailed events contain no text, handle, raw IP, cookie ID or full referrer URL.
export async function event(type,slug,{tags={},visitor=null,code=''}={}){
 const at=new Date().toISOString(),record={type,slug,...tags,lang:slug.split('-')[2]||'',visitor,timestamp:at};if(code)record.code=code;
 await redis(['EVAL',`redis.call('HINCRBY',KEYS[1],ARGV[1],1)
+if ARGV[3]=='1' then redis.call('LPUSH',KEYS[2],ARGV[2]);redis.call('LTRIM',KEYS[2],0,9999);redis.call('EXPIRE',KEYS[2],ARGV[4]) end;return 1`.replaceAll('\n+','\n'),2,key('counts:'+slug),key('events:'+at.slice(0,10)),type,JSON.stringify(record),visitor?'1':'0',RETENTION]);
}
export async function vote(uid,slug,choice){
 const result=await redis(['EVAL',`local old=redis.call('GET',KEYS[1]);if old then return {0,old} end
+redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);redis.call('HINCRBY',KEYS[2],ARGV[1],1);return {1,ARGV[1]}`.replaceAll('\n+','\n'),2,key('vote:'+slug+':'+uid),key('counts:'+slug),choice,RETENTION]);return{added:Number(result[0])===1,choice:result[1]};
}
export async function feedback(uid,slug,text,handle){
 const id=crypto.randomUUID(),fingerprint=crypto.createHash('sha256').update(text).digest('hex');
 const row={id,slug,text,handle,at:new Date().toISOString()};
 const added=await redis(['EVAL',`if not redis.call('SET',KEYS[1],'1','NX','EX',ARGV[1]) then return 0 end
+redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[1]);redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',ARGV[5]);redis.call('ZADD',KEYS[3],ARGV[3],ARGV[4]);redis.call('EXPIRE',KEYS[3],ARGV[1]);return 1`.replaceAll('\n+','\n'),3,key('feedback-once:'+slug+':'+uid+':'+fingerprint),key('feedback:'+id),key('feedback-index'),RETENTION,JSON.stringify(row),Date.now(),id,Date.now()-RETENTION*1000]);return{added:Number(added)===1,id};
}
export async function privateFeedback(){const ids=await redis(['ZREVRANGEBYSCORE',key('feedback-index'),'+inf',Date.now()-RETENTION*1000,'LIMIT',0,200]);return ids.length?(await pipeline(ids.map(id=>['GET',key('feedback:'+id)]))).filter(Boolean).map(JSON.parse):[];}
export async function hideFeedback(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('invalid feedback');await pipeline([['DEL',key('feedback:'+id)],['ZREM',key('feedback-index'),id]]);}
