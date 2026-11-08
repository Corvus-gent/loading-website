import assert from 'node:assert/strict';
import {createStatusReader,STREAM_LINKS} from '../api/_live.js';
let calls=0,clock=0,online=true;const env={TWITCH_CLIENT_ID:'test-id',TWITCH_CLIENT_SECRET:'test-secret'};
const fetcher=async(url,options)=>{calls++;if(url.includes('oauth2')){assert.equal(options.method,'POST');return{ok:true,json:async()=>({access_token:'private-test-token',expires_in:3600})};}assert.equal(options.headers.Authorization,'Bearer private-test-token');return{ok:true,json:async()=>({data:online?[{user_login:'gabe_maxxing',type:'live',id:'one'}]:[]})};};
for(const mode of[false,true]){const read=createStatusReader({mode,env,fetcher});assert.equal((await read()).live,mode);}assert.equal(calls,0,'manual mode never requires Twitch');
assert.equal((await createStatusReader({mode:'auto',env:{},fetcher})()).live,false);assert.equal(calls,0);
const read=createStatusReader({mode:'auto',env,fetcher,now:()=>clock});const results=await Promise.all([read(),read(),read()]);assert(results.every(s=>s.live));assert.equal(calls,2,'one token and status request, coalesced');
await read();assert.equal(calls,2);online=false;clock=61000;assert.equal((await read()).live,false);assert.equal(calls,3,'token reused across polls');
const broken=createStatusReader({mode:'auto',stream:'test-stream',env,fetcher:async()=>{throw Error('test-secret must not leak');}});assert.deepEqual(await broken(),{live:false,source:'fallback',session:'manual-test-stream'});
assert(!JSON.stringify(results).includes('test-token'));
assert.equal(STREAM_LINKS.twitch,'https://www.twitch.tv/gabe_maxxing');assert.equal(STREAM_LINKS.instagram,'https://www.instagram.com/gabe.maxxing');
const {default:handler}=await import('../api/_live.js');function res(){return{headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;},end(){return this;}};}
for(const slug of Object.keys(STREAM_LINKS)){const r=res();await handler({method:'HEAD',headers:{},query:{slug}},r);assert.equal(r.code,302);assert.equal(r.headers.Location,STREAM_LINKS[slug]);}
const missing=res();await handler({method:'HEAD',headers:{},query:{slug:'//evil.test'}},missing);assert.equal(missing.code,404);
console.log('PASS: manual on/off, missing credentials, Twitch live/offline/cache/coalescing/token reuse, provider failure, safe redirects, no secret exposure.');
