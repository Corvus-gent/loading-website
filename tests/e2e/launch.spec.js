import {expect, test as base} from '@playwright/test';

const test = base.extend({
  page: async ({page, baseURL}, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      // Chromium logs the deliberately requested 404 document as a resource error.
      if (message.type() === 'error' && !(message.text().includes('404') &&
        message.location().url === new URL('/launch-test-missing/', baseURL).href)) errors.push(message.text());
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === baseURL) return route.continue();
      return route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });
    // Fix the daily panel and question while allowing animation and hint timers to run.
    const date = new Date('2032-02-10T12:00:00Z');
    await page.clock.install({time: date});
    await page.clock.setFixedTime(date);
    await use(page);
    expect(errors).toEqual([]);
  },
});

const tagline = 'one man, right now. an army of quality seekers, tomorrow.';
const lantern = page => page.getByRole('button', {name: /^Lantern/});
const door = page => page.getByRole('link', {name: 'enter the realm'});
const nav = page => page.getByRole('navigation', {name: 'Corvus rooms'});
const waitEmail = scope => scope.getByRole('textbox', {name: 'Your email'});
const waitSubmit = scope => scope.getByRole('button', {name: 'join the waitlist'});

async function openHome(page, baseURL) {
  await page.context().addCookies([{name: 'corvus_realm', value: '1', url: baseURL}]);
  expect((await page.goto('/')).status()).toBe(200);
}

async function expectLit(locator) {
  await expect.poll(() => locator.evaluate(el => Number(el.style.getPropertyValue('--seen')))).toBeGreaterThan(0.6);
}

async function expectFocus(locator) {
  await expect(locator).toBeFocused();
  expect(await locator.evaluate(el => {
    const style = getComputedStyle(el);
    return el.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  })).toBe(true);
}

async function tabTo(page, locator) {
  await expect(locator).toBeVisible();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate(el => el === document.activeElement)) return expectFocus(locator);
  }
  await expect(locator).toBeFocused();
}

test('lantern reveals Diogenes and the door, and Wing offers a hint', async ({page}) => {
  await page.goto('/');
  await expect(lantern(page)).toBeVisible();
  await expect(page.locator('#lang-switcher')).toBeHidden();
  await page.clock.fastForward(7100);
  await expect(page.locator('#entry-wing')).toHaveClass(/talking/, {timeout: 12_000});
  await expect(page.getByText('maybe use the lantern.', {exact: false})).toBeVisible();

  const light = await lantern(page).boundingBox();
  await page.mouse.move(light.x + light.width / 2, light.y + light.height / 2);
  await page.mouse.down();
  for (const target of [page.locator('#dio-line'), door(page)]) {
    const box = await target.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {steps: 4});
    await expectLit(target.locator('xpath=ancestor-or-self::*[@data-dark][1]'));
  }
  await page.mouse.up();
  await expect(page.locator('#dio-line')).toContainText('?');
  await expect(door(page)).toBeVisible();
  await expect(page.locator('#lang-switcher')).toBeHidden();

  await page.reload();
  await lantern(page).focus();
  for (const selector of ['#dio-line', '.realm-enter']) {
    const target = page.locator(selector);
    const box = await target.boundingBox();
    const light = await lantern(page).boundingBox();
    for (const [offset, positive, negative] of [
      [box.x + box.width / 2 - light.x - light.width / 2, 'ArrowRight', 'ArrowLeft'],
      [box.y + box.height / 2 - light.y - light.height / 2, 'ArrowDown', 'ArrowUp'],
    ]) {
      for (let i = 0; i < Math.round(Math.abs(offset) / 32); i++) {
        await page.keyboard.press(offset > 0 ? positive : negative);
      }
    }
    await expectLit(target.locator('xpath=ancestor-or-self::*[@data-dark][1]'));
  }
});

