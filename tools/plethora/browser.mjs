import {chromium,webkit,devices} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base=process.env.PLETHORA_TEST_URL||'http://127.0.0.1:4394';
const cookieFile=process.env.PLETHORA_TEST_COOKIES;
const cookies=cookieFile?(await fs.readFile(cookieFile,'utf8')).split('\n').filter(l=>l.includes('\t')).map(l=>{const[d,,path,secure,expires,name,value]=l.replace(/^#HttpOnly_/,'').split('\t');return{domain:d,path,secure:secure==='TRUE',expires:Number(expires),name,value,httpOnly:true};}):[];
const profiles=[['desktop',chromium,{viewport:{width:1440,height:1000}}],['android',chromium,devices['Pixel 7']],['iphone',webkit,devices['iPhone 13']]];
await fs.mkdir('tests/results/plethora',{recursive:true});
for(const[name,engine,options]of profiles){const browser=await engine.launch({headless:true});try{
 const context=await browser.newContext({...options,reducedMotion:'reduce'});if(cookies.length)await context.addCookies(cookies);
 await context.route('**/api/**',route=>{const u=new URL(route.request().url());if(u.pathname==='/api/plethora')return route.fulfill({json:{ready:true,total:98,referralCode:'GABE-TEST',pt:'123'}});return route.fulfill({json:{self:null,ok:true,ready:false,tracks:[],soldiers:[],members:[],stats:{plays:128,topScore:1000},names:['OSSMAN'],votes:{OSSMAN:10,codex:0,compound:0},views:[],clicks:{},tips:{},bonuses:[],disclaimer:'test',total:10,closed:true,winner:'OSSMAN',leaderboard:[],ideas:[]}});});
 await context.route('**/js/analytics.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));
 await context.route('https://embed.twitch.tv/**',r=>r.fulfill({contentType:'text/javascript',body:''}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/plethora/','/games/hub/','/hack/','/legion/','/battle/']){console.log(name,route);await page.goto(base+route,{waitUntil:'networkidle'});await page.locator('.plethora-ref').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' overflow');assert.equal(await page.locator('[data-plethora-footer]').count(),1,route+' footer');if(route==='/games/hub/'){const adPositions=await page.locator('.plethora-catalog').evaluate(el=>[...el.children].map((el,i)=>el.classList.contains('plethora-tile')?i+1:0).filter(Boolean));assert.deepEqual(adPositions,[3,6,9,12]);}if(route==='/plethora/'){if(name==='desktop')assert.equal(await page.locator('#plethora-qr svg').count(),1);else assert.equal(await page.locator('.qr-wrap').isVisible(),false);assert.match(await page.locator('#plethora-total').innerText(),/98/);}await page.screenshot({path:`tests/results/plethora/${name}-${route.replaceAll('/','')||'home'}.png`,fullPage:route==='/plethora/'});}
 // Home banner is in normal flow, dismisses, and stays dismissed on reload.
 await page.goto(base+'/',{waitUntil:'networkidle'});const banner=page.locator('[data-plethora-banner]');await banner.waitFor();assert.notEqual(await banner.evaluate(el=>getComputedStyle(el).position),'fixed');await banner.getByRole('button').click();await page.reload({waitUntil:'networkidle'});assert.equal(await banner.isVisible(),false);
 // Every OSSMAN menu, including the do-bronx alias in deployed QA.
 await page.goto(base+'/hack/play/',{waitUntil:'networkidle'});await page.locator('[data-plethora-slot="start"] .plethora-ref').waitFor();assert.equal(await page.locator('[data-plethora-slot="start"]').isVisible(),true);
 await page.locator('#go').click();assert.equal(await page.locator('[data-plethora-footer]').isVisible(),false);assert.equal(await page.locator('[data-plethora-slot]:visible').count(),0);await page.locator('#pause').click();assert.equal(await page.locator('[data-plethora-slot="pause"]').isVisible(),true);
 for(const kind of ['promote','over']){await page.evaluate(kind=>screen(kind),kind);assert.equal(await page.locator(`[data-plethora-slot="${kind}"]`).isVisible(),true);assert.equal(await page.locator('[data-plethora-slot]:visible').count(),1);assert.equal(await page.locator('.controls').isVisible(),true);await page.screenshot({path:`tests/results/plethora/${name}-${kind}.png`});}
 await page.goto(base+'/hack/play/?edition=do-bronx',{waitUntil:'networkidle'});await page.evaluate(()=>screen('over'));await page.locator('[data-plethora-slot=over] a[data-plethora=celtix]').waitFor();assert.match(await page.locator('[data-plethora-slot=over] a[data-plethora=celtix]').getAttribute('href'),/plethora-celtix/);
 await page.evaluate(()=>{window.sharePayloads=[];navigator.share=async v=>window.sharePayloads.push(v);});await page.locator('#share').click();assert.match(await page.evaluate(()=>window.sharePayloads.at(-1).text),/ · more games: corvus.gent\/go\/plethora-share$/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'game overflow');
 // All eight daily game-over links use the actual game name, with code next to CTA.
 for(const type of ['babel','borders','wordle','flags','combo','bangle','pingle','lantern']){
  await page.route('**/api/game',r=>r.fulfill({json:{type,day:'2026-11-08',n:7,rotation:[type],done:true,solved:true,history:[],hint:[],answer:'answer',tomorrow:'babel',light:0}}));
  await page.goto(base+'/games/',{waitUntil:'networkidle'});
  await page.locator('#plethora-result-link[data-plethora="'+type+'"]').waitFor({state:'attached'});await page.locator('#plethora-daily-result .plethora-ref').waitFor({state:'attached'});
  assert.match(await page.locator('#plethora-result-link').getAttribute('href'),new RegExp('/go/plethora-'+type));
  // The existing first-visit help dialog can be dismissed without changing gameplay.
  if(await page.locator('#instructions').evaluate(el=>el.open))await page.locator('#help-close').click();assert.equal(await page.locator('#plethora-daily-result').isVisible(),true);
  await page.unroute('**/api/game');
 }
 await page.screenshot({path:`tests/results/plethora/${name}-daily.png`,fullPage:true});
 // Referral code omitted entirely if unset, no literal placeholders in the UI.
 await context.unroute('**/api/**');await context.route('**/api/**',r=>r.fulfill({json:{ready:true,total:0,referralCode:'',pt:''}}));await page.goto(base+'/plethora/',{waitUntil:'networkidle'});assert.equal(await page.locator('.plethora-ref:visible').count(),0);
 const relevant=errors;
 console.log(name+': all placements, grid, menus, dismissal, shares, eight daily games, code on/off PASS; page errors: '+JSON.stringify(relevant));assert.deepEqual(relevant,[]);
 await context.close();
}finally{await browser.close();}}
