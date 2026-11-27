// Rust → WebAssembly engine for The 6 Cube (source: /engine, built with cargo --target wasm32-unknown-unknown).
// Same answers as lab.js, bit for bit; lab.js stays as the fallback when WebAssembly is unavailable.
import { MOVE_PERM, LAB_VERSION } from './lab.js';
import { moves } from './model.js';

// smallest module that uses a v128 instruction: validates only where WebAssembly SIMD exists
const SIMD_PROBE = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
export const simdSupported = () => typeof WebAssembly === 'object' && WebAssembly.validate(SIMD_PROBE);

/** Pick engine-simd.wasm when the browser can run it, else engine.wasm. Resolves to null when WebAssembly is unavailable or fails. */
export async function loadBestEngine({ simd = simdSupported() } = {}) {
  if (typeof WebAssembly !== 'object') return null;
  for (const file of simd ? ['engine-simd.wasm', 'engine.wasm'] : ['engine.wasm']) {
    try { const e = await loadEngine(new URL('./' + file, import.meta.url)); e.file = file; return e; } catch (err) { /* try the next binary */ }
  }
  return null;
}

export async function loadEngine(source = new URL('./engine.wasm', import.meta.url)) {
  const bytes = source instanceof Uint8Array || source instanceof ArrayBuffer ? source : await (await fetch(source)).arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const x = instance.exports, mem = () => new Uint8Array(x.memory.buffer);
  const perm = mem().subarray(x.perm_ptr(), x.perm_ptr() + 18 * 54);
  moves.forEach((m, i) => perm.set(MOVE_PERM[m], i * 54));
  const MAXS = x.max_steps();

  function buildBall(radius) {
    const size = x.build_ball(radius);
    const layers = Array.from(new Uint32Array(x.memory.buffer, x.layers_ptr(), radius + 1));
    // the same shape lab.js expects: ball.dist.get(stateKey(pos))
    const dist = { size, get(key) { const io = mem().subarray(x.io_ptr(), x.io_ptr() + 54); for (let i = 0; i < 54; i++) io[i] = key.charCodeAt(i); const d = x.dist_io(); return d < 0 ? undefined : d; } };
    return { dist, radius, layers, engine: 'rust-wasm' };
  }

  function runExperiment({ generator, steps, samples, seed, ball, keepTrials = false, onProgress, shouldStop }) {
    x.begin(generator === 'distinct' ? 1 : 0, steps, seed >>> 0, keepTrials ? 1 : 0, samples);
    for (let done = 0; done < samples;) {
      const chunk = Math.min(1000, samples - done); done = x.run(chunk);
      if (onProgress && done % 1000 === 0) onProgress(done);
      if (shouldStop && shouldStop()) return null;
    }
    const nb = ball.radius + 2;
    const bins = Array.from(new Uint32Array(x.memory.buffer, x.bins_ptr(), nb));
    const exT = new Int32Array(x.memory.buffer, x.ex_trial_ptr(), nb), exS = mem().subarray(x.ex_seq_ptr());
    const examples = Array.from({ length: nb }, (_, b) => exT[b] < 0 ? null : { trial: exT[b], sequence: Array.from(exS.subarray(b * MAXS, b * MAXS + steps), m => moves[m]) });
    let trials = null;
    if (keepTrials) {
      const seq = new Uint8Array(x.memory.buffer, x.trials_seq_ptr(), samples * steps), dist = new Int8Array(x.memory.buffer, x.trials_dist_ptr(), samples);
      trials = new Array(samples);
      for (let i = 0; i < samples; i++) { let s = ''; for (let j = 0; j < steps; j++) s += (j ? ' ' : '') + moves[seq[i * steps + j]]; trials[i] = { trial: i, sequence: s, distance: dist[i] < 0 ? null : dist[i] }; }
    }
    return { generator, steps, samples, seed, version: LAB_VERSION, radius: ball.radius, bins, examples, trials };
  }
  // Uniform random walk of `steps` turns per trial, mulberry32(seed): the distance (null = outside the ball) of every trial.
  function walkDistances({ steps, samples, seed }) {
    x.begin(0, steps, seed >>> 0, 1, samples);
    for (let done = 0; done < samples;) done = x.run(Math.min(1000, samples - done));
    const d = new Int8Array(x.memory.buffer, x.trials_dist_ptr(), samples);
    return Int8Array.from(d);
  }
  return { buildBall, runExperiment, walkDistances };
}
