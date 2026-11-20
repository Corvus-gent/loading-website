import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
const runtime=await isolatedRuntime('geo'),{client}=runtime;
for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API|POSTHOG/.test(k))delete process.env[k];const env={PATH:process.env.PATH,REDIS_URL:client.options.url,SESSION_SECRET:runtime.secret,CORVUS_RUST_WRITES:'isolated'};Object.assign(process.env,env);
const old=await import('../../api/_health-history.js');const H=3600000,D=24*H,S=300000,now=Date.now(),slot=Math.floor(now/S)*S,base=slot-2*H;
const rust=row=>new Promise((resolve,reject)=>{const p=spawn('target/debug/corvus-contract',[],{env,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>{if(code)return reject(Error(err));try{const value=JSON.parse(out);if(value?.error)reject(Error(value.error));else resolve(value)}catch(e){reject(e)}});p.stdin.end(JSON.stringify({operation:'stats-store',now,...row})+'\n')});
const sample=(at,ms=30,ok=true)=>({checked_at:new Date(at).toISOString(),status:ok?(ms>=1500?'degraded':'ok'):'degraded',checks:{site:{ok:true,ms:10},redis:{ok,ms},notion:{skipped:true,ok:null,ms:0}}});
async function compare(label){for(const range of ['24h','7d','30d']){const legacy=await old.history(now,range);const native=await rust({action:'health-history',range});assert.deepEqual(native,legacy,label+' '+range);} }
try{
 await compare('empty');
 // Mixed old/new callers share one atomic five-minute slot; replay cannot double count.
 await Promise.all(Array.from({length:8},(_,i)=>i%2?old.record(sample(base),now):rust({action:'health-record',sample:sample(base)})));assert.equal(await client.zCard('health:v2:raw'),1);
 await old.record(sample(base+S,2000),now);await rust({action:'health-record',sample:sample(base+2*S,2700,false)});await old.record(sample(base+3*S),now);await compare('healthy/degraded/down/recovered');
 let result=await rust({action:'health-history',range:'24h'});assert.equal(result.uptime[0],75);assert.equal(result.incidents.length,1);assert.deepEqual(result.series.redis,[[30,30,1],[2000,2000,2],[2700,2700,3],[30,30,1]]);assert.equal(result.checks.find(c=>c.name==='redis').days.length,90);
 // Two real legacy import batches, with either implementation allowed to resume.
 const start=base-3*D;
 for(let i=0;i<241;i++)await client.zAdd('health:log',{score:start+i*S,value:JSON.stringify({at:start+i*S,checks:{site:[1,20],redis:[i===239?0:1,i===239?2200:40],notion:[2,0]},status:i===239?'degraded':'ok'})});
 await rust({action:'health-import'});assert.equal(await client.get('health:v2:legacy-cursor'),String(start+239*S));assert.equal(await client.zCard('health:log'),1);await old.importLegacy();assert.equal(await client.get('health:v2:legacy-cursor'),'done');assert.equal(await client.zCard('health:log'),0);await rust({action:'health-import'});await compare('legacy import resumed across runtimes');
 const before=await rust({action:'health-history',range:'24h'});await old.importLegacy();await rust({action:'health-import'});assert.deepEqual(await rust({action:'health-history',range:'24h'}),before,'completed import idempotent');
 await old.record(sample(slot),now);await rust({action:'health-record',sample:sample(slot+1,1700),monitor:true});await old.record(sample(slot+1,1700),now,true);await rust({action:'health-record',sample:sample(slot+2),monitor:false});assert.equal(await client.zCard('health:v2:raw'),6,'monitor has precedence inside visitor slot');await compare('monitor priority');
 const rawCount=await client.zCard('health:v2:raw');await rust({action:'health-record',sample:sample(base-S)});assert.equal(await client.zCard('health:v2:raw'),rawCount,'out-of-order samples do not rewrite history');
 assert((await client.ttl('health:v2:raw'))<=172800);assert((await client.ttl('health:v2:first'))>119*86400);assert((await client.ttl('health:v2:ledger'))>119*86400);assert((await client.ttl('health:last'))>29*86400);assert((await client.ttl('health:v2:h:'+Math.floor(base/H)*H))>29*86400);const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(base);assert((await client.ttl('health:v2:d:'+day))>119*86400);
 // Fill all resolutions and prove actual read-only projection leaves bytes/retention alone.
 const aggregate=Object.fromEntries(['overall',...old.names].map(n=>[n,[12,12,1200,140,1,0]])),cells=Object.fromEntries(['overall',...old.names].map(n=>[n,[1,100,1]]));
 for(let i=0;i<288;i++)await client.zAdd('health:v2:raw',{score:slot-i*S,value:JSON.stringify({at:slot-i*S,cells})});
 for(let i=0;i<=720;i++)await client.set('health:v2:h:'+(Math.floor(now/H)*H-i*H),JSON.stringify(aggregate),{EX:2592000});
 for(const date of (await old.history(now)).days)await client.set('health:v2:d:'+date,JSON.stringify(aggregate),{EX:10368000});
 const keys=(await client.keys('*')).sort(),beforeBytes=await Promise.all(keys.map(k=>client.sendCommand(['DUMP',k])));await compare('full 30-day projection');assert.deepEqual((await client.keys('*')).sort(),keys);assert.deepEqual(await Promise.all(keys.map(k=>client.sendCommand(['DUMP',k]))),beforeBytes);
 console.log('PASS mixed-runtime health writes, duplicate/out-of-order suppression, monitor priority, incidents, resumed 241-row legacy backfill, retention, sparse/full 24h/7d/30d reads and no read-side mutation; isolated Redis only');
}finally{await runtime.close();setTimeout(()=>process.exit(process.exitCode||0),100).unref();}
