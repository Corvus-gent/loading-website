import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
const runtime=await isolatedRuntime('compound'),{client,secret}=runtime;
for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API|LEGION|ARMY_|ADMIN_PASSWORD|RESEND|DISCORD/.test(k))delete process.env[k];
const env={PATH:process.env.PATH,REDIS_URL:client.options.url,SESSION_SECRET:secret,ARMY_NAMESPACE:'army-jobs:native:',CORVUS_RUST_WRITES:'isolated'};Object.assign(process.env,env);
let now=Date.parse('2026-11-22T08:00:00Z');const DAY=86400,redis=args=>client.sendCommand(args.map(String));const actual=Date.now;Date.now=()=>now;
const rust=fields=>new Promise((resolve,reject)=>{const p=spawn('target/debug/corvus-contract',[],{env,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>{if(code)return reject(Error(err));try{resolve(JSON.parse(out))}catch(e){reject(e)}});p.stdin.end(JSON.stringify({operation:'army-store',action:'jobs',now,...fields})+'\n');});
const {armyStore}=await import('../../api/_army/_store.js'),{armyService}=await import('../../api/_army/_service.js'),{armyJobs}=await import('../../api/_army/_jobs.js'),{digest}=await import('../../api/_army/_security.js');
const old=armyStore({redis,now:()=>now,prefix:'army-jobs:old:'}),native=armyStore({redis,now:()=>now,prefix:env.ARMY_NAMESPACE});const jobs=armyJobs(armyService({store:old}));
const equal=(a,b)=>assert.deepEqual(a,JSON.parse(JSON.stringify(b)));
const seed=async(n,extra={})=>{const u={id:'jobsfixture'+String(n).padStart(13,'0'),code:'jjjjjjj'+String.fromCharCode(96+n),username:'jobs_'+n,email:'jobs_'+n+'@example.test',lang:'en',status:'approved',created:new Date(now).toISOString(),verifiedAt:new Date(now).toISOString(),expires:new Date(now+10*DAY*1000).toISOString(),feathers:[],...extra};for(const store of[old,native])await store.persist(u);return u;};
const sub=async(u,kind,extra={})=>{for(const s of[old,native])await s.own(u.id,'sub:'+u.id+':'+kind,{confirmed:true,lang:'en',lastSent:null,...extra},365*DAY)};
try{
 const paid=await seed(1,{membership:{tier:'senator',state:'active'}}),confirmed=await seed(2),pending=await seed(3,{verifiedAt:null,status:'unconfirmed'}),deleted=await seed(4),unsubscribed=await seed(5);
 await sub(paid,'daily');await sub(paid,'weekly');await sub(confirmed,'daily');await sub(confirmed,'weekly',{lastSent:'2026-11-22'});await sub(pending,'daily');await sub(deleted,'daily');await sub(unsubscribed,'daily',{confirmed:false});for(const s of[old,native])await s.persist({...deleted,status:'deleting'});
 equal(await rust({dry:true}),await jobs.run({dryRun:true}));assert.equal((await native.getUser(paid.id)).expires,paid.expires);assert.equal(await client.zCard(native.key('outbox')),0);
 const first=await rust({});equal(first,await jobs.run());assert.equal(first.queued,3);assert.equal(first.delivery.state,'not_configured');assert.equal((await native.getUser(paid.id)).expires,new Date(now+365*DAY*1000).toISOString());assert.equal((await native.getUser(confirmed.id)).expires,confirmed.expires);
 equal(await rust({}),await jobs.run());assert.equal(await client.zCard(native.key('outbox')),3);
 for(const [u,kind]of[[paid,'daily'],[paid,'weekly'],[confirmed,'daily']]){const id=digest('reminder:'+u.id+':'+kind+':2026-11-22').slice(0,24);const actual=await native.get('mail:'+id);equal(actual,await old.get('mail:'+id));assert.equal(actual.data.number,19);assert.equal(actual.data.type,'wordle');assert(!JSON.stringify(actual).includes('answer'));}
 // Brussels 08:00 boundary, including DST transition, stays identical.
 for(const stamp of['2026-11-23T06:59:59Z','2026-11-23T07:00:00Z','2026-10-25T05:59:59Z','2026-10-25T07:00:00Z']){now=Date.parse(stamp);equal(await rust({dry:true}),await jobs.run({dryRun:true}));}
 now=Date.parse('2026-11-22T08:00:00Z');await client.set(native.key('lock:jobs'),'someone-else',{EX:60});assert.equal((await rust({})).error,'busy');await client.del(native.key('lock:jobs'));
 const aborted=await rust({budget:0});assert.equal(aborted.state,'retry');assert.equal(aborted.reason,'deadline');assert.equal(await client.exists(native.key('lock:jobs')),0);assert.equal((await rust({})).queued,0);
 console.log('PASS: Army jobs Sunday/daily scheduling, Brussels 08:00/DST boundary, deterministic outbox dedupe, active lifetime retention, pending/unsubscribed exclusions, dry-run, exclusive lease, bounded cancellation and safe retry. No real mail/provider requests.');
}catch(e){process.exitCode=1;console.error(e);}finally{Date.now=actual;await runtime.close();setTimeout(()=>process.exit(process.exitCode||0),100).unref();}
