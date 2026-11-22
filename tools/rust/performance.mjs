// Controlled paired browser lab. No production requests, real users or serverless-cold claims.
import{chromium}from'@playwright/test';import http from'node:http';import{readFile,writeFile,mkdir}from'node:fs/promises';import{brotliCompressSync,gzipSync,constants as z}from'node:zlib';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import os from'node:os';import path from'node:path';import{fileURLToPath}from'node:url';import{buildFixture}from'../../tests/helpers/built-site.mjs';import{wasmBridge}from'../../tests/helpers/rust-bridges.mjs';
export const PROFILES={desktop:{width:1440,height:1000,cpu:1,latency:0,down:0,up:0},mobile:{width:390,height:844,cpu:4,latency:150,down:200000,up:93750}};
import{browserProfileHtml,browserProfile}from'./browser-profiles.mjs';
export const ROUTES=['/','/map/','/cv/tech/'];
export const quantile=(values,p)=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a[Math.max(0,Math.ceil(a.length*p)-1)]:null;};
export function summarize(samples){
 const groups=new Map();for(const s of samples){const key=[s.engine,s.profile,s.route,s.cache].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);}
 return [...groups].map(([key,rows])=>{const[engine,profile,route,cache]=key.split('|'),ok=rows.filter(r=>!r.error);return{engine,profile,route,cache,n:rows.length,successes:ok.length,failures:rows.filter(r=>r.error).map(r=>r.error),metrics:Object.fromEntries(['ttfb','fcp','lcp','ready','cls','longTaskMax','longTaskTotal','transfer','jsEncoded','wasmEncoded','requests','actionNextFrame'].map(k=>[k,{p50:quantile(ok.map(r=>r[k]),.5),p95:quantile(ok.map(r=>r[k]),.95)}]))};});
}
const types={'.html':'text/html','.txt':'text/plain','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff'};
const API={
 '/api/live':{live:false,session:'performance-fixture',platforms:{twitch:false},source:'manual'},
 '/api/legion':{profiles:[],members:[],total:0,tiers:{},applications:0},
 '/api/army':{self:null,members:[],soldiers:0,leaderboard:[],ready:false},
 '/api/compound-v2':{videos:[]},
 '/api/plethora':{ready:true,total:12},
 '/api/x-stats':{ready:false},
};
async function server(root,engine,{htmlTransform,assetPath=value=>value}={}){
 const cache=new Map(),unknown=new Set(),failures=new Set(),source=process.cwd();
 const instance=http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://fixture');if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
   if(u.pathname.startsWith('/api/')){if(!Object.hasOwn(API,u.pathname)){unknown.add(u.pathname);res.writeHead(404).end();return;}await new Promise(r=>setTimeout(r,40));res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');res.end(JSON.stringify(API[u.pathname]));return;}
   let entry=cache.get(u.pathname);
   if(!entry){const bridge=engine==='rust'?wasmBridge(u.pathname):null;let body,mime;
    if(bridge){body=Buffer.from(bridge);mime='text/javascript';}
    else{let file=assetPath(decodeURIComponent(u.pathname));if(file.split('/').some(p=>p.startsWith('.')||['node_modules','target'].includes(p)))throw Error('private path');if(!path.extname(file))file=file.replace(/\/$/,'')+'/index.html';const base=file.startsWith('/rust/browser/pkg/')?source:root;const full=path.resolve(base,'.'+file);if(!full.startsWith(base+path.sep))throw Error('path');body=await readFile(full);if(file.endsWith('.html'))body=Buffer.from(htmlTransform?htmlTransform(body.toString('utf8'),u.pathname):engine==='rust'?browserProfileHtml(body.toString('utf8'),u.pathname):body);mime=types[path.extname(file)]||'application/octet-stream';}
    const compress=/text\/|json|wasm|svg/.test(mime),packed=compress?brotliCompressSync(body,{params:{[z.BROTLI_PARAM_QUALITY]:4}}):body;
    entry={body,packed,gzip:compress?gzipSync(body):body,mime,compressed:compress,etag:'"'+createHash('sha256').update(body).digest('hex')+'"'};cache.set(u.pathname,entry);
   }
   const document=entry.mime==='text/html';res.setHeader('content-type',entry.mime);res.setHeader('cache-control',document?'no-store':'public, max-age=86400');res.setHeader('etag',entry.etag);
   if(document)res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'");
   if(!document&&req.headers['if-none-match']===entry.etag){res.writeHead(304).end();return;}
   const accept=req.headers['accept-encoding']||'',br=entry.compressed&&/\bbr\b/.test(accept),gzip=entry.compressed&&!br&&/\bgzip\b/.test(accept);if(br||gzip){res.setHeader('content-encoding',br?'br':'gzip');}if(entry.compressed)res.setHeader('vary','Accept-Encoding');
   const body=br?entry.packed:gzip?entry.gzip:entry.body;res.setHeader('content-length',body.length);res.end(req.method==='HEAD'?undefined:body);
  }catch{failures.add(new URL(req.url,'http://fixture').pathname);res.writeHead(404).end();}
 });await new Promise(r=>instance.listen(0,'127.0.0.1',r));
 return{origin:'http://127.0.0.1:'+instance.address().port,unknown,failures,assets:()=>[...cache].filter(([p])=>/\.(?:js|wasm)$/.test(p)).map(([p,e])=>({path:p,raw:e.body.length,brotli:e.packed.length})),close:async()=>{instance.closeAllConnections();await new Promise(r=>instance.close(r));}};
}
function observe(){
 localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny'}));sessionStorage.setItem('twitch-disabled','1');
 const m=window.__corvusMeasure={lcp:null,cls:0,longTaskMax:0,longTaskTotal:0,ready:null};let session=0,start=0,last=0;
 const observe=(type,cb)=>{try{new PerformanceObserver(list=>list.getEntries().forEach(cb)).observe({type,buffered:true});}catch{}};
 observe('largest-contentful-paint',e=>m.lcp=e.startTime);
 observe('longtask',e=>{m.longTaskMax=Math.max(m.longTaskMax,e.duration);m.longTaskTotal+=e.duration;});
 observe('layout-shift',e=>{if(e.hadRecentInput)return;if(!start||e.startTime-last>1000||e.startTime-start>5000){session=0;start=e.startTime;}session+=e.value;last=e.startTime;m.cls=Math.max(m.cls,session);});
 const check=()=>{const cv=location.pathname.startsWith('/cv/'),ready=cv?document.querySelector('[data-cv-secret][title]'):m.directoryReady&&document.querySelector('.site-search');if(ready&&m.ready===null){m.ready=performance.now();observer.disconnect();}};
 addEventListener('corvus-directory-ready',()=>{m.directoryReady=true;check();});const observer=new MutationObserver(check);observer.observe(document,{childList:true,subtree:true,attributes:true});check();
}
async function sample(page,route,cache,origin){
 const faults=[];const error=e=>faults.push(e.message);page.on('pageerror',error);
 try{
  const response=cache==='warm'?await page.reload({waitUntil:'domcontentloaded',timeout:60000}):await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:60000});if(response.status()!==200)throw Error('HTTP '+response.status());
  await page.waitForFunction(()=>typeof window.__corvusMeasure?.ready==='number',{},{timeout:60000});await page.waitForLoadState('load',{timeout:60000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(800);
  const data=await page.evaluate(()=>{const m=window.__corvusMeasure,n=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource'),sum=f=>resources.filter(f).reduce((n,r)=>n+r.encodedBodySize,0);return{ttfb:n.responseStart-n.requestStart,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,lcp:m.lcp,cls:m.cls,ready:m.ready,longTaskMax:m.longTaskMax,longTaskTotal:m.longTaskTotal,transfer:n.transferSize+resources.reduce((n,r)=>n+r.transferSize,0),jsEncoded:sum(r=>/\.(?:m?js)(?:\?|$)/.test(r.name)),wasmEncoded:sum(r=>/\.wasm(?:\?|$)/.test(r.name)),requests:resources.length+1};});
  const action=await page.evaluate(async()=>{const start=performance.now();let check;
   if(location.pathname.startsWith('/cv/')){const b=document.querySelector('[data-cv-secret]');b.click();check=()=>b.textContent===Number(512).toString(2);}
   else if(location.pathname==='/map/'){const input=document.querySelector('[data-directory-filter]');input.value='OSSMAN';input.dispatchEvent(new Event('input',{bubbles:true}));check=()=>[...document.querySelectorAll('.site-directory a')].some(a=>a.textContent.includes('OSSMAN')&&a.getClientRects().length);}
   else{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true}));check=()=>document.querySelector('.site-search')?.open;}
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(!check())throw Error('interaction did not produce expected result');return performance.now()-start;
  });if(faults.length)throw Error('Browser application error: '+faults[0]);return{...data,actionNextFrame:action};
 }catch(e){return{error:String(e.message).split('\n')[0]};}finally{page.off('pageerror',error);}
}
export async function run({repeats=3,profiles=Object.keys(PROFILES),routes=ROUTES,out='test-results/rust/measurements'}={}){
 if(!Number.isInteger(repeats)||repeats<1||repeats>50||!profiles.length||!routes.length||new Set(profiles).size!==profiles.length||new Set(routes).size!==routes.length||profiles.some(p=>!PROFILES[p])||routes.some(r=>!ROUTES.includes(r)))throw Error('Invalid benchmark selection');
 const started=new Date().toISOString(),git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim(),head=git('rev-parse','HEAD'),dirtyBefore=!!git('status','--porcelain');
 // Never time a stale ignored pkg artifact left by another revision.
 execFileSync('bash',['tools/rust/build-browser.sh'],{stdio:'inherit',timeout:600000});
 const selectedBundle=routes.every(r=>browserProfile(r)==='core')?'core/':'';
 const wasmBefore=await readFile('rust/browser/pkg/'+selectedBundle+'corvus_browser_bg.wasm'),wasmHash=createHash('sha256').update(wasmBefore).digest('hex');
 const fixture=await buildFixture(),servers={},samples=[];let browser;
 try{
  for(const engine of ['legacy','rust'])servers[engine]=await server(fixture.root,engine);browser=await chromium.launch();
  for(const profile of profiles)for(const route of routes)for(let repeat=-1;repeat<repeats;repeat++){
   // Alternate treatment order to reduce systematic warming/thermal/order bias.
   for(const engine of repeat%2?['rust','legacy']:['legacy','rust']){
    const cfg=PROFILES[profile],s=servers[engine],context=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},isMobile:profile==='mobile',hasTouch:profile==='mobile',locale:'en-US',timezoneId:'Europe/Brussels',serviceWorkers:'block'});
    await context.addCookies([{name:'corvus_realm',value:'1',url:s.origin,sameSite:'Lax'}]);await context.addInitScript(observe);const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cfg.cpu});if(cfg.down)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:cfg.latency,downloadThroughput:cfg.down,uploadThroughput:cfg.up});
    try{for(const cache of ['cold-context','warm']){const result=await sample(page,route,cache,s.origin);if(repeat>=0){samples.push({engine,profile,route,cache,repeat,...result});console.log(JSON.stringify({engine,profile,route,cache,repeat,ready:result.ready,error:result.error}));}}}finally{await context.close();}
   }
  }
  const wasm=await readFile('rust/browser/pkg/'+selectedBundle+'corvus_browser_bg.wasm'),summary=summarize(samples),report={version:1,started,finished:new Date().toISOString(),head,headAfter:git('rev-parse','HEAD'),workingTreeDirty:dirtyBefore||!!git('status','--porcelain'),wasmBuiltFromHead:head,wasmChangedDuringRun:wasmHash!==createHash('sha256').update(wasm).digest('hex'),browser:browser.version(),node:process.version,host:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length},profiles:PROFILES,selectedProfiles:profiles,repeats,routes,fixtureLatencyMs:40,wasm:{profile:selectedBundle?'core':'full',sha256:createHash('sha256').update(wasm).digest('hex'),rawBytes:wasm.length},method:'Same built HTML/assets, same local API fixtures, paired alternating legacy JS vs current Rust/WASM bridges. One unrecorded warmup per route/profile. Cold-context means fresh browser HTTP/storage context, not a cold browser process or serverless start; warm reload retains that context. Static assets use HTTP cache/ETags and Brotli quality 4. CSP blocks external requests; no third-party analytics/embeds, real providers or mutations. Returning-visitor gate cookie and explicit analytics refusal. Ready means search/directory usable or CV interactions mounted. Action is a synthetic DOM event to two animation frames, not field INP. LCP/CLS are bounded lab observations, not real-user percentiles.',limitations:['Only listed page flows are measured; not a whole-site pass.','API/Redis, serverless cold starts, real-network CDN regions and field INP remain separate release gates.','Timing is local and hardware-specific. Fewer than 20 repetitions are exploratory; no release speedup claim.','Known public pages select the core WASM profile through an import map; feature pages still retain the full bundle until their profiles pass parity. Production publishing remains a separate gate.'],summary,samples,unknownFixtureEndpoints:Object.fromEntries(Object.entries(servers).map(([e,s])=>[e,[...s.unknown]])),assetFailures:Object.fromEntries(Object.entries(servers).map(([e,s])=>[e,[...s.failures]])),assets:Object.fromEntries(Object.entries(servers).map(([e,s])=>[e,s.assets()]))};
  await mkdir(out,{recursive:true});const stamp=started.replace(/[:.]/g,'-'),file=path.join(out,'browser-'+stamp+'.json');await writeFile(file,JSON.stringify(report,null,2)+'\n');console.log('REPORT '+file);return{file,report};
 }finally{if(browser)await browser.close();for(const s of Object.values(servers))await s.close();await fixture.close();}
}
export {server as createPerformanceServer,observe as observePerformance,sample as samplePerformance};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const opts=Object.fromEntries(process.argv.slice(2).map(v=>v.split(/=(.*)/s).slice(0,2)));const{report}=await run({repeats:Number(opts['--repeats']||3),...(opts['--profiles']?{profiles:opts['--profiles'].split(',')}:{}),...(opts['--routes']?{routes:opts['--routes'].split(',')}:{}),...(opts['--out']?{out:opts['--out']}:{})});if(report.samples.some(s=>s.error)||Object.values(report.unknownFixtureEndpoints).some(a=>a.length)||Object.values(report.assetFailures).some(a=>a.length)||report.wasmChangedDuringRun||report.head!==report.headAfter)process.exitCode=1;}
