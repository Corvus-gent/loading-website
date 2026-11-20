import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
export async function editorHttpContracts({urls,client,secret}){
 const {languageVoteSecret}=await import('../../api/_secrets.js');
 const voter='original-http-voter';const vid='vid='+voter+'.'+createHmac('sha256',languageVoteSecret()).update(voter).digest('base64url');
 let ip=0;
 const call=async(engine,q={},body,headers={},method=body===undefined?'GET':'POST')=>{
  const u=new URL(urls[engine]);u.searchParams.set('module','compound');for(const[k,v]of Object.entries(q))u.searchParams.set(k,v);
  const h={origin:'https://corvus.gent','content-type':'application/json','x-forwarded-for':'192.0.2.'+(++ip),cookie:vid,...headers};for(const k of Object.keys(h))if(h[k]===null)delete h[k];
  const r=await fetch(u,{method,redirect:'manual',headers:h,...(body===undefined?{}:{body:JSON.stringify(body)})});const raw=await r.text();return{status:r.status,body:raw?JSON.parse(raw):null,cookie:r.headers.get('set-cookie'),location:r.headers.get('location'),cache:r.headers.get('cache-control'),nosniff:r.headers.get('x-content-type-options')};
 };
 const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['updated','uploaded_at','at'].includes(k)).map(([k,v])=>[k,strip(v)])):v;
 const equal=async(q={},body,headers={},method)=>assert.deepEqual(strip(await call('rust',q,body,headers,method)),strip(await call('legacy',q,body,headers,method)));
 await equal();await equal({version:'none'});await equal({feed:'1'});await equal({private:'1'});await equal({session:'1'});await equal({live:'1'});
 for(const method of ['HEAD','PUT','DELETE'])await equal({},undefined,{},method);
 for(const body of [{action:'wrong'},{action:'event',event:'wrong'},{action:'vote',version:'nope',choice:'up'},{action:'prediction',win:'maybe',final:1},{action:'profile',handle:'<script>'},{action:'text',text:'x'},[],null,{action:'profile',handle:'x'.repeat(20001)},{action:'profile',website:'spam'},{action:'publish'}])await equal({},body);
 await equal({}, {action:'login',password:'wrong'});await equal({}, {action:'profile',handle:'fixture'},{origin:'https://evil.test'});await equal({}, {action:'profile',handle:'fixture'},{'content-type':'text/plain'});
 assert.equal((await call('rust',{}, {action:'profile',handle:'fixture'},{origin:null})).status,403);
 const admin=await call('rust',{}, {action:'login',role:'admin',password:secret});assert.equal(admin.status,200);assert.match(admin.cookie,/Path=\/api\/compound; Max-Age=14400; HttpOnly; Secure; SameSite=Strict/);assert.equal((await call('legacy',{session:'1',role:'admin'},undefined,{cookie:admin.cookie})).body.authorized,true);
 const stats=await call('legacy',{}, {action:'login',password:'stats-fixture'});assert.equal(stats.status,200);assert.equal((await call('rust',{session:'1'},undefined,{cookie:stats.cookie})).body.authorized,true);assert.equal((await call('rust',{session:'1',role:'admin'},undefined,{cookie:stats.cookie})).body.authorized,false);
 const authorization='Bearer '+secret;await equal({private:'1'},undefined,{authorization});
 const b={action:'publish',url:'https://fixture.public.blob.vercel-storage.com/compound/http.mp4',duration:40,label:'HTTP fixture',cues:[{t:5,q:'Which ending?',options:['one','two']}],cutlist:[{start:0,end:4,label:'Intro'}]};
 const first=await call('rust',{},b,{cookie:admin.cookie,origin:null});assert.equal(first.status,403);
 const saved=await call('rust',{},b,{authorization,origin:null});assert.equal(saved.status,200);const version=saved.body.version.id;
 await equal({version});await equal({private:'1',version},undefined,{cookie:stats.cookie});
 for(const body of [{action:'vote',choice:'invalid'},{action:'reaction',type:'bored',t:100},{action:'poll',poll:'cue-0',option:'1'},{action:'event',event:'watch',percent:30},{action:'event',event:'watch',percent:'25'},{action:'event',event:'dropoff',t:-1},{action:'transition',transition:'missing',choice:'up'},{action:'quick',chip:'wrong'},{action:'note_text',id:randomUUID(),text:'A note'}])await equal({}, {...body,version});
 const voteBody={action:'vote',version,choice:'up'};const votes=await Promise.all(Array.from({length:10},(_,i)=>call(i%2?'rust':'legacy',{},voteBody)));assert.equal(votes.filter(v=>v.body.added).length,1);
 const issued=await call('rust',{}, {action:'quick',version,chip:'fire'},{cookie:null});assert.equal(issued.status,200);assert.match(issued.cookie,/^vid=/);assert.equal((await call('legacy',{}, {action:'quick',version,chip:'fire'},{cookie:issued.cookie})).body.added,false);
 const noteId=issued.body.id;await call('rust',{}, {action:'note_text',version,id:noteId,text:'Strong opening; add a clearer ending'},{cookie:issued.cookie});await equal({feed:'1'});
 const pending=await call('legacy',{}, {action:'live_poll',version:'all',q:'Pick the music',options:['one','two']},{authorization});assert.equal(pending.status,200);await equal({live:'1'});await equal({private:'1'},undefined,{authorization});
 const poll=pending.body.poll.id;assert.equal((await call('rust',{}, {action:'poll',version,poll,option:0})).body.added,true);assert.equal((await call('legacy',{}, {action:'poll',version,poll,option:1})).body.added,false);
 const visitor=randomUUID(),visit=randomUUID();const event={action:'event',event:'view',version,visitor,visit,analytics:true,attribution:{source:'x',referrer:'https://x.com/private?email=not-public@example.test'}};
 const eventKey='compound:events:'+version+':'+new Date().toISOString().slice(0,10);const before=await client.lLen(eventKey);
 await call('rust',{},event);await call('legacy',{},event);assert.equal(await client.lLen(eventKey),before+2);
 for(const headers of [{'sec-gpc':'1'},{dnt:'1'}]){await call('rust',{},event,headers);await call('legacy',{},event,headers);}assert.equal(await client.lLen(eventKey),before+2);const history=await client.lRange(eventKey,0,-1);assert.equal(history.some(v=>v.includes('not-public')),false);
 await equal({private:'1'},undefined,{authorization});
 // All legacy campaign short links retain query precedence and issue exactly the same redirect.
 const {COMPOUND_LINKS}=await import('../../js/compound-links.js');
 for(const slug of [...Object.keys(COMPOUND_LINKS),'missing'])for(const q of [{slug},{slug,c:'caption one 💎',utm_source:'replace',utm_medium:'replace',extra:'keep'}])await equal(q);
 const noPayment=await call('rust',{}, {action:'donate',version});assert.equal(noPayment.body.error,'payments not connected yet');
 await call('rust',{}, {action:'revolut',url:'https://revolut.me/fixture',total:1200,late:200},{authorization});await equal({}, {action:'donate',version,method:'revolut'});
 await equal({private:'1'},undefined,{authorization});await equal({}, {action:'hide_text',id:randomUUID()},{authorization});await call('legacy',{}, {action:'hide_text',id:noteId},{authorization});await equal({feed:'1'});
 // Raw Stripe signature bytes are checked in the endpoint, not reconstructed from JSON.
 const webhook=async(engine,body,signature)=>{const u=new URL(urls[engine]);u.searchParams.set('module','compound-stripe');const r=await fetch(u,{method:'POST',headers:{'stripe-signature':signature},body});const text=await r.text();return{status:r.status,body:text?JSON.parse(text):null};};
 const sign=raw=>{const t=Math.floor(Date.now()/1000);return 't='+t+',v1='+createHmac('sha256','whsec_fixture').update(t+'.'+raw).digest('hex');};
 for(const raw of [JSON.stringify({type:'test.event',livemode:false}),' {"type": "test.event", "livemode": false} ',JSON.stringify({type:'test.event',livemode:false,extra:'🥋'}),'not-json'])assert.deepEqual(await webhook('rust',raw,sign(raw)),await webhook('legacy',raw,sign(raw)));
 assert.deepEqual(await webhook('rust','{}','bad'),await webhook('legacy','{}','bad'));const oversized='x'.repeat(128001);assert.deepEqual(await webhook('rust',oversized,sign(oversized)),await webhook('legacy',oversized,sign(oversized)));
 console.log('PASS: original Compound HTTP public/private caches, stats/admin role cookies, bearer+CSRF, actions/input errors, shared voter dedupe, quick-note ownership, consent history, all tracked redirects, Revolut fallback, raw signed Stripe payloads/size limits.');
}
