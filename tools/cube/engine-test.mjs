import fs from 'node:fs';
const L = await import(new URL('../../the6cube/lab.js', import.meta.url));
const { loadEngine } = await import(new URL('../../the6cube/engine.js', import.meta.url));
const shippedWasm = process.env.ENGINE_WASM || 'engine.wasm';
const wasm = process.argv[2] ?? new URL('../../the6cube/' + shippedWasm, import.meta.url);
const E = await loadEngine(new Uint8Array(fs.readFileSync(wasm)));
let t = performance.now(); const jb = L.buildBall(4); const tj = performance.now() - t;
t = performance.now(); const rb = E.buildBall(4); const tr = performance.now() - t;
console.log('layers', JSON.stringify(jb.layers), JSON.stringify(rb.layers), 'ball ms js', tj.toFixed(0), 'rust', tr.toFixed(0));
let bad = 0;
for (const generator of L.GENERATORS) for (const steps of [2, 4, 8]) for (const seed of [1729, 7, 4294967295]) {
  let t0 = performance.now(); const a = L.runExperiment({ generator, steps, samples: 20000, seed, ball: jb, keepTrials: true }); const ta = performance.now() - t0;
  t0 = performance.now(); const b = E.runExperiment({ generator, steps, samples: 20000, seed, ball: rb, keepTrials: true }); const tb = performance.now() - t0;
  const same = JSON.stringify(a.bins) === JSON.stringify(b.bins) && JSON.stringify(a.examples) === JSON.stringify(b.examples) && JSON.stringify(a.trials) === JSON.stringify(b.trials);
  if (!same) bad++;
  console.log(generator, steps, seed, same ? 'IDENTICAL' : 'DIFF', 'js', ta.toFixed(0) + 'ms', 'rust', tb.toFixed(0) + 'ms');
}
// distance lookups through the shim
const rng = L.mulberry32(5); let dbad = 0;
for (let i = 0; i < 2000; i++) { const s = L.sampleSequence('uniform', 1 + (i % 6), rng); const p = L.applySequence(s); if (L.distanceOf(jb, p) !== L.distanceOf(rb, p)) dbad++; }
const ex = L.exactDistribution('distinct', 2, jb), ey = L.exactDistribution('distinct', 2, rb);
console.log('distance mismatches', dbad, 'exact same', JSON.stringify(ex) === JSON.stringify(ey), 'experiment diffs', bad);

if (bad || dbad || JSON.stringify(ex) !== JSON.stringify(ey) || JSON.stringify(jb.layers) !== JSON.stringify(rb.layers)) process.exitCode = 1;
