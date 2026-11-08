import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.SQUADS_PREVIEW;
const browser=await chromium.launch({args:['--disable-http2']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 if(process.env.PREVIEW_COOKIES){const raw=await fs.readFile(process.env.PREVIEW_COOKIES,'utf8');await context.addCookies(raw.split('\n').filter(l=>l&&!l.startsWith('#')||l.startsWith('#HttpOnly_')).map(l=>{const [domain,,path,secure,expires,name,value]=l.replace('#HttpOnly_','').split('\t');return{domain,path,name,value,secure:secure==='TRUE',httpOnly:l.startsWith('#HttpOnly_'),expires:Number(expires)||-1,sameSite:'Lax'};}));}
 const posted=[],members={},errors=[];
 // Inspect the real deployed read route, then keep test clicks out of live storage.
 const actual=await context.request.get(base+'/api/hack');assert.equal(actual.status(),200);assert.equal(typeof(await actual.json()).members,'object');
 await context.route('**/api/hack',async r=>{
  if(r.request().method()==='POST'){const d=r.request().postDataJSON();posted.push(d);if(d.action==='squad_member'){const key=d.hack_id+':'+d.member;members[key]=(members[key]||0)+1;}return r.fulfill({json:{ok:true}});}
  return r.fulfill({json:{totals:{view:37},sources:{},comments:[],members}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await fs.mkdir('test-results/squads',{recursive:true});
 for(const path of ['/hackathons/','/hack/1/']){
  await page.goto(base+path+'?utm_source=linkedin');await page.evaluate(()=>import('/js/squad-links.js?v=20261107-team3'));
  const section=page.locator(path==='/hackathons/'?'#hackthefeed':'.hack-squad');
  assert.deepEqual(await section.locator('[data-squad-member]').evaluateAll(ns=>ns.map(n=>({id:n.dataset.squadMember,name:n.getAttribute('aria-label'),url:n.getAttribute('href')}))),[
   {id:'gabe',name:'Gabe',url:'https://corvus.gent'},
   {id:'siebe',name:'Siebe Baree',url:'https://github.com/SiebeBaree'}
  ]);
  assert(!/teammates|5-person|TODO/i.test(await section.innerText()));
  assert.deepEqual(await section.locator('.squad-anonymous > span').allTextContents(),['×','XX']);
  assert.equal(await section.locator('.squad-anonymous a').count(),0);
  // Preserve actual touch/click dispatch and hrefs; prevent leaving the test page.
  await page.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('[data-squad-member]'))e.preventDefault();}));
  for(const member of ['gabe','siebe']){
   const wait=page.waitForRequest(r=>r.url().endsWith('/api/hack')&&r.method()==='POST'&&r.postDataJSON()?.member===member);
   await section.locator('[data-squad-member="'+member+'"]').tap();const req=await wait;assert.equal(req.postDataJSON().hack_id,1);assert.equal(req.postDataJSON().source,'linkedin');
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await section.screenshot({path:'test-results/squads/'+(path==='/hackathons/'?'members-mobile':'build-squad-mobile')+'.png'});
  await page.setViewportSize({width:1440,height:1000});await section.screenshot({path:'test-results/squads/'+(path==='/hackathons/'?'members-desktop':'build-squad-desktop')+'.png'});await page.setViewportSize({width:390,height:844});
 }
 const count=posted.filter(d=>d.action==='squad_member').length;
 await page.evaluate(()=>Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true,configurable:true}));
 await page.locator('.hack-squad [data-squad-member="gabe"]').tap();await page.waitForTimeout(250);assert.equal(posted.filter(d=>d.action==='squad_member').length,count);
 await page.evaluate(()=>{Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>false,configurable:true});localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny'}));});
 await page.locator('.hack-squad [data-squad-member="siebe"]').tap();await page.waitForTimeout(250);assert.equal(posted.filter(d=>d.action==='squad_member').length,count);
 await page.getByRole('link',{name:'see all squads →'}).click();await page.waitForURL('**/hackathons/');
 await page.goto(base+'/hackathons/');await page.setContent((await fs.readFile('stats/hack/index.html','utf8')).replace(/<script[\s\S]*?<\/script>/g,''));await page.addScriptTag({type:'module',url:base+'/hack/stats.js?v=20261108-roster'});await page.getByRole('heading',{name:'squad link clicks'}).waitFor();for(const name of ['Gabe','Siebe Baree'])assert((await page.locator('#hack-stats').innerText()).includes(name+' · 2'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({mobile:true,desktop:true,memberClicks:count,optOut:true,gpc:true,statsCounts:members,errors}));
}finally{await browser.close();}
