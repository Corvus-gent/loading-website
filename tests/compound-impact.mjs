import assert from 'node:assert/strict';
process.env.REDIS_URL='redis://127.0.0.1:16380/10';process.env.COMPOUND_V2_PREFIX='test:impact:'+Date.now();process.env.COMPOUND_V2_ADMIN_PASSWORD='impact-owner-test';process.env.SESSION_SECRET='impact-test-only';
const {default:handler}=await import('../api/_compound-v2/impact/handler.js');
const store=await import('../api/_compound-v2/impact/store.js');
const {postInfo,bulkRows,velocity}=await import('../api/_compound-v2/impact/model.js');
const {targetURL,countClick}=await import('../api/_compound-v2/impact/links.js');
const {key}=await import('../api/_compound-v2/store.js');const {redis}=await import('../api/_redis.js');
const req=(body,extra={})=>({method:body?'POST':'GET',query:{impact:'1'},headers:{origin:'https://corvus.gent','content-type':'application/json',authorization:'Bearer impact-owner-test','user-agent':'Mozilla/5.0 impact test','x-forwarded-for':'198.51.100.73',...extra},body});
async function run(r){const out={headers:{},statusCode:200};const res={setHeader:(k,v)=>out.headers[k]=v,status:c=>(out.statusCode=c,res),json:d=>(out.body=d,out),end:()=>out};await handler(r,res);return out;}
try{
 assert.equal((await run({...req(),query:{private:'1'},headers:{}})).statusCode,401);
 assert.equal((await run({...req({action:'save'}),headers:{}})).statusCode,401);
 assert.equal((await run(req({action:'save'}, {authorization:'',origin:'https://evil.example'}))).statusCode,401);
 await store.seed();let r=await store.report();assert.equal(r.totals.views,10957);assert.equal(r.totals.engagements,70);assert.equal(r.posts.length,5);assert.ok(r.posts.every(v=>v.velocity===null&&v.comments===null));
 await store.seed();assert.equal((await store.report()).posts.length,5);
 const url='https://x.com/gabe_maxxing/status/2119723523795276255';const row={slug:'x-gm-en-demo1',platform:'x',account:'gm',lang:'en',hook:'demo',n:1,post_url:url,compound_url:'https://compound.mov/v/test',views:100,likes:3,comments:2,shares:1,updated_at:new Date().toISOString(),private_note:'must stay private'};await redis(['HSET',key('videos'),row.slug,JSON.stringify(row)]);
 r=await store.report();assert.equal(r.posts.length,6);assert.equal(r.totals.views,11057);assert.ok(!JSON.stringify(r).includes('private_note'));
 const save=await run(req({action:'save',post:{post_url:url,views:300,made_with_compound:true,posted_at:new Date(Date.now()-3600000).toISOString()}}));assert.equal(save.statusCode,200);assert.equal(JSON.parse(await redis(['HGET',key('videos'),row.slug])).views,300);assert.equal(JSON.parse(await redis(['HGET',key('videos'),row.slug])).private_note,'must stay private');
 assert.ok((await store.report()).posts.find(p=>p.slug===row.slug).velocity>300);
 await store.save({post_url:url,made_with_compound:false});assert.equal((await store.report()).totals.views,10957);
 const parsed=bulkRows('https://x.com/gabe_maxxing/status/2116903246925005017 — 5,052 views, 54 likes, 3 comments');assert.equal(parsed[0].views,5052);assert.equal(parsed[0].comments,3);assert.throws(()=>bulkRows('https://evil.example — 100 views'));
 assert.equal((await run(req({action:'bulk',text:'https://x.com/gabe_maxxing/status/2116942344897315184 — 2200 views, 4 likes'}))).statusCode,200);
 const before=(await store.report()).totals.views;assert.equal((await run(req({action:'bulk',text:'https://evil.example — 10 views'}))).statusCode,400);assert.equal((await store.report()).totals.views,before);
 assert.equal(postInfo('https://twitter.com/gabe_maxxing/status/2116903246925005017?utm_source=x').id,postInfo('https://x.com/gabe_maxxing/status/2116903246925005017').id);
 assert.throws(()=>targetURL('https://evil.example'));process.env.COMPOUND_REF_CODE='GABE';process.env.COMPOUND_REF_PARAM='partner';assert.equal(new URL(targetURL('https://compound.mov/v/abc?x=1')).searchParams.get('partner'),'GABE');delete process.env.COMPOUND_REF_CODE;
 await countClick(req(),'impact');await countClick(req(),'impact');assert.equal((await store.clickReport()).total,1);
 assert.equal((await run({...req(),query:{go:'impact',to:'https://evil.example'}})).statusCode,400);
 const x=(await import('../api/_compound-v2/impact/adapters/x.js')).default;delete process.env.X_BEARER_TOKEN;assert.equal((await x([])).mode,'manual');process.env.X_BEARER_TOKEN='mock';const result=await x([{post_url:url}],{fetcher:async()=>({ok:true,json:async()=>({data:[{id:'2119723523795276255',public_metrics:{impression_count:100,like_count:2,reply_count:3,retweet_count:4,quote_count:5,bookmark_count:6}}]})})});assert.equal(result.updates[0].patch.shares,9);assert.equal(result.updates[0].patch.saves,6);delete process.env.X_BEARER_TOKEN;
 assert.equal(velocity({posted_at:'2026-11-01',metrics_at:'2026-11-04',views:1000}),null);
 await store.snapshot();assert.ok((await store.report()).history.length);const sync=await (await import('../api/_compound-v2/impact/sync.js')).sync({force:true});assert.equal(sync.platforms.x.mode,'manual');assert.equal(sync.platforms.li.mode,'manual');
 console.log('PASS: seed totals, registry reuse, private-field isolation, owner auth, manual/bulk saves, Compound filter, canonical URLs, click dedupe/referrals, snapshots, honest velocity and optional adapters.');
}catch(e){console.error(e);process.exitCode=1;}finally{const keys=await redis(['KEYS',process.env.COMPOUND_V2_PREFIX+':*']);for(const k of keys)await redis(['DEL',k]);process.exit(process.exitCode||0);}
