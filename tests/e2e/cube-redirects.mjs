import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const {redirects} = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const destination = '/the6cube/';
for (const alias of ['/thecube', '/cube', '/the-cube', '/the_cube']) {
  for (const source of [alias, alias + '/']) {
    assert.deepEqual(redirects.filter(rule => rule.source === source), [
      {source, destination, statusCode: 301},
    ]);
  }
}
assert.ok(!redirects.some(rule => rule.source === destination || rule.source === '/the6cube'));
