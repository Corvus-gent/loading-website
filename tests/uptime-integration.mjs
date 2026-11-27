import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {prometheus,createMetricsHandler} from '../api/_health-metrics.js';
import {summarizeTelemetry} from '../js/uptime-summary.js';
const sample={checked_at:'2026-11-22T12:00:00Z',checks:{site:{ok:true,ms:125},redis:{ok:false,ms:3000},notion:{ok:true,ms:10,skipped:true},private_secret:{ok:true,ms:1}}};
const output=prometheus(sample,Date.parse(sample.checked_at)+60000);
assert(output.includes('corvus_service_up{service="site"} 1'));assert(output.includes('corvus_service_up{service="redis"} 0'));assert(output.includes('corvus_service_check_duration_seconds{service="site"} 0.125'));assert(!output.includes('notion'));assert(!output.includes('private_secret'));assert(output.includes('corvus_health_sample_age_seconds 60'));assert.equal(prometheus(null).includes('corvus_service_up{'),false);
let reads=0;const handler=createMetricsHandler({env:{GRAFANA_METRICS_TOKEN:'a'.repeat(32)},read:async()=>{reads++;return JSON.stringify(sample)}});
const response=()=>({code:0,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},end(body){this.body=body;return this},send(body){this.body=body;return this}});
let r=response();await handler({method:'GET',headers:{}},r);assert.equal(r.code,401);assert.equal(reads,0);
r=response();await handler({method:'GET',headers:{authorization:'Bearer '+'a'.repeat(32)}},r);assert.equal(r.code,200);assert.equal(reads,1);assert(r.body.includes('corvus_service_up'));
r=response();await createMetricsHandler({env:{},read:async()=>{throw Error()}})({method:'GET',headers:{}},r);assert.equal(r.code,503);
const t=summarizeTelemetry({range:'24h',step:300000,times:[0,100,300000],series:{overall:[[100,150,1],[120,200,1],null]},checks:[{state:1},{state:0},{state:3}]});assert.equal(t.observed,1);assert.equal(t.total,288);assert.equal(t.healthy,1);assert.equal(t.services,2);assert(t.coverage<100);assert.equal(summarizeTelemetry({}).average,null);
const panel=await fs.readFile('js/stats-data.js','utf8');assert(!panel.includes('try again'));assert(panel.includes('/uptime'));assert(!panel.includes('ui.button'));
const html=await fs.readFile('stats/status/index.html','utf8');assert(!html.includes('try again'));assert(html.includes('https://stats.corvus.gent/uptime'));assert(html.includes('corvus-grafana.json'));
const template=JSON.parse(await fs.readFile('public/observability/corvus-grafana.json'));assert.equal(template.panels.length,6);
console.log('PASS: metrics auth, safe sample export, missing/skipped values, gap-aware coverage, dashboard and stats navigation.');
const {default:middleware}=await import('../middleware.js');
for(const path of ['/status','/service/']){
 const result=middleware(new Request('https://stats.corvus.gent'+path+'?lang=es'));
 assert.equal(result.status,308);
 assert.equal(result.headers.get('location'),'/uptime?lang=es');
}
assert.equal(middleware(new Request('https://stats.corvus.gent/uptime?lang=en')).headers.get('x-middleware-rewrite'),'https://stats.corvus.gent/stats/status/index.html?lang=en');
console.log('PASS: canonical uptime routes preserve language.');

assert.equal(summarizeTelemetry({range:'24h',step:300000,times:Array.from({length:287},(_,i)=>i*300000),series:{overall:Array.from({length:287},()=>[1,1,1])}}).coverage,99.7,'one missing slot must not round to full coverage');
