import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,devices,expect} from '@playwright/test';
import {loadCompoundEnv} from '../tools/compound-env.mjs';
const base=process.env.IG_PREVIEW;
assert(base?.startsWith('https://loading-website-')&&base.endsWith('.vercel.app'),'Preview only: this test writes votes');
const previewEnv=await fs.readFile('/tmp/corvus-ig-preview.env','utf8');
assert(/^COMPOUND_KEY_PREFIX="?compound-preview"?$/m.test(previewEnv),'Isolated preview namespace required');
loadCompoundEnv();
const browser=await chromium.launch({args:['--disable-http2']});
try{
 const context=await browser.newContext({...devices['iPhone 13'],userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 355.0.0.41.93'});
 const cookies=await fs.readFile(process.env.PREVIEW_COOKIES,'utf8');await context.addCookies(cookies.split('\n').filter(l=>l&&!l.startsWith('#')||l.startsWith('#HttpOnly_')).map(l=>{const[domain,,path,secure,expires,name,value]=l.replace('#HttpOnly_','').split('\t');return{domain,path,name,value,secure:secure==='TRUE',expires:Number(expires)||-1,httpOnly:l.startsWith('#HttpOnly_'),sameSite:'Lax'};}));
 const original=(await(await fetch('https://corvus.gent/api/compound')).json()).cuts[0].current;
 const published=await context.request.post(base+'/api/compound',{headers:{origin:base,authorization:'Bearer '+process.env.COMPOUND_ADMIN_PASSWORD},data:{action:'publish',slot:1,url:original.url,label:'V1',changelog:'IG preview QA · real V1',duration:original.duration,width:original.width,height:original.height,cutlist:original.transitions}});
 assert.equal(published.status(),200);const version=(await published.json()).version.id;
 const page=await context.newPage(),errors=[],requests=[],popups=[];page.on('pageerror',e=>errors.push(e.message));page.on('popup',p=>popups.push(p));page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/compound'))requests.push(r.postDataJSON());});
 for(const [slug,medium,content]of [['ig','bio','gabe.maxxing'],['ig-story','story','gabe.maxxing'],['bjj','bio','gabinho_bjj'],['bjj-story','story','gabinho_bjj'],['dm','direct',null]]){
  const r=await context.request.get(base+'/'+slug+'?keep=yes',{maxRedirects:0});assert.equal(r.status(),302);const u=new URL(r.headers().location,base);assert.equal(u.pathname,'/compound');assert.equal(u.searchParams.get('utm_source'),slug==='dm'?'dm':'instagram');assert.equal(u.searchParams.get('utm_medium'),medium);assert.equal(u.searchParams.get('utm_content'),content);assert.equal(u.searchParams.get('keep'),'yes');
  const c=await context.request.get(base+'/'+slug+'?c=reel.1&keep=yes',{maxRedirects:0});assert.equal(new URL(c.headers().location,base).searchParams.get('utm_content'),'reel.1');
 }
 const audit=await context.request.get(base+'/api/compound?private=1',{headers:{authorization:'Bearer '+process.env.COMPOUND_ADMIN_PASSWORD}});assert.equal(audit.status(),200);const campaigns=(await audit.json()).campaigns;
 for(const slug of ['ig','ig-story','bjj','bjj-story','dm'])assert(campaigns.some(c=>c.touch==='last'&&c.slug===slug&&c.source===(slug==='dm'?'dm':'instagram')&&c.clicks>=1),'Logged click: '+slug);
 const start=Date.now();await page.goto(base+'/compound/');
 const one=page.locator('[data-cut="1"]');await page.waitForFunction(()=>document.querySelector('[data-cut="1"] video')?.currentTime>0,null,{timeout:15000});const firstPlaybackMs=Date.now()-start;
 assert(await one.locator('video').evaluate(v=>v.muted));
 await one.locator('.vote[data-choice="up"]').click();await expect(one.locator('.categories')).toBeVisible();
 assert(requests.some(r=>r.action==='vote'&&r.attribution.source==='instagram'&&r.attribution.source_confidence==='user_agent'));
 const current=await context.request.get(base+'/api/compound?version='+version+'&qa='+Date.now());assert.equal(current.status(),200);assert.equal((await current.json()).byVersion[version].stats['vote:up'],1);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await fs.mkdir('test-results/social',{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/social/ig-v1.png'});
 await page.locator('#donate').click();await page.waitForURL('https://buy.stripe.com/**',{timeout:15000});assert.equal(popups.length,0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({slugs:5,override:true,queryPreserved:true,realPreviewVote:1,source:'instagram',confidence:'user_agent',firstPlaybackMs,sameTabStripe:true,popups:popups.length,errors}));
}finally{await browser.close();}
