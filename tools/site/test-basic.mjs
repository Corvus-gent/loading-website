import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const {scripts} = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));
for (const name of Object.keys(scripts).filter(name => name.startsWith('test:') && name !== 'test:e2e')) {
  const result = spawnSync('npm', ['run', name], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error('Failed:', name, result.signal ?? result.status);
    process.exitCode = 1;
  }
}
