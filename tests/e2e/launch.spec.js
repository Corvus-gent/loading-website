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
  for (const [room, path] of [['Gabe', '/gabe/'], ['Legion', '/legion/'], ['(Side) Quests', '/quests/'], ['Daily', '/daily/']]) {
    const response = page.waitForResponse(r => r.request().isNavigationRequest() && new URL(r.url()).pathname === path);
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
  for (const room of ['Gabe', 'Legion', '(Side) Quests', 'Daily', 'Stats']) {
    await tabTo(page, nav(page).getByRole('link', {name: room}));
  }
  await tabTo(page, waitEmail(page.locator('#signup')));
});

test('an unknown path renders a real 404', async ({page}) => {
  expect((await page.goto('/launch-test-missing/')).status()).toBe(404);
  await expect(page.getByRole('heading', {name: '404'})).toBeVisible();
});


test('header and favicon use the Brussels weekday', async ({page, baseURL}) => {
  await page.clock.setFixedTime(new Date('2032-02-09T23:30:00Z'));
  await openHome(page, baseURL);
  const mark = page.locator('.site-nav img[data-weekly-logo]');
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute('src', '/logo/day-2.svg');
  await expect(page.locator('link[data-weekly-favicon]')).toHaveAttribute('href', '/logo/day-2.svg');
  await expect.poll(() => mark.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
});

test('the nav and programme share their order and Stats shows the measured count', async ({page, baseURL}) => {
  await page.route('**/api/stats?page=overview&*', route => route.fulfill({
    json: {day: '2032-02-10', data: {visitors: 132, unseen: {day: 5}}},
  }));
  await openHome(page, baseURL);
  const order = ['Gabe', 'Legion', '(Side) Quests', 'Daily', 'Stats'];
  await expect(nav(page).locator('.site-nav-rooms > a')).toHaveText(order);
  await expect(page.locator('.arena-acts strong')).toHaveText(order);
  await expect(nav(page).getByRole('link', {name: 'Stats'})).toHaveAttribute('href', '/stats/map/');
  await expect(page.locator('.arena-acts [data-stats-act]')).toHaveText('137 visitors · measured day');
});

test('the theme follows the system once and saves keyboard and accent changes', async ({page, baseURL}) => {
  await page.emulateMedia({colorScheme: 'light'});
  await openHome(page, baseURL);
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-realm-theme', 'light');
  const toggle = page.getByRole('button', {name: 'Theme'});
  await toggle.focus();
  await page.keyboard.press('Enter');
  const theme = page.getByRole('dialog', {name: 'Theme'});
  await expect(theme).toBeVisible();
  await theme.getByRole('radio', {name: 'Dark'}).check();
  await theme.getByRole('button', {name: 'Corvus plum'}).click();
  const accent = await root.evaluate(el => el.style.getPropertyValue('--realm-accent'));
  expect(accent).toMatch(/^rgb/);
  await page.reload();
  await expect(root).toHaveAttribute('data-realm-theme', 'dark');
  expect(await root.evaluate(el => el.style.getPropertyValue('--realm-accent'))).toBe(accent);
  await toggle.click();
  await expect(theme.getByRole('button', {name: 'Corvus plum'})).toHaveAttribute('aria-pressed', 'true');
  await theme.getByRole('radio', {name: 'Light'}).check();
  await page.keyboard.press('Escape');
  for (const path of ['/legion/', '/quests/', '/daily/', '/gabe/']) {
    await page.goto(path);
    await expect(root).toHaveAttribute('data-realm-theme', 'light');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(252, 248, 243)');
  }
});

test('the music panel loads ten tracks without autoplay and stays off the entrance', async ({page, baseURL}) => {
  const mediaRequests = [];
  page.on('request', request => {
    if (/https:\/\/(?:open\.spotify\.com|embed\.music\.apple\.com)\//.test(request.url())) mediaRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Theme', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Music', exact: true})).toHaveCount(0);
  await openHome(page, baseURL);
  await page.getByRole('button', {name: 'Music', exact: true}).click();
  const music = page.getByRole('dialog', {name: 'Gabe’s top 10 songs'});
  await expect(music).toBeVisible();
  await expect(music.getByRole('listitem')).toHaveCount(10);
  await expect(music.locator('iframe, audio, video')).toHaveCount(0);
  expect(mediaRequests).toEqual([]);
  await music.getByRole('button', {name: /Dance With the Devil/}).click();
  await expect(music.locator('iframe')).toHaveAttribute('src', /^https:\/\/open\.spotify\.com\/embed\/track\//);
  await expect(music.locator('iframe')).toHaveAttribute('allow', 'encrypted-media');
  await page.keyboard.press('Escape');
  await expect(music.locator('iframe')).toHaveCount(0);
});
