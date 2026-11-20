// Old/new snapshot contracts. Provider tasks and storage below are fixture-only.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const source=await readFile('api/_stats-snap.js','utf8');
const executable=source.replace(/^import .*;\n/gm,'').replace(/export default serve;/,'').replace(/export /g,'').replace("await (await import('./_function-errors.js')).recordError('snapshot',page+':'+name)","await recordError('snapshot',page+':'+name)");
const dayOf=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels'}).format(new Date(t));
const fixtures=[];
function legacy(now){class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}return runInNewContext(executable+';({fresh,build,serve,pages,firstDay,ttl});',{Date:FixedDate,randomUUID,brusselsDay:()=>dayOf(now),recordError:async()=>{},setTimeout,clearTimeout,performance:{now:()=>0},getSession:()=>null,waitUntil:()=>{},redis:()=>{throw Error('Unexpected storage')},plaintextExceptionUntil:()=>null},{timeout:1000})}
for(const now of [Date.parse('2026-11-20T11:00Z'),Date.parse('2026-11-20T23:00Z'),Date.parse('2027-03-28T00:30Z'),Date.parse('2027-10-31T01:30Z')]){
 const old=legacy(now),today=dayOf(now),past=dayOf(now-86400000);
 for(const page of old.pages)for(const day of [today,past])for(const delta of [-100,0,14999,15000,59999,60000,899999,900000,1799999,1800000,604800001])for(const final of [true,false])for(const missing of [[],['views']])for(const geoVersion of [5,6]){
  const snapshot={day,data:{geoVersion},checked:new Date(now-delta).toISOString(),final,missing};fixtures.push({action:'fresh',page,day,now,snapshot,expected:Boolean(old.fresh(snapshot,page,day))});
 }
 for(const page of [...old.pages,'unknown','__proto__',''])for(const day of [today,past,'2026-11-01','2026-11-02','2026-02-30','2027-02-29','2028-02-29','2026-13-01','2026-11-99','2026-1-2',"2026-11-20'",'all']){
  const expected=old.pages.includes(page)&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&day>=old.firstDay&&day<=today&&new Date(day+'T12:00Z').toJSON()?.slice(0,10)===day;fixtures.push({action:'valid',page,day,now,expected:Boolean(expected)});
 }
 for(const page of old.pages)for(const snapshot of [null,{}, {day:today}, {day:today,checked:'broken'}, {day:today,checked:new Date(now).toISOString()}, {day:past,final:true,data:{geoVersion:6}}])fixtures.push({action:'fresh',page,day:today,now,snapshot,expected:Boolean(old.fresh(snapshot,page,today))});
 for(const page of old.pages)for(const name of ['countries','feathers','terminal','counters','funnelSF','games'])fixtures.push({action:'shared',page,day:today,now,name,expected:['countries','feathers','terminal','counters'].includes(name)&&page!=='private'?today+':'+name:`stats:snap:${page}:${today}:${name}`});
 // Compare complete and failed-task drafts to the actual legacy builder, with a frozen clock.
 for(const page of ['overview','map','private','x','status'])for(const day of [today,past])for(const mode of ['ready','partial','map-old']){
  const previous={page,day,data:{geoVersion:mode==='map-old'?5:6,old:17,coffee:{n:8},uptime:99,votes:{en:7},unpaid_days:8},dates:{old:'2026-11-02T00:00:00.000Z'},timings:{old:15}},names=['first','second'];
  const updates=[{name:'first',value:{fresh:0},ms:0},{name:'second',value:{more:[1,2]},ms:0,error:mode==='partial'}],memory=new Map([[`stats:snap:${page}:${day}`,JSON.stringify(previous)]]);
  const store=async([op,...a])=>{if(op==='SET'){if(a.includes('NX')&&memory.has(a[0]))return null;memory.set(a[0],a[1]);return'OK'}if(op==='GET')return memory.get(a[0])??null;if(op==='EVAL'){const[script,n,...args]=a,keys=args.splice(0,Number(n));if(script.includes('KEYS[2]')){if(memory.get(keys[0])!==args[0])return 0;memory.set(keys[1],args[1]);return 1}if(script.includes("'DEL'")){if(memory.get(keys[0])===args[0])memory.delete(keys[0]);return 1}return 1}throw Error(op)};
  await old.build(page,day,{store,force:true,makeTasks:()=>Object.fromEntries(updates.map(u=>[u.name,async()=>{if(u.error)throw Error('fixture');return u.value}]))});
  const expected=JSON.parse(memory.get(`stats:snap:${page}:${day}`));fixtures.push({action:'draft',page,day,now,previous,names,updates,expected});
 }
}
const run=spawnSync('target/debug/corvus-contract',[],{input:fixtures.map(({expected,...r})=>JSON.stringify({operation:'stats-snapshot-model',...r})).join('\n')+'\n',encoding:'utf8',maxBuffer:64e6});assert.equal(run.status,0,run.stderr);const actual=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(actual.length,fixtures.length);fixtures.forEach((f,i)=>assert.deepEqual(actual[i],f.expected,JSON.stringify(f).slice(0,1000)));console.log('PASS',fixtures.length,'snapshot freshness/TTL/calendar/DST, source sharing/privacy keys, partial/history retention and map-version contracts');
