import { test, expect } from '@playwright/test';

async function harness(page, reply) {
  const requests = [],
    errors = [];
  page.on('request', (r) => requests.push(new URL(r.url())));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      name = url.searchParams.get('page'),
      day = url.searchParams.get('day');
    if (url.pathname !== '/api/stats') return route.fulfill({ json: {} });
    const now = new Date().toISOString();
    const s = await reply(name, day);
    return route.fulfill({
      json: { page: name, day, state: 'ready', updated: now, checked: now, ...s }
    });
  });
  return { requests, errors };
}
for (const [status, title] of [
  ['ok', 'the lantern is burning.'],
  ['degraded', 'the lantern flickers.'],
  ['down', 'the lantern is out.']
]) {
  test('status renders ' + status + ' on mobile from one snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    const { requests, errors } = await harness(page, () => ({
      data: {
        status,
        checks: [
          {
            name: 'redis',
            days: Array(29).fill('unknown').concat(status),
            uptime: [75, 98, 99.9],
            average: 12,
            lastIncident: '2026-11-03T11:12:00Z'
          }
        ]
      }
    }));
    await page.goto('/stats/status/');
    await expect(page.locator('#health-title')).toHaveText(title);
    await expect(page.locator('.health-strip i')).toHaveCount(30);
    await expect(page.locator('.health-check')).toContainText('99.9%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(requests.filter((u) => u.pathname.startsWith('/api/'))).toHaveLength(1);
    expect(requests.some((u) => u.pathname.includes('leaflet'))).toBe(false);
    expect(errors).toEqual([]);
  });
}
test('cached figures survive an upstream outage; a tab revisit can paint without a request', async ({
  page
}) => {
  let offline = false;
  const { requests, errors } = await harness(page, () =>
    offline ? { state: 'unavailable', data: null } : { data: { visitors: 37, countries: [] } }
  );
  await page.goto('/stats/');
  await expect(page.locator('#visitors')).toHaveText('37');
  await page.reload();
  await expect(page.locator('#visitors')).toHaveText('37');
  expect(requests.filter((u) => u.pathname === '/api/stats')).toHaveLength(1);
  offline = true;
  await page.evaluate(() => {
    const k = Object.keys(sessionStorage).find((k) => k.startsWith('stats:snap:'));
    const s = JSON.parse(sessionStorage[k]);
    s.updated = s.checked = new Date(Date.now() - 8 * 60000).toISOString();
    sessionStorage[k] = JSON.stringify(s);
  });
  await page.reload();
  await expect(page.locator('#visitors')).toHaveText('37');
  await expect(page.locator('[data-snapshot-age]')).toContainText(
    'last saved snapshot · updated 8 min ago'
  );
  expect(errors).toEqual([]);
});
test('prefetches a nav target and the previous Brussels day on intent', async ({ page }) => {
  const { requests } = await harness(page, () => ({ data: { visitors: 3, countries: [] } }));
  await page.goto('/stats/');
  await expect(page.locator('#visitors')).toHaveText('3');
  await page.locator('[data-stat=music]').first().focus();
  await page.locator('#prev').hover();
  await expect.poll(() => requests.filter((u) => u.searchParams.get('page') === 'music').length).toBe(1);
  await expect
    .poll(
      () =>
        new Set(
          requests
            .filter((u) => u.searchParams.get('page') === 'overview')
            .map((u) => u.searchParams.get('day'))
        ).size
    )
    .toBe(2);
  await page.locator('#prev').click();
  expect(requests.filter((u) => u.searchParams.get('page') === 'overview')).toHaveLength(2);
});
test('map stays dormant below the fold; private records stay behind auth', async ({ page }) => {
  const { requests, errors } = await harness(page, (name) =>
    name === 'map'
      ? { data: { cities: [], countries: [], tiles: false } }
      : { state: 'login', data: null }
  );
  await page.route('**/stats/sections.css*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\n#visitor-map{margin-top:160vh}'
    });
  });
  await page.goto('/stats/map/');
  await expect(page.locator('#countries')).toContainText('no visitors');
  expect(requests.some((u) => u.pathname.includes('leaflet'))).toBe(false);
  await page.locator('#visitor-map').scrollIntoViewIfNeeded();
  await expect.poll(() => requests.some((u) => u.pathname.endsWith('/leaflet.js'))).toBe(true);
  await page.goto('/stats/private/');
  await expect(page.locator('#f-mail')).toBeVisible();
  expect(requests.some((u) => /private-stats|x-stats/.test(u.pathname))).toBe(false);
  expect(
    await page.evaluate(() => Object.keys(sessionStorage).some((k) => k.includes(':private:')))
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('authenticated scrolling fetches each table once and keeps it out of tab storage', async ({page})=>{
 const seen=[];
 await page.setViewportSize({width:360,height:640});
 await page.route('**/api/stats?*',route=>{
  const params=new URL(route.request().url()).searchParams,part=params.get('part');seen.push(part);
  return route.fulfill({json:{page:'private',viewer:'reader@corvus.gent',day:params.get('day'),state:'ready',data:part?{pages:[['/call/',7,5]]}:{outbound:[['/','pidgy-ai.com','/',9]],tables:['outbound','pages']}}});
 });
 await page.goto('/stats/private/');await expect(page.locator('#out td').first()).toHaveText('/');
 expect(seen).toEqual([null]);
 const section=page.locator('#out > section').nth(8);await section.scrollIntoViewIfNeeded();
 await expect(section.getByText('/call/',{exact:true})).toBeVisible();
 expect(seen).toEqual([null,'pages']);
 expect(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.includes(':private:')))).toBe(false);
});

