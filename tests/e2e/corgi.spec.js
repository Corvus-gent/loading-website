import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

test('Corgi source integrity, responsive screenshots and private chrome',async({page,context},testInfo)=>{
  await page.clock.setFixedTime(new Date('2026-11-23T11:34:00Z'));
  const source=await readFile('corgi/index.html');
  const expected=(await readFile('tests/corgi.sha256','utf8')).split(/\s/)[0];
  expect(createHash('sha256').update(source).digest('hex')).toBe(expected);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('/corgi/');
  expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(expected);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(2500);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
  await expect(page.locator('.seal')).toHaveAttribute('href',/^mailto:gabriel@corvus.gent/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const reference=await context.newPage();
  await reference.clock.setFixedTime(new Date('2026-11-23T11:34:00Z'));
  await reference.route('**/corgi/',route=>route.fulfill({body:source,contentType:'text/html'}));
  await reference.goto('/corgi/');await reference.evaluate(()=>document.fonts.ready);await reference.waitForTimeout(2500);
  for(const [name,selector] of [['hero','header'],['courier','.paper-wrap'],['seal','.seal']]){
    for(const tab of [page,reference]){await tab.locator(selector).scrollIntoViewIfNeeded();await tab.waitForTimeout(700);}
    const options={animations:'disabled',mask:await page.locator('canvas').all()};
    const actual=await page.screenshot({...options,path:testInfo.outputPath(`${name}.png`)});
    const original=await reference.screenshot({animations:'disabled',mask:await reference.locator('canvas').all(),path:testInfo.outputPath(`${name}-original.png`)});
    const a=await sharp(actual).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const b=await sharp(original).ensureAlpha().raw().toBuffer();let changed=0;
    for(let i=0;i<a.data.length;i+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(a.data[i+k]-b[i+k])))>25)changed++;
    expect(changed/(a.info.width*a.info.height),`${name} pixel diff`).toBeLessThanOrEqual(.01);
  }
  expect(errors).toEqual([]);await reference.close();
});
