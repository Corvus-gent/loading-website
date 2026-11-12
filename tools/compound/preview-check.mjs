import assert from 'node:assert/strict';import fs from 'node:fs';import {chromium,webkit,devices} from 'playwright';import {loadCompoundEnv} from '../compound-env.mjs';
loadCompoundEnv();const base=process.env.COMPOUND_TEST_URL;
assert.ok(/^https:\/\/loading-website-[a-z0-9]+-corvus11\.vercel\.app$/.test(base||''),'explicit isolated preview required');
const cookies=fs.readFileSync(process.env.COMPOUND_PREVIEW_COOKIES,'utf8').split('\n').filter(l=>l.includes('\t')).map(l=>{const[d,,path,secure,expires,name,value]=l.replace(/^#HttpOnly_/,'').split('\t');return{domain:d,path,secure:secure==='TRUE',expires:Number(expires),name,value,httpOnly:true};});
fs.mkdirSync('tests/results/compound-redesign',{recursive:true});
for(const[name,engine,options]of [['preview-desktop',chromium,{viewport:{width:1440,height:1000}}],['preview-iphone',webkit,{...devices['iPhone 13'],viewport:{width:375,height:812}}],['preview-android',chromium,{...devices['Pixel 7']}]]){
 const browser=await engine.launch(),context=await browser.newContext({...options,reducedMotion:'reduce'});await context.addCookies(cookies);await context.route('**/js/analytics.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/compound/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.compoundReady==='1');
  assert.ok(await page.locator('#pick-buttons button').first().isEnabled());assert.ok(await page.locator('#quick-chips button').first().isEnabled());
  await page.locator('#quick-chips button').first().click();await page.waitForFunction(()=>document.getElementById('idea-status').textContent.includes('tap saved'));
  const text='Preview QA '+name+' '+Date.now()+': cut the repeated opening.';
  await page.locator('#idea').fill(text);await page.getByRole('button',{name:'send it →',exact:true}).click();await page.waitForFunction(text=>document.getElementById('feed-notes').textContent.includes(text),text);
  await page.locator('#handle').fill('@preview-editor');await page.locator('#handle-form button').click();await page.waitForFunction(()=>document.getElementById('feed-notes').textContent.includes('@preview-editor'));
  await page.evaluate(()=>{window.shared=null;Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.shared=data;}});});await page.locator('#feedback-share').click();const shared=await page.evaluate(()=>window.shared);assert.equal(Object.keys(shared).join(','),'text');assert.equal((shared.text.match(/corvus\.gent\/compound/g)||[]).length,1);
  await page.locator('#pick-buttons button').first().click();await page.waitForFunction(()=>document.querySelector('#pick-buttons button').disabled);
  const video=page.locator('video').first();await video.scrollIntoViewIfNeeded();await video.evaluate(async v=>{v.muted=true;await v.play();});await page.waitForFunction(()=>!document.querySelector('.bored-button').hidden);await page.locator('.bored-button').first().click();await page.waitForFunction(()=>[...document.querySelectorAll('.bored-heat button')].some(b=>!b.getAttribute('aria-label').includes('· 0 bored')));await video.evaluate(v=>v.pause());
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`tests/results/compound-redesign/${name}-hero.png`});await page.locator('#quick-feedback').scrollIntoViewIfNeeded();await page.screenshot({path:`tests/results/compound-redesign/${name}-feedback.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const login=await context.request.post(base+'/api/compound',{headers:{origin:base},data:{action:'login',role:'admin',password:process.env.COMPOUND_ADMIN_PASSWORD}});assert.equal(login.status(),200);
  const admin=await context.newPage();await admin.goto(base+'/compound/admin/',{waitUntil:'domcontentloaded'});await admin.waitForSelector('#private:not([hidden])');await admin.locator('#admin-feedback li').filter({hasText:text}).getByRole('button',{name:'delete',exact:true}).click();
  await page.waitForFunction(text=>!document.getElementById('feed-notes').textContent.includes(text),text,{timeout:20000});assert.deepEqual(errors,[]);console.log('PASS',name,'real preview API: chip, note, handle, share, ungated vote, video, boredom heat, admin deletion + 10s feed refresh; no errors/overflow');
 }finally{await context.close();await browser.close();}
}
