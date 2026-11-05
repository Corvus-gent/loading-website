import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

const profiles = JSON.parse(await readFile('personas.json', 'utf8'));
const socialPaths = {
  corvus:['linkedin.com/company/corvus-gent'],
  pidgy:['linkedin.com/company/pidgy','instagram.com/pidgy_ai','tiktok.com/@pidgy_ai','youtube.com/@Alkmisthq','facebook.com/PidgyAI']
};
const barePath = href => new URL(href).hostname.replace(/^www\./,'') + new URL(href).pathname.replace(/\/$/,'');
test.use({viewport:{width:360,height:740}, userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'});
let errors;
test.beforeEach(async({page})=>{
  errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  page.on('console', msg=>{if(msg.type()==='error') errors.push(msg.text());});
});
test.afterEach(()=>expect(errors).toEqual([]));
async function fits(page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
}

for(const [id, profile] of Object.entries(profiles)) {
  test(id+' reads its own JSON, attributes every hub link, and has server-rendered share metadata',async({page,request})=>{
    const route='/links/'+id+'/li/402-post';
    for(const url of ['/links/'+id,route,route+'/']) {
      const response=await request.get(url);
      expect(response.ok()).toBe(true);
      const html=await response.text();
      expect(html).toContain('property="og:title" content="'+profile.preview.title+'"');
      expect(html).toContain('property="og:description" content="'+profile.preview.description+'"');
      expect(html).toContain('property="og:image" content="https://corvus.gent'+profile.preview.image+'"');
    }
    // Edit the response, like an owner editing only personas.json.
    const fixture=structuredClone(profiles);
    fixture[id].tagline='live '+id+' tagline';
    await page.route('**/personas.json',r=>r.fulfill({json:fixture}));
    await page.goto(route);
    await expect(page.locator('#line')).toHaveText(fixture[id].tagline);
    await expect(page.locator('#full')).toHaveText(profile.bio);
    await expect(page.locator('#portrait img')).toHaveAttribute('src',profile.photos[0]);
    const links=await page.locator('a[data-link]').evaluateAll(els=>els.map(a=>({href:a.href,id:a.dataset.link})));
    for(const link of links){
      const tags=new URL(link.href).searchParams;
      expect(Object.fromEntries(tags)).toMatchObject({utm_source:'linkedin',utm_medium:'links',utm_campaign:id+'-402-post',utm_content:link.id});
    }
    expect(links.filter(l=>new URL(l.href).searchParams.get('invite')==='GABE')).toHaveLength(id==='gabe'?1:0);
    await expect(page.locator('.lt-qr')).toHaveCount(id==='gabe'?1:0);
    const socials=page.locator('#socials a'),follow=page.locator('#follow a');
    expect(await socials.allTextContents()).toEqual(profile.socials.filter(s=>s.href).map(s=>s.text));
    if(id!=='gabe') {
      expect(await socials.evaluateAll(a=>a.map(e=>e.href))).toEqual(await follow.evaluateAll(a=>a.map(e=>e.href)));
      expect((await follow.evaluateAll(a=>a.map(e=>e.href))).map(barePath)).toEqual(socialPaths[id]);
      await expect(page.locator('a[href*="/links/gabe"]')).toHaveCount(1);
      expect((await page.locator('a').allTextContents()).filter(t=>/gabe/i.test(t.trim()))).toEqual([id==='corvus'?'the keeper: gabe':'gtm: gabe']);
      expect(links.some(l=>/gabe\.maxxing|gabe_maxxing|gabinho_bjj|francisco-gabriel/.test(l.href))).toBe(false);
      for(const button of await follow.all())expect((await button.boundingBox()).width).toBeGreaterThanOrEqual(44);
    } else await expect(page.locator('#follow')).toBeHidden();
    await expect(page.locator('.lt-lantern')).toHaveCount(id==='pidgy'?0:1);
    await fits(page);
  });
}
test('empty slots become visible in the hub and infobox when filled in JSON',async({page})=>{
 const data=structuredClone(profiles);data.corvus.socials.find(s=>s.id==='threads').href='https://www.threads.net/@fixture';
 await page.route('**/personas.json',route=>route.fulfill({json:data}));
 await page.goto('/links/corvus');await expect(page.locator('#follow a')).toHaveCount(2);
 await page.goto('/wiki/corvus');await expect(page.locator('.infobox a[href*="threads.net"]')).toHaveCount(1);
});
for(const id of ['corvus','pidgy']) {
 test(id+' article is complete in seven languages, with official links and the correct portrait',async({page})=>{
   await page.goto('/wiki/'+id+'/?lang=en');
   const box=page.locator('.infobox');
   await expect(box.locator('img')).toHaveAttribute('src',profiles[id].photos[0]);
   expect((await box.locator('#official-links a').evaluateAll(a=>a.map(e=>e.href))).map(barePath)).toEqual(socialPaths[id]);
   const intros=new Set(),topics=new Set(),facts=new Set(),buttonLabels=new Set();
   for(const [lang,label] of Object.entries({en:'EN',nl:'NL',fr:'FR',pt:'PT',es:'ES',de:'DE',zh:'中文'})){
     await page.locator('#lang-switcher').getByRole('link',{name:label,exact:true}).click();
     await expect(page.locator('html')).toHaveAttribute('lang',lang);
     intros.add(await page.locator('.wiki-lead p').innerText());
     topics.add(await page.locator('.wiki-prose p').first().innerText());
     facts.add(await box.locator('dd').first().innerText());
     buttonLabels.add(await box.locator('a[href="/links/'+id+'"]').innerText());
     await fits(page);
   }
   expect(intros.size).toBe(7);expect(topics.size).toBe(7);expect(facts.size).toBeGreaterThanOrEqual(6);expect(buttonLabels.size).toBe(7);
 });
}
test('Pidgy cycles through each unique portrait on both pages, with manual control for reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.clock.install();
 for(const path of ['/links/pidgy','/wiki/pidgy/']){
   await page.goto(path);const img=page.locator('#portrait img');await expect(img).toHaveAttribute('src',profiles.pidgy.photos[0]);
   await page.clock.fastForward(6500);await expect(img).toHaveAttribute('src',profiles.pidgy.photos[0]);
   for(const src of profiles.pidgy.photos.slice(1)){await page.locator('#portrait button').click();await expect(img).toHaveAttribute('src',src);await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);}
   await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.fastForward(5000);await expect(img).toHaveAttribute('src',profiles.pidgy.photos[0]);
   await page.emulateMedia({reducedMotion:'reduce'});
 }
});
test('Corvus crow flies; Gabe and the wiki directory lead to both searchable articles',async({page,request})=>{
 await page.clock.install();await page.goto('/links/corvus');await expect(page.locator('.lt-crow')).toBeAttached();await page.clock.runFor(10100);await expect(page.locator('.lt-crow')).toHaveClass(/ in/);
 for(const url of ['/people/?id=gabe','/wiki/']){
   await page.goto(url);
   for(const id of ['corvus','pidgy'])await expect(page.locator('a[href="/wiki/'+id+'/"]').first()).toBeVisible();
 }
 const index=await (await request.get('/search-index.json')).json();
 for(const [id,content] of [['corvus','lantern'],['pidgy','inbox']])expect(index.find(x=>x.url==='/wiki/'+id+'/')?.text).toContain(content);
 await page.goto('/wiki/corvus/#rome');await expect(page).toHaveURL(/namesakes\/#rome$/);await expect(page.locator('#rome')).toBeVisible();
});
for(const id of Object.keys(profiles)) {
 test('consented SDK sends '+id+' on page views and hub clicks',async({page,context})=>{
   const seen=[];
   await page.addInitScript(()=>{Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false});Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>undefined});});
   await context.route('https://eu.i.posthog.com/**',async r=>{
     if(r.request().method()==='POST'){
       let data=r.request().postDataBuffer();
       if(data?.[0]===31 && data?.[1]===139)data=gunzipSync(data);
       let value=data?.toString()||'';
       if(value.startsWith('data='))value=Buffer.from(new URLSearchParams(value).get('data'),'base64').toString();
       if(value){const e=JSON.parse(value);seen.push(...(Array.isArray(e)?e:e.batch||[e]));}
     }
     return r.fulfill({json:{}});
   });
   await page.route('**/api/geo?country=1',r=>r.fulfill({json:{countryCode:'BE'}}));
   await page.goto('/links/'+id+'/li/402-post');await page.locator('#privacy-notice [data-allow]').click();
   await expect.poll(()=>seen.find(e=>e.event==='$pageview')?.properties.links_person).toBe(id);
   const hub=page.locator(id==='gabe'?'#socials a':'#follow a').first();
   await context.route('https://www.linkedin.com/**',r=>r.fulfill({body:'official destination fixture'}));
   await hub.click();await expect.poll(()=>seen.find(e=>e.event==='links_click')?.properties.links_person).toBe(id);
   expect(seen.find(e=>e.event==='links_click').properties).toMatchObject({$pathname:'/links/'+id+'/',links_source:'linkedin',links_campaign:'402-post',link:'linkedin'});
 });
}
