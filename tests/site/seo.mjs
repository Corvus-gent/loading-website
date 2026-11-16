import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pages, attribute, metadata, buildSEO} from '../../tools/site/seo.mjs';
import {noIndex} from '../../js/site/indexing.js';
import middleware from '../../middleware.js';
const tags = html => [...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]);
const value = (html,key) => tags(html).filter(t=>(attribute(t,'property')||attribute(t,'name'))===key).map(t=>attribute(t,'content'));
const canonical = html => [...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).filter(t=>attribute(t,'rel')==='canonical').map(t=>attribute(t,'href'));
const files=pages.map(p=>p[0]==='/'?'index.html':p[0].slice(1)+'index.html').concat('public/realm-entry.html');
const bodies=await Promise.all(files.map(async f=>(await fs.readFile(f,'utf8')).split(/<\/head>/i).slice(1).join('</head>')));
const result=await buildSEO();
assert.equal(new Set(pages.map(p=>p[1])).size,pages.length);assert.equal(new Set(pages.map(p=>p[2])).size,pages.length);
for(let i=0;i<files.length;i++){
 const html=await fs.readFile(files[i],'utf8'), row=pages[i]||pages[0], url='https://corvus.gent'+row[0];
 assert.deepEqual(canonical(html),[url]);
 assert.equal([...html.matchAll(/<title\b/g)].length,1);
 assert.equal(html.split(/<\/head>/i).slice(1).join('</head>'),bodies[i],files[i]+' body untouched');
 for(const key of ['description','og:title','og:description','og:url','og:image','og:image:type','og:image:width','og:image:height','twitter:card','twitter:image'])assert.equal(value(html,key).length,1,files[i]+key);
 assert.deepEqual(value(html,'og:url'),[url]);assert.deepEqual(value(html,'twitter:card'),['summary_large_image']);
 assert(value(html,'og:image')[0].startsWith('https://corvus.gent/'));
 assert(result.main.has(url));assert(!noIndex(url));
}
const root=await fs.readFile('index.html','utf8'),gate=await fs.readFile('public/realm-entry.html','utf8');
for(const key of ['description','og:title','og:description','og:url','og:image'])assert.deepEqual(value(root,key),value(gate,key),'consistent home variants');
const fixture='<html><head><title>old</title><meta content="old" name="description"><link href="/old" rel="canonical"></head><body><svg><title>keep this accessible name</title></svg><p>$1 stays literal.</p></body></html>';
const updated=metadata(fixture,pages[2],{format:'png',width:1200,height:630});
assert(updated.includes('<svg><title>keep this accessible name</title></svg>'));assert(updated.includes('$1 once gets you in'));
assert.equal(metadata(updated,pages[2],{format:'png',width:1200,height:630}),updated,'idempotent head pass');
for(const path of ['/admin','/admin/index.html','/%61dmin/','/army/access/','/letters/confirm/?token=x','/legion/edit/x','/legion/join/x','/clients/x','/compound/stats','/compound/v2/stats','/compound/v2/links','/hack/3/add','/wiki/corvus','/wiki/corvus/namesakes','/legion/call-room','/?email=x','/gabe/?key=x']){
 assert(noIndex(path),path);
 const r=middleware(new Request('https://corvus.gent'+path,{headers:{'user-agent':'Mozilla/5.0'}}));
 assert.match(r.headers.get('X-Robots-Tag'),/noindex/,path);
}
assert(!noIndex('https://stats.corvus.gent/army/'),'public army stats stay indexable');
assert(noIndex('https://stats.corvus.gent/private/'));
const redirected=middleware(new Request('https://corvus.gent/stats/private/'));assert.equal(redirected.status,308);assert.match(redirected.headers.get('Location'),/^https:\/\/stats\.corvus\.gent/);assert.match(redirected.headers.get('X-Robots-Tag'),/noindex/);
for(const file of ['robots.txt','sitemap.xml']){
 const r=middleware(new Request('https://stats.corvus.gent/'+file));assert.equal(r.headers.get('x-middleware-rewrite'),'https://stats.corvus.gent/stats/'+file);
}
for(const [host,list]of [['corvus.gent',result.main],['stats.corvus.gent',result.stats]])for(const url of list){const u=new URL(url);assert.equal(u.hostname,host);assert(!u.search);assert(!noIndex(u));assert(!/\/index\.html$/.test(u.pathname));assert(!['/join-the-army-now/','/submission/','/hack2/','/hack/the-feed/'].includes(u.pathname));}
execFileSync('python3',['-c',`import xml.etree.ElementTree as E
for f in ['sitemap.xml','stats/sitemap.xml']:
 r=E.parse(f).getroot();assert r.tag=='{http://www.sitemaps.org/schemas/sitemap/0.9}urlset'
`]);
for(const file of ['admin/index.html','letters/confirm/index.html','legion/join/index.html','stats/private/index.html','wiki/corvus/index.html'])assert.deepEqual(value(await fs.readFile(file,'utf8'),'robots'),['noindex, nofollow']);
assert((await fs.readFile('robots.txt','utf8')).includes('Sitemap: https://corvus.gent/sitemap.xml'));
assert((await fs.readFile('stats/robots.txt','utf8')).includes('Sitemap: https://stats.corvus.gent/sitemap.xml'));
const first=await Promise.all(files.map(f=>fs.readFile(f,'utf8')));await buildSEO();assert.deepEqual(await Promise.all(files.map(f=>fs.readFile(f,'utf8'))),first);
console.log('PASS: unique metadata, one tag each, consistent gate/home, bodies + SVG names preserved, literal $1, noindex aliases/query/gates, redirects intact, per-host valid XML, public stats retained and repeatable build.');
