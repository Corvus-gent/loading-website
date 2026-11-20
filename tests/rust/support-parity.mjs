import assert from 'node:assert/strict';
import {createHmac,randomUUID,randomBytes} from 'node:crypto';
import {SUPPORT_LINKS} from '../../js/support-config.js';
// Only auth-parity's disposable loopback Redis. No real mail credentials.
export async function supportContracts({urls,client,secret}){
 const prefix='support:diogenes:preview:v1';
 const endpoint=(engine,q={})=>{const u=new URL(urls[engine]);u.searchParams.set('module','support');for(const[k,v]of Object.entries(q))u.searchParams.set(k,v);return u;};
 const call=async(engine,q={},body,extra={},method=body===undefined?'GET':'POST')=>{
  const r=await fetch(endpoint(engine,q),{method,redirect:'manual',headers:{origin:'https://corvus.gent','content-type':'application/json','user-agent':'Mozilla/5.0 fixture','x-forwarded-for':'198.51.100.13',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await r.text();return{status:r.status,body:text?JSON.parse(text):null,location:r.headers.get('location'),cache:r.headers.get('cache-control'),referrer:r.headers.get('referrer-policy'),retry:r.headers.get('retry-after')};
 };
 const token=(age=5000)=>{const v=(Date.now()-age)+'.'+randomBytes(12).toString('hex');return v+'.'+createHmac('sha256',secret).update('call-form:'+v).digest('hex');};
 const form=(tier='quick')=>({name:'  Booking fixture ',contact:'fixture@example.test',pain:'Launch\nfeedback',times:'today after 3pm PT',tier,coffeePaid:tier!=='quick',source:'linkedin',requestId:randomUUID(),challenge:token()});
 assert.deepEqual(await call('rust'),await call('legacy'));
 for(const slug of Object.keys(SUPPORT_LINKS)){
  assert.deepEqual(await call('rust',{slug},undefined,{},'HEAD'),await call('legacy',{slug},undefined,{},'HEAD'));
  const rust=await call('rust',{slug,utm_content:'fixture-1',private:'never-forwarded'}),old=await call('legacy',{slug,utm_content:'fixture-1',private:'never-forwarded'});
  assert.deepEqual(rust,old);assert.equal(rust.status,302);assert(!rust.location.includes('private'));
 }
 const first=await call('rust',{action:'stats'});assert.equal(first.status,200);assert.equal(first.body.total,16);assert(first.body.rows.every(r=>r.total===2&&r.unique===1));assert.deepEqual(first,await call('legacy',{action:'stats'}));
 await call('rust',{slug:'call-li'},undefined,{'user-agent':'bot'});await call('rust',{slug:'call-li'},undefined,{'sec-purpose':'prefetch'});assert.equal((await call('rust',{action:'stats'})).body.total,16);
 for(const q of [{slug:'nope'},{action:'out',step:'nope'},{action:'out',step:'roll-x',source:'bad'},{action:'out',step:'call-coffee',source:'x'}])assert.deepEqual(await call('rust',q,undefined,{},'HEAD'),await call('legacy',q,undefined,{},'HEAD'));
 for(const engine of ['legacy','rust']){
  assert.equal((await call(engine,{action:'admin'})).status,401);
  for(const body of [{...form('coffee'),coffeePaid:false},{...form(),challenge:token(0)},{...form(),challenge:'tampered'},{...form(),website:'spam'},{...form(),tier:'bogus'},{...form(),name:'x'.repeat(81)}])assert.equal((await call(engine,{},body)).status,400);
  assert.equal((await call(engine,{},form(),{origin:'https://evil.example'})).status,403);
  assert.equal((await call(engine,{},form(),{'content-type':'text/plain'})).status,403);
  assert.equal((await call(engine,{}, {...form(),pain:'x'.repeat(6000)})).status,413);
  const fresh=await call(engine,{}, {action:'challenge'},{'x-forwarded-for':'198.51.100.14'});assert.equal(fresh.status,200);assert.match(fresh.body.token,/^\d{13}\.[a-f0-9]{24}\.[a-f0-9]{64}$/);
 }
 const shared=form();const race=await Promise.all(Array.from({length:16},(_,i)=>call(i%2?'rust':'legacy',{},shared)));
 assert.equal(race.filter(r=>r.status===201).length,1);assert.equal(race.filter(r=>r.status===200).length,15);assert(race.every(r=>r.body.ok&&r.body.notified===false));assert.equal(await client.zCard(prefix+':requests'),1);
 const check=await call('rust',{},form());assert.equal(check.status,429);assert(Number(check.retry)>0);assert.equal((await call('legacy',{},form())).status,429);
 for(const [i,tier] of ['coffee','meet'].entries())assert.equal((await call(i?'legacy':'rust',{},form(tier),{'x-forwarded-for':'198.51.100.'+(30+i)})).status,201);
 const authorization='Bearer '+secret;
 const old=await call('legacy',{action:'admin'},undefined,{authorization}),current=await call('rust',{action:'admin'},undefined,{authorization});assert.deepEqual(current,old);assert.equal(current.body.rows.length,3);assert(!current.body.more);
 for(const row of current.body.rows){
  assert.equal(row.name,'Booking fixture');assert.equal(row.pain,'Launch feedback');assert.equal(row.mailSent,false);
  const key=prefix+':request:'+row.id,ttl=await client.ttl(key);assert(ttl>5183900&&ttl<=5184000);
  for(const [engine,status]of [['rust','scheduled'],['legacy','done']]){assert.equal((await call(engine,{action:'admin'},{id:row.id,status},{authorization})).status,200);assert.equal(JSON.parse(await client.get(key)).status,status);assert((await client.ttl(key))<=ttl);}
  assert.equal((await call('rust',{action:'admin'},{id:row.id,action:'retry-mail'},{authorization})).body.ok,false);
 }
 assert.equal((await call('rust',{action:'admin'},{id:randomUUID(),status:'done'},{authorization})).status,404);
 assert.equal((await call('rust',{action:'admin'},{id:current.body.rows[0].id,status:'done'},{authorization,origin:'https://evil.example'})).status,403);
 const sid='support-admin';await client.set('sess:'+sid,'gabriel@corvus.gent',{EX:600});const cookie='sess='+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64url');
 assert.equal((await call('rust',{action:'admin'},undefined,{cookie})).status,200);await client.set('sess:'+sid,'other@corvus.gent',{EX:600});assert.equal((await call('rust',{action:'admin'},undefined,{cookie})).status,401);
 for(let i=0;i<18;i++)assert.equal((await call(i%2?'legacy':'rust',{}, {action:'challenge'},{'x-forwarded-for':'198.51.100.14'})).status,200);
 assert.equal((await call('rust',{}, {action:'challenge'},{'x-forwarded-for':'198.51.100.14'})).status,429);assert.equal((await call('legacy',{}, {action:'challenge'},{'x-forwarded-for':'198.51.100.14'})).status,429);
 for(const q of [{action:'stats'},{action:'stats',day:'bad'},{action:'stats',day:'2026-01-01'}]){
  const current=await call('rust',q);assert.deepEqual(current,await call('legacy',q));assert(!JSON.stringify(current).includes('fixture@example.test'));
 }
 const keys=await client.keys(prefix+':*');assert(!keys.join().includes('198.51.100'));for(const key of keys.filter(k=>/:dedupe:|:cool:|:hour:|:submit:|:request:|:challenge:/.test(k)))assert((await client.ttl(key))>0,key+' expires');
 console.log('PASS: support redirect/report parity, 3 booking tiers, cross-runtime 16-way idempotency, CSRF, honor checkbox, shared limits, private admin/statuses and 60-day retention. No emails sent.');
}
