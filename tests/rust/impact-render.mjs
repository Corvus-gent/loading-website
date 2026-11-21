// Identical known/unknown/history fixtures render the same DOM with legacy JS and Rust/WASM.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {rustSite} from '../helpers/rust-site.mjs';
import {coverage} from '../../compound/impact/metrics.js';
const browser=await chromium.launch(),time='2026-11-09T16:00:00.000Z';
const fixture={posts:[
 {id:'01',platform:'x',account:'gabe_maxxing',post_url:'https://x.com/gabe_maxxing/status/1234567',label:'<safe> caption',slug:'x-gm-en-b1',vote_code:'EN-B-1',views:0,likes:99,comments:8,shares:null,saves:null,metric_source:'manual',field_sources:{views:'x-api',likes:'yt-dlp'},velocity:361/7,first24_sample:{at:time,partial:true,missing:['shares','saves']}},
 {id:'02',platform:'tt',account:'gabinho_bjj',post_url:'https://www.tiktok.com/@gabinho_bjj/video/9876543',views:12345,likes:2,comments:0,shares:0,saves:0,metric_source:'tiktok-display',thumbnail_url:'https://example.invalid/missing.png'},
 {id:'03',platform:'li',account:'francisco-gabriel-van-langenhove',post_url:'https://www.linkedin.com/feed/update/urn:li:activity:123456789/',views:1234,view_metric:'impressions',likes:0,comments:0,shares:0,saves:0,metric_source:'manual'},
 {id:'04',platform:'ig',account:'gabe.maxxing',post_url:'https://www.instagram.com/reel/fixture/',views:100,likes:0,comments:null,shares:null,saves:null,metric_source:'oriane',measured_date:'9 Nov'},
 {id:'05',platform:'yt',account:'fixture',post_url:'https://www.youtube.com/watch?v=abc123xyz',views:99,likes:1,comments:1,shares:null,saves:null,metric_source:'youtube-api'},
 {id:'06',platform:'tw',account:'gabe_maxxing',post_url:'https://www.twitch.tv/videos/123456',views:99,metric_source:'helix'},
 {id:'07',platform:'ig',account:'gabinho_bjj',post_url:'https://www.instagram.com/reel/unknown/',metric_source:'unknown'},
 ].map(p=>{p={made_with_compound:true,original_by_gabe:true,post_type:'original',media_type:'video',posted_at:'2026-11-09T09:00:00.000Z',metrics_at:time,velocity:null,...p};return{...p,coverage:coverage(p),score:coverage(p).score}}),totals:{},clicks:{total:12,rows:[{id:'compound-footer',total:9},{id:'compound-impact',total:3}]},history:[
 {at:'2026-11-09T10:00:00.000Z',views:null,score:null},
 {at:'2026-11-09T11:00:00.000Z',views:0,views_reported:1,score:5},
 {at:'2026-11-09T16:00:00.000Z',views:12345,views_reported:6,score:54321}
 ]};
const captures={};
try{for(const engine of ['legacy','rust']){
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',timezoneId:'Europe/Brussels',reducedMotion:'reduce'});const embedRequests=[];let failing=true;
 await rustSite(ctx,{},{browserEngine:engine,beforeRequest:async({route,u})=>{
  if(u.pathname==='/api/compound-v2'){await route.fulfill({status:failing?503:200,contentType:'application/json',body:JSON.stringify(failing?{}:fixture)});return true;}
 }});
 // Explicit clicks can load external embeds; no real network traffic occurs.
 await ctx.route(/https:\/\/(platform\.twitter\.com|www\.tiktok\.com|www\.instagram\.com|www\.youtube-nocookie\.com|www\.linkedin\.com)\//,r=>{embedRequests.push(r.request().url());return r.fulfill({contentType:'text/html',body:'<p>fixture player</p>'})});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('https://corvus.gent/compound/impact/');await expect(p.locator('#data-status')).toHaveText('Could not load the figures. Please retry.');await expect(p.locator('#retry')).toBeVisible();failing=false;await p.locator('#retry').click();await expect(p.locator('.impact-post')).toHaveCount(7);await expect(p.locator('.post-thumb img')).toHaveCount(0);await expect(p.locator('#growth svg')).toHaveCount(2);
 const snapshot=async()=>{await expect(p.locator('.post-thumb img')).toHaveCount(0);return p.evaluate(()=>Object.fromEntries(['impact-totals','platform-totals','post-list','growth','click-headline','click-sources','formula'].map(id=>[id,document.getElementById(id).innerHTML])));};
 captures[engine]=[await snapshot()];await p.locator('#sort').selectOption('velocity');captures[engine].push(await snapshot());await p.locator('#platform').selectOption('li');await p.locator('#account').selectOption('francisco-gabriel-van-langenhove');captures[engine].push(await snapshot());
 await p.locator('.impact-post button').click();await expect(p.locator('.post-embed iframe')).toHaveCount(1);await expect(p.locator('.impact-post button')).toBeDisabled();await expect(p.locator('.post-embed iframe')).toHaveAttribute('src',/urn:li:activity:123456789/);await p.locator('#platform').selectOption('tt');await p.locator('.impact-post button').click();await expect(p.locator('.post-embed iframe')).toHaveAttribute('src',/player\/v1\/9876543/);await p.locator('#platform').selectOption('x');await p.locator('.impact-post button').click();await expect(p.locator('.post-embed iframe')).toHaveAttribute('src',/Tweet.html\?id=1234567&theme=dark/);await p.locator('#platform').selectOption('ig');await p.locator('.impact-post button').first().click();await expect(p.locator('.post-embed iframe')).toHaveAttribute('src',/reel\/fixture\/embed\//);await p.locator('#platform').selectOption('yt');await p.locator('.impact-post button').click();await expect(p.locator('.post-embed iframe')).toHaveAttribute('src',/embed\/abc123xyz/);await p.locator('#platform').selectOption('tw');await expect(p.locator('.impact-post button')).toHaveCount(0);
 // Repeated refresh replaces rows/listeners rather than duplicating them.
 await p.locator('#platform').selectOption('');for(let i=0;i<3;i++){await p.locator('#retry').evaluate(e=>{e.hidden=false;e.click()});await expect(p.locator('#retry')).toBeHidden();await expect(p.locator('.impact-post')).toHaveCount(7);}captures[engine].push(await snapshot());assert.deepEqual(errors,[]);await ctx.close();
}
 for(let i=0;i<captures.legacy.length;i++)assert.deepEqual(captures.rust[i],captures.legacy[i],`DOM fixture ${i}`);
 console.log('PASS: legacy/Rust exact Impact rendered DOM, 7 mixed-platform score/coverage/source cards, measured zero/unknown, first-day velocity, history gaps, click bars, sorting/account filters, explicit-only embeds, initial failure/retry and repeated refresh.');
}finally{await browser.close()}
