import assert from 'node:assert/strict';
import {createClient} from 'redis';
import {rowFromPage,aggregate,clickQuery,dayAt,ownPostURL} from '../api/_x-data.js';
import {createXSync,XKEY} from '../api/_x-sync.js';
import {notionClient,validateSchema,SyncError} from '../api/_x-notion.js';
import {createHandler} from '../api/x-stats.js';
import {privacyEvent} from '../js/analytics-policy.js';
import {setXCampaigns,xContext} from '../js/x-attribution.js';
const date='2026-11-04',now=Date.parse(`${date}T12:00:00Z`),db='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',source='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rich=value=>({type:'rich_text',rich_text:[{plain_text:value}]}),select=value=>({type:'select',select:{name:value}});
const schema=Object.fromEntries(Object.entries({date:'date',hour:'number',region:'select',type:'select',voice:'select',lane:'select',campaign:'rich_text',target_url:'url',my_url:'url',text:'rich_text',link:'url',link_type:'select',clicks:'number',clicks_pidgy:'number',synced_at:'date',clicks_estimated:'checkbox'}).map(([k,type])=>[k,{type}]));
function page(i,extra={}){return {id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,properties:{date:{date:{start:date}},hour:{number:9},region:select('eu'),type:select(i%2?'reply':'post'),voice:select(i%2?'dry':'warm'),lane:select('builders'),campaign:rich('launch'),target_url:{url:'https://x.com/other/status/123?secret=private-target'},my_url:{url:`https://x.com/gabe_maxxing/status/${1000+i}`},text:rich(i%2?'PRIVATE REPLY SECRET':'my own public post'),link:{url:'https://corvus.gent/links/gabe/x/launch?utm_content=eu-9'},link_type:select('corvus'),clicks:{number:null},clicks_pidgy:{number:null},synced_at:{date:null},clicks_estimated:{checkbox:false},...extra}};}
const rows=[page(1),page(2)].map(rowFromPage);
let data=aggregate(rows,[[date,'launch','eu-09','corvus',3],[date,'launch','eu-9','pidgy',1]],new Date(now));
assert.equal(data.public.all.clicks,3);assert.equal(data.public.all.clicksPidgy,1);assert.equal(data.public.all.replies,1);assert.equal(data.public.all.posts,1);assert.equal(data.public.all.ctr,2);
assert.equal(data.rows[0].clicks,1.5);assert.equal(data.rows[0].clicks_pidgy,.5);assert.equal(data.rows[0].estimated,true);
assert.equal(data.public.hours[9].clicks,3);assert.equal(data.public.posts.length,1);assert.equal(data.public.bestVoice.name,'dry');
for(const secret of ['target_url','PRIVATE REPLY SECRET','private-target','other/status'])assert.ok(!JSON.stringify(data.public).includes(secret));
assert.equal(ownPostURL('https://x.com/other/status/1'),'');assert.equal(ownPostURL('https://x.com.evil.example/gabe_maxxing/status/1'),'');assert.equal(ownPostURL('javascript:alert(1)'),'');
const naked=rowFromPage(page(3,{campaign:rich(''),link:{url:null},link_type:select('none')}));assert.equal(aggregate([naked],[],now).public.all.replies,1);assert.equal(aggregate([naked],[],now).public.all.links,0);
data=aggregate([rowFromPage(page(1)),rowFromPage(page(2,{date:{date:{start:'2026-11-03'}}}))],[[date,'launch','eu-9','corvus',7],[date,'launch','','pidgy',2]],now);assert.equal(data.rows[0].clicks,7);assert.equal(data.rows[1].clicks,0);assert.equal(data.public.unmatchedClicks,2);
assert.equal(aggregate([rowFromPage(page(1)),rowFromPage(page(1))],[],now).public.all.replies,1);
assert.equal(dayAt('2026-03-29T22:30:00Z'),'2026-03-30');assert.equal(dayAt('2026-10-25T23:30:00Z'),'2026-10-26');
assert.match(clickQuery(new Date(now).toISOString(),1000),/OFFSET 1000/);assert.throws(()=>clickQuery("';DROP",0));
validateSchema(schema);assert.throws(()=>validateSchema({...schema,clicks:{type:'rich_text'}}),/schema/);
setXCampaigns(['launch']);let event=privacyEvent({event:'$pageview',properties:{$cookieless_mode:true,utm_source:'x',utm_campaign:'gabe-launch',utm_content:'eu-09',secret:'discard'}});assert.equal(event.properties.utm_campaign,'gabe-launch');assert.equal(event.properties.utm_content,'eu-9');assert.equal(event.properties.secret,undefined);
event=privacyEvent({event:'$pageview',properties:{$cookieless_mode:true,utm_source:'x',utm_campaign:'email-person-name',utm_content:'private'}});assert.equal(event.properties.utm_campaign,'other');assert.equal(event.properties.utm_content,undefined);assert.deepEqual(xContext('/links/gabe/x/launch','?utm_content=sf-23'),{campaign:'launch',content:'sf-23'});
// Exercise the actual HTTP rate limiter, including Retry-After and no URL redirects.
let clock=0,starts=[],attempt=0;const client=notionClient({token:'test-token',now:()=>clock,sleep:async ms=>{clock+=ms;},fetcher:async(url,options)=>{starts.push(clock);assert.equal(options.redirect,'error');assert.equal(options.headers['Notion-Version'],'2025-09-03');attempt++;return attempt===2?new Response('{}',{status:429,headers:{'Retry-After':'2'}}):new Response('{}',{status:200});}});
await client('databases/test');await client('databases/test');await client('databases/test');assert.ok(starts[1]-starts[0]>=350);assert.ok(starts[2]-starts[1]>=2000);assert.ok(starts[3]-starts[2]>=350);
let delayed=notionClient({token:'x',now:()=>clock,sleep:async ms=>{clock+=ms;},deadline:clock+13000,fetcher:async()=>new Response('{}',{status:429,headers:{'Retry-After':'60'}})});await assert.rejects(delayed('test'),e=>e.code==='yield'&&e.retryAt>clock);
// Real Redis, dedicated disposable loopback database only.
const redisClient=createClient({url:'redis://127.0.0.1:16380/10',socket:{reconnectStrategy:false}}).on('error',()=>{});await redisClient.connect();const redis=args=>redisClient.sendCommand(args.map(String));
try{
 for(const size of [0,1,2000]){
  await redisClient.flushDb();let time=now,patches=0,reads=0,queryCalls=0,continuations=0;const pages=Array.from({length:size},(_,i)=>page(i+1)),queue=[];
  const service=createXSync({redis,database:db,now:()=>time,enqueue:p=>queue.push(p),continueJob:async()=>{continuations++;},hogql:async sql=>{queryCalls++;const bins=[[date,'launch','eu-9','corvus',size*2],...(size===2000?Array.from({length:1000},(_,i)=>[date,'old-'+i,'sf-1','corvus',1]):[])];const offset=Number(/OFFSET (\d+)/.exec(sql)[1]);return bins.slice(offset,offset+1000);},makeNotion:({deadline})=>async(path,method,body)=>{
   if(time+350+12000>deadline)throw new SyncError('yield');time+=350;
   if(path===`databases/${db}`)return {data_sources:[{id:source}]};if(path===`data_sources/${source}`)return {properties:schema};
   if(path.endsWith('/query')){reads++;assert.equal(body.page_size,100);const start=Number(body.start_cursor||0),results=pages.slice(start,start+100);return {results,has_more:start+100<size,next_cursor:start+100<size?String(start+100):null};}
   assert.equal(method,'PATCH');assert.deepEqual(Object.keys(body.properties).sort(),['clicks','clicks_estimated','clicks_pidgy','synced_at']);patches++;const target=pages.find(p=>path===`pages/${p.id}`);for(const [name,value]of Object.entries(body.properties))target.properties[name]={...schema[name],...value};return {};
  }});
  const simultaneous=await Promise.all([service.kick(),service.kick()]);assert.equal(queue.length,1);assert.ok(simultaneous.every(x=>x.state==='syncing'));
  for(let i=0;i<60;i++){await queue.shift();if(!await service.get(XKEY.job))break;await service.kick({continuation:true});}
  assert.equal(await service.get(XKEY.job),null);assert.equal(patches,size);assert.equal(reads,Math.max(1,Math.ceil(size/100)));assert.equal(queryCalls,size===2000?2:1);assert.ok(size<2000||continuations>=3);
  const pub=await service.get(XKEY.cache);assert.equal(pub.all.replies+pub.all.posts,size);assert.equal(pub.all.clicks,size*2+(size===2000?1000:0));assert.ok(!JSON.stringify(pub).includes('PRIVATE REPLY SECRET'));assert.ok(!JSON.stringify(pub).includes('target_url'));
  const priv=await service.privatePage({region:'eu',voice:'dry',page:1});assert.equal(priv.total,Math.ceil(size/2));assert.ok(priv.rows.length<=50);if(size)assert.match(priv.rows[0].target_url,/private-target/);
  const ttl=await redisClient.ttl(XKEY.cache);assert.ok(ttl>0&&ttl<=900);
  assert.equal((await service.kick()).state,'cooldown');
  await redisClient.del(XKEY.start);time+=900000;patches=0;await service.kick();while(queue.length)await queue.shift();assert.equal(patches,0,'unchanged rows are not rewritten');assert.equal(await service.get(XKEY.job),null);
 }
 // A failed provider write resumes at the checkpoint without redoing successful rows.
 await redisClient.flushDb();let attempts=0,writes=0;const pending=[],retryPages=Array.from({length:25},(_,i)=>page(i+1));
 const retryService=createXSync({redis,database:db,now:()=>now,enqueue:p=>pending.push(p),hogql:async()=>[],makeNotion:()=>async(path,method,body)=>{
  if(path===`databases/${db}`)return {data_sources:[{id:source}]};if(path===`data_sources/${source}`)return {properties:schema};if(path.endsWith('/query'))return {results:retryPages,has_more:false,next_cursor:null};
  attempts++;if(attempts===13)throw new SyncError('notion_unavailable');writes++;return {};
 }});
 await retryService.kick();await pending.shift();assert.equal(writes,12);const jobBefore=await retryService.get(XKEY.job);assert.equal((await retryService.kick()).state,'unavailable');assert.equal(pending.length,0);
 await redisClient.del(XKEY.error);await retryService.kick({continuation:true});await pending.shift();assert.equal(writes,25);assert.equal(attempts,26);assert.equal(await retryService.get(XKEY.job),null);assert.equal((await retryService.get(XKEY.manifest)).id,jobBefore.id);
 // All request variants use explicit authentication before reading private data.
 const mockService={kick:async()=>({state:'syncing'}),privatePage:async()=>({rows:[{target_url:'PRIVATE'}]}),get:async key=>key===XKEY.cache?{ready:true,all:{clicks:1}}:[]};
 const handler=createHandler({ready:()=>true,service:mockService,session:async req=>req.headers.cookie==='valid'?{email:'gabriel@corvus.gent'}:null,cronSecret:()=> 'cron-secret'});
 const call=async(method,query={},headers={})=>{const result={headers:{}};const res={setHeader:(k,v)=>result.headers[k]=v,status:n=>{result.status=n;return res;},json:value=>{result.body=value;return result;},end:()=>result};await handler({method,query,headers},res);return result;};
 assert.equal((await call('GET',{private:'1'})).status,401);assert.equal((await call('POST')).status,401);assert.equal((await call('POST',{}, {cookie:'valid',origin:'https://evil.example'})).status,403);
 assert.equal((await call('GET',{cron:'1'})).status,401);assert.equal((await call('GET',{continue:'1'})).status,401);assert.equal((await call('GET',{cron:'1'},{authorization:'Bearer cron-secret'})).status,202);
 let response=await call('GET',{private:'1'},{cookie:'valid'});assert.equal(response.status,200);assert.match(response.headers['Cache-Control'],/no-store/);assert.equal(response.body.rows[0].target_url,'PRIVATE');
 response=await call('GET');assert.equal(response.status,200);assert.match(response.headers['Cache-Control'],/s-maxage=900/);assert.ok(!JSON.stringify(response.body).includes('PRIVATE'));
 const missing=createHandler({ready:()=>false,service:mockService});let body;await missing({method:'GET',query:{},headers:{}},{setHeader(){},status(){return this;},json:v=>{body=v;}});assert.deepEqual(body,{ready:false});
 console.log('X stats: empty/1/2,000 rows, pagination, resumable writeback, real Redis locks/TTLs, rate limiting, estimates, privacy, DST and API authorization passed.');
}finally{await redisClient.flushDb();await redisClient.disconnect();}
