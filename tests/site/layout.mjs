import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch(),root='http://127.0.0.1:4460';
for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
 const context=await browser.newContext({viewport,isMobile:viewport.width<700,hasTouch:viewport.width<700}),page=await context.newPage();
 for(const path of ['/hack/1/the-feed/','/hack/the-feed/']){
  await page.goto(root+path,{waitUntil:'domcontentloaded'});const nav=await page.locator('.site-nav').boundingBox(),bar=await page.locator('.app-bar').boundingBox(),frame=await page.locator('.app-frame').boundingBox();
  if(viewport.width<700)assert(bar.y+bar.height<=nav.y+1,'feedback controls above mobile nav');else assert(frame.y>=nav.y+nav.height,'frame below desktop nav');assert(frame.height>400);
  await page.locator('#feedback-open').click();await page.locator('#feedback-dialog').waitFor({state:'visible'});await page.locator('#feedback-close').click();await page.screenshot({path:`test-results/site-flows/iframe-fixed-${viewport.width}.png`});
 }
 await page.goto(root+'/hack/play/',{waitUntil:'domcontentloaded'});const dpad=await page.locator('.dpad').boundingBox(),nav=await page.locator('.site-nav').boundingBox();assert(dpad.y+dpad.height<=(viewport.width<700?nav.y:viewport.height),'game controls fit');await page.screenshot({path:`test-results/site-flows/game-fixed-${viewport.width}.png`});
 for(const path of ['/','/legion/','/hack/play/','/live/']){
  await page.goto(root+path,{waitUntil:'domcontentloaded'});await page.locator('.site-nav a[href="/gabe/"]').click();await page.locator('.site-page>.site-button[href="/call/"]').click();await page.waitForURL('**/call/');assert(await page.locator('#call-request').count());
 }
 await page.screenshot({path:`test-results/site-flows/universal-call-${viewport.width}.png`});
 console.log(`PASS ${viewport.width}: iframe feedback, game controls, call booking in two actions from home/Legion/game/live.`);await context.close();
}
await browser.close();
