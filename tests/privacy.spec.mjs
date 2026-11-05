import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {PRIVACY_VERSION,strings} from '../js/privacy-strings.js';
const tracks=JSON.parse(fs.readFileSync('music.json')).tracks;
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels'}).format(new Date());
const stats={day,visitors:3,total:3,hours:[],countries:[{c:'BE',n:3}],sources:[],pages:[],browsers:[],cli:{day:{},all:{}},feathers:0,hunters:0,terminal:[],updated:new Date().toISOString()};
const game={day,n:1,type:'babel',rotation:['babel'],tomorrow:'borders',hint:['hello'],options:['English','Dutch'],history:[],done:false,solved:false,max:6};
const spotify=/spotify\.com|scdn\.co|spotifycdn\.com|spotifycdn\.net/;
async function setup(page,{realSpotify=false}={}){
 const requests=[],events=[],errors=[];
 page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
  // The real SDK intentionally excludes WebDriver; simulate a normal visitor only
  // in this owned-site test, with all ingestion requests intercepted below.
  Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false});
  Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>undefined});
 });
 await page.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.hostname==='eu.i.posthog.com'){
   if(r.method()==='POST'){
    let body=r.postDataBuffer();
    if(body?.[0]===31&&body?.[1]===139)body=gunzipSync(body);
    let value=body?.toString()||'';
    try{if(value.startsWith('data='))value=Buffer.from(new URLSearchParams(value).get('data'),'base64').toString();const data=JSON.parse(value);events.push(...(Array.isArray(data)?data:data.batch||[data]));}catch{}
   }
   return route.fulfill({contentType:'application/json',body:'{}'});
  }
  if(realSpotify&&spotify.test(u.hostname))return route.continue();
  if(spotify.test(u.hostname))return route.fulfill({contentType:u.pathname.includes('iframe-api')?'text/javascript':'text/html',body:u.pathname.includes('iframe-api')?`window.onSpotifyIframeApiReady({createController(host,options,ready){const frame=document.createElement('iframe');frame.src='https://open.spotify.com/embed/track/test';host.append(frame);ready({play(){},pause(){},resume(){},loadUri(){},destroy(){frame.remove()},addListener(event,callback){if(event==='ready')callback()}})}});`:'<p>playback fixture</p>'});
  if(!['127.0.0.1','localhost','corvus.gent','stats.corvus.gent'].includes(u.hostname))return route.fulfill({body:'',contentType:'text/plain'});
  if(u.pathname==='/api/geo')return route.fulfill({json:u.searchParams.has('country')?{countryCode:'BE'}:u.searchParams.has('tiles')?{available:false}:{cities:[{countryCode:'BE',country:'Belgium',region:'Flanders',city:'Ghent',lat:51.1,lng:3.7,visitors:3}]}});
  if(u.pathname==='/api/music')return route.fulfill({headers:u.searchParams.has('public')?{}:{'Set-Cookie':'mvid=fixture.signature; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict'},json:{tracks,suggestions:[],votes:{},mine:[],poll:{spotify:0,apple:0},storage:true}});
  if(u.pathname.startsWith('/api/game'))return route.fulfill({headers:{'Set-Cookie':'mvid=fixture.signature; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict'},json:r.method()==='POST'?{...game,done:true,solved:true,history:[{guess:'English',feedback:'🟩'}],answer:'English',streak:1}:game});
  if(u.pathname==='/api/x-stats')return route.fulfill({json:{ready:false}});
  if(u.pathname==='/api/auth')return route.fulfill({json:{email:null}});
  if(u.pathname==='/api/stats'){
   const section=u.searchParams.get('section');
   return route.fulfill({json:section==='outbound'?{hosts:[]}:section==='pidgy'?{today:{visitors:3,clickers:0,clicks:0},all:{visitors:3,clickers:0,clicks:0},signups:null,scene:0,variant:0}:section==='music'?{genres:[]}:section==='games'?{today:{played:0},all:{played:0},best:0,types:[]}:stats});
  }
  if(['corvus.gent','stats.corvus.gent'].includes(u.hostname)){let path=u.pathname;if(u.hostname==='stats.corvus.gent'){if(path==='/')path='/stats/';else if(/^\/(pidgy|games|map|music|hunt|private|x)\/?$/.test(path))path='/stats'+path.replace(/\/$/,'')+'/';}const local=await page.request.get('http://127.0.0.1:4176'+path+u.search);return route.fulfill({response:local});}
  return route.continue();
 });
 return {requests,events,errors};
}
test.use({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'});
for(const path of ['/','/call/','/music/','/games/','/stats/','/stats/map/','/stats/games/','/stats/music/','/stats/pidgy/','/stats/hunt/','/stats/x/','/sf/']){
 test(`new visitor ${path}: no Spotify, no tracking cookies or remote libraries`,async({page,context})=>{
  const {requests,events,errors}=await setup(page);await page.goto(path);
  await page.waitForTimeout(1700);
  expect(events).toEqual([]);expect(requests.some(url=>url.includes('posthog'))).toBe(false);
  expect(requests.some(url=>url.includes('/api/geo?country'))).toBe(false);
  expect(requests.filter(url=>spotify.test(new URL(url).hostname))).toEqual([]);
  const thirdParty=requests.map(url=>new URL(url).hostname).filter(host=>!['127.0.0.1'].includes(host));
  expect(thirdParty).toEqual([]);
  expect((await context.cookies()).map(c=>c.name).filter(name=>!['mvid','vid','sess'].includes(name))).toEqual([]);
  for(const cookie of await context.cookies()){expect(cookie.httpOnly).toBe(true);expect(cookie.secure).toBe(true);expect(cookie.sameSite).toBe('Strict');}
  const storage=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}));
  expect(storage.local.some(key=>/^ph_|posthog/i.test(key))).toBe(false);expect(storage.session.filter(key=>key!=='sf-note:2026-11')).toEqual([]);
  expect(errors).toEqual([]);
 });
}
for(const path of ['/call/','/music/'])test(`Spotify loads only after play on ${path}`,async({page})=>{
 const {requests,errors}=await setup(page);await page.goto(path);await expect(page.locator('[data-spotify-notice]')).toHaveText(strings.en.spotify);
 expect(requests.some(url=>spotify.test(new URL(url).hostname))).toBe(false);
 if(path==='/call/')await page.locator('#vinyl').click();else await page.locator('[data-play]').filter({hasText:'Dance With the Devil'}).click();
 await expect.poll(()=>requests.some(url=>url.includes('spotify.com/embed/iframe-api'))).toBe(true);
 await expect(page.locator('iframe[src*="open.spotify.com"]')).toHaveCount(1);expect(errors).toEqual([]);
});
test('sensitive input and arbitrary campaign values never enter actual SDK payloads',async({page})=>{
 const {events}=await setup(page);await page.goto('/call/?email=visitor@example.test&token=secret&utm_source=linkedin&utm_medium=post&utm_campaign=gabe-important-call');
 await page.locator('#privacy-notice [data-allow]').click();
 await expect.poll(()=>events.length,{timeout:12000}).toBeGreaterThan(0);
 await page.evaluate(()=>{
  const input=document.createElement('input');input.value='private@example.test';document.body.append(input);input.dispatchEvent(new Event('change',{bubbles:true}));
  posthog.capture('site_search',{q:'private@example.test'});
  posthog.capture('terminal_command',{command:'private@example.test'});
  posthog.capture('link_click',{link_href:'mailto:private@example.test',page:'/someone@example.test',link_text:'private name'});
  posthog.capture('forbidden_event',{email:'private@example.test'});
 });
 await expect.poll(()=>events.filter(e=>e.event==='terminal_command').length,{timeout:12000}).toBe(1);
 const payload=JSON.stringify(events);expect(payload).not.toMatch(/example\.test|private name|token=|secret|forbidden_event/);
 const view=events.find(e=>e.event==='$pageview');expect(view.properties.utm_source).toBe('linkedin');expect(view.properties.utm_campaign).toBe('gabe-important-call');expect(view.properties.$current_url).not.toContain('?');
 expect(events.find(e=>e.event==='terminal_command').properties.command).toBe('unknown');
});
test('private dashboard and music admin send no analytics and show no notice',async({page})=>{
 const {requests}=await setup(page);
 for(const path of ['/stats/private/','/music/admin/']){await page.goto(path);await page.waitForTimeout(1700);await expect(page.locator('#privacy-notice')).toHaveCount(0);await expect(page.locator('[data-privacy-link]')).toHaveCount(1);}
 expect(requests.some(url=>url.includes('posthog'))).toBe(false);
});
test('privacy signal suppresses SDK loading',async({page})=>{
 const {requests}=await setup(page);await page.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));await page.goto('/');await page.waitForTimeout(1700);expect(requests.some(url=>url.includes('posthog'))).toBe(false);
});
test('notice fades in, remembers refusal by version and stays keyboard accessible',async({page})=>{
 await setup(page);await page.goto('/call/');await expect(page.locator('#privacy-notice')).toBeHidden();await expect(page.locator('#privacy-notice')).toBeVisible({timeout:4000});
 await page.locator('#privacy-notice [data-deny]').focus();await page.keyboard.press('Enter');await expect(page.locator('#privacy-notice')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('analytics-consent')))).toMatchObject({choice:'deny',version:PRIVACY_VERSION});
 await page.reload();await page.waitForTimeout(1700);await expect(page.locator('#privacy-notice')).toHaveCount(0);
 await page.evaluate(()=>localStorage.setItem('analytics-consent',JSON.stringify({choice:'allow',version:'older-version',expires:Date.now()+86400000})));await page.reload();await expect(page.locator('#privacy-notice')).toBeVisible({timeout:4000});
});
test('notice survives unavailable localStorage and reduced motion',async({page})=>{
 await setup(page);await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
 await page.goto('/call/');await expect(page.locator('#privacy-notice')).toBeVisible({timeout:4000});
 expect(await page.locator('#privacy-notice').evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');await page.locator('#privacy-notice [data-deny]').click();await expect(page.locator('#privacy-notice')).toHaveCount(0);
});
test('notice hides throughout gameplay and returns on completion',async({page})=>{
 await setup(page);await page.goto('/games/');await page.getByRole('button',{name:'let’s play'}).click();await page.waitForTimeout(1700);await expect(page.locator('#privacy-notice')).toBeHidden();
 await page.getByLabel('your guess',{exact:true}).fill('English');await page.locator('#submit').click();await expect(page.locator('#result')).toBeVisible();await expect(page.locator('#privacy-notice')).toBeVisible();
});
test('privacy page and Spotify disclosure support all seven languages',async({page})=>{
 const {errors}=await setup(page);
 for(const lang of Object.keys(strings)){await page.goto(`/privacy/?lang=${lang}`);await expect(page.locator('html')).toHaveAttribute('lang',lang);await expect(page.locator('#privacy-sections section')).toHaveCount(9);await expect(page.locator('#privacy-providers a')).toHaveCount(11);await expect(page.locator('#who')).toContainText('Francisco Gabriel Van Langenhove');await expect(page.locator('#privacy-title')).not.toBeEmpty();await expect(page.locator('#sf')).toContainText('60');
  await page.goto(`/call/?lang=${lang}`);await expect(page.locator('[data-spotify-notice]')).toHaveText(strings[lang].spotify);
 }
 expect(errors).toEqual([]);
});
test('mobile notice fits and does not cover the music player buttons',async({page})=>{
 await page.setViewportSize({width:360,height:740});await setup(page);await page.goto('/music/');await expect(page.locator('#privacy-notice')).toBeVisible({timeout:4000});
 const layout=await page.evaluate(()=>{const n=document.getElementById('privacy-notice'),r=n.getBoundingClientRect();return {left:r.left,right:r.right,lines:(r.height-6)/parseFloat(getComputedStyle(n).lineHeight),overflow:document.documentElement.scrollWidth>innerWidth,overlaps:[...document.querySelectorAll('button,a')].filter(e=>!n.contains(e)).some(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&b.left<r.right&&b.right>r.left&&b.top<r.bottom&&Math.min(b.bottom,e.closest('.now-playing')?innerHeight:document.body.getBoundingClientRect().bottom)>r.top;})};});
 expect(layout.left).toBeGreaterThanOrEqual(0);expect(layout.right).toBeLessThanOrEqual(360);expect(layout.lines).toBeLessThanOrEqual(2.2);expect(layout.overflow).toBe(false);expect(layout.overlaps).toBe(false);
 await page.screenshot({path:'test-results/privacy-mobile.png',fullPage:false});
});

