import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {runInNewContext} from 'node:vm';import {spawnSync} from 'node:child_process';
let batch=[],commands=[];const source=(await readFile('api/_health-history.js','utf8')).replace(/^import .*;\n/gm,'').replace('export default async function','async function').replace(/export /g,'');
const old=runInNewContext(source+';({state,emptyHistory,writeCommand,history,incidentList,names});',{Date,Intl,Math,redis:()=>{throw Error('No Redis in model')},pipeline:async c=>{commands=c;return batch},waitUntil:()=>{},plaintextExceptionUntil:()=>null},{timeout:1000});const fixtures=[];const clean=v=>JSON.parse(JSON.stringify(v));const H=3600000,D=24*H,S=300000;
const states=[null,{},...['ok','skipped','ms'].flatMap(key=>[null,false,true,0,1,1499,1500,1500.5,'1700','bad'].map(value=>({ok:true,ms:30,[key]:value})))];
for(const value of states)fixtures.push({action:'state',now:0,value,expected:old.state(value)});
for(const now of [Date.parse('2026-11-20T12:34:56.789Z'),Date.parse('2026-03-29T00:30Z'),Date.parse('2026-03-29T01:30Z'),Date.parse('2026-10-25T00:30Z'),Date.parse('2026-10-25T01:30Z'),Date.parse('2026-11-20T23:00Z')]){
 for(const range of ['24h','7d','30d']){
  const empty=clean(old.emptyHistory(range,now));fixtures.push({action:'empty',range,now,expected:empty});
  const hour=Math.floor(now/H)*H,count=range==='24h'?24:(range==='7d'?7:30)*24+1;
  for(const filled of [false,true]){
   const points=filled?Array.from({length:12},(_,i)=>({at:now-(12-i)*S,cells:{overall:[i%3+1,20+i*300,Number(i%3!==2)],site:[1,30,1],redis:[i%3+1,20+i*300,Number(i%3!==2)]}})):[];
   const bucket=i=>Object.fromEntries(['overall',...old.names].filter((_,j)=>(i+j)%3).map((name,j)=>[name,[12,10,1200+i*4,1500+i,1+i%3,i%2,i%2?now-D:0]]));
   const hourly=Array.from({length:count},(_,i)=>filled&&i%4?JSON.stringify(bucket(i)):null),daily=Array.from({length:90},(_,i)=>filled&&i%3?JSON.stringify(bucket(i)):null);
   const last=filled?{status:'degraded',checked_at:new Date(now-1000).toISOString(),checks:{site:{ok:true,ms:20},redis:{ok:false,ms:75},notion:{skipped:true,ok:null}}}:null;
   batch=[points.map(JSON.stringify),hourly,daily,[JSON.stringify(last),null,null,null]];
   fixtures.push({action:'project',range,now,rows:clean(batch),expected:clean(await old.history(now,range))});fixtures.push({action:'commands',range,now,expected:clean(commands)});
  }
 }
 for(const at of [now,now-2*D,now-120*D])for(const archive of [false,true])for(const monitor of [false,true])for(const variant of [0,1,2,3]){
  const sample={checked_at:new Date(at).toISOString(),status:'degraded',checks:{site:{ok:true,ms:0},redis:states[(variant*7+3)%states.length],posthog:{ok:variant!==2,ms:[0,1499.5,1500,2000][variant]},notion:{skipped:true,ok:null,ms:0},unknown:{ok:false,ms:99}}};fixtures.push({action:'write',now,sample,archive,monitor,expected:clean(old.writeCommand(sample,now,archive,monitor))});
 }
 const first=Math.floor((now-10*S)/S)*S,live={open:{redis:{name:'redis',start:first,last:now,worst:2}},recent:[{name:'site',start:now-S,last:now-S,finish:now,worst:3}]},legacy={open:{redis:{name:'redis',start:first-4*S,last:first-S,worst:3},posthog:{name:'posthog',start:first-5*S,last:first-S,worst:2}},recent:Array.from({length:12},(_,i)=>({name:old.names[i],start:first-(20-i)*S,last:first-(19-i)*S,finish:first-(18-i)*S,worst:2}))};fixtures.push({action:'incidents',now,first,live,legacy,expected:clean(old.incidentList(clean(live),clean(legacy),first))});
}
const run=spawnSync('target/debug/corvus-contract',[],{input:fixtures.map(({expected,...f})=>JSON.stringify({operation:'health-model',...f})).join('\n')+'\n',encoding:'utf8',maxBuffer:64e6});assert.equal(run.status,0,run.stderr);const actual=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(actual.length,fixtures.length);fixtures.forEach((f,i)=>{if(f.action==='write'){for(const index of[11,16,17]){actual[i][index]=JSON.parse(actual[i][index]);f.expected[index]=JSON.parse(f.expected[index]);}}assert.deepEqual(actual[i],f.expected,JSON.stringify({...f,rows:undefined,expected:undefined}).slice(0,1000))});console.log('PASS',fixtures.length,'health state/ingest protocol, Brussels DST calendars, sparse raw/hour/day histories, weighted uptime, spikes and legacy/live incident continuity');
