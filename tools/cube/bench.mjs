// speed budget for every engine. node tools/cube/bench.mjs [--json out.json]. fails (exit 1) if a budget is broken.
// budgets are generous for a GitHub runner (2 vCPU); the M1 is ~2–3× faster.
import fs from 'node:fs';
// The longer scalar/SIMD comparison can also run independently.
if (process.argv.includes('--walk')) { await import('./bench-walk.mjs'); }
const R = p => new URL('../../the6cube/' + p, import.meta.url);
const L = await import(R('lab.js')); const ms = f => { const t = performance.now(); const v = f(); return [performance.now() - t, v]; };
const out = {}, budget = { js_ball: 1000, rust_ball: 250, js_mc_20k: 1500, rust_mc_20k: 150, c_ball: 200, c_solve_avg: 60, cpp_wilson_1e5: 80, prolog_query: 250 };
out.js_ball = ms(() => L.buildBall(4))[0];
const { loadEngine } = await import(R('engine.js')); const E = await loadEngine(new Uint8Array(fs.readFileSync(R('engine.wasm'))));
const [rb, ballR] = ms(() => E.buildBall(4)); out.rust_ball = rb; const ballJ = L.buildBall(4);
const P = { generator: 'distinct', steps: 8, samples: 20000, seed: 1729 };
out.js_mc_20k = ms(() => L.runExperiment({ ...P, ball: ballJ }))[0];
out.rust_mc_20k = ms(() => E.runExperiment({ ...P, ball: ballR }))[0];
const { loadSolver } = await import(R('solver.js')); const S = await loadSolver(new Uint8Array(fs.readFileSync(R('solver.wasm'))));
out.c_ball = ms(() => S.build())[0];
const rng = L.mulberry32(7), pos = Array.from({ length: 50 }, () => L.applySequence(L.sampleSequence('distinct', 8, rng)));
out.c_solve_avg = ms(() => pos.forEach(p => S.solve(p)))[0] / pos.length;
const { instance: { exports: W } } = await WebAssembly.instantiate(fs.readFileSync(R('wilson.wasm')), {});
out.cpp_wilson_1e5 = ms(() => { for (let i = 1; i <= 1e5; i++) W.wilson(i % 97, i, 1.96); })[0];
const pl = (await import('tau-prolog')).default, rules = fs.readFileSync(R('oracle.pl'), 'utf8');
const t0 = performance.now(); await new Promise(ok => { const s = pl.create(1000); s.consult(rules, { success() { s.query('voice(3,2,1,L).', { success() { s.answer({ success: ok, fail: ok, error: ok }); } }); } }); }); out.prolog_query = performance.now() - t0;
let bad = 0; console.log('engine'.padEnd(18), 'ms'.padStart(9), 'budget'.padStart(8));
for (const [k, v] of Object.entries(out)) { const over = v > budget[k]; bad += over; console.log(k.padEnd(18), v.toFixed(1).padStart(9), String(budget[k]).padStart(8), over ? '✗ SLOW' : '✓'); }
console.log(`rust speed-up: ball ${(out.js_ball / out.rust_ball).toFixed(1)}×, monte carlo ${(out.js_mc_20k / out.rust_mc_20k).toFixed(1)}×`);
const j = process.argv.indexOf('--json'); if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify({ at: new Date().toISOString(), ms: out, budget }, null, 1));
if (out.js_mc_20k / out.rust_mc_20k < 5) { bad++; console.log("✗ Rust Monte Carlo is no longer ≥ 5× faster than JS"); }
process.exit(bad ? 1 : 0);