test('production host paths retain safe page categories and hide the private notice',async({page})=>{
 const {events,requests}=await setup(page);await page.goto('https://corvus.gent/call/?email=private@example.test&utm_source=linkedin');
 await page.locator('#privacy-notice [data-allow]').click();
 await expect.poll(()=>events.length,{timeout:12000}).toBeGreaterThan(0);
 const view=events.find(e=>e.event==='$pageview');expect(view.properties.$pathname).toBe('/call/');expect(view.properties.$current_url).toBe('https://corvus.gent/call/');expect(view.properties.$host).toBe('corvus.gent');
 await page.goto('https://stats.corvus.gent/private');await page.waitForTimeout(1700);await expect(page.locator('#privacy-notice')).toHaveCount(0);
 expect(requests.filter(url=>spotify.test(new URL(url).hostname))).toEqual([]);
});
test('all notice translations fit within two lines on a small phone',async({page})=>{
 await setup(page);await page.setViewportSize({width:360,height:740});
 for(const lang of Object.keys(strings)){await page.goto('/call/?lang='+lang);await expect(page.locator('#privacy-notice')).toBeVisible({timeout:4000});const height=await page.locator('#privacy-notice').evaluate(e=>({height:e.getBoundingClientRect().height,line:parseFloat(getComputedStyle(e).lineHeight)}));expect(height.height,lang).toBeLessThanOrEqual(height.line*2+8);}
});
test('dismissing notice preserves reading position',async({page})=>{
 await setup(page);await page.goto('/privacy/');await expect(page.locator('#privacy-notice')).toBeVisible({timeout:4000});
 await page.locator('#rights').scrollIntoViewIfNeeded();const before=(await page.locator('#rights').boundingBox()).y;await page.locator('#privacy-notice [data-deny]').click();const after=(await page.locator('#rights').boundingBox()).y;expect(Math.abs(after-before)).toBeLessThan(3);
});
for(const path of ['/call/','/music/'])test(`live Spotify integration ${path}`,async({page})=>{
 test.skip(!process.env.LIVE_SPOTIFY,'opt-in live third-party network check');
 const {requests}=await setup(page,{realSpotify:true});await page.goto(path);expect(requests.some(url=>spotify.test(new URL(url).hostname))).toBe(false);
 const loaded=page.waitForResponse(r=>/open\.spotify\.com\/embed\/track\//.test(r.url()),{timeout:20000});
 if(path==='/call/')await page.locator('#vinyl').click();else await page.locator('[data-play]').filter({hasText:'Dance With the Devil'}).click();
 await expect(page.locator('iframe[src*="open.spotify.com/embed/"]')).toHaveCount(1,{timeout:20000});
 await expect.poll(()=>requests.some(url=>url.includes('spotify.com/embed/iframe-api'))).toBe(true);
 const response=await loaded;expect(response.status()).toBe(200);
 await page.waitForTimeout(1000);
 const cookies=(await page.context().cookies()).filter(c=>spotify.test(c.domain)).map(({name,domain,path,secure,httpOnly,sameSite,expires})=>({name,domain,path,secure,httpOnly,sameSite,lifetimeSeconds:expires<0?'session':Math.round(expires-Date.now()/1000)}));
 fs.writeFileSync('test-results/spotify-cookies-'+(path.includes('music')?'music':'call')+'.json',JSON.stringify(cookies,null,2));
});


test('allow starts the real cookieless SDK; withdrawal stops capture and survives reload',async({page,context})=>{
 const {events,requests,errors}=await setup(page);await page.goto('/privacy/');
 await expect(page.locator('#analytics-status')).toHaveText(strings.en.off);
 await page.locator('#analytics-allow').click();
 await expect.poll(()=>events.some(e=>e.event==='$pageview'),{timeout:12000}).toBe(true);
 const view=events.find(e=>e.event==='$pageview');expect(view.properties.$host).toBe('other');expect(view.properties.$cookieless_mode).toBe(true);expect(view.properties.$process_person_profile).toBe(false);expect(view.properties.corvus_country_code).toBe('BE');
 for(const key of ['$session_id','$ip','$screen_width','$set'])expect(view.properties).not.toHaveProperty(key);
 expect((await context.cookies()).map(c=>c.name)).toEqual([]);
 expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual(['analytics-consent']);
 await page.locator('#analytics-deny').click();await expect(page.locator('#analytics-status')).toHaveText(strings.en.off);
 const before=events.length;await page.evaluate(()=>posthog.capture('site_search'));await page.waitForTimeout(3500);expect(events.length).toBe(before);
 const beforeRequests=requests.filter(u=>u.includes('posthog')).length;await page.reload();await page.waitForTimeout(1700);expect(requests.filter(u=>u.includes('posthog')).length).toBe(beforeRequests);
 expect(errors).toEqual([]);
});
test('expired consent and previous dismissal never opt a visitor in',async({page})=>{
 const {requests}=await setup(page);await page.goto('/privacy/');
 await page.evaluate(version=>{localStorage.setItem('analytics-consent',JSON.stringify({version,choice:'allow',expires:Date.now()-1}));localStorage.setItem('privacy-notice',version);},PRIVACY_VERSION);
 await page.reload();await expect(page.locator('#privacy-notice')).toBeVisible({timeout:4000});expect(requests.some(u=>u.includes('posthog'))).toBe(false);
});
test('another tab withdrawing consent stops an already active tab',async({page,context})=>{
 const {events}=await setup(page);await page.goto('/privacy/');await page.locator('#analytics-allow').click();await expect.poll(()=>events.length).toBeGreaterThan(0);
 const other=await context.newPage();await setup(other);await other.goto('/privacy/');await other.locator('#analytics-deny').click();
 await expect(page.locator('#analytics-status')).toHaveText(strings.en.off);const before=events.length;await page.evaluate(()=>posthog.capture('site_search'));await page.waitForTimeout(1700);expect(events.length).toBe(before);await other.close();
});

test('stats privacy link keeps withdrawal on the same origin',async({page})=>{
 const {events}=await setup(page);await page.goto('https://stats.corvus.gent/');await page.locator('#privacy-notice [data-allow]').click();await expect.poll(()=>events.length).toBeGreaterThan(0);
 await page.locator('[data-privacy-link]').click();await expect(page).toHaveURL('https://stats.corvus.gent/privacy/');await expect(page.locator('#analytics-status')).toHaveText(strings.en.on);await page.locator('#analytics-deny').click();await expect(page.locator('#analytics-status')).toHaveText(strings.en.off);
});

test('withdrawal works even if browser storage becomes read-only',async({page})=>{
 const {events}=await setup(page);await page.goto('/privacy/');await page.locator('#analytics-allow').click();await expect.poll(()=>events.length).toBeGreaterThan(0);
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('read only')};});await page.locator('#analytics-deny').click();await expect(page.locator('#analytics-status')).toHaveText(strings.en.off);
 const count=events.length;await page.evaluate(()=>posthog.capture('site_search'));await page.waitForTimeout(1000);expect(events.length).toBe(count);
});

