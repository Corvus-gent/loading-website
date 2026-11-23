import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-23T11:34:00Z'));
  await page.addInitScript(()=>{
    window.corgiFrames={};
    const draw=CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData=function(...args){window.corgiFrames[this.canvas.id]=(window.corgiFrames[this.canvas.id]||0)+1;return draw.apply(this,args);};
  });
});

test('Roman clock, pointer cursor, once-only Wing and paused portrait',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/corgi/');
  await expect(page.locator('.dateline')).toContainText('MONDAY, XXIII NOVEMBER MMXXVI');
  await expect(page.locator('.printed')).toHaveText('printed 12:34');
  const fine=await page.evaluate(()=>matchMedia('(hover:hover) and (pointer:fine)').matches);
  const cursor=await page.evaluate(()=>getComputedStyle(document.body).cursor);
  expect(cursor.includes('data:image/svg+xml')).toBe(fine);
  await page.locator('.ticker').scrollIntoViewIfNeeded();
  const reduced=testInfo.project.name==='reduced motion';
  if(reduced){await expect(page.locator('.wing-flight')).toHaveCount(0);await expect(page.locator('.tk')).toHaveCSS('animation-name','none');}
  else{await expect(page.locator('.ticker-stage')).toHaveAttribute('data-flights','1');await expect(page.locator('.wing-flight')).toHaveCount(0,{timeout:6000});}
  await page.locator('.seal').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
  const count=await page.evaluate(()=>window.corgiFrames.portrait);
  await page.waitForTimeout(250);expect(await page.evaluate(()=>window.corgiFrames.portrait)).toBe(count);
  await page.locator('.ticker').scrollIntoViewIfNeeded();
  if(!reduced){await expect(page.locator('.ticker-stage')).toHaveAttribute('data-flights','1');await expect(page.locator('.wing-flight')).toHaveCount(0);}
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(testInfo.project.use.viewport.width);
});

for(const input of ['click','pointer hold','keyboard hold'])test(`Seal ${input} opens its existing mail link once`,async({page},testInfo)=>{
  await page.goto('/corgi/');const seal=page.locator('.seal');await seal.scrollIntoViewIfNeeded();
  await expect(seal).toHaveAttribute('href',/^mailto:gabriel@corvus.gent/);
  // Keep this interaction test local; never launch an email client.
  await seal.evaluate(el=>el.setAttribute('href','#seal-approved'));
  if(input==='click')await seal.click();
  else if(input==='keyboard hold'){
    await seal.focus();await page.keyboard.down('Enter');
    await page.waitForTimeout(750);await page.keyboard.up('Enter');
  }else if(testInfo.project.name==='mobile'){
    await seal.dispatchEvent('pointerdown',{button:0,pointerType:'touch',pointerId:1});
    await page.waitForTimeout(750);await seal.dispatchEvent('pointerup',{button:0,pointerType:'touch',pointerId:1});
    if(testInfo.project.name==='reduced motion')await seal.click();
  }else{
    const box=await seal.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.waitForTimeout(750);await page.mouse.up();
  }
  await expect(seal).toHaveAttribute('data-approved','true');
  await expect(page).toHaveURL(/#seal-approved$/,{timeout:5000});
  await expect(page.locator('body')).toContainText('gabriel@corvus.gent');
});

test('All canvases stay static with reduced motion',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='reduced motion');await page.goto('/corgi/');
  await page.waitForTimeout(800);const before=await page.locator('#glyphs').evaluate(el=>el.toDataURL());
  await page.mouse.move(40,80);await page.waitForTimeout(250);
  expect(await page.locator('#glyphs').evaluate(el=>el.toDataURL())).toBe(before);
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
});

test('Diogenes and SPQC discoveries remain keyboard accessible',async({page})=>{
  await page.goto('/corgi/');await page.keyboard.type('SPQC');
  await expect(page.locator('.secret-note')).toBeVisible();await expect(page.locator('body')).toHaveAttribute('data-spqc','awake');
  await page.keyboard.press('Escape');await expect(page.locator('.secret-note')).toBeHidden();
  await expect(page.getByRole('button',{name:'Give Diogenes his sunlight'})).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('.secret-note')).toBeVisible();
  await page.getByRole('button',{name:"Close Diogenes' note"}).click();await expect(page.locator('.secret-note')).toBeHidden();
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
