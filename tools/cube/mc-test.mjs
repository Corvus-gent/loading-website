// node tools/cube/mc-test.mjs — the Rust walk (scalar and SIMD binaries) must give the same bins as the JS walk, bit for bit.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../../the6cube/', import.meta.url);
const L = await import(new URL('lab.js', root));
const { loadEngine, simdSupported } = await import(new URL('engine.js', root));
const { walkBinsJS, walkBinsRust, histogram } = await import(new URL('monte-carlo/walk.js', root));
const ball = L.buildBall();
const bin = f => new Uint8Array(fs.readFileSync(new URL(f, root)));
const files = ['engine.wasm', ...(simdSupported() ? ['engine-simd.wasm'] : [])];
// the constant the page ships for the 8-turn casino market
const EST8 = [32, 236, 1109, 3244, 8323, 87056];
let n = 0;
for (const f of files) {
  const E = await loadEngine(bin(f)); E.buildBall(L.RADIUS);
  for (const k of [2, 4, 8]) for (const seed of [1729, 7, 4294967295]) for (const count of [1, 999, 10000]) {
    const a = walkBinsJS(ball, k, count, seed), b = walkBinsRust(E, k, count, seed);
    assert.deepEqual(b, a, `${f} k=${k} seed=${seed} n=${count}`); n++;
  }
  assert.deepEqual(histogram(walkBinsRust(E, 8, 100000, 1729)), EST8, f + ' EST8');
  console.log('ok', f, 'identical to JS; EST8 reproduced');
}
console.log('mc walks compared', n, 'binaries', files.length);
