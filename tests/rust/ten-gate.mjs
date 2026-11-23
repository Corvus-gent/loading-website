// HTTPS origin simulation, real middleware and ritual code, local static server.
// Every browser request is intercepted; no request reaches corvus.gent.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,expect} from '@playwright/test';
import middleware from '../../middleware.js';
import {buildFixture} from '../helpers/built-site.mjs';
import {createPerformanceServer} from '../../tools/rust/performance.mjs';
import {prepareVariants} from '../../tools/rust/ten-experiments/variants.mjs';

const out='test-results/rust/measurements/ten-gate';await mkdir(out,{recursive:true});
const fixture=await buildFixture();
const combined=['bundle','parallel','directory','brotli','locale','predict','footer-logo','css-flat','stable-language'];
const variants=await prepareVariants(fixture.root,{combined});const v=variants.options('10-combined');
const server=await createPerformanceServer(fixture.root,v.engine,v.server);
const origin='https://corvus.gent',results=[];
try {
 for(const [name,type] of Object.entries({chromium,webkit})) {
  const browser=await type.launch();
  try {for(const width of [390,1440]) {
   const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390,locale:'en-US',timezoneId:width===390?'Europe/Brussels':'America/Los_Angeles',reducedMotion:'reduce'});
   await context.addInitScript(()=>{sessionStorage.setItem('twitch-disabled','1');localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny'}));});
   const unexpected=[],errors=[];
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){unexpected.push(url.origin);return route.abort();}
    if(['/api/hit','/api/notice-ok'].includes(url.pathname))return route.fulfill({status:204});
    if(url.pathname==='/api/geo')return route.fulfill({contentType:'application/json',body:'{"countryCode":"BE"}'});
    let target=url.pathname+url.search;
    if(request.resourceType()==='document') {
     const result=middleware(new Request(url,{headers:await request.allHeaders()}));
     const redirect=result.headers.get('location'),rewrite=result.headers.get('x-middleware-rewrite');
     if(redirect)return route.fulfill({status:result.status,headers:{location:redirect}});
     if(rewrite){const parsed=new URL(rewrite);assert.equal(parsed.origin,origin);target=parsed.pathname+parsed.search;}
    }
    const response=await fetch(server.origin+target);
    const headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['content-length'];
    await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   const first=await page.goto(origin+'/');
   assert.equal(first.status(),200);
   const html=await first.text();
   assert.match(html,/property="og:image"/);assert.match(html,/<noscript>/);
   await expect(page.locator('[data-realm-gate] .realm-enter')).toBeVisible();
   await page.reload();await expect(page.locator('[data-realm-gate]')).toHaveCount(1);
   const expectedExpiry=await page.evaluate(()=>{const now=new Date(),end=new Date(now);end.setHours(4,2,0,0);if(end<=now)end.setDate(end.getDate()+1);return end.getTime()/1000;});
   await page.locator('.realm-enter').click();await expect(page).toHaveURL(origin+'/realm/');
   const ritual=(await context.cookies()).find(c=>c.name==='corvus_realm');
   assert(ritual?.value==='1'&&ritual.secure&&ritual.path==='/'&&ritual.sameSite==='Lax');
   assert(Math.abs(ritual.expires-expectedExpiry)<2);
   const home=await page.goto(origin+'/');
   assert(!(await home.text()).includes('data-realm-gate'),'no gate in returning HTML');
   await expect(page.locator('.portal-sections')).toBeVisible();
   await page.reload();await expect(page.locator('[data-realm-gate]')).toHaveCount(0);
   await page.screenshot({path:`${out}/${name}-${width}-returned.png`,fullPage:true});
   await context.addCookies([{...ritual,expires:Date.now()/1000+1}]);
   await expect.poll(async()=>(await context.cookies()).some(c=>c.name==='corvus_realm')).toBe(false);
   await page.goto(origin+'/');await expect(page.locator('[data-realm-gate] .realm-enter')).toBeVisible();
   assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
   results.push({browser:name,width,firstRefreshReturnExpiry:true,ogAndNoscript:true,cookieSecure:true,expiresAtLocal0402:true,errors});
   await context.close();console.log('PASS',name,width,'entry, refresh, returning HTML, secure 04:02 cookie and expiry');
  }} finally {await browser.close();}
 }
 assert.deepEqual([...server.failures],[]);assert.deepEqual([...server.unknown],[]);
 await writeFile(out+'/report.json',JSON.stringify({combined,finished:new Date().toISOString(),results},null,2)+'\n');
} finally {await server.close();await fixture.close();}
