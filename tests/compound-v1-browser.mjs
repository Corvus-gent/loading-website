import {chromium,devices,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.COMPOUND_V1_URL||'http://127.0.0.1:4303';
const state=await(await fetch('https://corvus.gent/api/compound')).json();
const v=state.cuts[0].current;assert.equal(v.label,'V1');
const browser=await chromium.launch({args:['--disable-http2']});
try{
 const context=await browser.newContext({...devices['iPhone 13']});
 const page=await context.newPage(),errors=[],events=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Real published media, isolated vote/payment responses: never seed public scores.
 await context.route('**/api/compound*',async route=>{
  const req=route.request();if(req.method()==='GET')return route.fulfill({json:req.url().includes('live=1')?{poll:null}:state});
  const b=req.postDataJSON();events.push(b);return route.fulfill({json:{ok:true,added:true,choice:b.choice,url:'https://buy.stripe.com/test_compound'}});
 });
 await context.route('https://buy.stripe.com/test_compound',r=>r.fulfill({body:'Test checkout only',contentType:'text/html'}));
 await context.route('**/js/analytics.js*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 await page.goto(base+'/compound/?utm_source=linkedin&utm_content=v1-drop');
 await page.waitForFunction(()=>document.querySelector('[data-cut="1"] video')?.currentTime>0,null,{timeout:15000});
 const one=page.locator('[data-cut="1"]');
 assert(await one.locator('video').evaluate(v=>v.muted));
 const box=await one.locator('video').boundingBox();assert(box.y<500);
 await one.locator('.sound-toggle').click();assert.equal(await one.locator('video').evaluate(v=>v.muted),false);
 await one.locator('.vote[data-choice="up"]').click();await expect(one.locator('.categories')).toBeVisible();
 await one.locator('[data-category="Hook"][data-choice="up"]').click();
 const cut=v.transitions.find(t=>t.type==='transition');
 await one.locator('video').evaluate((video,t)=>{video.pause();video.currentTime=t;},cut.end+1);
 await expect(one.locator('.transition-top strong')).toHaveText('🎬 NOW: '+cut.label);
 await one.locator('.transition-votes button').first().click();await expect(one.locator('.transition-follow')).toBeVisible();
 assert.equal(await one.locator('.transition-card:visible').count(),1);
 for(const slot of [2,3]){
  await page.locator('[data-slot="'+slot+'"]').click();
  await expect(page.locator('[data-cut="'+slot+'"] .cut-empty h3')).toHaveText('dropping soon');
  await expect(page.locator('[data-cut="'+slot+'"] video')).toBeHidden();
 }
 await page.locator('[data-slot="1"]').click();
 const popup=context.waitForEvent('page');await page.locator('#donate').click();const checkout=await popup;await checkout.waitForURL('https://buy.stripe.com/test_compound');await checkout.close();
 const armyURL=await page.locator('#army').getAttribute('href');assert.equal(armyURL,'/join-the-army-now/');
 await page.locator('#army').click();await page.waitForURL('**/join-the-army-now/');
 assert(events.some(e=>e.action==='donate'));assert(events.some(e=>e.action==='vote'));assert(events.some(e=>e.action==='transition'));assert(events.some(e=>e.event==='army_join'));
 assert(events.every(e=>e.attribution?.source==='linkedin'&&e.attribution?.content==='v1-drop'));
 await page.goto(base+'/compound/?utm_source=linkedin');await one.locator('video').waitFor();
 assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'),'V1 just dropped: help me win €1000');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await fs.mkdir('test-results/v1',{recursive:true});await page.screenshot({path:'test-results/v1/mobile-verified.png'});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/v1/desktop-verified.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({autoplay:true,sound:true,vote:true,category:true,transitionLinger:true,donateFlow:'isolated checkout',army:true,attribution:'linkedin / v1-drop',errors}));
}finally{await browser.close();}
