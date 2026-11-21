import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
const runtime=await isolatedRuntime('geo'),{client,secret}=runtime;
for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API|POSTHOG/.test(k))delete process.env[k];
const env={PATH:process.env.PATH,REDIS_URL:client.options.url,SESSION_SECRET:secret,CORVUS_RUST_WRITES:'isolated'};Object.assign(process.env,env);
const rust=fields=>new Promise((resolve,reject)=>{const p=spawn('target/debug/corvus-contract',[],{env,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>{if(code)return reject(Error(err));try{resolve(JSON.parse(out))}catch(e){reject(e)}});p.stdin.end(JSON.stringify({operation:'stats-store',...fields})+'\n')});
const {counters,brusselsDay}=await import('../../api/_stats-daily.js');const {sectionTasks}=await import('../../api/_stats-sections.js');
const now=Date.now(),today=brusselsDay(new Date(now)),past='2026-11-03',redis=args=>client.sendCommand(args.map(String));
try{
 for(const day of[today,past]){
  assert.deepEqual(await rust({action:'counters',day,now}),await counters(day));assert.deepEqual(await rust({action:'games',day}),await sectionTasks('games',day).games());
  for(const [key,value]of [['cv:open:'+day,17],['cv:download:'+day,0],['cv:open',351],['cv:download',19],['games:best',422]])await client.set(key,String(value),{EX:420});
  for(const key of ['cli:'+day,'cli:all','lang_votes','games:day:'+day,'games:all',...['babel','borders','wordle','flags','combo','bangle','pingle','lantern'].map(t=>'games:type:'+t)]){await redis(['HSET',key,'first',0,'next',17]);await client.expire(key,420);}
  assert.deepEqual(await rust({action:'counters',day,now}),await counters(day));assert.deepEqual(await rust({action:'games',day}),await sectionTasks('games',day).games());
 }
 const keys=(await client.keys('*')).sort(),before=await Promise.all(keys.map(k=>redis(['DUMP',k])));await rust({action:'counters',day:today,now});await rust({action:'games',day:today});assert.deepEqual((await client.keys('*')).sort(),keys);assert.deepEqual(await Promise.all(keys.map(k=>redis(['DUMP',k]))),before);for(const key of keys)assert((await client.ttl(key))>0,'read preserves retention');
 assert((await rust({action:'counters',day:"2026-11-20'",now})).error);console.log('PASS old/native current and historical CV/CLI/language/game counters, empty/zero values, same keys and unchanged retention; isolated Redis only');
}finally{await runtime.close();setTimeout(()=>process.exit(process.exitCode||0),100).unref();}
