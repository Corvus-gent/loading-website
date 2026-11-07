// Run against a protected preview with a Netscape bypass-cookie file. No tokens are logged.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,webkit} from '@playwright/test';
import {remaining} from '../hack/run.js';
const base=process.env.POST_READY_URL;
if(!base)throw Error('POST_READY_URL required');
const engine=process.env.BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch(engine===chromium?{args:['--disable-http2']}:{});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
if(process.env.PREVIEW_COOKIES){const raw=await fs.readFile(process.env.PREVIEW_COOKIES,'utf8');const cookies=raw.split('\n').filter(l=>l&&!l.startsWith('#')||l.startsWith('#HttpOnly_')).map(l=>{const [domain,,path,secure,expires,name,value]=l.replace('#HttpOnly_','').split('\t');return{name,value,domain,path,secure:secure==='TRUE',httpOnly:l.startsWith('#HttpOnly_'),expires:Number(expires)||-1,sameSite:'Lax'};});await context.addCookies(cookies);}
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
// Viewing the preview must not add fake views/comments to the legacy production wall.
await page.route('**/api/hack',route=>route.request().method()==='POST'?route.fulfill({json:{ok:true}}):route.continue());
const report=[];
try{
 for(const path of ['/hack/','/hack/1/','/hack/2/','/compound/']){
  const response=await page.goto(base+path+'?utm_source=linkedin&utm_medium=social',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,path);
  await page.waitForFunction(()=>window.posthog?.get_property?.('utm_source')==='linkedin',{},{timeout:15000});
  const props=await page.evaluate(()=>({source:posthog.get_property('utm_source'),campaign:posthog.get_property('utm_campaign'),id:posthog.get_property('hack_id')}));
  assert.equal(props.source,'linkedin');assert.equal(props.campaign,path==='/compound/'?'compound-1000':'hack');
  if(/^\/hack\/[12]/.test(path))assert.equal(props.id,Number(path.split('/')[2]));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+path);
  if(path==='/hack/'){assert.equal(await page.locator('.cards .card').count(),2);assert.match(await page.locator('h1').innerText(),/hackathon run/);}
  if(path==='/hack/1/'){await page.locator('#hack-counts .hj-stat').first().waitFor();assert.equal(await page.locator('[data-comment]').count(),1);assert.equal(new URL(await page.locator('[data-hack=app_open]').first().getAttribute('href'),base).pathname,'/hack/1/the-feed/');}
  if(path==='/hack/2/'){assert.match(await page.locator('#solo-title').innerText(),/solo run/);assert.notEqual(await page.locator('[data-clock=hours]').innerText(),'--');assert(!remaining(Date.parse('2026-11-07T20:59:00Z')).started);assert(remaining(Date.parse('2026-11-07T21:00:00Z')).started);}
  if(path==='/compound/'){
   await page.waitForFunction(()=>!document.getElementById('donate').disabled,{},{timeout:20000});assert.equal(await page.locator('#cuts > *').count(),3);
   const [stripe]=await Promise.all([page.waitForEvent('popup'),page.locator('#donate').click()]);await stripe.waitForURL('https://buy.stripe.com/**',{timeout:20000});assert(new URL(stripe.url()).searchParams.get('client_reference_id')?.startsWith('compound_'));await stripe.close();
   const [revolut]=await Promise.all([page.waitForEvent('popup'),page.locator('#revolut').click()]);await revolut.waitForURL(/revolut\.(me|com)/,{timeout:20000});await revolut.close();
  }
  const og=await page.locator('meta[property="og:image"]').getAttribute('content');if(og){const image=await context.request.get(base+new URL(og).pathname);assert.equal(image.status(),200);assert.match(image.headers()['content-type'],/image\//);}
  await page.screenshot({path:'test-results/post-ready/'+(path.replaceAll('/','')||'hub')+'-'+(process.env.BROWSER||'chromium')+'.png',fullPage:false});
  report.push({path,status:response.status(),...props,og:!!og});
 }
 await page.goto(base+'/hack/1/the-feed/');assert.match(await page.locator('#hack-app').getAttribute('src'),/^https:\/\/hackthefeed-six\.vercel\.app\/onboarding/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:report,iframe:true,errors},null,2));
}finally{await browser.close();}
