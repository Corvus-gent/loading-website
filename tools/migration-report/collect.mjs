// Pull only committed, measured artifacts. No production access or billing guesses.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const args=Object.fromEntries(process.argv.slice(2).map(v=>v.split(/=(.*)/s).slice(0,2)));
const repo=args['--repo']||process.cwd(),ref=args['--ref']||'codex/rust-migration';
const git=(...a)=>execFileSync('git',a,{cwd:repo,encoding:'utf8',maxBuffer:16*1024*1024});
if(!/^[\w/.-]+$/.test(ref)||ref.startsWith('-'))throw Error('Invalid source ref');
const refSha=git('rev-parse','--verify',ref+'^{commit}').trim();
const files=git('ls-tree','-r','--name-only',refSha,'--','docs/rust-migration/evidence').trim().split('\n');
const json=f=>JSON.parse(git('show',refSha+':'+f));
const records=files.filter(f=>f.endsWith('-browser.json')).map(file=>({file,report:json(file)})).sort((a,b)=>a.report.started.localeCompare(b.report.started));
if(!records.length)throw Error('No committed benchmark evidence');
for(const {report:r} of records){
 if(r.workingTreeDirty||r.head!==r.headAfter||r.head!==r.wasmBuiltFromHead||r.wasmChangedDuringRun||r.samples.some(s=>s.error))throw Error('Unverified measurement provenance');
}
const latest=records.at(-1),sourceFile=latest.file.replace('-browser.json','-source.json'),source=json(sourceFile);
if(source.head!==latest.report.head)throw Error('Source/measurement head mismatch');
const usagePath=args['--usage'];
const old=await readFile('build/rust/data.json','utf8').then(JSON.parse).catch(()=>null);
const usage=usagePath?JSON.parse(await readFile(usagePath,'utf8')):old?.usage;
if(!usage)throw Error('Supply a sanitized usage aggregate, never the raw chat log');
const usageKeys=new Set(['status','started','through','window_closed_at','responses','duplicates_skipped','models','tokens','uncached_input_tokens','credits','usd','billing_evidence','method','limitations']);
if(Object.keys(usage).some(k=>!usageKeys.has(k)))throw Error('Unreviewed usage fields; export only sanitized aggregates');
if(usage.credits!==null||usage.usd!==null)throw Error('Billed costs require a separate reviewed billing import');
const confirmedChecks=source.head==='5d582b70951a0cdc310806a8839a8d54819eeb19'
 ?{routingComparisons:9621,ci:'passed',ciHead:source.head,ciUrl:'https://github.com/Corvus-gent/loading-website/actions/runs/44850680697'}
 :{routingComparisons:null,ci:'unverified',ciHead:source.head,ciUrl:'https://github.com/Corvus-gent/loading-website/pull/87'};
const evidenceBase='https://github.com/Corvus-gent/loading-website/blob/'+refSha+'/';
const measurements=records.map(({file,report:r})=>({
 head:r.head,date:r.started,profile:r.wasm.profile||'full',repeats:r.repeats,runs:r.samples.length,
 successes:r.samples.filter(s=>!s.error).length,method:r.method,limitations:r.limitations,
 browser:r.browser,host:{cpu:r.host.cpu,platform:r.host.platform,arch:r.host.arch},
 mobile:r.profiles.mobile,desktop:r.profiles.desktop,fixtureLatencyMs:r.fixtureLatencyMs,
 rawBytes:r.wasm.rawBytes,brotliBytes:r.assets.rust.find(a=>a.path.endsWith('corvus_browser_bg.wasm'))?.brotli??null,
 summary:r.summary,gate:json(file.replace('.json','.gate.json')),
 evidence:{raw:evidenceBase+file,report:evidenceBase+file.replace('.json','.md'),gate:evidenceBase+file.replace('.json','.gate.json')}
}));
const commits=Number(git('rev-list','--count',source.integrationBase+'..'+source.head).trim());
const snapshot={
 version:1,published:new Date().toISOString(),sourceRef:ref,sourceHead:refSha,measuredHead:source.head,
 status:'in-progress',productionMigrated:false,
 code:{base:source.integrationBase,head:source.head,commits,groups:source.migration.groups,added:source.migration.added,removed:source.migration.removed,files:source.migration.files.length,method:source.method,caveat:source.caveat,before:source.base.sourceLines,after:source.current.sourceLines,evidence:evidenceBase+sourceFile},
 usage,measurements,
 checks:{...confirmedChecks,measuredInteractions:latest.report.samples.length,failedInteractions:latest.report.samples.filter(s=>s.error).length,scope:'CI evidence belongs only to the recorded implementation commit. Not a full migration or performance pass.'},
 pending:['Mobile interaction readiness must match or beat the existing app.','Complete remaining runtime modules, publishing, hydration and failure behavior.','Verify real isolated uploads, provider access and regional recovery.','Measure deployed API p50/p95/p99, cold starts, CPU, memory, cache hit rates and cost.','Reconcile production, crawl every route, test protected flows and rehearse rollback.'],
 sources:[
 {title:'Rust ownership and compile-time memory checks',url:'https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html'},
 {title:'Vercel Rust runtime (Beta)',url:'https://vercel.com/docs/functions/runtimes/rust'},
 {title:'Vercel Runtime Cache: regional cache, TTLs and tags',url:'https://vercel.com/docs/runtime-cache'},
 {title:'OpenAI usage and credit pricing',url:'https://learn.chatgpt.com/docs/pricing'}
 ]
};
await mkdir('build/rust',{recursive:true});
await writeFile('build/rust/data.json',JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({head:snapshot.measuredHead,added:snapshot.code.added,removed:snapshot.code.removed,snapshots:measurements.length,billedCost:'unverified'}));
