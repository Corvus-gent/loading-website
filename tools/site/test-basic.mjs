import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const group = process.argv[2] ?? 'basic';
if (!['basic', 'legacy'].includes(group)) throw Error('Expected basic or legacy');

const legacy = new Set([
  'test:personas',
  'test:privacy:browser',
  'test:oli:browser',
  'test:sf:browser',
  'test:x:browser',
  'test:performance',
  'test:lighthouse',
  'test:screenshots',
]);

const {scripts} = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));
const tests = Object.keys(scripts).filter(name =>
  name.startsWith('test:') && name !== 'test:e2e' && legacy.has(name) === (group === 'legacy')
);
for (const name of tests) {
  const result = spawnSync('npm', ['run', name], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error('Failed:', name, result.signal ?? result.status);
    process.exitCode = 1;
  }
}
