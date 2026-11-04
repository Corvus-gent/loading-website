import assert from 'node:assert/strict';
import fs from 'node:fs';
import middleware from '../middleware.js';
import bank from '../api/_game-data.js';
const request=url=>middleware(new Request(url,{headers:{'user-agent':'Mozilla/5.0'}}));
for(const page of ['', 'pidgy', 'games', 'map', 'music', 'hunt', 'private']){
  const route=page?`/${page}/`:'/';
  const result=request(`https://stats.corvus.gent${route}`);
  assert.equal(result.headers.get('x-middleware-rewrite'),`https://stats.corvus.gent/stats/${page?`${page}/`:''}`);
  const redirect=request(`https://corvus.gent/stats${route}?lang=fr`);
  assert.equal(redirect.status,308);
  assert.equal(redirect.headers.get('location'),`https://stats.corvus.gent${route}?lang=fr`);
}
assert.equal(request('https://corvus.gent/statstore').headers.get('x-middleware-next'),'1');
assert.equal(request('https://stats.corvus.gent/stats/games?lang=fr').headers.get('location'),'https://stats.corvus.gent/games?lang=fr');
for(const name of ['countries','languages','words','artists'])assert.deepEqual(bank[name],JSON.parse(fs.readFileSync(`games/data/${name}.json`)));
assert.match(fs.readFileSync('.vercelignore','utf8'),/^games\/data$/m);
console.log('Passed: all stats routes, private route, French redirects, server-only game bank consistency.');
