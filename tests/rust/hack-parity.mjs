import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
export async function hackContracts({urls,client,secret}){
 const call=async(engine,body,q={},headers={},method=body===undefined?'GET':'POST')=>{
  const u=new URL(urls[engine]);u.searchParams.set('module','hack');for(const[k,v]of Object.entries(q))u.searchParams.set(k,v);
  const r=await fetch(u,{method,headers:{origin:'https://corvus.gent','content-type':'application/json','x-forwarded-for':'192.0.2.132',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,data:await r.json(),cache:r.headers.get('cache-control')};
 };
 assert.deepEqual(await call('rust'),await call('legacy'));
 for(const body of [{action:'unknown'},{action:'view',website:'spam'},{action:'squad_member',hack_id:1,member:'hidden'},{action:'squad_member',hack_id:2,member:'siebe'},{action:'comment',text:'too fast',started:Date.now()},{action:'comment',text:'hello',started:0,email:'bad-email'},{action:'comment',text:' '},{action:'comment_like',id:'bad'},{action:'comment_like',id:randomUUID()},{action:'comment',text:'x'.repeat(5001),started:0}])assert.deepEqual(await call('rust',body),await call('legacy',body));
 for(const engine of ['rust','legacy']){
  assert.equal((await call(engine,undefined,{private:'1'})).status,401);
  assert.equal((await call(engine,{action:'view'},{},{origin:'https://evil.example'})).status,403);
  assert.equal((await call(engine,{action:'view'},{},{'content-type':'text/plain'})).status,403);
  assert.equal((await call(engine,undefined,{}, {},'DELETE')).status,405);
 }
 for(const action of ['view','app_open','github_click','share','squad_member']){
  assert.deepEqual(await call('rust',{action,source:'instagram',source_confidence:'utm',hack_id:1,member:'gabe'}),await call('legacy',{action,source:'instagram',source_confidence:'utm',hack_id:1,member:'gabe'}));
 }
 const reactions=await Promise.all(Array.from({length:12},(_,i)=>call(i%2?'rust':'legacy',{action:i%2?'like':'dislike',source:'direct'})));assert.equal(reactions.filter(r=>r.data.already).length,11);
 const totals=(await call('rust')).data.totals;assert.equal((totals.like||0)+(totals.dislike||0),1);assert.equal(totals.view,2);assert.deepEqual(await call('rust'),await call('legacy'));
 const started=Date.now()-10000;
 assert.equal((await call('rust',{action:'comment',text:'<b>Public hello</b>\u0000',name:'<em>Tester</em>',email:'never-public@example.test',started})).status,200);
 const publicData=(await call('legacy')).data;assert.equal(publicData.comments.length,1);assert.equal(publicData.comments[0].text,'bPublic hello/b');assert.equal(publicData.comments[0].name,'emTester/em');assert(!JSON.stringify(publicData).includes('never-public'));
 const id=publicData.comments[0].id;
 const commentLikes=await Promise.all(Array.from({length:12},(_,i)=>call(i%2?'rust':'legacy',{action:'comment_like',id})));assert(commentLikes.every(r=>r.status===200));assert.equal((await call('rust')).data.comments[0].likes,1);
 assert.equal((await call('legacy',{action:'feedback',text:'private note',email:'private@example.test',started})).status,429);
 assert.equal((await call('legacy',{action:'feedback',text:'private note',email:'private@example.test',started},{},{'x-forwarded-for':'192.0.2.133'})).status,200);
 assert.deepEqual(await call('rust'),await call('legacy'));assert.deepEqual((await call('rust')).data.feedback,[]);
 const sid='hack-owner-fixture';await client.set('sess:'+sid,'gabriel@corvus.gent',{EX:600});const cookie='sess='+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64url');
 const own=await call('rust',undefined,{private:'1'},{cookie});assert.equal(own.data.private,true);assert.equal(own.data.feedback.length,1);assert.equal(own.data.feedback[0].email,'private@example.test');assert.equal(own.cache,'private, no-store');assert.deepEqual(own,await call('legacy',undefined,{private:'1'},{cookie}));
 await client.set('sess:'+sid,'someone@corvus.gent',{EX:600});assert.equal((await call('rust',undefined,{private:'1'},{cookie})).status,401);
 await client.set('hack:hidden:'+id,'1',{EX:600});assert.equal((await call('rust')).data.comments.length,0);assert.deepEqual(await call('rust'),await call('legacy'));
 // Hidden historical teammate identifiers are combined into neutral placeholders in both runtimes.
 await client.hSet('hack:members',{'1:old-person':'9','1:another-person':'3','2:hidden-person':'4','1:siebe':'8','3:invalid':'10','1:gabe:invalid':'20'});
 const members=(await call('rust')).data.members;assert.equal(members['1:xx'],12);assert.equal(members['2:xx'],4);assert.equal(members['1:siebe'],8);assert(!JSON.stringify(members).includes('person'));assert.deepEqual(await call('rust'),await call('legacy'));
 for(const key of (await client.keys('hack:*')).filter(k=>/^hack:(?:comments|feedback):/.test(k)||k==='hack:comments'||k==='hack:feedback'||k.startsWith('hack:likes:'))){const ttl=await client.ttl(key);assert(ttl>7775800&&ttl<=7776000);}
 const hash='d1:'+createHmac('sha256',createHmac('sha256',secret).update('corvus:rate-limit:'+new Date().toISOString().slice(0,10)+':hack').digest()).update('192.0.2.132').digest('hex');await client.set('hack:rate:'+hash,'60',{EX:60});assert.deepEqual(await call('rust',{action:'view'}),await call('legacy',{action:'view'}));assert.equal((await call('rust',{action:'view'})).status,429);
 console.log('PASS: hack feedback privacy/owner checks, hidden teammate aggregation, sanitized comments, old/new reaction and like dedupe, attribution, shared rate limits and per-record expiry.');
}
