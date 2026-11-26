// Pure search and sampling logic for /cube. No DOM: runs in the page, in a worker and in Node.
// Every number the UI shows about distance or distribution comes from this module.
import { stickers, moves, turn, key } from './model.js';

export const LAB_VERSION = 'cube-lab/1';
export const RADIUS = 4;                  // exact BFS search radius (half-turn metric)
export const MAX_SAMPLES = 20000;         // per generator; caps work for share links
export const STEP_OPTIONS = [2, 4, 8];
export const GENERATORS = ['uniform', 'distinct'];

// Slot index = position of a sticker in the solved configuration (54 slots).
export const SLOT = new Map(stickers.map((sticker, index) => [key(sticker), index]));

// MOVE_PERM[move][slot] = slot that the sticker at `slot` moves to.
export const MOVE_PERM = Object.fromEntries(moves.map(move => [
  move,
  Uint8Array.from(turn(stickers, move).map(sticker => SLOT.get(key(sticker)))),
]));

export const identity = () => Uint8Array.from(stickers, (_, index) => index);

// pos[id] = slot currently holding sticker `id`
export function applyMove(pos, move) {
  const perm = MOVE_PERM[move];
  const next = new Uint8Array(54);
  for (let i = 0; i < 54; i++) next[i] = perm[pos[i]];
  return next;
}
export const applySequence = (sequence, pos = identity()) => sequence.reduce(applyMove, pos);

// Canonical endpoint key: committed sticker identity -> slot. Deterministic and exact.
export const stateKey = pos => String.fromCharCode.apply(null, pos);
export const posFromStickers = state => Uint8Array.from(state, sticker => SLOT.get(key(sticker)));

// Short human signature (FNV-1a, 32 bit) for display. Comparisons always use the full key.
export function signature(pos) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < pos.length; i++) { hash ^= pos[i]; hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// Breadth-first ball around solved. Map<key, exact distance>. Sizes: 1, 18, 243, 3240, 43239.
export function buildBall(radius = RADIUS) {
  const dist = new Map();
  let frontier = [identity()];
  dist.set(stateKey(frontier[0]), 0);
  const layers = [1];
  for (let depth = 1; depth <= radius; depth++) {
    const next = [];
    for (const pos of frontier) {
      for (const move of moves) {
        const child = applyMove(pos, move);
        const k = stateKey(child);
        if (!dist.has(k)) { dist.set(k, depth); next.push(child); }
      }
    }
    layers.push(next.length);
    frontier = next;
  }
  return { dist, radius, layers };
}
// Exact distance if within the radius, otherwise null (meaning: at least radius + 1).
export const distanceOf = (ball, pos) => ball.dist.get(stateKey(pos)) ?? null;

// Seeded PRNG (mulberry32). Same seed -> same stream on every engine.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Process rules.
// uniform:  every step is one of the 18 face turns, independent of the previous step.
// distinct: the first step is one of 18; every later step is one of the 15 turns on a different face.
export function allowedMoves(generator, previous) {
  if (generator === 'uniform' || !previous) return moves;
  return moves.filter(move => move[0] !== previous[0]);
}
export function sampleSequence(generator, steps, rng) {
  const sequence = [];
  for (let i = 0; i < steps; i++) {
    const options = allowedMoves(generator, sequence[i - 1]);
    sequence.push(options[Math.floor(rng() * options.length)]);
  }
  return sequence;
}

// Bins: index 0..radius = exact distance; index radius + 1 = outside the radius (distance >= radius + 1).
export function runExperiment({ generator, steps, samples, seed, ball, keepTrials = false, onProgress, shouldStop }) {
  const rng = mulberry32(seed);
  const bins = new Array(ball.radius + 2).fill(0);
  const examples = new Array(ball.radius + 2).fill(null);
  const trials = keepTrials ? [] : null;
  for (let trial = 0; trial < samples; trial++) {
    const sequence = sampleSequence(generator, steps, rng);
    const d = distanceOf(ball, applySequence(sequence));
    const bin = d === null ? ball.radius + 1 : d;
    bins[bin]++;
    if (!examples[bin]) examples[bin] = { trial, sequence };
    if (trials) trials.push({ trial, sequence: sequence.join(' '), distance: d });
    if (onProgress && trial % 1000 === 999) onProgress(trial + 1);
    if (shouldStop && trial % 1000 === 999 && shouldStop()) return null;
  }
  return { generator, steps, samples, seed, version: LAB_VERSION, radius: ball.radius, bins, examples, trials };
}

// Exact distribution by enumerating every sequence with its probability (feasible for small steps).
export function exactDistribution(generator, steps, ball) {
  const bins = new Array(ball.radius + 2).fill(0);   // numerators over a common denominator
  let denominator = 1;
  for (let i = 0; i < steps; i++) denominator *= allowedMoves(generator, i ? 'U' : null).length;
  (function walk(prefix, pos) {
    if (prefix.length === steps) {
      const d = distanceOf(ball, pos);
      bins[d === null ? ball.radius + 1 : d] += 1;
      return;
    }
    for (const move of allowedMoves(generator, prefix.at(-1))) walk([...prefix, move], applyMove(pos, move));
  })([], identity());
  return { generator, steps, bins, denominator };
}

export function validateParams(raw) {
  const steps = STEP_OPTIONS.includes(Number(raw.steps)) ? Number(raw.steps) : 2;
  const seedNumber = Number.parseInt(String(raw.seed ?? '1729'), 10);
  const seed = Number.isFinite(seedNumber) && seedNumber >= 0 && seedNumber <= 0xffffffff ? seedNumber : 1729;
  const n = Number.parseInt(String(raw.n ?? '10000'), 10);
  const samples = Number.isFinite(n) ? Math.min(MAX_SAMPLES, Math.max(100, n)) : 10000;
  return { steps, seed, samples };
}

export function toCSV(results, meta) {
  const lines = [
    `# version,${LAB_VERSION}`, `# seed,${meta.seed}`, `# steps,${meta.steps}`, `# samples_per_generator,${meta.samples}`,
    `# radius,${meta.radius}`, `# bins,"0..${meta.radius} exact distance; ${meta.radius + 1} = outside radius (distance >= ${meta.radius + 1})"`,
    'section,generator,bin,label,count,denominator',
  ];
  for (const result of results) result.bins.forEach((count, bin) =>
    lines.push(`bins,${result.generator},${bin},${bin > meta.radius ? '>=' + (meta.radius + 1) : bin},${count},${result.samples}`));
  if (results.every(result => result.trials)) {
    lines.push('section,generator,trial,sequence,distance');
    for (const result of results) for (const row of result.trials)
      lines.push(`trial,${result.generator},${row.trial},${row.sequence},${row.distance ?? '>=' + (meta.radius + 1)}`);
  }
  return lines.join('\n') + '\n';
}
