import {test, expect} from '@playwright/test';
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MODULES = {tue: 'glyphs', wed: 'ink', thu: 'water', fri: 'room', sat: 'mirror', sun: 'night'};
const LABELS = ['Mon · Lantern', 'Tue · Glyphs', 'Wed · Ink', 'Thu · Water', 'Fri · Room', 'Sat · Mirror', 'Sun · Night'];

test.beforeEach(async ({page, baseURL}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === baseURL ? route.continue() : route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
  });
  page.__entranceErrors = errors;
});
test.afterEach(async ({page}) => { expect(page.__entranceErrors).toEqual([]); });

for (const [i, day] of DAYS.entries()) test(`${day}: Brussels date, lazy scene, usable door and cookie`, async ({page, baseURL}, info) => {
  const date = new Date(`2026-11-${23 + i}T12:00:00Z`);
  await page.clock.install({time: date}); await page.clock.setFixedTime(date);
  const loaded = [];
  page.on('request', r => { if (/\/entry-days\/(glyphs|ink|water|room|mirror|night)\.js/.test(r.url())) loaded.push(new URL(r.url()).pathname.split('/').pop()); });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-entry', day);
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  expect(loaded).toEqual(day === 'mon' ? [] : [`${MODULES[day]}.js`]);
  await expect(page.locator('#entry-day-status')).toContainText(LABELS[i]);
  await expect(page.locator('#lang-switcher')).toBeHidden();
  await expect(page.locator('.privacy-notice')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (day !== 'mon') {
    await expect(page.locator('.entry-art')).toHaveCount(1);
    if (info.project.name === 'reduced motion') {
      const before = await page.locator('.entry-art').evaluate(c => c.toDataURL());
      await page.clock.fastForward(3000);
      expect(await page.locator('.entry-art').evaluate(c => c.toDataURL())).toBe(before);
    }
  }
  const door = page.getByRole('link', {name: 'enter the realm'});
  await door.focus(); await door.press('Enter');
  await expect(page.getByRole('heading', {name: 'one man, right now. an army of quality seekers, tomorrow.'})).toBeVisible();
  expect(await page.context().cookies()).toContainEqual(expect.objectContaining({name: 'corvus_realm', value: '1'}));
  expect(new URL(page.url()).origin).toBe(baseURL);
});

test('picker switches, handles keyboard, persists and yields to URL / today', async ({page}) => {
  await page.clock.install({time: new Date('2026-11-23T12:00:00Z')});
  await page.goto('/?entry=tue&art=retained');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  const toggle = page.locator('#entry-picker-toggle');
  await toggle.press('ArrowDown');
  await expect(page.getByRole('option', {name: 'Today · automatic'})).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('option', {name: 'Sun · Night'})).toBeFocused();
  await page.keyboard.press('Escape'); await expect(toggle).toBeFocused();
  for (const [i, day] of DAYS.entries()) {
    await toggle.click(); await page.getByRole('option', {name: LABELS[i], exact: true}).click();
    await expect(page.locator('body')).toHaveAttribute('data-entry', day);
    await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
    await expect(toggle).toBeFocused();
    await expect(page.locator('.entry-art')).toHaveCount(day === 'mon' ? 0 : 1);
  }
  expect(new URL(page.url()).searchParams.get('art')).toBe('retained');
  await page.goto('/'); await expect(page.locator('body')).toHaveAttribute('data-entry', 'sun');
  await page.goto('/?entry=wed'); await expect(page.locator('body')).toHaveAttribute('data-entry', 'wed');
  await toggle.click(); await page.getByRole('option', {name: 'Today · automatic'}).click();
  await page.goto('/'); await expect(page.locator('body')).toHaveAttribute('data-entry', 'mon');
});