test('language vote preference expires and is only saved after success',async({page})=>{
 await setup(page);let fail=true;
 await page.route('**/api/vote',route=>route.fulfill({status:route.request().method()==='POST'&&fail?429:200,json:{votes:{ja:2},challenge:{id:'fixture',salt:'test',bits:0},...(fail?{error:'try later'}:{})}}));
 await page.goto('/languages/');await page.locator('#sug-lang').selectOption('ja');await expect(page.locator('#sug-lang')).toBeEnabled();expect(await page.evaluate(()=>localStorage.getItem('voted_lang'))).toBeNull();
 fail=false;await page.locator('#sug-lang').selectOption('ko');await expect(page.locator('#sug-status')).toHaveText('vote counted.');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('voted_lang')));expect(saved.value).toBe('ko');expect(saved.expires).toBeGreaterThan(Date.now());expect(saved.expires).toBeLessThanOrEqual(Date.now()+365*86400000);
 await page.evaluate(()=>localStorage.setItem('voted_lang',JSON.stringify({value:'ko',expires:Date.now()-1})));await page.reload();await expect(page.locator('#sug-lang')).toBeEnabled();expect(await page.evaluate(()=>localStorage.getItem('voted_lang'))).toBeNull();
});


test('X attribution keeps only approved campaigns and region-hour slots after consent',async({page})=>{
 const {events,requests,errors}=await setup(page);
 await page.route('**/api/x-stats?catalog=1',route=>route.fulfill({json:{ready:true,campaigns:['launch']}}));
 await page.goto('/call/?utm_source=x&utm_campaign=gabe-launch&utm_content=eu-09');
 await page.waitForTimeout(1700);expect(requests.some(url=>url.includes('catalog=1'))).toBe(false);
 await page.locator('#privacy-notice [data-allow]').click();await expect.poll(()=>events.some(e=>e.event==='$pageview'),{timeout:12000}).toBe(true);
 let view=events.find(e=>e.event==='$pageview');expect(view.properties.utm_campaign).toBe('gabe-launch');expect(view.properties.utm_content).toBe('eu-9');
 events.length=0;await page.goto('/call/?utm_source=x&utm_campaign=visitor-private-name&utm_content=visitor@example.test');await expect.poll(()=>events.some(e=>e.event==='$pageview'),{timeout:12000}).toBe(true);
 view=events.find(e=>e.event==='$pageview');expect(view.properties.utm_campaign).toBe('other');expect(view.properties.utm_content).toBeUndefined();expect(JSON.stringify(events)).not.toMatch(/visitor-private-name|example.test/);
 events.length=0;await page.goto('/links/gabe/x/launch?utm_content=sf-23');await expect.poll(()=>events.some(e=>e.event==='$pageview'),{timeout:12000}).toBe(true);
 view=events.find(e=>e.event==='$pageview');expect(view.properties.utm_campaign).toBe('gabe-launch');expect(view.properties.utm_content).toBe('sf-23');
 const tagged=await page.locator('a[href*="pidgy-ai.com"]').first().getAttribute('href');expect(tagged).toContain('utm_campaign=gabe-launch');expect(tagged).toContain('utm_content=sf-23');
 const go=await page.evaluate(async()=>{const {resolve}=await import('/js/go.js');return resolve('/go/x/pidgy/launch','?utm_content=sf-23');});expect(go.utm_content).toBe('sf-23');expect(go.url).toContain('utm_content=sf-23');expect(go.url).toContain('utm_campaign=gabe-launch');expect(errors).toEqual([]);
});

