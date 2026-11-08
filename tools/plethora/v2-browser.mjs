import {chromium,webkit,devices} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.env.PLETHORA_TEST_URL||'http://127.0.0.1:4394',folder='tests/results/plethora-official';fs.mkdirSync(folder,{recursive:true});
const cookies=process.env.PLETHORA_TEST_COOKIES?fs.readFileSync(process.env.PLETHORA_TEST_COOKIES,'utf8').split('\n').filter(l=>l.includes('\t')).map(l=>{const[d,,path,secure,expires,name,value]=l.replace(/^#HttpOnly_/,'').split('\t');return{domain:d,path,secure:secure==='TRUE',expires:Number(expires),name,value,httpOnly:true};}):[];
for(const[name,engine,opts]of [['desktop',chromium,{viewport:{width:1440,height:1000}}],['iphone',webkit,{...devices['iPhone 13'],viewport:{width:390,height:844}}],['android',chromium,devices['Pixel 7']]]){
 const b=await engine.launch(),c=await b.newContext({...opts,reducedMotion:'reduce'});await c.addCookies(cookies);const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(base+'/plethora/?from=compound',{waitUntil:'networkidle'});await p.locator('#plethora-total').filter({hasText:'people sent'}).waitFor();assert.equal(await p.locator('h1').innerText(),'Find games worth keeping.');
  assert.equal(await p.locator('#plethora-download').getAttribute('href'),'/go/plethora-bio-x');assert.equal(await p.locator('.ossman-card a[data-plethora]').getAttribute('href'),'/go/plethora-game');assert.equal(await p.locator('.ossman-card .plethora-ref').innerText(),'Code: GABE');
  assert.equal(await p.locator('.qr-wrap').isVisible(),name==='desktop');if(name==='desktop')assert.equal(await p.locator('#plethora-qr svg').count(),1);
  assert.equal(await p.locator('a[href*="apps.apple.com"],a[href*="play.google.com"],a[href*="noCount"]').count(),0);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${folder}/${name}-landing.png`,fullPage:true});
  // Click CTAs, intercept the external navigation (no real external referral).
  const destinations=[];await c.route('**/go/plethora-*',async r=>{const response=await r.fetch({maxRedirects:0});destinations.push(response.headers().location);return r.fulfill({status:200,contentType:'text/html',body:'official redirect checked'});});
  await p.locator('#plethora-download').click();await p.waitForURL(base+'/go/plethora-bio-x');assert.equal(destinations.at(-1),'https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=bio-x');
  await p.goto(base+'/plethora/');await p.locator('.ossman-card a[data-plethora]').click();await p.waitForURL(base+'/go/plethora-game');assert.equal(destinations.at(-1),'https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=game');
  await p.goto(base+'/plethora/stats/',{waitUntil:'networkidle'});await p.locator('#stats-status').filter({hasText:'updated'}).waitFor();assert.equal(await p.locator('.stats-group').count(),4);assert.equal(await p.locator('.stats-row:not(.stats-row-head)').count(),35);assert.equal(await p.locator('#destinations b').count(),2);assert.match(await p.locator('#history-note').innerText(),/Pacific/);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${folder}/${name}-stats.png`,fullPage:true});
  const csv=await c.request.get(base+'/plethora/stats.csv');assert.equal(csv.status(),200);assert.match(await csv.text(),/^day_pt,placement,destination,device,country,deduped_clicks,raw_clicks/);
  // Existing counts remain on screen if Redis later becomes unavailable.
  const before=await p.locator('#stats-total').innerText();await c.route('**/api/plethora?action=stats',r=>r.fulfill({json:{ready:false}}));await p.locator('#refresh-stats').click();await p.locator('#stats-status').filter({hasText:'last counts shown'}).waitFor();assert.equal(await p.locator('#stats-total').innerText(),before);
  assert.deepEqual(errors,[]);console.log(`PASS ${name}: official CTA clicks, GABE, QR visibility, 35 stats rows, CSV, outage fallback; no overflow or page errors.`);
 }finally{await b.close();}
}
