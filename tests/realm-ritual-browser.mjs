// Point at a deployed preview; only the preview origin receives its optional bypass.
import assert from 'node:assert/strict';
import {chromium, expect} from '@playwright/test';
import en from '../js/locales/en.js';
import nl from '../js/locales/nl.js';
import fr from '../js/locales/fr.js';

const base = new URL(process.argv[2]).origin;
const browser = await chromium.launch();
try {
  for (const viewport of [{width:390,height:844},{width:1440,height:900}]) {
    const mobile = viewport.width < 500;
    const ctx = await browser.newContext({viewport, isMobile:mobile, hasTouch:mobile, locale:'en-US',
      timezoneId:mobile?'Europe/Brussels':'America/Los_Angeles', reducedMotion:mobile?'reduce':'no-preference'});
    try {
      if(process.env.PREVIEW_BYPASS) await ctx.route(u=>u.origin===base, route=>route.continue({
        headers:{...route.request().headers(),'x-vercel-protection-bypass':process.env.PREVIEW_BYPASS}
      }));
      const p = await ctx.newPage();
      const errors=[];
      p.on('pageerror',e=>errors.push(e.message));
      const goto = async path => {
        const response=await p.goto(base+path,{waitUntil:'domcontentloaded'});
        assert.equal(response.status(),200,path);
        await expect(p.locator('#lang-switcher')).toHaveCount(1);
        await expect(p.locator('#lang-switcher a')).toHaveCount(8);
        const rect=await p.locator('#lang-switcher').boundingBox();
        assert(rect.y>=0 && rect.y<120 && rect.x>=0 && rect.x+rect.width<=viewport.width+2,path+' bar visible at the top');
        return response;
      };
      const pick=async (code) => {
        await p.locator('#lang-switcher a[hreflang="'+code+'"]').click();
        await expect(p.locator('html')).toHaveAttribute('lang',code);
        await expect(p.locator('#lang-switcher a.active')).toHaveAttribute('hreflang',code);
      };
      await goto('/');
      await expect(p.locator('[data-realm-gate] .realm-enter')).toHaveText(en['realm.enter']);
      await p.reload({waitUntil:'domcontentloaded'});
      await expect(p.locator('[data-realm-gate]')).toHaveCount(1);
      await pick('nl');
      await expect(p.locator('.realm-enter')).toHaveText(nl['realm.enter']);
      const expectedExpiry=await p.evaluate(()=>{
        const now=new Date(),end=new Date(now); end.setHours(4,2,0,0);
        if(end<=now)end.setDate(end.getDate()+1); return end.getTime()/1000;
      });
      await p.locator('.realm-enter').click();
      await expect(p).toHaveURL(/\/realm\//);
      await expect(p.locator('[data-i18n="realm.title"]')).toHaveText(nl['realm.title']);
      const cookies=await ctx.cookies();
      const ritual=cookies.find(c=>c.name==='corvus_realm');
      assert(ritual?.secure && ritual.sameSite==='Lax' && ritual.path==='/' && ritual.value==='1');
      assert(Math.abs(ritual.expires-expectedExpiry)<2);
      assert(cookies.some(c=>c.name==='corvus_lang' && c.value==='nl'));
      await p.evaluate(()=>localStorage.removeItem('lang'));
      const home=await goto('/');
      assert(!(await home.text()).includes('data-realm-gate'), 'returning HTML contains no gate before JavaScript');
      await expect(p.locator('.portal-sections')).toBeVisible();
      await expect(p.locator('html')).toHaveAttribute('lang','nl');
      for (const [path,key] of [['/realm/','realm.title'],['/now/','now.sub'],['/languages/','lang.sub']]) {
        await goto(path); await pick('fr'); await expect(p.locator('[data-i18n="'+key+'"]').first()).toHaveText(fr[key]);
        await pick('nl'); await expect(p.locator('[data-i18n="'+key+'"]').first()).toHaveText(nl[key]);
      }
      await goto('/compound/impact/');
      await expect(p.locator('#lang-switcher a.active')).toHaveAttribute('hreflang','nl');
      await expect(p.locator('h1').first()).toContainText(/Compound/i);
      await pick('en');
      // Shorten this same Secure cookie to exercise real browser expiry without waiting a day.
      await ctx.addCookies([{...ritual, expires:Date.now()/1000+1}]);
      await expect.poll(async()=>(await ctx.cookies()).some(c=>c.name==='corvus_realm')).toBe(false);
      await goto('/'); await expect(p.locator('[data-realm-gate] .realm-enter')).toBeVisible();
      assert.deepEqual(errors,[], 'uncaught JavaScript errors');
      console.log(viewport.width+'px: first/return/expired entry, cookie persistence, historic & modern pages passed.');
    } finally {await ctx.close();}
  }
} finally {await browser.close();}
