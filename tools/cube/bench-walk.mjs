// node tools/cube/bench.mjs — wall-clock timings (median of 5) of the Monte Carlo walk: JS vs Rust scalar vs Rust SIMD.
import fs from 'node:fs';
const root = new URL('../../the6cube/', import.meta.url);
const L = await import(new URL('lab.js', root)); const { loadEngine } = await import(new URL('engine.js', root));
const { walkBinsJS, walkBinsRust } = await import(new URL('monte-carlo/walk.js', root));
const ball = L.buildBall();
const eng = {}; for (const f of ['engine.wasm', 'engine-simd.wasm']) { eng[f] = await loadEngine(new Uint8Array(fs.readFileSync(new URL(f, root)))); eng[f].buildBall(L.RADIUS); }
const med = fn => { fn(); const t = []; for (let i = 0; i < 5; i++) { const t0 = performance.now(); fn(); t.push(performance.now() - t0); } return t.sort((a, b) => a - b)[2]; };
console.log('node', process.version, process.arch);
for (const [k, n] of [[2, 100000], [4, 100000], [8, 100000], [8, 1000000]]) {
  const js = med(() => walkBinsJS(ball, k, n, 1729)), sc = med(() => walkBinsRust(eng['engine.wasm'], k, n, 1729)), sd = med(() => walkBinsRust(eng['engine-simd.wasm'], k, n, 1729));
  console.log(`k=${k} n=${n}: js ${js.toFixed(1)} ms | rust ${sc.toFixed(1)} ms | rust+simd ${sd.toFixed(1)} ms`);
}
