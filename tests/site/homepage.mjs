import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const root='http://127.0.0.1:4460',dir='test-results/site-homepage';await fs.mkdir(dir,{recursive:true});const browser=await chromium.launch(),rows=[];
for(const viewport of [{width:390,height:844},{width:1440,height:900}])for(const variant of ['portal','flat']){
 const context=await browser.newContext({viewport,isMobile:viewport.width===390,hasTouch:viewport.width===390,reducedMotion:'reduce'}),page=await context.newPage();
 async function home(){await page.goto(root+'/',{waitUntil:'domcontentloaded'});if(variant==='flat')await page.evaluate(()=>{document.querySelector('.home .hero')?.remove();document.querySelector('.home h1').innerHTML='one man. one army.';});await page.waitForTimeout(250);}
 await home();await page.screenshot({path:`${dir}/${variant}-${viewport.width}.png`});
 for(const section of ['quests','daily','legion','live','gabe']){await home();await page.locator(`.portal-sections a[href="/${section}/"]`).click();await page.waitForURL('**/'+section+'/');assert(await page.locator('.site-nav').isVisible());rows.push({variant,viewport:viewport.width,section,clicks:1,result:'pass'});}
 await home();await page.locator('.portal-sections a[href="/quests/"]').click();await page.locator('.site-grid a[href^="/hack/3"]').click();await page.waitForURL(/\/hack\/3\/?$/);rows.push({variant,viewport:viewport.width,flow:'Home → Quests → Hack #3',clicks:2,result:'pass'});await context.close();
}
await browser.close();await fs.writeFile(dir+'/comparison.json',JSON.stringify({method:'Automated discoverability and action-count comparison, not a human usability study.',rows},null,2));console.log('PASS: portal and flat layouts; every section in one action, Hack #3 in two, at both viewport sizes.');