test('entering sets the realm cookie and opens the ring home', async ({page}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(door(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', {name: tagline})).toBeVisible();
  expect(await page.context().cookies()).toContainEqual(expect.objectContaining({name: 'corvus_realm', value: '1'}));
  await expect(page.locator('.hall-panel.is-today')).toHaveText(/never\s+stop\s+debating/i);
  const languages = page.locator('#lang-switcher');
  await expect(languages).toBeVisible();
  await expect(languages.locator('a[hreflang]')).toHaveCount(7);
  const stats = languages.getByRole('link', {name: '· polyglot stats'});
  await expect(stats).toBeVisible();
  await expect(languages.locator('a[hreflang] [data-flag]')).toHaveCount(14);
  expect(await stats.locator('[data-flag]').evaluateAll(parts => parts.map(part => part.dataset.flag)))
    .toEqual(['spain', 'china', 'portugal', 'france']);
});

test('crawl skips to a focusable waitlist and validates email', async ({page, baseURL}, info) => {
  await openHome(page, baseURL);
  await page.getByRole('button', {name: 'what is corvus?'}).click();
  const crawl = page.locator('#crawl');
  await expect(crawl).toBeVisible();
  if (info.project.name === 'desktop') await page.keyboard.press('Escape');
  if (info.project.name === 'mobile') await crawl.getByRole('button', {name: 'skip · esc'}).click();
  await expect(waitEmail(crawl)).toBeVisible();
  await waitEmail(crawl).focus();
  await expect(waitEmail(crawl)).toBeFocused();
  await page.keyboard.press('Tab');
  await expectFocus(waitSubmit(crawl));
  await waitEmail(crawl).fill('invalid');
  await waitSubmit(crawl).click();
  await expect(crawl.getByRole('status')).toHaveText('Enter a valid email address.');
  await waitEmail(crawl).fill('builder@example.com');
  const request = page.waitForRequest(r => new URL(r.url()).pathname === '/api/legion' && r.method() === 'POST');
  await waitSubmit(crawl).click();
  expect((await request).postDataJSON()).toMatchObject({action: 'subscribe', email: 'builder@example.com', consent: true});
  await expect(crawl.getByRole('status')).toHaveText('Check your email.');
});

test('room navigation, back link and feedback board', async ({page, baseURL}) => {
  await openHome(page, baseURL);
  for (const room of ['Legion', 'Quests', 'Daily', 'Gabe']) {
    const response = page.waitForResponse(r => r.request().isNavigationRequest() && new URL(r.url()).pathname === '/' + room.toLowerCase() + '/');
    await nav(page).getByRole('link', {name: room}).click();
    expect((await response).status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('$1');
  }
  await page.getByRole('link', {name: '← corvus'}).click();
  await expect(page.getByRole('heading', {name: tagline})).toBeVisible();
  const response = page.waitForResponse(r => r.request().isNavigationRequest() && new URL(r.url()).pathname === '/feedback/');
  await page.getByRole('contentinfo').getByRole('link', {name: 'feedback'}).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('region', {name: 'Every page of corvus.gent'})).toBeVisible();
  await expect(page.locator('#fb-world').locator('button').first()).toBeVisible();
});

test('Legion presents its four backer doors', async ({page}) => {
  await page.goto('/legion/');
  const section = page.getByRole('region', {name: 'For backers'});
  await expect(section).toBeVisible();
  for (const name of ['Patronus', 'Consul', 'Y Combinator', 'HF0']) {
    const card = section.getByRole('article').filter({has: page.getByRole('heading', {name, exact: true})});
    const href = await card.getByRole('link', {name: 'request a seat'}).getAttribute('href');
    const mail = new URL(href);
    expect(mail.href).toMatch(/^mailto:gabriel@corvus\.gent\?subject=/);
    expect(mail.searchParams.get('subject')).toContain(name);
  }
});

test('keyboard reaches the lantern, door, room links and home waitlist in order', async ({page}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expectFocus(lantern(page));
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Tab');
  await expectFocus(door(page));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', {name: tagline})).toBeVisible();
  for (const room of ['Legion', 'Quests', 'Daily', 'Gabe']) {
    await tabTo(page, nav(page).getByRole('link', {name: room}));
  }
  await tabTo(page, waitEmail(page.locator('#signup')));
});

test('an unknown path renders a real 404', async ({page}) => {
  expect((await page.goto('/launch-test-missing/')).status()).toBe(404);
  await expect(page.getByRole('heading', {name: '404'})).toBeVisible();
});
