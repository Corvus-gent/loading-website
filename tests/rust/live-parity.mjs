import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
// Invoked inside auth-parity's disposable Redis process. No real API, emails or analytics.
export async function liveContracts({urls,client,secret}){
 const endpoint=(engine,params={})=>{const u=new URL(urls[engine]);u.searchParams.set('module','live');for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);return u;};
 const call=async(engine,params,body,extra={})=>{const r=await fetch(endpoint(engine,params),{method:body===undefined?'GET':'POST',redirect:'manual',headers:{origin:'https://corvus.gent','content-type':'application/json','user-agent':'Mozilla/5.0 fixture','x-forwarded-for':'192.0.2.2',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();return{status:r.status,body:text?JSON.parse(text):null,headers:r.headers};};
 const token=()=>{const v=(Date.now()-5000)+'.'+'a'.repeat(24);return v+'.'+createHmac('sha256',secret).update('live-interview:'+v).digest('hex');};
 for(const engine of ['legacy','rust']){
  const status=await call(engine,{});assert.equal(status.status,200);assert.equal(status.body.source,'manual');assert.equal(status.body.live,false);
  const landing=await call(engine,{landing:'1'});assert.equal(landing.body.platforms.twitch,false);assert.equal(landing.body.hackMode.enabled,false);
  const challenge=await call(engine,{form:'interview'});assert.equal(challenge.status,200);assert.match(challenge.body.token,/^\d{13}\.[a-f0-9]{24}\.[a-f0-9]{64}$/);assert.equal(challenge.headers.get('referrer-policy'),'no-referrer');
  assert.equal((await call(engine,{interviews:'1'})).status,401);
  const fields={name:'  Test Builder ',project:'robot\nproject',handle:'@fixture',token:token()};
  assert.equal((await call(engine,{form:'interview'},fields,{origin:'https://evil.example'})).status,403);
  assert.equal((await call(engine,{form:'interview'},{...fields,token:'invalid'})).status,400);
  assert.equal((await call(engine,{form:'interview'},{...fields,website:'spam'})).status,400);
  assert.equal((await call(engine,{form:'interview'},fields,{'content-type':'text/plain'})).status,415);
  assert.equal((await call(engine,{form:'interview'},{...fields,name:'x'.repeat(3000)})).status,413);
 }
 const shared={name:'Race',project:'one project',handle:'@fixture',token:token()};
 const race=await Promise.all(Array.from({length:16},(_,i)=>call(i%2?'rust':'legacy',{form:'interview'},shared)));
 assert.equal(race.filter(r=>r.status===201).length,1);assert.equal(race.filter(r=>r.status===200).length,15);assert.equal(new Set(race.map(r=>r.body.id)).size,1);
 const id=race[0].body.id;const row=JSON.parse(await client.get('live:preview:interviews:record:'+id));assert.equal(row.project,'one project');assert((await client.ttl('live:preview:interviews:record:'+id))>5183900);
 const another={...shared,token:token()};assert.notEqual(shared.token,another.token);
 assert.equal((await call('rust',{form:'interview'},another)).status,429);assert.equal((await call('legacy',{form:'interview'},another)).status,429);
 // The owner can read records created by either runtime; an ordinary staff login cannot.
 const sid='interview-admin';await client.set('sess:'+sid,'gabriel@corvus.gent',{EX:600});const cookie='sess='+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64url');
 const legacy=await call('legacy',{interviews:'1'},undefined,{cookie});const rust=await call('rust',{interviews:'1'},undefined,{cookie});assert.equal(rust.status,200);assert.deepEqual(rust.body,legacy.body);assert.equal(rust.body.interviews.length,1);
 await client.set('sess:'+sid,'other@corvus.gent',{EX:600});assert.equal((await call('rust',{interviews:'1'},undefined,{cookie})).status,401);
 for(const engine of ['legacy','rust'])for(const [slug,location]of Object.entries({twitch:'https://www.twitch.tv/gabe_maxxing',instagram:'https://www.instagram.com/gabe.maxxing',twitter:'https://x.com/gabe_maxxing'})){
  const r=await fetch(endpoint(engine,{slug}),{method:'HEAD',redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),location);
 }
 assert.equal(await client.exists('live:preview:clicks:all'),0,'HEAD must never count');
 assert.equal((await call('rust',{slug:'twitch'})).status,302);assert.equal((await call('legacy',{slug:'twitch'})).status,302);
 // Legacy telemetry uses waitUntil. Poll only this test-owned Redis key.
 for(let i=0;i<20&&await client.hGet('live:preview:clicks:all','twitch')!=='1';i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(await client.hGet('live:preview:clicks:all','twitch'),'1');
 assert.equal((await call('rust',{slug:'//evil.example'})).status,404);
 console.log('PASS: Rust/JS live status, safe redirect parity, shared click dedupe, private interview reads, 16-way single submission, cooldown and retention.');
}
