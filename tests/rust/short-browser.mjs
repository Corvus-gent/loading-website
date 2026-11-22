import assert from 'node:assert/strict';import {chromium,expect} from '@playwright/test';import {rustSite} from '../helpers/rust-site.mjs';
const browser=await chromium.launch(),snapshots={};
try{for(const engine of['legacy','rust']){
 const context=await browser.newContext({viewport:{width:390,height:844}});let clicks=[];
 await context.addInitScript(()=>{window.posthog={capture:(...args)=>{window.captures??=[];window.captures.push(args);}};});
 const fixture=await rustSite(context,{}, {browserEngine:engine,beforeRequest:async({route,u,request})=>{
 if(u.pathname==='/short-fixture/'||u.pathname==='/'){await route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>short-link fixture</body></html>'});return true;}
 if(u.pathname.startsWith('/go/')){await route.fulfill({contentType:'text/html',body:'<!doctype html><body>opening<script type="module">import {go} from "/js/go.js";go();</script>'});return true;}
 if(u.pathname==='/site.json'){await route.fulfill({contentType:'application/json',body:JSON.stringify({coffee:'https://buymeacoffee.com/fixture?keep=1',booking15:'https://booking.example.test/fixture?keep=1'})});return true;}
 if(u.pathname==='/api/legion'){clicks.push(request.postDataJSON());await route.fulfill({contentType:'application/json',body:'{}'});return true;}
 }});await context.route('https://booking.example.test/**',route=>route.fulfill({contentType:'text/html',body:'local external-destination fixture'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://corvus.gent/short-fixture/');
 const output=await page.evaluate(async()=>{const m=await import('/js/go.js');const results=[];for(const platform of ['li','ig','tt','x','mail','unknown'])for(const target of ['me','home','sidequests','pidgy','x','book','coffee','unknown'])for(const campaign of ['', '/402','/bad@email'])results.push(await m.resolve('/go/'+platform+'/'+target+campaign,'?utm_content=sf-08'));return results;});if(engine==='legacy')snapshots.resolve=output;else assert.deepEqual(output,snapshots.resolve);
 await page.goto('https://corvus.gent/go/li/home/402');await expect(page).toHaveURL('https://corvus.gent/?utm_source=linkedin&utm_medium=post&utm_campaign=402&utm_content=home');assert.deepEqual(clicks,[{action:'short_click',path:'/go/li/home/402'}]);
 await page.goto('https://corvus.gent/go/x/book/test?utm_content=sf-23');await expect(page).toHaveURL('https://booking.example.test/fixture?keep=1&utm_source=x&utm_medium=social&utm_campaign=gabe-test&utm_content=sf-23');assert.equal(clicks.length,2);assert.deepEqual(errors,[]);await fixture.drain();await context.close();console.log('PASS',engine,'144 short-link contracts and internal/external navigation; aggregate click once, campaign/slot retained');
}}finally{await browser.close();}
