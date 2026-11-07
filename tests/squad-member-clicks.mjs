import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {privacyEvent} from '../js/analytics-policy.js';

const hashes=new Map([['hack:totals',new Map([['view',37]])]]),commands=[];
async function redis(c){
 commands.push(c);
 if(c[0]==='HGETALL')return [...(hashes.get(c[1])||new Map()).entries()].flat();
 if(c[0]==='HINCRBY'){if(!hashes.has(c[1]))hashes.set(c[1],new Map());const h=hashes.get(c[1]),n=(h.get(c[2])||0)+Number(c[3]);h.set(c[2],n);return n;}
 if(c[0]==='ZREVRANGE')return [];
 throw Error('Unexpected command '+c[0]);
}
let allowed=true;
const context=vm.createContext({process:{env:{NODE_ENV:'test'}}});
const deps={
 'node:crypto':{default:{}},
 './_redis.js':{redis,pipeline:cs=>Promise.all(cs.map(redis))},
 './_privacy.js':{dailyIPHash:()=> 'test-daily-hash',rateLimit:async(key,max,ttl)=>{assert.equal(ttl,60);return allowed;}},
 './_session.js':{getSession:async()=>null}
};
const handler=new vm.SourceTextModule(await fs.readFile('api/_hack.js','utf8'),{context});
await handler.link(name=>new vm.SyntheticModule(Object.keys(deps[name]),function(){for(const[k,v]of Object.entries(deps[name]))this.setExport(k,v);},{context}));await handler.evaluate();
async function request(body,method='POST',origin='https://corvus.gent'){
 const result={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
 await handler.namespace.default({method,query:{},headers:{origin,'content-type':'application/json'},body},result);return result;
}
for(const member of ['gabe','siebe','paloma'])assert.equal((await request({action:'squad_member',member,hack_id:1,source:'linkedin'})).code,200);
let r=await request(null,'GET');assert.equal(r.body.totals.view,37);assert.equal(r.body.members['1:gabe'],1);assert.equal(r.body.members['1:siebe'],1);assert.equal(r.body.members['1:paloma'],1);assert.equal(r.body.sources['linkedin:squad_member'],3);
for(const body of [{member:'private@example.test',hack_id:1},{member:'paloma',hack_id:2},{member:'gabe',hack_id:99999}])assert.equal((await request({action:'squad_member',...body})).code,400);
assert.equal((await request({action:'squad_member',member:'gabe',hack_id:1},'POST','https://untrusted.example')).code,403);
allowed=false;assert.equal((await request({action:'squad_member',member:'gabe',hack_id:1})).code,429);
assert.equal(hashes.get('hack:members').get('1:gabe'),1);
const event=privacyEvent({event:'squad_member_click',properties:{$cookieless_mode:true,member:'paloma',hack_id:1,email:'secret@example.test'}});
assert.equal(event.properties.member,'paloma');assert.equal(event.properties.hack_id,1);assert.equal(event.properties.email,undefined);
assert(!JSON.stringify(commands).includes('private@example.test'));
console.log('Member clicks: aggregate increments, existing counts preserved, origin/member/rate validation and privacy allowlist passed.');
