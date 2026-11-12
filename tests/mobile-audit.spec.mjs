import {test,expect} from '@playwright/test';
const key=href=>{const u=new URL(href);return u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'');};
let errors;
test.beforeEach(async({page})=>{errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('lang','en'));await page.route('**/api/hit',r=>r.fulfill({json:{ok:true}}));});
test.afterEach(()=>expect(errors).toEqual([]));
for(const person of ['gabe','corvus','pidgy'])test(person+' hub has one social set and a usable home route',async({page})=>{
 await page.goto('/links/'+person);await expect(page.locator('#main a')).not.toHaveCount(0);await expect(page.locator('#corner-nav a[href="/realm/"]')).toBeVisible();await expect(page.locator('#corner-nav .nav-army')).toBeVisible();
 const urls=await page.locator('#socials a,#follow a').evaluateAll(a=>a.map(x=>x.href));expect(new Set(urls.map(key)).size).toBe(urls.length);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#corner-nav a[href="/realm/"]').click();await expect(page).toHaveURL(/\/realm\//);
});
test('privacy has only corner home and one additional realm link',async({page})=>{await page.goto('/privacy/');await expect(page.locator('#corner-nav')).toBeVisible();await expect(page.locator('a[href="/realm/"]')).toHaveCount(2);});
test('Gabe profile preserves prose links once and the grouped LinkedIn links',async({page})=>{
 await page.goto('/people/?id=gabe');await expect(page.locator('#person-about')).not.toBeEmpty();const hrefs=(await page.locator('#person-about a,#person-links a').evaluateAll(a=>a.map(x=>x.href))).map(key);
 for(const expected of ['pidgy-ai.com','alkmist.com','instagram.com/gabinho_bjj'])expect(hrefs.filter(h=>h===expected)).toHaveLength(1);
 await expect(page.locator('#person-links details').filter({hasText:'LinkedIn'})).toHaveCount(1);expect(new Set(hrefs).size).toBe(hrefs.length);
 await page.getByRole('link',{name:'FR',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','fr');const translated=(await page.locator('#person-about a,#person-links a').evaluateAll(a=>a.map(x=>x.href))).map(key);expect(new Set(translated).size).toBe(translated.length);
});
test('gate explains earned contributions; focused forms leave the document scrollable',async({page})=>{
 await page.route('**/api/army*',r=>{const data=r.request().method()==='POST'?r.request().postDataJSON():null;return r.fulfill({json:data?.action==='challenge'?{challenge:{id:'fixture',salt:'fixture',bits:0,notBefore:0}}:r.request().url().includes('view=public')?{soldiers:4,atGate:1,recruitedToday:1}:{self:null}})});
 await page.goto('/join-the-army-now/');await expect(page.locator('#rank-rules tr')).toHaveCount(4);await expect(page.locator('#rank-rules')).toContainText('approved help or intro');await expect(page.locator('#rank-rules')).not.toContainText('toll');
 await page.locator('#enlist-name').fill('@Phone Helper');await page.locator('#enlist-why').fill('i help people build');await page.locator('#enlist-why').blur();await page.evaluate(()=>window.scrollTo(0,0));await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
 await page.locator('.hero-actions .primary').click();await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);await expect(page.locator('#enlist-name')).toHaveValue('phone_helper');expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
});

test('owner contribution form submits a concrete help reference',async({page})=>{
 let posted;
 await page.route('**/__contribution-ui',r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><main id="admin"></main><script type="module">import {mountArmy} from "/js/private-army.js";mountArmy(document.getElementById("admin"));</script></body></html>'}));
 await page.route('**/api/army?admin=1**',r=>{if(r.request().method()==='POST'){posted=r.request().postDataJSON();return r.fulfill({json:{credited:true}});}return r.fulfill({json:{rows:[],unmatched:[],discordReady:true}});});
 await page.goto('/__contribution-ui');await page.getByLabel('contributor username').fill('helper');await page.getByLabel('contribution type').selectOption('intro');await page.getByLabel('contribution reference').fill('intro-reviewed-2026-11-06');await page.getByRole('button',{name:'approve contribution (+25)',exact:true}).click();await expect(page.getByText('confirmed. +25 earned points.')).toBeVisible();expect(posted).toEqual({action:'approve-help',username:'helper',kind:'intro',reference:'intro-reviewed-2026-11-06'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
