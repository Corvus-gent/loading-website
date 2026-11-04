import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium} from '@playwright/test';
import middleware from '../middleware.js';
const aliases={
 '/enter':'/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=button',
 '/the-crow':'/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=website',
 '/revived':'/?utm_source=linkedin&utm_medium=company-post&utm_campaign=gabe-corvus-revival',
};
const search=JSON.parse(fs.readFileSync('search-index.json','utf8'));
for(const [slug,location]of Object.entries(aliases)){
 assert.equal(fs.existsSync('.'+slug),false);
 assert.ok(!search.some(entry=>new URL(entry.url,'https://corvus.gent').pathname.replace(/\/$/,'')===slug));
 for(const host of ['corvus.gent','www.corvus.gent','example.vercel.app'])for(const method of ['GET','HEAD'])for(const suffix of ['','/','?utm_source=override']){
  const res=middleware(new Request(`https://${host}${slug}${suffix}`,{method,headers:{'user-agent':'curl/8'}}));assert.equal(res.status,307);assert.equal(res.headers.get('Location'),location);
 }
}
for(const path of ['/realm/','/games/','/music/','/call/','/stats/'])assert.notEqual(middleware(new Request('https://corvus.gent'+path)).status,307);
const server=createServer((req,res)=>{const result=middleware(new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end();});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{for(const [slug,expected]of Object.entries(aliases))for(const suffix of ['','/']){
 const {stdout}=await promisify(execFile)('curl',['-sI',`http://127.0.0.1:${server.address().port}${slug}${suffix}`]);
 assert.match(stdout,/^HTTP\/\S+ 307/);assert.equal(/^location:\s*(.+)$/im.exec(stdout)?.[1].trim(),expected);
 console.log(`${slug+suffix}: 307 ${expected}`);
}}finally{await new Promise(resolve=>server.close(resolve));}
const browser=await chromium.launch();
const sdk=`window.__captures=[];window.posthog={register(p){this.props=p;},capture(event,p={}){window.__captures.push({event,props:{...this.props,...p},url:location.href});},init(key,options){window.__auto=options.capture_pageview;options.loaded(this);}};`;
try{
 for(const [slug,target]of Object.entries(aliases)){
  const page=await browser.newPage();await page.route('**/api/**',r=>r.fulfill({json:{countryCode:'BE'}}));await page.route('https://eu-assets.i.posthog.com/static/array.js',r=>r.fulfill({contentType:'text/javascript',body:sdk}));
  await page.goto('http://127.0.0.1:4176'+target+'&utm_extra=drop&UTM_duplicate=drop&ref=drop&lang=en#kept');
  await page.waitForFunction(()=>window.__captures?.some(c=>c.event==='$pageview')&&!location.search.includes('utm_'));
  const result=await page.evaluate(()=>({events:window.__captures.filter(c=>c.event==='$pageview'),auto:window.__auto,url:location.pathname+location.search+location.hash}));
  assert.equal(result.events.length,1);assert.equal(result.auto,false);assert.equal(result.url,'/?lang=en#kept');
  for(const [key,value]of new URLSearchParams(target.slice(2)))assert.equal(result.events[0].props[key],value);
  assert.match(result.events[0].url,/utm_source=linkedin/);assert.match(result.events[0].props.$current_url,/utm_source=linkedin/);
  await page.close();
 }
 const page=await browser.newPage();await page.route('**/api/**',r=>r.fulfill({json:{}}));await page.goto('http://127.0.0.1:4176/stats/private/?UTM_test=x&ref=y&lang=nl#keep');await page.waitForFunction(()=>location.search==='?lang=nl');assert.ok(page.url().endsWith('?lang=nl#keep'));
 await page.route('https://eu-assets.i.posthog.com/static/array.js',r=>r.abort());await page.goto('http://127.0.0.1:4176/?utm_source=linkedin&ref=x&lang=en');await page.waitForFunction(()=>location.search==='?lang=en');
 console.log('Browser checks passed: capture before cleanup, exact LinkedIn attribution, functional params/hash preserved, private pages and blocked SDK.');
}finally{await browser.close();}
