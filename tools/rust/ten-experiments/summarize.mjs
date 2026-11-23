// Compact, reproducible numerical evidence. Full traces/screenshots stay local.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const args=Object.fromEntries(process.argv.slice(2).map(s=>s.split(/=(.*)/s).slice(0,2)));
const names=(args['--runs']||'ten-independent,ten-combined,ten-refined,ten-final,ten-confirmation,ten-fresh,ten-journeys,ten-languages').split(',');
const out=args['--out']||'docs/rust-migration/evidence/2026-11-23-ten-experiments.json';
const round=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
function stats(values) {
 const a=values.filter(Number.isFinite).sort((a,b)=>a-b),n=a.length;
 if(!n)return{n:0,mean:null,median:null,min:null,max:null,p95:null};
 return{n,mean:round(a.reduce((x,y)=>x+y,0)/n),median:round(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2),min:round(a[0]),max:round(a[n-1]),p95:round(a[Math.ceil(n*.95)-1])};
}
function groups(rows,keys,metrics) {
 const map=new Map();for(const row of rows){const id=JSON.stringify(keys.map(k=>row[k]??null));if(!map.has(id))map.set(id,[]);map.get(id).push(row);}
 return[...map.values()].map(group=>({
  ...Object.fromEntries(keys.map(k=>[k,group[0][k]??null])),attempted:group.length,
  failed:group.filter(r=>r.error).length,
  metrics:Object.fromEntries(metrics.map(k=>[k,stats(group.filter(r=>!r.error).map(r=>r[k]))])),
  // Retain every repetition, including failure rows, to avoid best-run reporting.
  repetitions:group.map(r=>({repeat:r.repeat,...Object.fromEntries(metrics.map(k=>[k,round(r[k])])),...(r.error?{error:r.error}:{}),...(r.faults?{faults:r.faults}:{})}))
 }));
}
const runs=[];
for(const name of names){
 const file=`test-results/rust/measurements/${name}/report.json`,raw=await readFile(file),r=JSON.parse(raw);
 if(!r.finished)throw Error(`Incomplete run: ${name}`);
 const journey=!!r.samples?.some(s=>Object.hasOwn(s,'scenario'));
 const localized=!!r.locales;
 const sampleKeys=(r.samples||[]).map(s=>JSON.stringify([s.mode,s.profile,s.route??s.scenario??s.locale,s.repeat,s.cache??null]));
 const duplicates=sampleKeys.length-new Set(sampleKeys).size;
 const expectedSamples=journey?4*2*4*r.repeats:localized?r.modes.length*2*r.locales.length*2*r.repeats:['all','timing'].includes(r.suite)?r.modes.length*2*r.routes.length*2*r.repeats:0;
 const expectedAudits=['all','lighthouse'].includes(r.suite)?r.modes.length*2*r.repeats:0;
 runs.push({name,file,sha256:createHash('sha256').update(raw).digest('hex'),head:r.head,headAfter:r.headAfter,started:r.started,finished:r.finished,
  dirty:r.workingTreeDirty,host:r.host,browser:r.browser,conditions:r.conditions,fixtureLatencyMs:r.fixtureLatencyMs??40,
  modes:r.modes,repeats:r.repeats,routes:r.routes,locales:r.locales,combined:r.combined,pageWasm:r.pageWasm,rustBest:r.rustBest,
  freshBrowserProcessPerPair:r.freshBrowserProcessPerPair??false,
  completeness:{expectedSamples,actualSamples:r.samples?.length??0,duplicateSamples:duplicates,expectedAudits,actualAudits:r.audits?.length??0},
  timing:groups(r.samples||[],journey?['mode','profile','scenario']:localized?['mode','profile','locale','cache']:['mode','profile','route','cache'],journey?['homeReady','nextReady','clickToReady','homeBeforeClick','preClickBytes','predictionWireBytes','totalBytes']:['ready','allReady','pageCopyReady','fcp','lcp','cls','transfer','jsEncoded','wasmEncoded','requests','actionNextFrame']),
  lighthouse:groups(r.audits||[],['mode','profile','route'],['score','fcp','lcp','tbt','cls','speedIndex']),
  lighthouseSettings:[...new Map((r.audits||[]).filter(a=>a.settings).map(a=>[a.profile,{profile:a.profile,version:a.version,settings:a.settings}])).values()],
  functional:(r.functional||[]).map(({mode,browser,profile,passed,error,faults})=>({mode,browser,profile,passed:passed??false,error,faults})),
  errors:r.errors,assetFailures:r.assetFailures,unknownAPIs:r.unknownAPIs,
  artifacts:r.artifacts,pageWasmArtifact:r.pageWasmArtifact,bundleHashesAfter:r.bundleHashesAfter,
  bundles:r.bundles?.map(({mode,route,kind,url,bytes,brotli,gzip,sha256})=>({mode,route,kind,url,bytes,brotli,gzip,sha256})),
 });
}
const evidence={version:1,generated:new Date().toISOString(),productionChanged:false,
 method:'Local Node fixture with identical static HTML/content and 40 ms mock APIs. Entered-ritual cookie and analytics refusal. Cold context is empty HTTP cache/storage; ordinary runs share a Chromium process. Fresh-process runs launch Chrome per cold/warm pair. Mobile readiness: 390x844, 4x CPU, 150 ms latency, 200000 bytes/s down, 93750 up. Desktop: 1440x1000, native CPU, unshaped local network. Lighthouse uses its own standard simulated mobile/desktop settings; it does not measure application controls readiness. Static representations warmed on server before all measurements. All runs and failures retained.',
 caveats:['Not physical-phone, field, CDN, Rust-server or serverless-cold measurements.','Not a whole-site speed or release claim. Home readiness means directory event plus usable search; map includes dynamic public enrichment.','Sample min/max are observed bounds, not promised best/worst cases. P95 from small samples is descriptive only.','Lighthouse and readiness use different network simulation settings; report both.','Browser privacy refusal disables third-party analytics/embeds; first ritual entry is functionally tested separately.','Journey prediction is tested on scripted intentions, not a measured real-user hit rate. Aborted response headers can be undercounted in CDP byte totals.'],runs};
await mkdir(path.dirname(out),{recursive:true});await writeFile(out,JSON.stringify(evidence,null,2)+'\n');
console.log(out);
for(const r of runs){console.log(`\n${r.name}: ${r.timing.reduce((n,g)=>n+g.attempted,0)} timings, ${r.lighthouse.reduce((n,g)=>n+g.attempted,0)} audits`);for(const g of r.timing.filter(g=>g.cache==='cold-context'&&g.route==='/'))console.log(g.mode,g.profile,g.metrics.ready);}
