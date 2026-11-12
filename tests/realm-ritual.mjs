import assert from 'node:assert/strict';
import middleware from '../middleware.js';
import {nextRealmReset} from '../js/realm-reset.js';

for (const zone of ['America/Los_Angeles', 'Europe/Brussels', 'Asia/Kolkata']) {
  process.env.TZ = zone;
  for (const [year, month, day] of [[2026, 2, 8], [2026, 9, 25], [2026, 10, 1], [2026, 11, 31]]) {
    const at = (d,h,m,s) => new Date(year, month, d, h, m, s);
    assert.equal(+nextRealmReset(at(day,4,1,59)), +at(day,4,2,0));
    assert.equal(+nextRealmReset(at(day,4,2,0)), +at(day+1,4,2,0));
    assert.equal(+nextRealmReset(at(day,23,59,59)), +at(day+1,4,2,0));
    assert.equal(+nextRealmReset(at(day-1,12,0,0)), +at(day,4,2,0));
  }
}
const request = (path,cookie='',ua='Mozilla/5.0') => middleware(new Request('https://corvus.gent'+path,{headers:{cookie,'user-agent':ua}}));
for (const cookie of ['', 'corvus_realm=10', 'other_corvus_realm=1']) {
  const res=request('/?utm_source=qr',cookie,'LinkedInBot');
  assert.equal(res.headers.get('x-middleware-rewrite'),'https://corvus.gent/public/realm-entry.html?utm_source=qr');
  assert.match(res.headers.get('cache-control'),/no-store/);
}
assert.equal(request('/','abc=x; corvus_realm=1').headers.get('x-middleware-next'),'1');
assert.equal(request('/realm/').headers.get('x-middleware-next'),'1');
for (const route of ['/links/gabe','/soldier/santobjj']) {
  const res = request(route+'/?ref=example');
  assert.equal(res.status,308);
  assert.equal(res.headers.get('location'),'https://corvus.gent'+route+'?ref=example');
}
console.log('Gate, cache variants, canonical routes, 04:02 rollover, DST and year boundary passed.');
