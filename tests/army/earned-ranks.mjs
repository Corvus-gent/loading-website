import assert from 'node:assert/strict';
import {createClient} from 'redis';
import {armyStore} from '../../api/_army/_store.js';
import {armyService} from '../../api/_army/_service.js';
import {createArmyHandler} from '../../api/army.js';
import {points,rank,WEIGHTS} from '../../js/army/domain.js';
assert.equal(process.env.REDIS_URL,'redis://127.0.0.1:16380/6');
const c=createClient({url:process.env.REDIS_URL});await c.connect();let now=Date.parse('2026-11-06T12:00:00Z');
const prefix='army:earned-test:',store=armyStore({redis:args=>c.sendCommand(args),prefix,now:()=>now}),service=armyService({store});
const handler=createArmyHandler({service,ready:()=>true,ownerSession:async req=>req.headers['x-test-owner']==='yes'?{email:'gabriel@corvus.gent'}:null});
async function call(body,owner=true,origin='https://corvus.gent'){let status,data;const res={setHeader(){},status(n){status=n;return this},json(d){data=d;return this}};await handler({method:'POST',query:{admin:'1'},headers:{origin,'x-test-owner':owner?'yes':'no'},body},res);return {status,data};}
try{
 const older=await store.create();await store.enlist(older.id,{username:'helper',email:'helper@example.test',why:'i help people',link:''});await store.verify(older.id);
 now+=1000;const later=await store.create();await store.enlist(later.id,{username:'supporter',email:'supporter@example.test',why:'i support this',link:''});const paid=await store.verify(later.id);paid.paid=true;paid.membership={tier:'consul',state:'active'};paid.pidgyTrials=10;await store.persist(paid);
 const queue=await service.adminList();assert.deepEqual(queue.rows.map(s=>s.username),['helper','supporter']);assert(queue.rows.every(s=>!('priority' in s)));
 const legacy={paid:true,streak:30,best:100,feathers:['/','/call/'],weeklyWins:10,membership:paid.membership};assert.equal(points(legacy),0);assert.equal(rank(legacy),'tiro');
 assert.equal(points({missionPoints:20,recruits:2,pidgyTrials:1,approvedHelp:2}),370);assert.equal(WEIGHTS.toll,undefined);
 const report={action:'approve-help',username:'helper',kind:'intro',reference:'intro-fixture-2026-11-06'};
 assert.equal((await call(report,false)).status,403);assert.equal((await call(report,true,'https://outside.example')).status,403);
 assert.equal((await call({...report,reference:'tiny'})).status,400);assert.equal((await call({...report,kind:'paid'})).status,400);
 assert.equal((await call(report)).data.credited,true);assert.equal((await call(report)).data.credited,false);assert.equal((await call({...report,kind:'help'})).data.credited,false);assert.equal(points(await store.getUser(older.id)),25);
 const receipt=(await c.keys(prefix+'help-credit:*'))[0],detail=(await c.keys(prefix+'help-report:*'))[0];assert(await c.ttl(receipt)>0);assert(await c.ttl(detail)<=90*86400);
 assert(!JSON.stringify(await service.publicAPI.build()).includes(report.reference));assert(JSON.stringify(await store.exportData(older.id)).includes(report.reference));
 // A held account lock must not consume the deduplication receipt before a retry.
 await c.set(store.key('lock:'+older.id),'fixture',{EX:10});assert.equal((await call({...report,reference:'another-real-intro'})).status,409);await c.del(store.key('lock:'+older.id));assert.equal((await call({...report,reference:'another-real-intro'})).data.credited,true);
 assert.equal(points(await store.getUser(older.id)),50);await store.remove(older.id);assert.equal(await c.exists(receipt,detail),0);
 console.log('Earned ranks: chronological queue, payments/cosmetics excluded, owner-only approved help, retry/deduplication, TTL/privacy/export/delete passed.');
}finally{const keys=await c.keys(prefix+'*');if(keys.length)await c.del(keys);await c.quit();}
