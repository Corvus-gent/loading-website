import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('Original story copy and links stay intact',async({page})=>{
  const source=await readFile('salesforce/index.html','utf8');
  const copy=source.split('<body>')[1].split('<script>')[0]
    .replace(/<div class="card proof reveal"[\s\S]*?<\/div>/,'')
    .replace(/<p class="live-age">[\s\S]*?<\/p>/,'')
    .replace(/<a class="hire-pill"[\s\S]*?<\/a>/,'')
    .replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
  expect(createHash('sha256').update(copy).digest('hex')).toBe('ce575f8d161d3e4b98ff98581d59e09ab30a6ca697e5e8008afe4dde51804586');
  await page.goto('/salesforce/');await expect(page.locator('.card').first()).toContainText('A train, a café and a tip.');
  await expect(page.locator('a[href*="linkedin.com"]')).toHaveAttribute('href','https://www.linkedin.com/in/francisco-gabriel-van-langenhove/');
});

test('Dive reveals contact pill, bio stats and the real terminal',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/salesforce/');
  await expect(page.locator('.hire-pill')).toBeHidden();await page.locator('.grid').scrollIntoViewIfNeeded();
  await expect(page.locator('.hire-pill')).toBeVisible();await expect(page.locator('.hire-pill')).toContainText('gabriel@corvus.gent');
  await expect(page.locator('.grid>div.bio').first()).toBeVisible();await page.locator('#proof-terminal').scrollIntoViewIfNeeded();
  await expect(page.locator('#proof-terminal')).toContainText('$ status → vibe coding in the back row',{timeout:7000});
  await expect(page.locator('#proof-terminal')).toContainText('$ languages --count → 7');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('Contact splash leads to the existing destination',async({page},testInfo)=>{
  await page.goto('/salesforce/');await page.locator('.grid').scrollIntoViewIfNeeded();const pill=page.locator('.hire-pill');
  await expect(pill).toHaveAttribute('href',/^mailto:gabriel@corvus.gent/);await pill.evaluate(el=>el.href='#test-hired');
  if(testInfo.project.name==='mobile')await pill.tap();else await pill.click();await expect(page).toHaveURL(/#test-hired$/);
});

test('Hidden water does not render',async({page})=>{
  await page.addInitScript(()=>{let hidden=false;Object.defineProperty(document,'hidden',{get:()=>hidden});window.testHidden=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));};});
  await page.goto('/salesforce/');await page.waitForTimeout(150);await page.evaluate(()=>window.testHidden(true));const before=await page.locator('#sea').evaluate(el=>el.toDataURL());
  await page.waitForTimeout(250);expect(await page.locator('#sea').evaluate(el=>el.toDataURL())).toBe(before);
});

test('No-canvas fallback keeps the story and contact usable',async({page})=>{
  await page.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);await page.goto('/salesforce/');
  await expect(page.locator('.card').first()).toHaveClass(/on/);await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
});
