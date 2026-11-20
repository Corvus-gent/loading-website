// Pure middleware comparison. All CLI analytics requests are intercepted locally.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {inventory} from '../site/link-inventory.mjs';
import middleware from '../../middleware.js';
import {COMPOUND_LINKS} from '../../js/compound-links.js';
import {PLETHORA_PLACEMENTS} from '../../js/plethora-config.js';
const directory=await inventory();
const paths=new Set(directory.routes.map(r=>r.path));
for(const p of ['/','/index.html','/hack2','/hack2/index.html','/hack/the-feed/','/submission','/soldier','/soldier/santobjj/','/links/gabe/','/enlist','/join-the-army-now/a','/sidequest','/squads','/enter','/the-crow','/revived','/coffee-with-gabe','/important-call-gabe-maxxer','/project-cto','/project-cto/','/api/_openrisk','/api/_openrisk/secret.json','/rust/migration/inventory.json','/rust/','/Cargo.lock','/Cargo.toml/','/rust-toolchain.toml','/%72ust//server/lib.rs','/%72ust/file.json','/go/twitch','/go/twitter','/go/instagram','/go/compound-impact','/go/cardneto-demo','/go/roll-li','/go/cx-tt','/c/PT-BJJ-2','/c/ptbjj2','/c/%XX','/v/tt-bjj-pt-bjj2','/unknown','/statstore','/privateanything','/wiki/%63orvus/index.html','//wiki//pidgy/'])paths.add(p);
for(const p of Object.keys(COMPOUND_LINKS))paths.add('/'+p);
for(const p of Object.keys(PLETHORA_PLACEMENTS))paths.add('/go/plethora-'+p);
for(const p of ['','pidgy','games','map','music','hunt','x','coffee','linkedin','status','hack','army','private'])for(const prefix of ['','/stats']){paths.add(prefix+'/'+p);paths.add(prefix+'/'+(p?p+'/':'')+'index.html');}
for(const p of ['/compound/v2','/compound/v2/nl','/compound/v2/nl/mom','/compound/v2/nl/mom/1','/compound/v2/en/demo/2','/compound/v2/zz/mom/1','/compound/v2/nl/nope/1','/live','/hack/3']){paths.add(p);paths.add(p+'/');}
const fixtures=[];let hits=[];const saved=globalThis.fetch;
globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).pathname,'/api/hit');hits.push(JSON.parse(options.body).tool);return new Response('');};
try{
 for(const path of paths)for(const host of ['corvus.gent','stats.corvus.gent','preview.example'])for(const profile of [
  {method:'GET',ua:'Mozilla/5.0',cookie:'',query:''},
  {method:'HEAD',ua:'curl/8.0',cookie:'corvus_realm=1',query:'?lang=fr&utm_source=a+b&code=PT-BJJ-2&layer_zone=Europe%2FBrussels'},
  {method:'POST',ua:'undici',cookie:'x=1; corvus_realm=1',query:'?c='+encodeURIComponent('🥋'.repeat(40))+'&code_missing=1&video=tt-gl-nl-mom1&interview=2'}
 ]){
  const value='https://'+host+path+profile.query;hits=[];let expected;
  try{const r=await middleware(new Request(value,{method:profile.method,headers:{'user-agent':profile.ua,cookie:profile.cookie}}));expected={status:r.status,headers:Object.fromEntries(r.headers),body:await r.text(),hit:hits[0]||null};}catch{expected={error:true};}
  fixtures.push({operation:'routing',value,method:profile.method,ua:profile.ua,cookie:profile.cookie,expected});
 }
}finally{globalThis.fetch=saved;}
const run=spawnSync('target/debug/corvus-contract',[],{input:fixtures.map(({expected,...x})=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',maxBuffer:32*1024*1024});assert.equal(run.status,0,run.stderr);
const results=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(results.length,fixtures.length);fixtures.forEach((f,i)=>assert.deepEqual(results[i],f.expected,`${f.method} ${f.value}`));
writeFileSync('rust/fixtures/routing-contracts.json','[\n'+fixtures.map(x=>JSON.stringify(x)).join(',\n')+'\n]\n');console.log(`PASS: ${fixtures.length} JS/Rust middleware decisions (all catalogue routes, stats host, aliases, gates, UTF-8 queries, private source guards and CLI analytics). No network calls.`);
