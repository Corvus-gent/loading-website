import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const browser=await chromium.launch(),base=process.env.TEST_BASE_URL||'http://127.0.0.1:4188',errors=[];
const self={canManage:true,verified:true,username:'test_builder',code:'test-link',pidgyCode:'corvus-test_builder',pidgyTrials:5,tier:'miles',rank:'tiro',status:'member',serial:12,created:'2026-11-06',points:0,streak:0,best:0,feathers:0,recruits:0,country:'BE',hidden:false};
try{
 const context=await browser.newContext({viewport:{width:360,height:800},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/army*',route=>route.fulfill({json:route.request().url().includes('view=public')?{soldiers:10,atGate:2,recruitedToday:1}:{self}}));
 for(const tier of [null,'tiro','miles','centurio','legatus','senator','consul','imperator']){
  self.tier=tier;await page.goto(base+'/army/access/');await page.locator('#account-settings').waitFor({state:'visible'});
  assert.equal(await page.locator('#account-pidgy-code').textContent(),self.pidgyCode);assert.equal(await page.locator('#account-pidgy-trials').textContent(),'pidgy trials: 5');
  const next=({tiro:'miles',miles:'centurio',centurio:'legatus',legatus:'senator',senator:'consul'})[tier||'tiro'];
  if(next)assert((await page.locator('#account-next-rank').textContent()).startsWith('next supporter tier: '+next+' · '));else assert(!(await page.locator('#account-next-rank').isVisible()));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.locator('#account-pidgy-copy').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),self.pidgyCode);
 self.tier='legatus';await page.goto(base+'/join-the-army-now/');await page.waitForFunction(()=>typeof document.getElementById('toll-door').onclick==='function');await page.locator('#toll-door').click();assert.equal(await page.locator('#toll-next-rank').textContent(),'next supporter tier: senator · crow statue, no shares');assert(await page.locator('[data-army="pidgyDoor"]').isVisible());await page.keyboard.press('Escape');
 for(const lang of ['nl','es','fr','pt','de','zh']){const copy=JSON.parse(await fs.readFile(new URL('../../js/i18n/army.'+lang+'.json',import.meta.url)));await page.goto(base+'/army/access/?lang='+lang);await page.waitForFunction(()=>document.querySelector('#account-pidgy-code')?.textContent==='corvus-test_builder');assert.equal(await page.locator('#account-next-rank').textContent(),copy.nextRank.replace('{tier}','senator').replace('{perk}',copy.tierPerkSenator));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 self.canManage=false;delete self.pidgyCode;delete self.pidgyTrials;await page.goto(base+'/army/access/');await page.locator('#account-forms').waitFor({state:'visible'});assert(!(await page.locator('#account-pidgy').isVisible()));
 assert.deepEqual(errors,[]);console.log('Pidgy browser: private code/copy, seven languages, tier progression, consul cap, toll perks and anonymous hiding passed at 360px.');
}finally{await browser.close();}
