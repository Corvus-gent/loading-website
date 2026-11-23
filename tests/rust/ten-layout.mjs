// Final rendered geometry/content must remain equivalent after delivery changes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from '@playwright/test';
import {buildFixture} from '../helpers/built-site.mjs';
import {createPerformanceServer,observePerformance,samplePerformance} from '../../tools/rust/performance.mjs';
import {prepareVariants,PAGES} from '../../tools/rust/ten-experiments/variants.mjs';

const out='test-results/rust/measurements/ten-layout';await mkdir(out,{recursive:true});
const fixture=await buildFixture(),combined=['bundle','parallel','directory','brotli','locale','predict','footer-logo','css-flat','stable-language'];
const variants=await prepareVariants(fixture.root,{combined}),servers={},results=[];
try {
 for(const mode of ['js-control','10-combined']){const v=variants.options(mode);servers[mode]=await createPerformanceServer(fixture.root,v.engine,v.server);}
 for(const[name,type]of Object.entries({chromium,webkit})){
  const browser=await type.launch();
  try{for(const width of [390,1440])for(const route of PAGES){
   const views={};
   for(const mode of Object.keys(servers)){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,locale:'en-US',timezoneId:'Europe/Brussels',reducedMotion:'reduce'});
    await context.route('**/api/vote',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({votes:{nl:2,en:1},challenge:null})}));
    await context.route('**/api/geo*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({countryCode:'BE'})}));
    await context.addCookies([{name:'corvus_realm',value:'1',url:servers[mode].origin}]);await context.addInitScript(observePerformance);
    const page=await context.newPage();
    try{
     const m=await samplePerformance(page,route,'cold-context',servers[mode].origin);assert(!m.error,m.error);await page.keyboard.press('Escape');
     await page.waitForLoadState('networkidle');
     views[mode]=await page.evaluate(()=>{
      const selectors=['main h1','main h2','.portal-sections .site-card','[data-newsletter]','main input','main button','#lang-switcher','.site-quiet-footer','main .site-directory'];
      const elements=selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length).map((e,index)=>{
       const b=e.getBoundingClientRect(),s=getComputedStyle(e);
       return{key:selector+':'+index,text:e.textContent.replace(/\s+/g,' ').trim(),box:{x:b.x,y:b.y,width:b.width,height:b.height},style:{font:s.font,fontFamily:s.fontFamily,color:s.color,background:s.backgroundColor,padding:s.padding,border:s.border,display:s.display}};
      }));
      return{elements,overflow:document.documentElement.scrollWidth>innerWidth};
     });
     await page.screenshot({path:`${out}/${mode}-${name}-${width}-${route.replaceAll('/','_')}.png`,fullPage:true});
    }finally{await context.close();}
   }
   const before=views['js-control'],after=views['10-combined'];assert.equal(after.overflow,false);
   assert.equal(after.elements.length,before.elements.length,`${route} element count`);let maxDifference=0;
   for(let i=0;i<before.elements.length;i++){
    const a=before.elements[i],b=after.elements[i];assert.equal(b.key,a.key);assert.equal(b.text,a.text,`${route} ${a.key} text`);assert.deepEqual(b.style,a.style,`${route} ${a.key} style`);
    for(const dimension of ['x','y','width','height']){const diff=Math.abs(a.box[dimension]-b.box[dimension]);maxDifference=Math.max(maxDifference,diff);assert(diff<=1,`${route} ${a.key} ${dimension}: ${a.box[dimension]} -> ${b.box[dimension]}`);}
   }
   results.push({browser:name,width,route,comparedElements:before.elements.length,maxDifference,passed:true});
   console.log('PASS',name,width,route,`geometry difference <= ${maxDifference}px`);
   await writeFile(out+'/report.json',JSON.stringify({combined,results},null,2)+'\n');
  }}finally{await browser.close();}
 }
 for(const s of Object.values(servers)){assert.deepEqual([...s.failures],[]);assert.deepEqual([...s.unknown],[]);}
 await writeFile(out+'/report.json',JSON.stringify({combined,finished:new Date().toISOString(),results},null,2)+'\n');
}finally{for(const s of Object.values(servers))await s.close();await fixture.close();}
