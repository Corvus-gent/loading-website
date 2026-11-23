// Reproducible local matrix; isolated fixtures, no production traffic or writes.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {chromium,webkit} from '@playwright/test';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import {launch} from 'chrome-launcher';
import {buildFixture} from '../../../tests/helpers/built-site.mjs';
import {createPerformanceServer,observePerformance,samplePerformance,PROFILES,quantile} from '../performance.mjs';
import {MODES,prepareVariants} from './variants.mjs';

const opts=Object.fromEntries(process.argv.slice(2).map(s=>s.split(/=(.*)/s).slice(0,2)));
const modes=opts['--modes']?.split(',')||MODES,repeats=Number(opts['--repeats']||3),suite=opts['--suite']||'all',routes=opts['--routes']?.split(',')||['/','/map/'];
const freshProcess=opts['--fresh-process']==='1';
const auditRoute=opts['--audit-route']||'/';
assert(auditRoute.startsWith('/')&&!auditRoute.startsWith('//'),'Lighthouse stays on the local fixture');
assert(modes.every(m=>MODES.includes(m))&&Number.isInteger(repeats)&&repeats>=1&&repeats<=30);
assert(['all','prepare','functional','timing','lighthouse'].includes(suite));
const started=new Date().toISOString(),git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim(),head=git('rev-parse','HEAD');
const out=opts['--out']||'test-results/rust/measurements/ten-'+started.replace(/[:.]/g,'-');await mkdir(out,{recursive:true});
const fixture=await buildFixture();
await writeFile(fixture.root+'/__benchmark_setup.html','<!doctype html><html><head><meta charset="utf-8"><title>Fixture setup</title><link rel="icon" href="data:,"></head><body></body></html>');
const prepared=await prepareVariants(fixture.root,{combined:opts['--combined']?.split(',')||['bundle','parallel'],pageWasm:opts['--page-wasm']||'page',rustBest:opts['--rust-best']==='1'});
const servers={},samples=[],audits=[],functional=[],warmups=[],errors=[],content={};
const manifest=JSON.parse(await readFile('rust/browser/pkg/ten/manifest.json','utf8'));
const report={version:1,started,head,workingTreeDirty:!!git('status','--porcelain'),suite,repeats,modes,routes,combined:prepared.combined,pageWasm:prepared.pageWasm,conditions:PROFILES,fixtureLatencyMs:40,host:{node:process.version,os:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model},productionReady:false,artifacts:manifest,bundles:prepared.records,samples,audits,functional,warmups,errors};
report.freshBrowserProcessPerPair=freshProcess;
report.auditRoute=auditRoute;
if(prepared.pageWasm.startsWith('shell'))report.pageWasmArtifact=JSON.parse(await readFile(`rust/browser/pkg/ten/${prepared.pageWasm}/experiment.json`,'utf8'));
report.rustBest=prepared.rustBest;
async function checkpoint(){
 report.updated=new Date().toISOString();
 report.summary=modes.flatMap(mode=>Object.keys(PROFILES).flatMap(profile=>routes.map(route=>{
  const timing=samples.filter(s=>s.mode===mode&&s.profile===profile&&s.route===route&&s.cache==='cold-context'),scores=audits.filter(s=>s.mode===mode&&s.profile===profile&&s.route===route);
  return{mode,profile,route,n:timing.length,readyMedian:quantile(timing.map(s=>s.ready),.5),readyMean:timing.filter(s=>Number.isFinite(s.ready)).length?timing.reduce((a,s)=>a+(s.ready||0),0)/timing.filter(s=>Number.isFinite(s.ready)).length:null,readyMin:quantile(timing.map(s=>s.ready),0),readyMax:quantile(timing.map(s=>s.ready),1),lighthouseMedian:quantile(scores.map(s=>s.score),.5),lighthouseMin:quantile(scores.map(s=>s.score),0),lighthouseMax:quantile(scores.map(s=>s.score),1),transferMedian:quantile(timing.map(s=>s.transfer),.5),lcpMedian:quantile(scores.map(s=>s.lcp),.5),errors:timing.filter(s=>s.error).map(s=>s.error)};
 })));
 await writeFile(out+'/report.pending.json',JSON.stringify(report,null,2)+'\n');await rename(out+'/report.pending.json',out+'/report.json');
}
const log=(kind,data)=>console.log(kind,JSON.stringify(data));
async function contextFor(browser,mode,profile,throttle=false){
 const cfg=PROFILES[profile],context=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},isMobile:profile==='mobile',hasTouch:profile==='mobile',locale:'en-US',timezoneId:'Europe/Brussels',serviceWorkers:'block'});
 await context.addCookies([{name:'corvus_realm',value:'1',url:servers[mode].origin}]);await context.addInitScript(observePerformance);const page=await context.newPage();
 if(throttle){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cfg.cpu});if(cfg.down)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:cfg.latency,downloadThroughput:cfg.down,uploadThroughput:cfg.up});}
 return{context,page};
}
async function check(browser,browserName,mode,profile){
 const{context,page}=await contextFor(browser,mode,profile),faults=[],requests=[],stage={route:''};
 page.on('pageerror',e=>faults.push({stage:{...stage},message:e.message,stack:e.stack}));
 page.on('requestfailed',r=>requests.push({stage:{...stage},url:r.url(),error:r.failure()?.errorText}));
 try{
  for(const route of ['/','/map/','/cv/tech/']){
   stage.route=route;const s=await samplePerformance(page,route,'cold-context',servers[mode].origin);assert(!s.error,s.error);await page.keyboard.press('Escape');await page.waitForLoadState('networkidle',{timeout:15000});
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Horizontal overflow on '+route);
  }
  stage.route='/';await page.goto(servers[mode].origin+'/');await page.waitForFunction(()=>window.__corvusMeasure.ready!==null);
  const visible=await page.locator('main').innerText(),key=browserName+'|'+profile;
  if(mode==='js-control')content[key]=visible;
  if(content[key])assert.equal(visible,content[key],'Public main text differs from control');
  await page.locator('#lang-switcher a[hreflang=nl]').click();await page.waitForFunction(()=>document.documentElement.lang==='nl');
  await page.reload();await page.waitForFunction(()=>window.__corvusMeasure.ready!==null&&document.documentElement.lang==='nl');
  await page.locator('#lang-switcher a[hreflang=en]').click();await page.waitForFunction(()=>document.documentElement.lang==='en');
  await page.locator('[data-newsletter] [name=email]').fill('ten-experiments@example.test');await page.locator('[data-newsletter] [name=email]').blur();
  await page.keyboard.press('/');assert(await page.locator('.site-search').isVisible());await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-newsletter] [name=email]').inputValue(),'ten-experiments@example.test');
  await page.waitForLoadState('networkidle',{timeout:15000});
  assert.deepEqual(faults,[],'Application exceptions');
  await page.screenshot({path:out+`/${mode}-${browserName}-${profile}.png`,fullPage:true});
  functional.push({mode,browser:browserName,profile,passed:true,requests});log('FUNCTIONAL PASS',{mode,browser:browserName,profile});
 }catch(e){functional.push({mode,browser:browserName,profile,error:e.message,faults,requests});log('FUNCTIONAL FAIL',{mode,browser:browserName,profile,error:e.message});await page.screenshot({path:out+`/${mode}-${browserName}-${profile}-failed.png`,fullPage:true}).catch(()=>{});}
 finally{await context.close();await checkpoint();}
}
async function audit(mode,profile,repeat,route='/'){
 const chrome=await launch({chromePath:chromium.executablePath(),chromeFlags:['--headless','--no-sandbox']});let connection;
 try{
  connection=await chromium.connectOverCDP('http://127.0.0.1:'+chrome.port);const context=connection.contexts()[0],origin=servers[mode].origin;
  await context.addCookies([{name:'corvus_realm',value:'1',url:origin}]);const p=await context.newPage();await p.goto(origin+'/__benchmark_setup.html');
  await p.evaluate(()=>{localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny'}));sessionStorage.setItem('twitch-disabled','1');});await p.close();
  const {lhr}=await lighthouse(origin+route,{port:chrome.port,onlyCategories:['performance'],logLevel:'error',disableStorageReset:true},profile==='desktop'?desktopConfig:undefined);
  await writeFile(out+`/lighthouse-${mode}-${profile}-${repeat}.json`,JSON.stringify(lhr));if(lhr.runtimeError)throw Error(lhr.runtimeError.message);
  const metric=n=>lhr.audits[n]?.numericValue??null;
  const row={mode,profile,repeat,route,score:lhr.categories.performance.score*100,fcp:metric('first-contentful-paint'),lcp:metric('largest-contentful-paint'),tbt:metric('total-blocking-time'),cls:metric('cumulative-layout-shift'),speedIndex:metric('speed-index'),settings:lhr.configSettings,version:lhr.lighthouseVersion,warnings:lhr.runWarnings};
  assert([row.score,row.lcp,row.tbt,row.cls].every(Number.isFinite));audits.push(row);log('LIGHTHOUSE',{mode,profile,repeat,route,score:row.score,lcp:row.lcp,tbt:row.tbt});
 }catch(e){audits.push({mode,profile,repeat,route,error:e.message});log('LIGHTHOUSE FAIL',{mode,profile,repeat,error:e.message});}
 finally{if(connection)await connection.close();await chrome.kill();await checkpoint();}
}
try{
 for(const mode of modes){const p=prepared.options(mode);servers[mode]=await createPerformanceServer(fixture.root,p.engine,p.server);}
 // Prime the static server's representations, including q11, BEFORE timing.
 // Each measured visitor still gets a fresh browser cache. This models published
 // static compression, not a server compressing a binary on the visitor's path.
 const warmBrowser=await chromium.launch();
 try{for(const mode of modes){const {context,page}=await contextFor(warmBrowser,mode,'desktop');try{for(const route of [...new Set(['/','/map/','/cv/tech/',auditRoute])]){const value=await samplePerformance(page,route,'cold-context',servers[mode].origin);warmups.push({mode,route,...value});log('WARMUP',{mode,route,ready:value.ready,error:value.error});await checkpoint();await page.keyboard.press('Escape');await page.waitForLoadState('networkidle',{timeout:15000});}}catch(e){warmups.push({mode,error:e.message});}finally{await context.close();}}}finally{await warmBrowser.close();}
 await checkpoint();log('PREPARED',{out,fixture:fixture.root});
 if(['all','functional'].includes(suite))for(const[browserName,type]of Object.entries({chromium,webkit})){const b=await type.launch();try{for(const profile of ['mobile','desktop'])for(const mode of modes)await check(b,browserName,mode,profile);}finally{await b.close();}}
 if(['all','timing'].includes(suite)){
  const b=freshProcess?null:await chromium.launch();if(b)report.browser=b.version();
  try{for(const profile of ['mobile','desktop'])for(const route of routes)for(let repeat=0;repeat<repeats;repeat++)for(const mode of repeat%2?[...modes].reverse():modes){
   const measuredBrowser=b||await chromium.launch();report.browser=measuredBrowser.version();
   const{context,page}=await contextFor(measuredBrowser,mode,profile,true);
   try{for(const cache of ['cold-context','warm']){const value=await samplePerformance(page,route,cache,servers[mode].origin);const row={mode,profile,route,repeat,cache,...value};samples.push(row);log('TIMING',{mode,profile,route,repeat,cache,ready:row.ready,error:row.error});await page.keyboard.press('Escape');await page.waitForLoadState('networkidle',{timeout:15000});}}catch(e){errors.push({mode,profile,route,repeat,error:e.message});}finally{await context.close();if(!b)await measuredBrowser.close();await checkpoint();}
  }}finally{if(b)await b.close();}
 }
 if(['all','lighthouse'].includes(suite))for(const profile of ['mobile','desktop'])for(let repeat=0;repeat<repeats;repeat++)for(const mode of repeat%2?[...modes].reverse():modes)await audit(mode,profile,repeat,auditRoute);
 report.finished=new Date().toISOString();report.headAfter=git('rev-parse','HEAD');
 report.assetFailures=Object.fromEntries(Object.entries(servers).map(([k,s])=>[k,[...s.failures]]));report.unknownAPIs=Object.fromEntries(Object.entries(servers).map(([k,s])=>[k,[...s.unknown]]));report.assets=Object.fromEntries(Object.entries(servers).map(([k,s])=>[k,s.assets()]));
 report.bundleHashesAfter=await Promise.all(manifest.artifacts.map(async a=>({dir:a.dir,sha256:createHash('sha256').update(await readFile(a.dir+'/corvus_browser_bg.wasm')).digest('hex')})));
 await checkpoint();log('REPORT',out+'/report.json');
}catch(e){errors.push({fatal:e.message,stack:e.stack});await checkpoint();throw e;}
finally{for(const s of Object.values(servers))await s.close();await fixture.close();}
