import assert from 'node:assert/strict';
import fs from 'node:fs';
import middleware from '../middleware.js';
import {relativeRedirect} from '../js/relative-redirect.js';
assert.equal(relativeRedirect('/stats/?lang=fr').headers.get('location'), '/stats/?lang=fr');
assert.equal(relativeRedirect('https://example.org/').status, 400);
import bank from '../api/_game-data.js';
const request=url=>middleware(new Request(url,{headers:{'user-agent':'Mozilla/5.0'}}));
for(const page of ['', 'pidgy', 'games', 'map', 'music', 'hunt', 'x', 'coffee', 'status', 'private']){
  const route=page?`/${page}/`:'/';
  const result=request(`https://stats.corvus.gent${route}`);
  if(page==='status'){
    assert.equal(result.status,308);
    assert.equal(result.headers.get('location'),'/uptime');
  }else assert.equal(result.headers.get('x-middleware-rewrite'),`https://stats.corvus.gent/stats/${page?`${page}/`:''}`);
  const redirect=request(`https://corvus.gent/stats${route}?lang=fr`);
  assert.equal(redirect.headers.get('x-middleware-next'),'1');
}
assert.equal(request('https://corvus.gent/statstore').headers.get('x-middleware-next'),'1');
assert.equal(request('https://stats.corvus.gent/stats/games?lang=fr').headers.get('location'),'/games?lang=fr');
for (const path of ['', 'pidgy/', 'games/', 'map/', 'music/', 'hunt/', 'x/', 'coffee/', 'status/', 'hack/', 'army/', 'private/', 'stats/', 'stats/coffee/']) {
  const response = request('https://stats.corvus.gent/' + path + 'index.html?lang=fr');
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/' + path + '?lang=fr');
}
for(const name of ['countries','languages','words','artists'])assert.deepEqual(bank[name],JSON.parse(fs.readFileSync(`games/data/${name}.json`)));
assert.match(fs.readFileSync('.vercelignore','utf8'),/^games\/data$/m);
console.log('Passed: all stats routes, private route, French redirects, server-only game bank consistency.');

const hosting=JSON.parse(fs.readFileSync('vercel.json','utf8'));
assert.ok(hosting.rewrites.some(r=>r.source==='/api/hit'&&r.destination==='/api/stats?hit=1'));
assert.ok(fs.existsSync('api/_hit.js'));
