import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4195';
for(const [engine,name]of [[chromium,'chromium'],[webkit,'webkit']]){
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width:375,height:812},reducedMotion:'reduce'}),errors=[];let self=null;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/army*',async route=>{
  const req=route.request(),body=req.method()==='POST'?req.postDataJSON():{};
  if(body.action==='challenge')return route.fulfill({json:{challenge:{id:'test-proof',salt:'fixture',bits:0,notBefore:0}}});
  if(body.action==='enlist')self={username:body.username,rank:'tiro',tier:'consul',code:'fixture',serial:42,points:0,status:'unconfirmed',created:'2026-11-06',feathers:0,featherSpots:[]};
  await route.fulfill({json:req.url().includes('view=public')?{soldiers:1,atGate:1,recruitedToday:0}:{self,mail:'sent'}});
 });
 try{
  await page.goto(base+'/join-the-army-now/');await page.waitForFunction(()=>!!document.getElementById('toll-door').onclick);
  for(const link of await page.locator('[data-gate-enlist]').all()){await expect(link).toHaveAttribute('href','#enlist');await link.click();await expect(page.locator('#enlist')).toBeVisible();}
  assert(!await page.locator('input:focus,textarea:focus').count(),'no automatic keyboard');
  await page.locator('#enlist-email').fill('mock@example.test');await page.locator('#enlist-name').fill('new_builder');await page.locator('#enlist-why').fill('i help people build');await page.locator('#enlist-submit').click();await expect(page.locator('#ceremony')).toBeVisible();await expect(page.locator('#enlist')).toBeHidden();
  for(const link of await page.locator('[data-gate-enlist]').all()){await expect(link).toHaveAttribute('href','#ceremony');await expect(link).toHaveText("you're at the gate. see your tag ↓");await link.click();assert.equal(new URL(page.url()).hash,'#ceremony');}
  for(const lang of ['en','nl','fr','de','es','pt','zh']){
   await page.goto(base+'/join-the-army-now/?lang='+lang);await expect(page.locator('#ceremony')).toBeVisible();const copy=JSON.parse(await fs.readFile('js/i18n/army.'+lang+'.json','utf8'));
   await expect(page.locator('[data-gate-enlist]').first()).toHaveText(copy.gateAlready);await page.locator('[data-gate-enlist]').first().click();assert.equal(new URL(page.url()).hash,'#ceremony');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.screenshot({path:'tests/results/knock-'+name+'.png'});assert.deepEqual(errors,[]);console.log(name+': fresh and enlisted gate links, ceremony after submit, seven languages, 375px passed');
 }finally{await browser.close();}
}
