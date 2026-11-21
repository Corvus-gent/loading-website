import assert from 'node:assert/strict';
import {PLETHORA_PLACEMENTS,officialURL} from '../../js/plethora-config.js';
export async function plethoraContracts({urls,client,secret}){
 const {ptDay}=await import('../../api/_plethora.js');
 const p='plethora:preview:v1',snapshotPrefix='stats:plethora:preview';
 const endpoint=(engine,params={})=>{const u=new URL(urls[engine]);u.searchParams.set('module','plethora');for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);return u;};
 const call=async(engine,params={},headers={},method='GET')=>{const r=await fetch(endpoint(engine,params),{redirect:'manual',method,headers:{'user-agent':'Mozilla iPhone','x-forwarded-for':'198.51.100.2','x-vercel-ip-country':'BE',...headers}});const text=await r.text();return{status:r.status,body:text?(r.headers.get('content-type')?.includes('json')?JSON.parse(text):text):null,headers:r.headers};};
 const strip=d=>{const {updated,...rest}=d;return rest;};
 await client.hSet(p+':clicks',{bio:'7'});
 const before=await call('rust',{action:'stats'});assert.equal(before.status,200);assert.equal(before.body.ready,true);assert.equal(before.body.total,7);assert.deepEqual(strip(before.body),strip((await call('legacy',{action:'stats'})).body));
 const ids=Object.keys(PLETHORA_PLACEMENTS);
 for(const id of [...ids,'bio'])for(const ua of ['iPhone','Android','desktop']){
  const r=await call('rust',{slug:'plethora-'+id},{'user-agent':ua},'HEAD');assert.equal(r.status,302);assert.equal(r.headers.get('location'),officialURL(id));
 }
 assert.equal((await call('rust',{action:'stats'})).body.total,7,'HEAD never increments');
 for(let i=0;i<ids.length;i++){
  const r=await call(i%2?'rust':'legacy',{slug:ids[i]});assert.equal(r.status,302);
  await call(i%2?'legacy':'rust',{slug:ids[i]});
 }
 let rust=(await call('rust',{action:'stats'})).body;let legacy=(await call('legacy',{action:'stats'})).body;assert.deepEqual(strip(rust),strip(legacy));
 assert.equal(rust.total,ids.length+7);assert.equal(rust.raw,ids.length*2);assert.equal(rust.platforms.unknown,7);assert.equal(rust.destinations.ossman,9);assert.equal(rust.rows.length,ids.length);
 await call('rust',{slug:'bio'});assert.equal((await call('rust',{action:'stats'})).body.rows.find(r=>r.id==='plethora-bio-x').total,8);
 await Promise.all(Array.from({length:20},(_,i)=>call(i%2?'legacy':'rust',{slug:'home'},{'user-agent':'Mozilla Android','x-forwarded-for':'198.51.100.3'})));
 for(const engine of ['legacy','rust'])for(const ua of ['Googlebot','Twitterbot','facebookexternalhit','WhatsApp','curl','HeadlessChrome'])await call(engine,{slug:'home'},{'user-agent':ua});
 rust=(await call('rust',{action:'stats'})).body;legacy=(await call('legacy',{action:'stats'})).body;assert.deepEqual(strip(rust),strip(legacy));assert.equal(rust.total,ids.length+8);assert.equal(rust.raw,ids.length*2+21);
 const utcDay=new Date().toISOString().slice(0,10);const events=(await client.zRange(p+':events:'+utcDay,0,-1)).map(JSON.parse);assert(events.length>0);assert(events.every(e=>e.country==='BE'&&!JSON.stringify(e).includes('198.51.100')&&!('ip'in e)));
 for(const key of await client.keys(p+':dedupe:*')){const ttl=await client.ttl(key);assert(ttl>0&&ttl<=1800);}
 for(const engine of ['legacy','rust']){assert.equal((await call(engine,{action:'admin'})).status,401);assert.equal((await call(engine,{action:'snapshot',catchup:'1'})).status,401);}
 const privateHeaders={authorization:'Bearer '+secret};assert.equal((await call('rust',{action:'admin'},privateHeaders)).status,200);
 const day=ptDay(Date.now()-86400000);await client.set(p+':official-start',String(Date.now()-86400000));await client.hSet(p+':ptday:'+day,{'u|home|download|desktop|BE':'3','r|home|download|desktop|BE':'5'});await client.zAdd(p+':ptdays',{score:Date.parse(day+'T00:00:00Z'),value:day});await client.hSet(p+':day:'+utcDay,{bio:'4'});
 const snap=await call('rust',{action:'snapshot',catchup:'1'},privateHeaders);assert.equal(snap.status,200);assert.equal(snap.body.saved,1);assert.equal(snap.body.legacyArchived,1);const saved=JSON.parse(await client.get(snapshotPrefix+':'+day));assert.equal(saved.total,3);assert.equal(saved.raw,5);assert.equal(await client.ttl(snapshotPrefix+':'+day),-1);
 const again=await call('legacy',{action:'snapshot',catchup:'1'},privateHeaders);assert.deepEqual(again.body,snap.body);const savedAgain=JSON.parse(await client.get(snapshotPrefix+':'+day));assert.equal(savedAgain.total,saved.total);assert.deepEqual(savedAgain.rows,saved.rows);
 assert.equal((await call('rust',{action:'csv'})).body,(await call('legacy',{action:'csv'})).body);
 rust=(await call('rust',{action:'stats'})).body;legacy=(await call('legacy',{action:'stats'})).body;assert.deepEqual(strip(rust),strip(legacy));
 console.log('PASS: all Plethora URLs × 3 devices; old totals, aliases, raw/deduped concurrency, platform/category/destination sums, bot/HEAD exclusions, private auth, CSV and durable snapshots match JS.');
}
