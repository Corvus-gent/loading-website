import {eligibility,RULE_VERSION} from './eligibility.js';
import {voteCode} from '../../../compound/v2/config.js';
import {redis,pipeline} from '../../_redis.js';
import {key,videos} from '../store.js';
import {SEEDS} from '../../../compound/impact/config.js';
import {postInfo,validate,publicPost,METRICS,score} from './model.js';
export const ikey=p=>key('impact:'+p);
const parse=x=>{try{return JSON.parse(x);}catch{return null;}};
const obj=x=>Array.isArray(x)?Object.fromEntries(Array.from({length:x.length/2},(_,i)=>[x[i*2],x[i*2+1]])):x||{};
export async function records(){
 const [registry,raw,assets]=await Promise.all([videos(),redis(['HVALS',ikey('posts')]),redis(['HGETALL',key('export-assets')])]);
 const overrides=new Map(raw.map(parse).filter(Boolean).map(v=>[v.id,v])),byID=new Map(),assetMap=obj(assets);
 for(const v of registry){if(v.is_example||!v.post_url)continue;let info;try{info=postInfo(v.post_url);}catch{continue;}
 const made=false;
 const row={...info,slug:v.slug,label:v.hook_line||v.slug,account:info.account||v.account,posted_at:v.posted_at,made_with_compound:made,metric_source:v.metric_source||'manual',metrics_at:v.updated_at,views:v.views,likes:v.likes,comments:v.comments,shares:v.shares,saves:v.saves??null};
 const o=overrides.get(info.id);if(o){Object.assign(row,o);if(Date.parse(v.updated_at)>Date.parse(o.metrics_at||0)){for(const k of METRICS)if(v[k]!=null)row[k]=v[k];row.metrics_at=v.updated_at;row.metric_source=v.metric_source;}}
 const previous=byID.get(info.id);if(!previous||Date.parse(row.metrics_at||0)>Date.parse(previous.metrics_at||0))byID.set(info.id,row);
 }
 for(const row of overrides.values())if(!byID.has(row.id))byID.set(row.id,row);
 return [...byID.values()].map(row=>{const linked=registry.find(v=>!v.is_example&&v.slug===row.slug&&v.post_url&&(()=>{try{return postInfo(v.post_url).id===row.id;}catch{return false;}})());row.registry_match=!!linked;row.vote_code=linked?voteCode(linked):row.vote_code||null;row.made_with_compound=eligibility(row).eligible;return row;});
}
export async function save(raw,{source='manual',expected,seed=false}={}){
 const info=postInfo(raw.post_url),old=await redis(['HGET',ikey('posts'),postInfo(raw.post_url).id]),existing=(await records()).find(p=>p.id===info.id)||{},next=validate(raw,existing);
 if(source==='manual'&&raw.made_with_compound!==undefined){next.manual_approved=raw.made_with_compound;next.compound_excluded=!raw.made_with_compound;}
 const rule=eligibility(next);if(raw.made_with_compound===true&&!rule.eligible)throw Error(rule.reasons.join(' '));next.made_with_compound=rule.eligible;
 const now=new Date().toISOString();if(METRICS.some(k=>raw[k]!=null&&raw[k]!=='')){next.metric_source=source;next.metrics_at=now;}else{next.metric_source??='unreported';next.metrics_at??=null;}
 if(seed){next.measured_date=raw.measured_date;next.metrics_at=null;}
 else delete next.measured_date;
 const hours=(Date.parse(next.metrics_at)-Date.parse(next.posted_at))/3600000;if(hours>0&&hours<=24)next.first24_velocity=score(next)/Math.max(hours,1/60);
 const linked=(await videos()).filter(v=>v.post_url&&(()=>{try{return postInfo(v.post_url).id===info.id;}catch{return false;}})());
 // Transaction updates the canonical v2 rows and the impact annotation together.
 if(expected&&JSON.stringify(publicPost(existing))!==JSON.stringify(publicPost(expected)))return false;
 const changes=[];for(const row of (seed?[]:linked)){const current=await redis(['HGET',key('videos'),row.slug]);if(!current)continue;const value=JSON.parse(current);const patch={...value};for(const k of METRICS)if(raw[k]!=null&&raw[k]!=='')patch[k]=next[k];patch.updated_at=now;patch.metric_source=source;if(source!=='manual')patch.synced_at=now;changes.push({slug:row.slug,old:current,next:JSON.stringify(patch)});}
 const result=await redis(['EVAL',`if ARGV[4]=='1' and redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 0 end
if (redis.call('HGET',KEYS[1],ARGV[1]) or '')~=ARGV[2] then return -2 end
if redis.call('HLEN',KEYS[1])>=1200 and redis.call('HEXISTS',KEYS[1],ARGV[1])==0 then return -1 end
local changes=cjson.decode(ARGV[5]);for _,c in ipairs(changes) do if (redis.call('HGET',KEYS[2],c.slug) or '')~=c.old then return -2 end end
redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]);for _,c in ipairs(changes) do redis.call('HSET',KEYS[2],c.slug,c.next) end
redis.call('LPUSH',KEYS[3],ARGV[3]);redis.call('LTRIM',KEYS[3],0,1999);redis.call('EXPIRE',KEYS[3],31536000);return 1`,3,ikey('posts'),key('videos'),ikey('history:'+info.id),info.id,old||'',JSON.stringify(next),seed?'1':'0',JSON.stringify(changes)]);
 if(Number(result)===-2){if(expected)return false;throw Error('This post changed. Please save again.');}if(Number(result)<0)throw Error('Impact registry is full.');return next;
}
export async function seed(){for(const row of SEEDS)if(!Number(await redis(['HEXISTS',ikey('posts'),postInfo(row.post_url).id])))await save(row,{seed:true});}
export async function clickReport(){const [all,day]=await pipeline([['HGETALL',ikey('clicks')],['HGETALL',ikey('clicks:'+new Date().toISOString().slice(0,10))]]);const today=obj(day),rows=Object.entries(obj(all)).map(([id,total])=>({id,label:id,total:Number(total),today:Number(today[id]||0),timeZone:'UTC'})).sort((a,b)=>b.total-a.total);return{total:rows.reduce((n,v)=>n+v.total,0),rows};}
export async function report({privateData=false}={}){
 const [all,clicks,history,status]=await Promise.all([records(),clickReport(),redis(['LRANGE',ikey('snapshots'),0,4319]),redis(['GET',ikey('sync-status')])]);
 const posts=all.filter(p=>privateData||p.made_with_compound).map(p=>({...publicPost(p),...(privateData?{eligibility:eligibility(p)}:{})})).sort((a,b)=>b.score-a.score),counted=posts.filter(p=>p.made_with_compound),totals={views:0,engagements:0,score:0,videos:counted.length};
 for(const p of counted)for(const k of ['views','engagements','score'])totals[k]+=Number(p[k]||0);
 return{posts,totals,clicks,history:history.map(parse).filter(s=>s?.rule_version===RULE_VERSION).reverse(),sync:parse(status),updated_at:new Date().toISOString()};
}
export async function snapshot(){const r=await report(),s={at:new Date().toISOString(),rule_version:RULE_VERSION,...r.totals};await redis(['EVAL',"redis.call('LPUSH',KEYS[1],ARGV[1]);redis.call('LTRIM',KEYS[1],0,4319);return 1",1,ikey('snapshots'),JSON.stringify(s)]);return s;}
