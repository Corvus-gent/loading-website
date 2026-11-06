import assert from 'node:assert/strict';import crypto from 'node:crypto';import {createClient} from 'redis';
import {armyStore} from '../../api/_army/_store.js';import {bmcPayments,verifyBMC,tierName} from '../../api/_army/_tolls.js';import {activeTier,rank} from '../../js/army/domain.js';
const url=process.env.REDIS_URL;if(url!=='redis://127.0.0.1:16380/6')throw Error('local test database required');const client=createClient({url});await client.connect();const prefix='army:bmc-test:';
const store=armyStore({redis:args=>client.sendCommand(args),prefix});const bmc=bmcPayments(store);let count=0;
try{
 const u=await store.create();await store.register(u.id,{username:'payment_test',email:'test@example.test',country:'BE'});await store.verify(u.id);
 const raw=Buffer.from('{"hello":1}'),sig=crypto.createHmac('sha256','secret').update(raw).digest('hex');assert(verifyBMC(raw,sig,'secret'));assert(!verifyBMC(Buffer.from('{}'),sig,'secret'));assert(!verifyBMC(raw,'broken','secret'));count+=3;
 for(const [i,tier] of ['tiro','miles','centurio','legatus','senator'].entries()){
  assert.equal(tierName(tier+' (test)'),tier);const now=Math.floor(Date.now()/1000)+i;
  const event={event_id:100+i,type:'membership.started',live_mode:true,created:now,data:{id:1,membership_level_name:tier,amount:1,currency:'USD',supporter_email:'test@example.test',supporter_name:'DO NOT STORE',support_note:'PRIVATE MESSAGE',current_period_end:now+86400,duration_type:'month'}};
  const first=await bmc.accept(event);assert(first.accepted);assert.equal((await bmc.accept(event)).accepted,false);await bmc.process(String(100+i));assert.equal(activeTier(await store.getUser(u.id)),tier);assert.equal(rank(await store.getUser(u.id)),'tiro');count+=4;
 }
 const now=Math.floor(Date.now()/1000)+10;await bmc.accept({event_id:200,type:'membership.cancelled',live_mode:true,created:now,data:{id:1,membership_level_name:'centurio',amount:10,currency:'USD',current_period_end:now+60,status:'canceled'}});await bmc.process('200');await bmc.process('200');const user=await store.getUser(u.id);assert.equal(activeTier(user,now*1000),'centurio');assert.equal(activeTier(user,(now+61)*1000),null);count+=2;
 const donation={event_id:300,type:'donation.created',live_mode:true,created:now,data:{id:300,amount:2,currency:'USD',coffee_count:2,support_note:'@payment_test'}};await bmc.accept(donation);await bmc.process('300');await bmc.accept({...donation,event_id:301});await bmc.process('301');assert.equal(Number(await store.run(['GET',store.key('bmc:coffees')])),2);count++;
 await bmc.accept({...donation,event_id:302,type:'donation.refunded'});await bmc.process('302');assert.equal(Number(await store.run(['GET',store.key('bmc:coffees')])),0);await bmc.process('300');assert.equal(Number(await store.run(['GET',store.key('bmc:coffees')])),0);count+=2;
 assert.deepEqual(await bmc.accept({...donation,live_mode:false}),{test:true});count++;
 const cancel={event_id:400,type:'membership.cancelled',live_mode:true,created:now+100,data:{id:1,membership_level_name:'centurio',amount:10,currency:'USD',supporter_email:'test@example.test',current_period_end:now+200,status:'canceled'}};
 await bmc.accept(cancel);await bmc.process('400');await bmc.accept({...cancel,event_id:401,type:'membership.started',data:{...cancel.data,status:'active'}});await bmc.process('401');assert.equal((await store.getUser(u.id)).membership.state,'cancelled');count++;
 // Erasure between durable acceptance and the background processor must remove the pending personal record too.
 await bmc.accept({...donation,event_id:402});


 // Consul: explicit product, >= $10,000, lifetime, max 2 seats.
 const consul=(id,email)=>({event_id:id,type:'extra_purchase.created',live_mode:true,created:Math.floor(Date.now()/1000)+20,data:{id,amount:10000,currency:'USD',supporter_email:email,extras:[{title:'consul (backer)'}]}});
 for(const [n,name] of ['c_one','c_two','c_three'].entries()){const c=await store.create();await store.register(c.id,{username:name,email:name+'@example.test',country:'BE'});await store.verify(c.id);await bmc.accept(consul(500+n,name+'@example.test'));await bmc.process(String(500+n));}
 assert.equal(tierName('consul (backer)'),'consul');assert.equal(activeTier(await store.byName('c_one')),'consul');assert.equal(activeTier(await store.byName('c_two'),Date.now()+5*365*86400000),'consul');assert.equal(activeTier(await store.byName('c_three')),null);count+=4;
 for(const name of ['c_one','c_two','c_three'])await store.remove((await store.byName(name)).id);
 const keys=await client.keys(prefix+'*');for(const key of keys){if(await client.type(key)==='string'){const value=await client.get(key);assert(!value.includes('DO NOT STORE'));assert(!value.includes('PRIVATE MESSAGE'));}}
 await store.remove(u.id);assert.equal(await store.byName('payment_test'),null);assert.equal(await store.get('bmc:event:100'),null);assert.equal(await store.get('bmc:event:402'),null);count+=3;
 console.log('BMC checks passed:',count,'(signature, replay, tiers, expiry, privacy, refunds, deletion).');
}finally{const keys=await client.keys(prefix+'*');if(keys.length)await client.del(keys);await client.quit();}
