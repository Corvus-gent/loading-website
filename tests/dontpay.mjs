import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {createClient} from 'redis';
import {createDontpayHandler} from '../api/_dontpay.js';
import {validateSuggestion,SUGGESTION_LIFETIME} from '../js/dontpay-shared.js';
import {readPending,savePending} from '../dontpay/dontpay.js';
const good=()=>({id:crypto.randomUUID(),shop:'Test bakery',neighborhood:'Test neighborhood',language:'Turkish',note:'Public shop details only',link:'https://example.com/',consent:true});
const makeReq=(body=good(),extra={})=>({method:'POST',query:{},headers:{origin:'https://corvus.gent','content-type':'application/json'},body,...extra});
async function call(handler,req){const out={headers:{}};const res={setHeader:(k,v)=>out.headers[k]=v,status:n=>(out.status=n,res),json:d=>(out.body=d,out)};await handler(req,res);return out;}
const memory=()=>({value:null,getItem(){return this.value;},setItem(k,v){this.value=v;},removeItem(){this.value=null;}});
const store=memory(),a=good();savePending(store,a,1000);savePending(store,a,2000);assert.equal(readPending(store,3000).length,1);assert.equal(readPending(store,2000+SUGGESTION_LIFETIME*1000).length,0);
store.value='not json';assert.deepEqual(readPending(store),[]);store.value='{}';assert.deepEqual(readPending(store),[]);
assert.throws(()=>savePending({getItem:()=>null,setItem:()=>{throw Error('blocked');}},good()));
const capped=memory();for(let i=0;i<10;i++)savePending(capped,good());assert.throws(()=>savePending(capped,good()),/10 saved/);assert.equal(readPending(capped).length,10);
for(const value of [{...good(),shop:''},{...good(),id:'../escape'},{...good(),consent:false},{...good(),link:'javascript:alert(1)'},{...good(),link:'https://user:password@example.com/'},{...good(),note:'x'.repeat(501)},{...good(),website:'bot'}])assert.throws(()=>validateSuggestion(value));
const unavailable=createDontpayHandler({ready:()=>false,session:async()=>null});
assert.equal((await call(unavailable,makeReq())).status,503);
assert.equal((await call(unavailable,makeReq(undefined,{method:'GET',query:{private:'1'}}))).status,401);
assert.equal((await call(unavailable,makeReq(undefined,{headers:{origin:'https://evil.example','content-type':'application/json'}}))).status,403);
assert.equal((await call(unavailable,makeReq('{oops'))).status,400);
assert.equal((await call(unavailable,makeReq('x'.repeat(5000)))).status,413);
assert.equal((await call(unavailable,makeReq(undefined,{method:'DELETE'}))).status,405);
assert.deepEqual((await call(unavailable,makeReq(undefined,{method:'GET'}))).body,{ready:false});
const rows=JSON.parse(fs.readFileSync('content/posts.json'));
assert.equal(rows.filter(p=>p.network==='x'&&p.kind==='long').length,3);assert.equal(rows.filter(p=>p.network==='x'&&p.kind==='short').length,5);assert.equal(rows.filter(p=>p.network==='linkedin').length,2);
for(const p of rows){const url=new URL(p.intent);assert.equal(url.searchParams.get('text'),p.text);assert.equal(url.hostname,p.network==='x'?'x.com':'www.linkedin.com');if(p.kind==='short')assert.ok(p.text.length<=280,p.title+' exceeds short format');}
// Isolated random key namespace; never flush a shared database or touch real records.
const client=createClient({url:'redis://127.0.0.1:16380/0',socket:{connectTimeout:1000,reconnectStrategy:false}});client.on('error',()=>{});
await client.connect();const namespace='dontpay:night-test:'+crypto.randomUUID()+':';
const command=cmd=>client.sendCommand(cmd.map(String));
const handler=createDontpayHandler({command,ready:()=>true,session:async()=>({email:'gabriel@corvus.gent'}),hash:()=> 'test-sender',namespace});
try{
 const value=good(),results=await Promise.all(Array.from({length:12},()=>call(handler,makeReq(value))));
 assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===200).length,11);assert.equal(Number(await command(['ZCARD',namespace+'index'])),1);
 const ttl=Number(await command(['TTL',namespace+'entry:'+value.id]));assert.ok(ttl>0&&ttl<=SUGGESTION_LIFETIME);
 const publicGet=await call(handler,makeReq(undefined,{method:'GET'}));assert.deepEqual(publicGet.body,{ready:true});
 const owner=await call(handler,makeReq(undefined,{method:'GET',query:{private:'1'}}));assert.equal(owner.body.suggestions.length,1);assert.equal(owner.body.suggestions[0].shop,value.shop);assert.ok(!JSON.stringify(owner.body).includes('test-sender'));
 const outsider=createDontpayHandler({command,ready:()=>true,session:async()=>null,namespace});assert.equal((await call(outsider,makeReq(undefined,{method:'GET',query:{private:'1'}}))).status,401);
 for(let i=0;i<4;i++)assert.equal((await call(handler,makeReq())).status,201);
 assert.equal((await call(handler,makeReq())).status,429);
 assert.equal((await call(handler,makeReq(value))).status,200,'idempotent retry survives rate cap');
 const failing=createDontpayHandler({command:async()=>{throw Error('private connection details');},ready:()=>true,hash:()=> 'test-sender'});const failure=await call(failing,makeReq());assert.equal(failure.status,503);assert.ok(!JSON.stringify(failure).includes('private connection details'));
 console.log('I DON’T PAY passed: real Redis writes, concurrent idempotency, retention, owner-only reads, limits, offline storage and all 10 composer links.');
}finally{
 let cursor='0';do{const reply=await command(['SCAN',cursor,'MATCH',namespace+'*','COUNT',100]);cursor=reply[0];if(reply[1].length)await command(['DEL',...reply[1]]);}while(cursor!=='0');await client.quit();
}
