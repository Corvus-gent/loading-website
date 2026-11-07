import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.SQUADS_PREVIEW;if(!base)throw Error('SQUADS_PREVIEW required');
const browser=await chromium.launch({args:['--disable-http2']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 if(process.env.PREVIEW_COOKIES){const raw=await fs.readFile(process.env.PREVIEW_COOKIES,'utf8');await context.addCookies(raw.split('\n').filter(l=>l&&!l.startsWith('#')||l.startsWith('#HttpOnly_')).map(l=>{const [domain,,path,secure,expires,name,value]=l.replace('#HttpOnly_','').split('\t');return{domain,path,name,value,secure:secure==='TRUE',httpOnly:l.startsWith('#HttpOnly_'),expires:Number(expires)||-1,sameSite:'Lax'};}));}
 const redirect=await context.request.get(base+'/squads?utm_source=linkedin',{maxRedirects:0});assert.equal(redirect.status(),307);assert.equal(new URL(redirect.headers().location).pathname,'/hackathons/');
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/squads?utm_source=linkedin');
 await page.waitForFunction(()=>window.posthog?.get_property?.('short_slug')==='squads',null,{timeout:15000});
 assert.match(await page.locator('h1').innerText(),/ex-hackathon/);assert.equal(await page.locator('.squad-card').count(),1);
 assert.equal(await page.getByRole('link',{name:'Siebe',exact:true}).getAttribute('href'),'https://github.com/SiebeBaree');
 assert.equal(await page.locator('.squad-actions a').first().getAttribute('href'),'/hack/');
 assert.equal(await page.locator('.squad-actions a').last().getAttribute('href'),'https://github.com/SiebeBaree/hackthefeed');
 assert.equal(await page.evaluate(()=>posthog.get_property('utm_source')),'linkedin');assert.equal(await page.evaluate(()=>posthog.get_property('utm_campaign')),'hack');
 assert(!new URL(page.url()).searchParams.has('utm_source'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await fs.mkdir('test-results/squads',{recursive:true});await page.screenshot({path:'test-results/squads/mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/squads/desktop.png',fullPage:true});
 for(const path of ['/support/','/realm/']){await page.goto(base+path);assert(await page.locator('a[href="/hackathons/"]').count()>0);}
 assert.deepEqual(errors,[]);console.log('Mobile/desktop squad card, both nav links, real 307, LinkedIn + slug tracking and clean URL passed.');
}finally{await browser.close();}
