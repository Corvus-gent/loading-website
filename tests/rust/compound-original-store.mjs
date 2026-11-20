import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
const runtime=await isolatedRuntime('compound');
const {client,secret}=runtime;
for(const k of Object.keys(process.env))if(/REDIS|KV_|SECRET|REST_API/.test(k))delete process.env[k];
const env={PATH:process.env.PATH,REDIS_URL:client.options.url,SESSION_SECRET:secret,CORVUS_RUST_WRITES:'isolated',COMPOUND_STRIPE_MODE:'test',COMPOUND_PAYMENT_LINK_TEST:'https://buy.stripe.com/fixture',COMPOUND_PAYMENT_LINK_ID_TEST:'plink_fixture',COMPOUND_KEY_PREFIX:'editor-fixture'};
Object.assign(process.env,env);
const rust=fields=>new Promise((resolve,reject)=>{
 const child=spawn('target/debug/corvus-contract',[],{env,stdio:['pipe','pipe','pipe']});let out='',err='';
 child.stdout.on('data',v=>out+=v);child.stderr.on('data',v=>err+=v);child.on('error',reject);child.on('close',code=>{if(code)return reject(Error(err));try{resolve(JSON.parse(out));}catch(e){reject(e);}});
 child.stdin.end(JSON.stringify({operation:'compound-editor',...fields})+'\n');
});
const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['at','uploaded_at','updated','created','expires'].includes(k)).map(([k,v])=>[k,strip(v)])):v;
const key=s=>env.COMPOUND_KEY_PREFIX+':'+s;
try{
 const old=await import('../../api/_compound/store.js'),payments=await import('../../api/_compound/payments.js');
 const summary=async()=>assert.deepEqual(strip(await rust({action:'summary'})),strip(await old.summary()));
 await summary();
 const input={url:'https://fixture.public.blob.vercel-storage.com/compound/test.mp4',duration:30,label:'same cut',cutlist:[{label:'Opening',start:0,end:3}],cues:[{t:10,q:'Which cut?',options:['one','two']}]};
 for(const body of [{...input,url:'https://evil.example/file'},{...input,slot:4},{...input,duration:'30'},{...input,label:''}]){
  let expected;try{await old.publish(body);}catch(e){expected={error:e.message};}assert.deepEqual(await rust({action:'publish',body}),expected);
 }
 const first=await rust({action:'publish',body:input});assert.equal(first.error,undefined);assert.deepEqual(first,await old.version('v1'));
 const second=await old.publish({...input,slot:2});assert.deepEqual(await rust({action:'version',version:second.id}),second);
 const third=await rust({action:'publish',body:{...input,slot:3}});assert.equal(third.id,'v3');
 const recut=await old.publish({...input,slot:1,label:'second iteration'});assert.equal(recut.iteration,2);await summary();
 assert.deepEqual(await rust({action:'versions'}),await old.versions());
 // Historical single-cut records had no slot/iteration; publication continues their existing counter.
 await client.hDel(key('iterations'),'2');const native=await rust({action:'publish',body:{...input,slot:2}});assert.equal(native.iteration,2);
 const labels=[{id:first.transitions[0].id,label:'New label'}];const renamed=await rust({action:'rename',version:'v1',labels});assert.equal(renamed.transitions[0].label,'New label');assert.equal(renamed.transitions[0].start,first.transitions[0].start);assert.deepEqual(renamed,await old.version('v1'));assert.equal((await rust({action:'rename',version:'v1',labels:[...labels,...labels]})).error,'label');
 const uid='voter-fixture',version='v1';await rust({action:'profile',uid,value:'@fixture'});assert.equal(await old.profile(uid,'@fixture'),'@fixture');
 const votes=await Promise.all(Array.from({length:16},(_,i)=>i%2?rust({action:'feedback',uid,version,body:{action:'vote',choice:'up'}}):old.feedback(uid,version,{action:'vote',choice:'down'})));
 assert.equal(votes.filter(v=>v.added).length,1);assert.equal(new Set(votes.map(v=>v.choice)).size,1);assert.equal(await client.get(key('score:'+uid)),'1');
 const category={action:'category',category:'Hook',choice:'up',why:'Private idea not for the public wall'};
 assert.equal((await rust({action:'feedback',uid,version,body:category})).added,true);assert.equal((await old.feedback(uid,version,category)).added,false);assert.deepEqual(await old.feedbackFeed(),[]);
 const ideas=await Promise.all(Array.from({length:8},(_,i)=>i%2?rust({action:'text',uid,version,value:'This is the same idea'}):old.saveText(uid,version,'This is the same idea')));assert.equal(ideas.filter(v=>v.added).length,1);const idea=ideas.find(v=>v.added);assert.equal(await client.get(key('score:'+uid)),'5');
 assert.equal(await rust({action:'hide',id:idea.id}),true);assert.equal(await old.hideText(idea.id),true);assert.equal(await client.get(key('score:'+uid)),'2');
 const quickUid='public-fixture';await old.profile(quickUid,'Public Helper');
 const quicks=await Promise.all(Array.from({length:12},(_,i)=>i%2?rust({action:'quick',uid:quickUid,version,body:{chip:'hook'}}):old.quickNote(quickUid,version,{chip:'hook'})));assert.equal(quicks.filter(v=>v.added).length,1);assert.equal(new Set(quicks.map(v=>v.id)).size,1);const note=quicks[0];
 assert.equal((await rust({action:'note-text',uid:'intruder',version,id:note.id,value:'Cannot replace this note'})).error,'text');
 await rust({action:'note-text',uid:quickUid,version,id:note.id,value:'The hook needs breathing room'});await old.noteText(quickUid,version,note.id,'The hook needs breathing room');assert.equal(await client.get(key('score:'+quickUid)),'4');
 assert.deepEqual(await rust({action:'feed'}),await old.feedbackFeed());const feed=await rust({action:'feed'});assert.equal(feed[0].handle,'Public Helper');assert.equal(JSON.stringify(feed).includes('Private idea'),false);assert.equal(JSON.stringify(feed).includes(quickUid),false);
 const reactions=await Promise.all(Array.from({length:12},(_,i)=>i%2?rust({action:'reaction',uid,version,kind:'bored',t:12}):old.reaction(uid,version,'bored',12)));assert.equal(reactions.filter(v=>v.added).length,1);
 const transition={action:'transition',transition:first.transitions[0].id,choice:'up'};
 const transitions=await Promise.all(Array.from({length:8},(_,i)=>i%2?rust({action:'transition',uid,record:first,body:transition}):old.transition(uid,first,transition)));assert.equal(transitions.filter(v=>v.added).length,1);
 for(const action of ['transition_tag','transition_text']){const body={action,transition:transition.transition,tag:'smooth',text:'Give this cut more time'};assert.equal((await rust({action:'transition',uid,record:first,body})).added,true);assert.equal((await old.transition(uid,first,body)).added,false);}
 const poll=await rust({action:'push-poll',version:'all',body:{q:'One or two?',options:['one','two']}});assert.equal(poll.error,undefined);
 const answers=await Promise.all(Array.from({length:10},(_,i)=>i%2?rust({action:'answer',uid,version:i%3?'v1':'v2',id:poll.id,option:1}):old.answer(uid,i%3?'v1':'v2',poll.id,1)));assert.equal(answers.filter(v=>v.added).length,1);
 assert.equal((await rust({action:'answer',uid,version,id:first.cues[0].id,option:0})).added,true);assert.equal((await old.answer(uid,version,first.cues[0].id,0)).added,false);
 const prediction={win:'yes',final:3};assert.equal((await old.predict(uid,prediction)).added,true);assert.equal((await rust({action:'predict',uid,body:prediction})).added,false);
 await old.watched(uid,'v1');assert.deepEqual(new Set((await rust({action:'watched',uid,version:'v2'})).watched),new Set(['v1','v2']));
 const duel={action:'battle',winner:'v1',opponent:'v2'};const duels=await Promise.all(Array.from({length:8},(_,i)=>i%2?rust({action:'duel',uid,body:duel}):old.duel(uid,duel)));assert.equal(duels.filter(v=>v.added).length,1);assert.equal((await rust({action:'duel',uid,body:{...duel,opponent:'v4'}})).error,'battle');
 const pick={action:'pick',winner:'v2'};assert.equal((await rust({action:'duel',uid,body:pick})).added,true);assert.equal((await old.duel(uid,pick)).added,false);
 // Exact attribution/session aggregates across engines, with consented-only event rows.
 const tags={source:'instagram',medium:'bio',content:'fixture',term:'campaign',first:{source:'x',content:'first'},last:{source:'instagram',content:'last'}};const visitor=randomUUID(),visit=randomUUID();
 const details={visit,percent:75,unbounded:'PRIVATE',text:'PRIVATE',email:'PRIVATE',method:'stripe'};
 for(const name of ['view','play','watch:25','watch:75','watch:50','vote','donation_click','army_join']){
  await old.event(name,version,tags,visitor,details);await rust({action:'event',name,version,body:tags,visitor,details});
 }
 await rust({action:'event',name:'view',version,body:tags,details});
 assert.deepEqual(await rust({action:'campaigns'}),await old.campaignStats());
 const campaigns=await old.campaignStats();assert.equal(campaigns.length,2);assert(campaigns.every(v=>v.watchSamples===1&&v.avgWatch===75&&v.engaged===1));
 const list=await client.lRange(key('events:v1:'+new Date().toISOString().slice(0,10)),0,-1);assert.equal(list.length,16);assert.equal(list.some(v=>v.includes('PRIVATE')),false);assert.deepEqual(strip(JSON.parse(list[0])),strip(JSON.parse(list[1])));
 const revolut=await rust({action:'revolut',body:{total:1234,late:100,url:'https://revolut.me/fixture',attribution:tags}});assert.equal(revolut.total,1234);assert.deepEqual(strip(revolut),strip(await old.setRevolut({total:1234,late:100})));assert.equal((await rust({action:'revolut',body:{total:2,url:'https://evil.example/x'}})).error,'revolut link');
 await summary();assert.deepEqual(strip(await rust({action:'private'})),strip(await old.privateStats()));
 // Checkout and receipt never publish visitor identifiers. Refund dedupe is cumulative and atomic.
 const link=await rust({action:'checkout',body:tags,journey:{visitor,visit,version}});assert.equal(link.test,true);const ref=new URL(link.url).searchParams.get('client_reference_id');assert.match(ref,/^compound_[0-9a-f]{32}$/);assert.ok(await client.ttl(key('checkout:'+ref))>604790);
 const payment={type:'checkout.session.completed',livemode:false,created:1794070000,data:{object:{payment_link:'plink_fixture',payment_status:'paid',currency:'eur',amount_total:500,payment_intent:'pi_fixture',client_reference_id:ref}}};
 const successes=await Promise.all(Array.from({length:12},(_,i)=>i%2?rust({action:'stripe',body:payment}):payments.processStripeEvent(payment)));assert.equal(successes.filter(v=>v.added).length,1);assert.equal(await client.get(key('fund:test')),'500');assert.equal(await client.get(key('fund:live')),null);
 const receipt=JSON.parse(await client.get(key('payment:test:pi_fixture')));assert.equal(receipt.tags.visitor,undefined);assert.equal(receipt.tags.visit,undefined);assert.ok(await client.ttl(key('payment:test:pi_fixture'))>31535900);
 const refund=n=>({type:'charge.refunded',livemode:false,data:{object:{payment_intent:'pi_fixture',amount_refunded:n}}});
 const refunds=await Promise.all(Array.from({length:12},(_,i)=>i%2?rust({action:'stripe',body:refund(200)}):payments.processStripeEvent(refund(200))));assert.equal(refunds.filter(v=>v.refunded).length,1);assert.equal(await client.get(key('fund:test')),'300');
 assert.equal((await rust({action:'stripe',body:refund(100)})).refunded,false);assert.equal((await payments.processStripeEvent(refund(900))).refunded,true);assert.equal(await client.get(key('fund:test')),'0');
 const late={...payment,created:1900000000,data:{object:{...payment.data.object,payment_intent:'pi_late',amount_total:300}}};assert.equal((await rust({action:'stripe',body:late})).added,true);assert.equal(await client.get(key('fund-late:test')),'300');
 for(const body of [{...payment,livemode:true},{...payment,type:'other'},{...payment,data:{object:{...payment.data.object,currency:'usd'}}},{...payment,data:{object:{...payment.data.object,amount_total:99}}}])assert.deepEqual(await rust({action:'stripe',body}),await payments.processStripeEvent(body));
 await summary();assert.deepEqual(strip(await rust({action:'private'})),strip(await old.privateStats()));
 for(const k of ['text:'+note.id,'helper:'+quickUid,'score:'+quickUid,'reaction-once:v1:'+uid+':12:bored','prediction:'+uid])assert.ok(await client.ttl(key(k))>7775900,k+' retention');
 assert.equal(await rust({action:'hide',id:note.id}),true);assert.equal((await old.feedbackFeed()).length,0);assert.equal(await client.get(key('score:'+quickUid)),'0');
 console.log('PASS: original Compound bidirectional versions/slots, stable transition IDs, cross-runtime vote/poll/note dedupe, public/private feedback and contributor credit, consent/attribution aggregates, retention, fund modes and 12-way payment/refund idempotency. No provider requests or real payments.');
}catch(error){process.exitCode=1;console.error(error);}finally{await runtime.close();setTimeout(()=>process.exit(process.exitCode||0),100).unref();}
