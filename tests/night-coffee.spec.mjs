import {test,expect} from '@playwright/test';
import {PRIVACY_VERSION} from '../js/privacy-strings.js';
const issues=new WeakMap();
test.beforeEach(async({page}) => {
  const errors=[];issues.set(page,errors);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(version=>localStorage.setItem('analytics-consent',JSON.stringify({version,choice:'deny',expires:Date.now()+86400000})),PRIVACY_VERSION);
  await page.route('**/api/**',r=>r.fulfill({json:{hosts:[],hours:[],countries:[],sources:[],pages:[],browsers:[],terminal:[],cli:{},visitors:0,total:0}}));
});
test.afterEach(async({page})=>expect(issues.get(page)).toEqual([]));
test('terminal on portal, realm and legacy destinations',async({page})=>{
  for(const path of ['/','/realm/','/now/','/sidequests','/support/','/call/','/languages/']){
    await page.goto(path);
    await page.keyboard.press('p');
    const input=page.getByRole('textbox',{name:'terminal',exact:true});
    await expect(input).toHaveValue('p');
    await input.fill('pidgy');await input.press('Enter');
    await expect(page.locator('.term-out')).toContainText('coo. 🐦');
    await input.fill('coo');await input.press('Enter');
    await expect(page.locator('.term-out')).toContainText('coo coo.');
    await input.press('Escape');await expect(page.locator('.term')).toBeHidden();
  }
  await page.goto('/');await page.locator('[data-terminal]').click();
  await expect(page.locator('.term-lantern')).toBeVisible();
  await expect(page.locator('.term-no.show').first()).toHaveText('no? → this is one');
  await expect(page.locator('.term-nontech')).toHaveClass(/show/);
});
test('lantern follows pointer and keyboard; door, idle reward and night clock',async({page})=>{
  await page.clock.install({time:new Date('2026-11-07T12:00:00Z')});
  await page.goto('/realm/');const links=page.locator('.realm-places a');
  const music=links.nth(1),call=links.nth(2);
  await music.hover();await expect(music).toHaveClass(/lit/);
  const before=await page.locator('.night-light').evaluate(e=>e.style.transform);
  await call.hover();await expect(call).toHaveClass(/lit/);
  expect(await page.locator('.night-light').evaluate(e=>e.style.transform)).not.toBe(before);
  await music.focus();await page.keyboard.press('Tab');await expect(call).toBeFocused();await expect(call).toHaveClass(/lit/);
  await page.locator('.night-door').click();await expect(page.locator('dialog.term')).toBeVisible();await page.keyboard.press('Escape');
  // Start a fresh, stationary visit after keyboard focus has scrolled the previous scene.
  await page.reload();
  const crow=page.locator('.night-crow');await expect(crow).toBeAttached();await expect(crow).toBeHidden();
  await page.clock.runFor(200);await page.clock.fastForward(28500);await expect(crow).toBeHidden();
  await page.clock.fastForward(1800);await expect(crow).toBeVisible();
  await crow.click();await crow.click();await expect(page.locator('#egg-toast')).toContainText('1/7');
  const whisper=await page.locator('.night-whisper').textContent();
  await page.reload();await expect(page.locator('.night-whisper')).not.toHaveText(whisper);
  await expect(page.locator('#sf-realm')).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-17T01:31:00+01:00'));await page.reload();
  await expect(crow).toBeVisible();await expect(page.locator('#sf-realm')).toBeHidden();
});
test('touch lights the scene; reduced motion keeps labels visible',async({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:360,height:740}});
  const page=await context.newPage();
  try {
    await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:4176')+'/realm/');
    const scene=page.locator('.night-scene');await expect(scene).toHaveClass(/awake/);
    await scene.tap({position:{x:150,y:6}});
    const light=page.locator('.night-light');const start=await light.evaluate(e=>e.style.transform);
    await expect.poll(()=>light.evaluate(e=>e.style.transform),{timeout:7500}).not.toBe(start);
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(Number(await page.locator('.realm-places b').last().evaluate(e=>getComputedStyle(e).opacity))).toBeGreaterThan(.5);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally { await context.close(); }
});
for(const path of ['/stats/','/stats/coffee/'])test('coffee states and languages on '+path,async({page})=>{
  let coffee={ready:false};
  await page.route('**/api/stats?section=coffee',r=>r.fulfill({json:coffee}));
  await page.goto(path);const panel=page.locator('[data-coffee]');
  await expect(panel).toContainText('the cup is still empty.');await expect(panel.locator('[data-counts]')).toBeHidden();
  coffee={ready:true,total:68,supporters:5,month:6,latest:'2026-11-02'};
  await page.clock.setFixedTime(new Date('2026-11-05T09:00:00Z'));await page.reload();
  await expect(panel.locator('[data-cups]')).toHaveText('☕'.repeat(50)+' +18');
  await expect(panel.locator('time')).toHaveText('3 days ago');
  await page.locator('#lang-switcher a').filter({hasText:/^NL$/}).click();
  await expect(panel.locator('time')).toHaveText('3 dagen geleden');
  await expect(panel.locator('.coffee-context')).toContainText('maaltijdcheques');
});
