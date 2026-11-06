import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4190';
const output=new URL('../results/napoleon-gate/',import.meta.url);await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch();const errors=[];const results=[];
try{
 for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:360,height:800}]]){
  const page=await browser.newPage({viewport,locale:'en-US'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/army*',route=>route.fulfill({json:route.request().method()==='POST'?{self:{code:'test-recruit'}}:route.request().url().includes('view=public')?{soldiers:12,atGate:7,recruitedToday:3}:{self:null}}));
  await page.goto(base+'/join-the-army-now/');await page.locator('#count-soldiers').filter({hasText:'12'}).waitFor();
  assert.equal(await page.locator('#opening').count(),0);
  assert.equal(await page.locator('#gate-title').textContent(),'the army is recruiting.');
  assert.equal(await page.locator('.hero-legion').getAttribute('href'),'/legion');
  assert(await page.locator('#napoleon-painting').evaluate(e=>e.complete&&e.naturalWidth>0));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(Math.round((await page.locator('.gate-hero').boundingBox()).width),viewport.width);
  await page.screenshot({path:new URL(name+'.jpg',output).pathname,type:'jpeg',quality:75});
  await page.locator('.hero-actions .primary').click();assert.equal(new URL(page.url()).hash,'#doors');
  assert.equal(await page.locator('.army-door').count(),3);
  for(const card of await page.locator('.army-door').all())assert.equal(await card.locator('a,button').count(),1);
  await page.locator('#toll-door').click();assert(await page.locator('#toll-dialog').isVisible());
  assert.match(await page.locator('#toll-dialog a[data-army="membership"]').getAttribute('href'),/^https:\/\/buymeacoffee.com\/gabe.maxxing\/membership$/);
  await page.keyboard.press('Escape');assert(!(await page.locator('#toll-dialog').isVisible()));
  await page.locator('#stripes-door').click();await page.locator('#recruit-link').filter({hasText:'https://corvus.gent/r/test-recruit'}).waitFor();await page.keyboard.press('Escape');
  await page.locator('.army-door a[href="#enlist"]').click();assert.equal(new URL(page.url()).hash,'#enlist');
  assert(!(await page.locator('#enlist-form').evaluate(e=>e.checkValidity())));
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.napoleon-light').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert(Number(await page.locator('.napoleon-light').evaluate(e=>getComputedStyle(e).opacity))>0);
  for(const lang of ['nl','es','fr','pt','de','zh']){
   await page.goto(base+'/join-the-army-now/?lang='+lang);
   const copy=JSON.parse(await fs.readFile(new URL('../../js/i18n/army.'+lang+'.json',import.meta.url),'utf8'));
   await page.waitForFunction(text=>document.getElementById('gate-title').textContent===text,copy.gateHeroTitle);
   assert.equal(await page.locator('.napoleon-frame').getAttribute('aria-label'),copy.gatePaintingAlt);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  results.push({viewport:name,languages:7,dialogs:'pass',reducedMotion:'pass',overflow:false});await page.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(new URL('checks.json',output),JSON.stringify({results,pageErrors:errors},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();}
