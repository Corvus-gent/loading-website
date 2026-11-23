// Functional checks for the experimental delivery only. All submissions are
// intercepted locally; this file never writes to production or sends email.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,expect} from '@playwright/test';
import {buildFixture} from '../helpers/built-site.mjs';
import {createPerformanceServer} from '../../tools/rust/performance.mjs';
import {prepareVariants} from '../../tools/rust/ten-experiments/variants.mjs';

const combined=(process.env.COMBINED||'bundle,parallel,directory,brotli,locale,predict,footer-logo').split(',');
const out=process.env.FLOW_OUT||'test-results/rust/measurements/ten-flows';
await mkdir(out,{recursive:true});
const fixture=await buildFixture();
const variants=await prepareVariants(fixture.root,{combined});
const v=variants.options('10-combined');
const server=await createPerformanceServer(fixture.root,v.engine,v.server);
const results=[];
try {
 for(const [name,type] of Object.entries({chromium,webkit})) {
  const browser=await type.launch();
  try {
   for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390,locale:'en-US',reducedMotion:'reduce'});
    await context.addCookies([{name:'corvus_realm',value:'1',url:server.origin}]);
    await context.addInitScript(()=>{localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny'}));sessionStorage.setItem('twitch-disabled','1');});
    let fail=true;
    const submissions=[],errors=[];
    await context.route('**/api/legion',async route=>{
     if(route.request().method()!=='POST')return route.continue();
     const body=route.request().postDataJSON();
     assert.equal(body.action,'subscribe');
     assert.equal(body.email,'quality@example.test');
     assert.equal(body.consent,true);
     submissions.push(body);
     await route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{error:'Please retry shortly.'}:{message:'Check your inbox.'})});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(server.origin+'/');
    await page.waitForFunction(()=>window.corvusDiscoveryReady&&document.querySelector('.site-search'));
    const form=page.locator('[data-newsletter]');
    await form.locator('button[type=submit]').click();
    assert.equal(submissions.length,0,'empty email cannot submit');
    await form.locator('[name=email]').fill('quality@example.test');
    await form.locator('button[type=submit]').click();
    assert.equal(submissions.length,0,'subscription requires consent');
    await form.locator('[name=consent]').check();
    await form.locator('button[type=submit]').click();
    await expect(form.locator('[role=status]')).toHaveText('Please retry shortly.');
    await expect(form.locator('[name=email]')).toHaveValue('quality@example.test');
    await expect(form.locator('button[type=submit]')).toBeEnabled();
    fail=false;
    await form.locator('button[type=submit]').click();
    await expect(form.locator('[role=status]')).toHaveText('Check your inbox.');
    await expect(form.locator('[name=email]')).toHaveValue('');
    assert.equal(submissions.length,2);

    for(const route of ['/','/gabe/','/daily/','/privacy/']) {
     await page.goto(server.origin+route);
     await expect(page.locator('#lang-switcher a[hreflang=nl]')).toBeVisible();
     await page.locator('#lang-switcher a[hreflang=nl]').click();
     await expect(page.locator('html')).toHaveAttribute('lang','nl');
     await expect(page.locator('#lang-switcher a[aria-current]')).toHaveAttribute('hreflang','nl');
     await page.reload();
     await expect(page.locator('html')).toHaveAttribute('lang','nl');
     await expect(page.locator('#lang-switcher a[hreflang=en]')).toBeVisible();
     await page.locator('#lang-switcher a[hreflang=en]').click();
     await expect(page.locator('html')).toHaveAttribute('lang','en');
     assert((await page.locator('h1').first().innerText()).trim().length>0);
     assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'no overflow: '+route);
    }
    await page.goto(server.origin+'/map/');
    await page.waitForFunction(()=>window.corvusDiscoveryReady);
    await page.locator('[data-directory-filter]').fill('OSSMAN');
    await expect(page.locator('.site-directory a:visible').first()).toContainText('OSSMAN');
    await page.locator('[data-directory-filter]').fill('');
    await page.locator('h1').click();await page.keyboard.press('/');
    await expect(page.locator('.site-search')).toBeVisible();
    await page.locator('.site-search input').fill('/legion/edit/private');
    await expect(page.locator('.site-search-results a')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.screenshot({path:`${out}/${name}-${width}-map.png`,fullPage:true});
    await page.goto(server.origin+'/');
    await page.waitForFunction(()=>window.corvusDiscoveryReady);
    await page.screenshot({path:`${out}/${name}-${width}-home.png`,fullPage:true});
    assert.deepEqual(errors,[]);
    results.push({browser:name,width,passed:true,newsletterRequests:submissions.length,languages:['/','/gabe/','/daily/','/privacy/'],errors});
    await context.close();

    // A separate first-visit context exercises the actual privacy UI, with no
    // benchmark initializer silently preselecting a privacy choice.
    const fresh=await browser.newContext({viewport:{width,height:844},locale:'en-US',reducedMotion:'reduce'});
    const p=await fresh.newPage(),privacyErrors=[];p.on('pageerror',e=>privacyErrors.push(e.message));
    await p.goto(server.origin+'/');
    await expect(p.locator('[data-deny]')).toBeVisible({timeout:15000});
    await p.locator('[data-deny]').click();
    await expect(p.locator('[data-deny]')).toHaveCount(0);
    await p.reload();await p.waitForFunction(()=>window.corvusDiscoveryReady);
    await expect(p.locator('[data-deny]')).toHaveCount(0);
    assert.deepEqual(privacyErrors,[]);
    results.push({browser:name,width,privacyDenialPersists:true});
    await fresh.close();
    console.log('PASS',name,width,'newsletter validation/retry, four language pages, map/search, privacy');
   }
  } finally {await browser.close();}
 }
 assert.deepEqual([...server.failures],[]);
 assert.deepEqual([...server.unknown],[]);
 await writeFile(out+'/report.json',JSON.stringify({combined,finished:new Date().toISOString(),results},null,2)+'\n');
} finally {await server.close();await fixture.close();}
