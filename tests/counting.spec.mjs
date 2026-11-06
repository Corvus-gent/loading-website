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
 const requests=[],events=[],errors=[],hits=[],oks=[];
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
  if(u.pathname==='/api/hit'||u.pathname==='/api/notice-ok'){(u.pathname==='/api/hit'?hits:oks).push(r.postDataJSON());return route.fulfill({status:204});}
  if(u.pathname==='/api/geo')return route.fulfill({json:u.searchParams.has('country')?{countryCode:'BE'}:u.searchParams.has('tiles')?{available:false}:{cities:[{countryCode:'BE',country:'Belgium',region:'Flanders',city:'Ghent',lat:51.1,lng:3.7,visitors:3}]}});
  if(u.pathname==='/api/music')return route.fulfill({headers:u.searchParams.has('public')?{}:{'Set-Cookie':'mvid=fixture.signature; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict'},json:{tracks,suggestions:[],votes:{},mine:[],poll:{spotify:0,apple:0},storage:true}});
  if(u.pathname.startsWith('/api/game'))return route.fulfill({headers:{'Set-Cookie':'mvid=fixture.signature; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict'},json:r.method()==='POST'?{...game,done:true,solved:true,history:[{guess:'English',feedback:'🟩'}],answer:'English',streak:1}:game});
  if(u.pathname==='/api/x-stats')return route.fulfill({json:{ready:false}});
  if(u.pathname==='/api/auth')return route.fulfill({json:{email:null}});
  if(u.pathname==='/api/stats'){
   const name=u.searchParams.get('page');
   const metric={visitors:3,clicker:0,clicks:0};
   const data={pidgy:{today:metric,all:metric,signups:null,scene:0,variant:0},music:{genres:[],loved:[],suggestions:[]},games:{today:{played:0},all:{played:0},best:0,types:[]},x:{ready:false},map:{cities:[],countries:[]},coffee:{ready:false},status:{status:'unknown',checks:[]},private:null};
   return route.fulfill({json:{page:name,day:u.searchParams.get('day'),checked:new Date().toISOString(),state:name==='private'?'login':'ready',data:name in data?data[name]:stats}});
  }
  if(['corvus.gent','stats.corvus.gent'].includes(u.hostname)){let path=u.pathname;if(u.hostname==='stats.corvus.gent'){if(path==='/')path='/stats/';else if(/^\/(pidgy|games|map|music|hunt|private|x|coffee)\/?$/.test(path))path='/stats'+path.replace(/\/$/,'')+'/';}const local=await page.request.get((process.env.TEST_BASE_URL || 'http://127.0.0.1:4176')+path+u.search);return route.fulfill({response:local});}
  return route.continue();
 });
 return {requests,events,errors,hits,oks};
}
test.use({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'});

for(const path of ['/','/call/','/links/gabe','/stats/','/stats/army/'])test('default cookieless pageview '+path,async({page,context})=>{
 const {events,requests,errors}=await setup(page);await page.goto(path);await expect.poll(()=>events.filter(e=>e.event==='$pageview').length).toBe(1);
 expect(requests.filter(u=>spotify.test(new URL(u).hostname))).toEqual([]);expect(await context.cookies()).toEqual([]);
 const storage=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}));expect(storage.local.some(k=>/^ph_|posthog|sidequests:/.test(k))).toBe(false);expect(storage.session.some(k=>/^ph_|posthog|sidequests:/.test(k))).toBe(false);
 const pv=events.find(e=>e.event==='$pageview');expect(pv.properties.$cookieless_mode).toBe(true);expect(pv.properties.distinct_id).toBe('$posthog_cookieless');expect(errors).toEqual([]);
});
for(const signal of ['globalPrivacyControl','doNotTrack'])test(signal+' gets one anonymous hit and no PostHog',async({page,context})=>{
 await page.addInitScript(({signal})=>Object.defineProperty(Navigator.prototype,signal,{get:()=>signal==='globalPrivacyControl'?true:'1'}),{signal});const {events,requests,hits}=await setup(page);await page.goto('/call/');await expect.poll(()=>hits.length).toBe(1);await page.waitForTimeout(1800);expect(events).toEqual([]);expect(requests.some(u=>u.includes('posthog'))).toBe(false);expect(hits[0]).toEqual({page:'/call/',day});expect(await context.cookies()).toEqual([]);expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
});
test('ok is a once-only soldier acknowledgement, default analytics needs no click',async({page})=>{
 const {events,oks}=await setup(page);await page.goto('/call/');await expect.poll(()=>events.some(e=>e.event==='$pageview')).toBe(true);await page.locator('#privacy-notice [data-allow]').click();await expect.poll(()=>oks.length).toBe(1);await expect.poll(()=>events.filter(e=>e.event==='notice_ok').length).toBe(1);await page.reload();await page.waitForTimeout(1800);await expect(page.locator('#privacy-notice')).toHaveCount(0);expect(oks).toHaveLength(1);expect(events.filter(e=>e.event==='notice_ok')).toHaveLength(1);expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual(['privacy-choice']);
});
test('dont count me switches the next page to bare counting and preserves prior refusals',async({page})=>{
 const {events,hits}=await setup(page);await page.goto('/call/');await expect.poll(()=>events.some(e=>e.event==='$pageview')).toBe(true);await page.locator('#privacy-notice [data-deny]').click();const n=events.length;await page.goto('/');await expect.poll(()=>hits.length).toBe(1);await page.waitForTimeout(500);expect(events).toHaveLength(n);expect(hits[0].page).toBe('/');
});
test('360px notice and army totals fit',async({page})=>{
 await page.setViewportSize({width:360,height:800});const {errors}=await setup(page);await page.route('**/api/stats?**',r=>r.fulfill({json:{page:'army',day,state:'ready',updated:new Date().toISOString(),data:{visitors:8,unseen:{day:3},soldiers:{day:2,all:6}}}}));await page.goto('/stats/army/');await expect(page.locator('#section-output')).toContainText('11 visitors today');await expect(page.locator('#section-output')).toContainText('2 today · 6 all time');await page.waitForTimeout(1700);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:'test-results/army-mobile.png',fullPage:true});
});
