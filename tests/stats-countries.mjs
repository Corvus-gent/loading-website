import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const countryRows=['BE','FR','US','NL','DE','GB','PT','NZ','?'].map((code,i)=>[code,9-i]);
const commands=[],queries=[],context=vm.createContext({});
const posthog=new vm.SyntheticModule(['hogql','posthogReady','REAL'],function(){
  this.setExport('REAL',"properties.$host='corvus.gent'");this.setExport('posthogReady',()=>true);
  this.setExport('hogql',async query=>{
    queries.push(query);
    if(query.includes('corvus_country_code'))return countryRows;
    if(query.startsWith('SELECT count(),'))return [[0,0]];
    if(query.startsWith('SELECT count(DISTINCT')||query.startsWith('SELECT sum('))return [[45]];
    return [];
  });
},{context});
const storage=new vm.SyntheticModule(['redis','connected'],function(){
  this.setExport('connected',()=>true);this.setExport('redis',async command=>{commands.push(command);return command[0]==='HGETALL'?[]:null;});
},{context});
const sections=new vm.SyntheticModule(['default'],function(){this.setExport('default',()=>{});},{context});
const module=new vm.SourceTextModule(await readFile(new URL('../api/stats.js',import.meta.url),'utf8'),{context});
await module.link(name=>name.includes('_posthog')?posthog:name.includes('_redis')?storage:sections);await module.evaluate();
const response={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},send(body){this.data=JSON.parse(body);return this},json(body){this.data=body;return this}};
await module.namespace.default({query:{}},response);
assert.equal(response.code,200);
assert.equal(response.data.countries.length,9);
assert.equal(response.data.countries[0].n,9);
const query=queries.find(q=>q.includes('corvus_country_code'));
assert.match(query,/count\(DISTINCT distinct_id\)/);
assert.match(query,/properties\.\$geoip_country_code/);
assert.match(query,/Europe\/Brussels/);
assert.match(query,/LIMIT 300/);
assert.ok(commands.some(c=>c[0]==='SET'&&c[1].startsWith('stats:v4:')&&c[3]==='EX'&&c[4]==='300'));
assert.equal(response.headers['Cache-Control'],'public, max-age=60');
console.log('Country stats passed: more than six countries, unique daily counts, historical GeoIP fallback, Brussels date, fresh cache.');