test('company vanity attribution survives cleanup and a delayed consent choice',async({page,context})=>{
 const {events,requests,errors}=await setup(page);
 await page.goto('/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=button&utm_extra=remove-me&ref=partner&lang=en&id=keep#arrival');
 await expect(page).toHaveURL(/\/\?lang=en&id=keep#arrival$/);
 expect(events).toEqual([]);expect(requests.some(url=>url.includes('posthog'))).toBe(false);
 await page.locator('#privacy-notice [data-allow]').click();await expect.poll(()=>events.some(e=>e.event==='$pageview'),{timeout:12000}).toBe(true);
 const view=events.find(e=>e.event==='$pageview');expect(view.properties.utm_source).toBe('linkedin');expect(view.properties.utm_medium).toBe('company-page');expect(view.properties.utm_campaign).toBe('gabe-corvus-page');expect(view.properties.utm_content).toBe('button');expect(view.properties.utm_extra).toBeUndefined();expect(view.properties.ref).toBeUndefined();
 expect(await context.cookies()).toEqual([]);expect(errors).toEqual([]);
});
test('previously allowed analytics captures company tags then leaves a clean URL',async({page})=>{
 const {events,errors}=await setup(page);
 await page.addInitScript(version=>localStorage.setItem('analytics-consent',JSON.stringify({version,choice:'allow',expires:Date.now()+86400000})),PRIVACY_VERSION);
 for(const [medium,campaign,content]of [['company-page','gabe-corvus-page','website'],['company-post','gabe-corvus-revival','']]){
  events.length=0;await page.goto(`/?utm_source=linkedin&utm_medium=${medium}&utm_campaign=${campaign}${content?'&utm_content='+content:''}`);
  await expect.poll(()=>events.some(e=>e.event==='$pageview'),{timeout:12000}).toBe(true);await expect(page).toHaveURL('http://127.0.0.1:4176/');
  const view=events.find(e=>e.event==='$pageview');expect(view.properties.utm_medium).toBe(medium);expect(view.properties.utm_campaign).toBe(campaign);if(content)expect(view.properties.utm_content).toBe(content);
 }
 expect(errors).toEqual([]);
});
test('cleanup preserves history state, functional queries and fragments on private pages',async({page})=>{
 const {events,errors}=await setup(page);
 await page.addInitScript(()=>history.replaceState({marker:'keep'},'',location.href));
 await page.goto('/stats/private/?UTM_SOURCE=linkedin&utm_custom=x&utm_custom=y&REF=partner&lang=nl&tab=login#code');
 await expect(page).toHaveURL(/\/stats\/private\/\?lang=nl&tab=login#code$/);
 expect(await page.evaluate(()=>history.state)).toEqual({marker:'keep'});expect(events).toEqual([]);expect(errors).toEqual([]);
});
test('static SF contact page makes no backend or analytics requests even with prior consent',async({page})=>{
 const {requests,events,errors}=await setup(page);
 await page.addInitScript(version=>localStorage.setItem('analytics-consent',JSON.stringify({choice:'allow',version,expires:Date.now()+86400000})),PRIVACY_VERSION);
 await page.goto('/sf/?utm_source=x&utm_campaign=gabe-sf-trip');
 await expect(page.getByRole('link',{name:'Send me an email'})).toBeVisible();
 await page.getByRole('button',{name:'Reveal the lantern inscription'}).click();
 await expect(page.locator('#inscription')).toBeVisible();
 await expect(page).toHaveURL(/\/sf\/$/);
 expect(requests.every(url=>new URL(url).origin===new URL(page.url()).origin && !new URL(url).pathname.startsWith('/api/'))).toBe(true);
 expect(events).toEqual([]);expect(errors).toEqual([]);
});
