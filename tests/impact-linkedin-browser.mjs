import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:4460';
if(!origin.startsWith('http://127.0.0.1:'))throw Error('This test writes fixtures: disposable local preview only.');
const browser=await chromium.launch();
await fs.mkdir('test-results/linkedin',{recursive:true});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/compound/v2/stats/#impact-admin');await page.locator('#login input[name=password]').fill('site-v2-test');await page.locator('#login button').click();
 const form=page.locator('#impact-linkedin-single');await form.waitFor({state:'visible'});
 await form.locator('[name=post_url]').fill('https://www.linkedin.com/feed/update/urn:li:activity:987654321'+width);
 await form.locator('[name=original]').check();await form.locator('[name=has_video]').check();await form.locator('button').click();
 await page.waitForFunction(()=>document.querySelector('#impact-linkedin-message')?.textContent.startsWith('Saved.'));
 await form.locator('[name=views]').fill('100');await form.locator('[name=likes]').fill('4');await form.locator('[name=comments]').fill('2');await form.locator('[name=shares]').fill('1');
 const saved=page.waitForResponse(r=>r.url().includes('impact=1')&&r.request().method()==='POST');await form.locator('button').click();assert.equal((await saved).status(),200);
 await page.goto(origin+'/compound/impact/?platform=linkedin');await page.locator('.impact-post').first().waitFor();
 const card=page.locator('.impact-post').filter({has:page.locator('a[href$="987654321'+width+'"]')});assert.equal(await card.count(),1);
 assert.match(await card.innerText(),/self-reported/);assert.match(await card.innerText(),/138/);assert.match(await card.innerText(),/impressions/);
 await page.locator('#account').selectOption('francisco-gabriel-van-langenhove');assert.equal(await card.count(),1);
 assert.ok(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));assert.deepEqual(errors,[]);
 await page.locator('#scorecard').count();await card.scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/linkedin/local-'+width+'.png'});await page.close();
}console.log('PASS: real local owner login → URL-only import → metrics update → one LinkedIn row, score 138, self-reported, all/named accounts, 390px + 1440px.');}
finally{await browser.close();}
