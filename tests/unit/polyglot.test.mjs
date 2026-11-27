// node --test tests/unit — correctness of every compiled/foreign piece against the JS reference
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const R = p => new URL('../../the6cube/' + p, import.meta.url);
const L = await import(R('lab.js')); const { moves } = await import(R('model.js'));

test('C solver: optimal and correct for 400 scrambles of 1–8 moves', async () => {
  const { loadSolver } = await import(R('solver.js'));
  const S = await loadSolver(new Uint8Array(fs.readFileSync(process.env.TEST_SOLVER || R('solver.wasm'))));
  assert.equal(S.build(), 46741);
  const rng = L.mulberry32(1729), solved = L.stateKey(L.applySequence([]));
  const ball = L.buildBall(4);
  function canReachBall(pos, turns, lastFace = '') {
    if (L.distanceOf(ball, pos) !== null) return true;
    return turns > 0 && moves.some(m => m[0] !== lastFace && canReachBall(L.applyMove(pos, m), turns - 1, m[0]));
  }
  for (let k = 1; k <= 8; k++) for (let i = 0; i < 50; i++) {
    const seq = L.sampleSequence('distinct', k, rng), sol = S.solve(L.applySequence(seq));
    const start = L.applySequence(seq);
    assert.ok(sol, `no solution for ${seq}`); assert.ok(sol.length <= k);
    if (sol.length <= 4) assert.equal(L.distanceOf(ball, start), sol.length);
    else assert.equal(canReachBall(start, sol.length - 5), false, 'A shorter path exists');
    assert.equal(L.stateKey(L.applySequence([...seq, ...sol])), solved);
  }
  assert.deepEqual(S.solve(L.identity()), []);
  // Two opposite faces commute: this three-turn scramble has distance one.
  assert.deepEqual(S.solve(L.applySequence(['R','L',"R'"])), ["L'"]);
  const superflip = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2".split(' ');
  assert.equal(S.solve(L.applySequence(superflip)), null);
});

test('C++ Wilson interval equals the JS formula', async () => {
  const { instance: { exports: x } } = await WebAssembly.instantiate(fs.readFileSync(process.env.TEST_WILSON || R('wilson.wasm')), {});
  for (const [k, n] of [[0, 10], [5, 10], [32, 100000], [87056, 100000], [100, 100]]) {
    x.wilson(k, n, 1.96); const o = new Float64Array(x.memory.buffer, x.out_ptr(), 3);
    const p = k / n, z = 1.96, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    assert.ok(Math.abs(o[1] - Math.max(0, c - h)) < 1e-12 && Math.abs(o[2] - Math.min(1, c + h)) < 1e-12, `${k}/${n}`);
  }
});

test('Prolog oracle answers every situation', async () => {
  const pl = (await import('tau-prolog')).default; const rules = fs.readFileSync(R('oracle.pl'), 'utf8');
  const ask = (h, r, v) => new Promise(ok => { const s = pl.create(1000); s.consult(rules, { success() { s.query(`voice(${h},${r},${v},L).`, { success() { s.answer({ success: a => ok(String(a.links.L)), fail: () => ok(null), error: () => ok(null) }); } }); } }); });
  for (let h = 0; h < 24; h++) for (const r of [0, 1, 2, 6]) for (const v of [1, 3, 8]) assert.ok(await ask(h, r, v), `${h} ${r} ${v}`);
  assert.match(await ask(12, 0, 1), /root/);
});

test('Rust engine is bit-identical to JS', async () => {
  const { loadEngine } = await import(R('engine.js'));
  const E = await loadEngine(new Uint8Array(fs.readFileSync(R('engine.wasm'))));
  const ballR = E.buildBall(4), ballJ = L.buildBall(4);
  const p = { generator: 'distinct', steps: 8, samples: 20000, seed: 1729 };
  const a = E.runExperiment({ ...p, ball: ballR }), b = L.runExperiment({ ...p, ball: ballJ });
  assert.deepEqual(a.bins, b.bins);
});

test('Haskell checks the move table shipped in the lab', () => {
  const hs = fs.readFileSync(new URL('../haskell/Perms.hs', import.meta.url), 'utf8');
  assert.deepEqual(JSON.parse(hs.split('names = ')[1].split('\n')[0]), moves);
  assert.deepEqual(JSON.parse(hs.split('perms =')[1]), moves.map(m => Array.from(L.MOVE_PERM[m])));
});
