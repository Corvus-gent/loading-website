// node tools/cube/test.mjs — invariants for the production move implementation and the experiment.
import assert from 'node:assert/strict';
import { stickers, moves, turn, inverse, key, solvedKey } from '../../the6cube/model.js';
import { applyMove, applySequence, identity, stateKey, buildBall, distanceOf, runExperiment, exactDistribution, posFromStickers, signature, validateParams, toCSV } from '../../the6cube/lab.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok', name); };
const solved = stateKey(identity());
const sticky = sequence => sequence.reduce((state, move) => turn(state, move), stickers).map(key).join(';');

test('every move followed by its inverse is the identity (sticker model and permutation model)', () => {
  for (const move of moves) {
    assert.equal(sticky([move, inverse(move)]), solvedKey, move);
    assert.equal(stateKey(applySequence([move, inverse(move)])), solved, move);
  }
});
test('four quarter turns and two half turns are the identity', () => {
  for (const face of 'URFDLB') {
    assert.equal(sticky([face, face, face, face]), solvedKey);
    assert.equal(sticky([face + '2', face + '2']), solvedKey);
    assert.equal(sticky([face, face]), sticky([face + '2']));
  }
});
test('permutation model agrees with the sticker model for every move', () => {
  for (const move of moves) assert.equal(stateKey(posFromStickers(turn(stickers, move))), stateKey(applyMove(identity(), move)), move);
});
test("R L R′ ends in exactly the same state as L", () => {
  assert.equal(sticky(['R', 'L', "R'"]), sticky(['L']));
  assert.equal(stateKey(applySequence(['R', 'L', "R'"])), stateKey(applySequence(['L'])));
  assert.equal(signature(applySequence(['R', 'L', "R'"])), signature(applySequence(['L'])));
});
const ball = buildBall(4);
test('BFS layer sizes match the half-turn metric counts 1, 18, 243, 3240, 43239', () => {
  assert.deepEqual(ball.layers, [1, 18, 243, 3240, 43239]);
});
test('shortest distance of the shared endpoint is exactly 1', () => {
  assert.equal(distanceOf(ball, applySequence(['R', 'L', "R'"])), 1);
  assert.equal(distanceOf(ball, identity()), 0);
});
test('exact two-step probabilities', () => {
  const u = exactDistribution('uniform', 2, ball);
  const d = exactDistribution('distinct', 2, ball);
  assert.equal(u.denominator, 324); assert.deepEqual(u.bins, [18, 36, 270, 0, 0, 0]);
  assert.equal(d.denominator, 270); assert.deepEqual(d.bins, [0, 0, 270, 0, 0, 0]);
});
test('same version and seed reproduce identical aggregate counts; every trial lands in exactly one bin', () => {
  for (const generator of ['uniform', 'distinct']) for (const steps of [2, 4, 8]) {
    const a = runExperiment({ generator, steps, samples: 3000, seed: 1729, ball });
    const b = runExperiment({ generator, steps, samples: 3000, seed: 1729, ball });
    assert.deepEqual(a.bins, b.bins);
    assert.equal(a.bins.reduce((x, y) => x + y, 0), 3000);
  }
});
test('four-step samples are always within the radius', () => {
  const r = runExperiment({ generator: 'uniform', steps: 4, samples: 2000, seed: 7, ball });
  assert.equal(r.bins[5], 0);
});
test('parameter validation caps work and rejects junk', () => {
  assert.deepEqual(validateParams({ steps: '3', seed: 'abc', n: '99999999' }), { steps: 2, seed: 1729, samples: 20000 });
  assert.deepEqual(validateParams({ steps: '8', seed: '42', n: '5' }), { steps: 8, seed: 42, samples: 100 });
});
test('CSV carries metadata, denominators and one row per trial', () => {
  const r = runExperiment({ generator: 'uniform', steps: 2, samples: 100, seed: 1, ball, keepTrials: true });
  const csv = toCSV([r], { seed: 1, steps: 2, samples: 100, radius: 4 });
  assert.match(csv, /# version,cube-lab\/1/);
  assert.equal(csv.split('\n').filter(line => line.startsWith('trial,')).length, 100);
});
test('casino 8-turn market matches the published estimate (n = 100 000, seed 1729)', () => {
  const r = runExperiment({ generator: 'uniform', steps: 8, samples: 100000, seed: 1729, ball });
  assert.deepEqual(r.bins, [32, 236, 1109, 3244, 8323, 87056]);
});
test('exact 4-turn distribution used for casino odds', () => {
  assert.deepEqual(exactDistribution('uniform', 4, ball).bins, [720, 3600, 18360, 25920, 56376, 0]);
});
console.log(`\n${passed} tests passed`);
