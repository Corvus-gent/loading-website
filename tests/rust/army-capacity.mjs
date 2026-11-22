import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
const runtime=await isolatedRuntime('compound'),{client,secret}=runtime;
for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API|LEGION|ARMY_|ADMIN_PASSWORD|DISCORD|RESEND/.test(k))delete process.env[k];
const env={PATH:process.env.PATH,REDIS_URL:client.options.url,SESSION_SECRET:secret,ARMY_NAMESPACE:'army-capacity:new:',CORVUS_RUST_WRITES:'isolated'};Object.assign(process.env,env);
const now=Date.now(),DAY=86400,redis=args=>client.sendCommand(args.map(String));
const rust=fields=>new Promise((resolve,reject)=>{const p=spawn('target/debug/corvus-contract',[],{env,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>{if(code)return reject(Error(err));try{resolve(JSON.parse(out))}catch(e){reject(e)}});p.stdin.end(JSON.stringify({operation:'army-store',now,...fields})+'\n');});
const {armyStore}=await import('../../api/_army/_store.js'),{bmcPayments}=await import('../../api/_army/_tolls.js');
const old=armyStore({redis,now:()=>now,prefix:'army-capacity:old:'}),native=armyStore({redis,now:()=>now,prefix:env.ARMY_NAMESPACE}),bmc=bmcPayments(old);
try{
 const users=[];for(let i=0;i<6;i++){const user={id:'capacity'+String(i).padStart(16,'0'),code:'ccccccc'+String.fromCharCode(97+i),username:'seat_'+i,email:'seat_'+i+'@example.test',created:new Date(now).toISOString(),expires:new Date(now+90*DAY*1000).toISOString(),verifiedAt:new Date(now).toISOString(),status:'member',feathers:[],missionPoints:0,recruits:0};users.push(user);await old.persist(user);await native.persist(user);}
 const events=users.map((u,i)=>({event_id:1000+i,type:'extra_purchase.created',live_mode:true,created:now/1000,data:{id:1000+i,support_note:'@'+u.username,amount:10000,currency:'USD',extras:[{title:'Consul lifetime seat'}]}}));
 // All six webhooks enter before any membership is settled: reproduces the old oversell.
 for(const e of events){assert((await bmc.accept(e)).accepted);assert((await rust({action:'payment-accept',body:e})).accepted);}
 for(const e of events)await bmc.process(String(e.event_id));assert.equal((await old.all()).filter(u=>u.membership?.tier==='consul').length,6,'the fixture must expose the old race');
 const results=await Promise.all(events.map(e=>rust({action:'payment-process',value:String(e.event_id)})));assert(results.every(r=>r.matched||r.error==='busy'));
 for(const e of events){const result=await rust({action:'payment-process',value:String(e.event_id)});assert.equal(result.matched,true);}
 const held=(await native.all()).filter(u=>u.membership?.tier==='consul'&&u.membership.state!=='refunded');assert.equal(held.length,2);
 const refused=await rust({action:'payment-unmatched'});assert.equal(refused.length,4);assert(refused.every(p=>p.review_reason==='consul_capacity'&&p.level===null));assert.equal(await client.zCard(native.key('bmc:pending')),0);
 // Retry can't silently grant a refused purchase even after a seat is freed.
 const first=held[0],purchase=events.find(e=>e.data.support_note==='@'+first.username),refund={...purchase,event_id:2000,type:'extra_purchase.refunded',created:now/1000+1,data:{...purchase.data,extras:[]}};await rust({action:'payment-accept',body:refund});await rust({action:'payment-process',value:'2000'});
 assert.equal((await native.getUser(first.id)).membership.state,'refunded');assert.equal((await native.all()).filter(u=>u.membership?.tier==='consul'&&u.membership.state!=='refunded').length,1);
 const refusedID=refused[0].event;await rust({action:'payment-process',value:refusedID});assert.equal((await native.byName(refused[0].username)).membership,undefined);
 // Final writes are fenced against an expired lease and an intervening account edit.
 const u=await native.getUser(users[5].id),snapshot=await client.get(native.key('u:'+u.id)),changed={...u,country:'US'};
 assert.equal((await rust({action:'persist-guarded',body:changed,snapshot,value:'expired-lease'})).error,'busy');assert.deepEqual(await native.getUser(u.id),u);
 await client.set(native.key('lock:entitlements'),'active-lease',{EX:15});await native.persist({...u,hidden:true});assert.equal((await rust({action:'persist-guarded',body:changed,snapshot,value:'active-lease'})).error,'busy');assert.equal((await native.getUser(u.id)).hidden,true);
 const latest=await native.getUser(u.id),latestRaw=await client.get(native.key('u:'+u.id));assert.equal((await rust({action:'persist-guarded',body:{...latest,country:'US'},snapshot:latestRaw,value:'active-lease'})).country,'US');
 console.log('PASS: regression reproduces six legacy Consul grants from six pending events; Rust settles exactly two and lists four for owner review. Matching lifetime refunds release the seat; duplicate retries cannot grant refused seats. Expired lease and intervening account edits reject stale writes atomically. No real payments.');
}catch(e){process.exitCode=1;console.error(e);}finally{await runtime.close();setTimeout(()=>process.exit(process.exitCode||0),100).unref();}
