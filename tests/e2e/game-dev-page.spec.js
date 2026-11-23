import {test,expect} from '@playwright/test';
test('game-dev public page loads, has public links and fits the viewport',async({page,baseURL})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.fulfill({status:200,body:''}));
 const response=await page.goto('/game-dev/');expect(response.status()).toBe(200);
 await expect(page.locator('main')).toBeVisible();
 await expect(page.locator('a[href="https://github.com/gabe-maxxing"]').first()).toBeVisible();
 await expect(page.locator('a[href="https://corvus.gent"]').first()).toBeVisible();
 await expect(page.locator('a[href^="mailto:gabriel@corvus.gent"]').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
