import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {writeFile,mkdir,rename} from 'node:fs/promises';
import {buildFixture} from '../../../tests/helpers/built-site.mjs';
import {createPerformanceServer,observePerformance,samplePerformance,PROFILES,quantile} from '../performance.mjs';
import {prepareVariants} from './variants.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(s=>s.split(/=(.*)/s).slice(0,2))),repeats=Number(args['--repeats']||5);
if(!Number.isInteger(repeats)||repeats<1||repeats>30)throw Error('Invalid repeats');
const combined=(args['--combined']||'bundle,parallel,directory,brotli,locale,predict,footer-logo').split(',');
const started=new Date().toISOString(),out=args['--out']||'test-results/rust/measurements/journeys-'+started.replace(/[:.]/g,'-');await mkdir(out,{recursive:true});
const fixture=await buildFixture(),variants=await prepareVariants(fixture.root,{combined}),servers={},samples=[],errors=[];
const modes=['js-control','rust-control','combined-static','combined-predictive'];
const report={version:1,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),started,combined,conditions:PROFILES,repeats,productionReady:false,samples,errors};
async function save(){report.updated=new Date().toISOString();report.summary=[];
 for(const profile of Object.keys(PROFILES))for(const scenario of ['early','reading','wrong','unused'])for(const mode of modes){const rows=samples.filter(s=>s.mode===mode&&s.profile===profile&&s.scenario===scenario),good=rows.filter(s=>!s.error),vals=good.map(s=>s.nextReady).filter(Number.isFinite);report.summary.push({profile,scenario,mode,n:rows.length,failures:rows.filter(s=>s.error).length,homeMedian:quantile(good.map(s=>s.homeReady),.5),nextMedian:quantile(vals,.5),nextMean:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,nextMin:quantile(vals,0),nextMax:quantile(vals,1),preClickBytes:quantile(good.map(s=>s.preClickBytes),.5),totalBytes:quantile(good.map(s=>s.totalBytes),.5),predictionBytes:quantile(good.map(s=>s.predictionWireBytes),.5)});}
 await writeFile(out+'/report.pending.json',JSON.stringify(report,null,2)+'\n');await rename(out+'/report.pending.json',out+'/report.json');}
let browser;
try{
 for(const mode of modes){const v=variants.options(mode.startsWith('combined')?'10-combined':mode);
  if(mode==='combined-static'){const transform=v.server.htmlTransform;v.server.htmlTransform=(html,url)=>transform(html,url).replace(/<script type="application\/json" id="corvus-experiment-prediction">[\s\S]*?<\/script><script type="module" src="\/__experiments\/predict.js"><\/script>/,'');}
  servers[mode]=await createPerformanceServer(fixture.root,v.engine,v.server);
 }
 browser=await chromium.launch();report.browser=browser.version();
 for(const mode of modes){const c=await browser.newContext();await c.addInitScript(observePerformance);await c.addCookies([{name:'corvus_realm',value:'1',url:servers[mode].origin}]);const p=await c.newPage();for(const route of ['/','/gabe/','/map/']){const s=await samplePerformance(p,route,'cold-context',servers[mode].origin);if(s.error)errors.push({warmup:mode,route,error:s.error});await p.keyboard.press('Escape');await p.waitForLoadState('networkidle');}await c.close();}
 for(const profile of ['mobile','desktop'])for(const scenario of ['early','reading','wrong','unused'])for(let repeat=0;repeat<repeats;repeat++)for(const mode of repeat%2?[...modes].reverse():modes){
  const cfg=PROFILES[profile],origin=servers[mode].origin,c=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},isMobile:profile==='mobile',hasTouch:profile==='mobile',locale:'en-US',timezoneId:'Europe/Brussels',serviceWorkers:'block'});
  await c.addCookies([{name:'corvus_realm',value:'1',url:origin}]);await c.addInitScript(observePerformance);const p=await c.newPage(),cdp=await c.newCDPSession(p),wire=new Map(),urls=new Map(),faults=[];
  await cdp.send('Network.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:cfg.cpu});if(cfg.down)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:cfg.latency,downloadThroughput:cfg.down,uploadThroughput:cfg.up});
  cdp.on('Network.requestWillBeSent',e=>urls.set(e.requestId,e.request.url));cdp.on('Network.dataReceived',e=>wire.set(e.requestId,(wire.get(e.requestId)||0)+e.encodedDataLength));cdp.on('Network.loadingFinished',e=>wire.set(e.requestId,Math.max(wire.get(e.requestId)||0,e.encodedDataLength)));
  const bytes=()=>[...wire.values()].reduce((a,b)=>a+b,0);p.on('pageerror',e=>faults.push(e.message));
  try{
   await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__corvusMeasure.ready!==null,{},{timeout:60000});const homeReady=await p.evaluate(()=>window.__corvusMeasure.ready);
   await p.locator('.site-card[href="/gabe/"]').scrollIntoViewIfNeeded();await p.waitForTimeout(scenario==='early'?150:2500);
   const prediction=await p.evaluate(()=>window.corvusPrediction?.state??null),preClickBytes=bytes(),homeBeforeClick=await p.evaluate(()=>performance.now());
   const predicted=new Set((prediction?.assets||[]).map(s=>origin+s)),predictionWireBytes=[...wire].filter(([id])=>predicted.has(urls.get(id))).reduce((a,[,b])=>a+b,0);
   let nextReady=null,destination=null,cache=[],clickToReady=null;
   if(scenario!=='unused'){
    destination=scenario==='wrong'?'/map/':'/gabe/';const link=p.locator(scenario==='wrong'?'.site-quiet-footer a[href="/map/"]':'.site-card[href="/gabe/"]');const clickStart=performance.now();
    await Promise.all([p.waitForURL(origin+destination),link.click()]);await p.waitForFunction(()=>window.__corvusMeasure.ready!==null,{},{timeout:60000});clickToReady=performance.now()-clickStart;
    ({ready:nextReady,cache}=await p.evaluate(()=>({ready:window.__corvusMeasure.ready,cache:performance.getEntriesByType('resource').filter(r=>/\.js|\.wasm/.test(r.name)).map(r=>({url:r.name,transfer:r.transferSize,encoded:r.encodedBodySize}))})));
    await p.keyboard.press('/');if(!await p.locator('.site-search').isVisible())throw Error('Destination search unavailable');await p.keyboard.press('Escape');
   }
   if(faults.length)throw Error(faults[0]);const row={mode,profile,scenario,repeat,homeReady,homeBeforeClick,dwellMs:scenario==='early'?150:2500,destination,nextReady,clickToReady,prediction,preClickBytes,predictionWireBytes,totalBytes:bytes(),cache};samples.push(row);console.log('JOURNEY',JSON.stringify({mode,profile,scenario,repeat,homeReady,nextReady,predictionWireBytes}));
  }catch(e){samples.push({mode,profile,scenario,repeat,error:e.message,faults});console.log('FAIL',mode,profile,scenario,e.message);}finally{await c.close();await save();}
 }
 report.finished=new Date().toISOString();report.assetFailures=Object.fromEntries(Object.entries(servers).map(([k,s])=>[k,[...s.failures]]));report.unknownAPIs=Object.fromEntries(Object.entries(servers).map(([k,s])=>[k,[...s.unknown]]));await save();console.log('REPORT',out+'/report.json');
}finally{if(browser)await browser.close();for(const s of Object.values(servers))await s.close();await fixture.close();}
