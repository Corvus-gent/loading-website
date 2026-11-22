import assert from 'node:assert/strict';
import {chromium,webkit,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {buildFixture} from '../helpers/built-site.mjs';
import {createPerformanceServer,observePerformance} from '../../tools/rust/performance.mjs';
import {progressiveHtml,progressiveAssetPath,CORE_ASSETS} from '../../tools/rust/progressive-delivery.mjs';

const source='<html><head><title>Same page</title></head><body><h1>Same copy</h1><script type="module" src="/js/site/shell.js?v=1"></script></body></html>';
assert(progressiveHtml(source,'/').includes('/__corvus_light__/js/site/shell.js?v=1'));
assert(!progressiveHtml(source,'/',{predictive:false}).includes('predictive-client'));
assert(progressiveHtml(source,'/gabe/').includes('data-corvus-wasm="core"'));
assert.equal(progressiveHtml(source,'/admin/'),source);
assert.equal(progressiveAssetPath('/__corvus_light__/js/i18n/bar.js'),'/js/i18n/bar.js');

const browserName=process.env.PREDICTIVE_BROWSER||'chromium';
if(!['chromium','webkit'].includes(browserName))throw Error('Unknown browser');
const fixture=await buildFixture(),server=await createPerformanceServer(fixture.root,'rust',{htmlTransform:progressiveHtml,assetPath:progressiveAssetPath}),browser=await({chromium,webkit}[browserName]).launch();
await mkdir('test-results/rust',{recursive:true});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:844},locale:'en-US'});
  await context.addCookies([{name:'corvus_realm',value:'1',url:server.origin}]);await context.addInitScript(observePerformance);
  const p=await context.newPage(),requests=[],errors=[];p.on('request',r=>requests.push(new URL(r.url()).pathname));p.on('pageerror',e=>errors.push(e.message));
  await p.goto(server.origin+'/');await p.waitForFunction(()=>window.__corvusMeasure.ready!==null);
  assert(!requests.some(path=>path.endsWith('.wasm')),'home interactions cannot wait for/download WASM');
  await p.keyboard.press('/');await expect(p.locator('.site-search')).toBeVisible();await p.keyboard.press('Escape');
  await expect(p.locator('#lang-switcher')).toBeVisible();
  await p.locator('#lang-switcher a[hreflang=nl]').click();await expect(p.locator('html')).toHaveAttribute('lang','nl');
  await p.locator('#lang-switcher a[hreflang=en]').click();await expect(p.locator('html')).toHaveAttribute('lang','en');
  await p.screenshot({path:`test-results/rust/progressive-${browserName}-${width}.png`,fullPage:true});
  // User input survives prefetch: no hydration swaps or synthetic form submits.
  const email=p.locator('[data-newsletter] [name=email]');await email.fill('prefetch@example.test');
  await p.locator('.site-card[href="/gabe/"]').scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>window.corvusPredictive.state.assets.length===2,{},{timeout:15000}).catch(async error=>{console.log('PREDICTION DEBUG',await p.evaluate(()=>({state:window.corvusPredictive?.state,visibility:document.visibilityState,online:navigator.onLine,ready:window.corvusDiscoveryReady,wasm:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.wasm')).map(r=>({encoded:r.encodedBodySize,decoded:r.decodedBodySize}))})),errors);throw error;});
  const state=await p.evaluate(()=>window.corvusPredictive.state);
  assert(state.documents.length<=2);assert(state.bytes<800000);assert.deepEqual(state.assets,CORE_ASSETS);assert.deepEqual(state.failed,[]);
  assert(!requests.some(path=>path==='/rust/browser/pkg/corvus_browser_bg.wasm'),'never warm the oversized feature bundle');
  assert.equal(requests.filter(path=>path===CORE_ASSETS[1]).length,1,'shared core fetched once');
  assert.equal(await email.inputValue(),'prefetch@example.test');
  await p.evaluate(()=>{
   for(const href of ['/go/compound-impact','/api/legion','/admin','/legion/join/token','/legion/edit/token','/gabe/?email=private','https://example.com/']){
    const a=document.createElement('a');a.href=href;a.textContent='unsafe speculation';document.body.prepend(a);a.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
   }
  });
  await p.waitForTimeout(200);assert(!requests.some(path=>/^\/(go|admin)\b|\/legion\/(join|edit)/.test(path)));
  await p.locator('.site-card[href="/gabe/"]').click();await p.waitForFunction(()=>window.__corvusMeasure.ready!==null);
  const wasm=await p.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.wasm')).map(r=>({transfer:r.transferSize,encoded:r.encodedBodySize})));
  assert.equal(wasm.length,1);if(browserName==='chromium')assert.equal(wasm[0].transfer,0,'destination reuses the prefetched WASM bytes');
  await p.keyboard.press('/');await expect(p.locator('.site-search')).toBeVisible();
  assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS progressive delivery',browserName,width,'home usable before WASM, bounded prediction, safe links, language, input retained');await context.close();
 }
 for(const mode of ['save-data','2g','offline','unsupported']){
  const context=await browser.newContext();await context.addInitScript(observePerformance);
  await context.addInitScript(mode=>{
   if(mode==='unsupported')HTMLScriptElement.supports=()=>false;
   else if(mode==='offline')Object.defineProperty(navigator,'onLine',{value:false});
   else Object.defineProperty(navigator,'connection',{value:{saveData:mode==='save-data',effectiveType:mode==='2g'?'2g':'4g'}});
  },mode);
  const p=await context.newPage(),requests=[],errors=[];p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(e.message));
  await p.goto(server.origin+'/');await p.waitForFunction(()=>window.__corvusMeasure.ready!==null);await p.locator('.site-card[href="/gabe/"]').scrollIntoViewIfNeeded();await p.waitForTimeout(2200);
  assert.deepEqual(errors,[]);
  if(mode!=='unsupported')assert.equal(requests.filter(url=>url.endsWith('.wasm')).length,0,'no extra downloads under '+mode);
  else assert.equal(await p.locator('script[type=speculationrules]').count(),0);
  console.log('PASS prediction fallback',mode);await context.close();
 }
 assert.deepEqual([...server.unknown],[]);assert.deepEqual([...server.failures],[]);
}finally{await browser.close();await server.close();await fixture.close();}
