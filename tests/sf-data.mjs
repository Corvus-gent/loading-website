import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createClient} from 'redis';
import {createHandler as createXHandler} from '../api/x-stats.js';
import {createSFHandler} from '../api/_sf.js';
import {sfStore,SF_RETENTION,validateLead} from '../api/_sf-store.js';
import {zeroBits} from '../api/_music-security.js';
import {dailyIPHash} from '../api/_privacy.js';
import {deleteUserData} from '../tools/privacy-data.mjs';
import {SF_START,SF_END,tripState,sfLocationKey} from '../js/sf-trip.js';
import {privacyEvent} from '../js/analytics-policy.js';
assert.equal(process.env.REDIS_URL,'redis://127.0.0.1:16380/9','disposable database required');
const client=createClient({url:process.env.REDIS_URL,socket:{reconnectStrategy:false}}).on('error',()=>{});await client.connect();await client.flushDb();const redis=args=>client.sendCommand(args.map(String));
let time=Date.parse('2026-11-04T12:00:00Z'),mailFail=false,emails=[],owner=null;
const now=()=>time;
const store=sfStore({redis,now,mailKey:()=> 'test-only',fetcher:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(options.redirect,'error');emails.push({body:JSON.parse(options.body),idempotency:options.headers['Idempotency-Key']});return new Response('{}',{status:mailFail?503:200});}});
const handler=createSFHandler({redis,now,store,ready:()=>true,session:async()=>owner,analyticsReady:()=>true,query:async()=>[['sf_note_seen',8],['$pageview',5]],bits:8});
const valid={name:'visitor <test>',contact:'visitor@example.test',what:'build things',lets:['coffee','bjj'],when:['2026-11-07'],where:'mission',message:'hello <script>bad()</script>',website:'',requestId:crypto.randomUUID()};
async function call({method='POST',body={},cookie='',origin='https://corvus.gent',ip='198.51.100.23',query={}}={}){const result={headers:{}};const res={setHeader:(k,v)=>result.headers[k]=v,status:n=>{result.status=n;return res;},json:body=>{result.body=body;return result;},end:()=>result};await handler({method,body,query,headers:{cookie,origin,'x-forwarded-for':ip}},res);return result;}
async function proof(cookie='',advance=true,ip){const r=await call({body:{action:'challenge'},cookie,ip});assert.equal(r.status,200,JSON.stringify(r.body));const ch=r.body.challenge;let nonce=0;while(zeroBits(crypto.createHash('sha256').update(`${ch.salt}:${nonce}`).digest())<ch.bits)nonce++;if(advance)time=Math.max(time,ch.notBefore);return {cookie:cookie||r.headers['Set-Cookie'].split(';')[0],challenge:ch.id,nonce};}
async function submit(extra={},cookie='',ip){const p=await proof(cookie,true,ip);return {p,result:await call({cookie:p.cookie,ip,body:{...valid,...extra,challenge:p.challenge,nonce:p.nonce}})};}
async function clearCooldown(){for(const key of await client.keys('sf:cool:*'))await client.del(key);time+=61000;}
try{
 assert.equal(tripState(SF_START-1).phase,'before');assert.equal(tripState(SF_START).number,1);assert.equal(tripState(SF_END-1).number,10);assert.equal(tripState(SF_END).phase,'after');
 for(const [date,key]of [['2026-11-05T22:59:59Z','sf.packing'],['2026-11-05T23:00:00Z','sf.flying'],['2026-11-06T23:00:00Z','sf.founder'],['2026-11-15T23:00:00Z','sf.returned'],['2026-11-16T23:00:00Z',null]])assert.equal(sfLocationKey(Date.parse(date)),key);
 for(const patch of [{name:''},{contact:'javascript:alert(1)'},{contact:'https://linkedin.com.evil.test/in/name'},{what:'a'.repeat(141)},{thing:'a'.repeat(61)},{thing:'bad\nsubject'},{thing:42},{where:'a'.repeat(61)},{message:'a'.repeat(501)},{lets:[]},{when:['anytime','2026-11-07']},{when:['2026-12-01']},{name:'injected\nsubject'}])assert.throws(()=>validateLead({...valid,...patch}));
 assert.equal(validateLead(valid).thing,'');assert.equal(validateLead({...valid,thing:'  rapper  '}).thing,'rapper');assert.equal(validateLead({...valid,thing:'a'.repeat(60)}).thing.length,60);
 assert.equal(validateLead({...valid,contact:'@valid_handle'}).contact,'@valid_handle');assert.equal(validateLead({...valid,contact:'https://www.linkedin.com/in/a-person/'}).contact,'https://www.linkedin.com/in/a-person/');
 assert.equal((await call({body:{action:'challenge'},origin:'https://evil.test'})).status,403);
 assert.equal((await call({body:valid})).status,403);
 let p=await proof('',false);assert.equal((await call({cookie:p.cookie,body:{...valid,challenge:p.challenge,nonce:p.nonce}})).status,403,'three-second minimum');
 p=await proof();assert.equal((await call({cookie:p.cookie,body:{...valid,website:'bot',challenge:p.challenge,nonce:p.nonce}})).status,400);
 assert.equal((await call({cookie:p.cookie+'tampered',body:{...valid,challenge:p.challenge,nonce:p.nonce}})).status,403);
 const first=await submit();assert.equal(first.result.status,201);assert.deepEqual(Object.keys(first.result.body).sort(),['ok','retryAfter']);assert.equal(emails.length,1);assert.equal(emails[0].body.to[0],'gabriel@corvus.gent');assert.equal(emails[0].body.from,'corvus <login@corvus.gent>');assert.equal(emails[0].body.reply_to,'visitor@example.test');assert.equal(emails[0].body.subject,'🐦 sf: visitor <test> wants to coffee, open mat (bjj/mma)');assert.match(emails[0].body.text,/hello <script>/);
 assert.equal((await call({cookie:first.p.cookie,body:{...valid,challenge:first.p.challenge,nonce:first.p.nonce}})).status,403,'one-time challenge');
 const duplicate=await submit({},first.p.cookie);assert.equal(duplicate.result.status,201);assert.equal(emails.length,1);assert.equal(await client.zCard('sf:leads'),1);
 const cool=await submit({requestId:crypto.randomUUID()},first.p.cookie);assert.equal(cool.result.status,429);assert.ok(cool.result.body.retryAfter>0&&cool.result.body.retryAfter<=60);assert.equal(cool.result.headers['Retry-After'],String(cool.result.body.retryAfter));
 await clearCooldown();assert.equal((await submit({requestId:crypto.randomUUID(),contact:'@someone',thing:'rapper',lets:['studio','thrift']},first.p.cookie)).result.status,201);assert.equal(emails.at(-1).body.reply_to,undefined);assert.equal(emails.at(-1).body.subject,'🐦 sf: visitor <test> (rapper) wants to studio session / cypher, thrift & fashion');assert.match(emails.at(-1).body.text,/your thing: rapper/);
 await clearCooldown();assert.equal((await submit({requestId:crypto.randomUUID()},first.p.cookie)).result.status,201);
 await clearCooldown();const daily=await submit({requestId:crypto.randomUUID()},first.p.cookie);assert.equal(daily.result.status,429);assert.ok(daily.result.body.retryAfter>60);
 const [id]=await client.zRange('sf:leads',0,0),before=await client.pTTL('sf:lead:'+id);assert.ok(before>SF_RETENTION*1000-10000&&before<=SF_RETENTION*1000);
 assert.equal((await call({method:'GET',query:{private:'1'}})).status,403);owner={email:'someone@corvus.gent'};assert.equal((await call({method:'GET',query:{private:'1'}})).status,403);owner={email:'gabriel@corvus.gent'};
 let priv=await call({method:'GET',query:{private:'1'}});assert.equal(priv.status,200);assert.equal(priv.body.rows.length,3);assert.equal(priv.headers['Cache-Control'],'private, no-store');assert.equal(priv.body.funnel.sf_note_seen,8);
 assert.equal((await call({method:'PATCH',body:{id,done:true},origin:'https://evil.test'})).status,403);assert.equal((await call({method:'PATCH',body:{id,done:true}})).status,200);assert.ok((await client.pTTL('sf:lead:'+id))<=before);assert.equal(JSON.parse(await client.get('sf:lead:'+id)).done,true);
 mailFail=true;const queued=await submit({requestId:crypto.randomUUID()},'', '198.51.100.99');assert.equal(queued.result.status,201);assert.equal(await client.zCard('sf:outbox'),1);const mailId=(await client.zRange('sf:outbox',0,0))[0],retryKey=emails.at(-1).idempotency;mailFail=false;await store.flush();assert.equal(await client.zCard('sf:outbox'),0);assert.equal(emails.at(-1).idempotency,retryKey);assert.equal(await client.get('sf:mail:'+mailId),'sent');
 const parallel=await Promise.all(Array.from({length:10},(_,i)=>store.save(validateLead(valid),{voter:'parallel-'+i,ip:'parallel',requestId:crypto.randomUUID()})));assert.equal(parallel.filter(r=>Number(r[0])===201).length,1);assert.equal(parallel.filter(r=>Number(r[0])===429).length,9);
 for(const key of await client.keys('sf:*')){assert.ok(await client.ttl(key)>0,key);assert.ok(!key.includes('198.51.100'),key);}
 const hash1=dailyIPHash({headers:{'x-forwarded-for':'198.51.100.23'}},'sf',new Date('2026-11-04')),hash2=dailyIPHash({headers:{'x-forwarded-for':'198.51.100.23'}},'sf',new Date('2026-11-05'));assert.notEqual(hash1,hash2);
 for(const event of ['sf_note_seen','sf_note_open','sf_note_click','sf_form_start','sf_form_submit']){const safe=privacyEvent({event,properties:{$cookieless_mode:true,$pathname:'/sf/',$current_url:'https://corvus.gent/sf/?ref=secret',utm_source:'linkedin',utm_campaign:'gabe-sf-trip',...valid,leadId:id}});assert.equal(safe.properties.$pathname,'/sf/');assert.equal(safe.properties.utm_campaign,'gabe-sf-trip');assert.ok(!JSON.stringify(safe).includes('visitor@example.test'));assert.equal(safe.properties.name,undefined);assert.equal(safe.properties.leadId,undefined);}
 const deleted=await deleteUserData('visitor@example.test');assert.ok(deleted.sfLeads>=3);for(const key of await client.keys('sf:lead:*'))assert.notEqual(JSON.parse(await client.get(key)).contact,'visitor@example.test');
 // Filters must include older pages, compose, and preserve records without thing.
 for(let i=0;i<55;i++){time++;const data=validateLead({...valid,name:'filter '+i,thing:i===0?'Boulder guide':'',lets:i<2?['boulder']:['walk']});if(i===1)delete data.thing;await store.save(data,{voter:'filter-'+i,ip:'filter-'+i,requestId:crypto.randomUUID()});}
 const filter=query=>call({method:'GET',query:{private:'1',rowsOnly:'1',...query}});
 assert.equal((await filter({activity:'boulder'})).body.total,2);
 const filtered=await filter({activity:'boulder',thing:'  GUIDE  ',page:'20'});assert.equal(filtered.body.total,1);assert.equal(filtered.body.rows[0].name,'filter 0');assert.equal(filtered.body.page,1);
 assert.equal((await filter({thing:'guide'})).body.total,1);assert.equal((await filter({activity:'coffee',thing:'guide'})).body.total,0);
 assert.equal((await filter({activity:'bad'})).status,400);assert.equal((await filter({thing:'a'.repeat(61)})).status,400);assert.equal((await filter({thing:['bad']})).status,400);
 time=SF_END;assert.equal((await call({body:{action:'challenge'}})).status,410);
 let retries=0;
 const cron=createXHandler({ready:()=>false,service:{},cronSecret:()=> 'sf-cron-test',onDaily:async()=>{retries++;}});
 const reply={setHeader(){},status(){return this;},json(){}};
 await cron({method:'GET',query:{cron:'1'},headers:{authorization:'Bearer wrong'}},reply);assert.equal(retries,0);
 await cron({method:'GET',query:{cron:'1'},headers:{authorization:'Bearer sf-cron-test'}},reply);assert.equal(retries,1,'SF mail retry runs even without Notion configured');
 console.log('SF data: validation, signed cookie, proof/replay/minimum time, honeypot, 60-second/daily/concurrent limits, owner-only access, mail/reply-to/retry, per-lead TTL, deletion and analytics minimization passed.');
}finally{await client.flushDb();await client.disconnect();}
process.exit(0);
