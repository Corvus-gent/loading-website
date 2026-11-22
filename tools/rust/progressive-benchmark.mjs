// Exploratory navigation experiment: controls + treatment, including wasted bytes.
// This never substitutes for the existing direct-load/performance release gates.
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {buildFixture} from '../../tests/helpers/built-site.mjs';
import {createPerformanceServer,observePerformance,samplePerformance,PROFILES,quantile} from './performance.mjs';
import {progressiveHtml,progressiveAssetPath} from './progressive-delivery.mjs';

const opts=Object.fromEntries(process.argv.slice(2).map(value=>value.split('=')));
const repeats=Number(opts['--repeats']||3),profiles=(opts['--profiles']||'mobile,desktop').split(',');
if(!Number.isInteger(repeats)||repeats<1||repeats>20||profiles.some(p=>!PROFILES[p]))throw Error('Invalid benchmark selection');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim(),head=git('rev-parse','HEAD'),dirty=!!git('status','--porcelain'),started=new Date().toISOString();
execFileSync('bash',['tools/rust/build-browser.sh','core'],{stdio:'inherit',timeout:600000});
const wasm=await readFile('rust/browser/pkg/core/corvus_browser_bg.wasm'),hash=createHash('sha256').update(wasm).digest('hex');
const fixture=await buildFixture(),servers={},samples=[],browser=await chromium.launch();
try{
 servers.rust=await createPerformanceServer(fixture.root,'rust');
 servers.light=await createPerformanceServer(fixture.root,'rust',{assetPath:progressiveAssetPath,htmlTransform:(html,p)=>progressiveHtml(html,p,{predictive:false})});
 servers.predictive=await createPerformanceServer(fixture.root,'rust',{assetPath:progressiveAssetPath,htmlTransform:progressiveHtml});
 for(const profile of profiles)for(const scenario of ['early-click','read-then-click','wrong-prediction'])for(let repeat=-1;repeat<repeats;repeat++){
  const modes=repeat%2?['predictive','light','rust']:['rust','light','predictive'];
  for(const mode of modes){
   const cfg=PROFILES[profile],s=servers[mode],context=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},isMobile:profile==='mobile',hasTouch:profile==='mobile',locale:'en-US',timezoneId:'Europe/Brussels',serviceWorkers:'block'});
   await context.addCookies([{name:'corvus_realm',value:'1',url:s.origin}]);await context.addInitScript(observePerformance);
   const p=await context.newPage(),cdp=await context.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:cfg.cpu});
   if(cfg.down)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:cfg.latency,downloadThroughput:cfg.down,uploadThroughput:cfg.up});
   const wire=new Map(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   cdp.on('Network.dataReceived',e=>wire.set(e.requestId,(wire.get(e.requestId)||0)+e.encodedDataLength));
   cdp.on('Network.loadingFinished',e=>wire.set(e.requestId,Math.max(wire.get(e.requestId)||0,e.encodedDataLength)));
   const wireBytes=()=>[...wire.values()].reduce((sum,bytes)=>sum+bytes,0);
   try{
    const home=await samplePerformance(p,'/','cold-context',s.origin);if(home.error)throw Error(home.error);
    const homeWireBytes=wireBytes();
    const target=p.locator('.site-card[href="/gabe/"]');await target.scrollIntoViewIfNeeded();
    // Same explicit dwell for every treatment; never wait for preload completion.
    const dwell=scenario==='early-click'?0:5000;await p.waitForTimeout(dwell);
    const beforeClickBytes=wireBytes(),prediction=await p.evaluate(()=>window.corvusPredictive?.state??null),homePreClickMs=await p.evaluate(()=>performance.now());
    // Wrong prediction goes to an unprefetched core page via the existing map link.
    const next=scenario==='wrong-prediction'?'/map/':'/gabe/';
    await p.locator(next==='/gabe/'?'.site-card[href="/gabe/"]':'.site-quiet-footer a[href="/map/"]').click();
    await p.waitForFunction(()=>window.__corvusMeasure.ready!==null,{},{timeout:60000});await p.waitForLoadState('load');
    const destination=await p.evaluate(()=>({ready:window.__corvusMeasure.ready,wasm:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.wasm')).map(r=>({transfer:r.transferSize,encoded:r.encodedBodySize}))}));
    await p.keyboard.press('/');if(!await p.locator('.site-search').isVisible())throw Error('destination search unavailable');
    if(errors.length)throw Error(errors[0]);
    const row={profile,scenario,mode,repeat,dwellMs:dwell,homePreClickMs,home,next,destination,prediction,homeWireBytes,beforeClickBytes,totalWireBytes:wireBytes()};
    if(repeat>=0){samples.push(row);console.log(JSON.stringify({profile,scenario,mode,repeat,home:home.ready,next:destination.ready,bytes:row.totalWireBytes}));}
   }catch(error){if(repeat>=0)samples.push({profile,scenario,mode,repeat,error:error.message});console.log('FAIL',profile,scenario,mode,error.message);}finally{await context.close();}
  }
 }
 const summary=[];for(const profile of profiles)for(const scenario of ['early-click','read-then-click','wrong-prediction'])for(const mode of Object.keys(servers)){
  const all=samples.filter(s=>s.profile===profile&&s.scenario===scenario&&s.mode===mode),good=all.filter(s=>!s.error);
  summary.push({profile,scenario,mode,n:all.length,failures:all.filter(s=>s.error).map(s=>s.error),homeReadyMs:quantile(good.map(s=>s.home.ready),.5),nextReadyMs:quantile(good.map(s=>s.destination.ready),.5),beforeClickBytes:quantile(good.map(s=>s.beforeClickBytes),.5),totalWireBytes:quantile(good.map(s=>s.totalWireBytes),.5)});
 }
 const report={version:1,started,finished:new Date().toISOString(),head,headAfter:git('rev-parse','HEAD'),workingTreeDirty:dirty||!!git('status','--porcelain'),browser:browser.version(),repeats,profiles,conditions:PROFILES,wasmSha256:hash,wasmChanged:hash!==createHash('sha256').update(await readFile('rust/browser/pkg/core/corvus_browser_bg.wasm')).digest('hex'),productionReady:false,
  method:'Same built pages and 40 ms fixture APIs. Alternating Rust-everywhere, lightweight-JS-home/Rust-next, and lightweight-home with bounded prediction. One unrecorded warmup each. Fresh context per journey. Real HTTP cache/Brotli, fixed dwell independent of prefetch completion. Prediction requests included in CDP wire bytes, retaining received chunks when transfers abort; aborted response headers may be undercounted. Readiness uses unchanged functional search/directory checks. No browser request interception or production providers. Original direct-load benchmark remains unchanged.',
  limitations:['Exploratory; not a release gate or production speedup.','Lightweight home deliberately retains existing JS: not all-Rust browser code.','Chromium emulation, not actual iPhone/Safari or Android field data.','Direct arrivals on deeper pages still pay their cold WASM cost.','A wrong destination here shares the core bundle; totally unrelated feature pages may waste the whole prefetch.','HTML prefetch reuse depends on browser support and cache policy; WASM cache hits are recorded separately.'],summary,samples,unknown:Object.fromEntries(Object.entries(servers).map(([k,s])=>[k,[...s.unknown]])),assetFailures:Object.fromEntries(Object.entries(servers).map(([k,s])=>[k,[...s.failures]]))};
 await mkdir('test-results/rust/measurements',{recursive:true});const file='test-results/rust/measurements/progressive-'+started.replace(/[:.]/g,'-')+'.json';await writeFile(file,JSON.stringify(report,null,2)+'\n');console.log('REPORT',file);
 if(samples.some(s=>s.error)||Object.values(report.unknown).some(a=>a.length)||Object.values(report.assetFailures).some(a=>a.length)||report.wasmChanged||report.head!==report.headAfter)process.exitCode=1;
}finally{await browser.close();for(const s of Object.values(servers))await s.close();await fixture.close();}
