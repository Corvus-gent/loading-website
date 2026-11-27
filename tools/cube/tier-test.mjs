// node tools/cube/tier-test.mjs — tier rules, ?tier override, and the no-WebAssembly fallback.
import assert from 'node:assert/strict';
const root = new URL('../../the6cube/', import.meta.url);
const { detectTier, byTier } = await import(new URL('tier.js', root));
const env = ({ q = '', gl2 = true, gpu = true, cores = 8, coarse = false, save = false, mem, reduced = false } = {}) => ({
  location: { search: q }, document: { createElement: () => ({ getContext: t => gl2 && t === 'webgl2' ? {} : null }) },
  navigator: { gpu: gpu ? {} : undefined, hardwareConcurrency: cores, connection: { saveData: save }, deviceMemory: mem },
  matchMedia: m => ({ matches: m.includes('reduced-motion') ? reduced : m.includes('pointer: coarse') ? coarse : false }) });
assert.equal(detectTier(env()), 'S');
assert.equal(detectTier(env({ cores: 4 })), 'A');
assert.equal(detectTier(env({ gpu: false })), 'A');
assert.equal(detectTier(env({ coarse: true })), 'A');
assert.equal(detectTier(env({ gl2: false })), 'B');
assert.equal(detectTier(env({ save: true })), 'B');
assert.equal(detectTier(env({ mem: 2 })), 'B');
assert.equal(detectTier(env({ reduced: true })), 'B');
assert.equal(detectTier(env({ q: '?tier=b', cores: 16 })), 'B');
assert.equal(detectTier(env({ q: '?tier=S', gl2: false })), 'S');
assert.deepEqual(['S', 'A', 'B'].map(t => byTier(100, t)), [100, 50, 25]);
// no WebAssembly → loadBestEngine resolves null and the JS walk is used
const { loadBestEngine } = await import(new URL('engine.js', root));
const WA = globalThis.WebAssembly; delete globalThis.WebAssembly;
try { assert.equal(await loadBestEngine(), null); } finally { globalThis.WebAssembly = WA; }
console.log('tier + fallback tests passed');
