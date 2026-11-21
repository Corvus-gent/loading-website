import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {rustSite} from '../helpers/rust-site.mjs';
const browser=await chromium.launch(),reference={};
const html=secret=>`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>${secret?'<button data-cv-secret translate="no">512</button>':''}<span data-cv-count="140469"></span><span data-cv-count="0"></span><span data-cv-count="bad">unchanged</span></main><script type="module" src="/js/cv-page.js"></script></body></html>`;
const snapshot=p=>p.evaluate(()=>({button:document.querySelector('button')?.outerHTML,counts:[...document.querySelectorAll('[data-cv-count]')].map(e=>e.textContent)}));
try{for(const engine of ['legacy','rust'])for(const width of [390,1440]){
 const c=await browser.newContext({viewport:{width,height:844},hasTouch:true,locale:'en-US'}),errors=[];
 const site=await rustSite(c,{}, {browserEngine:engine,beforeRequest:async({route,u})=>{if(u.pathname==='/cv-fixture'){await route.fulfill({contentType:'text/html',body:html(!u.searchParams.has('noSecret'))});return true;}}});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('https://corvus.gent/cv-fixture');const button=p.locator('button');await expect(button).toHaveAttribute('aria-label',/^Secret code 512/);await expect(p.locator('[data-cv-count]').first()).toHaveText('140,469');
 const snapshots=[await snapshot(p)];
 await button.dispatchEvent('pointerenter',{pointerType:'touch'});await expect(button).toHaveText('512');
 await button.tap();await expect(button).toHaveText('520');
 await button.dispatchEvent('pointerenter',{pointerType:'mouse'});await expect(button).toHaveText('1314');
 await button.dispatchEvent('click',{pointerType:'mouse'});await expect(button).toHaveText((1314).toString(2));snapshots.push(await snapshot(p));
 await button.focus();await p.keyboard.press('ArrowLeft');await expect(button).toHaveText('520');await p.keyboard.press('ArrowRight');await expect(button).toHaveText('1314');await p.keyboard.press('ArrowRight');await expect(button).toHaveText('512');await p.keyboard.press('Enter');await expect(button).toHaveText((512).toString(2));snapshots.push(await snapshot(p));
 for(const lang of ['nl','es','fr','pt','de','zh','hi','ta','en']){await p.evaluate(lang=>dispatchEvent(new CustomEvent('corvus-language-change',{detail:{lang}})),lang);const expected=await p.evaluate(lang=>new Intl.NumberFormat(lang).format(140469),lang);await expect(p.locator('[data-cv-count]').first()).toHaveText(expected);await expect(button).toHaveText((512).toString(2));snapshots.push(await snapshot(p));}
 const helpers=await p.evaluate(async()=>{const{formatCvCount}=await import('/js/cv-page.js');return [0,1,140469,'1053',-1,1.2,'bad',null,'',true,[],[42],{},Infinity,NaN,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1].flatMap(value=>['en','nl','fr','zh','hi','invalid_locale'].map(lang=>formatCvCount(value,lang)));});
 snapshots.push(helpers);if(engine==='legacy')reference[width]=snapshots;else assert.deepEqual(snapshots,reference[width]);
 await p.goto('https://corvus.gent/cv-fixture?noSecret');await expect(p.locator('[data-cv-count]').first()).toHaveText('140,469');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await site.drain();await c.close();
 console.log('PASS',engine,width,'CV mouse/touch/keyboard/binary, localized counts/accessibility, invalid values, selected-state retention and pages without secret button');
}}finally{await browser.close();}
