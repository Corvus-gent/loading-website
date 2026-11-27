import {test, expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {pages} from '../../tools/cube/pages.mjs';

test.beforeEach(async ({context}) => {
  await context.route('https://ntfy.sh/**', route => route.fulfill({status:200, body:''}));
  await context.route('**/lend-api/stats', route => route.fulfill({json:{lent:0,by:{}}}));
  await context.route('**/spread/events.ndjson', route => route.fulfill({body:''}));
  await context.route('https://wa.me/**', route => route.fulfill({body:'WhatsApp fixture'}));
});
async function enter(context) {
  // This public invite sets the real gate cookie. Keep its query out of reports.
  const res = await context.request.get('/6');
  expect(res.status()).toBe(200);
}
for (const [slug, budget] of pages) {
  test(`page /${slug} loads within budget`, async ({page,context}, info) => {
    await enter(context);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.cubeLCP = null;
      if (PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
        new PerformanceObserver(list => { window.cubeLCP = list.getEntries().at(-1).startTime; })
          .observe({type:'largest-contentful-paint', buffered:true});
      }
    });
    const res = await page.goto('/the6cube/' + slug);
    expect(res.status()).toBe(200);
    await expect(page.getByRole('heading', {name:'Speak the word.'})).toHaveCount(0);
    await expect(page.locator('body')).not.toBeEmpty();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const metric = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {lcp:window.cubeLCP,load:nav.loadEventEnd,ttfb:nav.responseStart};
    });
    const dir = 'test-results/cube-timings/' + info.project.name;
    await mkdir(dir,{recursive:true});
    await writeFile(dir + '/' + (slug.split('/')[0] || 'portal') + '.json', JSON.stringify({slug,...metric}));
    const measured = metric.lcp ?? metric.load;
    expect(measured).toBeGreaterThan(0);
    expect(measured, metric.lcp === null ? 'load event (LCP unavailable)' : 'LCP').toBeLessThan(budget);
    expect(errors).toEqual([]);
  });
}
test('gate rejects an incorrect code and accepts the public invitation',async ({page}) => {
  await page.goto('/the6cube/');
  await expect(page.getByRole('heading',{name:'Speak the word.'})).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await page.getByLabel('code').fill('wrong');
  await page.getByRole('button',{name:'Enter'}).click();
  await expect(page.getByText('not this word.')).toBeVisible();
  await page.goto('/6');
  await expect(page.locator('#share')).toBeVisible();
});
test('all five public links deliver the right channel',async ({request,baseURL}) => {
  for (const [path,channel] of [['/6','wa'],['/6l','li'],['/6w','wc'],['/6x','x'],['/6t','tg']]) {
    const res = await request.get(path,{maxRedirects:0});
    expect(res.status(),path).toBe(307);
    const target = new URL(res.headers().location,baseURL);
    expect(target.origin).toBe(baseURL);
    expect(target.pathname).toBe('/the6cube/');
    expect(target.searchParams.get('utm_source')).toBe(channel);
  }
});
test('root and friend arrivals show and remember the correct rank',async ({page,context}) => {
  await page.goto('/6');
  await expect(page.locator('.sp-hi')).toContainText('Gabe');
  await expect(page.locator('.sp-rank')).toContainText(/rank 1\b/i);
  await page.locator('.sp-btn').click();
  await expect(page.locator('.sp-veil')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('cube_rank'))).toBe('1');
  await page.evaluate(() => {localStorage.clear();sessionStorage.clear();});
  await page.goto('/the6cube/?r=2-abcd&utm_source=wa');
  await expect(page.locator('.sp-rank')).toContainText(/rank 3\b/i);
  await expect(page.locator('.sp-hi')).toContainText('somebody');
});
test('share sheet opens WhatsApp with the visitor referral',async ({page}) => {
  await page.goto('/6');
  await page.locator('.sp-pass').click();
  const wa = page.locator('.sp-sheet a').first();
  await expect(wa).toHaveText('WhatsApp');
  const opened = page.waitForEvent('popup');
  await wa.click();
  const popup = await opened;
  await expect(popup).toHaveURL(/^https:\/\/wa\.me\//);
  const invite = new URL(new URL(popup.url()).searchParams.get('text').split('\n').at(-1));
  expect(invite.searchParams.get('r')).toMatch(/^1-/);
  await popup.close();
});
test('C solver solves the scrambled lab cube',async ({page,context}) => {
  await enter(context); await page.goto('/the6cube/lab/?lang=en');
  await page.locator('#length').selectOption('8'); await page.locator('#scramble').click();
  await expect(page.locator('#status')).toContainText('Scrambled');
  await page.locator('#csolve').click(); await expect(page.locator('#csolve')).toHaveText(/^[1-8] · \d+ ms · C$/);
  await expect(page.locator('#status')).toContainText('Solved',{timeout:20_000});
});
test('Monte Carlo runs Rust and draws Wilson intervals',async ({page,context}) => {
  await enter(context); await page.goto('/the6cube/monte-carlo/?lang=en');
  await expect(page.locator('#foot')).toContainText('Rust');
  await page.locator('#play').click(); await expect(page.locator('#conv polygon')).toHaveAttribute('points',/\d/);
  await expect(page.locator('#conv')).toHaveAttribute('data-engine','cpp');
});
test('mycelium can display and leave simulation',async ({page,context}) => {
  await enter(context); await page.goto('/the6cube/spread/');
  await expect(page.locator('#cv')).toBeVisible();
  await page.locator('#simb').click(); await expect(page.locator('#simtag')).toBeVisible();
  await page.locator('#simb').click(); await expect(page.locator('#simtag')).toBeHidden();
});
test('support has three steps and both payment destinations',async ({page,context}) => {
  await enter(context); await page.goto('/the6cube/support/');
  await expect(page.locator('ol li')).toHaveCount(3);
  for (const host of ['revolut.me','buymeacoffee.com']) await expect(page.locator(`a[href*="${host}"]`)).toBeVisible();
});
test('portal links to both stack tables and selects forced tier B',async ({page,context}) => {
  await enter(context); await page.goto('/the6cube/?tier=B');
  await expect(page.locator('html')).toHaveAttribute('data-tier','B');
  await page.getByRole('link',{name:'stack',exact:true}).click();
  await expect(page.locator('table')).toHaveCount(2); await expect(page.getByRole('heading',{name:/^Now/})).toBeVisible();
});

test('the portal guide speaks the matching Prolog line', async ({page,context}) => {
  await enter(context);
  await page.goto('/the6cube/?lang=en');
  const line = await page.evaluate(async () => {
    const {ask} = await import('/the6cube/oracle.js');
    return ask({rank:1,visits:Number(localStorage.getItem('cube_visits'))});
  });
  expect(line).toBeTruthy();
  await expect(page.locator('#guide')).toContainText(line, {timeout:18_000});
});
