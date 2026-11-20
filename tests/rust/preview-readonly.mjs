// Explicit preview-only, read-only deployment contract. Never forwards a bypass to another host.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
const origin=new URL(process.argv[2]||'');
assert.equal(origin.protocol,'https:');assert.match(origin.hostname,/^loading-website-[a-z0-9]+-corvus11\.vercel\.app$/);assert.equal(origin.pathname,'/');
const bypass=(await readFile(os.homedir()+'/.secrets/site-preview-bypass.txt','utf8')).trim();
const results=[];
async function request(path,{method='GET',json=false,png=false}={}){const url=new URL(path,origin);assert.equal(url.origin,origin.origin);const r=await fetch(url,{method,headers:{'x-vercel-protection-bypass':bypass},redirect:'manual',signal:AbortSignal.timeout(45000)});const body=method==='HEAD'?'':png?Buffer.from(await r.arrayBuffer()):await r.text();return{status:r.status,location:r.headers.get('location'),data:json?JSON.parse(body):body};}
const info=await request('/api/rust',{json:true});assert.equal(info.status,200);assert.equal(info.data.writeMode,'disabled');assert.equal(info.data.runtime,'rust');
for(const [label,legacy,rust]of[
 ['Original Compound','/api/compound','/api/rust?module=compound'],
 ['Compound','/api/compound-v2','/api/rust?module=compound-v2'],
 ['Impact','/api/compound-v2?impact=1','/api/rust?module=compound-v2&impact=1'],
 ['Legion wall','/api/legion?action=wall','/api/rust?module=legion&action=wall'],
 ['Senate','/api/legion?senate=1','/api/rust?module=legion&senate=1'],
 ['Legion partners','/api/legion?action=partners','/api/rust?module=legion&action=partners'],
]){const[a,b]=await Promise.all([request(legacy,{json:true}),request(rust,{json:true})]);assert.equal(a.status,200,label+' legacy');assert.equal(b.status,200,label+' rust');for(const data of[a.data,b.data]){delete data.updated;delete data.updated_at;delete data.server_time;}assert.deepEqual(b.data,a.data,label+' payload');results.push({label,status:200,parity:true,rows:b.data.posts?.length??b.data.videos?.length??b.data.interviews?.length});console.log('PASS read-only '+label+' JSON parity');}
// The old interview GET schedules photo cleanup. Do not shadow it in a read-only probe.
const interviews=await request('/api/rust?module=compound-v2&interviews=1',{json:true});assert.equal(interviews.status,200);assert(Array.isArray(interviews.data.interviews));results.push({label:'Interviews (Rust only)',status:200,rows:interviews.data.interviews.length});
for(const path of ['/compound/','/compound/v2/','/compound/impact/','/live/','/hack/','/hack/3/','/legion/','/admin/']){const r=await request(path);assert.equal(r.status,200,path);assert.match(r.data,/<html\b/i);results.push({path,status:r.status});console.log('PASS '+path+' 200 HTML');}
for(const path of ['/migration/rust/filosofie.rs','/rust/migration/og-gabe.jpg','/Cargo.toml','/Cargo.lock','/rust/server/impact/handler.rs','/rust/migration/impact-admin.html','/rust/fixtures/auth.json']){const r=await request(path);assert.equal(r.status,404,path);results.push({path,status:r.status});}
for(const path of ['/api/rust?module=compound-v2&short=1&slug=tt-gl-nl-mom1&utm_source=instagram','/api/rust?module=compound-v2&impact=1&go=impact']){const r=await request(path,{method:'HEAD'});assert.equal(r.status,302,path);assert(r.location);results.push({path,status:r.status,location:r.location});}
if(process.argv.includes('--army')){
 const army=await request('/api/rust?module=army&view=public',{json:true});assert.equal(army.status,200);assert(Array.isArray(army.data.leaderboard));assert(Number.isFinite(army.data.soldiers));
 const legion=await request('/api/rust?module=army&view=legion',{json:true});assert.equal(legion.status,200);assert(Array.isArray(legion.data.members));
 const soldier=army.data.leaderboard.find(s=>s.username);
 if(soldier){const path='/api/rust?module=army&profile='+encodeURIComponent(soldier.username);const profile=await request(path+'&html=1');assert.equal(profile.status,200);assert.match(profile.data,/<html/);const image=await request(path+'&image=1',{png:true});assert.equal(image.status,200);assert.deepEqual([image.data.readUInt32BE(16),image.data.readUInt32BE(20)],[1200,630]);}
 results.push({label:'Army native read-only summary/wall/profile/card',status:200,rows:legion.data.members.length});console.log('PASS native Army summary/wall/profile/card with writes disabled');
}
if(process.argv.includes('--og')){
 for(const kind of ['live','hack3','compound','curiositycraft']){const card=await request('/api/rust?module=og&kind='+kind,{png:true});assert.equal(card.status,200,kind);assert.deepEqual([card.data.readUInt32BE(16),card.data.readUInt32BE(20)],[1200,630]);if(kind!=='curiositycraft'){const page=await request('/api/rust?module=og&kind='+kind+'&ogPage=1');assert.equal(page.status,200);assert.match(page.data,/summary_large_image/);}results.push({label:'Native OG '+kind,status:200});}
 console.log('PASS native OG PNG/metadata on deployed Rust runtime');
}
await mkdir('test-results/rust',{recursive:true});await writeFile('test-results/rust/impact-preview-smoke.json',JSON.stringify({origin:origin.origin,checkedAt:new Date().toISOString(),writeMode:'disabled',results},null,2));
console.log('PASS preview parity/critical HTML/private-source boundaries/HEAD redirects. No mutating actions or provider jobs requested; Rust writes disabled.');
