// Public projection of committed experiment evidence. Never copy traces or prose
// from a local run: they can contain paths, browser URLs and private metadata.
import assert from 'node:assert/strict';

export const attempts = [
 ['01-size-z','Compile Rust for size','Small improvement; insufficient for the mobile target.'],
 ['02-brotli-11','Precompute stronger compression','Useful improvement; keep compression off the request path.'],
 ['03-wasm-preload','Preload WASM','Little readiness gain and worse paint scores; rejected alone.'],
 ['04-page-wasm','Split the Rust browser','Export pruning failed; a later compile-time split helps, but remains too slow.'],
 ['05-js-bundle','Bundle the existing browser scripts','Useful mobile improvement without a new framework.'],
 ['06-module-preload','Discover critical modules earlier','Useful mobile improvement.'],
 ['07-inline-directory','Include the public page catalogue','Modest home gain; the map benefits more.'],
 ['08-parallel-api','Run independent API reads together','Map improves; fixes the observed old-document refresh failure.'],
 ['09-inline-css','Inline existing CSS','Earlier paint, later controls; rejected alone and refined in the combination.'],
 ['10-combined','Combine the useful changes','English homepage target passes locally; map and full translations still miss it.']
];
const modes = [
 ['js-control','Existing JavaScript'],['rust-control','Original Rust browser'],
 ['04-page-wasm','Smaller Rust + delivery changes'],['10-combined','Combined light browser']
];
const sha = value => {assert.match(value,/^[a-f0-9]{40}$/);return value;};
function stats(group,key,n) {
 assert(group && group.failed===0 && group.attempted===n,'Missing or failed comparison');
 const s=group.metrics[key];assert.equal(s.n,n);
 for(const k of ['mean','median','min','max'])assert(Number.isFinite(s[k])&&s[k]>=0,'Invalid metric');
 assert(s.min<=s.mean&&s.mean<=s.max&&s.min<=s.median&&s.median<=s.max);
 return {n,mean:s.mean,median:s.median,min:s.min,max:s.max};
}
export function publicExperiments(raw,sourceHead,file) {
 sha(sourceHead);assert.match(file,/^docs\/rust-migration\/evidence\/\d{4}-\d{2}-\d{2}-ten-experiments\.json$/);
 assert.equal(raw.productionChanged,false);assert.equal(raw.version,1);
 const run=name=>{const found=raw.runs.filter(r=>r.name===name);assert.equal(found.length,1);return found[0];};
 for(const r of raw.runs){
  assert(Number.isFinite(Date.parse(r.finished)));sha(r.head);if(r.headAfter!==undefined)assert.equal(r.head,r.headAfter);
  const c=r.completeness;
  for(const v of Object.values(c))assert(Number.isSafeInteger(v)&&v>=0);
  assert.equal(c.actualSamples,c.expectedSamples);assert.equal(c.actualAudits,c.expectedAudits);assert.equal(c.duplicateSamples,0);
 }
 const get=(r,mode,profile,key='ready',extra={route:'/',cache:'cold-context'},n=3)=>stats(r.timing.find(g=>g.mode===mode&&g.profile===profile&&Object.entries(extra).every(([k,v])=>g[k]===v)),key,n);
 const audit=(r,mode,profile)=>{const s=stats(r.lighthouse.find(g=>g.mode===mode&&g.profile===profile),'score',3);assert(s.max<=100);return s;};
 const confirmed=run('ten-confirmation'),final=run('ten-final'),independent=run('ten-independent'),translated=run('ten-language-hints'),journeys=run('ten-journeys');
 assert.equal(confirmed.head,confirmed.headAfter);assert.equal(confirmed.dirty,false);
 const evidence='https://github.com/Corvus-gent/loading-website/blob/'+sourceHead+'/'+file;
 return {
  version:1,date:confirmed.finished,sourceHead,confirmationHead:sha(confirmed.head),auditHead:sha(final.head),
  evidence,report:evidence.replace(/\.json$/,'.md'),
  timingAttempts:raw.runs.reduce((n,r)=>n+r.completeness.actualSamples,0),
  timingFailures:raw.runs.reduce((n,r)=>n+r.timing.reduce((sum,g)=>sum+g.failed,0),0),
  lighthouseAudits:raw.runs.reduce((n,r)=>n+r.completeness.actualAudits,0),
  candidates:modes.map(([mode,label])=>({mode,label,...Object.fromEntries(['mobile','desktop'].map(profile=>[profile,{ready:get(confirmed,mode,profile,'ready',undefined,20),lighthouse:audit(final,mode,profile)}]))})),
  attempts:attempts.map(([mode,label,outcome],i)=>({number:i+1,mode,label,outcome,...Object.fromEntries(['mobile','desktop'].map(profile=>[profile,{ready:get(i===9?confirmed:independent,mode,profile,'ready',undefined,i===9?20:3),lighthouse:audit(i===9?final:independent,mode,profile)}]))})),
  languages:['nl-BE','fr-FR'].map(locale=>({locale,...Object.fromEntries(['mobile','desktop'].map(profile=>[profile,{control:get(translated,'js-control',profile,'allReady',{locale,cache:'cold-context'}),candidate:get(translated,'10-combined',profile,'allReady',{locale,cache:'cold-context'}),lighthouse:audit(run(locale==='nl-BE'?'ten-hints-final':'ten-hints-french'),'10-combined',profile)}]))})),
  map:{mobile:get(final,'10-combined','mobile','ready',{route:'/map/',cache:'cold-context'}),desktop:get(final,'10-combined','desktop','ready',{route:'/map/',cache:'cold-context'})},
  prediction:['early','reading','wrong'].map(scenario=>({scenario,...Object.fromEntries(['mobile','desktop'].map(profile=>[profile,{plain:get(journeys,'combined-static',profile,'nextReady',{scenario},5),predicted:get(journeys,'combined-predictive',profile,'nextReady',{scenario},5),extraBytes:get(journeys,'combined-predictive',profile,'predictionWireBytes',{scenario},5)}]))})),
  unusedBytes:get(journeys,'combined-predictive','mobile','predictionWireBytes',{scenario:'unused'},5)
 };
}
