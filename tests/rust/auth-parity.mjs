import {impactStoreContracts} from './impact-store.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {createClient} from 'redis';
import {createHash,createHmac} from 'node:crypto';
import {existsSync} from 'node:fs';
import {interviewContracts} from './interviews-parity.mjs';
import {compoundHttpContracts} from './compound-http.mjs';
import {compoundStoreContracts} from './compound-store.mjs';
import {hackContracts} from './hack-parity.mjs';
import {nameVoteContracts} from './name-vote-parity.mjs';
import {liveContracts} from './live-parity.mjs';
import {voterContracts} from './voter-parity.mjs';
import {battleContracts} from './battle-parity.mjs';
import {supportContracts} from './support-parity.mjs';
import {plethoraContracts} from './plethora-parity.mjs';
const freePort=async()=>{const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;};
const port=await freePort(),rustPort=await freePort();
const redisBin=process.env.REDIS_SERVER||(existsSync('/tmp/corvus-redis-tests/source/src/redis-server')?'/tmp/corvus-redis-tests/source/src/redis-server':'redis-server');
const redis=spawn(redisBin,['--bind','127.0.0.1','--port',String(port),'--save','','--appendonly','no'],{stdio:'ignore'});
const secret='rust-parity-fixture-not-a-real-secret';
const env={PATH:process.env.PATH,LANG:'en_US.UTF-8',REDIS_URL:`redis://127.0.0.1:${port}/1`,SESSION_SECRET:secret,PLETHORA_ADMIN_KEY:secret,CALL_ADMIN_KEY:secret,BATTLE_ADMIN_KEY:secret,COMPOUND_V2_ADMIN_PASSWORD:secret,ORIANE_API_KEY:'',CORVUS_RUST_MODULES:'auth,layers,live,plethora,support,battle,name-vote,hack,compound-v2,compound-summary',CORVUS_RUST_WRITES:'isolated',RUST_DEV_PORT:String(rustPort)};
const rust=spawn('target/debug/corvus-dev',[],{env,stdio:['ignore','pipe','pipe']});
let rustOutput='';rust.stderr.on('data',d=>rustOutput+=d);
const client=createClient({url:env.REDIS_URL,socket:{reconnectStrategy:()=>50}});client.on('error',()=>{});
let legacy;
try{
 await Promise.race([client.connect(),new Promise((_,j)=>setTimeout(()=>j(Error('Redis failed to start')),5000))]);
 for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API/.test(k))delete process.env[k];
 delete process.env.RESEND_API_KEY;
 Object.assign(process.env,env);
 const {default:handler}=await import('../../api/auth.js');const {default:legion}=await import('../../api/_legion/handler.js');const {default:live}=await import('../../api/_live.js');const {default:plethora}=await import('../../api/_plethora.js');const {default:support}=await import('../../api/_support.js');const {default:battle}=await import('../../api/_battle.js');const {default:nameVote}=await import('../../api/_name-vote.js');const {default:hack}=await import('../../api/_hack.js');const {default:compoundV2}=await import('../../api/_compound-v2/handler.js');const {default:compoundSummary}=await import('../../api/_compound-v2/summary.js');
 legacy=http.createServer(async(req,res)=>{try{let b='';for await(const chunk of req)b+=chunk;req.body=b?JSON.parse(b):{};req.query=Object.fromEntries(new URL(req.url,'http://localhost').searchParams);const module=req.query.module;delete req.query.module;res.status=n=>(res.statusCode=n,res);res.send=v=>res.end(v);res.json=v=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};if(module==='compound-summary')await compoundSummary(req,res);else if(module==='compound-v2')await compoundV2(req,res);else if(module==='hack')await hack(req,res);else if(module==='name-vote')await nameVote(req,res);else if(module==='layers')await legion(req,res);else if(module==='live')await live(req,res);else if(module==='battle')await battle(req,res);else if(module==='support')await support(req,res);else if(module==='plethora')await plethora(req,res);else await handler(req,res);}catch{res.statusCode=503;res.end('{}');}});
 await new Promise(r=>legacy.listen(0,'127.0.0.1',r));
 const urls={legacy:`http://127.0.0.1:${legacy.address().port}/`,rust:`http://127.0.0.1:${rustPort}/api/rust?module=auth`};
 for(let n=0;n<50;n++){try{if((await fetch(urls.rust)).ok)break;}catch{}if(n===49)throw Error('Rust did not start: '+rustOutput);await new Promise(r=>setTimeout(r,50));}
 const call=async(engine,body,cookie='',origin='https://corvus.gent')=>{const r=await fetch(urls[engine],{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',cookie},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
 const hash=v=>createHash('sha256').update(v+secret).digest('hex');
 const sign=v=>createHmac('sha256',secret).update(v).digest('base64url');
 const seed=async(email,code='123456')=>client.set(`otp:${hash(email)}`,JSON.stringify({h:hash(code),tries:0}),{EX:180});
 for(const body of [null,{action:'request',email:'outsider@example.test'},{action:'verify',email:'fixture@corvus.gent',code:'bad'},{action:'unknown'}])assert.deepEqual(await call('rust',body),await call('legacy',body));
 assert.equal((await call('rust',{action:'logout'},'','https://evil.example')).status,403);
 const prior='legacy-fixture-session';await client.set('sess:'+prior,'fixture@corvus.gent',{EX:600});
 const cookie=`sess=${prior}.${sign(prior)}`;
 assert.deepEqual(await call('rust',null,cookie),await call('legacy',null,cookie));
 assert.equal((await call('rust',null,cookie+'tampered')).body.email,null);
 await seed('fixture@corvus.gent');const won=await call('rust',{action:'verify',email:'fixture@corvus.gent',code:'123456'});assert.equal(won.status,200);assert.match(won.cookie,/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await call('legacy',null,won.cookie)).body.email,'fixture@corvus.gent');
 assert.equal((await call('legacy',{action:'verify',email:'fixture@corvus.gent',code:'123456'})).body.error,'code expired');
 await call('legacy',{action:'logout'},won.cookie);assert.equal((await call('rust',null,won.cookie)).body.email,null);
 for(const engine of ['legacy','rust']){
  await seed('attempt@corvus.gent');const responses=[];for(let i=0;i<4;i++)responses.push((await call(engine,{action:'verify',email:'attempt@corvus.gent',code:'000000'})).body.error);
  assert.deepEqual(responses,['wrong code','wrong code','wrong code','code expired']);
 }
 await seed('race@corvus.gent');const race=await Promise.all(Array.from({length:16},(_,i)=>call(i%2?'rust':'legacy',{action:'verify',email:'race@corvus.gent',code:'123456'})));
 assert.equal(race.filter(r=>r.status===200).length,1,'OTP must be single use across both runtimes');
 const keys=await client.keys('privacy:log:logins:*');assert.equal(keys.length,2);for(const k of keys)assert.ok((await client.ttl(k))<=7776000);
 const layer=async(engine,{path='/wiki/corvus',zone,operation,tab,cookie='',post=false}={})=>{
   const url=new URL(urls[engine]);url.searchParams.set('module','layers');if(!post){url.searchParams.set('action','layer_page');url.searchParams.set('path',path);if(zone)url.searchParams.set('zone',zone);if(operation)url.searchParams.set('operation',operation);}
   const r=await fetch(url,{method:post?'POST':'GET',headers:{cookie,origin:'https://corvus.gent','content-type':'application/json'},...(post?{body:JSON.stringify({action:'layer_tick',path,zone,operation,tab})}:{})});return{status:r.status,body:await r.text(),cookie:r.headers.get('set-cookie'),headers:r.headers};
 };
 for(const engine of ['legacy','rust']){
   const start=await layer(engine);assert.equal(start.status,200);assert.ok(start.body.includes('Your daily taste.'));assert.ok(start.headers.get('cache-control').includes('no-store'));
   const page=await layer(engine,{zone:'Europe/Brussels',cookie:start.cookie});assert.equal(page.status,200);assert.ok(page.body.includes('data-remaining="242000"'));
   const tab=/data-tab="([^"]+)"/.exec(page.body)[1],session=JSON.parse(Buffer.from(page.cookie.split('=')[1].split('.')[0],'base64url'));
   const other=engine==='rust'?'legacy':'rust';assert.equal((await layer(other,{post:true,cookie:page.cookie,tab,operation:'read'})).status,200);
   assert.equal((await layer(engine,{path:'/legion/call-room',cookie:page.cookie})).status,403);
   const zoneKeys=await client.keys('legion:preview:v2:taste-zone:'+session.id);assert.equal(zoneKeys.length,1);assert.equal(await client.get(zoneKeys[0]),'Europe/Brussels');
   const meters=(await client.keys('legion:preview:v2:taste:{'+session.id+':*')).filter(k=>!k.endsWith(':tabs'));assert.equal(meters.length,1);await client.hSet(meters[0],{used:'242000'});
   const exhausted=await layer(other,{cookie:page.cookie,zone:'Pacific/Auckland',operation:'pause'});assert.equal(exhausted.status,402);assert.ok(exhausted.body.includes('come back tomorrow'));
 }
 // A genuine legacy signed army member session must bypass the taste on Rust.
 const uid='u'.repeat(24);assert.equal(uid.length,24);const sid='s'.repeat(24);assert.equal(sid.length,24);
 const digest=value=>createHmac('sha256',secret).update('army:v1:'+value).digest('hex');
 await client.set('army:v1:session:'+digest(sid),JSON.stringify({uid}),{EX:600});await client.set('army:v1:u:'+uid,JSON.stringify({id:uid,status:'approved',legion:{rank:'senator'}}),{EX:600});
 const memberCookie=`army_session=${sid}.${digest('army_session:'+sid)}`;
 const member=await layer('rust',{path:'/legion/call-room',cookie:memberCookie});assert.equal(member.status,200);assert.ok(!member.body.includes('layer-clock'));
 await client.del('army:v1:session:'+digest(sid));assert.equal((await layer('rust',{path:'/legion/call-room',cookie:memberCookie})).status,403);
 console.log('PASS: bidirectional layer cookies; shared daily allowance; pinned timezone; paid member access and immediate revocation.');
 console.log('PASS: old cookies → Rust; Rust cookies → legacy; CSRF; OTP expiry, 3-attempt limit, concurrent single use; private log retention. No mail sent.');
 await liveContracts({urls,client,secret});
 await plethoraContracts({urls,client,secret});
 await supportContracts({urls,client,secret});
 await battleContracts({urls,client,secret});
 await voterContracts({client,secret});
 await nameVoteContracts({urls,client,secret});
 await hackContracts({urls,client,secret});
 await compoundStoreContracts({client,secret});
 await compoundHttpContracts({urls,client,secret});
 await interviewContracts({client,urls,secret});
 await impactStoreContracts({client,secret});
}finally{
 await client.disconnect().catch(()=>{});legacy?.closeAllConnections();legacy?.close();rust.kill('SIGTERM');redis.kill('SIGTERM');
 // The legacy module owns a Redis connection that is intentionally not exported.
 setTimeout(()=>process.exit(process.exitCode||0),100).unref();
}
