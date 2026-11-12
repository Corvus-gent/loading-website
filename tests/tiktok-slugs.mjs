import assert from 'node:assert/strict';
import {compoundDestination} from '../js/compound-links.js';
import {sourceRows} from '../compound/source-rows.js';
const specs={tt:'gabe.maxxing','tt-bjj':'gabinho_bjj','tt-g':'gabriellvl'};
for(const [slug,account]of Object.entries(specs)){const u=new URL(compoundDestination(slug,'',{keep:'yes'}),'https://corvus.gent');assert.equal(u.pathname,'/compound');for(const[k,v]of Object.entries({utm_source:'tiktok',utm_medium:'bio',utm_content:account,utm_term:slug,keep:'yes'}))assert.equal(u.searchParams.get(k),v);assert.equal(new URL(compoundDestination(slug,'post-2'),'https://corvus.gent').searchParams.get('utm_content'),'post-2');}
const rows=sourceRows({campaigns:Object.keys(specs).map((slug,i)=>({touch:'last',source:'tiktok',slug,content:'override-post',clicks:i+1,visits:1}))});assert.equal(rows.length,3);Object.values(specs).forEach((name,i)=>{assert.equal(rows[i][0],'tiktok · '+name);assert.equal(rows[i][1],i+1);});assert.equal(sourceRows({}).length,3);
console.log('PASS: three TikTok bio slugs, query retention, content override, separate account rows including empty accounts.');