test('a slow request shows a bar, reports the failing service and recovers on retry', async ({page})=>{
  let release,healthy=false;
  const held=new Promise(resolve=>{release=resolve;});
  const {errors}=await harness(page,async()=>{
    await held;
    return healthy?{data:{visitors:17,countries:[]}}:{state:'unavailable',reason:'storage',data:null};
  });
  await page.goto('/stats/?day=2026-11-04');
  await expect(page.getByRole('progressbar')).toBeVisible();
  release();
  await expect(page.locator('.stats-feedback')).toContainText('stats storage (redis) is unavailable');
  await expect(page.getByRole('progressbar')).toBeHidden();
  await expect(page.locator('#overview-details')).toBeHidden();
  healthy=true;await page.getByRole('button',{name:'try again'}).click();
  await expect(page.locator('#visitors')).toHaveText('17');
  await expect(page.locator('.stats-feedback')).toBeHidden();expect(errors).toEqual([]);
});
test('warming has a finite end and retry starts a new attempt',async({page})=>{
  await page.clock.install();
  let calls=0;
  await harness(page,()=>{calls++;return {state:'warming',data:null};});
  await page.goto('/stats/?day=2026-11-04');
  for(const delay of [1000,2000,4000,6000,6000]){
    const before=calls;await expect(page.getByRole('progressbar')).toBeVisible();
    await page.clock.fastForward(delay+80);await expect.poll(()=>calls).toBeGreaterThan(before);
  }
  await expect(page.locator('.stats-feedback')).toContainText('took too long');
  await expect(page.getByRole('progressbar')).toBeHidden();
  await expect(page.locator('#visitors')).toHaveText('—');
  await page.getByRole('button',{name:'try again'}).click();await expect(page.getByRole('progressbar')).toBeVisible();
});
test('switching days hides previous numbers when the new day fails',async({page})=>{
  const {errors}=await harness(page,(name,day)=>day==='2026-11-03'?{state:'unavailable',reason:'source',data:null}:{data:{visitors:18,total:87,countries:[]}});
  await page.goto('/stats/?day=2026-11-04');await expect(page.locator('#visitors')).toHaveText('18');
  await page.locator('#prev').click();await expect(page.locator('#overview-details')).toBeHidden();
  await expect(page.locator('.stats-feedback')).toContainText('data source failed');
  await page.locator('#next').click();await expect(page.locator('#visitors')).toHaveText('18');
  await expect(page.locator('.stats-feedback')).toBeHidden();expect(errors).toEqual([]);
});
