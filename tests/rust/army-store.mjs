import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
const runtime=await isolatedRuntime('compound'),{client,secret}=runtime;
for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API|LEGION|ARMY_|ADMIN_PASSWORD/.test(k))delete process.env[k];
const env={PATH:process.env.PATH,REDIS_URL:client.options.url,SESSION_SECRET:secret,ARMY_NAMESPACE:'army-contract:new:',CORVUS_RUST_WRITES:'isolated'};Object.assign(process.env,env);
const now=Date.now(),iso=n=>new Date(n).toISOString(),day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(now),DAY=86400;
const rust=fields=>new Promise((resolve,reject)=>{const p=spawn('target/debug/corvus-contract',[],{env,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>{if(code)return reject(Error(err));try{resolve(JSON.parse(out))}catch(e){reject(e)}});p.stdin.end(JSON.stringify({operation:'army-store',now,...fields})+'\n');});
const attempt=async p=>{try{return await p}catch(e){return{error:e.message}}},equal=(a,b)=>assert.deepEqual(a,JSON.parse(JSON.stringify(b)));
const redis=args=>client.sendCommand(args.map(String));
const {armyStore}=await import('../../api/_army/_store.js');const {digest}=await import('../../api/_army/_security.js');const {weekKey}=await import('../../js/army/domain.js');
const old=armyStore({redis,now:()=>now,prefix:'army-contract:old:'});
const pair=async(fields,fn)=>{const [actual,expected]=await Promise.all([rust(fields),attempt(fn())]);equal(actual,expected);return actual};
let counter=0;const seed=async(extra={})=>{const id=('fixture'+(++counter).toString().padStart(17,'0')),code='a'+counter.toString(32).replace(/0/g,'a').replace(/1/g,'b').padStart(7,'a');const user={id,code,created:iso(now),expires:iso(now+90*DAY*1000),status:'anonymous',country:null,existingBrowser:false,streak:0,best:0,feathers:[],recruits:0,missionPoints:0,weeklyWins:0,...extra};await pair({action:'persist',body:user},()=>old.persist(user));return user;};
try{
 const random=await rust({action:'create',body:{country:'BE',existingBrowser:true}});assert.match(random.id,/^[A-Za-z0-9_-]{24}$/);assert.match(random.code,/^[a-z2-7]{8}$/);equal(random,await armyStore({redis,prefix:env.ARMY_NAMESPACE}).getUser(random.id));await rust({action:'remove',uid:random.id});
 const user=await seed();const uid=user.id;
 const data={username:'@Fixture_User',email:'fixture@example.test',why:'One honest reason.',country:'BE',link:'corvus.gent',lang:'nl'};
 await pair({action:'enlist',uid,body:data},()=>old.enlist(uid,data));await pair({action:'enlist',uid,body:data},()=>old.enlist(uid,data));
 const verified=await pair({action:'verify',uid},()=>old.verify(uid));assert.equal(verified.status,'waiting');assert.equal(verified.expires,iso(now+90*DAY*1000));
 for(const [action,value,fn]of [['by-code',user.code,old.byCode],['by-email',data.email,old.byEmail],['by-name','fixture_user',old.byName]])await pair({action,value},()=>fn(value));
 const member=await seed();const registration={username:'Registered',email:'registered@example.test',country:'US',lang:'en',link:''};await pair({action:'register',uid:member.id,body:registration},()=>old.register(member.id,registration));const m=await pair({action:'verify',uid:member.id},()=>old.verify(member.id));assert.equal(m.status,'member');assert.equal(m.expires,iso(now+365*DAY*1000));await pair({action:'verify',uid:member.id},()=>old.verify(member.id));
 const upgrade={...registration,why:'Ready for the army'};await pair({action:'enlist',uid:member.id,body:upgrade},()=>old.enlist(member.id,upgrade));
 const subscriber=await seed();await pair({action:'attach-email',uid:subscriber.id,value:'subscriber@example.test',lang:'fr'},()=>old.attachEmail(subscriber.id,'subscriber@example.test','fr'));await pair({action:'verify',uid:subscriber.id},()=>old.verify(subscriber.id));
 const conflict=await seed();await pair({action:'attach-email',uid:conflict.id,value:data.email},()=>old.attachEmail(conflict.id,data.email,'en'));assert.equal((await client.get(old.key('u:'+conflict.id)))!==null,true);
 for(const x of [1,2,3,4])assert.equal(await pair({action:'rate',value:'fixture',ip:'hash',max:3,seconds:60},()=>old.rate('fixture','hash',3,60)),x<=3);
 for(const prefix of [old.key(''),env.ARMY_NAMESPACE])await client.set(prefix+'rate:repair:hash','0');await pair({action:'rate',value:'repair',ip:'hash',max:3,seconds:60},()=>old.rate('repair','hash',3,60));assert((await client.ttl(env.ARMY_NAMESPACE+'rate:repair:hash'))>0);
 for(const value of ['/','/now/','/','/unknown/'])await pair({action:'feather',uid,value},()=>old.feather(uid,value));
 for(const body of [{kind:'help',reference:'A real fixture reference'},{kind:'intro',reference:'a REAL fixture reference'},{kind:'invalid',reference:'long enough'},{kind:'help',reference:'short'},{kind:'help',reference:'bad\nreference'}])await pair({action:'help',uid,body},()=>old.approveHelp(uid,body));assert.equal((await rust({action:'user',uid})).approvedHelp,1);
 await pair({action:'help',uid:conflict.id,body:{kind:'help',reference:'unverified account'}},()=>old.approveHelp(conflict.id,{kind:'help',reference:'unverified account'}));
 const mission={day,type:'babel',streak:3,solved:true};await pair({action:'complete',uid,body:mission},()=>old.complete(uid,mission,'fixture-ip-hash'));await pair({action:'complete',uid,body:{...mission,type:'wordle',streak:99}},()=>old.complete(uid,{...mission,type:'wordle',streak:99},'fixture-ip-hash'));assert.equal((await rust({action:'user',uid})).missionPoints,10);
 await pair({action:'complete',uid,body:{...mission,day:'2020-01-01'}},()=>old.complete(uid,{...mission,day:'2020-01-01'},'fixture-ip-hash'));
 // Mixed-runtime aliases must reserve both or neither, even across 12 contenders.
 const contenders=[];for(let i=0;i<12;i++)contenders.push(await seed());
 const common={username:'same_alias',email:'same-alias@example.test',why:'race fixture'};
 for(const engine of ['old','rust']){const out=await Promise.all(contenders.map(u=>engine==='old'?attempt(old.enlist(u.id,common)):rust({action:'enlist',uid:u.id,body:common})));assert.equal(out.filter(r=>!r.error).length,1);assert(out.filter(r=>r.error).every(r=>r.error==='unavailable_name_or_email'));const prefix=engine==='old'?old.key(''):env.ARMY_NAMESPACE;assert.equal(await client.get(prefix+'name:same_alias'),await client.get(prefix+'email:'+digest(common.email)));}
 // Independent prefixes may choose different race winners; remove all contestants before comparing.
 for(const u of contenders)await pair({action:'remove',uid:u.id},()=>old.remove(u.id));
 const parent=await seed({verifiedAt:iso(now),username:'recruiter',email:'parent@example.test',status:'member'});
 const child=await seed();await pair({action:'remember',uid:child.id,value:parent.code,ip:'child-hash'},()=>old.rememberReferral(child.id,parent.code,'child-hash'));
 const mixed=armyStore({redis,now:()=>now,prefix:env.ARMY_NAMESPACE});const credits=await Promise.all(Array.from({length:20},(_,i)=>i%2?rust({action:'qualify',uid:child.id,ip:'child-hash'}):mixed.qualify(child.id,'child-hash')));assert.equal(credits.filter(Boolean).length,1);assert.equal(await old.qualify(child.id,'child-hash'),true);equal(await rust({action:'user',uid:parent.id}),await old.getUser(parent.id));equal(await rust({action:'user',uid:child.id}),await old.getUser(child.id));
 const sameIP=await seed();await pair({action:'remember',uid:sameIP.id,value:parent.code,ip:'child-hash'},()=>old.rememberReferral(sameIP.id,parent.code,'child-hash'));assert.equal(await pair({action:'qualify',uid:sameIP.id,ip:'child-hash'},()=>old.qualify(sameIP.id,'child-hash')),false);
 await pair({action:'seen',uid:parent.id,ip:'owner-hash'},async()=>{await old.seen(parent.id,'owner-hash');return null});const ownIP=await seed();await pair({action:'remember',uid:ownIP.id,value:parent.code,ip:'owner-hash'},()=>old.rememberReferral(ownIP.id,parent.code,'owner-hash'));assert.equal(await pair({action:'qualify',uid:ownIP.id,ip:'owner-hash'},()=>old.qualify(ownIP.id,'owner-hash')),false);
 // The ten-recruits/day boundary is atomic; views and feathers never credit.
 for(let i=0;i<11;i++){const c=await seed();await pair({action:'remember',uid:c.id,value:parent.code,ip:'ip'+i},()=>old.rememberReferral(c.id,parent.code,'ip'+i));assert.equal(await pair({action:'qualify',uid:c.id,ip:'ip'+i},()=>old.qualify(c.id,'ip'+i)),i<9);}
 assert.equal((await rust({action:'user',uid:parent.id})).recruits,10);
 // Export excludes credentials and identifying referral edges. Erasure removes aliases,
 // pending mail and membership/session data while reversing credit exactly once.
 for(const [suffix,body]of [['session:fixture-secret',{uid}],['token:fixture-secret',{uid}],['mail:fixture-job',{uid,secret:'hidden'}],['sub:'+uid+':daily',{uid,confirmed:true,secret:'hidden',unsubscribeSecret:'hidden',delivery:'hidden',lang:'nl'}]])await pair({action:'own',uid,value:suffix,body,seconds:60},()=>old.own(uid,suffix,body,60));
 await pair({action:'export',uid},()=>old.exportData(uid));const exported=JSON.stringify(await rust({action:'export',uid}));assert(!exported.includes('fixture-secret')&&!exported.includes('hidden')&&!exported.includes('fixture-job'));
 for(const prefix of [old.key(''),env.ARMY_NAMESPACE])await client.zAdd(prefix+'outbox',{score:now,value:'fixture-job'});
 await pair({action:'remove',uid},()=>old.remove(uid));for(const prefix of [old.key(''),env.ARMY_NAMESPACE]){assert.equal(await client.get(prefix+'name:fixture_user'),null);assert.equal(await client.get(prefix+'email:'+digest(data.email)),null);assert.equal(await client.zScore(prefix+'outbox','fixture-job'),null);assert.equal(await client.get(prefix+'session:fixture-secret'),null);}
 await pair({action:'remove',uid:child.id},()=>old.remove(child.id));assert.equal((await rust({action:'user',uid:parent.id})).recruits,9);await pair({action:'remove',uid:child.id},()=>old.remove(child.id));assert.equal((await rust({action:'user',uid:parent.id})).recruits,9);
 // Erasure still reverses the parent's edge if Redis already expired the child document.
 const expiryChild=await seed();await pair({action:'remember',uid:expiryChild.id,value:subscriber.code,ip:'expire'},()=>old.rememberReferral(expiryChild.id,subscriber.code,'expire'));await pair({action:'qualify',uid:expiryChild.id,ip:'expire'},()=>old.qualify(expiryChild.id,'expire'));
 for(const prefix of [old.key(''),env.ARMY_NAMESPACE]){await client.del(prefix+'u:'+expiryChild.id);await client.zAdd(prefix+'users',{score:now-1,value:expiryChild.id});}
 assert.equal(await pair({action:'cleanup'},()=>old.cleanup()),1);assert.equal((await rust({action:'user',uid:subscriber.id})).recruits,0);
 await pair({action:'remove',uid:parent.id},()=>old.remove(parent.id));assert((await rust({action:'all'})).every(u=>u.parent!==parent.id));equal((await rust({action:'all'})).sort((a,b)=>a.id.localeCompare(b.id)),(await old.all()).sort((a,b)=>a.id.localeCompare(b.id)));
 console.log('PASS: Army old/Rust aliases, enlist/register/verify/retention, rates, feathers, missions and help receipts; 12-way alias reservation, 20-way mixed-runtime recruit race, daily/self-IP caps, private export, complete/retried/expired-profile erasure and child detachment. Isolated Redis only.');
}catch(e){process.exitCode=1;console.error(e);}finally{await runtime.close();setTimeout(()=>process.exit(process.exitCode||0),100).unref();}
