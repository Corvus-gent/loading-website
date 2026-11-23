// Real local HTTPS transport, real middleware/cookies, no production requests.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import {chromium,webkit,expect} from '@playwright/test';
import middleware from '../../middleware.js';
import {buildFixture} from '../helpers/built-site.mjs';
import {createPerformanceServer} from '../../tools/rust/performance.mjs';
import {prepareVariants} from '../../tools/rust/ten-experiments/variants.mjs';

const out='test-results/rust/measurements/ten-gate';await mkdir(out,{recursive:true});
const fixture=await buildFixture();
const combined=['bundle','parallel','directory','brotli','locale','predict','footer-logo','css-flat','stable-language'];
const variants=await prepareVariants(fixture.root,{combined});const v=variants.options('10-combined');
const server=await createPerformanceServer(fixture.root,v.engine,v.server);
const cert=await mkdtemp(path.join(os.tmpdir(),'corvus-gate-cert-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',cert+'/key.pem','-out',cert+'/cert.pem','-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
const results=[],routingErrors=[],requests=[];let origin;
const proxy=https.createServer({key:await readFile(cert+'/key.pem'),cert:await readFile(cert+'/cert.pem')},async(req,res)=>{
 try{
  const url=new URL(req.url,origin);let target=url.pathname+url.search;
  if(['/api/hit','/api/notice-ok'].includes(url.pathname)){res.writeHead(204).end();return;}
  if(url.pathname==='/api/geo'){res.writeHead(200,{'content-type':'application/json'}).end('{"countryCode":"BE"}');return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const response=middleware(new Request(url,{method:req.method,headers:req.headers}));
  const redirect=response.headers.get('location'),rewrite=response.headers.get('x-middleware-rewrite');
  if(url.pathname==='/')requests.push({cookie:req.headers.cookie||'',gate:!!rewrite});
  if(redirect){res.writeHead(response.status,{location:redirect}).end();return;}
  if(rewrite){const parsed=new URL(rewrite);assert.equal(parsed.origin,origin);target=parsed.pathname+parsed.search;}
  const content=await fetch(server.origin+target,{signal:AbortSignal.timeout(5000)});
  const headers=Object.fromEntries(content.headers);delete headers['content-encoding'];delete headers['content-length'];
  for(const [k,value]of response.headers)if(!k.startsWith('x-middleware'))headers[k]=value;
  res.writeHead(content.status,headers).end(Buffer.from(await content.arrayBuffer()));
 }catch(error){routingErrors.push(error.message);res.writeHead(500).end('Fixture transport error');}
});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));origin='https://127.0.0.1:'+proxy.address().port;
try {
 for(const [name,type] of Object.entries({chromium,webkit})) {
  const browser=await type.launch();
  try {for(const width of [390,1440]) {
   console.log('START',name,width);
   const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:844},isMobile:width===390,hasTouch:width===390,locale:'en-US',timezoneId:width===390?'Europe/Brussels':'America/Los_Angeles',reducedMotion:'reduce'});
   await context.addInitScript(()=>{sessionStorage.setItem('twitch-disabled','1');localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny'}));});
   const unexpected=[],errors=[];
   await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){unexpected.push(route.request().url());return route.abort();}return route.continue();});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   try{
    const first=await page.goto(origin+'/');assert.equal(first.status(),200);
    const html=await first.text();assert.match(html,/property="og:image"/);assert.match(html,/<noscript>/);
    await expect(page.locator('[data-realm-gate] .realm-enter')).toBeVisible();
    await page.reload();await expect(page.locator('[data-realm-gate]')).toHaveCount(1);
    const expectedExpiry=await page.evaluate(()=>{const now=new Date(),end=new Date(now);end.setHours(4,2,0,0);if(end<=now)end.setDate(end.getDate()+1);return end.getTime()/1000;});
    await page.locator('.realm-enter').click();await expect(page).toHaveURL(origin+'/realm/');
    const ritual=(await context.cookies()).find(c=>c.name==='corvus_realm');
    assert(ritual?.value==='1'&&ritual.secure&&ritual.path==='/'&&ritual.sameSite==='Lax');assert(Math.abs(ritual.expires-expectedExpiry)<2);
    const home=await page.goto(origin+'/');assert(!(await home.text()).includes('data-realm-gate'),'no gate in returning HTML');
    await expect(page.locator('.portal-sections')).toBeVisible();
    await page.reload();await expect(page.locator('[data-realm-gate]')).toHaveCount(0);
    await page.screenshot({path:`${out}/${name}-${width}-returned.png`,fullPage:true});
    // Shorten the cookie with the same browser mechanism as the ritual, then
    // verify the actual HTTP response, not WebKit's cached cookie-inspection API.
    await page.evaluate(()=>{document.cookie=`corvus_realm=1; Expires=${new Date(Date.now()+1500).toUTCString()}; Path=/; SameSite=Lax; Secure`;});
    await page.waitForTimeout(1800);
    await page.goto(origin+'/');await expect(page.locator('[data-realm-gate] .realm-enter')).toBeVisible();
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
    results.push({browser:name,width,firstRefreshReturnExpiry:true,ogAndNoscript:true,cookieSecure:true,expiresAtLocal0402:true,errors});
    console.log('PASS',name,width,'entry, refresh, returning HTML, secure 04:02 cookie and expiry');
   }finally{await context.close();}
  }} finally {await browser.close();}
 }
 assert.deepEqual([...server.failures],[]);assert.deepEqual([...server.unknown],[]);assert.deepEqual(routingErrors,[]);
 await writeFile(out+'/report.json',JSON.stringify({combined,transport:'real local HTTPS, self-signed test certificate',finished:new Date().toISOString(),results,requests},null,2)+'\n');
} finally {proxy.closeAllConnections();await new Promise(r=>proxy.close(r));await server.close();await fixture.close();await rm(cert,{recursive:true,force:true});}
