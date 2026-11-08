import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit, devices } from 'playwright';
const base=process.env.BATTLE_TEST_URL||'http://127.0.0.1:4393';
const cookies=process.env.BATTLE_TEST_COOKIES? (await fs.readFile(process.env.BATTLE_TEST_COOKIES,'utf8')).split('\n').filter(l=>l.includes('\t')).map(l=>{const[d,,path,secure,expires,name,value]=l.replace(/^#HttpOnly_/,'').split('\t');return{domain:d,path,secure:secure==='TRUE',expires:Number(expires),name,value,httpOnly:true};}):[];
const cases=[['desktop',chromium,{viewport:{width:1440,height:900}}],['android-chrome',chromium,devices['Pixel 7']],['iphone-safari',webkit,devices['iPhone 13']]];
for(const[name,engine,options]of cases){
 const browser=await engine.launch({headless:true});
 try{
  for(const pick of ['codex','compound']){
   const context=await browser.newContext({...options,reducedMotion:'reduce'});if(cookies.length)await context.addCookies(cookies);
   const errors=[];let voted=false;const outgoing=[];
   await context.addInitScript(()=>{window.copied=[];window.legacyCopied=[];window.rejectClipboard=false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.rejectClipboard)throw Error('clipboard unavailable');window.copied.push(text);}}});document.execCommand=command=>{if(command!=='copy')return false;window.legacyCopied.push(document.activeElement.value);return true;};navigator.share=()=>{throw Error('Unexpected native share');};});
   await context.route('**/js/analytics.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await context.route('**/api/battle*',async r=>{
    if(r.request().method()==='POST'){assert.equal(r.request().postDataJSON().action,'vote');voted=true;}
    if(new URL(r.request().url()).searchParams.has('media'))return r.fulfill({status:204});
    await r.fulfill({json:{ready:true,closed:false,votes:{codex:voted&&pick==='codex'?1:0,compound:voted&&pick==='compound'?1:0},total:voted?1:0,views:[],clicks:{},tips:{},bonuses:[],disclaimer:'test fixture',...(voted?{pick,order:['codex','compound']}:{})}});
   });
   for(const host of ['x.com','wa.me'])await context.route('https://'+host+'/**',r=>{outgoing.push(r.request().url());return r.fulfill({contentType:'text/html',body:'Share destination test'});});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   // Exercise voting/reveal without fetching videos or adding real votes.
   await page.addInitScript(()=>{Object.defineProperty(HTMLMediaElement.prototype,'src',{set(){},get(){return '';}});Object.defineProperty(HTMLVideoElement.prototype,'poster',{set(){},get(){return '';}});});
   await page.goto(base+'/battle/',{waitUntil:'networkidle'});
   assert.equal(await page.locator('#share-options').isVisible(),false);
   await page.locator('[data-choice="'+(pick==='codex'?'A':'B')+'"]').click();
   await page.locator('#share-options').waitFor({state:'visible'});
   const expected=`I picked ${pick.toUpperCase()} without knowing which AI made it 💀 Codex vs Compound, who wins? Vote blind: https://corvus.gent/go/bio-x`;
   for(const id of ['share-x','share-whatsapp']){
    const link=page.locator('#'+id),href=await link.getAttribute('href'),url=new URL(href);
    assert.equal(url.searchParams.get('text'),expected);assert.equal([...url.searchParams.keys()].join(','),'text');
    assert.equal((url.searchParams.get('text').match(/https:\/\//g)||[]).length,1);
    assert.ok((await link.boundingBox()).height>=48);
    const popupPromise=context.waitForEvent('page');await link.click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');assert.equal(new URL(outgoing.at(-1)).searchParams.get('text'),expected);await popup.close();
   }
   await page.locator('#share-copy').click();assert.equal(await page.locator('#share-status').innerText(),'Copied ✅');assert.deepEqual(await page.evaluate(()=>window.copied),[expected]);
   await page.evaluate(()=>window.rejectClipboard=true);await page.locator('#share-copy').click();assert.equal(await page.locator('#share-status').innerText(),'Copied ✅');assert.deepEqual(await page.evaluate(()=>window.legacyCopied),[expected]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(errors,[]);
   if(pick==='codex'){await fs.mkdir('tests/results/battle-share',{recursive:true});await page.locator('#reveal').screenshot({path:`tests/results/battle-share/${name}.png`});}
   console.log(`${name} ${pick}: reveal, X, WhatsApp, copy + clipboard fallback, single URL, 48px targets, no overflow/errors PASS`);
   await context.close();
  }
 }finally{await browser.close();}
}
