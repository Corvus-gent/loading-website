import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {buildFixture} from './helpers/built-site.mjs';
const fixture=await buildFixture(),types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.md':'text/markdown'};
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 try{
  const u=new URL(req.url,'http://fixture');if(u.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');res.end(JSON.stringify({ready:false,live:false,profiles:[],members:[],total:0}));return;}
  let file=path.resolve(fixture.root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(fixture.root+path.sep)&&file!==fixture.root)throw Error('path');
  if((await stat(file)).isDirectory())file=path.join(file,'index.html');
  res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try{
 const directory=JSON.parse(await readFile(path.join(fixture.root,'site-directory.json'),'utf8'));
 assert(directory.routes.some(r=>r.path.replace(/\/$/,'')==='/build/rust'),'map/search catalogue contains the report');
 await mkdir('test-results/migration-report',{recursive:true});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny'})));
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/build/rust/');await expect(page.locator('#readiness-chart .chart-row')).toHaveCount(3);
  await expect(page.locator('#timing-rows tr').first()).toContainText('6,553 ms');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'test-results/migration-report/'+width+'-hero.png'});
  await page.locator('#speed').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/migration-report/'+width+'-speed.png'});
  await page.locator('#device').selectOption('desktop');await page.locator('#cache').selectOption('warm');
  await expect(page.locator('#timing-rows tr').first()).toContainText('39 ms');assert(page.url().includes('device=desktop')&&page.url().includes('cache=warm'));
  await page.reload();await expect(page.locator('#device')).toHaveValue('desktop');await expect(page.locator('#cache')).toHaveValue('warm');
  await page.locator('#device').focus();await page.keyboard.press('Tab');await expect(page.locator('#cache')).toBeFocused();
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download article notes'}).click();const file=await(await download).path();assert((await readFile(file,'utf8')).includes('Credits charged: unverified'));
  await page.goto(origin+'/build/');await expect(page.locator('a[href="/build/rust/"]')).toBeVisible();await page.locator('a[href="/build/rust/"]').click();await expect(page.locator('h1')).toContainText('rewrite worth it');
  assert.deepEqual(errors,[]);await context.close();
 }
 const offline=await browser.newContext();await offline.route('**/build/rust/data.json',r=>r.fulfill({status:503,body:'{}'}));const failed=await offline.newPage();await failed.goto(origin+'/build/rust/');await expect(failed.locator('#device')).toBeDisabled();await expect(failed.locator('#timing-rows')).toContainText('6,553 ms');await expect(failed.locator('#comparison-note')).toContainText('verified mobile table remains');await offline.close();
 const nojs=await browser.newContext({javaScriptEnabled:false});const staticPage=await nojs.newPage();await staticPage.goto(origin+'/build/rust/');await expect(staticPage.locator('#timing-rows')).toContainText('6,553 ms');await expect(staticPage.getByRole('link',{name:'Download article notes'})).toBeVisible();await nojs.close();
 console.log('PASS full publish build, discovery, 390/1440 layout, truthful charts, keyboard and URL state, article download, build-page navigation, no-JS and failed-data fallback; no console errors.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fixture.close();}
