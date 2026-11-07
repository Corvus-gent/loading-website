import {redis,plaintextExceptionUntil} from './_redis.js';
import {pathCategory,EVENTS} from '../js/analytics-policy.js';
import {safeEqual} from './_session.js';
import {hogql,REAL} from './_posthog.js';
import {checks,inspect} from './_health.js';
import {pages,ttl} from './_stats-snap.js';
import {visitorCounters,countDay} from './_visitor-counts.js';
const safe=s=>String(s??'unknown').replace(/[\r\n|`<>]/g,' ').slice(0,180);
export async function reportData({store=redis,query=hogql,health=()=>inspect(checks()),now=Date.now}={}){
 const at=now(),day=countDay(at),yesterday=countDay(at-86400000),start=countDay(at-7*86400000);
 const read=async fn=>{try{return await fn();}catch{return null;}};
 const [status,snapshots,daily,events,counters,info,size,cron,errors,warnings]=await Promise.all([
  read(health),read(()=>store(['MGET',...pages.map(p=>`stats:snap:${p}:${day}`)])),
  read(()=>query(`SELECT toString(toDate(toTimeZone(timestamp,'Europe/Brussels'))) d,count(DISTINCT distinct_id),count() FROM events WHERE event='$pageview' AND ${REAL} AND toDate(toTimeZone(timestamp,'Europe/Brussels'))>=toDate('${start}') GROUP BY d ORDER BY d`)),
  read(()=>query(`SELECT event,properties.$pathname,count(),max(timestamp) FROM events WHERE ${REAL} AND timestamp>now()-INTERVAL 60 MINUTE GROUP BY event,properties.$pathname ORDER BY count() DESC LIMIT 100`)),
  read(()=>visitorCounters(day,store)),read(()=>store(['INFO','memory'])),read(()=>store(['DBSIZE'])),read(()=>store(['GET','stats:job:last'])),read(()=>store(['LRANGE','report:errors','0','9'])),read(()=>query("SELECT type,count(),max(timestamp) FROM system.ingestion_warnings WHERE timestamp>now()-INTERVAL 10 MINUTE GROUP BY type ORDER BY count() DESC LIMIT 10"))
 ]);
 const days=Array.from({length:8},(_,i)=>countDay(at-i*86400000));
 const unseen=await read(()=>store(['MGET',...days.map(d=>'unseen:hits:'+d)]));
 const counts=days.map((d,i)=>({day:d,posthog:Number(daily?.find(r=>r[0]===d)?.[1]||0),unseen:Number(unseen?.[i]||0)})).map(x=>({...x,total:x.posthog+x.unseen}));
 const average=counts.slice(1).reduce((s,x)=>s+x.total,0)/7;
 const snapshotRows=pages.map((page,i)=>{let s;try{s=JSON.parse(snapshots?.[i]||'null');}catch{}return {page,state:s?.state||'missing',age:s?Math.round((at-Date.parse(s.updated))/1000):null,ttl:ttl(page),missing:s?.missing||[],timings:s?.timings||{}};});
 const broken=[];
 if(!status)broken.push(['health unavailable','check the function and Redis connection']);
 for(const [name,c]of Object.entries(status?.checks||{}))if(c.ok===false)broken.push([name+' failed',name==='snapshots'?'inspect slow tasks below; rebuild snapshots asynchronously':name==='redis'?'check the configured connection, TLS exception deadline and provider health':name==='cron'?'check CRON_SECRET and the scheduled job':'check the '+name+' provider and configuration']);
 if(!daily||!events)broken.push(['PostHog query unavailable','check the EU project, personal key and query quota']);
 if(daily&&average>0&&counts[0].total<average/2)broken.push(['today is >50% below the previous 7-day average','check ingestion and compare the same hours; today is incomplete']);
 if(plaintextExceptionUntil())broken.push(['storage transport is temporarily unencrypted','complete the paid Redis TLS migration before '+plaintextExceptionUntil()]);
 const ingestion=(warnings||[]).filter(([type])=>/^[a-z_]{1,100}$/.test(type)).map(([type,count,last])=>({type,count:Number(count)||0,last}));
 for(const warning of ingestion)if(warning.type.startsWith('cookieless_')&&Date.parse(warning.last)>at-120000)broken.push(['PostHog drops events: '+warning.type,'inspect the cookieless protocol inputs and project settings']);
 const numeric=Object.fromEntries(String(info||'').split('\n').filter(x=>/^(used_memory|maxmemory):\d+/.test(x)).map(x=>{const [k,v]=x.trim().split(':');return [k,Number(v)];}));
 return {ingestion,at:new Date(at).toISOString(),day,yesterday,status,snapshots:snapshotRows,counts,average,counters,events:events?.map(([event,page,count,last])=>({event:EVENTS.has(event)?event:'other',page:pathCategory(page),count:Number(count),last})),memory:numeric.used_memory??null,keys:size,cron,errors:(errors||[]).flatMap(x=>{try{return [JSON.parse(x)];}catch{return [];}}),broken};
}
export function markdown(r){
 const lines=['# corvus self-check','',`checked: ${r.at}`,`overall status: ${r.status?.status||'unavailable'}`,'','## health checks','check | ok | ms','--- | --- | ---'];
 for(const [name,c]of Object.entries(r.status?.checks||{}))lines.push(`${safe(name)} | ${c.skipped?'skipped':c.ok} | ${c.ms}`);
 lines.push('','## snapshots','page | state | age seconds | refresh target seconds | slowest task','--- | --- | --- | --- | ---');
 for(const s of r.snapshots){const slow=Object.entries(s.timings).sort((a,b)=>b[1]-a[1])[0];lines.push(`${s.page} | ${s.state} | ${s.age??'unknown'} | ${s.ttl} | ${slow?safe(slow[0])+' '+slow[1]+' ms':'not measured yet'}`);}
 lines.push('','## audience',`today: ${r.counts[0].total}`,`yesterday: ${r.counts[1].total}`,`previous 7-day average: ${r.average.toFixed(2)}`,'These are PostHog daily visitor estimates + anonymous page hits, not a deduplicated census. Today is incomplete.',`soldiers who said ok today: ${r.counters?.soldiers.day??'unavailable'}`,`soldiers all time: ${r.counters?.soldiers.all??'unavailable'}`,`unseen visitors today (page hits): ${r.counters?.unseen.day??'unavailable'}`,'','## posthog events in the last 60 minutes','event | page category | count | latest UTC','--- | --- | --- | ---');
 for(const e of r.events||[])lines.push(`${safe(e.event)} | ${safe(e.page)} | ${e.count} | ${safe(e.last)}`);
 lines.push('','## ingestion warnings (last 10 minutes)');for(const w of r.ingestion||[])lines.push(`- ${safe(w.type)} · ${w.count} · latest ${safe(w.last)}`);if(!r.ingestion?.length)lines.push('none returned.');
 lines.push('','## storage and jobs',`redis used memory bytes: ${r.memory??'unavailable'}`,`redis key count: ${r.keys??'unavailable'}`,`plaintext exception expiry: ${plaintextExceptionUntil()||'inactive'}`,`last completed cron/snapshot job: ${r.cron||'unavailable'}`,'','## last 10 function errors','Sanitized application errors recorded since this release (7-day retention), not a complete Vercel platform log. Historical errors are not fabricated.');
 for(const e of r.errors)lines.push(`- ${safe(e.at)} · ${safe(e.area)} · ${safe(e.code)}`);
 if(!r.errors.length)lines.push('none recorded.');
 lines.push('','## what is broken');for(const [issue,fix]of r.broken)lines.push(`- ${safe(issue)} → ${safe(fix)}`);if(!r.broken.length)lines.push('no failure detected by these checks.');
 return lines.join('\n')+'\n';
}
export default async function report(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','text/markdown; charset=utf-8');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
 const supplied=req.headers['x-report-token']||req.query.token;
 if(req.method!=='GET')return res.status(405).send('method not allowed\n');
 if(!process.env.REPORT_TOKEN||typeof supplied!=='string'||!safeEqual(supplied,process.env.REPORT_TOKEN))return res.status(401).send('unauthorized\n');
 try{const cached=await redis(['GET','report:markdown:v1']);if(cached)return res.status(200).send(cached);}catch{}
 const body=markdown(await reportData());try{await redis(['SET','report:markdown:v1',body,'EX','60']);}catch{}
 return res.status(200).send(body);
}
