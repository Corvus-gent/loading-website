import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {rustSite} from '../helpers/rust-site.mjs';
import {PRIVACY_VERSION,strings} from '../../js/privacy-strings.js';
import {STREAM_NOTICE} from '../../js/privacy-stream.js';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch(),outcomes={};
const cases=[
 {name:'new'},
 {name:'allow',choice:{choice:'allow',version:PRIVACY_VERSION,soldier:true}},
 {name:'old allow',choice:{choice:'allow',version:'old',soldier:true}},
 {name:'old refusal',choice:{choice:'deny',version:'old'}},
 {name:'legacy refusal',legacy:{choice:'deny',expires:Date.now()+86400000}},
 {name:'string legacy expiry',legacy:{choice:'deny',expires:String(Date.now()+86400000)}},
 {name:'expired legacy refusal',legacy:{choice:'deny',expires:Date.now()-86400000}},
 {name:'corrupt choice',raw:'broken'},
 {name:'GPC',gpc:true},
 {name:'navigator DNT',dnt:'1'},
 {name:'window DNT',windowDnt:'1'},
 {name:'blocked storage',blocked:true},
];
try{
 for(const engine of ['legacy','rust']){
  outcomes[engine]=[];
  for(const fixture of cases){
   const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',timezoneId:'America/Los_Angeles',reducedMotion:'reduce'}),ack=[];
   const {origin}=await rustSite(context,null,{browserEngine:engine,beforeRequest:async({route,request,u})=>{
    if(u.pathname==='/__privacy-fixture'){
     await route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en"><head><link rel="stylesheet" href="/styles.css"><script src="/js/analytics.js"></script></head><body><a data-privacy-link></a><p data-spotify-notice></p><script type="module">window.__consent=await import('/js/analytics-consent.js');await import('/js/privacy.js');window.__ready=true;</script></body></html>`});return true;
    }
    if(u.pathname==='/js/analytics.js'){await route.fulfill({contentType:'text/javascript',body:''});return true;}
    if(u.pathname==='/api/notice-ok'){ack.push({body:request.postDataJSON(),headers:await request.allHeaders(),method:request.method()});await route.fulfill({status:204});return true;}
   }});
   await context.addCookies([{name:'sess',value:'private-fixture-only',url:origin,secure:true}]);
   await context.addInitScript(f=>{
    if(f.raw)localStorage.setItem('privacy-choice',f.raw);else if(f.choice)localStorage.setItem('privacy-choice',JSON.stringify(f.choice));
    if(f.legacy)localStorage.setItem('analytics-consent',JSON.stringify(f.legacy));
    if(f.gpc)Object.defineProperty(navigator,'globalPrivacyControl',{value:true});
    if(f.dnt)Object.defineProperty(navigator,'doNotTrack',{value:f.dnt});
    if(f.windowDnt)Object.defineProperty(window,'doNotTrack',{value:f.windowDnt});
    if(f.blocked){Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};Storage.prototype.removeItem=()=>{throw Error('blocked')};}
    window.__consentChanges=0;window.addEventListener('analytics-consent-change',()=>window.__consentChanges++);
   },fixture);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
   await page.goto(origin+'/__privacy-fixture?utm_source=x&ref=private');await page.waitForFunction(()=>window.__ready);await page.clock.fastForward(1600);
   const snapshot=()=>page.evaluate(()=>({signal:__consent.privacySignal(),choice:__consent.consentChoice(),allowed:__consent.analyticsAllowed(),dismissed:__consent.noticeDismissed(),notice:!!document.querySelector('#privacy-notice'),open:document.documentElement.classList.contains('privacy-notice-open')}));
   const initial=await snapshot();
   if(initial.notice){
    await expect(page.locator('#privacy-notice')).toBeVisible();await expect(page.locator('.privacy-copy')).toHaveText(strings.en.notice);
    await page.evaluate(()=>document.body.dataset.gamePlaying='true');await expect(page.locator('#privacy-notice')).toBeHidden();
    await page.evaluate(()=>document.body.dataset.gamePlaying='false');await expect(page.locator('#privacy-notice')).toBeVisible();
    await page.evaluate(()=>{document.documentElement.lang='nl';document.documentElement.dataset.twitchLoaded='true';window.dispatchEvent(new Event('twitch-status-change'));});
    await expect(page.locator('.privacy-copy')).toHaveText(STREAM_NOTICE.nl);await expect(page.locator('#privacy-notice [data-deny]')).toHaveText(strings.nl.deny);
   }
   if(initial.notice)await page.locator('#privacy-notice [data-deny]').click();else await page.evaluate(()=>__consent.chooseAnalytics('deny'));await expect(page.locator('#privacy-notice')).toHaveCount(0);assert.equal((await snapshot()).allowed,false);
   await page.evaluate(()=>__consent.chooseAnalytics('allow'));await expect.poll(()=>ack.length).toBe(fixture.choice?.soldier?0:1);
   await page.evaluate(()=>{__consent.chooseAnalytics('allow');__consent.chooseAnalytics('invalid');});
   const after=await snapshot();assert.equal(after.choice.choice,'allow');assert.equal(after.allowed,!initial.signal);assert.equal(after.choice.soldier,true);assert.equal(after.open,false);
   assert.equal(ack.length,fixture.choice?.soldier?0:1);
   for(const event of ack){assert.equal(event.method,'POST');assert.deepEqual(Object.keys(event.body),['day']);assert.match(event.body.day,/^\d{4}-\d{2}-\d{2}$/);assert.equal(event.headers.cookie,undefined);assert.equal(event.headers.referer,undefined);}
   if(!fixture.blocked){await page.evaluate(()=>{localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny',version:'old'}));window.dispatchEvent(new StorageEvent('storage',{key:'privacy-choice'}));});assert.equal((await snapshot()).allowed,false);}
   if(initial.signal||initial.choice?.choice==='deny')assert(!page.url().includes('utm_'));assert.deepEqual(errors,[]);outcomes[engine].push({name:fixture.name,initial,after,acks:ack.length,cleaned:!page.url().includes('utm_')});await context.close();
  }
 }
 assert.deepEqual(outcomes.rust,outcomes.legacy);
 // Real page content must stay identical in all seven languages, including local trusted markup.
 const pageSnapshots={legacy:[],rust:[]};
 for(const engine of ['legacy','rust'])for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
  const{origin}=await rustSite(context,null,{browserEngine:engine,beforeRequest:async({route,u})=>{if(u.pathname==='/js/analytics.js'){await route.fulfill({contentType:'text/javascript',body:''});return true;}}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const lang of width===390?['en','nl','fr','es','pt','de','zh']:['fr']){
   await page.goto(origin+'/privacy/?lang='+lang);await expect(page.locator('#analytics-choice-title')).toHaveText(strings[lang].change);
   if(engine==='rust')await expect(page.locator('#analytics-choice')).toHaveAttribute('data-rust-privacy-page','');
   await page.locator('#analytics-deny').click();await expect(page.locator('#analytics-status')).toHaveText(strings[lang].off);await expect(page.locator('#privacy-notice')).toHaveCount(0);
   pageSnapshots[engine].push(await page.evaluate(()=>({title:document.title,intro:document.querySelector('#privacy-intro').innerHTML,sections:document.querySelector('#privacy-sections').innerHTML,providers:document.querySelector('#privacy-providers').innerHTML,choice:document.querySelector('#analytics-choice-info').textContent})));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  if(engine==='rust'){await mkdir('test-results/rust',{recursive:true});await page.screenshot({path:`test-results/rust/privacy-${width}.png`});}
  assert.deepEqual(errors,[]);await context.close();
 }
 assert.deepEqual(pageSnapshots.rust,pageSnapshots.legacy);
 console.log('PASS: legacy/Rust consent and notice parity across 12 states; DNT/GPC, old refusals, blocked storage, game suppression, live/language copy, acknowledgement dedupe/no cookies/no referrer, cross-tab withdrawal and unchanged seven-language page content at 390px/1440px.');
}finally{await browser.close();}
