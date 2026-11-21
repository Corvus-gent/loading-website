import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {rustSite} from '../helpers/rust-site.mjs';
const browser=await chromium.launch(),outcomes={legacy:[],rust:[]},at='2026-11-20T04:00:00Z';
const old={id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',expires:Date.parse(at)+86400000,first:{source:'x',landed:1},last:{source:'linkedin',landed:2}};
const cases=[{name:'new'},{name:'UTM',query:'?utm_source=INSTAGRAM&utm_medium=comment&utm_campaign=c&code=NL-A1'},{name:'agent',ua:'Instagram mobile'},{name:'referrer',referrer:'https://www.linkedin.com/feed/'},{name:'deny',deny:true},{name:'GPC',gpc:true},{name:'DNT',dnt:true},{name:'blocked',blocked:true},{name:'journey',deep:true,old},{name:'journey new UTM',deep:true,old,query:'?utm_source=tiktok'},{name:'expired',deep:true,old:{...old,expires:1}},{name:'corrupt',deep:true,raw:'invalid json'}];
try{for(const engine of ['legacy','rust']){
 for(const f of cases){const ctx=await browser.newContext({userAgent:f.ua||'Fixture Browser'});const requests=[];
  await rustSite(ctx,null,{browserEngine:engine,beforeRequest:async({route,request,u})=>{
   if(u.pathname==='/__client'){await route.fulfill({contentType:'text/html',body:'<!doctype html><script type="module">window.client=await import("/compound/client.js");window.source=await import("/js/social-attribution.js");window.ready=true;</script>'});return true;}
   if(u.pathname==='/api/compound'){requests.push({query:u.search,method:request.method(),body:request.postDataJSON()});await route.fulfill({status:u.search==='?fail'?503:200,contentType:'application/json',body:JSON.stringify(u.search==='?fail'?{error:'Fixture failed'}:{ok:true})});return true;}
  }});
  await ctx.addInitScript(f=>{crypto.randomUUID=()=> '00000000-0000-4000-8000-000000000001';if(f.deny)localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny'}));if(f.deep)localStorage.setItem('compound-journey-choice','yes');if(f.old)localStorage.setItem('compound-journey-v1',JSON.stringify(f.old));if(f.raw)localStorage.setItem('compound-journey-v1',f.raw);if(f.gpc)Object.defineProperty(navigator,'globalPrivacyControl',{value:true});if(f.dnt)Object.defineProperty(navigator,'doNotTrack',{value:'1'});if(f.blocked){for(const k of ['getItem','setItem','removeItem'])Storage.prototype[k]=()=>{throw Error('blocked')};}},f);
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date(at)});await p.clock.setFixedTime(new Date(at));await p.goto('https://corvus.gent/__client'+(f.query||''),{referer:f.referrer});await p.waitForFunction(()=>window.ready);
  const result=await p.evaluate(async()=>{
   const snapshot=()=>({tags:client.tags(),deep:client.deepAllowed(),saved:(()=>{try{return JSON.parse(localStorage.getItem('compound-journey-v1'))}catch{return null}})()});const states=[snapshot()];client.setDeep(true);states.push(snapshot());client.handlePreference.set('@safe');const handle=client.handlePreference.get();client.handlePreference.set('');const cleared=client.handlePreference.get();
   const get=await client.api(undefined,'?private=1');const post=await client.api({action:'fixture',analytics:false});let failed='';try{await client.api(null,'?fail')}catch(e){failed=e.message}client.beacon({action:'event',message:'safe'});
   client.setDeep(false);states.push(snapshot());const nodes=[99,true,false,null,'<b>safe</b>'].map(v=>client.node('p',v,'test').outerHTML);
   try{localStorage.setItem('privacy-choice',JSON.stringify({choice:'deny'}));window.dispatchEvent(new Event('analytics-consent-change'))}catch{}states.push(snapshot());
   return{states,handle,cleared,get,post,failed,nodes};
  });await expect.poll(()=>requests.length).toBe(4);assert.deepEqual(errors,[]);outcomes[engine].push({name:f.name,result,requests});await ctx.close();
 }
 // Broad source precedence/parsing cases, independent of browser navigation.
 const ctx=await browser.newContext();await rustSite(ctx,null,{browserEngine:engine,beforeRequest:async({route,u})=>{if(u.pathname==='/__source'){await route.fulfill({contentType:'text/html',body:'<script type="module">window.source=await import("/js/social-attribution.js");window.ready=true;</script>'});return true;}}});const p=await ctx.newPage();await p.goto('https://corvus.gent/__source');await p.waitForFunction(()=>window.ready);
 const matrix=await p.evaluate(()=>{const rows=[];for(const search of ['', '?utm_source=','?utm_source=X','?utm_source=%20x','?utm_source=%F0%9F%A5%8B','?utm_source=linkedin&utm_source=x','?UTM_SOURCE=x','?utm_source=buymeacoffee'])for(const userAgent of ['','Instagram FBAV','FBAN','LinkedInApp','TikTok','musical_ly','BytedanceWebview','Twitter'])for(const referrer of ['','https://www.linkedin.com/feed','https://lnkd.in/path','https://fakeinstagram.com','t.co','https://instagram.com.evil.test','https://x.com','invalid host','https://TIKTOK.COM/video'])rows.push(source.inferredSource({search,userAgent,referrer}));return rows;});outcomes[engine].push({matrix});await ctx.close();
}
 assert.deepEqual(outcomes.rust,outcomes.legacy);console.log('PASS: 12 legacy/Rust Compound client states and 576 attribution cases; transient IDs, opted-in journey/expiry, UTMs/referrers, privacy denial/GPC/DNT/blocked storage, handle preference, HTTP errors, beacon bodies and literal DOM values.');
}finally{await browser.close()}
