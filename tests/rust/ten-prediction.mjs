import assert from 'node:assert/strict';
import {chromium,webkit,expect} from '@playwright/test';
import {buildFixture} from '../helpers/built-site.mjs';
import {createPerformanceServer,observePerformance} from '../../tools/rust/performance.mjs';
import {prepareVariants} from '../../tools/rust/ten-experiments/variants.mjs';
const combined=(process.env.COMBINED||'bundle,parallel,directory,brotli,locale,predict,footer-logo,css-flat,stable-language').split(',');
const fixture=await buildFixture(),variants=await prepareVariants(fixture.root,{combined}),v=variants.options('10-combined'),server=await createPerformanceServer(fixture.root,v.engine,v.server);
try{
 for(const [name,type]of Object.entries({chromium,webkit})){
  if(process.env.PREDICTIVE_BROWSER&&process.env.PREDICTIVE_BROWSER!==name)continue;
  const browser=await type.launch();
  try{
   for(const width of [390,1440]){
    const c=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390,locale:'en-US'});await c.addInitScript(observePerformance);await c.addCookies([{name:'corvus_realm',value:'1',url:server.origin}]);const p=await c.newPage(),errors=[],requests=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push({path:new URL(r.url()).pathname,method:r.method(),type:r.resourceType()}));
    await p.goto(server.origin+'/');await p.waitForFunction(()=>window.__corvusMeasure.ready!==null);const email=p.locator('[data-newsletter] [name=email]');await email.fill('prediction@example.test');await p.locator('.site-card[href="/gabe/"]').scrollIntoViewIfNeeded();
    await p.waitForFunction(()=>{const policy=JSON.parse(document.getElementById('corvus-experiment-prediction').textContent);return window.corvusPrediction?.state.assets.includes(policy.routes['/gabe/'][0].url);},{},{timeout:20000}).catch(async error=>{console.log('PREDICTION FAILURE',JSON.stringify({name,width,errors,requests,state:await p.evaluate(()=>({prediction:window.corvusPrediction?.state,ready:document.readyState,directory:window.corvusDiscoveryReady,visibility:document.visibilityState,online:navigator.onLine,policy:document.getElementById('corvus-experiment-prediction')?.textContent}))}));throw error;});const state=await p.evaluate(()=>window.corvusPrediction.state);
    assert(state.routes.length<=2&&state.reservedBytes<=120000&&state.completedBytes<=120000);assert.deepEqual(state.failed,[]);assert.equal(await email.inputValue(),'prediction@example.test');
    assert.equal(requests.filter(r=>r.type==='document').length,1,'never prefetch session-sensitive HTML');assert(!requests.some(r=>r.path.endsWith('.wasm')),'no large WASM speculation');
    const before=requests.length;await p.evaluate(()=>{
     for(const href of ['/admin','/go/compound-impact','/api/legion','/legion/join/secret','/legion/edit/secret','/gabe/?email=private','https://example.com/']){const a=document.createElement('a');a.href=href;a.textContent='unsafe prediction';document.body.prepend(a);a.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));}
    });await p.waitForTimeout(200);assert(!requests.slice(before).some(r=>/^\/(?:go|api|admin|legion)\b/.test(r.path)));
    await p.locator('.site-card[href="/gabe/"]').click();await p.waitForFunction(()=>window.__corvusMeasure.ready!==null);await p.keyboard.press('/');await expect(p.locator('.site-search')).toBeVisible();await p.keyboard.press('Escape');
    if(name==='chromium'){const hit=await p.evaluate(()=>{const r=performance.getEntriesByType('resource').find(r=>r.name.includes('/_gabe_-'));return r?{transferSize:r.transferSize}:null;});assert.equal(hit?.transferSize,0,'predicted asset reused by browser cache');}
    await p.locator('#lang-switcher a[hreflang=nl]').click();await expect(p.locator('html')).toHaveAttribute('lang','nl');await p.goBack();await p.waitForFunction(()=>document.documentElement.lang==='nl');
    assert.deepEqual(errors,[]);assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await c.close();console.log('PASS',name,width,'safe bounded prefetch, input persistence, cache reuse, navigation and language');
   }
   for(const mode of ['save-data','2g','offline']){
    const c=await browser.newContext();await c.addInitScript(observePerformance);await c.addInitScript(mode=>{if(mode==='offline')Object.defineProperty(navigator,'onLine',{value:false});else Object.defineProperty(navigator,'connection',{value:{saveData:mode==='save-data',effectiveType:mode==='2g'?'2g':'4g'}});},mode);const p=await c.newPage();
    await p.goto(server.origin+'/');await p.waitForFunction(()=>window.__corvusMeasure.ready!==null);await p.locator('.site-card[href="/gabe/"]').scrollIntoViewIfNeeded();await p.waitForTimeout(1700);assert.deepEqual(await p.evaluate(()=>window.corvusPrediction.state.assets),[]);await c.close();console.log('PASS',name,mode,'no speculative download');
   }
  }finally{await browser.close();}
 }
 assert.deepEqual([...server.failures],[]);assert.deepEqual([...server.unknown],[]);
}finally{await server.close();await fixture.close();}
