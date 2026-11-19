import assert from 'node:assert/strict';
import { armyService } from '../api/_army/_service.js';
import { createArmyHandler } from '../api/army.js';
const rows=Array.from({length:45},(_,i)=>({id:'member-'+String(i).padStart(2,'0'),username:'member'+i,email:'member'+i+'@example.test',created:'2026-11-19T12:00:00Z',verifiedAt:'2026-11-19T12:00:00Z',status:'member',country:'BE'}));
rows.push({id:'subscriber',email:'subscriber@example.test',created:'2026-11-19T13:00:00Z',status:'subscriber'});
rows.push({id:'waiting',username:'waiting',email:'waiting@example.test',created:'2026-11-19T13:00:00Z',applied:'2026-11-19T14:00:00Z',status:'waiting'});
rows.push({id:'visitor',created:'2026-11-19T13:00:00Z',status:'anonymous'});
const store={all:async()=>rows,get:async()=>null,run:async()=>[],key:k=>k,now:()=>Date.now()};
const service=armyService({store});
const first=await service.adminList();assert.equal(first.total,47);assert.equal(first.rows.length,40);assert(first.rows.every(r=>r.created));assert(first.rows.some(r=>r.status==='member'&&r.email));
const second=await service.adminList({offset:40});assert.equal(second.rows.length,7);assert.equal(new Set([...first.rows,...second.rows].map(r=>r.id)).size,47);
assert.equal((await service.adminList({status:'member'})).total,45);
assert.equal((await service.adminList({search:'member44@example.test'})).rows[0].username,'member44');
assert.equal((await service.adminList({status:'subscriber'})).rows[0].applied,null);
const response=()=>({setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
for(const email of [null,'other@corvus.gent']){const res=response();await createArmyHandler({service,ready:()=>true,ownerSession:async()=>email?{email}:null})({method:'GET',query:{admin:'1'},headers:{}},res);assert.equal(res.code,403);}
const res=response();await createArmyHandler({service,ready:()=>true,ownerSession:async()=>({email:'gabriel@corvus.gent'})})({method:'GET',query:{admin:'1',offset:'40'},headers:{}},res);assert.equal(res.code,200);assert.equal(res.body.rows.length,7);
console.log('PASS: ordinary members, subscribers, pagination, search/filter and Gabriel-only private access.');
