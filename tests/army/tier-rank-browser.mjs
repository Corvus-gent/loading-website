import {chromium,webkit,expect} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4195',self={username:'sam_thooft',rank:'tiro',tier:'consul',points:0,serial:42,code:'fixture',status:'waiting',created:'2026-11-06',feathers:0,featherSpots:[],recruits:0,streak:0,canManage:true,verified:true};
for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']]){
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width:375,height:812},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/soldier/sam_thooft*',async r=>r.fulfill({body:await fs.readFile('soldier/index.html','utf8'),contentType:'text/html'}));
 await page.route('**/api/army*',r=>r.fulfill({json:r.request().url().includes('view=public')?{soldiers:1,atGate:1,recruitedToday:0,recruits:0,approved:0,leaderboard:[self],recruiters:[self],ranks:{tiro:1},tiers:{consul:1,imperator:1}}:{self,soldier:self,code:self.code,members:[self]}}));
 const pair=async(selector,copy)=>{const root=page.locator(selector);await expect(root.locator('.is-rank b')).toHaveText('tiro');await expect(root.locator('.is-rank>span')).toHaveText(copy.rankLabel);await expect(root.locator('.is-tier b')).toHaveText('consul');await expect(root.locator('.is-tier>span')).toHaveText(copy.tierLabel);};
 try{
  for(const lang of ['en','nl','fr','es','pt','de','zh']){
   const copy=JSON.parse(await fs.readFile('js/i18n/army.'+lang+'.json','utf8'));
   await page.goto(base+'/soldier/sam_thooft?lang='+lang);await pair('#soldier-ranks',copy);await expect(page.locator('#soldier-tag svg')).toContainText(copy.rankLabel+' tiro');await expect(page.locator('#soldier-tag svg')).toContainText(copy.tierLabel+' consul');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.goto(base+'/join-the-army-now/?lang='+lang);await expect(page.locator('#ceremony')).toBeVisible();await pair('#ceremony-ranks',copy);await expect(page.locator('#rank-ladder span').first()).toContainText(copy.rankLabel+' tiro');
   await page.locator('#toll-door').click();await pair('#toll-ranks',copy);await expect(page.locator('#toll-dialog [data-army="tierWhy"]')).toHaveText(copy.tierWhy);await page.locator('#toll-dialog [data-close]').click();
   await page.locator('#stripes-door').click();await pair('#stripes-ranks',copy);await expect(page.locator('#stripes-dialog [data-army="rankWhy"]')).toHaveText(copy.rankWhy);await page.locator('#stripes-dialog [data-close]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  const copy=JSON.parse(await fs.readFile('js/i18n/army.en.json','utf8'));
  await page.goto(base+'/army/?lang=en');await pair('#war-leaderboard .rank-badges',copy);await pair('#war-recruiters .rank-badges',copy);await expect(page.locator('#war-ranks')).toContainText('rank tiro');await expect(page.locator('#war-tiers')).toContainText('supporter consul');await expect(page.locator('#war-tiers')).not.toContainText('imperator');
  await page.evaluate(async()=>{const {rankMoment}=await import('/js/army/client.js?v=20261106-ranks1');await rankMoment('tiro',{rank:'miles',tier:'consul',points:30});});await expect(page.locator('.army-rank-toast .is-rank b')).toHaveText('miles');await expect(page.locator('.army-rank-toast .is-tier b')).toHaveText('consul');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.route('**/js/stats-data.js*',r=>r.fulfill({contentType:'application/javascript',body:"window.statsPage={today:'2026-11-06',watch:(page,day,cb)=>cb({data:{visitors:10,soldiers:{day:2,all:20},unseen:{day:3}}})};"}));
  await page.goto(base+'/stats/army/?lang=en');await expect(page.locator('#section-output')).toContainText(copy.statsArmyNote);await expect(page.locator('#section-output h2')).toHaveText('13 visitors today');
  await page.goto(base+'/soldier/sam_thooft?lang=en');await pair('#soldier-ranks',copy);await page.screenshot({path:'tests/results/tier-rank-profile-'+name+'.png',fullPage:true});
  await page.goto(base+'/join-the-army-now/?lang=en');await pair('#ceremony-ranks',copy);await page.locator('#ceremony').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/results/tier-rank-ceremony-'+name+'.png'});assert.deepEqual(errors,[]);console.log(name+': 7 locales, profile/art, ceremony, ladder, toll/stripes, war boards and rank toast: separate badges at 375px; no JS errors.');
 }finally{await browser.close();}
}
