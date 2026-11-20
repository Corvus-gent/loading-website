// Runs the real Rust/WASM entry gate against a local copy of the production HTML.
// Existing styles/translations stay identical; only portal.js is replaced by the WASM bridge.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import nl from '../../js/locales/nl.js';
import fr from '../../js/locales/fr.js';
let liveStatus={live:false,source:'manual',session:'rust-fixture-1'};
const root=process.cwd(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');return res.end(JSON.stringify(url.pathname==='/api/live'?liveStatus:{ready:false}));}
 if(url.pathname==='/js/i18n/language.js'){res.setHeader('content-type','text/javascript');return res.end("import init,* as m from '/rust/browser/pkg/corvus_browser.js';await init();m.start_languages();export const LANGS=m.language_codes(),getLang=m.get_language,t=m.translate,pick=m.pick_language,applyI18n=m.apply_language,renderSwitcher=m.render_language_switcher;");}
 if(url.pathname==='/js/i18n/bar.js'){res.setHeader('content-type','text/javascript');return res.end("import './language.js';import {start_language_bar} from '/rust/browser/pkg/corvus_browser.js';start_language_bar();");}
 if(url.pathname==='/js/live-banner.js'){res.setHeader('content-type','text/javascript');return res.end("import init,{start_live_banner} from '/rust/browser/pkg/corvus_browser.js';await init();start_live_banner();");}
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
 const ctx=await browser.newContext({viewport:{width,height:844},timezoneId:timezone,reducedMotion});
 // External embeds are outside this isolated compatibility test, never load live third-party code.
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await ctx.addInitScript(()=>sessionStorage.setItem('twitch-disabled','1'));
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto(base+'/');await expect(p.locator('body')).toHaveAttribute('data-rust-portal','');
 await expect(p.locator('#lang-switcher')).toHaveAttribute('data-rust-languages','');
 await p.locator('#lang-switcher a[hreflang="nl"]').click();await expect(p.locator('.realm-enter')).toHaveText(nl['realm.enter']);
 assert((await ctx.cookies()).some(c=>c.name==='corvus_lang'&&c.value==='nl'&&c.secure));
 const dateResults=await p.evaluate(async()=>{const m=await import('/rust/browser/pkg/corvus_browser.js');await m.default();return ['2026-03-29T01:59:59Z','2026-03-29T02:02:00Z','2026-11-01T09:01:59Z','2026-11-01T12:02:00Z','2026-11-20T03:01:59Z'].map(s=>{const now=new Date(s),end=new Date(now);end.setHours(4,2,0,0);if(end<=now)end.setDate(end.getDate()+1);return[m.next_ritual_ms(now.getTime()),end.getTime()];});});dateResults.forEach(([a,b])=>assert.equal(a,b));
 const expected=await p.evaluate(()=>{const d=new Date();d.setHours(4,2,0,0);if(d<=new Date())d.setDate(d.getDate()+1);return d.getTime()/1000;});
 await p.locator('.realm-enter').click();await expect(p).toHaveURL(/\/realm\//);
 const cookie=(await ctx.cookies()).find(c=>c.name==='corvus_realm');assert(cookie?.secure);assert.equal(cookie.sameSite,'Lax');assert(Math.abs(cookie.expires-expected)<2);
 for(const [route,key]of [['/realm/','realm.title'],['/now/','now.sub'],['/languages/','lang.sub']]){
  await p.goto(base+route);await p.locator('#lang-switcher a[hreflang="fr"]').click();await expect(p.locator('[data-i18n="'+key+'"]').first()).toHaveText(fr[key]);
  await p.locator('#lang-switcher a[hreflang="nl"]').click();await expect(p.locator('[data-i18n="'+key+'"]').first()).toHaveText(nl[key]);
  assert.equal(await p.evaluate(()=>document.querySelectorAll('#lang-switcher').length),1);
 }
 await p.evaluate(()=>localStorage.removeItem('lang'));
 const r=await p.goto(base+'/');assert(!(await r.text()).includes('data-realm-gate'));
 await ctx.clearCookies({name:'corvus_realm'});await p.reload();await expect(p.locator('[data-realm-gate]')).toBeVisible();
 await mkdir('test-results/rust',{recursive:true});await p.screenshot({path:`test-results/rust/realm-${width}.png`});
 await expect(p.locator('html')).toHaveAttribute('lang','nl');
 await p.goto(base+'/daily/');const banner=p.locator('[data-rust-live]');await expect(banner).toBeHidden();
 liveStatus={live:true,source:'manual',session:'rust-fixture-1'};await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(banner).toBeVisible();
 await expect(banner.locator('a[href="/go/twitch"]')).toBeVisible();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.getByRole('button',{name:'Dismiss live banner'}).click();await expect(banner).toBeHidden();await p.reload();await expect(banner).toBeHidden();
 liveStatus.session='rust-fixture-2';await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(banner).toBeVisible();
 await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.site-live-dot').evaluate(e=>getComputedStyle(e).animationName),'none');
 await p.evaluate(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});await p.getByRole('button',{name:'Dismiss live banner'}).click();await expect(banner).toBeHidden();
 liveStatus={live:false,source:'manual',session:'rust-fixture-1'};
 assert.deepEqual(errors,[]);console.log(`PASS: ${width}px Rust/WASM gate, motion preference, cookie flags, no return flash, expiry, DST language switching on home + 3 subpages; live banner, dismissal, new session, blocked storage and reduced motion.`);await ctx.close();
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
