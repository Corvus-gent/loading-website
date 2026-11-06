import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port=4191,server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
const origin='http://127.0.0.1:'+port;
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});
 for(const route of ['/','/realm/','/privacy/','/wiki/corvus/']){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'}));
  await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ready:false,ok:true})}));
  await page.goto(origin+route,{waitUntil:'networkidle'});assert(await page.locator('main').isVisible(),route);assert.deepEqual(errors,[],route);await page.close();
 }
 const page=await browser.newPage();await page.goto(origin+'/privacy/');
 const result=await page.evaluate(async()=>{const {loadFeature,featureText}=await import('/js/i18n/feature.js');await loadFeature('army','nl');return featureText('army','invitation',{name:'test'},'nl');});
 assert(result.includes('test')&&!result.includes('{name}'),'localized placeholder was substituted');
 console.log('Playwright smoke: portal, realm, privacy, wiki and feature-locale loader passed.');
}finally{await browser?.close();server.kill();}
