import {test, expect} from '@playwright/test';

const headline = 'Gabriel in SF';
const description = "Homeless-maxxing in San Francisco. Want to hear the story? Let's meet.";
const subject = "mailto:gabriel@corvus.gent?subject=Let's%20meet%20in%20SF";
const bio = 'https://corvus.gent/links/gabe';

test('share crawlers receive the real title, copy and a 1200 × 630 raster preview', async ({request}) => {
  const response = await request.get('/sf', {headers:{'User-Agent':'LinkedInBot/1.0'}});
  expect(response.ok()).toBe(true);
  const html = await response.text();
  for (const [name,value] of [['title',headline],['description',description],['image','https://corvus.gent/sf/night-card.png']]) {
    expect(html).toContain(`property="og:${name}" content="${value}"`);
  }
  const image = await request.get('/sf/night-card.png');
  expect(image.headers()['content-type']).toContain('image/png');
  const bytes = await image.body();
  expect([bytes.readUInt32BE(16),bytes.readUInt32BE(20)]).toEqual([1200,630]);
});

test('email and link hub work without JavaScript',async ({browser,baseURL}) => {
  const context = await browser.newContext({baseURL,javaScriptEnabled:false,viewport:{width:320,height:568}});
  try {
    await context.route(bio,r=>r.fulfill({body:'Gabe’s link hub'}));
    const page=await context.newPage();
    await page.goto('/sf/');
    await expect(page).toHaveTitle(headline);
    await expect(page.getByText(description,{exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Send me an email'})).toHaveAttribute('href',subject);
    const [hub]=await Promise.all([context.waitForEvent('page'),page.getByRole('link',{name:'Look at my Linktree'}).click()]);
    await expect(hub).toHaveURL(bio);
    await expect(page).toHaveURL(/\/sf\/$/);
    await expect(page.locator('form,input,textarea')).toHaveCount(0);
  } finally { await context.close(); }
});

for(const [width,height] of [[320,568],[360,740],[740,360],[1440,900]]) {
  test(`contact and illustration fit one screen at ${width} × ${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/sf/');
    await expect(page.getByRole('heading',{name:headline})).toBeVisible();
    for(const element of await page.locator('nav a,button').all()){
      await expect(element).toBeVisible();
      const box=await element.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      expect(box.height).toBeGreaterThanOrEqual(44);
      const clickable=await element.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
      expect(clickable).toBe(true);
    }
    expect(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight])).toEqual([width,height]);
  });
}

test('mouse and keyboard reveal both easter eggs and Escape closes them',async({page})=>{
  const logs=[],errors=[];
  page.on('console',m=>m.type()==='error'?errors.push(m.text()):logs.push(m.text()));
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/sf/');
  const lamp=page.getByRole('button',{name:'Reveal the lantern inscription'});
  await lamp.focus();await page.keyboard.press('Space');
  await expect(page.locator('#inscription')).toHaveText("Diogenes searched Athens for an honest man. I'm searching SF for an honest founder.");
  await expect(lamp).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');await expect(page.locator('#inscription')).toBeHidden();
  const bird=page.getByRole('button',{name:'Let Corvus fly'});
  await bird.hover();await expect(page.getByRole('tooltip')).toHaveText('Caw. — Corvus');
  await expect(bird).toHaveClass(/flown/);
  await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toBeHidden();
  await bird.focus();await page.keyboard.press('Enter');await expect(bird).toHaveClass(/flown/);
  expect(logs).toContain('Fog is called Karl here. Say hi to Gabriel.');
  expect(errors).toEqual([]);
});

test('mobile tap works with reduced motion and leaves the scene still',async({browser,baseURL})=>{
  const ctx=await browser.newContext({baseURL,isMobile:true,hasTouch:true,reducedMotion:'reduce',viewport:{width:360,height:740}});
  try {
    const page=await ctx.newPage();
    await page.goto('/sf/');
    await page.locator('.lantern').tap();await expect(page.locator('#inscription')).toBeVisible();
    await page.locator('.lantern').tap();await expect(page.locator('#inscription')).toBeHidden();
    await page.locator('.raven').tap();await expect(page.getByRole('tooltip')).toBeVisible();
    expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
    await expect(page.getByRole('link',{name:'Send me an email'})).toBeInViewport({ratio:1});
  } finally { await ctx.close(); }
});
