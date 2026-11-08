import assert from 'node:assert/strict';
import {geoRows,geoQuery,geoData} from '../api/_geo-data.js';
import handler from '../api/geo.js';
import {mergeLocations,locationLabel} from '../js/stats-map.js';
const data=geoRows([
 ['US','','',null,null,83],['US','California','San Francisco','37.77','-122.42',5],
 ['US','New York','New York',40.7,-74,3],['US','Oregon','Private singleton',45,-122,1],
 ['BE','Flanders','Ghent',51,3.7,12],['?','','',null,null,2]
]);
assert.equal(data.countries.find(c=>c.c==='US').n,92);
assert.equal(data.cities.filter(c=>c.countryCode==='US').reduce((n,c)=>n+c.visitors,0),92);
assert.equal(data.cities.find(c=>c.countryCode==='US'&&c.unknown).visitors,84);
assert(!JSON.stringify(data).includes('Private singleton'));
assert.equal(data.mapped+data.unlocated,data.total);
for(const z of [2,4,6,7,12])assert.equal(mergeLocations(data.cities,z).reduce((n,c)=>n+c.visitors,0),data.mapped);
assert.match(locationLabel(mergeLocations(data.cities,2).find(c=>c.country==='United States')),/92 souls/);
assert.match(locationLabel(mergeLocations(data.cities,8).find(c=>c.unknown)),/unknown city/);
assert.equal(geoRows([['US','','',null,null,1]]).cities[0].visitors,1);
assert.equal(geoRows([['US','CA','Invalid',100,200,2]]).cities[0].unknown,true);
assert.match(geoQuery('2026-11-08'),/Europe\/Brussels/);assert.match(geoQuery('all'),/GROUP BY country, distinct_id/);
assert(!geoQuery('all').includes('latitude IS NOT NULL GROUP'));assert.throws(()=>geoQuery("' OR 1"));
assert.deepEqual(await geoData('2026-11-08',async sql=>sql.startsWith('SELECT country')?[['US','','',null,null,92]]:[['US',92]]),{...geoRows([['US','','',null,null,92]]),cityUnavailable:false});
async function call(headers={},query={country:'1'},method='GET'){const res={setHeader(){},status(s){this.code=s;return this;},json(d){this.data=d;return this;}};await handler({method,query,headers},res);return res;}
let r=await call({'x-vercel-ip-country':'US','x-vercel-ip-city':'San%20Francisco','x-vercel-ip-country-region':'CA','x-vercel-ip-latitude':'37.7749','x-vercel-ip-longitude':'-122.4194','x-forwarded-for':'1.2.3.4'});
assert.deepEqual(r.data,{countryCode:'US',city:'San Francisco',region:'CA',lat:37.8,lng:-122.4});
assert.deepEqual((await call({'x-vercel-ip-country':'US','x-vercel-ip-city':'%bad'})).data,{countryCode:'US'});
assert.equal((await call({}, {},'POST')).code,405);
console.log('PASS: 92 US visitors mapped at every zoom; missing coords + singleton privacy retained; shared Brussels scope; decoded/rounded city headers; no raw IPs.');
const failDetail=await geoData('2026-11-08',async sql=>{if(sql.startsWith('SELECT country'))throw Error('timeout');return [['US',92],['MY',1],['PK',1]];});
assert.equal(failDetail.cityUnavailable,true);assert.equal(failDetail.unlocated,0);assert.equal(failDetail.mapped,94);
const same=geoRows([['US','CA','San Francisco',37.7,-122.4,1],['US','CA','San Francisco',37.8,-122.4,1]]);
assert.equal(same.cities[0].visitors,2);assert.equal(same.cities[0].unknown,false);
const drift=await geoData('2026-11-08',async sql=>sql.startsWith('SELECT country')?[['US','CA','San Francisco',37.8,-122.4,5]]:[['US',6]]);
assert.equal(drift.cities.reduce((n,p)=>n+p.visitors,0),6);assert.equal(drift.cities[0].unknown,true);
console.log('PASS: provider outage retains totals; all countries in the incident have fallback positions; repeated cities dedupe; source drift cannot inflate map totals.');
