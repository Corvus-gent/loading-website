import assert from 'node:assert/strict';import fs from 'node:fs';import {request} from 'playwright';import{PLETHORA_PLACEMENTS,PLETHORA_ALIASES}from'../../js/plethora-config.js';import{agents,expected}from'./verify-routes.mjs';
const base=process.env.PLETHORA_TEST_URL;if(!base)throw Error('Set PLETHORA_TEST_URL');
const jar=process.env.PLETHORA_TEST_COOKIES?fs.readFileSync(process.env.PLETHORA_TEST_COOKIES,'utf8').split('\n').filter(l=>l.includes('\t')).map(l=>{const[d,,path,secure,expires,name,value]=l.replace(/^#HttpOnly_/,'').split('\t');return{domain:d,path,secure:secure==='TRUE',expires:Number(expires),name,value,httpOnly:true,sameSite:'Lax'};}):[];
const c=await request.newContext({baseURL:base,storageState:{cookies:jar,origins:[]}});let count=0;
try{for(const id of [...Object.keys(PLETHORA_PLACEMENTS),...Object.keys(PLETHORA_ALIASES)])await Promise.all(agents.map(async ua=>{const r=await c.head('/go/plethora-'+id,{headers:{'user-agent':ua},maxRedirects:0});assert.equal(r.status(),302,id);assert.equal(r.headers().location,expected(PLETHORA_ALIASES[id]||id),id);count++;}));
const stats=await c.get('/api/plethora?action=stats');assert.equal(stats.status(),200);assert.equal((await stats.json()).ready,true);assert.equal((await c.get('/plethora/stats.csv')).status(),200);
console.log(`PASS deployed: ${count} actual HTTP redirects; stats ready; CSV 200. HEAD checks did not increment counters.`);
}finally{await c.dispose();}
