import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
export async function nameVoteContracts({urls,client,secret}){
 const prefix='namevote:v1',device=randomUUID(),run=randomUUID();
 const hash=v=>createHmac('sha256',secret).update('namevote:'+v).digest('hex');
 const voter=randomUUID().replaceAll('-',''),cookie='mvid='+voter+'.'+createHmac('sha256',secret).update(voter).digest('base64url');
 const call=async(engine,body,headers={},method=body===undefined?'GET':'POST')=>{
  const u=new URL(urls[engine]);u.searchParams.set('module','name-vote');
  const response=await fetch(u,{method,headers:{origin:'https://corvus.gent','content-type':'application/json','x-forwarded-for':'192.0.2.121',cookie,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();delete data.serverTime;
  return{status:response.status,data,retry:response.headers.get('retry-after')};
 };
 assert.deepEqual(await call('rust'),await call('legacy'));
 for(const body of [{device:'short'},{device,name:'invalid'},{device,name:'OSSMAN'},{device,action:'play',run:'short'},{device,action:'score',run,score:-1},{device,action:'score',run,score:1.5},{device,action:'result',run,score:1000001},{device,action:'score',run,score:1000},{device,action:'feedback',type:'other',text:'abc'},{device,action:'feedback',type:'idea',text:'a'},{device,action:'idea-vote',id:'bad'},{device,action:'idea-vote',id:randomUUID()}]){
  assert.deepEqual(await call('rust',body),await call('legacy',body));
 }
 for(const engine of ['legacy','rust']){
  assert.equal((await call(engine,{device,name:'OSSMAN'},{origin:'https://evil.example'})).status,403);
  assert.equal((await call(engine,{device,name:'OSSMAN'},{'content-type':'text/plain'})).status,403);
  assert.equal((await call(engine,{device,action:'feedback',type:'idea',text:'x'.repeat(1500)})).status,413);
  assert.equal((await call(engine,undefined,{},'DELETE')).status,405);
 }
 // Shared run identity must count only once under simultaneous old/new starts.
 const starts=await Promise.all(Array.from({length:12},(_,i)=>call(i%2?'rust':'legacy',{device,run,action:'play'})));assert(starts.every(r=>r.status===200));assert.equal((await call('rust')).data.plays,1);
 assert.deepEqual(await call('rust',{device,run,action:'score',score:1000000}),await call('legacy',{device,run,action:'score',score:1000000}));
 assert.equal((await call('rust',{device,run,action:'score',score:1000000})).status,400);
 await client.set(prefix+':run:'+hash(device+':'+run),String(Date.now()-100000),{EX:86400});
 const name='Gâbe <script> 🇧🇪';
 assert.deepEqual(await call('rust',{device,run,action:'result',score:12345,name}),await call('legacy',{device,run,action:'result',score:12345,name}));
 assert.equal((await call('rust')).data.leaderboard[0].name,'Gâbe script');
 assert.deepEqual(await call('legacy',{device,run,action:'result',score:100,name:'lower'}),await call('rust',{device,run,action:'result',score:100,name:'lower'}));
 const publicBoard=(await call('rust')).data;assert.equal(publicBoard.topScore,12345);assert.equal(publicBoard.leaderboard[0].score,12345);assert.deepEqual(publicBoard, (await call('legacy')).data);
 // Legacy and Rust records mix in one leaderboard; damaged/expired entries are ignored.
 await client.zAdd(prefix+':board',[{score:99999,value:'missing'},{score:99998,value:'damaged'}]);await client.set(prefix+':entry:damaged','broken',{EX:60});assert.deepEqual(await call('rust'),await call('legacy'));
 const text=' <script> idea\n HTTPS://example.test/a?x=1 \u0000';
 assert.equal((await call('rust',{device,action:'feedback',type:'idea',text})).status,200);
 assert.equal((await call('legacy',{device,action:'feedback',type:'idea',text})).status,200);
 assert.deepEqual(await call('rust'),await call('legacy'));const ideas=(await call('rust')).data.ideas;assert.equal(ideas.length,2);assert(ideas.every(r=>r.text==='script  idea  [link removed]'));
 const id=ideas[0].id;
 await Promise.all(Array.from({length:12},(_,i)=>call(i%2?'rust':'legacy',{device,action:'idea-vote',id})));
 assert.equal((await call('rust')).data.ideas.find(r=>r.id===id).votes,1);
 assert.equal((await call('legacy',{device,action:'feedback',type:'bug',text:'A bug to fix.'})).status,200);
 assert.equal((await call('rust')).data.ideas.length,2);
 for(let i=0;i<3;i++)await call('rust',{device,action:'feedback',type:'idea',text:'rate limited'});
 assert.equal((await call('legacy',{device,action:'feedback',type:'idea',text:'rate limited'})).status,429);
 await client.hSet(prefix+':counts',{OSSMAN:'5',SMESH:'5'});const closed=(await call('rust')).data;assert.equal(closed.closed,true);assert.equal(closed.winner,'OSSMAN');assert.equal(closed.total,10);assert.deepEqual(closed,(await call('legacy')).data);
 assert.equal((await call('rust',{device,name:'BRAINROLL'})).status,409);assert.equal((await call('legacy')).data.total,10);
 const privateKeys=await client.keys(prefix+':*');assert(!privateKeys.join().includes('192.0.2'));for(const key of privateKeys.filter(k=>k.includes(':feedback:')||k.includes(':idea-voter:')||k.includes(':entry:')&&!k.endsWith('damaged'))){const ttl=await client.ttl(key);assert(ttl>7775800&&ttl<=7776000);}
 const exhaustedHash='d1:'+createHmac('sha256',createHmac('sha256',secret).update('corvus:rate-limit:'+new Date().toISOString().slice(0,10)+':namevote').digest()).update('192.0.2.121').digest('hex');await client.set(prefix+':rate:'+exhaustedHash,'120',{EX:60});
 assert.deepEqual(await call('rust',{device,name:'OSSMAN'}),await call('legacy',{device,name:'OSSMAN'}));assert.equal((await call('rust',{device,name:'OSSMAN'})).retry,'60');
 console.log('PASS: OSSMAN name vote closed-state/tie order, mixed old/new run dedupe, score speed checks and high-score preservation, Unicode names, sanitized feedback, idea-vote dedupe, shared limits and retention.');
}
