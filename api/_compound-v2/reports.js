import crypto from 'node:crypto';
import {redis,pipeline} from '../_redis.js';
import {key,videos} from './store.js';
const parse=x=>{try{return JSON.parse(x);}catch{return null;}};
const obj=x=>Array.isArray(x)?Object.fromEntries(Array.from({length:x.length/2},(_,i)=>[x[i*2],x[i*2+1]])):x||{};
const cell=x=>String(x??'—').replace(/[|\r\n]/g,' ').slice(0,160);
export function buildReport(rows,samples=[],now=new Date()){
 const posts=rows.filter(v=>v.post_url&&!v.is_example),previous=[...samples].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).find(s=>Date.parse(s.at)<now.getTime()-60000);
 const rates=new Map((previous?.posts||[]).map(v=>[v.slug,v]));
 const enriched=posts.map(v=>{const old=rates.get(v.slug),hours=previous?(now-Date.parse(previous.at))/3600000:0;
 const fresh=old&&v.updated_at&&v.updated_at!==old.updated_at&&Date.parse(v.updated_at)>Date.parse(old.updated_at||0);
 const rate=fresh&&hours>0&&v.views>=old.views?Math.round((v.views-old.views)/hours):null;
 return{slug:v.slug,url:v.post_url,views:Number(v.views)||0,views_per_hour:rate,updated_at:v.updated_at||null,variant:v.variant||'unknown'};});
 const top=enriched.sort((a,b)=>b.views-a.views||a.slug.localeCompare(b.slug)).slice(0,5);
 const groups=['base','goofy','short','long'].map(variant=>{const set=enriched.filter(v=>v.variant===variant);return{variant,posts:set.length,views:set.reduce((n,v)=>n+v.views,0),average:set.length?Math.round(set.reduce((n,v)=>n+v.views,0)/set.length):null};});
 const candidates=groups.filter(g=>g.posts&&g.views>0).sort((a,b)=>b.average-a.average);
 const best=candidates.length>=2&&candidates[0].average>candidates[1].average?candidates[0].variant:null;
 const total=enriched.reduce((n,v)=>n+v.views,0),warnings=[];
 if(!posts.length)warnings.push('No published posts are registered yet.');
 if(!previous)warnings.push('Views/hour needs a second timestamped sample. No rate is invented.');
 else if(!enriched.some(v=>v.views_per_hour!==null))warnings.push('No new social metric reading since the previous sample; views/hour is unavailable.');
 if(posts.length&&!total)warnings.push('Registered posts currently have zero reported views. Enter their real metrics; zero is not proof nobody watched.');
 const stale=enriched.filter(v=>!v.updated_at||now-Date.parse(v.updated_at)>3600000).length;if(stale)warnings.push(`${stale} post(s) have no metric update in the last hour.`);
 if(!best)warnings.push('No defensible best variant yet. At least two variant groups need non-zero reported views.');
 const lines=['# Compound v2 · half-hour report','',`Generated: ${now.toISOString()}`,`Published posts: ${posts.length} · reported views: ${total.toLocaleString('en-US')}`,'','## Top five posts','', '| Post | Views | Reported views/hour | Last metric update |','| --- | ---: | ---: | --- |',...top.map(v=>`| [${v.slug}](${v.url}) | ${v.views} | ${v.views_per_hour??'unavailable'} | ${cell(v.updated_at)} |`),'','## Variant comparison','', '| Variant | Posts | Views | Average views/post |','| --- | ---: | ---: | ---: |',...groups.map(g=>`| ${g.variant} | ${g.posts} | ${g.views} | ${g.average??'unavailable'} |`),'',best?`Highest reported average: **${best}**. This is observational, not a controlled result.`:'Best variant: not enough data.','','## Data quality','',...warnings.map(w=>'- '+w),'','Social views are entered by Gabe or synced by the configured provider. Rates use changes between timestamped report samples only when a new metric reading exists. They are not estimated live views.',''];
 return{generated_at:now.toISOString(),posts:posts.length,total_views:total,top,best_variant:best,variants:groups,warnings,markdown:lines.join('\n')};
}
export async function latestReport(){const [latest,error,lastJob]=await pipeline([['GET',key('report:latest')],['GET',key('report:error')],['GET',key('report:last-job')]]);return{report:parse(latest),error:parse(error),last_job:parse(lastJob)};}
export async function runReport({force=false,trigger='cron'}={}){
 const token=crypto.randomUUID(),lock=key('report:lock');if(!await redis(['SET',lock,token,'NX','EX',120]))return{...await latestReport(),busy:true};
 try{
  const old=await latestReport(),now=new Date();if(!force&&old.report&&Math.floor(Date.parse(old.report.generated_at)/1800000)===Math.floor(now/1800000))return{...old,cached:true};
  const [rows,rawSamples,rawAssets]=await Promise.all([videos(),redis(['LRANGE',key('report:samples'),0,95]),redis(['HGETALL',key('export-assets')])]);
  const assets=obj(rawAssets),all=rows.map(v=>({...v,variant:v.variant||parse(assets[v.slug])?.variant||'unknown'}));
  const report=buildReport(all,rawSamples.map(parse).filter(Boolean),now),sample={at:now.toISOString(),posts:all.filter(v=>v.post_url&&!v.is_example).map(v=>({slug:v.slug,views:v.views,updated_at:v.updated_at}))};
  const job={at:now.toISOString(),trigger,ok:true};
  await redis(['EVAL',`redis.call('SET',KEYS[1],ARGV[1]);redis.call('LPUSH',KEYS[2],ARGV[2]);redis.call('LTRIM',KEYS[2],0,95);redis.call('EXPIRE',KEYS[2],604800);redis.call('LPUSH',KEYS[3],ARGV[1]);redis.call('LTRIM',KEYS[3],0,335);redis.call('EXPIRE',KEYS[3],604800);redis.call('SET',KEYS[4],ARGV[1],'EX',7776000);redis.call('SET',KEYS[5],ARGV[3]);redis.call('DEL',KEYS[6]);return 1`,6,key('report:latest'),key('report:samples'),key('report:history'),key('report:daily:'+now.toISOString().slice(0,10)),key('report:last-job'),key('report:error'),JSON.stringify(report),JSON.stringify(sample),JSON.stringify(job)]);
  return{report,error:null,last_job:job};
 }catch(e){await redis(['SET',key('report:error'),JSON.stringify({at:new Date().toISOString(),message:'Refresh failed. The previous successful report is retained.'}),'EX',86400]).catch(()=>{});throw e;}
 finally{await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",1,lock,token]).catch(()=>{});}
}
