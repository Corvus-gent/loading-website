// Real Rust/WASM + real Rust API + disposable Redis; no browser request reaches production.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
import {wasmBridge} from '../helpers/rust-bridges.mjs';
const runtime=await isolatedRuntime(),browser=await chromium.launch();
const root=process.cwd(),origin='https://corvus.gent';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4'};
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});const apiErrors=[];
  await context.addInitScript(()=>sessionStorage.setItem('twitch-disabled','1'));
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());
   if(u.origin!==origin)return route.abort();
   // Every request is fulfilled locally. There is deliberately no route.continue().
   const bridge=wasmBridge(u.pathname);if(bridge)return route.fulfill({contentType:'text/javascript',body:bridge});
   if(u.pathname.startsWith('/api/')){
    const module={'/api/support':'support','/api/battle':'battle'}[u.pathname];
    if(!module)return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname==='/api/live'?{live:false,session:'fixture',source:'manual'}:{ready:false})});
    const target=new URL(runtime.url);target.search=u.search;target.searchParams.set('module',module);
    const headers=await request.allHeaders();delete headers.host;delete headers['content-length'];headers['x-forwarded-for']=width===390?'198.51.100.190':'198.51.100.191';
    const response=await fetch(target,{method:request.method(),headers,body:request.postDataBuffer()||undefined,redirect:'manual'});
    if(response.status>=500)apiErrors.push({path:u.pathname,status:response.status});
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
   }
   try{let file=u.pathname;if(!path.extname(file))file=file.replace(/\/$/,'')+'/index.html';file=path.resolve(root,'.'+decodeURIComponent(file));if(!file.startsWith(root+path.sep))throw Error('outside fixture');return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{return route.fulfill({status:404,body:'Not found'});}
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/call/?utm_source=linkedin');await expect(page.locator('#call-request')).toHaveAttribute('data-rust-support','');
  await page.locator('[data-call-tier=coffee]').click();await expect(page.locator('#call-coffee-step')).toBeVisible();
  for(const [name,value]of Object.entries({name:'Real flow fixture '+width,contact:'fixture@example.test',pain:'one thing to ship',times:'tomorrow after 3pm PT'}))await page.locator('#call-request [name='+name+']').fill(value);
  await page.locator('#call-request [type=submit]').click();assert.equal(await page.locator('[name=coffeePaid]').evaluate(e=>e.validity.valueMissing),true);assert.equal(await runtime.client.zCard('support:diogenes:preview:v1:requests'),width===390?0:1);
  await page.locator('[name=coffeePaid]').check();await page.locator('#call-request [type=submit]').click();await expect(page.locator('#call-success')).toBeVisible({timeout:12000});
  const ids=await runtime.client.zRange('support:diogenes:preview:v1:requests',0,-1);assert.equal(ids.length,width===390?1:2);
  const records=await Promise.all(ids.map(id=>runtime.client.get('support:diogenes:preview:v1:request:'+id).then(JSON.parse)));const record=records.find(r=>r.name==='Real flow fixture '+width);assert(record);assert.equal(record.source,'linkedin');assert.equal(record.coffeePaid,true);assert.equal(record.mailSent,false);
  await page.goto(origin+'/call/admin/?key='+runtime.secret);await expect(page.locator('.call-admin-card')).toHaveCount(ids.length);assert(!page.url().includes('key='));
  const card=page.locator('.call-admin-card').filter({has:page.getByRole('heading',{name:'Real flow fixture '+width+' · 15 min coffee',exact:true})});await card.locator('select').selectOption('scheduled');await expect(page.locator('#admin-status')).toHaveText('status saved');
  assert.equal(JSON.parse(await runtime.client.get('support:diogenes:preview:v1:request:'+record.id)).status,'scheduled');await page.reload();await expect(card.locator('select')).toHaveValue('scheduled');
  await card.getByRole('button',{name:'retry email →'}).click();await expect(card.locator('.mail-pending')).toHaveText('email still pending. retry shortly.');
  await mkdir('test-results/rust',{recursive:true});await page.screenshot({path:`test-results/rust/booking-real-${width}.png`});
  assert.deepEqual(apiErrors,[]);assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS: ${width}px real Rust/WASM booking → Rust validation → Redis → private Rust/WASM admin → persisted status. Zero production requests or emails.`);
 }
}finally{await browser.close();await runtime.close();}