test('room has real lit links; the same chat and echo work on a daily scene', async ({page}) => {
  await page.goto('/?entry=fri');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  const doors = page.getByRole('navigation', {name: 'Doors in the circus'});
  for (const [label, href] of [['Legion →', '/legion/'], ['(Side) Quests →', '/quests/'], ['Daily →', '/daily/']]) {
    const link = doors.getByRole('link', {name: label, exact: true});
    await link.focus(); await expect(link).toBeFocused(); await expect(link).toHaveAttribute('href', href);
    await expect.poll(() => link.evaluate(e => Number(getComputedStyle(e).opacity))).toBeGreaterThan(0.6);
  }
  await page.locator('#dio-input').focus(); await page.locator('#dio-input').fill('I built a small circus.');
  await page.locator('#dio-input').press('Enter');
  await expect(page.locator('#dio-line')).toHaveText('What did you build last week?');
  await page.locator('#dio-swap').focus(); await page.locator('#dio-swap').click();
  await expect(page.locator('#dio-who')).toHaveText('Gabe’s echo · an AI');
});

test('storage denial keeps URL selection usable', async ({page}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new DOMException('Denied', 'SecurityError'); };
  });
  await page.goto('/?entry=thu');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  await page.locator('#entry-picker-toggle').click(); await page.getByRole('option', {name: 'Tue · Glyphs'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-entry', 'tue');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
});

test('Canvas failure falls back to Monday without breaking chat or the door', async ({page}) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/?entry=thu');
  await expect(page.locator('body')).toHaveAttribute('data-entry', 'mon');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'fallback');
  await expect(page.locator('.entry-art')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Lantern entrance is ready');
  await page.getByRole('link', {name: 'enter the realm'}).focus();
  await page.getByRole('link', {name: 'enter the realm'}).press('Enter');
  await expect(page.locator('.arena-home')).toBeVisible();
});

test('today follows Brussels midnight without reloading', async ({page}) => {
  await page.clock.install({time: new Date('2026-11-23T22:59:30Z')});
  await page.goto('/?entry=today'); await expect(page.locator('body')).toHaveAttribute('data-entry', 'mon');
  await page.clock.fastForward(61_000);
  await expect(page.locator('body')).toHaveAttribute('data-entry', 'tue');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
});

test('context loss removes daily art and restores the original entrance', async ({page}) => {
  await page.goto('/?entry=wed');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  await page.locator('.entry-art').dispatchEvent('contextlost');
  await expect(page.locator('body')).toHaveAttribute('data-entry', 'mon');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'fallback');
  await expect(page.locator('.entry-art')).toHaveCount(0);
  await page.locator('#entry-picker-toggle').click();
  await page.getByRole('option', {name: 'Sun · Night', exact: true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-entry', 'sun');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
});

test('daily art stops painting while the document is hidden and resumes', async ({page}, info) => {
  test.skip(info.project.name === 'reduced motion', 'Static rendering is covered for every day.');
  await page.clock.install({time: new Date('2026-11-26T12:00:00Z')});
  await page.goto('/?entry=thu');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  const pixels = () => page.locator('.entry-art').evaluate(c => c.toDataURL());
  const first = await pixels();
  await page.clock.runFor(400);
  expect(await pixels()).not.toBe(first);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, value: true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused = await pixels();
  await page.clock.runFor(400); expect(await pixels()).toBe(paused);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, value: false});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(400); expect(await pixels()).not.toBe(paused);
});

test('switching away from a slow image cannot mount the old scene later', async ({page}) => {
  let held;
  await page.route('**/public/wing/wing-still.png', route => { held = route; });
  await page.goto('/?entry=wed', {waitUntil: 'domcontentloaded'});
  await expect.poll(() => Boolean(held)).toBe(true);
  await page.locator('#entry-picker-toggle').click();
  await page.getByRole('option', {name: 'Thu · Water', exact: true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  await held.continue();
  await expect(page.locator('body')).toHaveAttribute('data-entry', 'thu');
  await expect(page.locator('.entry-art')).toHaveCount(1);
  await expect(page.locator('#entry-caption')).toHaveText('Stable ink. Living light.');
});

test('changing reduced motion recreates one scene without leaving curtains closed', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?entry=wed');
  await expect(page.locator('body')).toHaveAttribute('data-entry-motion', 'still');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await expect(page.locator('body')).toHaveAttribute('data-entry-motion', 'animated');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  await expect(page.locator('.entry-curtain')).not.toHaveClass(/closed/);
  await expect(page.locator('.entry-art')).toHaveCount(1);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(page.locator('body')).toHaveAttribute('data-entry-motion', 'still');
  await expect(page.locator('body')).toHaveAttribute('data-entry-ready', 'true');
  await expect(page.locator('.entry-art')).toHaveCount(1);
});
