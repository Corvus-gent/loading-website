import {test,expect} from '@playwright/test';
import {createClient} from 'redis';
import {createSFHandler} from '../api/_sf.js';
import {sfStore} from '../api/_sf-store.js';
import {SF_END} from '../js/sf-trip.js';
let client,redis,now,store,handler,mail,owner,failMail;
test.beforeAll(async()=>{client=createClient({url:'redis://127.0.0.1:16380/8',socket:{reconnectStrategy:false}}).on('error',()=>{});await client.connect();redis=args=>client.sendCommand(args.map(String));});
test.afterAll(async()=>{await client.flushDb();await client.disconnect();});
test.beforeEach(async()=>{
 await client.flushDb();now=Date.parse('2026-11-04T12:00:00Z');mail=[];owner=null;failMail=false;
 store=sfStore({redis,now:()=>now,mailKey:()=> 'test-only',fetcher:async(url,options)=>{mail.push(JSON.parse(options.body));return new Response('{}',{status:failMail?503:200});}});
 handler=createSFHandler({redis,now:()=>now,store,ready:()=>true,session:async()=>owner?{email:owner}:null,query:async()=>[['sf_note_seen',8],['sf_note_open',6],['$pageview',5]],analyticsReady:()=>true,bits:6});
});
async function setup(page,{date='2026-11-04T12:00:00Z',events=[],reduced=false}={}){
 const errors=[],requests=[];await page.clock.install({time:new Date(date)});if(reduced)await page.emulateMedia({reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{window.sfCaptured=[];window.posthog={capture:(event,props)=>window.sfCaptured.push({event,props})};});
 await page.route('**/sf.json',r=>r.fulfill({json:{events}}));
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
  if(u.pathname==='/api/stats')return route.fulfill({json:{page:'private',day:u.searchParams.get('day'),viewer:owner,state:owner?'ready':'login',data:owner?{}:null}});
  if(u.pathname==='/api/auth')return route.fulfill({json:{email:owner}});
  if(u.pathname==='/api/x-stats')return route.fulfill({json:{ready:false}});
  return route.fulfill({json:{}});
 });return {errors,requests};
}
async function fill(page){await page.locator('[name=name]').fill('test visitor');await page.locator('[name=contact]').fill('visitor@example.test');await page.locator('[name=what]').fill('building a small thing');await page.locator('[name=lets][value=coffee]').check();await page.locator('[name=where]').fill('mission');await page.locator('[name=message]').fill('coffee and a walk?');}
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
test('form uses real proof worker and handler; success sends one mocked email',async({page})=>{
 const {errors,requests}=await setup(page);await page.goto('/sf/');await expect(page.locator('#sf-state')).toHaveText('lands in 2 days');expect(requests.some(x=>x.includes('/api/sf'))).toBe(false);await expect(page.locator('#sf-events')).toBeHidden();
 await fill(page);await page.clock.runFor(3200);await page.getByRole('button',{name:'send the crow',exact:true}).click();await expect(page.locator('#sf-success')).toBeVisible();await expect(page.locator('#sf-success')).toHaveClass(/sent/);await expect(page.locator('#sf-form')).toBeHidden();expect(mail).toHaveLength(1);expect(mail[0].reply_to).toBe('visitor@example.test');expect(mail[0].subject).toBe('🐦 sf: test visitor wants to coffee');expect(mail[0].text).toContain('coffee and a walk?');expect(await client.zCard('sf:leads')).toBe(1);expect(errors).toEqual([]);
 const names=await page.evaluate(()=>sfCaptured.map(e=>e.event));expect(names).toContain('sf_form_start');expect(names).toContain('sf_form_submit');
});
test('validation, honeypot rejection and 1-minute timer are visible',async({page})=>{
 await setup(page);await page.goto('/sf/');await page.getByRole('button',{name:'send the crow',exact:true}).click();expect(mail).toHaveLength(0);await fill(page);await page.clock.runFor(3200);
 await page.locator('[name=website]').evaluate(el=>el.value='bot');await page.getByRole('button',{name:'send the crow',exact:true}).click();await expect(page.locator('#sf-status')).toContainText('check the field limits');expect(mail).toHaveLength(0);
 await page.locator('[name=website]').evaluate(el=>el.value='');await page.route('**/api/sf',async route=>{if(route.request().postDataJSON()?.action==='challenge')return route.fallback();return route.fulfill({status:429,json:{error:'rate_limited',retryAfter:60}});});
 await page.getByRole('button',{name:'send the crow',exact:true}).click();await page.clock.runFor(3200);await expect(page.locator('#sf-status')).toContainText('1:00');await expect(page.locator('#sf-send')).toBeDisabled();await page.clock.runFor(61000);await expect(page.locator('#sf-send')).toBeEnabled();
});
test('during and after trip state uses Pacific days',async({page})=>{
 await setup(page,{date:'2026-11-07T07:59:00Z'});await page.goto('/sf/');await expect(page.locator('#sf-state')).toHaveText('in sf right now, day 1 of 10');await page.clock.runFor(61000);await expect(page.locator('#sf-state')).toHaveText('in sf right now, day 2 of 10');
 await page.clock.fastForward(SF_END-Date.parse('2026-11-07T08:00:01Z')+1000);await expect(page.locator('#sf-form')).toBeHidden();await expect(page.locator('#sf-state a')).toHaveAttribute('href','/call/');
});
test('360px form, chips and all seven languages fit; safe event links only',async({page})=>{
 await page.setViewportSize({width:360,height:800});const {errors}=await setup(page,{events:[{date:'2026-11-07',name:'a real meetup',url:'https://example.com/meetup'},{date:'2026-11-08',name:'bad',url:'javascript:alert(1)'}]});await page.goto('/sf/');await expect(page.locator('#sf-events li')).toHaveCount(1);
 for(const lang of ['nl','es','fr','pt','de','zh','en']){await page.locator('#lang-switcher a').filter({hasText:new RegExp('^'+({zh:'中文'}[lang]||lang.toUpperCase())+'$')}).click();await expect(page.locator('html')).toHaveAttribute('lang',lang);expect(await page.locator('h1').innerText()).not.toContain('sf.headline');const strings=(await import('../js/locales/'+lang+'.js')).default;await expect(page.locator('.sf-who')).toHaveText(strings['sf.who']);await expect(page.locator('[name=thing]')).toHaveAttribute('placeholder',strings['sf.thingHint']);await expect(page.locator('#sf-lets input')).toHaveCount(13);await expect(page.locator('[name=lets][value=studio] + span')).toHaveText(strings['sf.studio']);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.locator('[name=when][value="2026-11-07"]').check();await expect(page.locator('[name=when][value=anytime]')).not.toBeChecked();await page.locator('[name=when][value=anytime]').check();await expect(page.locator('[name=when][value="2026-11-07"]')).not.toBeChecked();expect(errors).toEqual([]);await page.screenshot({path:'test-results/sf-mobile.png',fullPage:true});
});
test('owner dashboard shows funnel, toggles done without extending retention and retries email',async({page})=>{
 owner='gabriel@corvus.gent';const [code,id]=await store.save({name:'a visitor',contact:'@visitor',what:'builder',lets:['walk'],when:['anytime'],where:'mission',message:'<script>bad()</script>'},{voter:'private-fixture',ip:'private-fixture',requestId:'fixture'});expect(Number(code)).toBe(201);const ttl=await client.pTTL('sf:lead:'+id);
 const {errors}=await setup(page);await page.goto('/stats/private/');await page.locator('#sf-leads').scrollIntoViewIfNeeded();await expect(page.locator('#sf-leads')).toContainText('a visitor');await expect(page.locator('#sf-leads')).toContainText('<script>bad()</script>');await page.getByRole('checkbox',{name:'mark a visitor done'}).check();await expect(page.getByRole('checkbox',{name:'mark a visitor done'})).toBeChecked();expect(await client.pTTL('sf:lead:'+id)).toBeLessThanOrEqual(ttl);await page.getByRole('button',{name:'retry email'}).click();await expect(page.locator('#sf-leads')).toContainText('sent');expect(mail).toHaveLength(1);expect(errors).toEqual([]);
});
test('360px note and card leave realm entry clear and close with the cross',async({page})=>{
 await page.setViewportSize({width:360,height:740});await setup(page,{reduced:true});await page.goto('/');await page.clock.runFor(3100);const box=await page.locator('.sf-flyer').boundingBox(),entry=await page.locator('.realm-enter').boundingBox();expect(box.y+box.height).toBeLessThan(entry.y);await page.locator('.sf-flyer').click();await expect(page.locator('.sf-note-card')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const card=await page.locator('.sf-note-card').boundingBox();expect(card.y+card.height<=entry.y||card.y>=entry.y+entry.height).toBe(true);await page.screenshot({path:'test-results/sf-note-mobile.png'});await page.locator('.sf-note-close').click();await expect(page.locator('.sf-note-card')).not.toBeVisible();
});

test('360px: all 13 activities are multi-select, optional thing reaches mocked Resend',async({page})=>{
 await page.setViewportSize({width:360,height:800});const {errors}=await setup(page);await page.goto('/sf/');await fill(page);
 const thing=page.locator('[name=thing]');await expect(thing).not.toHaveAttribute('required','');await expect(thing).toHaveAttribute('maxlength','60');await thing.fill('rapper');
 const ids=['coffee','walk','surf','bjj','skate','boulder','hike','studio','thrift','hackathon','demo','intro','other'];
 for(const id of ids)await page.locator(`[name=lets][value=${id}]`).check();
 await expect(page.locator('#sf-lets input:checked')).toHaveCount(13);await page.locator('[name=lets][value=skate]').uncheck();await expect(page.locator('#sf-lets input:checked')).toHaveCount(12);await page.locator('[name=lets][value=skate]').check();
 await page.clock.runFor(3200);await page.locator('#sf-send').click();await expect(page.locator('#sf-success')).toBeVisible();
 expect(mail).toHaveLength(1);expect(mail[0].subject).toBe('🐦 sf: test visitor (rapper) wants to coffee, walk, surf, open mat (bjj/mma), skate, boulder, hike, studio session / cypher, thrift & fashion, hackathon, demo, intro to someone, other');expect(mail[0].text).toContain('your thing: rapper');
 const id=(await client.zRange('sf:leads',0,0))[0];expect(JSON.parse(await client.get('sf:lead:'+id)).thing).toBe('rapper');expect(errors).toEqual([]);
});
test('private filters compose across pages and can be cleared',async({page})=>{
 owner='gabriel@corvus.gent';
 for(let i=0;i<52;i++){now++;const record={name:i===0?'older artist':i===1?'studio guest':'coffee guest '+i,contact:'@visitor',what:'',lets:i<2?['studio']:['coffee'],when:['anytime'],where:'',message:''};if(i===0)record.thing='Rapper';await store.save(record,{voter:'filter-'+i,ip:'filter-'+i,requestId:'filter-'+i});}
 const {errors}=await setup(page);await page.goto('/stats/private/');const root=page.locator('#sf-leads');await root.scrollIntoViewIfNeeded();await expect(root).toContainText('52 leads');await expect(root.locator('table')).not.toContainText('older artist');
 await root.getByRole('combobox',{name:'filter by activity',exact:true}).selectOption('studio');await root.getByLabel('filter by your thing',{exact:true}).fill('RAP');await root.getByRole('button',{name:'filter',exact:true}).click();await expect(root).toContainText('1 leads');await expect(root.locator('table')).toContainText('older artist');await expect(root.locator('table')).toContainText('Rapper');await expect(root.getByRole('columnheader',{name:'your thing',exact:true})).toBeVisible();
 await root.getByLabel('filter by your thing',{exact:true}).fill('');await root.getByRole('button',{name:'filter',exact:true}).click();await expect(root).toContainText('2 leads');await expect(root.locator('table')).toContainText('studio guest');
 await root.getByRole('combobox',{name:'filter by activity',exact:true}).selectOption('coffee');await root.getByLabel('filter by your thing',{exact:true}).fill('rapper');await root.getByRole('button',{name:'filter',exact:true}).click();await expect(root).toContainText('0 leads');
 await root.getByRole('combobox',{name:'filter by activity',exact:true}).selectOption('');await root.getByLabel('filter by your thing',{exact:true}).fill('');await root.getByRole('button',{name:'filter',exact:true}).click();await expect(root).toContainText('52 leads');expect(errors).toEqual([]);
});
