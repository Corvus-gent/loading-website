import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-23T11:34:00Z'));
  await page.addInitScript(()=>{
    window.corgiFrames={};
    const draw=CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData=function(...args){window.corgiFrames[this.canvas.id]=(window.corgiFrames[this.canvas.id]||0)+1;return draw.apply(this,args);};
  });
});

test('Corgi language bar and Plura links', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/corgi/');

  const bar = page.locator('#lang-switcher');
  await expect(bar).toBeVisible();
  await expect(bar.locator('[hreflang="nl"] [data-flag]').first()).toHaveCSS('background-image', /gradient/);
  const strip = page.locator('.corgi-travel-strip');
  await expect(strip.getByRole('link', {name: /field notes/i})).toHaveAttribute('href', '/corgi/gallery');
  await expect(strip.locator('[data-ferry-digits]')).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  expect(await bar.evaluate(element => {
    const top = element.closest('.corgi-top');
    const strip = top.querySelector('.corgi-travel-strip');
    return top === document.body.firstElementChild &&
      strip.getBoundingClientRect().bottom <= element.getBoundingClientRect().top &&
      Number(getComputedStyle(top).zIndex) > Number(getComputedStyle(document.querySelector('#glyphs')).zIndex);
  })).toBe(true);
  await bar.locator('[hreflang="nl"]').click();
  await expect(page).toHaveURL(/lang=nl/);
  await expect(bar.locator('[hreflang="nl"]')).toHaveAttribute('aria-current', 'true');
  await bar.locator('[hreflang="en"]').click();
  await expect(bar.locator('[hreflang="en"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#glyphs')).toBeVisible();

  const plura = page.locator('section').filter({hasText: 'Want to see more details?'}).last();
  await expect(plura.getByRole('link', {name: 'technical'})).toHaveAttribute('href', 'https://corvus.gent/cv/tech');
  await expect(plura.getByRole('link', {name: 'corvus.gent repo'})).toHaveAttribute('href', 'https://github.com/Corvus-gent/loading-website');
  await expect(plura.getByRole('link', {name: 'game dev'})).toHaveAttribute('href', 'https://corvus.gent/game-dev');
  expect(errors).toEqual([]);
});

test('The seal opens its mail link by keyboard', async ({page}) => {
  await page.goto('/corgi/');
  const seal = page.locator('.seal');
  await expect(seal).toHaveAttribute('href', /^mailto:gabriel@corvus.gent/);
  // Observe the navigation without launching a mail client.
  await seal.evaluate(element => element.setAttribute('href', '#seal-approved'));
  await seal.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#seal-approved$/);
});

test('All canvases stay static with reduced motion',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='reduced motion');await page.goto('/corgi/');
  await page.waitForTimeout(800);const before=await page.locator('#glyphs').evaluate(el=>el.toDataURL());
  await page.mouse.move(40,80);await page.waitForTimeout(250);
  expect(await page.locator('#glyphs').evaluate(el=>el.toDataURL())).toBe(before);
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
});

test('Hidden tab stops and resumes rendering',async({page},testInfo)=>{
  test.skip(testInfo.project.name==='reduced motion');
  await page.addInitScript(()=>{let hidden=false;Object.defineProperty(document,'hidden',{get:()=>hidden});window.setTestHidden=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));};});
  await page.goto('/corgi/');await page.waitForTimeout(250);
  await page.evaluate(()=>window.setTestHidden(true));const before=await page.locator('#glyphs').evaluate(el=>el.toDataURL());
  const portrait=await page.evaluate(()=>window.corgiFrames.portrait);await page.waitForTimeout(300);
  expect(await page.locator('#glyphs').evaluate(el=>el.toDataURL())).toBe(before);expect(await page.evaluate(()=>window.corgiFrames.portrait)).toBe(portrait);
  await page.evaluate(()=>window.setTestHidden(false));await expect.poll(()=>page.evaluate(()=>window.corgiFrames.portrait)).toBeGreaterThan(portrait);
});
