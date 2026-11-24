import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicExperiments} from '../tools/migration-report/experiments.mjs';
import {experimentCopy} from '../tools/migration-report/experiment-copy.mjs';
const raw=JSON.parse(await readFile('tests/fixtures/migration-experiments.json','utf8'));
const file='docs/rust-migration/evidence/2026-11-23-ten-experiments.json',sha='01739b7142fdbc2f78836685470d887f57657828';
const actual=publicExperiments(raw,sha,file);
const current=JSON.parse(await readFile('build/rust/data.json','utf8')).experiments;
assert.deepEqual(actual,current);
assert.equal(actual.candidates.at(-1).mobile.ready.mean,712.38);
assert.equal(actual.candidates.at(-1).desktop.ready.mean,53.38);
assert.equal(actual.languages[0].mobile.candidate.mean,1060.4);
assert.equal(actual.timingAttempts,1256);assert.equal(actual.timingFailures,12);
assert.equal(actual.lighthouseAudits,162);assert.equal(actual.attempts.length,10);
const privateRaw=structuredClone(raw);
privateRaw.account_id='DO-NOT-PUBLISH';privateRaw.runs[0].host={path:'/Users/DO-NOT-PUBLISH'};
privateRaw.runs[0].errors=['DO-NOT-PUBLISH'];privateRaw.method='DO-NOT-PUBLISH';
assert.deepEqual(publicExperiments(privateRaw,sha,file),actual,'unknown/private trace metadata never exported');
for(const change of [
 r=>{r.productionChanged=true;},
 r=>{r.runs.find(v=>v.name==='ten-confirmation').dirty=true;},
 r=>{r.runs.find(v=>v.name==='ten-confirmation').headAfter='f'.repeat(40);},
 r=>{r.runs[0].completeness.duplicateSamples=1;},
 r=>{r.runs[0].completeness.actualSamples--;},
 r=>{r.runs.find(v=>v.name==='ten-confirmation').timing[0].metrics.ready.mean=null;},
 r=>{r.runs.find(v=>v.name==='ten-confirmation').timing[0].failed=1;},
 r=>{r.runs.find(v=>v.name==='ten-final').lighthouse[0].metrics.score.max=101;}
]){
 const copy=structuredClone(raw);change(copy);assert.throws(()=>publicExperiments(copy,sha,file));
}
assert.throws(()=>publicExperiments(raw,sha,'/Users/private.json'));
const copy=experimentCopy(actual);
for(const text of ['0.712 s','1.060 s','47,097','not a live-site speedup','Twenty cold-context'])assert(copy.html.includes(text)&&copy.markdown.includes(text));
assert(!JSON.stringify(actual).includes('/Users/'));assert(!copy.html.includes('DO-NOT-PUBLISH'));
assert(copy.html.includes('scope="row"')&&copy.html.includes('scope="col"'));
console.log('PASS aggregate provenance, privacy projection, failed-run retention, distinct protocols, locale limits and article/page agreement.');
