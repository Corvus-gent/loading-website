import assert from 'node:assert/strict';
process.env.REDIS_MAINTENANCE='1';
const {countCoffee}=await import('../api/_coffee.js');
const {default:handler}=await import('../api/stats.js');
import middleware from '../middleware.js';
const now = new Date('2026-11-05T12:00Z');
const gift = {support_id:1,support_created_on:'2026-10-31 23:10:00',payer_email:'example@example.test',support_coffees:48,support_note:'private message'};
const member = {subscription_id:4,subscription_created_on:'2026-09-01 11:00:00',subscription_coffee_num:3,payer_email:'EXAMPLE@example.test'};
const extra = {purchase_id:8,purchased_on:'2026-11-02 11:00:00',purchase_amount:88,payer_email:'***@example.test'};
const pages = {
  supporters:[[gift],[gift,{...gift,support_id:2,support_coffees:2},{...gift,is_refunded:1,support_id:3}]],
  subscriptions:[[member]],extras:[[extra,{...extra,purchase_id:9,purchase_is_revoked:1}]],
};
const requests = [];
async function provider(url,opts) {
  const u = new URL(url);
  assert.equal(u.origin,'https://developers.buymeacoffee.com');
  assert.equal(opts.headers.Authorization,'Bearer local-test');
  assert.equal(opts.redirect,'error');
  requests.push(url);
  const list = pages[u.pathname.split('/').pop()];
  const n = Number(u.searchParams.get('page'));
  return Response.json({current_page:n,last_page:list.length,next_page_url:n<list.length?'https://malicious.example/':null,data:list[n-1]});
}
const stats = await countCoffee('local-test',now,provider);
assert.deepEqual(stats,{ready:true,total:53,supporters:2,supportersEstimated:true,month:50,latest:'2026-11-01'});
assert.equal(requests.length,4);
assert.doesNotMatch(JSON.stringify(stats),/example|private|Bearer|88/);
assert.equal((await countCoffee('test',now,async url => url.includes('supporters')?Response.json({current_page:1,data:[]}):new Response(null,{status:404}))).total,0);
await assert.rejects(countCoffee('bad',now,async () => new Response(null,{status:401})));
function response() {
  return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
}
delete process.env.BMC_TOKEN;
const req = {method:'GET',query:{section:'coffee'}};
const empty = await handler(req,response());
assert.equal(empty.code,200);assert.deepEqual(empty.data,{ready:false});
const original = globalThis.fetch;
try {
  process.env.BMC_TOKEN='local-test';
  globalThis.fetch = provider;
  requests.length=0;
  const both=await Promise.all([handler(req,response()),handler(req,response())]);
  assert.deepEqual(both[0].data,both[1].data);
  assert.equal(both[0].data.total,53);
  assert.equal(requests.length,4);
  await handler(req,response());assert.equal(requests.length,4);
} finally { globalThis.fetch=original; delete process.env.BMC_TOKEN; }
const query='?utm_id=li_20261105&x=1&x=2&ref=a%2Fb';
for (const alias of ['/sidequest','/sidequest/']) {
  const r=middleware(new Request('https://corvus.gent'+alias+query));
  assert.equal(r.status,307);assert.equal(r.headers.get('location'),'https://corvus.gent/sidequests'+query);
}
assert.equal(middleware(new Request('https://stats.corvus.gent/coffee')).headers.get('x-middleware-rewrite'),'https://stats.corvus.gent/stats/coffee/');
assert.match(middleware(new Request('https://stats.corvus.gent/coffee-with-gabe')).headers.get('location'),/\/go\/corvus\/coffee\/coffee-stats$/);
console.log('Coffee feed, pagination, Brussels month, counts-only cache, empty token and routes passed.');
