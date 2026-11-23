import {test,expect} from '@playwright/test';

for(const width of [375,1440])test(`game-dev full page ${width}px: renders, uptime and local links`,async({page,baseURL})=>{
  await page.setViewportSize({width,height:900});
  await page.clock.install({time:new Date('2026-11-23T15:55:24Z')});
  await page.clock.setFixedTime(new Date('2026-11-23T15:55:24Z'));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/game-dev/');
  await expect(page.getByRole('heading',{name:/Gabriel/})).toBeVisible();
  await expect(page.locator('#uptime')).toContainText(/1 day/);
  await expect(page.locator('#uptime')).toContainText(/\d+ (day|hour|minute|second)/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const links=await page.locator('a[href]').evaluateAll(els=>els.map(e=>e.getAttribute('href')));
  for(const href of new Set(links)){
    const url=new URL(href,'https://corvus.gent');
    if(url.origin==='https://corvus.gent'){
      const response=await page.request.get(baseURL+url.pathname,{maxRedirects:0});
      expect(response.status(),href).toBeLessThan(400);
    }else if(url.protocol==='https:')expect(['github.com','www.linkedin.com','x.com']).toContain(url.hostname);
    else expect(href).toBe('mailto:gabriel@corvus.gent');
  }
  for(const alias of ['/gamedev','/gd','/game']){
    const response=await page.request.get(alias,{maxRedirects:0});
    expect(response.status()).toBe(307);expect(response.headers().location).toBe('/game-dev');
  }
  expect(errors).toEqual([]);
});

test('reduced motion draws stable canvas stills and keeps readable captions',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-23T15:55:24Z')});
  await page.goto('/game-dev/');
  const before=await page.locator('canvas').evaluateAll(cs=>cs.map(c=>c.toDataURL()));
  await page.clock.runFor(1000);
  expect(await page.locator('canvas').evaluateAll(cs=>cs.map(c=>c.toDataURL()))).toEqual(before);
  await expect(page.getByText('Surface-stable dither.',{exact:false})).toBeVisible();
  expect(errors).toEqual([]);
});
