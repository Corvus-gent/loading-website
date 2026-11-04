#!/usr/bin/env node
// Read-only, no cookie jar, no credentials or response bodies in the report.
import {writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function regions(header='') {
 return header.split('::').map(part=>/^([a-z]{3}\d)(?:-|$)/.exec(part)?.[1]).filter(Boolean);
}
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1)]??null;};
export async function probe(base='https://corvus.gent',samples=5){
 const origin=new URL(base);if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash)throw Error('use public https origin');
 let observedCountry=null;
 try{const response=await fetch(new URL('/api/geo?country=1',origin),{redirect:'manual',signal:AbortSignal.timeout(20000)});const value=response.ok?await response.json():null;if(/^[A-Z]{2}$/.test(value?.countryCode||''))observedCountry=value.countryCode;}catch{}
 const report={at:new Date().toISOString(),origin:origin.origin,observedCountry,belgiumVerified:observedCountry==='BE',measurement:'total fetch time including body; median and p95 in ms; first sample includes cold connection; subsequent samples reuse connection where possible',endpoints:[]};
 for(const path of ['/api/auth','/api/geo?country=1']){
  const rows=[];
  for(let i=0;i<samples;i++){
   const url=new URL(path,origin);url.searchParams.set('_region_probe',`${Date.now()}-${i}`);
   const start=performance.now();
   try{
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});await response.arrayBuffer();
    const chain=regions(response.headers.get('x-vercel-id')||'');
    const cache=response.headers.get('x-vercel-cache');
    const executed=response.status===200&&chain.length>=2&&!['HIT','STALE'].includes(cache);
    rows.push({status:response.status,ms:Math.round(performance.now()-start),cache,regions:chain,executionRegion:executed?chain.at(-1):null});
   }catch{rows.push({status:0,ms:Math.round(performance.now()-start),error:'request failed'});}
  }
  const times=rows.filter(row=>row.status===200).map(row=>row.ms);
  report.endpoints.push({path,samples:rows,medianMs:percentile(times,.5),p95Ms:percentile(times,.95),frankfurtVerified:rows.every(row=>row.executionRegion==='fra1')});
 }
 report.frankfurtVerified=report.endpoints.every(endpoint=>endpoint.frankfurtVerified);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const args=process.argv.slice(2),options={};
  while(args.length){const key=args.shift();if(key==='--verify'){options[key]=true;continue;}if(!['--base','--output','--compare'].includes(key)||!args.length||options[key])throw Error('arguments');options[key]=args.shift();}
  const report=await probe(options['--base']);
  if(options['--compare']){
   const before=JSON.parse(await readFile(options['--compare'],'utf8'));
   report.comparison={belgiumVerified:report.belgiumVerified&&before.belgiumVerified,note:'Use the same Belgian connection; cache state, traffic and cold starts affect latency.',endpoints:report.endpoints.map(endpoint=>({path:endpoint.path,medianDeltaMs:typeof before.endpoints?.find(p=>p.path===endpoint.path)?.medianMs==='number'&&endpoint.medianMs!==null?endpoint.medianMs-before.endpoints.find(p=>p.path===endpoint.path).medianMs:null}))};
  }
  const json=JSON.stringify(report,null,2)+'\n';
  if(options['--output'])await writeFile(options['--output'],json,{flag:'wx'});
  console.log(json);
  if(!report.frankfurtVerified)console.error('Frankfurt execution not yet verified: inspect cache/redirect/error/region results. A single edge-region header alone is not proof.');
  if(!report.belgiumVerified)console.error('Belgian measurement location is unverified. Repeat from Belgium after the country endpoint is deployed.');
  if(options['--verify']&&(!report.frankfurtVerified||!report.belgiumVerified))process.exitCode=2;
 }catch{console.error('Probe failed. Use --base https://public-host [--output NEW.json] [--compare before.json] [--verify]. No response bodies or credentials logged.');process.exitCode=1;}
}
