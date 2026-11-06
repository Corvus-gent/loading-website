// Real local handlers/Redis, mocked outgoing mail. No production mutations.
import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4195';
if(!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base))throw Error('local fixture only');
for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']]){
 const browser=await engine.launch();const context=await browser.newContext({viewport:{width:375,height:812},extraHTTPHeaders:{'x-test-ip':name==='chromium'?'198.51.100.81':'198.51.100.82'}}),page=await context.newPage(),errors=[],posts=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/army')&&r.method()==='POST')posts.push(r.postDataJSON());});
 try{
  await page.goto(base+'/now/');await page.locator('.feather').click();await page.locator('.feather-caught').waitFor();
  await page.reload();await page.locator('.feather-caught').click();assert.match(await page.locator('#egg-toast').textContent(),/already caught · 1\/7/);assert.equal(posts.length,0,'no anonymous identity or challenge created');
  // Register and claim an account; the local catch must sync using a real proof.
  const username='feather_'+Date.now().toString(36),email=username+'@example.test';
  await page.goto(base+'/army/access/');await page.locator('#account-email').fill(email);await page.locator('#account-name').fill(username);await page.locator('#register-form button').click();await page.locator('#account-pending').waitFor({state:'visible',timeout:30000});
  const mails=await fetch(base+'/__mail').then(r=>r.json()),token=/token=([A-Za-z0-9_-]{48})/.exec(mails.find(m=>m.to.includes(email)).text)[1];
  await page.goto(base+'/army/access/#token='+token);await page.locator('#claim-button').click();await page.locator('#account-settings').waitFor({state:'visible'});
  await page.goto(base+'/now/');await expect.poll(()=>page.evaluate(async()=>{const d=await fetch('/api/army').then(r=>r.json());return d.self?.featherSpots||[];}),{timeout:25000}).toContain('/now/');
  assert(posts.some(p=>p.action==='feather'&&p.spot==='/now/'&&Number.isInteger(p.nonce)&&p.challenge),JSON.stringify(posts.map(({action,spot,nonce,challenge})=>({action,spot,nonce,proof:!!challenge}))));
  await page.evaluate(()=>localStorage.clear());await page.reload();await page.locator('.feather-caught').click();assert.match(await page.locator('#egg-toast').textContent(),/already caught · 1\/7/);
  assert.equal(await page.locator('.feather').count(),0);assert.equal(await page.locator('#hidden-feather').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const state=await context.storageState();state.origins=[];const second=await browser.newContext({viewport:{width:375,height:812},storageState:state});const other=await second.newPage();await other.goto(base+'/now/');await other.locator('.feather-caught').click();assert.match(await other.locator('#egg-toast').textContent(),/1\/7/);await second.close();
  await page.screenshot({path:'tests/results/feathers-'+name+'.png'});
  await page.evaluate(()=>fetch('/api/army',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',confirm:true})}));
  assert.deepEqual(errors,[]);console.log(name+': anonymous reload, real challenge sync, cleared storage, second signed-in context, 375px passed');
 }finally{await browser.close();}
}
