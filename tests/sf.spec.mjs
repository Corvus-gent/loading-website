import {test,expect} from '@playwright/test';
import {createClient} from 'redis';
import {createSFHandler} from '../api/_sf.js';
import {sfStore} from '../api/_sf-store.js';
let client,redis,now,store,handler,mail,owner,failMail;
test.beforeAll(async()=>{client=createClient({url:'redis://127.0.0.1:16380/8',socket:{reconnectStrategy:false}}).on('error',()=>{});await client.connect();redis=args=>client.sendCommand(args.map(String));});
test.afterAll(async()=>{await client.flushDb();await client.disconnect();});
test.beforeEach(async()=>{
 await client.flushDb();now=Date.parse('2026-11-04T12:00:00Z');mail=[];owner=null;failMail=false;
 store=sfStore({redis,now:()=>now,mailKey:()=> 'test-only',fetcher:async(url,options)=>{mail.push(JSON.parse(options.body));return new Response('{}',{status:failMail?503:200});}});
 handler=createSFHandler({redis,now:()=>now,store,ready:()=>true,session:async()=>owner?{email:owner}:null,query:async()=>[['sf_note_seen',8],['sf_note_open',6],['$pageview',5]],analyticsReady:()=>true,bits:6});
});
async function setup(page,{date='2026-11-04T12:00:00Z',reduced=false}={}){
 const errors=[],requests=[];await page.clock.install({time:new Date(date)});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{window.sfCaptured=[];window.posthog={capture:(event,props)=>window.sfCaptured.push({event,props})};});
 await page.route('**/api/**',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.pathname==='/api/sf'){
   now=await page.evaluate(()=>Date.now());const headers={};let code=200,data;
   const response={setHeader:(k,v)=>headers[k]=v,status:n=>{code=n;return response;},json:v=>{data=v;},end:()=>{}};
   const body=r.postDataJSON()||{};
   // Local HTTP harness maps its trusted origin to production; origin rejection
   // itself is exercised against the real handler in sf-data.mjs.
   await handler({method:r.method(),body,query:Object.fromEntries(u.searchParams),headers:{...r.headers(),origin:'https://corvus.gent','x-forwarded-for':'198.51.100.101'}},response);
   return route.fulfill({status:code,headers,json:data??{}});
  }
  if(u.pathname==='/api/auth')return route.fulfill({json:{email:owner}});
  if(u.pathname==='/api/x-stats')return route.fulfill({json:{ready:false}});
  return route.fulfill({json:{}});
 });return {errors,requests};
}
test('normal crow arrives once, opens its note, links to sf and leaves entry clear',async({page})=>{
 const {errors}=await setup(page);await page.goto('/');await page.clock.runFor(3100);const flyer=page.locator('.sf-flyer');await expect(flyer).toHaveCount(1);await page.waitForTimeout(700);
 const [crow,entry]=await Promise.all([flyer.boundingBox(),page.locator('.realm-enter').boundingBox()]);expect(crow.y+crow.height).toBeLessThan(entry.y);
 await flyer.click({force:true});await expect(page.locator('.sf-note-card')).toBeVisible();await expect(page.locator('.sf-note-card a')).toHaveAttribute('href','/sf/?lang=en');await page.keyboard.press('Escape');await expect(page.locator('.sf-note-card')).not.toBeVisible();
 await page.reload();await page.clock.runFor(3200);await expect(page.locator('.sf-flyer')).toHaveCount(0);expect(errors).toEqual([]);
});
test('reduced motion gives a stationary note; outside tap and close work',async({page})=>{
 await setup(page,{reduced:true});await page.goto('/');await page.clock.runFor(3100);const flyer=page.locator('.sf-flyer');await expect(flyer).toHaveClass(/resting/);expect(await flyer.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await flyer.click();await expect(page.locator('.sf-note-card')).toBeVisible();await page.mouse.click(5,5);await expect(page.locator('.sf-note-card')).not.toBeVisible();
});
test('note expires at Pacific midnight, including an already-open page',async({page})=>{
 await setup(page,{date:'2026-11-16T07:59:50Z',reduced:true});await page.goto('/');await page.clock.runFor(3100);await page.locator('.sf-flyer').click();await expect(page.locator('.sf-note-card')).toBeVisible();await page.clock.runFor(7000);await expect(page.locator('.sf-note-card')).toHaveCount(0);await expect(page.locator('.sf-flyer')).toHaveCount(0);
 await page.reload();await page.clock.runFor(3100);await expect(page.locator('.sf-flyer')).toHaveCount(0);
});
for(const [date,line]of [['2026-11-05T12:00:00Z','packing a lantern'],['2026-11-06T12:00:00Z','somewhere over the atlantic'],['2026-11-07T12:00:00Z','looking for an honest founder'],['2026-11-15T12:00:00Z','looking for an honest founder'],['2026-11-16T12:00:00Z','the lantern saw things'],['2026-11-17T12:00:00Z','Gent']])test('hidden location: '+date,async({page})=>{
 const {errors}=await setup(page,{date});await page.route('**/location.json',r=>r.fulfill({json:{city:'Gent'}}));await page.goto('/');await expect(page.locator('#loc')).not.toHaveClass(/show/);await page.locator('#hero').click();await expect(page.locator('#loc')).toHaveClass(/show/);await expect(page.locator('#city')).toContainText(line);expect(errors).toEqual([]);
});
for(const [date,shown]of [['2026-11-06T07:59:59Z',false],['2026-11-06T08:00:00Z',true],['2026-11-16T08:00:00Z',false]])test('realm trip visibility: '+date,async({page})=>{await setup(page,{date});await page.goto('/realm/');await expect(page.locator('#sf-realm')).toBeVisible({visible:shown});});
test('owner dashboard shows funnel, toggles done without extending retention and retries email',async({page})=>{
 owner='gabriel@corvus.gent';const [code,id]=await store.save({name:'a visitor',contact:'@visitor',what:'builder',lets:['walk'],when:['anytime'],where:'mission',message:'<script>bad()</script>'},{voter:'private-fixture',ip:'private-fixture',requestId:'fixture'});expect(Number(code)).toBe(201);const ttl=await client.pTTL('sf:lead:'+id);
 const {errors}=await setup(page);await page.goto('/stats/private/');await expect(page.locator('#sf-leads')).toContainText('a visitor');await expect(page.locator('#sf-leads')).toContainText('<script>bad()</script>');await page.getByRole('checkbox',{name:'mark a visitor done'}).check();await expect(page.getByRole('checkbox',{name:'mark a visitor done'})).toBeChecked();expect(await client.pTTL('sf:lead:'+id)).toBeLessThanOrEqual(ttl);await page.getByRole('button',{name:'retry email'}).click();await expect(page.locator('#sf-leads')).toContainText('sent');expect(mail).toHaveLength(1);expect(errors).toEqual([]);
});
test('360px note and card leave realm entry clear and close with the cross',async({page})=>{
 await page.setViewportSize({width:360,height:740});await setup(page,{reduced:true});await page.goto('/');await page.clock.runFor(3100);const box=await page.locator('.sf-flyer').boundingBox(),entry=await page.locator('.realm-enter').boundingBox();expect(box.y+box.height).toBeLessThan(entry.y);await page.locator('.sf-flyer').click();await expect(page.locator('.sf-note-card')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const card=await page.locator('.sf-note-card').boundingBox();expect(card.y+card.height<=entry.y||card.y>=entry.y+entry.height).toBe(true);await page.screenshot({path:'test-results/sf-note-mobile.png'});await page.locator('.sf-note-close').click();await expect(page.locator('.sf-note-card')).not.toBeVisible();
});
