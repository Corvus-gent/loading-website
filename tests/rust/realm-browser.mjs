import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {rustSite} from '../helpers/rust-site.mjs';
const origin='https://corvus.gent',screens='test-results/rust';await mkdir(screens,{recursive:true});
const browser=await chromium.launch(),snapshots={};
try {for(const width of[390,1440])for(const engine of['legacy','rust']){
 let identity=false,failSync=false,armyReads=0,posts=[],serverSpots=[];
 const ctx=await browser.newContext({viewport:{width,height:844},locale:'en-US',reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
 await ctx.addInitScript(()=>{Math.random=()=>0.34;window.posthog={capture:(...v)=>(window.fixtureEvents??=[]).push(v)};});
 const fixture=await rustSite(ctx,{}, {browserEngine:engine,beforeRequest:async({route,u,request})=>{
 if(u.pathname==='/api/army'){if(request.method()==='GET'){armyReads++;await route.fulfill({contentType:'application/json',body:JSON.stringify({self:identity?{featherSpots:serverSpots}:null,members:[]})});}else{const data=request.postDataJSON();posts.push(data);assert(['challenge','feather'].includes(data.action),'must never enroll visitor');if(data.action==='challenge')await route.fulfill({contentType:'application/json',body:JSON.stringify({challenge:{salt:'fixture',bits:0,id:'fixture-challenge',notBefore:0}})});else{assert.equal(data.nonce,0);assert.equal(data.challenge,'fixture-challenge');if(!failSync&&!serverSpots.includes(data.spot))serverSpots.push(data.spot);await route.fulfill({status:failSync?503:200,contentType:'application/json',body:JSON.stringify(failSync?{error:'resting'}:{self:{featherSpots:serverSpots}})});}}return true;}
 if(u.pathname==='/api/legion'){await route.fulfill({contentType:'application/json',body:'{"profiles":[]}'});return true;}
 if(u.pathname==='/api/compound-v2'){await route.fulfill({contentType:'application/json',body:'{"videos":[]}'});return true;}
 if(u.pathname==='/location.json'){await route.fulfill({contentType:'application/json',body:'{"city":"San Francisco <script>literal</script>"}'});return true;}
 }});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-11-10T12:00:00Z')});
 await p.goto(origin+'/realm/');await expect(p.locator('.night-scene')).toHaveClass(/awake/);await expect.poll(()=>armyReads).toBeGreaterThan(0);await expect(p.locator('.night-crow')).toBeHidden();await expect(p.locator('#sf-realm')).toBeVisible();assert.equal(posts.length,0);
 await p.locator('.night-door').click();await expect(p.locator('.term input')).toBeFocused();await expect(p.locator('.term-no.show')).toHaveCount(0);await p.clock.runFor(2100);await expect(p.locator('.term-no.show')).toHaveCount(1);await p.clock.runFor(2000);await expect(p.locator('.term-no.show')).toHaveCount(2);
 for(const command of ['help','whoami','live','ls','location','diogenes','lantern','pay','pidgy','coo','sudo hire gabe','sudo rm','unknown <script>','cd secret']){await p.locator('.term input').fill(command);await p.locator('.term input').press('Enter');if(command==='location')await expect(p.locator('.term-out')).toContainText('currently in: San Francisco <script>literal</script>');}
 assert.equal(await p.locator('.term-out script').count(),0);const snapshot=await p.locator('.term-out').innerHTML();if(engine==='legacy')snapshots[width]=snapshot;else assert.equal(snapshot,snapshots[width]);
 await p.locator('.term input').fill('clear');await p.locator('.term input').press('Enter');await expect(p.locator('.term-out')).toBeEmpty();await p.keyboard.press('Escape');await expect(p.locator('.term')).toBeHidden();
 await p.locator('.night-scene nav a').first().focus();await p.keyboard.press('h');await expect(p.locator('.term input')).toHaveValue('h');await p.keyboard.press('Escape');await p.locator('h1').click();await p.keyboard.press('/');await expect(p.locator('.site-search')).toBeVisible();await p.keyboard.press('Escape');
 await p.clock.runFor(31000);await expect(p.locator('.night-crow')).toBeVisible();await p.locator('.night-crow').click();await expect(p.locator('#egg-toast')).toContainText('1/7 feathers found');assert.equal(posts.length,0);await p.locator('.night-crow').click();await expect(p.locator('#egg-toast')).toContainText('already caught · 1/7');
 await p.locator('[href="#realm-share"]').click();await p.locator('[data-share=site]').click();await expect(p.locator('#realm-share-message')).toHaveText('link copied');assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),origin+'/self');await p.keyboard.press('Escape');
 await p.screenshot({path:`${screens}/realm-${engine}-${width}.png`,fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const oldWhisper=await p.locator('.night-whisper').textContent();identity=true;failSync=true;await p.reload();await expect(p.locator('.night-scene')).toHaveClass(/awake/);await expect.poll(()=>posts.filter(x=>x.action==='feather').length).toBe(1);assert.notEqual(await p.locator('.night-whisper').textContent(),oldWhisper);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('feathers')).value),['/']);assert.equal(serverSpots.length,0);
 failSync=false;await p.reload();await expect.poll(()=>serverSpots).toEqual(['/']);assert.equal(posts.filter(x=>x.action==='feather').length,2);
 // Legacy date-bound SF door and reduced motion are preserved.
 await p.clock.setFixedTime(new Date('2026-11-16T08:00:00Z'));await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(p.locator('#sf-realm')).toBeHidden();
 await p.goto(origin+'/now/');await expect(p.locator('#hidden-feather')).toBeVisible();await p.locator('#hidden-feather').click();await expect(p.locator('#hidden-feather')).toHaveClass('feather-caught');await expect.poll(()=>serverSpots).toEqual(['/','/now/']);await p.locator('.peek').click({position:{x:30,y:20}});await expect(p.locator('#egg-toast')).toContainText('Pidgy remembers');
 assert.deepEqual(errors,[],engine+' '+width);await fixture.drain();await ctx.close();console.log('PASS',engine,width,'terminal, keyboard/dialog guards, realm motion/share/date, local feathers, identity-only sync and outage retry');
 }}finally{await browser.close();}
