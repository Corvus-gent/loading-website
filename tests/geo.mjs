import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { mergeLocations, locationLabel, dotRadius } from '../js/stats-map.js';
const cities = [
 {countryCode:'BE',country:'Belgium',region:'Flanders',city:'Ghent',lat:51,lng:3.7,visitors:12},
 {countryCode:'BE',country:'Belgium',region:'Flanders',city:'Bruges',lat:51.2,lng:3.2,visitors:4},
 {countryCode:'BE',country:'Belgium',region:'Wallonia',city:'Namur',lat:50.5,lng:4.9,visitors:2},
 {countryCode:'FR',country:'France',region:'Flanders',city:'Ghent',lat:48.8,lng:2.3,visitors:3},
];
assert.equal(mergeLocations(cities,3).length,2);
assert.equal(mergeLocations(cities,4).length,3);
assert.equal(mergeLocations(cities,6).length,3);
assert.equal(mergeLocations(cities,7).length,4);
const region=mergeLocations(cities,4)[0];assert.equal(region.visitors,16);assert.ok(Math.abs(region.lat-51.05)<1e-10);
assert.equal(locationLabel({...cities[0],level:'city'}),'ghent · 12 souls');
assert.equal(locationLabel({...cities[0],city:'',level:'city'}),'somewhere in belgium');
assert.equal(dotRadius(1),4);assert.equal(dotRadius(100),10);assert.equal(dotRadius(10000),24);
const source = await readFile(new URL('../api/geo.js',import.meta.url),'utf8');
let queries=0,commands=[],cache=null,fail=false,ready=true,redisFail=false;
const context=vm.createContext({});
const hog=new vm.SyntheticModule(['hogql','posthogReady','REAL'],function(){this.setExport('REAL',"properties.$host = 'corvus.gent'");this.setExport('posthogReady',()=>ready);this.setExport('hogql',async query=>{queries++;assert.match(query,/count\(DISTINCT distinct_id\)/);assert.match(query,/GROUP BY 1,2,3,4 LIMIT 3000/);if(fail)throw Error();return [['BE','Belgium','Flanders','Ghent',51.053,3.724,12],['BE','Belgium','','',null,4,1],['BE','Belgium','','',400,4,1]];});},{context});
const redis=new vm.SyntheticModule(['redis','connected'],function(){this.setExport('connected',()=>true);this.setExport('redis',async command=>{commands.push(command);if(redisFail)throw Error();if(command[0]==='GET')return cache;cache=command[2];return 'OK';});},{context});
const module=new vm.SourceTextModule(source,{context});await module.link(s=>s.includes('_posthog')?hog:redis);await module.evaluate();
async function call(method='GET',query={},headers={}){const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(data){this.data=JSON.parse(JSON.stringify(data));return this;}};return module.namespace.default({method,query,headers},res);}
let response=await call();assert.equal(response.code,200);assert.equal(response.headers['Cache-Control'],'public, max-age=0, s-maxage=900');assert.deepEqual(response.data.cities,[{...cities[0],lat:51.1}]);assert.ok(commands.some(c=>c[0]==='SET'&&c[1]==='geo:all'&&c[3]==='EX'&&c[4]==='900'));
await call();assert.equal(queries,1);
cache=null;redisFail=true;response=await call();assert.equal(response.code,200);
fail=true;response=await call();assert.equal(response.code,502);assert.equal(response.headers['Cache-Control'],'no-store');
ready=false;response=await call();assert.equal(response.code,503);
response=await call('POST');assert.equal(response.code,405);
response=await call('GET',{country:'1'},{'x-vercel-ip-country':'BE','x-forwarded-for':'192.0.2.1'});
assert.equal(response.code,200);assert.deepEqual(response.data,{countryCode:'BE'});assert.equal(response.headers['Cache-Control'],'private, no-store');
for(const code of [undefined,'','XX','ZZ','Belgium']){response=await call('GET',{country:'1'},{'x-vercel-ip-country':code});assert.deepEqual(response.data,{countryCode:null});}
assert.equal((await call('POST',{country:'1'})).code,405);
console.log('Geo checks passed: zoom boundaries, weighted centres, unknown labels, radii, rounded city-only response, cache hit/TTL, Redis failure, PostHog failure, readiness and method guard.');
