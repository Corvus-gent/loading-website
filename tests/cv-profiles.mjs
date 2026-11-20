import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {renderCV} from '../lib/cv/page.mjs';import {validatePdfAssets} from '../lib/cv/pdf-contract.mjs';
const data=JSON.parse(await fs.readFile('cv/profiles.json','utf8')),metrics=JSON.parse(await fs.readFile('stats/linkedin/data.json','utf8')),config=JSON.parse(await fs.readFile('vercel.json','utf8'));
const github=JSON.parse(await fs.readFile('cv/github-activity.json','utf8'));
const paths=new Set();
for(const p of data.profiles){assert(!paths.has(p.path));paths.add(p.path);const html=await fs.readFile(p.path.replace(/^\//,'').replace(/\/$/,'')+'/index.html','utf8');assert.equal(html,renderCV(p,data,metrics,github));assert(html.includes('href="/cv"'));assert(html.includes(`href="${p.download}"`));assert(html.includes(`rel="canonical" href="https://corvus.gent${p.path}"`));assert(!html.includes('undefined'));assert(!html.includes('European options:'));if(['tech','social-media'].includes(p.slug)){assert(html.includes(data.summer2027Locations));}else{assert(!html.includes('Summer 2027 preference:'));}if(!['tech','social-media'].includes(p.slug)){assert(config.rewrites.some(r=>r.source===p.path&&r.destination===p.path+'/index.html'));assert(config.rewrites.some(r=>r.source===p.download&&r.destination==='/cv/'+p.pdf));}const pdf=await fs.readFile('cv/'+p.pdf);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');}
const stanford=data.profiles.find(p=>p.slug==='stanford');assert.equal(stanford.kind,'social');assert(stanford.jobUrl.endsWith('/4440338133/'));assert(stanford.proposal.length);for(const slug of ['berkeley','harvard'])assert.equal(data.profiles.find(p=>p.slug===slug).kind,'academic');
const hub=await fs.readFile('cv/index.html','utf8');for(const p of data.profiles)assert(hub.includes(`href="${p.path}"`),p.path+' linked from hub');
assert(hub.includes('href="#research"'));assert(hub.includes('id="research"'));assert(data.samples.find(s=>s.title==='The Compound Effect').image.endsWith('/simon.jpg'));console.log('PASS:',data.profiles.length,'shared profiles, research navigation, Compound portrait, dated metrics, routes and PDFs.');

await validatePdfAssets(data,metrics);
const changed=structuredClone(data);changed.profiles[0].summary+=' Edited after PDF generation.';
await assert.rejects(()=>validatePdfAssets(changed,metrics),/Stale CV PDF:/,'stale download content must block deployment');
const presentationOnly=structuredClone(data);presentationOnly.samples[0].image='/different-card-image.webp';presentationOnly.profiles.reverse();
await validatePdfAssets(presentationOnly,metrics);
const researchHtml=renderCV(data.profiles.find(p=>p.slug==='apple'),data,metrics);
assert(researchHtml.indexOf('id="research"')<researchHtml.indexOf('id="results"'),'research evidence precedes social metrics');
assert(researchHtml.includes('href="#research"'),'research CTA reaches research evidence');
const hubResearch=hub.match(/<section id="research"[\s\S]*?<\/section>/)[0];
assert.deepEqual([...hubResearch.matchAll(/href="\/cv\/work\/([^"]+)"/g)].map(m=>m[1]),data.profiles.filter(p=>p.company).map(p=>p.slug),'employer priority is consistent');
console.log('PASS: stale-PDF rejection, presentation-only changes, research-first evidence and employer priority.');

for(const lang of ['nl','es','fr','pt','de','zh']){const copy=JSON.parse(await fs.readFile('public/i18n/site.'+lang+'.json','utf8'));for(const key of ['Apple →','Anthropic →','OpenAI →','Amazon →','Google →',data.name])assert.equal(copy[key],key,'proper name preserved in '+lang);assert(copy['See research ↓']);}
assert(researchHtml.includes('<h1 translate="no">'+data.name+'</h1>'));
console.log('PASS: candidate identity, company names and original paper titles survive translation.');

for(const p of data.profiles){const html=renderCV(p,data,metrics,github);const parent=p.company?'research':p.institution?'studies':'work';assert(html.includes('href="/cv#'+parent+'"'),'return navigation reaches the relevant hub section');}
for(const match of hub.matchAll(/aria-labelledby="([^"]+)"/g))for(const id of match[1].split(/\s+/))assert(hub.includes('id="'+id+'"'),'accessible label reference '+id+' exists');
console.log('PASS: contextual return navigation and unique accessible card-link labels.');

for(const p of data.profiles){const html=renderCV(p,data,metrics,github);assert(html.includes('id="github"'));assert(html.includes(github.periods[github.asOf.slice(0,7)].sourceAdded.toLocaleString('en-US')));assert(html.includes('not my complete lifetime GitHub activity'));}
for(const [period,totals]of Object.entries(github.periods)){for(const key of ['commits','sourceAdded','sourceDeleted'])assert.equal(totals[key],github.repositories.reduce((n,r)=>n+(r.periods[period]?.[key]||0),0));}
console.log('PASS: dated GitHub evidence reconciles to public source snapshots; scope and growth claims are explicit.');
