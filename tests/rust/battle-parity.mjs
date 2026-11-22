import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
export async function battleContracts({urls,client,secret}){
 const prefix='battle:preview:v1';
 const endpoint=(engine,q={})=>{const u=new URL(urls[engine]);u.searchParams.set('module','battle');for(const[k,v]of Object.entries(q))u.searchParams.set(k,v);return u;};
 const call=async(engine,q={},body,extra={},method=body===undefined?'GET':'POST')=>{
  const r=await fetch(endpoint(engine,q),{method,redirect:'manual',headers:{origin:'https://corvus.gent','content-type':'application/json','user-agent':'Mozilla/5.0 fixture','x-forwarded-for':'192.0.2.81',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await r.text();const data=text?JSON.parse(text):null;if(data)delete data.serverTime;
  return{status:r.status,body:data,cookie:r.headers.get('set-cookie'),location:r.headers.get('location')};
 };
 const canonical=url=>{if(!url)return url;const u=new URL(url,'https://corvus.gent');u.searchParams.sort();return u.href;};
 assert.deepEqual(await call('rust'),await call('legacy'));assert.equal((await call('rust')).body.total,0);assert.equal((await call('rust')).body.order,undefined);
 for(const fighter of ['cx','cp','bio'])for(const platform of ['tt','ig','x','li']){
  const q={slug:fighter+'-'+platform,foo:'keep',utm_source:'replace-me'};
  for(const method of ['HEAD','GET']){const a=await call('rust',q,undefined,{},method),b=await call('legacy',q,undefined,{},method);assert.equal(a.status,302);assert.equal(canonical(a.location),canonical(b.location));}
 }
 const clicks=(await call('rust')).body.clicks;assert.equal(Object.keys(clicks).length,12);assert(Object.values(clicks).every(v=>v==='1'));
 const device=randomUUID();
 for(const side of ['A','B','bad'])for(const poster of ['0','1'])assert.deepEqual(await call('rust',{media:side,device,poster}),await call('legacy',{media:side,device,poster}));
 for(const engine of ['rust','legacy']){
  assert.equal((await call(engine,{action:'admin'})).status,401);
  assert.equal((await call(engine,{}, {action:'vote',device,choice:'A'},{origin:'https://evil.example'})).status,403);
  assert.equal((await call(engine,{}, {action:'vote',device,choice:'C'})).status,400);
  assert.equal((await call(engine,{}, {action:'vote',device:'short',choice:'A'})).status,400);
 }
 const authorization='Bearer '+secret;
 const views=['codex','compound'].flatMap(fighter=>['tiktok','instagram','x','linkedin'].map(platform=>({fighter,platform,views:123,url:'https://example.test/post'})));
 for(const engine of ['rust','legacy'])assert.equal((await call(engine,{action:'admin'},{action:'admin',closed:true,views},{authorization})).status,409,'cannot close a tie');
 for(const bad of [{closed:true,views:[]},{closed:true,views:[...views.slice(1),views[1]]},{closed:true,views:views.map((r,i)=>i? r:{...r,views:1.5})},{closed:true,views:views.map((r,i)=>i? r:{...r,url:'http://example.test'})}])assert.deepEqual(await call('rust',{action:'admin'},{action:'admin',...bad},{authorization}),await call('legacy',{action:'admin'},{action:'admin',...bad},{authorization}));
 const first=await call('rust',{}, {action:'vote',device,choice:'A'});assert.equal(first.status,200);assert.equal(first.body.total,1);assert.match(first.cookie,/mvid=.*; Path=\/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict/);
 const cookie=first.cookie.split(';')[0];const [id,sig]=cookie.slice(5).split('.');assert.equal(sig,createHmac('sha256',secret).update(id).digest('base64url'));
 assert.deepEqual(await call('legacy',{device},undefined,{cookie}),await call('rust',{device},undefined,{cookie}));
 const repeat=await call('legacy',{}, {action:'vote',device,choice:'B'},{cookie});assert.equal(repeat.body.total,1);assert.equal(repeat.body.pick,first.body.pick);
 const different=await call('legacy',{}, {action:'vote',device:randomUUID(),choice:'A'});assert.equal(different.status,409);
 const sameCookie=await call('legacy',{}, {action:'vote',device:randomUUID(),choice:'A'},{cookie,'x-forwarded-for':'192.0.2.82'});assert.equal(sameCookie.status,200);assert.equal(sameCookie.body.total,1);
 const raceDevice=randomUUID();const race=await Promise.all(Array.from({length:10},(_,i)=>call(i%2?'rust':'legacy',{}, {action:'vote',device:raceDevice,choice:'B'},{'x-forwarded-for':'192.0.2.83'})));assert(race.every(r=>r.status===200));assert.equal((await call('rust')).body.total,2);
 let winningCookie;
 for(const result of race){const candidate=result.cookie.split(';')[0],id=candidate.slice(5).split('.')[0];const key=prefix+':voter:'+createHmac('sha256',secret).update('battle:'+id).digest('hex');if(await client.exists(key)){assert.equal(winningCookie,undefined);winningCookie=candidate;}}
 assert(winningCookie);assert.equal((await call('rust',{}, {action:'vote',device:randomUUID(),choice:'A'},{cookie:winningCookie,'x-forwarded-for':'192.0.2.84'})).body.total,2);
 const old=await call('legacy',{}, {action:'vote',device:randomUUID(),choice:'B'},{'x-forwarded-for':'192.0.2.180'});assert.equal(old.body.total,3);
 assert.equal((await call('rust',{}, {action:'vote',device:randomUUID(),choice:'A'},{cookie:old.cookie.split(';')[0],'x-forwarded-for':'192.0.2.181'})).body.total,3);
 // Seed an unambiguous legacy result, then prove the close operation is respected by both handlers.
 await client.hSet(prefix+':votes',{codex:'10',compound:'5'});
 const closed=await call('rust',{action:'admin'},{action:'admin',closed:true,views},{authorization});assert.equal(closed.status,200);assert.equal(closed.body.winner,'codex');assert.equal(closed.body.total,15);
 assert.deepEqual(await call('rust'),await call('legacy'));
 for(const engine of ['rust','legacy'])assert.equal((await call(engine,{}, {action:'vote',device:randomUUID(),choice:'A'},{'x-forwarded-for':'192.0.2.85'})).status,409);
 const open=await call('legacy',{action:'admin'},{action:'admin',closed:false,views},{authorization});assert.equal(open.status,200);assert.equal(open.body.winner,null);assert.deepEqual(await call('rust'),await call('legacy'));
 const newDevice=randomUUID();assert.equal((await call('rust',{}, {action:'vote',device:newDevice,choice:'A'},{'x-forwarded-for':'192.0.2.86'})).body.total,16);
 const keys=await client.keys(prefix+':*');assert(!keys.join().includes('192.0.2'));for(const key of keys.filter(k=>/:device:|:voter:/.test(k))){const ttl=await client.ttl(key);assert(ttl>7775800&&ttl<=7776000);}
 // More than twelve attempts share one limiter across old and Rust.
 for(let i=0;i<10;i++)await call(i%2?'rust':'legacy',{}, {action:'vote',device,choice:'A'});
 assert.equal((await call('rust',{}, {action:'vote',device,choice:'A'})).status,429);
 console.log('PASS: battle blind order/media, 12 redirects, shared clicks, signed cookies both ways, concurrent vote dedupe, device/network limits, admin validation, tie/close/reopen and 90-day vote retention.');
}
