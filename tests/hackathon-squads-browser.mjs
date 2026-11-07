import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import sharp from 'sharp';
import {chromium,webkit} from '@playwright/test';
const base=process.env.SQUADS_PREVIEW;if(!base)throw Error('SQUADS_PREVIEW required');
const engine=process.env.BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch(engine===chromium?{args:['--disable-http2']}:{});
try{
 const context=await browser.newContext({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 if(process.env.PREVIEW_COOKIES){const raw=await fs.readFile(process.env.PREVIEW_COOKIES,'utf8');await context.addCookies(raw.split('\n').filter(l=>l&&!l.startsWith('#')||l.startsWith('#HttpOnly_')).map(l=>{const [domain,,path,secure,expires,name,value]=l.replace('#HttpOnly_','').split('\t');return{domain,path,name,value,secure:secure==='TRUE',httpOnly:l.startsWith('#HttpOnly_'),expires:Number(expires)||-1,sameSite:'Lax'};}));}
 // PostHog intentionally excludes webdriver bots. Simulate a human visitor
 // only inside this isolated test context; the site's bot filter stays unchanged.
 await context.addInitScript(()=>{Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false});Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>undefined});});
 // Keep browser QA out of the real HackTheFeed wall's Redis counters.
 await context.route('**/api/hack',r=>r.request().method()==='POST'?r.fulfill({json:{ok:true}}):r.continue());
 const page=await context.newPage(),errors=[],receipts=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async response=>{
  if(!response.url().startsWith('https://eu.i.posthog.com/')||response.request().method()!=='POST')return;
  const r=response.request();let events=[];
  try{
   let raw=r.postDataBuffer();
   if(raw?.[0]===31&&raw?.[1]===139)raw=zlib.gunzipSync(raw);
   let body=raw.toString();if(body.startsWith('data='))body=Buffer.from(new URLSearchParams(body).get('data'),'base64').toString();const value=JSON.parse(body);events=Array.isArray(value)?value:value.batch||[value];
  }catch{}
  receipts.push({status:response.status(),events:events.filter(e=>e.event==='$pageview').map(e=>({event:e.event,path:e.properties?.$pathname,source:e.properties?.utm_source,slug:e.properties?.short_slug}))});
 });
 const redirect=await context.request.get(base+'/squads?utm_source=linkedin',{maxRedirects:0});assert.equal(redirect.status(),307);assert.equal(new URL(redirect.headers().location).pathname,'/hackathons/');
 await page.goto(base+'/squads?utm_source=linkedin');
 await page.waitForFunction(()=>window.posthog?.get_property?.('short_slug')==='squads',null,{timeout:15000});
 assert.match(await page.title(),/^Ex-hackathon squads/);assert.match(await page.locator('h1').innerText(),/ex-hackathon/);assert.equal(await page.locator('.squad-card').count(),2);
 const card=page.locator('#hackthefeed');
 assert.equal(await card.locator('h2').innerText(),'#HackTheFeed');
 assert.equal(await card.locator('.squad-event').innerText(),'Oriane x Compound hackathon, San Francisco, Nov 2026');
 assert.equal(await card.locator('.squad-pitch').innerText(),"Paste your URL. We steal what's going viral in your niche and make it better.");
 assert.equal(await card.locator('.squad-status').innerText(),'Not selected. Pitched anyway.');
 assert.equal(await page.getByRole('link',{name:'Siebe',exact:true}).getAttribute('href'),'https://github.com/SiebeBaree');
 assert(!/lorem|placeholder|names coming soon/i.test(await page.locator('main').innerText()));
 assert.equal(await page.locator('.squad-nav [aria-current="page"]').getAttribute('href'),'/hackathons/');
 assert.equal(await page.evaluate(()=>posthog.get_property('utm_source')),'linkedin');assert.equal(await page.evaluate(()=>posthog.get_property('utm_campaign')),'hack');
 assert(!new URL(page.url()).searchParams.has('utm_source'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const og=await page.locator('meta[property="og:image"]').getAttribute('content');assert.equal(og,'https://corvus.gent/hackathons/og.jpg');
 const image=await context.request.get(base+new URL(og).pathname);assert.equal(image.status(),200);const metadata=await sharp(await image.body()).metadata();assert.equal(metadata.width,1200);assert.equal(metadata.height,630);
 await fs.mkdir('test-results/squads',{recursive:true});await page.screenshot({path:'test-results/squads/mobile.png',fullPage:true});
 await card.locator('.squad-actions a').first().click();await page.waitForURL(/\/hack\/1\//);assert.match(await page.locator('h1').innerText(),/HackTheFeed/);
 await page.goto(base+'/hackathons/');
 const [github]=await Promise.all([page.waitForEvent('popup'),page.locator('#hackthefeed .squad-actions a').last().click()]);await github.waitForURL('https://github.com/SiebeBaree/hackthefeed**');await github.waitForLoadState('domcontentloaded');assert.match(await github.title(),/hackthefeed/i);await github.close();
 await page.locator('#solo-run .squad-actions a').click();await page.waitForURL(/\/hack\/2\//);assert.match(await page.locator('h1').innerText(),/solo run/);
 for(const path of ['/support/','/realm/']){await page.goto(base+path);await page.locator('a[href="/hackathons/"]').first().click();await page.waitForURL(/\/hackathons\//);}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/squads/desktop.png',fullPage:true});
 // Real SDK transport receipt; preview hosts are intentionally excluded from production stats.
 await page.waitForTimeout(2500);
 assert(receipts.some(r=>r.status>=200&&r.status<300),'PostHog EU did not acknowledge any events');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({mobile:true,desktop:true,buildClick:'/hack/1/',repoClick:'https://github.com/SiebeBaree/hackthefeed',soloClick:'/hack/2/',redirect:307,og:{width:metadata.width,height:metadata.height},receipts,errors},null,2));
}finally{await browser.close();}
