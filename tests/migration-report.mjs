import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rows,lower,number,snapshotFacts} from '../build/rust/model.mjs';
const d=JSON.parse(await readFile('build/rust/data.json','utf8'));
const sum=Object.values(d.code.groups).reduce((a,g)=>({added:a.added+g.added,removed:a.removed+g.removed,files:a.files+g.files}),{added:0,removed:0,files:0});
assert.deepEqual(sum,{added:d.code.added,removed:d.code.removed,files:d.code.files});
assert.equal(d.code.after-d.code.before,d.code.added-d.code.removed);
assert.equal(d.productionMigrated,false);
assert.equal(d.usage.credits,null);assert.equal(d.usage.usd,null);
assert.equal(snapshotFacts(d).totalTokens,d.usage.tokens.total_tokens);
assert.equal(d.usage.uncached_input_tokens+d.usage.tokens.cached_input_tokens,d.usage.tokens.input_tokens);
assert(d.usage.tokens.reasoning_output_tokens<=d.usage.tokens.output_tokens);
assert.equal(number(0),'0');assert.equal(number(null),'not measured');assert.equal(lower(1,null),null);
for(const profile of ['mobile','desktop'])for(const cache of ['cold-context','warm']){
 const selected=rows(d,profile,cache);assert.equal(selected.length,3);
 for(const row of selected){for(const engine of ['legacy','rust']){assert.equal(row[engine].profile,profile);assert.equal(row[engine].cache,cache);assert.equal(row[engine].successes,row[engine].n);}}
}
assert.throws(()=>rows(d,'phone','warm'));assert(rows(d).every(r=>r.rust.metrics.ready.p50>r.legacy.metrics.ready.p50),'retain the observed mobile regression');
assert(d.measurements.every(m=>m.gate.productionReady===false&&m.gate.labPass===false));
assert(d.checks.ciUrl.includes('44850680697'));assert.equal(d.checks.ciHead,d.measuredHead);
const json=JSON.stringify(d);
for(const forbidden of ['/Users/','thread_id','response_id','accountId','rateLimits','Bearer ','api_key'])assert(!json.includes(forbidden),'private metadata must not be exported: '+forbidden);
const html=await readFile('build/rust/index.html','utf8'),article=await readFile('build/rust/article.md','utf8');
assert(html.includes('production has not switched to Rust'));assert(html.includes('unverified'));
assert(article.includes('not an all-Next.js app'));assert(!article.includes("'+m."));
assert(html.includes('name="twitter:card" content="summary_large_image"'));
for(const m of d.measurements)assert(m.evidence.raw.includes('/blob/'+d.sourceHead+'/'));
console.log('PASS reconciled source/usage totals, no cost guesses, cache/device comparisons, null versus zero, known regressions, immutable provenance and no private telemetry.');
