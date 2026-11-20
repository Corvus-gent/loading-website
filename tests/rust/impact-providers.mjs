import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
const at='2026-11-20T00:00:00.000Z',now=Date.parse(at),oldClock=Date.now;Date.now=()=>now;
const runtime=await isolatedRuntime('compound-v2'),credentials={X_BEARER_TOKEN:'fixture-x-token',ORIANE_API_KEY:'fixture-oriane-token',TIKTOK_ACCESS_TOKEN_GABE_MAXXING:'fixture-tt-token',IG_ACCESS_TOKEN_GABE_MAXXING:'fixture-ig-token',IG_USER_ID_GABE_MAXXING:'1234',TWITCH_CLIENT_ID:'fixture-tw-client',TWITCH_CLIENT_SECRET:'fixture-tw-secret',YOUTUBE_DATA_API_KEY:'fixture-yt-key',YOUTUBE_ANALYTICS_ACCESS_TOKEN:'fixture-yt-owner'};
const baseEnv={PATH:process.env.PATH,REDIS_URL:runtime.client.options.url,SESSION_SECRET:runtime.secret,CORVUS_RUST_WRITES:'isolated'};
for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API|COMPOUND_V2_PREFIX/.test(k))delete process.env[k];Object.assign(process.env,baseEnv);
const {default:x}=await import('../../api/_compound-v2/impact/adapters/x.js');
const {default:tt}=await import('../../api/_compound-v2/impact/adapters/tt.js');
const {default:ig}=await import('../../api/_compound-v2/impact/adapters/ig.js');
const {default:li}=await import('../../api/_compound-v2/impact/adapters/li.js');
const {default:yt}=await import('../../api/_compound-v2/impact/adapters/yt.js');
const {default:tw}=await import('../../api/_compound-v2/impact/adapters/tw.js');
for(const k of Object.keys(credentials))delete process.env[k];
let mode='ok',calls=[],failures=[],onRequest=null;
const bodyFor=(host,path,q,payload)=>{
 if(host==='api.x.com')return{data:(q.get('ids')||'').split(',').map((id,i)=>({id,author_id:'gabe',created_at:at,public_metrics:{impression_count:100+i,like_count:2,reply_count:1,retweet_count:0,quote_count:1,bookmark_count:0},...(i%5===1?{referenced_tweets:[{type:'replied_to',id:'parent'}]}:i%5===2?{referenced_tweets:[{type:'quoted',id:'parent'}]}:i%5===3?{referenced_tweets:[{type:'retweeted',id:'parent'}]}:{}),attachments:{media_keys:[i%5===4?'photo':'native']}})),includes:{users:[{id:'gabe',username:'gabe_maxxing'}],media:[{media_key:'parent',type:'video',preview_image_url:'https://example.test/parent.jpg'},{media_key:'native',type:'video',preview_image_url:'https://example.test/video.jpg'},{media_key:'photo',type:'photo'}]}};
 if(host==='connect.oriane.xyz'){assert.equal(payload.operator,'and');const ids=payload.filters.platformId.includes;assert.ok(ids.length<=100);return{data:{results:[...ids.map(v=>({...v,viewsCount:100,likesCount:2,commentsCount:0,sharesCount:0,savesCount:3})),{platform:'tiktok',platformId:'unknown',viewsCount:9999999}]}};}
 if(host==='open.tiktokapis.com'){
  assert(q.get('fields').includes('view_count')&&q.get('fields').includes('share_count'));const video=(id,handle='gabe.maxxing')=>({id,share_url:'https://www.tiktok.com/@'+handle+'/video/'+id+'?source=web',title:'Native video',create_time:1795132800,cover_image_url:'https://example.test/tt.jpg',duration:12,view_count:100,like_count:0,comment_count:1,share_count:0});
  if(path.includes('/query/')){assert.ok(payload.filters.video_ids.length<=20);return{data:{videos:payload.filters.video_ids.map(id=>video(id))},error:{code:'ok'}};}
  return{data:{videos:[video('1'),video('99999'),video('99998','not-gabe'),{...video('99997'),duration:0},{...video('99996'),share_url:'https://evil.test/@gabe.maxxing/video/99996'}]},error:{code:'ok'}};
 }
 if(host==='graph.facebook.com'){
  if(path==='/v24.0/1234')return{id:'1234',username:mode==='account-mismatch'?'someone_else':'gabe.maxxing'};
  if(path.endsWith('/media')){const media=(id,code,user='gabe.maxxing',type='VIDEO')=>({id,permalink:'https://www.instagram.com/reel/'+code+'/',media_type:type,username:user,like_count:3,comments_count:0,timestamp:at});return{data:q.has('after')?[media('103','LATER')]:[media('101','KNOWN'),media('102','NEW'),media('104','FOREIGN','someone_else'),media('105','IMAGE','gabe.maxxing','IMAGE'),media('106','CAROUSEL','gabe.maxxing','CAROUSEL_ALBUM')],...(q.has('after')?{}:{paging:{next:'https://evil.test/never-follow-this',cursors:{after:'opaque-cursor'}}})};}
  if(path.endsWith('/insights')){assert.equal(q.get('metric'),'views,shares,saved');return{data:[{name:'views',total_value:{value:120}},{name:'shares',total_value:{value:0}},{name:'saved',total_value:{value:4}}]};}
 }
 if(host==='www.googleapis.com'){assert.equal(q.get('part'),'statistics');assert.ok(q.get('id').split(',').length<=50);return{items:q.get('id').split(',').map(id=>({id,statistics:{viewCount:'100',likeCount:'0',commentCount:'2',favoriteCount:'999999'}}))};}
 if(host==='youtubeanalytics.googleapis.com'){assert.equal(q.get('metrics'),'shares');return{columnHeaders:[{name:'shares'},{name:'video'}],rows:q.get('filters').slice(7).split(',').map(id=>[3,id])};}
 if(host==='id.twitch.tv')return{access_token:'fixture-app-token',expires_in:3600};
 if(host==='api.twitch.tv'){
  if(path.endsWith('/users'))return{data:[{id:'gabe',login:'gabe_maxxing'}]};
  if(path.endsWith('/clips'))return{data:[{broadcaster_id:'gabe',url:'https://clips.twitch.tv/FixtureClip',title:'A clip',created_at:'2026-11-19T23:00:00.000Z',view_count:8,thumbnail_url:'https://example.test/clip.jpg'},{broadcaster_id:'foreign',url:'https://clips.twitch.tv/Foreign',view_count:99999}]};
  if(path.endsWith('/videos'))return{data:[{user_id:'gabe',type:q.get('type'),url:'https://twitch.tv/videos/'+{highlight:1,upload:2,archive:3}[q.get('type')],title:q.get('type'),created_at:'2026-11-19T22:00:00.000Z',view_count:10,thumbnail_url:'https://example.test/%{width}x%{height}.jpg'},{user_id:'foreign',type:q.get('type'),view_count:99999}]};
 }
 throw Error('Unexpected fixture URL '+host+path);
};
async function fixture(url,options={},native=false){
 const u=new URL(url),host=native?u.pathname.split('/')[1]:u.hostname,path=native?u.pathname.slice(host.length+1):u.pathname;
 const headers=new Headers(options.headers);let payload;try{payload=options.body?JSON.parse(options.body):null;}catch{payload=Object.fromEntries(new URLSearchParams(options.body));}
 calls.push({host,path,query:Object.fromEntries(u.searchParams),method:options.method||'GET'});
 if(onRequest)await onRequest({host,path});
 if(host==='api.x.com')assert.equal(headers.get('authorization'),'Bearer fixture-x-token');
 if(host==='connect.oriane.xyz')assert.equal(headers.get('authorization'),'Bearer fixture-oriane-token');
 if(host==='open.tiktokapis.com')assert.equal(headers.get('authorization'),'Bearer fixture-tt-token');
 if(host==='graph.facebook.com')assert.equal(headers.get('authorization'),'Bearer fixture-ig-token');
 if(host==='www.googleapis.com')assert.equal(headers.get('x-goog-api-key'),'fixture-yt-key');
 if(host==='youtubeanalytics.googleapis.com')assert.equal(headers.get('authorization'),'Bearer fixture-yt-owner');
 if(host==='id.twitch.tv'){assert.equal(payload.client_secret,'fixture-tw-secret');assert.equal(payload.grant_type,'client_credentials');}
 if(host==='api.twitch.tv'){assert.equal(headers.get('authorization'),'Bearer fixture-app-token');assert.equal(headers.get('client-id'),'fixture-tw-client');}
 if(mode==='redirect')return new Response('',{status:302,headers:{location:'https://evil.test/leak'}});
 if(mode==='invalid-json')return new Response('{broken',{status:200});
 if(mode==='rate-limit'||(mode==='insights-rate-limit'&&path.endsWith('/insights')))return new Response(JSON.stringify({error:{code:4}}),{status:429,headers:{'retry-after':'7200'}});
 if((mode==='insights-denied'&&path.endsWith('/insights'))||(mode==='analytics-denied'&&host==='youtubeanalytics.googleapis.com'))return new Response(JSON.stringify({error:{code:10,message:'PRIVATE MUST NOT LEAK'}}),{status:403});
 if(mode==='tt-rate-code'&&host==='open.tiktokapis.com')return new Response(JSON.stringify({error:{code:'rate_limit_exceeded'}}));
 return new Response(JSON.stringify(bodyFor(host,path,u.searchParams,payload)),{status:200,headers:{'content-type':'application/json'}});
}
const server=http.createServer(async(req,res)=>{try{let body='';for await(const c of req)body+=c;const r=await fixture('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,body},true);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());}catch(e){failures.push(e);res.writeHead(500);res.end('{}');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const endpoint='http://127.0.0.1:'+server.address().port;
const native=(cases,env)=>new Promise((resolve,reject)=>{const p=spawn('target/debug/corvus-contract',[],{env:{...baseEnv,...env},stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);p.on('error',reject);p.on('close',code=>{if(code)return reject(Error(err));try{resolve(out.trim().split('\n').map(JSON.parse));}catch(e){reject(e);}});p.stdin.end(cases.map(c=>JSON.stringify({operation:'compound-store',action:'impact-provider',value:endpoint,now,...c})).join('\n')+'\n');});
const row=(platform,id)=>({platform,account:platform==='tw'||platform==='x'?'gabe_maxxing':'gabe.maxxing',post_url:platform==='tt'?'https://www.tiktok.com/@gabe.maxxing/video/'+id:platform==='ig'?'https://www.instagram.com/reel/'+id+'/':platform==='x'?'https://x.com/gabe_maxxing/status/'+id:'https://www.youtube.com/watch?v='+id});
const cases=[{platform:'x',rows:Array.from({length:101},(_,i)=>row('x',String(i+1)))},{platform:'tt',rows:Array.from({length:21},(_,i)=>row('tt',String(i+1)))},{platform:'ig',rows:[row('ig','KNOWN'),row('ig','LATER')]},{platform:'yt',rows:Array.from({length:51},(_,i)=>row('yt',String(i).padStart(11,'0')))},{platform:'tw',rows:[],account:'gabe_maxxing'},{platform:'li',rows:[]}];let comparisons=0;
try{
 for(const env of [{},credentials,{ORIANE_API_KEY:'fixture-oriane-token'}])for(const c of cases){
  mode='ok';for(const k of Object.keys(credentials))delete process.env[k];Object.assign(process.env,env);const input={account:'gabe.maxxing',registered:c.rows,...c};calls=[];const adapter={tt,ig,x,li,yt,tw}[c.platform];const expected=c.platform==='tw'?await tw(input.account,{fetcher:fixture}):await adapter(input.rows,{account:input.account,registered:input.registered,fetcher:fixture});const oldCalls=calls.length;calls=[];const [actual]=await native([input],env);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected)),c.platform);if(c.platform!=='tw')assert.equal(calls.length,oldCalls,c.platform+' number of requests');assert.equal(failures.length,0);comparisons++;
 }
 for(const scenario of ['insights-denied','insights-rate-limit','account-mismatch','analytics-denied','tt-rate-code']){
  mode=scenario;Object.assign(process.env,credentials);const c=cases.find(c=>c.platform===(scenario==='analytics-denied'?'yt':scenario==='tt-rate-code'?'tt':'ig'));const input={account:'gabe.maxxing',registered:c.rows,...c};let expected;try{expected=await({ig,yt,tt}[c.platform])(input.rows,{account:input.account,registered:input.registered,fetcher:fixture});}catch(e){expected={error:e.message,status:e.status||0,retryAfter:e.retryAfter||0};}const [actual]=await native([input],credentials);assert.deepEqual(actual,expected,scenario);assert(!JSON.stringify(actual).includes('PRIVATE'));comparisons++;
 }
 // X classification excludes quoted/parent media; preserve usable zero measurements.
 mode='ok';const [classified]=await native([{...cases[0],rows:cases[0].rows.slice(0,5)}],credentials);assert.deepEqual(classified.updates.map(v=>v.patch.post_type),['original','reply','quote','repost','original']);assert.deepEqual(classified.updates.map(v=>v.patch.media_type),['video','video','video','video','image']);assert.equal(classified.updates[0].patch.shares,1);assert.equal(classified.updates[0].patch.saves,0);
 // Fixed first-party origins, no redirects, no public network in isolated mode.
 mode='redirect';const [redirect]=await native([{...cases[0],rows:cases[0].rows.slice(0,1)}],credentials);assert.equal(redirect.status,302);assert(calls.every(c=>c.host!=='evil.test'));
 const [badFixture]=await native([{...cases[0],value:'https://evil.test'}],credentials);assert.equal(badFixture.error,'Invalid provider fixture endpoint.');const [missingFixture]=await native([{...cases[0],value:''}],credentials);assert.equal(missingFixture.error,'Isolated provider tests require a loopback fixture.');
 mode='invalid-json';const [badJSON]=await native([{...cases[0],rows:cases[0].rows.slice(0,1)}],credentials);assert.equal(badJSON.error,'Provider returned invalid JSON. Previous metrics kept.');
 mode='ok';calls=[];const [one,two]=await native([{platform:'tw',account:'gabe_maxxing'},{platform:'tw',account:'gabe_maxxing',archives:true}],credentials);assert.equal(calls.filter(c=>c.host==='id.twitch.tv').length,1);assert.equal(one.posts.length,3);assert.equal(two.posts.length,4);assert.equal(one.posts.some(p=>p.video_kind==='archive'),false);assert.equal(two.posts.some(p=>p.video_kind==='archive'),true);
 // Exercise the actual scheduler, shared lock/cadence, stale owner CAS and queued browser fallback.
 Date.now=oldClock;mode='ok';for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API|COMPOUND_V2_PREFIX/.test(k))delete process.env[k];Object.assign(process.env,baseEnv);for(const k of Object.keys(credentials))delete process.env[k];
 const impact=await import('../../api/_compound-v2/impact/store.js'),scheduler=await import('../../api/_compound-v2/impact/sync.js');const ik=impact.ikey;
 const originalFetch=globalThis.fetch;globalThis.fetch=fixture;
 try{
  const empty=await native([{action:'impact-sync',force:true}],{});assert.equal(empty[0].updated,0);assert.equal(empty[0].platforms.li.mode,'manual');assert.equal(empty[0].platforms.tw.mode,'not_configured');assert.equal((await native([{action:'impact-sync'}],{}))[0].cached,true);assert.equal((await scheduler.sync()).cached,true);
  assert.deepEqual(new Set(await runtime.client.sMembers(ik('browser-queue'))),new Set(['tt:gabriellvl','tt:gabinho_bjj','tt:gabe.maxxing','ig:gabe.maxxing','ig:gabinho_bjj']));
  const xPost={post_url:'https://x.com/gabe_maxxing/status/55555',account:'gabe_maxxing',post_type:'original',media_type:'video',original_by_gabe:true,views:0,posted_at:new Date(Date.now()-3600000).toISOString()};const saved=await impact.save(xPost);
  let syncResult=(await native([{action:'impact-sync',force:true,platform:'x'}],credentials))[0];assert.equal(syncResult.updated,1);assert.equal((await impact.records()).find(r=>r.id===saved.id).views,100);assert.equal(await runtime.client.get(ik('sync-lock')),null);
  Object.assign(process.env,credentials);await runtime.client.del(ik('sync-status'));const cachedCadence=await scheduler.sync({platform:'x'});assert.equal(cachedCadence.updated,0);assert.equal(cachedCadence.platforms.x,undefined);
  const old=await scheduler.sync({force:true,platform:'x'});assert.equal(old.updated,1);
  let changed=false;onRequest=async({host})=>{if(host==='api.x.com'&&!changed){changed=true;await impact.save({post_url:xPost.post_url,views:54321});}};const conflicted=(await native([{action:'impact-sync',force:true,platform:'x'}],credentials))[0];assert.equal(conflicted.updated,0);assert.equal((await impact.records()).find(r=>r.id===saved.id).views,54321);onRequest=null;
  mode='rate-limit';const limited=(await native([{action:'impact-sync',force:true,platform:'x'}],credentials))[0];assert.equal(limited.platforms.x.mode,'error');assert.ok(await runtime.client.ttl(ik('provider-backoff:x:gabe_maxxing'))>7190);calls=[];await native([{action:'impact-sync',force:true,platform:'x'}],credentials);assert.equal(calls.length,0);await runtime.client.del(ik('provider-backoff:x:gabe_maxxing'));
  mode='ok';await runtime.client.del(ik('sync-status'));onRequest=async()=>new Promise(r=>setTimeout(r,30));const raced=await Promise.all(Array.from({length:8},(_,i)=>i%2?native([{action:'impact-sync',platform:'x',force:false}],credentials).then(v=>v[0]):scheduler.sync({platform:'x'})));assert.equal(raced.filter(v=>!v.busy&&!v.cached).length,1);onRequest=null;
  // A provider exceeding the whole-job budget releases its own lock and retains metrics/status.
  const before=await runtime.client.get(ik('sync-status')),beforeRows=await impact.records();onRequest=async()=>new Promise(r=>setTimeout(r,250));const expired=(await native([{action:'impact-sync',force:true,platform:'x',budget:20}],credentials))[0];assert.match(expired.error,/time limit/);assert.equal(await runtime.client.get(ik('sync-lock')),null);assert.equal(await runtime.client.get(ik('sync-status')),before);assert.deepEqual(await impact.records(),beforeRows);onRequest=null;
  await runtime.client.set(ik('sync-lock'),'someone-else',{EX:120});assert.equal((await native([{action:'impact-sync',force:true}],credentials))[0].busy,true);assert.equal(await runtime.client.get(ik('sync-lock')),'someone-else');await runtime.client.del(ik('sync-lock'));
  assert.equal((await native([{action:'impact-sync',platform:'not-real'}],credentials))[0].error,'Unknown platform.');
 }finally{globalThis.fetch=originalFetch;onRequest=null;}
 console.log('PASS: Impact shared scheduler locks/cadence, provider backoff, original rows retained on failure, owner-edit CAS, browser queue, and whole-job deadline releasing only its own lock.');
 assert.equal(failures.length,0);console.log(`PASS: ${comparisons} old/Rust provider contracts: six platforms, owner permissions, 100/20/50-item batches, discovery owner/media filters, official→Oriane fallback, zero metrics, insights denials, 429 Retry-After, fixed-origin token routing, redirects disabled, isolated network guard and Twitch token reuse.`);
}finally{Date.now=oldClock;server.closeAllConnections();await new Promise(r=>server.close(r));await runtime.close();setTimeout(()=>process.exit(process.exitCode||0),100).unref();}
