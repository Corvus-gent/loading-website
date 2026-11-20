// Runs the real Rust/WASM entry gate against a local copy of the production HTML.
// Existing styles/translations stay identical; only portal.js is replaced by the WASM bridge.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const root=process.cwd(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');return res.end(JSON.stringify({ready:false}));}
 if(url.pathname==='/js/portal.js'){res.setHeader('content-type','text/javascript');return res.end("import init,{start_portal} from '/rust/browser/pkg/corvus_browser.js';await init();start_portal();");}
 let name=url.pathname==='/'&&!/(?:^|;\\s*)corvus_realm=1(?:;|$)/.test(req.headers.cookie||'')?'/public/realm-entry.html':url.pathname;
 if(!path.extname(name))name=name.replace(/\/$/,'')+'/index.html';
 const file=path.resolve(root,'.'+decodeURIComponent(name));if(!file.startsWith(root+path.sep))throw Error('path');
 res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.setHeader('cache-control','no-store');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
try{
 for(const [width,timezone,reducedMotion] of [[390,'Europe/Brussels','reduce'],[1440,'America/Los_Angeles','no-preference']]){
 const ctx=await browser.newContext({viewport:{width,height:844},timezoneId:timezone,reducedMotion});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/');await expect(p.locator('body')).toHaveAttribute('data-rust-portal','');
 const dateResults=await p.evaluate(async()=>{const m=await import('/rust/browser/pkg/corvus_browser.js');await m.default();return ['2026-03-29T01:59:59Z','2026-03-29T02:02:00Z','2026-11-01T09:01:59Z','2026-11-01T12:02:00Z','2026-11-20T03:01:59Z'].map(s=>{const now=new Date(s),end=new Date(now);end.setHours(4,2,0,0);if(end<=now)end.setDate(end.getDate()+1);return[m.next_ritual_ms(now.getTime()),end.getTime()];});});dateResults.forEach(([a,b])=>assert.equal(a,b));
 const expected=await p.evaluate(()=>{const d=new Date();d.setHours(4,2,0,0);if(d<=new Date())d.setDate(d.getDate()+1);return d.getTime()/1000;});
 await p.locator('.realm-enter').click();await expect(p).toHaveURL(/\/realm\//);
 const cookie=(await ctx.cookies()).find(c=>c.name==='corvus_realm');assert(cookie?.secure);assert.equal(cookie.sameSite,'Lax');assert(Math.abs(cookie.expires-expected)<2);
 const r=await p.goto(base+'/');assert(!(await r.text()).includes('data-realm-gate'));
 await ctx.clearCookies({name:'corvus_realm'});await p.reload();await expect(p.locator('[data-realm-gate]')).toBeVisible();
 await mkdir('test-results/rust',{recursive:true});await p.screenshot({path:`test-results/rust/realm-${width}.png`});
 assert.deepEqual(errors,[]);console.log(`PASS: ${width}px Rust/WASM gate, motion preference, cookie flags, no return flash, expiry and DST parity.`);await ctx.close();
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
