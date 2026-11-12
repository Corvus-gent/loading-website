import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit,devices} from 'playwright';
const base=process.env.COMPOUND_TEST_URL||'http://127.0.0.1:4201';
const run=Date.now();const out='tests/results/compound-redesign';fs.mkdirSync(out,{recursive:true});
for(const [name,engine,options]of [['desktop',chromium,{viewport:{width:1440,height:1000}}],['iphone',webkit,{...devices['iPhone 13'],viewport:{width:375,height:812}}],['android',chromium,{...devices['Pixel 7']}]] ){
 const browser=await engine.launch(),context=await browser.newContext({...options,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/compound/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.compoundReady==='1');
  assert.equal(await page.locator('#prediction').count(),0);
  assert.ok(await page.locator('#deadline-clock [data-unit=days]').innerText()!=='00');
  assert.equal(await page.locator('#pick-buttons button').first().isEnabled(),true,'can vote without watching');
  await page.locator('#pick-buttons button').first().click();
  await page.getByRole('button',{name:'🐌 hook too slow'}).click();
  await page.waitForFunction(()=>document.getElementById('idea-status').textContent.includes('tap saved'));
  assert.equal(await page.locator('#idea').inputValue(),'The hook is too slow because ');
  assert.equal(await page.locator('#idea').evaluate(e=>e.selectionStart),'The hook is too slow because '.length);
  const text=`The hook is too slow because ${name} wants the punchline first (${run}).`;
  await page.locator('#idea').fill(text);
  await page.getByRole('button',{name:'send it →',exact:true}).click();
  await page.waitForFunction(text=>document.getElementById('feed-notes').textContent.includes(text),text);
  assert.equal(await page.locator('#feedback-thanks').isVisible(),true);
  await page.locator('#handle').fill('@'+name+'-editor');
  await page.locator('#handle-form button').click();
  await page.waitForFunction(name=>document.getElementById('feed-notes').textContent.includes('@'+name+'-editor'),name);
  const video=page.locator('video').first();await video.scrollIntoViewIfNeeded();await video.evaluate(async v=>{v.muted=true;await v.play();});
  await page.waitForFunction(()=>!document.querySelector('.bored-button').hidden);
  const [reaction]=await Promise.all([page.waitForRequest(r=>r.url().includes('/api/compound')&&r.postDataJSON()?.type==='bored'),page.getByRole('button',{name:'🥱 BORING HERE'}).first().click()]);
  assert.ok(reaction.postDataJSON().t>=0);assert.ok(reaction.postDataJSON().version);
  await page.waitForFunction(()=>[...document.querySelectorAll('.bored-heat button')].some(b=>!b.getAttribute('aria-label').includes('· 0 bored')));
  await video.evaluate(v=>v.pause());await page.waitForFunction(()=>document.querySelector('.bored-button').hidden);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-hero.png`});
  await page.locator('#quick-feedback').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${name}-feedback.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  // The key is exchanged for an HttpOnly session and removed from history.
  const admin=await context.newPage();await admin.goto(base+'/compound/admin/?key=admin-test-only');await admin.waitForSelector('#private:not([hidden])');assert.ok(!admin.url().includes('key='));
  const row=admin.locator('#admin-feedback li').filter({hasText:text});await row.getByRole('button',{name:'delete',exact:true}).click();await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.compoundReady==='1');await page.waitForTimeout(500);
  assert.ok(!(await page.locator('#feed-notes').innerText()).includes(text),'admin deletion reaches public feed');
  assert.deepEqual(errors,[]);console.log('PASS',name,': instant chip + focus, note + handle, ungated vote, boredom heat, private deletion, no errors/overflow');
 }finally{await context.close();await browser.close();}
}
// Broken modules / failed APIs cannot stop the independent clock or strand a visitor.
const browser=await chromium.launch();const page=await browser.newPage();await page.clock.install({time:new Date('2026-11-08T12:00:00Z')});
await page.route('**/compound/app.js*',r=>r.abort());await page.goto(base+'/compound/',{waitUntil:'domcontentloaded'});await page.clock.fastForward(15000);assert.equal(await page.locator('#reload-cuts').isVisible(),true);assert.equal(await page.locator('[data-unit=days]').innerText(),'01');
await page.clock.setSystemTime(new Date('2026-11-10T12:00:00Z'));await page.clock.fastForward(1000);assert.match(await page.locator('#deadline-note').innerText(),/deadline reached/);await browser.close();
console.log('PASS: failed-module retry, independent countdown, honest expired deadline');
