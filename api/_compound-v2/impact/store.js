import {sumKnown,sourceKind,firstDaySample,FIELDS} from '../../../compound/impact/metrics.js';
import {accountStatus,settings} from './accounts.js';
import {eligibility,classification,RULE_VERSION} from './eligibility.js';
import {voteCode} from '../../../compound/v2/config.js';
import {redis,pipeline} from '../../_redis.js';
import {key,videos} from '../store.js';
import {SEEDS} from '../../../compound/impact/config.js';
import {postInfo,validate,publicPost,METRICS,score} from './model.js';
import {accountHandle} from '../../../compound/impact/accounts.js';
export const ikey=p=>key('impact:'+p);
const parse=x=>{try{return JSON.parse(x);}catch{return null;}};
const obj=x=>Array.isArray(x)?Object.fromEntries(Array.from({length:x.length/2},(_,i)=>[x[i*2],x[i*2+1]])):x||{};
export async function records(cachedRegistry){
 const [registry,raw]=await Promise.all([cachedRegistry||videos(),redis(['HVALS',ikey('posts')])]);
 const overrides=new Map(raw.map(parse).filter(Boolean).map(v=>[v.id,v])),byID=new Map();
 for(const v of registry){if(v.is_example||!v.post_url)continue;let info;try{info=postInfo(v.post_url);}catch{continue;}
 const made=false;
 const row={...info,slug:v.slug,label:v.hook_line||v.slug,account:info.account||v.account,posted_at:v.posted_at,made_with_compound:made,metric_source:v.metric_source||'manual',metrics_at:v.updated_at,view_metric:v.view_metric,views:v.views,likes:v.likes,comments:v.comments,shares:v.shares,saves:v.saves??null};
 const o=overrides.get(info.id);if(o){Object.assign(row,o);if(v.synced_at&&Date.parse(v.synced_at)>Date.parse(o.metrics_at||0)&&v.metric_source){for(const k of METRICS)if(v[k]!=null){row[k]=v[k];row.field_sources={...row.field_sources,[k]:v.metric_source};}row.metrics_at=v.synced_at;row.metric_source=v.metric_source;}}
 const previous=byID.get(info.id);if(!previous||Date.parse(row.metrics_at||0)>Date.parse(previous.metrics_at||0))byID.set(info.id,row);
 }
 for(const row of overrides.values())if(!byID.has(row.id))byID.set(row.id,row);
 return [...byID.values()].map(row=>{const linked=registry.find(v=>!v.is_example&&v.slug===row.slug&&v.post_url&&(()=>{try{return postInfo(v.post_url).id===row.id;}catch{return false;}})());row.account=accountHandle(row.platform,row.account);row.registry_match=!!linked;row.vote_code=linked?voteCode(linked):row.vote_code||null;Object.assign(row,classification(row));row.made_with_compound=eligibility(row).eligible;return row;});
}
export async function save(raw,{source='manual',expected,seed=false,observedAt,registry}={}){
 registry??=await videos();
 const info=postInfo(raw.post_url),old=await redis(['HGET',ikey('posts'),postInfo(raw.post_url).id]),existing=(await records(registry)).find(p=>p.id===info.id)||{},next=validate(raw,existing);
 Object.assign(next,classification(next));next.made_with_compound=eligibility(next).eligible;
 const now=observedAt||new Date().toISOString();next.first_seen_at=existing.first_seen_at||existing.metrics_at||now;
 next.field_sources={...existing.field_sources};next.field_observed={...existing.field_observed};
 raw={...raw};for(const k of METRICS){if(existing[k]!=null){next.field_sources[k]??=existing.metric_source||'unknown';if(existing.metrics_at)next.field_observed[k]??=existing.metrics_at;}
 if(raw[k]!=null&&raw[k]!==''&&((sourceKind(next.field_sources[k])==='official'&&['scraped','provider'].includes(sourceKind(source)))||(Date.parse(next.field_observed[k])>Date.parse(now)))){delete raw[k];next[k]=existing[k];}
 if(raw[k]!=null&&raw[k]!==''){next.field_sources[k]=source;next.field_observed[k]=now;}}
 if(METRICS.some(k=>raw[k]!=null&&raw[k]!=='')){next.metric_source=source;next.metrics_at=now;}else{next.metric_source??='unreported';next.metrics_at??=null;}
 if(seed){next.measured_date=raw.measured_date;next.metrics_at=null;}
 else delete next.measured_date;
 const sample=firstDaySample(next);if(sample&&(!next.first24_sample||Date.parse(sample.at)>=Date.parse(next.first24_sample.at))){next.first24_sample=sample;next.first24_velocity=sample.velocity;}
 const linked=registry.filter(v=>v.post_url&&(()=>{try{return postInfo(v.post_url).id===info.id;}catch{return false;}})());
 // Transaction updates the canonical v2 rows and the impact annotation together.
 if(expected&&JSON.stringify(publicPost(existing))!==JSON.stringify(publicPost(expected)))return false;
 const changes=[];for(const row of (seed||!METRICS.some(k=>raw[k]!=null&&raw[k]!=='')?[]:linked)){const current=await redis(['HGET',key('videos'),row.slug]);if(!current)continue;const value=JSON.parse(current);if(!value.post_url||postInfo(value.post_url).id!==info.id)continue;const patch={...value};for(const k of METRICS)if(raw[k]!=null&&raw[k]!=='')patch[k]=next[k];if(raw.view_metric)patch.view_metric=next.view_metric;patch.updated_at=now;patch.metric_source=source;if(source!=='manual')patch.synced_at=now;changes.push({slug:row.slug,old:current,next:JSON.stringify(patch)});}
 const result=await redis(['EVAL',`if ARGV[4]=='1' and redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 0 end
if (redis.call('HGET',KEYS[1],ARGV[1]) or '')~=ARGV[2] then return -2 end
if redis.call('HLEN',KEYS[1])>=1200 and redis.call('HEXISTS',KEYS[1],ARGV[1])==0 then return -1 end
local changes=cjson.decode(ARGV[5]);for _,c in ipairs(changes) do if (redis.call('HGET',KEYS[2],c.slug) or '')~=c.old then return -2 end end
redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]);for _,c in ipairs(changes) do redis.call('HSET',KEYS[2],c.slug,c.next) end
if ARGV[6]~='' then redis.call('HSET',KEYS[4],ARGV[6],ARGV[7]);redis.call('EXPIRE',KEYS[4],31536000) end
redis.call('LPUSH',KEYS[3],ARGV[3]);redis.call('LTRIM',KEYS[3],0,1999);redis.call('EXPIRE',KEYS[3],31536000);return 1`,4,ikey('posts'),key('videos'),ikey('history:'+info.id),ikey('hours:'+info.id),info.id,old||'',JSON.stringify(next),seed?'1':'0',JSON.stringify(changes),!seed&&METRICS.some(k=>raw[k]!=null&&raw[k]!=='')?now.slice(0,13):'',JSON.stringify({platform:next.platform,posted_at:next.posted_at,metrics_at:next.metrics_at,...Object.fromEntries(FIELDS.filter(k=>next[k]!=null).map(k=>[k,next[k]]))})]);
 if(Number(result)===-2){if(expected)return false;throw Error('This post changed. Please save again.');}if(Number(result)<0)throw Error('Impact registry is full.');return next;
}
export async function seed(){for(const row of SEEDS)if(!Number(await redis(['HEXISTS',ikey('posts'),postInfo(row.post_url).id])))await save(row,{seed:true});}
export async function clickReport(){const [all,day]=await pipeline([['HGETALL',ikey('clicks')],['HGETALL',ikey('clicks:'+new Date().toISOString().slice(0,10))]]);const today=obj(day),rows=Object.entries(obj(all)).map(([id,total])=>({id,label:id,total:Number(total),today:Number(today[id]||0),timeZone:'UTC'})).sort((a,b)=>b.total-a.total);return{total:rows.reduce((n,v)=>n+v.total,0),rows};}
export async function report({privateData=false}={}){
 const [all,clicks,history,status]=await Promise.all([records(),clickReport(),redis(['LRANGE',ikey('snapshots'),0,4319]),redis(['GET',ikey('sync-status')])]);
 const prefs=await settings(),visible=all.filter(p=>prefs.include_twitch_archives||p.video_kind!=='archive');
 const posts=visible.filter(p=>privateData||p.made_with_compound).map(p=>({...publicPost(p),...(privateData?{eligibility:eligibility(p)}:{})})).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.id.localeCompare(b.id)),counted=posts.filter(p=>p.made_with_compound),totals={videos:counted.length,views_reported:counted.filter(p=>p.views!=null).length,score_partial:counted.some(p=>p.coverage.partial)};
 for(const k of ['views','engagements','score'])totals[k]=counted.length?sumKnown(counted.map(p=>p[k])):0;
 return{posts,totals,clicks,...(privateData?{accounts:await accountStatus(all),settings:await settings()}:{}),history:history.map(parse).filter(s=>s?.rule_version===RULE_VERSION).reverse(),sync:parse(status),updated_at:new Date().toISOString()};
}
export async function snapshot(){const r=await report(),s={at:new Date().toISOString(),rule_version:RULE_VERSION,...r.totals};await redis(['EVAL',"redis.call('LPUSH',KEYS[1],ARGV[1]);redis.call('LTRIM',KEYS[1],0,4319);return 1",1,ikey('snapshots'),JSON.stringify(s)]);return s;}
