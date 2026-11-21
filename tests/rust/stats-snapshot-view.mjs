import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const raw=await readFile('api/_stats-snap.js','utf8');
const source=raw.replace(/^import .*;\n/gm,'').replace(/export default serve;/,'').replace(/export /g,'').replace("const { recover } = await import('./_stats-recovery.js');","const recover = recoverFixture;");
const now=Date.parse('2026-11-20T11:00:00Z'),today='2026-11-20',past='2026-11-19';
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
const pages=['overview','army','pidgy','games','map','music','hunt','x','coffee','private','status'],fixtures=[];
async function legacy(f){
 let recovering=false,refreshing=false,storageFailed=false;
 const scope=runInNewContext(source+';({serve});',{Date:FixedDate,randomUUID,brusselsDay:()=>today,setTimeout,clearTimeout,performance,plaintextExceptionUntil:()=>null,getSession:()=>{},waitUntil:()=>{},redis:()=>{},recoverFixture:async()=>{recovering=true;return{data:null}}},{timeout:1000});
 const query={page:f.page,day:f.day,...(f.part!==undefined?{part:f.part}:{})};
 const req={method:'GET',query};
 function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(body){this.body=body;return body}}}
 const options={store:async()=>{if(storageFailed)throw Error('storage');return [f.snapshot?JSON.stringify(f.snapshot):null,null,f.lease??null]},session:async()=>{if(f.authFailed)throw Error('auth storage');return f.email?{email:f.email}:null},enqueue:()=>{},refresh:async()=>{refreshing=true}};
 if(f.storageFailed&&f.snapshot){await scope.serve(req,response(),options);refreshing=false;}
 storageFailed=Boolean(f.storageFailed);const res=response();await scope.serve(req,res,options);
 return JSON.parse(JSON.stringify({status:res.code,cache:res.headers['Cache-Control'],body:recovering?null:res.body,refresh:refreshing,recover:recovering}));
}
const payload={visitors:30,geoVersion:6,army:[['Gabriel',5]],outbound:{hosts:[['pidgy-ai.com',3]]},funnel:{opens:5},links:[['/public',3]],calls:[],pages:[['/hack',8]],funnelSF:{private:42},extraSecret:'never expose wholesale'};
for(const page of pages)for(const day of[today,past])for(const state of ['absent','ready','stale','partial','final','old-map'])for(const lease of [undefined,'retry','worker'])for(const storageFailed of [false,true])for(const email of page==='private'?[undefined,'reader@example.test','GABRIEL@CORVUS.GENT']:[undefined]){
 const snapshot=state==='absent'?null:{page,day,data:{...payload,geoVersion:state==='old-map'?5:6},dates:{visitors:'2026-11-19T09:00:00Z'},timings:{visitors:2},missing:state==='partial'?['visitors']:[],checked:new Date(now-(state==='stale'?2000000:1000)).toISOString(),updated:'2026-11-19T09:00:00Z',state:state==='partial'?'partial':'ready',final:state==='final'};
 const f={action:'view',page,day,now,snapshot,lease,storageFailed,email};f.expected=await legacy(f);fixtures.push(f);
}
for(const email of ['reader@example.test','gabriel@corvus.gent'])for(const part of [undefined,'army','outbound','calls','funnelSF','extraSecret','bad','']){
 const f={action:'view',page:'private',day:today,now,email,part,snapshot:{page:'private',day:today,data:payload,checked:new Date(now).toISOString(),state:'ready',dates:{private:'hidden'}}};f.expected=await legacy(f);fixtures.push(f);
}
for(const authFailed of [true,false])for(const day of[today,'2026-11-01','2026-02-30','2026-11-21']){const f={action:'view',page:'private',day,now,authFailed,snapshot:{page:'private',day,data:payload}};f.expected=await legacy(f);fixtures.push(f)}
const run=spawnSync('target/debug/corvus-contract',[],{input:fixtures.map(({expected,...f})=>JSON.stringify({operation:'stats-snapshot-model',...f})).join('\n')+'\n',encoding:'utf8',maxBuffer:64e6});assert.equal(run.status,0,run.stderr);const actual=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(actual.length,fixtures.length);fixtures.forEach((f,i)=>assert.deepEqual(actual[i],f.expected,JSON.stringify(f).slice(0,1600)));console.log('PASS',fixtures.length,'snapshot presentation decisions: owner-only projections, private login/storage boundaries, cache headers, dates redaction, partial/history/stale states and refresh/recovery selection');
