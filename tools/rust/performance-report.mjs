import{readFile,writeFile}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{summarize}from'./performance.mjs';
// Internal no-regression budgets. These are release criteria, not promised speedups.
export const BUDGETS={ready:[1.10,50],fcp:[1.10,50],lcp:[1.10,50],actionNextFrame:[1.10,16],longTaskMax:[1.15,50],transfer:[1.05,16384]};
export function assess(report){
 const problems=[],comparisons=[],summaries=summarize(report.samples||[]);
 if(!Number.isInteger(report.repeats)||report.repeats<20)problems.push('Exploratory sample: at least 20 repetitions per condition are required for a release comparison.');
 if(report.workingTreeDirty!==false)problems.push('Working tree was dirty or not recorded; reproduce from a committed code/tool revision.');
 if(report.headAfter!==report.head||report.wasmBuiltFromHead!==report.head||report.wasmChangedDuringRun!==false)problems.push('Code or WASM build provenance changed during the run, or was not recorded.');
 if(Object.values(report.unknownFixtureEndpoints||{}).some(a=>a.length))problems.push('Unknown API fixtures were requested.');
 if(Object.values(report.assetFailures||{}).some(a=>a.length))problems.push('Some local assets failed to load.');
 if(!report.wasm?.sha256||!report.head)problems.push('Missing code or WASM provenance.');
 const pairs=new Map();for(const s of summaries){const key=[s.profile,s.route,s.cache].join('|');if(!pairs.has(key))pairs.set(key,{});pairs.get(key)[s.engine]=s;}
 const expected=(report.selectedProfiles||Object.keys(report.profiles||{})).flatMap(p=>(report.routes||[]).flatMap(r=>['cold-context','warm'].map(c=>[p,r,c].join('|'))));
 if(!expected.length)problems.push('No required measurement conditions.');
 for(const key of expected){const{legacy,rust}=pairs.get(key)||{};if(!legacy||!rust){problems.push('Missing paired samples: '+key);continue;}
  for(const s of [legacy,rust]){
   if(s.successes!==s.n||s.n!==report.repeats)problems.push('Incomplete or failed samples: '+s.engine+' '+key);
   const samples=report.samples.filter(r=>r.engine===s.engine&&[r.profile,r.route,r.cache].join('|')===key),repeats=samples.map(r=>r.repeat);
   if(new Set(repeats).size!==report.repeats||repeats.some(n=>!Number.isInteger(n)||n<0||n>=report.repeats))problems.push('Duplicate/missing repeat identity: '+s.engine+' '+key);
   if(samples.some(r=>Object.keys(s.metrics).some(k=>!Number.isFinite(r[k])||r[k]<0)))problems.push('Missing or invalid raw metric: '+s.engine+' '+key);
  }
  const deltas={};for(const metric of Object.keys(legacy.metrics)){deltas[metric]={};for(const percentile of ['p50','p95']){
   const before=legacy.metrics[metric][percentile],after=rust.metrics[metric][percentile];deltas[metric][percentile]={before,after,delta:before!==null&&after!==null?after-before:null,percent:before>0&&after!==null?(after-before)/before*100:null};
   if(!Number.isFinite(before)||!Number.isFinite(after)){problems.push('Missing metric: '+key+' '+metric+' '+percentile);continue;}
   if(BUDGETS[metric]){const[relative,absolute]=BUDGETS[metric],limit=Math.max(before*relative,before+absolute);if(after>limit)problems.push('Regression: '+key+' '+metric+' '+percentile+' '+after.toFixed(1)+' > '+limit.toFixed(1));}
   if(metric==='cls'&&after>Math.max(.1,before+.01))problems.push('Layout-shift regression: '+key+' '+percentile);
  }}comparisons.push({key,n:Math.min(legacy.n,rust.n),deltas});
 }
 return{labPass:problems.length===0,productionReady:false,problems,comparisons,note:'A lab pass is necessary, not sufficient: server/API percentiles, observed cold starts, consent-aware field metrics, full route/user-flow coverage and rollback still need release evidence.'};
}
export function markdown(report,result=assess(report)){
 const fmt=(v,scale=1)=>v===null?'n/a':(v/scale).toFixed(scale===1024?1:0),pair=(d,scale=1)=>fmt(d.before,scale)+' → '+fmt(d.after,scale);
 const rows=result.comparisons.map(c=>`| ${c.key.replaceAll('|',' · ')} | ${c.n} | ${pair(c.deltas.ready.p50)} | ${pair(c.deltas.lcp.p50)} | ${pair(c.deltas.transfer.p50,1024)} | ${pair(c.deltas.actionNextFrame.p95)} |`).join('\n');
 return `# Corvus migration performance evidence\n\n**${result.labPass?'LAB PASS':'NOT RELEASE-READY'}**. ${report.head}. ${report.started}.\n\nBefore = legacy JS; after = current Rust/WASM test bridge. All raw samples remain in the sibling JSON. Percentiles use nearest rank. No “godspeed” or overall speedup claim is established by this report.\n\n| Profile · route · cache | Runs per engine | Ready p50 ms | LCP p50 ms | Transferred p50 KiB | Synthetic action p95 ms |\n|---|---:|---:|---:|---:|---:|\n${rows}\n\n## Conditions\n\n${report.method}\n\nBrowser ${report.browser}; ${report.host?.platform}/${report.host?.arch}; ${report.host?.cpu}. ${report.fixtureLatencyMs} ms fixed fixture API delay. Bundle ${report.wasm?.rawBytes} raw bytes, SHA-256 ${report.wasm?.sha256}.\n\n${report.limitations.map(x=>'- '+x).join('\n')}\n\n## Release checks\n\n${result.problems.length?result.problems.map(p=>'- '+p).join('\n'):'- No lab regression exceeded the configured budgets.'}\n\n${result.note}\n`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=process.argv[2];if(!input)throw Error('Provide a benchmark JSON path');const report=JSON.parse(await readFile(input,'utf8')),result=assess(report),out=input.replace(/\.json$/,'.md');if(out===input)throw Error('Expected a JSON filename');await writeFile(out,markdown(report,result));await writeFile(input.replace(/\.json$/,'.gate.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({markdown:out,labPass:result.labPass,productionReady:false,issues:result.problems.length}));if(process.argv.includes('--require-pass')&&!result.labPass)process.exitCode=1;
}
