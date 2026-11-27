// Reproduce the /cube scramble experiment from the command line.
//   node tools/cube/experiment.mjs --steps 2 --seed 1729 --samples 10000
//   node tools/cube/experiment.mjs --steps 8 --seed 1729 --samples 10000 --csv > run.csv
//   node tools/cube/experiment.mjs --snapshot > cube/lab-snapshot.json
import { buildBall, runExperiment, exactDistribution, validateParams, toCSV, LAB_VERSION, GENERATORS, STEP_OPTIONS } from '../../the6cube/lab.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(part => {
  const [name, ...value] = part.trim().split(/\s+/);
  return [name, value.join(' ') || true];
}));
const t0 = performance.now();
const ball = buildBall();
const tBall = performance.now() - t0;

if (args.snapshot) {
  const runs = [];
  for (const steps of STEP_OPTIONS) {
    const params = { steps, seed: 1729, samples: 10000 };
    const results = GENERATORS.map(generator => {
      const { bins, examples } = runExperiment({ generator, ...params, ball });
      return { generator, bins, examples };
    });
    const exact = steps === 2 ? GENERATORS.map(generator => exactDistribution(generator, 2, ball)) : null;
    runs.push({ ...params, results, exact });
  }
  process.stdout.write(JSON.stringify({ version: LAB_VERSION, radius: ball.radius, layers: ball.layers, generatedBy: 'node tools/cube/experiment.mjs --snapshot', runs }, null, 1) + '\n');
} else {
  const params = validateParams({ steps: args.steps, seed: args.seed, n: args.samples });
  const t1 = performance.now();
  const results = GENERATORS.map(generator => runExperiment({ generator, ...params, ball, keepTrials: !!args.csv }));
  const tRun = performance.now() - t1;
  if (args.csv) process.stdout.write(toCSV(results, { ...params, radius: ball.radius }));
  else {
    console.log(JSON.stringify({ version: LAB_VERSION, ...params, radius: ball.radius, layers: ball.layers }, null, 0));
    for (const r of results) console.log(r.generator.padEnd(9), r.bins.map((c, i) => `${i > ball.radius ? '>=' + (ball.radius + 1) : 'd=' + i}:${c}`).join('  '));
    if (params.steps === 2) for (const g of GENERATORS) { const e = exactDistribution(g, 2, ball); console.log('exact', g.padEnd(9), e.bins.map(b => `${b}/${e.denominator}`).join('  ')); }
    console.error(`ball ${tBall.toFixed(0)} ms (includes search-table construction), run ${tRun.toFixed(0)} ms, node ${process.version}`);
  }
}
