// The Monte Carlo walk: n uniform random walks of k turns from solved, seeded with mulberry32.
// Returns one bin per walk: its distance 0..4, or 5 when outside the exact ball (d >= 5).
// walkBins() runs on the Rust/WebAssembly engine when given one; the JS path is the fallback. Both give identical bins.
import { applyMove, identity, distanceOf, mulberry32 } from '../lab.js';
import { moves } from '../model.js';

export function walkBinsJS(ball, k, n, seed) {
  const rng = mulberry32(seed), out = new Uint8Array(n);
  for (let i = 0; i < n; i++) { let pos = identity(); for (let j = 0; j < k; j++) pos = applyMove(pos, moves[Math.floor(rng() * 18)]); const d = distanceOf(ball, pos); out[i] = d === null ? 5 : d; }
  return out;
}
export function walkBinsRust(engine, k, n, seed) {
  const d = engine.walkDistances({ steps: k, samples: n, seed }), out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = d[i] < 0 ? 5 : d[i];
  return out;
}
export const walkBins = (engine, ball, k, n, seed) => engine ? walkBinsRust(engine, k, n, seed) : walkBinsJS(ball, k, n, seed);
export function histogram(bins) { const h = new Array(6).fill(0); for (const b of bins) h[b]++; return h; }
