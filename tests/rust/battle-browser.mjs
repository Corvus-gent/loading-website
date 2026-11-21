import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {isolatedRuntime} from '../helpers/rust-runtime.mjs';
import {rustSite} from '../helpers/rust-site.mjs';
const runtime=await isolatedRuntime('battle'),browser=await chromium.launch();
try{
 for(const width of [390,1440]){
  // This database belongs exclusively to isolatedRuntime(), on a fresh random port.
  await runtime.client.flushDb();
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  let holdNext=false,held=null,release=null;
  const {origin,errors:apiErrors}=await rustSite(context,runtime,{afterResponse:async({route,u,response,body})=>{
   if(holdNext&&u.pathname==='/api/battle'&&!u.searchParams.has('action')&&!u.searchParams.has('media')){
    holdNext=false;held=JSON.parse(body);await new Promise(r=>release=r);await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body});return true;
   }
  }});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const admin=await context.newPage();admin.on('pageerror',e=>errors.push(e.message));
  await admin.goto(origin+'/battle/admin/?key=wrong');await expect(admin.locator('#login')).toBeVisible();await expect(admin.locator('#settings')).toBeHidden();assert(!admin.url().includes('key='));
  await admin.locator('#key').fill(runtime.secret);await admin.locator('#login button').click();await expect(admin.locator('#settings')).toBeVisible();await expect(admin.locator('.admin-row')).toHaveCount(8);
  await admin.locator('#closed').check();await admin.locator('#save').click();await expect(admin.locator('#status')).toContainText('tie');await expect(admin.locator('#save')).toBeEnabled();await admin.locator('#closed').uncheck();
  await page.goto(origin+'/battle/');await expect(page.locator('#connection')).toHaveAttribute('data-rust-battle','');await expect(page.locator('[data-choice=A]')).toBeEnabled();
  await expect(page.locator('#label-A')).toHaveText('VIDEO A');await expect(page.locator('#reveal')).toBeHidden();await expect(page.locator('#total-votes')).toContainText('0 blind votes');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // Keep a pre-vote refresh in flight. Its result must not undo the successful ballot.
  holdNext=true;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect.poll(()=>!!held).toBe(true);assert(!held.pick);
  await page.locator('[data-choice=A]').click();await expect(page.locator('#reveal')).toBeVisible();await expect(page.locator('[data-choice=A]')).toBeDisabled();release();
  await expect(page.locator('#total-votes')).toContainText('1 blind votes');await expect(page.locator('#label-A')).toContainText('A ·');assert.equal(await page.locator('#twist').evaluate(e=>e.open),true);
  const pick=await page.evaluate(()=>localStorage.getItem('battle.vote'));assert(['codex','compound'].includes(pick));
  const text=`I picked ${pick.toUpperCase()} without knowing which AI made it 💀 Codex vs Compound, who wins? Vote blind: https://corvus.gent/go/bio-x`;
  for(const id of ['share-x','share-whatsapp']){const u=new URL(await page.locator('#'+id).getAttribute('href'));assert.equal(u.searchParams.get('text'),text);assert.equal((u.searchParams.get('text').match(/https:\/\//g)||[]).length,1);}
  await page.locator('#share-copy').click();await expect(page.locator('#share-status')).toHaveText('Copied ✅');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),text);
  // Exercise the selection fallback without depending on OS clipboard permissions.
  await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('blocked')};document.execCommand=command=>{window.__selectionCopy={command,text:document.activeElement.value};return true;};});
  await page.locator('#share-copy').click();await expect.poll(()=>page.evaluate(()=>window.__selectionCopy?.text)).toBe(text);assert.equal(await page.evaluate(()=>window.__selectionCopy.command),'copy');
  await page.locator('[data-sound=A]').click();assert.equal(await page.locator('#video-A').evaluate(e=>e.muted),false);assert.equal(await page.locator('#video-B').evaluate(e=>e.muted),true);await page.locator('[data-sound=B]').click();assert.equal(await page.locator('#video-A').evaluate(e=>e.muted),true);assert.equal(await page.locator('#video-B').evaluate(e=>e.muted),false);
  assert.equal(await page.locator('#bonus-videos video').count(),2);
  const cookie=(await context.cookies()).find(c=>c.name==='mvid');assert(cookie?.httpOnly&&cookie.secure&&cookie.path==='/api');
  await page.reload();await expect(page.locator('#reveal')).toBeVisible();await expect(page.locator('#total-votes')).toContainText('1 blind votes');
  await admin.locator('#codex-x-views').fill('12345');await admin.locator('#codex-x-url').fill('https://example.test/video');await admin.locator('#closed').check();await admin.locator('#save').click();await expect(admin.locator('#status')).toHaveText('Saved. Winner: '+pick.toUpperCase());
  await page.reload();await expect(page.locator('#live-label')).toHaveText('FINAL');await expect(page.locator('#winner')).toContainText(pick.toUpperCase());await expect(page.locator('#platform-rows')).toContainText('12,345 / 0');
  await admin.reload();await expect(admin.locator('#codex-x-views')).toHaveValue('12345');await expect(admin.locator('#closed')).toBeChecked();await admin.locator('#closed').uncheck();await admin.locator('#save').click();await expect(admin.locator('#status')).toHaveText('Saved. Voting is open.');
  await mkdir('test-results/rust',{recursive:true});await page.locator('.scoreboard').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/rust/battle-${width}.png`});
  assert.deepEqual(apiErrors,[]);assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS: ${width}px Rust battle → real Rust API/Redis: blind labels, vote lock/reload, late-refresh race, one-link sharing + clipboard fallback, audio controls, admin auth/tie/close/reopen and persisted counts.`);
 }
}finally{await browser.close();await runtime.close();}
