import assert from 'node:assert/strict';import sharp from 'sharp';import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
const rt=await isolatedRuntime('og,compound-v2'),base=rt.url+'?module=og&';const calls=[];
const request=async(q,method='GET')=>{const r=await fetch(base+new URLSearchParams(q),{method});assert.equal(r.headers.get('x-content-type-options'),'nosniff');calls.push([q,method,r.status]);return r};
try{
 for(const kind of ['live','hack3','compound']){
  let r=await request({kind});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/png/);let bytes=Buffer.from(await r.arrayBuffer());assert.deepEqual([(await sharp(bytes).metadata()).width,(await sharp(bytes).metadata()).height],[1200,630]);
  r=await request({kind,ogPage:'1'});assert.equal(r.status,200);const html=await r.text();assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);assert.equal((html.match(/property="og:title"/g)||[]).length,1);assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
  r=await request({kind},'HEAD');assert.equal(r.status,200);assert.equal(await r.text(),'');
 }
 for(const q of [{kind:'missing'},{kind:'interview',n:'1'},{kind:'compound',lang:'bad'},{kind:'compound',lang:'en',hook:'mom',n:'0'}]){const r=await request(q);assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store');}
 assert.equal((await request({kind:'live'},'POST')).status,405);
 await rt.client.sAdd('worldcraft:features:v2:players',['one','two']);await rt.client.hSet('worldcraft:features:v2:stats',{total_play_seconds:'7200',comments:'0',shares:'8'});
 let r=await request({kind:'curiositycraft'});assert.equal(r.status,200);assert.equal((await sharp(Buffer.from(await r.arrayBuffer())).metadata()).width,1200);
 const row={n:7,builder:'Gabe <script>',project:'Robots & friends',description:'It moves.',consent:true,photo_url:'',updated_at:'2026-11-08T12:00:00.000Z'};
 // Same key namespace as the public interview registry; no Blob cleanup or external jobs.
 for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API|VERCEL_ENV/.test(k))delete process.env[k];Object.assign(process.env,{REDIS_URL:rt.client.options.url,SESSION_SECRET:rt.secret});
 const {key}=await import('../../api/_interviews/store.js');await rt.client.set(key('record:7'),JSON.stringify(row));await rt.client.zAdd(key('index'),[{score:Date.now(),value:'7'}]);
 r=await fetch(rt.url+'?module=compound-v2&interviewPage=7');assert.equal(r.status,200);let html=await r.text();assert.ok(html.includes('Gabe &lt;script&gt;'));assert.ok(html.includes('https://corvus.gent/hack/3?interview=7'));
 r=await fetch(rt.url+'?module=compound-v2&interviewCard=7');assert.equal(r.status,200);assert.equal((await sharp(Buffer.from(await r.arrayBuffer())).metadata()).height,630);
 // Multiple requests use bounded native workers/cache; no mutations in the renderer.
 const keys=await rt.client.keys('*');const parallel=await Promise.all(Array.from({length:8},()=>request({kind:'compound',lang:'ar',hook:'mom'})));assert.ok(parallel.every(r=>r.status===200));for(const r of parallel)await r.arrayBuffer();assert.deepEqual((await rt.client.keys('*')).sort(),keys.sort());
 await rt.client.disconnect();
 console.log('PASS native OG HTTP: GET/HEAD/cache, live/hack/Compound HTML metadata, 404/405, native PNGs, Curiosity counts, interview aliases, escaped builder, concurrent cached requests; isolated Redis only.');
}finally{await rt.close();}
