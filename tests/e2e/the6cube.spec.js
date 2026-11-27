import {expect, test} from '@playwright/test';

const fakeKey = 'test-only-cube-fixture';
const revoke = 'TestRevokeCode01';

test.beforeEach(async ({context, baseURL}) => {
  // Cover popups, workers and unload beacons as well as the main page.
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', route => {
    const request = route.request();
    const {origin, hostname, pathname} = new URL(request.url());
    const method = request.method();
    if (hostname === 'ntfy.sh') return route.fulfill({status: 200, body: ''});
    if (pathname === '/lend-api/stats' && method === 'GET') {
      return route.fulfill({json: {lent: 0, by: {}}});
    }
    if (pathname === '/lend-api/lend' && method === 'POST') {
      return route.fulfill({json: {id: 'fixture', revoke, effort: 'light'}});
    }
    if (pathname.startsWith('/lend-api/')) return route.fulfill({status: 404});
    if (method !== 'GET' && method !== 'HEAD') return route.fulfill({status: 204});
    if (hostname === 'wa.me') return route.fulfill({contentType: 'text/html', body: 'Share fixture'});
    // Only the site's own pages/assets and the lab's pinned renderer need real network reads.
    if (origin === baseURL && (pathname === '/6' || pathname.startsWith('/the6cube/'))) return route.continue();
    if (hostname === 'cdn.jsdelivr.net' && pathname.startsWith('/npm/three@0.170.0/')) return route.continue();
    return route.abort('blockedbyclient');
  });
});

test('gate asks for the word and serves the public preview image', async ({request}) => {
  const response = await request.get('/the6cube/', {maxRedirects: 0});
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('Speak the word');
  expect(html).toMatch(/property="og:image" content="https:\/\/corvus\.gent\/the6cube\/assets\/og\.png"/);
  const card = await request.get('/the6cube/assets/og.png', {maxRedirects: 0});
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toContain('image/png');
  expect((await card.body()).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
});

test('the gate refuses a wrong word', async ({page}) => {
  await page.goto('/the6cube/');
  await page.getByLabel('code').fill('wrong');
  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.getByRole('button', {name: 'Enter'}).click(),
  ]);
  expect(response.status()).toBe(401);
  await expect(page.getByText('not this word.')).toBeVisible();
});

test('/6 arrives at rank 1 and passes its rank on through WhatsApp', async ({page}) => {
  await page.goto('/6');
  await expect(page.locator('.sp-rank')).toContainText(/rank 1\b/i);
  await expect(page.locator('.sp-hi')).toContainText('Gabe');
  await page.locator('.sp-pass').click();
  const wa = page.locator('.sp-sheet a[data-c="wa"]');
  await expect(wa).toBeVisible();
  const [popup] = await Promise.all([page.waitForEvent('popup'), wa.click()]);
  await expect(popup).toHaveURL(/^https:\/\/wa\.me\//);
  const share = new URL(new URL(popup.url()).searchParams.get('text').split('\n').at(-1));
  expect(share.origin + share.pathname).toBe('https://corvus.gent/the6cube/');
  expect(share.searchParams.get('r')).toMatch(/^1-[a-z0-9]{3,8}$/);
  expect(share.searchParams.get('utm_source')).toBe('wa');
  await popup.close();
});

test('a fresh visitor following a rank 3 link arrives at rank 4', async ({page, request}) => {
  // Use the public invite emitted by /6 with a synthetic referrer.
  const invite = await request.get('/6', {maxRedirects: 0});
  expect([301, 302, 307, 308]).toContain(invite.status());
  const link = new URL(invite.headers().location, invite.url());
  expect(link.origin).toBe(new URL(invite.url()).origin);
  expect(link.pathname).toBe('/the6cube/');
  link.searchParams.set('r', '3-abcd');
  link.searchParams.set('utm_source', 'tg');
  await page.goto(link.href);
  await expect(page.locator('.sp-rank')).toContainText(/rank 4\b/i);
  await expect(page.locator('.sp-hi')).toContainText('somebody');
});

test('the lab runs an experiment on the Rust engine', async ({page}) => {
  await page.goto('/6');
  await page.goto('/the6cube/lab/?lang=en');
  await page.locator('#e-run').click();
  await expect(page.locator('#e-meta')).toContainText('Rust → WebAssembly', {timeout: 20_000});
});

test('lending a fixture key displays the mocked revoke code', async ({page}) => {
  await page.goto('/6');
  await page.goto('/the6cube/brein/?lang=en');
  const form = page.locator('#lendf');
  await expect(form).toBeVisible();
  await form.locator('input[name=key]').fill(fakeKey);
  const [submission] = await Promise.all([
    page.waitForRequest(req => req.method() === 'POST' && new URL(req.url()).pathname === '/lend-api/lend'),
    form.locator('button[type=submit]').click(),
  ]);
  expect(submission.postDataJSON()).toMatchObject({key: fakeKey, effort: 'light'});
  await expect(page.locator('#lendo')).toContainText(revoke);
});

test('all ten Cube pages load without uncaught browser errors', async ({page, baseURL}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/6');
  for (const slug of ['', 'lab/', 'monte-carlo/', 'licht/', 'nota/', 'stats/', 'kas/', 'brein/', 'ab/', 'spread/']) {
    const path = '/the6cube/' + slug;
    const response = await page.goto(path);
    expect(new URL(response.url()).origin, path).toBe(baseURL);
    expect(response.status(), path).toBe(200);
    await expect(page.getByRole('heading', {name: 'Speak the word.'})).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('other public Corvus pages still load', async ({request, baseURL}) => {
  for (const path of ['/', '/aikido', '/raygifts']) {
    const response = await request.get(path);
    expect(new URL(response.url()).origin, path).toBe(baseURL);
    expect(response.status(), path).toBe(200);
  }
});
