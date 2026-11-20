// Explicit preview-only, read-only deployment contract. Never forwards a bypass to another host.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
const origin=new URL(process.argv[2]||'');
assert.equal(origin.protocol,'https:');assert.match(origin.hostname,/^loading-website-[a-z0-9]+-corvus11\.vercel\.app$/);assert.equal(origin.pathname,'/');
const bypass=(await readFile(os.homedir()+'/.secrets/site-preview-bypass.txt','utf8')).trim();
const results=[];
async function request(path,{method='GET',json=false}={}){const url=new URL(path,origin);assert.equal(url.origin,origin.origin);const r=await fetch(url,{method,headers:{'x-vercel-protection-bypass':bypass},redirect:'manual',signal:AbortSignal.timeout(45000)});const body=method==='HEAD'?'':await r.text();return{status:r.status,location:r.headers.get('location'),data:json?JSON.parse(body):body};}
const info=await request('/api/rust',{json:true});assert.equal(info.status,200);assert.equal(info.data.writeMode,'disabled');assert.equal(info.data.runtime,'rust');
for(const [label,legacy,rust]of[
 ['Compound','/api/compound-v2','/api/rust?module=compound-v2'],
 ['Impact','/api/compound-v2?impact=1','/api/rust?module=compound-v2&impact=1'],
]){const[a,b]=await Promise.all([request(legacy,{json:true}),request(rust,{json:true})]);assert.equal(a.status,200,label+' legacy');assert.equal(b.status,200,label+' rust');for(const data of[a.data,b.data]){delete data.updated_at;delete data.server_time;}assert.deepEqual(b.data,a.data,label+' payload');results.push({label,status:200,parity:true,rows:b.data.posts?.length??b.data.videos?.length??b.data.interviews?.length});console.log('PASS read-only '+label+' JSON parity');}
// The old interview GET schedules photo cleanup. Do not shadow it in a read-only probe.
const interviews=await request('/api/rust?module=compound-v2&interviews=1',{json:true});assert.equal(interviews.status,200);assert(Array.isArray(interviews.data.interviews));results.push({label:'Interviews (Rust only)',status:200,rows:interviews.data.interviews.length});
for(const path of ['/compound/','/compound/v2/','/compound/impact/','/live/','/hack/','/hack/3/','/legion/','/admin/']){const r=await request(path);assert.equal(r.status,200,path);assert.match(r.data,/<html\b/i);results.push({path,status:r.status});console.log('PASS '+path+' 200 HTML');}
for(const path of ['/Cargo.toml','/Cargo.lock','/rust/server/impact/handler.rs','/rust/migration/impact-admin.html','/rust/fixtures/auth.json']){const r=await request(path);assert.equal(r.status,404,path);results.push({path,status:r.status});}
for(const path of ['/api/rust?module=compound-v2&short=1&slug=tt-gl-nl-mom1&utm_source=instagram','/api/rust?module=compound-v2&impact=1&go=impact']){const r=await request(path,{method:'HEAD'});assert.equal(r.status,302,path);assert(r.location);results.push({path,status:r.status,location:r.location});}
await mkdir('test-results/rust',{recursive:true});await writeFile('test-results/rust/impact-preview-smoke.json',JSON.stringify({origin:origin.origin,checkedAt:new Date().toISOString(),writeMode:'disabled',results},null,2));
console.log('PASS preview parity/critical HTML/private-source boundaries/HEAD redirects. No mutating actions or provider jobs requested; Rust writes disabled.');
