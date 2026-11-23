import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('Salesforce page is standalone, byte-verified and responsive',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const response=await page.goto('/salesforce/');
  await expect(page.locator('h1')).toBeVisible();await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
  await expect(page.locator('a[href^="mailto:gabriel@corvus.gent"]').first()).toBeVisible();
  const hashFile=await readFile('tests/salesforce.sha256','utf8').catch(()=>null);
  if(hashFile){expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(hashFile.split(/\s/)[0]);await expect(page.locator('#sea')).toBeVisible();await expect(page.locator('.card').first()).toContainText('TONIGHT');await expect(page.locator('a[href*="linkedin.com"]')).toBeVisible();}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
