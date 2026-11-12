import assert from 'node:assert/strict';import crypto from 'node:crypto';import {createClient} from 'redis';
import {armyStore} from '../../api/_army/_store.js';import {pidgyTrials,verifyPidgy,handleFromCode,referralCode} from '../../api/_army/_pidgy.js';import {createPidgyHandler} from '../../api/pidgy-trial.js';import {points} from '../../js/army/domain.js';
const url=process.env.REDIS_URL;if(url!=='redis://127.0.0.1:16380/5')throw Error('local test database required');const client=createClient({url});await client.connect();const prefix='army:pidgy-test:';
const store=armyStore({redis:args=>client.sendCommand(args),prefix});const pidgy=pidgyTrials(store);let count=0;const now=Math.floor(Date.now()/1000);
try{
 const u=await store.create();await store.register(u.id,{username:'recruiter',email:'boss@example.test',country:'BE'});await store.verify(u.id);
 const raw=Buffer.from('{"a":1}'),sig=crypto.createHmac('sha256','s').update(raw).digest('hex');assert(verifyPidgy(raw,sig,'s'));assert(!verifyPidgy(raw,sig,'x'));assert(!verifyPidgy(raw,'nope','s'));count+=3;
 assert.equal(handleFromCode(referralCode('recruiter')),'recruiter');assert.equal(handleFromCode('corvus-admin'),null);assert.equal(handleFromCode('other-recruiter'),null);count+=3;
 const ev=(i,email)=>({event_id:'t'+i,referral_code:'corvus-recruiter',email,started_at:now});
 assert.equal(points(await store.getUser(u.id)),0);
 assert.deepEqual(await pidgy.accept(ev(0,'boss@example.test')),{counted:false,reason:'self'});count++;
 assert.equal((await pidgy.accept(ev(1,'a@example.test'))).trials,1);assert.equal(points(await store.getUser(u.id)),100);count+=2;
 assert.equal((await pidgy.accept(ev(1,'a@example.test'))).reason,'duplicate');assert.equal((await pidgy.accept(ev(2,'A@example.test'))).reason,'duplicate');count+=2;
 for(const i of [3,4,5,6])await pidgy.accept(ev(i,`p${i}@example.test`));
 const user=await store.getUser(u.id);assert.equal(user.pidgyTrials,5);assert.equal(points(user),500);count+=2;
 assert.equal(user.status==='approved',false);count++;// earned recruiting points, never automatic approval
 assert.equal((await pidgy.accept({...ev(7,'z@example.test'),referral_code:'corvus-ghost'})).reason,'account');count++;
 await assert.rejects(pidgy.accept({...ev(8,'bad'),started_at:now}),/payload/);await assert.rejects(pidgy.accept({...ev(9,'q@example.test'),started_at:now-90*86400}),/payload/);count+=2;
 const handler=createPidgyHandler({store,secret:()=>'s'});const call=async(body,sig)=>{let st,out;const res={setHeader(){},status:n=>(st=n,res),json:d=>(out=d,res)};await handler({method:'POST',headers:{'x-signature-sha256':sig},body:Buffer.from(body)},res);return [st,out];};
 const body=JSON.stringify(ev(10,'h@example.test'));assert.equal((await call(body,'0'.repeat(64)))[0],401);const [st,out]=await call(body,crypto.createHmac('sha256','s').update(body).digest('hex'));assert.equal(st,200);assert.deepEqual(out,{ok:true,counted:true});count+=2;
 for(const key of await client.keys(prefix+'*'))if(await client.type(key)==='string')assert(!(await client.get(key)).includes('@example.test')||key.includes(':u:'));count++;
 const held=store.key('lock:'+u.id);await client.set(held,'fixture-lock',{EX:10});await assert.rejects(pidgy.accept(ev(11,'retry@example.test')),/busy/);await client.del(held);assert.equal((await pidgy.accept(ev(11,'retry@example.test'))).counted,true);assert.equal((await pidgy.accept(ev(11,'retry@example.test'))).counted,false);count+=3;
 await store.remove(u.id);assert.equal((await client.keys(prefix+'pidgy:email:*')).length,0);count++;
 console.log('Pidgy checks passed:',count,'(signature, codes, self-referral, dedupe, earned recruiting points, retry after contention, no admission boost, privacy).');
}finally{const keys=await client.keys(prefix+'*');if(keys.length)await client.del(keys);await client.quit();}
