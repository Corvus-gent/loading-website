import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {rustSite} from '../helpers/rust-site.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const js=await readFile('compound/cuts.js','utf8');assert.equal((await readFile('rust/browser/src/compound_editor/cut.html','utf8')).trimEnd(),js.match(/this.el.innerHTML=`([\s\S]*?)`;/)[1].replaceAll('${slot}','{{slot}}'),'copied static card template is unchanged');
const video=await readFile('tests/fixtures/rust/compound-video.mp4');
const version={id:'v1',slot:1,iteration:1,label:'<img> a cut',duration:12,uploaded_at:'2026-11-07T12:00:00Z',url:'https://corvus.gent/compound/fixture.mp4',changelog:'A <b>literal</b> change',transitions:[{id:'hook',start:0,end:2,label:'<script>Opening</script>'},{id:'reveal',start:4,end:8,label:'Reveal',type:'transition'}],cues:[{id:'cue-0',t:5,q:'Keep the reveal?',options:['keep','cut']}]};
const second={...version,id:'v2',slot:2,label:'second'};
const fixture={fund:{total:1234,late:123,ready:true,mode:'test',revolut_url:'https://revolut.me/fixture'},cuts:[{slot:1,current:version,history:[version]},{slot:2,current:second,history:[second]},{slot:3,current:null,history:[]}],versions:[version,second],byVersion:{v1:{stats:{'vote:up':4,'vote:down':1,'transition:hook:up':3,'transition:reveal:down':1},heat:{'0:fire':3,'2:bored':2,'4:cut':1}},v2:{stats:{},heat:{}}},standings:{'pick:v1':3,'battle:v2':1},helpers:[{handle:'<b>Gabe</b>',score:11}],livePoll:null};
const feedback=[{id:'q1',chip:'hook',text:'Use <img> as literal text',version:'v1',handle:'<script>visitor</script>'},{id:'q2',chip:'fire',text:'',version:'older',handle:'anonymous soldier'}];
const browser=await chromium.launch(),captures={};
try{for(const engine of ['legacy','rust'])for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:844},locale:'en-US',timezoneId:'Europe/Brussels',reducedMotion:'reduce'});let fail=false;
 const {drain}=await rustSite(ctx,{}, {browserEngine:engine,beforeRequest:async({route,u,request})=>{
  if(u.pathname==='/compound/fixture.mp4'){await route.fulfill({contentType:'video/mp4',body:video});return true;}
  if(u.pathname==='/api/compound'){const data=request.method()==='POST'?{ok:true}:u.searchParams.has('feed')?{feedback}:u.searchParams.has('live')?{poll:null}:fixture;await route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{error:'fixture unavailable'}:data)});return true;}
 }});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-11-09T16:59:58Z')});await p.goto('https://corvus.gent/compound/');await expect(p.locator('#connection')).toContainText('live ·');await expect(p.locator('#feed-notes strong')).toHaveCount(2);await expect(p.locator('[data-unit=seconds]')).not.toHaveText('00');
 const ids=['cuts','cut-tools','fund-total','fund-result','payment-note','helpers','pick-buttons','battle-buttons','standings','feed-notes','quick-chips','feedback-cut'];
 const snapshot=()=>p.evaluate(ids=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id).innerHTML])),ids);
 const results=[await snapshot()];await p.locator('[data-slot="2"]').click();await expect(p.locator('#feedback-cut')).toHaveText('· V2');results.push(await snapshot());await p.locator('[data-slot="3"]').click();await expect(p.locator('#feedback-cut')).toHaveText('· V3 · dropping soon');results.push(await snapshot());
 await p.clock.runFor(3000);await expect(p.locator('#deadline-note')).toHaveText('deadline reached. the edit lives on. keep the feedback coming.');await expect(p.locator('#fund-clock')).toHaveText('deadline passed. the result stays.');
 fail=true;await p.locator('#connection').click();await expect(p.locator('#connection')).toHaveText('connection lost. last counts shown. tap to retry.');results.push(await snapshot());assert.deepEqual(errors,[]);assert.equal(await p.locator('#cuts script,#cut-tools script,#feed-notes img').count(),0);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 captures[engine+width]=results;await mkdir('test-results/rust',{recursive:true});await writeFile('test-results/rust/editor-public-'+engine+'-'+width+'.json',JSON.stringify(results,null,2));if(engine==='rust'){await p.locator('#video-section').scrollIntoViewIfNeeded();await p.screenshot({path:'test-results/rust/original-compound-public-'+width+'.png'});}await drain();await ctx.close();
}for(const width of [390,1440])assert.deepEqual(captures['rust'+width],captures['legacy'+width],width+'px editor markup');console.log('PASS: exact public editor card/tools/feedback/fund/standings DOM at 390px and 1440px, version switching, clocks before/after deadline, XSS-safe text and retained counts after refresh failure.');}finally{await browser.close();}
