import assert from 'node:assert/strict';
import {createClient} from 'redis';
import {migrateRedis,compareDatabases} from '../tools/migrate-redis.mjs';
// Dedicated disposable local databases only. Never take URLs from the environment.
const sourceURL='redis://127.0.0.1:16380/11',targetURL='redis://127.0.0.1:16380/12';
const clients=[sourceURL,targetURL].map(url=>createClient({url,socket:{reconnectStrategy:false}}).on('error',()=>{}));
const [a,b]=clients;
try {
 await Promise.all(clients.map(c=>c.connect()));
 await Promise.all(clients.map(c=>c.flushDb()));
 const binaryKey=Buffer.from([0,255,42,10]),binaryValue=Buffer.from([128,255,0,10,13]);
 await a.sendCommand(['SET',binaryKey,binaryValue]);
 await a.set('otp:test','login-code',{PX:120000});
 await a.set('session:test','session-value',{PX:600000});
 await a.hSet('votes:test',{en:'42',nl:'23'});
 await a.sAdd('voters:test',['one','two']);await a.pExpire('voters:test',900000);
 await a.rPush('logins:test',['old','new']);await a.pExpire('logins:test',900000);
 await a.zAdd('ranking:test',[{score:1,value:'first'},{score:2,value:'second'}]);
 await a.sendCommand(['XADD','stream:test','*','field','value']);
 await a.sendCommand(['XGROUP','CREATE','stream:test','workers','0']);
 await a.sendCommand(['XREADGROUP','GROUP','workers','worker-1','COUNT','1','STREAMS','stream:test','>']);
 const before=await a.dbSize();
 const dry=await migrateRedis({sourceURL,targetURL});
 assert.equal(dry.scanned,before);assert.equal(dry.copied,0);assert.equal(await b.dbSize(),0);assert.equal(await a.dbSize(),before);
 await assert.rejects(migrateRedis({sourceURL,targetURL,dryRun:false}),/pause/);
 await assert.rejects(migrateRedis({sourceURL,targetURL:sourceURL}),/same database/);
 await assert.rejects(migrateRedis({sourceURL,targetURL:'redis://remote.example/0'}),/encrypted/);
 await b.set('existing','leave-me');
 await assert.rejects(migrateRedis({sourceURL,targetURL,dryRun:false,sourcePaused:true}),/empty/);
 assert.equal(await b.get('existing'),'leave-me');await b.del('existing');
 const copy=await migrateRedis({sourceURL,targetURL,dryRun:false,sourcePaused:true});
 assert.equal(copy.copied,before);assert.equal(copy.verification.ok,true,JSON.stringify(copy.verification));
 assert.deepEqual(await b.sendCommand(['GET',binaryKey],{returnBuffers:true}),binaryValue);
 assert.equal(await b.pTTL(binaryKey),-1);assert.ok(await b.pTTL('otp:test')>0);assert.ok(await b.pTTL('otp:test')<=120000);
 assert.deepEqual(await b.sendCommand(['XPENDING','stream:test','workers']),await a.sendCommand(['XPENDING','stream:test','workers']));
 await b.hSet('votes:test','en','999');
 let check=await compareDatabases(a,b);assert.equal(check.valueMismatch,1);assert.equal(check.ok,false);
 const resumed=await migrateRedis({sourceURL,targetURL,dryRun:false,sourcePaused:true,resume:true});assert.equal(resumed.verification.ok,true);
 await b.persist('otp:test');check=await compareDatabases(a,b);assert.equal(check.expiryMismatch,1);
 await b.del('session:test');await b.set('extra','wrong');check=await compareDatabases(a,b);assert.equal(check.missing,1);assert.equal(check.extra,1);
 await b.del('extra');await migrateRedis({sourceURL,targetURL,dryRun:false,sourcePaused:true,resume:true});
 await a.set('short-lived','expires',{PX:100});await migrateRedis({sourceURL,targetURL,dryRun:false,sourcePaused:true,resume:true});
 await new Promise(resolve=>setTimeout(resolve,150));assert.equal(await a.get('short-lived'),null);assert.equal(await b.get('short-lived'),null);
 const verified=await migrateRedis({sourceURL,targetURL,verifyOnly:true});assert.equal(verified.verification.ok,true);
 assert.equal(await a.dbSize(),before);assert.equal(await a.hGet('votes:test','en'),'42');
 console.log('Redis migration: dry-run, all 6 types + stream groups, binary data, absolute expiry, persistence, safety guards, corruption detection and resume passed.');
} finally {
 for(const c of clients){if(c.isReady)await c.flushDb();if(c.isOpen)await c.disconnect();}
}
