import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectRows,seriesFor,sum,comparison} from '../stats/linkedin/model.js';
const data=JSON.parse(fs.readFileSync(new URL('../stats/linkedin/data.json',import.meta.url)));
assert(data.daily.length>0);for(const key of ['impressions','engagements','newFollowers'])assert.equal(sum(data.daily,key),data.totals[key]);
const rows=selectRows(data,'7'),expected=data.daily.filter(r=>r.date!==data.source.partialDate).slice(-7);assert.deepEqual(rows,expected);assert(!rows.some(r=>r.date===data.source.partialDate));
const cumulative=seriesFor(rows,'impressions');assert.equal(cumulative[0].value,rows[0].impressions);assert.equal(cumulative.at(-1).value,sum(rows,'impressions'));assert.equal(seriesFor(rows,'impressions','daily').at(-1).value,rows.at(-1).impressions);
const fixture={daily:Array.from({length:14},(_,i)=>({date:new Date(Date.UTC(2026,9,30+i)).toISOString().slice(0,10),impressions:i<6?700:i===6?762:i<13?11000:15664}))};
const c=comparison(fixture);assert.equal(c.value,81664);assert.equal(c.previous,4962);assert.equal(Math.round(c.change),1546);
const missing=[{date:'2026-01-01',newFollowers:1},{date:'2026-01-02',newFollowers:null},{date:'2026-01-03',newFollowers:2}];assert.equal(sum(missing,'newFollowers'),null);assert.deepEqual(seriesFor(missing,'newFollowers').map(p=>p.value),[1,null,null]);assert.deepEqual(seriesFor(missing,'newFollowers','daily').map(p=>p.value),[1,null,2]);
const middleware=fs.readFileSync(new URL('../middleware.js',import.meta.url),'utf8');
// Execute the actual middleware against a few clean routes using only dependency stubs.
const {SourceTextModule,SyntheticModule,createContext}=await import('node:vm');const context=createContext({URL,Response,console,fetch:async()=>new Response('')});
const mod=new SourceTextModule(middleware,{context});await mod.link(async spec=>{const values=spec.includes('page-tiers')?{tierPath:()=>null}:spec.includes('og-routes')?{ogRoute:()=>null}:spec.includes('compound-links')?{COMPOUND_LINKS:{}}:{rewrite:url=>({rewrite:url.href}),next:()=>({next:true}),waitUntil:()=>{}};const m=new SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context});return m;});await mod.evaluate();
const route=async url=>mod.namespace.default(new Request(url,{headers:{'user-agent':'Mozilla/5.0'}}));
assert.equal((await route('https://stats.corvus.gent/linkedin')).rewrite,'https://stats.corvus.gent/stats/linkedin/');assert.equal((await route('https://stats.corvus.gent/coffee')).rewrite,'https://stats.corvus.gent/stats/coffee/');assert.equal((await route('https://corvus.gent/stats/linkedin')).headers.get('location'),'https://stats.corvus.gent/linkedin');assert.equal((await route('https://stats.corvus.gent/linkedin/index.html')).headers.get('location'),'https://stats.corvus.gent/linkedin/');
console.log('PASS: totals, 7-day cutoff, partial-day exclusion, cumulative/daily, missing data, SF comparison and stats host routing');
