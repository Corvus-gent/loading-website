import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {rebuildDay} from '../api/_stats-rebuild.js';
const state=new Map(),calls=[],queries=[];const today='2026-11-06';
const snapshot={state:'ready',final:true,checked:'2026-11-05T22:00:00Z',data:{visitors:7,outbound:{hosts:[['pidgy-ai.com',3]]}}};
state.set('stats:snap:overview:2026-11-05',snapshot);
const options={today,tasks:()=>({visitors:()=>{},outbound:()=>{},counters:()=>assert.fail('historic Redis-only counters must not be rebuilt')}),
 refresh:async(page,day,opts)=>{calls.push({page,day,force:opts.force});assert.equal(opts.force,true);assert(!('counters' in opts.makeTasks(page,day)));state.set(`stats:snap:${page}:${day}`,{...snapshot,checked:new Date().toISOString()});},
 query:async sql=>{queries.push(sql);return sql.startsWith('SELECT properties.host')?[['pidgy-ai.com',3]]:sql.startsWith('SELECT countIf')?[[11,'2026-11-05T15:00:00Z']]:[[7,11,3,2,1,3]];},
 store:async cmd=>cmd[0]==='MGET'?cmd.slice(1).map(k=>JSON.stringify(state.get(k))):'OK'};
const result=await rebuildDay('2026-11-05',options);
assert.deepEqual(calls.map(x=>x.page),['overview','hunt']);
assert.equal(result.matches.visitors,true);assert.equal(result.matches.visibleOutbound,true);
assert.equal(result.direct.outboundClicks,3);assert.equal(result.direct.linksClicks,2);
assert.equal(result.historicalRedisCountersReconstructed,false);
assert(queries.every(sql=>sql.includes("Europe/Brussels")&&sql.includes("2026-11-05")));
assert(!JSON.stringify(result).includes('distinct_id'));
for(const day of ['2026-11-07','2026-11-01',"2026-11-05' OR 1=1",['2026-11-05']])await assert.rejects(rebuildDay(day,options),/invalid day/);
const mismatch=await rebuildDay('2026-11-05',{...options,query:async sql=>sql.startsWith('SELECT properties.host')?[['pidgy-ai.com',4]]:[[8,12,4,2,1,4]]});
assert.equal(mismatch.matches.visitors,false);assert.equal(mismatch.matches.visibleOutbound,false);
// Exercise the actual build() branch: final snapshots stay sealed normally,
// while an authenticated operator's force can replace them.
const context=vm.createContext({Date,JSON,Map,Set,Promise,performance,setTimeout,clearTimeout,process:{env:{CRON_SECRET:'fixture'}}});
const dep=(exports)=>new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v);},{context});
const store=async cmd=>{if(cmd[0]==='SET')return 'OK';if(cmd[0]==='GET')return JSON.stringify(snapshot);if(cmd[0]==='EVAL')return 1;};
const module=new vm.SourceTextModule(await readFile(new URL('../api/_stats-snap.js',import.meta.url),'utf8'),{context});
await module.link(name=>name==='node:crypto'?dep({randomUUID:()=> 'fixture'}):name==='@vercel/functions'?dep({waitUntil:()=>{}}):name.includes('_redis')?dep({redis:store,plaintextExceptionUntil:()=>null}):name.includes('_stats-daily')?dep({brusselsDay:()=>today}):dep({getSession:()=>null,safeEqual:(a,b)=>a===b}));
await module.evaluate();let ran=0;const makeTasks=()=>({visitors:async()=>{ran++;return {visitors:9};}});
await module.namespace.build('overview','2026-11-05',{store,makeTasks});assert.equal(ran,0);
await module.namespace.build('overview','2026-11-05',{store,makeTasks,force:true});assert.equal(ran,1);
const response=()=>({status(n){this.code=n;return this;},json(body){this.body=body;return this;},setHeader(){}});
const unauthorized=response();await module.namespace.job({headers:{},query:{day:'2026-11-05'},method:'POST'},unauthorized);assert.equal(unauthorized.code,401);
const wrongMethod=response();await module.namespace.job({headers:{authorization:'Bearer fixture'},query:{day:'2026-11-05'},method:'GET'},wrongMethod);assert.equal(wrongMethod.code,405);
console.log('Rebuild tests passed: final/force regression, auth and method, dates, Brussels queries, independent mismatch detection, no invented historical Redis counters.');
