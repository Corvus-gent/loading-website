import assert from'node:assert/strict';import crypto from'node:crypto';import fs from'node:fs';import{createClient}from'redis';
assert.equal(process.env.REDIS_URL,'redis://127.0.0.1:16380/12');process.env.BUILD_INGEST_TOKEN='local-test-build-ingest-token-only-0000';process.env.BUILD_VERCEL_WEBHOOK_SECRET='local-webhook-only';
const{default:handler,validSnapshot,publish,read,deploymentWebhook}=await import('../../api/_build-stats.js');const seed=JSON.parse(fs.readFileSync('build/seed.json'));assert(validSnapshot(seed));assert(!validSnapshot({...seed,total:-1}));assert(!validSnapshot({...seed,history:[]}));
const c=createClient({url:process.env.REDIS_URL});await c.connect();const keysBefore=new Set(await c.keys('stats:build:*'));
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(body){this.body=body;return this;},send(body){this.body=body;return this;},end(){return this;}};}
try{let res=response();await handler({method:'POST',query:{},headers:{},body:seed},res);assert.equal(res.code,401);
await publish({...seed,updated:new Date().toISOString()});assert.equal((await read()).total,seed.total);assert((await c.keys('stats:build:20*')).length>10);
const event={type:'deployment.succeeded',createdAt:Date.now(),payload:{project:{id:'prj_lMs6LG5fIdeSfIfD0XupJyfEijOb'},deployment:{id:'dpl_local_test'},target:'production'}};const body=JSON.stringify(event),signature=crypto.createHmac('sha1',process.env.BUILD_VERCEL_WEBHOOK_SECRET).update(body).digest('hex');
let r=await deploymentWebhook(new Request('https://corvus.gent/api/build?deployment=1',{method:'POST',body,headers:{'x-vercel-signature':'a'.repeat(40)}}));assert.equal(r.status,401);
for(let i=0;i<2;i++){r=await deploymentWebhook(new Request('https://corvus.gent/api/build?deployment=1',{method:'POST',body,headers:{'x-vercel-signature':signature}}));assert.equal(r.status,200);}
assert.equal((await read()).deployments.filter(d=>d.id==='dpl_local_test').length,1);
res=response();await handler({method:'GET',query:{image:'1'},headers:{}},res);assert.equal(res.code,200);assert(Buffer.isBuffer(res.body));assert.equal(res.headers['Content-Type'],'image/png');
res=response();await handler({method:'GET',query:{},headers:{}},res);assert(!JSON.stringify(res.body).includes(process.env.BUILD_INGEST_TOKEN));console.log('Build API: auth, validated snapshots, backfill, webhook signature/replay, OG and no token leak passed.');
}finally{const added=(await c.keys('stats:build:*')).filter(k=>!keysBefore.has(k));if(added.length)await c.del(added);await c.quit();}

process.exit(0);
