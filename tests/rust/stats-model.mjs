import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {dailyTasks,pairs} from '../../api/_stats-daily.js';
import {REAL} from '../../api/_posthog.js';
import {hostCategory,category,GENRES} from '../../js/analytics-policy.js';
const fixtures=[];let rows=[],sql;
const clean=x=>JSON.parse(JSON.stringify(x));
const capture=async query=>{sql=query;return rows;};
const sectionSource=await readFile('api/_stats-sections.js','utf8');
const sectionFactory=runInNewContext(sectionSource.slice(sectionSource.indexOf('export function sectionTasks'),sectionSource.indexOf('export default')).replace(/^export /,'')+';sectionTasks',{hogql:capture,REAL,hostCategory,category,GENRES,Date},{timeout:1000});
const privateSource=await readFile('api/private-stats.js','utf8');
const privateFactory=runInNewContext(privateSource.slice(privateSource.indexOf('export const privateTasks='),privateSource.indexOf('async function compute')).replace(/^export /,'')+';privateTasks',{hogql:capture,REAL},{timeout:1000});
const sets=[[],[[0,0]],[[null,null]],[[12,3,7,4,2,5]],[["12","0","9","3","1","2"]],[[1]],[[false,true]],[[]],[[{},[]]],[["bad","nope"]]];
const counts=[0,1,2,-1,1.25,null,false,true,'','3','0x10','0b11','0o10','bad','9007199254740991',9007199254740992,[],[2],[true],[false],[null],[[]],[[2]],[{}],[1,2],'\ufeff 3 \ufeff','\u0085',' 0 ',{}];
const labels=['US','BE','United States','United Kingdom','HK','?','XX','ZZ','us','Belgium','direct','instagram','tiktok','x','Chrome','Other','Safari','curl','help','live','/hack/3?secret=x','/private/','/links/gabe','/music/','ambient','techno','app.pidgy-ai.com','evil.example',null,{},7];
for(const n of counts)sets.push(labels.map((label,i)=>[label,n]),[['US',n],['BE',3],['US',2],['ZZ',2],['XX',1],['BE',0]]);
for(let size=1;size<=20;size++)sets.push(Array.from({length:size},(_,i)=>[labels[(i*7)%labels.length],counts[(i*3)%counts.length]]));
for(const day of ['2026-11-20','2026-11-04','2026-11-01','2026-03-29','2026-10-25']){
 const families={daily:()=>dailyTasks(day,capture),private:privateFactory,pidgy:()=>sectionFactory('pidgy',day),outbound:()=>sectionFactory('outbound',day),music:()=>sectionFactory('music',day)};
 for(const [group,factory]of Object.entries(families))for(const [name,task]of Object.entries(factory())){
  if(name==='signups')continue;
  for(const input of sets){rows=input;let expected,error=false;try{expected=clean(await task())}catch{error=true}fixtures.push({action:'project',group,name,day,rows:input,expected,error});}
  rows=[[0,0,0,0,0,0]];await task();fixtures.push({action:'query',group,name,day,expected:sql});
 }
}
for(const value of [null,[],['curl','4','python','2'],['__proto__','7','constructor',3,'curl',0,'curl','4'],['a','not-a-number','b',null],['odd','3','ignored']])fixtures.push({action:'pairs',value,expected:clean(pairs(value))});
for(const now of [Date.parse('2026-10-15T12:40:00Z')-1,Date.parse('2026-10-15T12:40:00Z'),Date.parse('2026-11-20T23:59:59Z')])for(const today of [true,false]){
 const data=[null,'0','300',4,['curl','3'],['python','10']];if(today)data.push(['nl','22','en','18']);const expected={cv:{open:Number(data[0]),download:Number(data[1]),openTotal:Number(data[2]),downloadTotal:Number(data[3])},cli:{day:pairs(data[4]),all:pairs(data[5])}};if(today){expected.votes=pairs(data[6]);expected.unpaid_days=Math.floor((now-Date.parse('2026-10-15T12:40:00Z'))/86400000)}fixtures.push({action:'counters',rows:data,now,today,expected});
}
for(const day of ['',"2026-11-20' OR 1=1",'all','2026-1-2'])fixtures.push({action:'query',group:'daily',name:'visitors',day,error:true});
const run=spawnSync('target/debug/corvus-contract',[],{input:fixtures.map(({expected,error,...r})=>JSON.stringify({operation:'stats-model',...r})).join('\n')+'\n',encoding:'utf8',maxBuffer:64e6});assert.equal(run.status,0,run.stderr);const actual=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(actual.length,fixtures.length);fixtures.forEach((f,i)=>{if(f.error)assert(actual[i].error,JSON.stringify(f));else assert.deepEqual(actual[i],f.expected,JSON.stringify(f).slice(0,1200))});console.log('PASS',fixtures.length,'source queries/projections, stable grouping, safe counts, country normalization, raw private tables, section dates, null/zero counters and SQL day boundary');
