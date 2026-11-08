import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {PLETHORA_PLACEMENTS} from '../../js/plethora-config.js';
const base=process.env.PLETHORA_TEST_URL;if(!base)throw Error('Provide deployment URL');
const cookie=process.env.PLETHORA_TEST_COOKIES?fs.readFileSync(process.env.PLETHORA_TEST_COOKIES,'utf8').split('\n').filter(l=>l.includes('\t')).map(l=>{const f=l.replace(/^#HttpOnly_/,'').split('\t');return f[5]+'='+f[6];}).join('; '):'';
const env=fs.readFileSync(path.join(os.homedir(),'.secrets/corvus-plethora.env'),'utf8');const key=env.match(/^PLETHORA_ADMIN_KEY=(.+)$/m)?.[1].trim();if(!key)throw Error('Missing private key');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const get=(route,extra={})=>fetch(base+route,{redirect:'manual',...extra,headers:{Cookie:cookie,'User-Agent':ua,...extra.headers}});
const admin=async()=>{const r=await get('/api/plethora?action=admin',{headers:{Authorization:'Bearer '+key}});assert.equal(r.status,200);return r.json();};
let r=await get('/api/plethora');assert.equal(r.status,200);const config=await r.json();assert.equal(config.ready,true);assert.equal(config.referralCode,'');assert.equal(config.pt,'');
assert.equal((await get('/api/plethora?action=admin')).status,401);
const before=await admin();assert.equal(before.rows.length,Object.keys(PLETHORA_PLACEMENTS).length);
for(const id of Object.keys(PLETHORA_PLACEMENTS)){r=await get('/go/plethora-'+id,{method:'HEAD'});assert.equal(r.status,302,id);const u=new URL(r.headers.get('location'));assert.equal(u.hostname,'apps.apple.com');assert.equal(u.searchParams.get('ct'),'corvus-'+id);assert.ok(!u.searchParams.has('ref')&&!u.searchParams.has('pt'));}
for(const agent of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Mozilla/5.0 (Linux; Android 15)']){r=await get('/go/plethora-hub',{method:'HEAD',headers:{'User-Agent':agent}});assert.equal(r.status,302);assert.equal(new URL(r.headers.get('location'),base).pathname.replace(/\/$/,''),'/plethora');assert.equal(new URL(r.headers.get('location'),base).searchParams.get('from'),'hub');}
assert.equal((await get('/go/plethora-unknown',{method:'HEAD'})).status,404);assert.equal((await admin()).total,before.total,'HEAD must not change counts');
// Real redirects/deduplication only in the isolated preview namespace.
if(new URL(base).hostname.endsWith('.vercel.app')){
 for(const id of Object.keys(PLETHORA_PLACEMENTS)){const responses=await Promise.all([get('/go/plethora-'+id),get('/go/plethora-'+id)]);assert.ok(responses.every(r=>r.status===302));}
 const after=await admin();for(const row of after.rows){const previous=before.rows.find(r=>r.id===row.id);assert.ok(row.total-previous.total>=0&&row.total-previous.total<=1,'dedupe '+row.id);assert.ok(row.last24h>=1);}
 console.log('Preview real Redis: '+after.total+' aggregate clicks; all placement rows, duplicate clicks suppressed.');
}
for(const route of ['/plethora/','/plethora/admin/','/games/','/games/hub/','/hack/','/hack/2/','/hack2','/hack/play/','/hack/play/do-bronx','/battle/','/legion/']){const response=await get(route);if([307,308].includes(response.status)){const next=await get(new URL(response.headers.get('location'),base).pathname);assert.equal(next.status,200,route);}else assert.equal(response.status,200,route);}
console.log('Deployed checks PASS: all iOS targets, Android/desktop QR, no placeholder values, private auth, all pages/aliases.');
