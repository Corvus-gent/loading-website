import { test, expect } from '@playwright/test';
import { statusFixture } from './status-fixture.mjs';
const at = Date.now();
const dates = statusFixture('empty', '24h', at).days;

for (const [scenario, headline] of Object.entries({
  healthy: 'the lantern is burning.',
  slow: 'the lantern flickers.',
  outage: 'the lantern flickers.',
  down: 'the lantern is out.',
  empty: 'waiting for the first light.'
})) {
  test('lantern status · ' + scenario, async ({ page }, info) => {
    const errors = [],
      requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (e) => {
      if (e.type() === 'error') errors.push(e.text());
    });
    await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
    await page.setViewportSize({ width: 1100, height: 850 });
    await page.route('**/api/**', (route) => {
      const u = new URL(route.request().url());
      requests.push(u.pathname);
      expect(u.pathname).toBe('/api/health/history');
      return route.fulfill({ json: statusFixture(scenario, u.searchParams.get('range'), at) });
    });
    await page.goto('/stats/status/');
    await expect(page.locator('#health-title')).toHaveText(headline);
    await expect.poll(() => requests.length).toBe(1);
    const strip = page.locator('.day-strip').nth(3),
      chart = page.locator('#overall-chart'),
      log = page.locator('#incidents');
    await expect(strip).toHaveAttribute('aria-valuemax', '89');
    if (scenario === 'empty') {
      await expect(chart).toContainText('no data yet');
      await expect(page.locator('.metrics dd').first()).toHaveText('—');
      await expect(strip.locator('[data-days-state="1"]')).toHaveCount(0);
    } else {
      await expect(chart.locator('.plot')).toHaveAttribute('role', 'slider');
      await expect(page.locator('#checked')).toHaveText('last checked 2 min ago');
    }
    if (['slow', 'outage', 'down'].includes(scenario)) {
      const level = scenario === 'slow' ? 2 : 3;
      await expect(chart.locator('[data-markers="' + level + '"]')).toBeVisible();
      await expect(strip.locator('[data-days-state="' + level + '"]')).toBeVisible();
      await expect(log).toContainText(scenario === 'slow' ? 'redis was slow' : 'redis went down');
      await chart.locator('.plot').focus();
      await page.keyboard.press('End');
      await expect(chart.locator('.chart-detail')).toContainText(
        'redis ' + (level === 2 ? 'slow' : 'down')
      );
      await page.keyboard.press('Escape');
      await chart.locator('.plot').evaluate((el) => el.blur());
    }
    if (process.env.STATUS_SCREENSHOTS) {
      const file = 'tests/results/screenshots/status/' + scenario + '.png';
      await page.screenshot({ path: file, fullPage: true });
      await info.attach(scenario, { path: file });
    }
    await page.setViewportSize({ width: 360, height: 760 });
    await expect(strip).toHaveAttribute('aria-valuemax', '29');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await strip.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await strip.focus();
    await page.keyboard.press('End');
    await expect(strip).toHaveAttribute('aria-valuetext', new RegExp(dates.at(-1)));
    await page.keyboard.press('Home');
    await expect(strip).toHaveAttribute('aria-valuetext', new RegExp(dates.at(-30)));
    await page.locator('.row-toggle').nth(3).click();
    await expect(page.locator('#timeline-redis')).toBeVisible();
    await page.getByRole('button', { name: '7d', exact: true }).click();
    await expect.poll(() => requests.length).toBe(2);
    await expect(page.getByRole('button', { name: '7d', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    if (scenario === 'outage' && process.env.STATUS_SCREENSHOTS) {
      await page.locator('.row-toggle').nth(3).click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: 'tests/results/screenshots/status/mobile.png', fullPage: true });
    }
    const paints = await page.evaluate(() =>
      performance.getEntriesByName('status render').map((e) => e.duration)
    );
    console.log(scenario + ' longest render ' + Math.max(...paints).toFixed(1) + ' ms');
    expect(errors).toEqual([]);
  });
}
test('one-minute refresh pauses while hidden and failed reads keep measurements', async ({ page }) => {
  await page.clock.install({ time: new Date(at) });
  let calls = 0,
    fail = false;
  await page.route('**/api/health/history?*', (route) => {
    calls++;
    return fail ? route.abort() : route.fulfill({ json: statusFixture('healthy', '24h', at) });
  });
  await page.goto('/stats/status/');
  await expect(page.locator('#health-title')).toContainText('burning');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(120000);
  expect(calls).toBe(1);
  fail = true;
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#load-message')).toContainText('showing the last reading');
  await expect(page.locator('.metrics dd').first()).toHaveText('100%');
  fail = false;
  await page.getByRole('button', { name: 'try again' }).click();
  await expect(page.locator('#retry')).toBeHidden();
  await page.clock.fastForward(60010);
  await expect.poll(() => calls).toBe(4);
});
