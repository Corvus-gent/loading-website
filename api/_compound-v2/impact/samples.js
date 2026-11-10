import {redis} from '../../_redis.js';
import {ikey} from './store.js';
import {bestSample,FIELDS,coverage} from '../../../compound/impact/metrics.js';
// Bucket by the original observation time, never by migration time. Missing hours stay empty.
export function hourSamples(history){const hours=new Map();for(const row of history){
 const t=Date.parse(row.metrics_at);if(!Number.isFinite(t)||coverage(row).score==null||row.measured_date)continue;
 const hour=new Date(t).toISOString().slice(0,13),sample={posted_at:row.posted_at,platform:row.platform,metrics_at:row.metrics_at,...Object.fromEntries(FIELDS.filter(k=>row[k]!=null).map(k=>[k,row[k]]))};
 const old=hours.get(hour);if(!old||t>Date.parse(old.metrics_at)||(t===Date.parse(old.metrics_at)&&coverage(sample).known.length>coverage(old).known.length))hours.set(hour,sample);}
 return hours;}
export async function rebuildHistory(row){const raw=await redis(['HGET',ikey('posts'),row.id]);if(!raw)return{hours:0,first:false};
 const doc=JSON.parse(raw),history=(await redis(['LRANGE',ikey('history:'+row.id),0,-1])).map(s=>JSON.parse(s)),hours=hourSamples([...history,doc]),first=bestSample([...hours.values()].filter(s=>Date.parse(s.posted_at)===Date.parse(doc.posted_at)));
 const values=[...hours].flatMap(([h,s])=>[h,JSON.stringify(s)]);if(values.length)await redis(['HSET',ikey('hours:'+row.id),...values]);
 if(first&&(!doc.first24_sample||Date.parse(first.at)>=Date.parse(doc.first24_sample.at))){doc.first24_sample=first;doc.first24_velocity=first.velocity;
 await redis(['EVAL',"if redis.call('HGET',KEYS[1],ARGV[1])==ARGV[2] then return redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]) end; return -1",1,ikey('posts'),row.id,raw,JSON.stringify(doc)]);}
 return{hours:hours.size,first:!!first};}
