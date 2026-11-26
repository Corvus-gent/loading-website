import {expect, test} from '@playwright/test';

const routes = ['', 'lab/', 'monte-carlo/', 'licht/', 'nota/', 'stats/', 'kas/', 'brein/', 'ab/'];
const portal = '/thecube/';

async function enter(page) {
  await page.goto(portal);
  await page.getByLabel('code', {exact: true}).fill('cube-e2e-fixture');
  await page.getByRole('button', {name: 'Enter'}).click();
  await expect(page.locator('#doors a')).toHaveCount(4);
  expect(new URL(page.url()).searchParams.has('key')).toBe(false);
}

test.beforeEach(async ({context}) => {
  await context.route(/^https?:\/\/(?!localhost(?=[:/]))/, route => route.abort());
});

test('gate rejects unauthenticated entry and accepts a scoped session', async ({page, context}) => {
  expect((await page.goto(portal)).status()).toBe(401);
  expect((await context.request.get(portal + 'lab-worker.js')).status()).toBe(401);
  await page.getByLabel('code', {exact: true}).fill('wrong');
  await page.getByRole('button', {name: 'Enter'}).click();
  await expect(page.getByText('not this word.')).toBeVisible();
  await enter(page);
  const session = (await context.cookies()).find(cookie => cookie.name === 'thecube_key');
  expect(session).toMatchObject({path: '/thecube', secure: true, httpOnly: true, sameSite: 'Lax'});
  expect((await context.request.get('/')).status()).toBe(200);
});

test('all nine routes render at the project viewport', async ({page}) => {
  await enter(page);
  for (const route of routes) {
    await test.step(route || 'portal', async () => {
      expect((await page.goto(portal + route)).status()).toBe(200);
      await expect(page).toHaveTitle(/\S/);
      await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )).toBeLessThanOrEqual(1);
    });
  }
});

test('language selection survives navigation and the lab solves the proof and runs the experiment', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  await page.locator('#lang-switcher [hreflang="nl"]').click();
  await expect(page.locator('#q')).toContainText('Wat zoek');
  await page.locator('#doors [data-door="lab"]').click();
  await expect(page).toHaveURL(/\/thecube\/lab\/\?lang=nl/);
  await page.locator('#lang-switcher [hreflang="en"]').click();
  await page.locator('#compare').click();
  await expect(page.locator('#lanes')).toHaveClass(/united/);
  await expect(page.locator('#v-dist')).toHaveText('1');
  await expect(page.locator('.hist')).toHaveCount(2);
  await page.locator('#e-run').click();
  await expect(page.locator('#e-meta')).toContainText(/live in your browser/i, {timeout: 15_000});
  expect(errors).toEqual([]);
});
