import assert from 'node:assert/strict';
import {COMPOUND_LINKS,compoundDestination} from '../js/compound-links.js';
import {inferredSource} from '../js/social-attribution.js';
import {attribution} from '../api/_compound/model.js';
import middleware from '../middleware.js';
for(const [slug,spec]of Object.entries(COMPOUND_LINKS)){
 for(const ua of ['Instagram 350.0 iPhone','LinkedInApp iPhone']){
  const request=new Request('https://corvus.gent/'+slug+'?c=launch.2&keep=yes',{headers:{'user-agent':ua}});
  const response=middleware(request),rewrite=new URL(response.headers.get('x-middleware-rewrite'));
  assert.equal(rewrite.searchParams.get('keep'),'yes');assert.equal(rewrite.searchParams.get('slug'),slug);
  const dest=new URL(compoundDestination(slug,'launch.2',Object.fromEntries(rewrite.searchParams)),'https://corvus.gent');
  assert.equal(dest.pathname,'/compound');assert.equal(dest.searchParams.get('keep'),'yes');assert.equal(dest.searchParams.get('utm_source'),spec[0]);assert.equal(dest.searchParams.get('utm_medium'),spec[1]);assert.equal(dest.searchParams.get('utm_content'),'launch.2');assert.equal(dest.searchParams.has('compound'),false);
  assert.deepEqual(inferredSource({search:dest.search,userAgent:ua}),{source:spec[0],source_confidence:'utm'});
 }
 const dest=new URL(compoundDestination(slug),'https://corvus.gent');if(spec[2])assert.equal(dest.searchParams.get('utm_content'),spec[2]);
}
for(const [ua,source]of [['Instagram','instagram'],['FBAN/FBIOS FBAV/1','facebook'],['LinkedInApp','linkedin'],['TikTok','tiktok'],['musical_ly','tiktok'],['BytedanceWebview','tiktok'],['Twitter','x']])assert.deepEqual(inferredSource({userAgent:ua}),{source,source_confidence:'user_agent'});
for(const [referrer,source]of [['https://lnkd.in/a','linkedin'],['https://www.linkedin.com/feed/','linkedin'],['https://l.instagram.com/','instagram'],['https://t.co/a','x']])assert.deepEqual(inferredSource({referrer}),{source,source_confidence:'referrer'});
assert.deepEqual(inferredSource({userAgent:'Safari'}),{source:'direct',source_confidence:'unknown'});
assert.equal(inferredSource({referrer:'https://linkedin.com.attacker.test'}).source_confidence,'unknown');
assert.equal(attribution({source:'instagram',content:'gabe.maxxing',source_confidence:'user_agent'}).content,'gabe.maxxing');
assert.equal(attribution({source:'instagram',content:'email@example.test'}).content,undefined);
console.log(Object.keys(COMPOUND_LINKS).length+' slugs × two in-app user agents, preserved queries, defaults, overrides, bounded attribution passed.');
