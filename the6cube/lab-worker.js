// Off-main-thread search and sampling. Every reply carries the job id it answers,
// so the page can drop stale results after reruns, cancellation or teardown.
import { buildBall, runExperiment, exactDistribution, distanceOf, applySequence, GENERATORS, LAB_VERSION } from './lab.js';

import { loadEngine } from './engine.js';

// Rust → WebAssembly engine when available (bit-identical, ~10× faster); lab.js otherwise.
let engine = null;
const ready = loadEngine().then(e => { engine = e; }).catch(() => { engine = null; });

let ball = null;
let ballMs = 0;
const ensureBall = () => {
  if (!ball) { const t0 = performance.now(); ball = engine ? engine.buildBall(4) : buildBall(); ballMs = performance.now() - t0; }
  return ball;
};
const experiment = args => engine ? engine.runExperiment(args) : runExperiment(args);

self.onmessage = async ({ data }) => {
  await ready;
  const { job, type } = data;
  try {
    if (type === 'distances') {
      ensureBall();
      const distances = data.sequences.map(sequence => distanceOf(ball, applySequence(sequence)));
      self.postMessage({ job, type, distances, radius: ball.radius });
    }
    if (type === 'run') {
      const firstBall = !ball;
      ensureBall();
      const { steps, samples, seed } = data.params;
      const t0 = performance.now();
      const results = GENERATORS.map((generator, index) => {
        const result = experiment({ generator, steps, samples, seed, ball, keepTrials: data.keepTrials,
          onProgress: done => self.postMessage({ job, type: 'progress', done: index * samples + done, total: GENERATORS.length * samples }) });
        return result;
      });
      const exact = steps === 2 ? GENERATORS.map(generator => exactDistribution(generator, 2, ball)) : null;
      self.postMessage({ job, type: 'done', version: LAB_VERSION, params: data.params, radius: ball.radius, layers: ball.layers, results, exact,
        engine: engine ? 'rust-wasm' : 'js', timing: { ballMs: firstBall ? ballMs : 0, runMs: performance.now() - t0, includesTable: firstBall } });
    }
  } catch (error) {
    self.postMessage({ job, type: 'error', message: String(error) });
  }
};
