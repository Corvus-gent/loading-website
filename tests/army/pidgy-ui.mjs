import assert from 'node:assert/strict';
import {createClient} from 'redis';
import {armyStore} from '../../api/_army/_store.js';
import {armyService} from '../../api/_army/_service.js';
import {createArmyHandler} from '../../api/army.js';
import {publicSoldier,cleanUsername,publicLink} from '../../js/army/domain.js';
assert.equal(process.env.REDIS_URL,'redis://127.0.0.1:16380/6');
const c=createClient({url:process.env.REDIS_URL});await c.connect();
const store=armyStore({redis:args=>c.sendCommand(args),prefix:'army:pidgy-ui:'}),service=armyService({store});
const handler=createArmyHandler({service,ready:()=>true,ownerSession:async()=>null});
async function call(query){let status,data;const res={setHeader(){},status(n){status=n;return this},json(d){data=d;return this},end(){return this}};await handler({method:'GET',query,headers:{}},res);return {status,data};}
try{
 const u=await store.create();await store.enlist(u.id,{username:'@Private Recruiter',email:'owner@example.test',link:'example.com',why:'i build'});let user=await store.verify(u.id);user.pidgyTrials=5;await store.persist(user);
 const own=await service.self(user,true),anonymous=await service.self(user,false);
 assert.equal(own.pidgyCode,'corvus-private_recruiter');assert.equal(own.pidgyTrials,5);
 for(const data of [anonymous,publicSoldier(user),(await call({profile:'private_recruiter'})).data,(await call({view:'legion'})).data])for(const key of ['pidgyCode','pidgyTrials'])assert(!JSON.stringify(data).includes('"'+key+'"'));
 assert.equal((await call({admin:'1'})).status,403);
 assert.equal(cleanUsername('@Mobile Tester'),'mobile_tester');assert.equal(publicLink(''), '');assert.equal(publicLink('linkedin.com/in/test'),'https://linkedin.com/in/test');assert.equal(publicLink('http://example.com'),'https://example.com/');assert.throws(()=>publicLink('https://user:password@example.com'));assert.throws(()=>publicLink('javascript:alert(1)'));
 console.log('Private Pidgy self/public separation, admin boundary and mobile normalization checks passed.');
}finally{const keys=await c.keys('army:pidgy-ui:*');if(keys.length)await c.del(keys);await c.quit();}
