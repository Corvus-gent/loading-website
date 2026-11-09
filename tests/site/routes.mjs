import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {ROUTES} from '../../js/site/routes.js';
const origin=process.env.SITE_TEST_ORIGIN||'https://corvus.gent';
const output='test-results/site-routes';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch(),results=[];
for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
 const context=await browser.newContext({viewport,isMobile:viewport.width===390,hasTouch:viewport.width===390,reducedMotion:'reduce'});
 // Read-only route audit: do not fabricate analytics visits or votes.
 await context.route(/posthog|\/api\/hit(?:\?|$)/,r=>r.abort());
 const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const entry of [{path:'/',title:'home'},...ROUTES]){
  const url=new URL(entry.path,origin).href;errors=[];
  try{
   if(entry.type==='pdf'){const response=await context.request.get(url);const item={path:entry.path,viewport:viewport.width,status:response.status(),type:'pdf',contentType:response.headers()['content-type']};results.push(item);console.log('PDF '+item.status+' '+entry.path);continue;}
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(450);
   const result=await page.evaluate(()=>({title:document.title,nav:!!document.querySelector('.site-nav'),section:!!document.querySelector('.site-section'),next:!!document.querySelector('.site-next'),call:!!document.querySelector('.site-next a[href="/call/"]'),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,h1:document.querySelector('h1')?.textContent?.trim(),images:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src')),nextLink:document.querySelector('.next-primary')?.getAttribute('href')}));
   const slug=new URL(url).hostname.replace(/\./g,'-')+new URL(url).pathname.replace(/\W/g,'-');
   await page.screenshot({path:`${output}/${viewport.width}-${slug}.png`});
   const item={path:entry.path,viewport:viewport.width,status:response.status(),...result,errors:errors.filter(e=>!e.includes('getLayoutMap'))};results.push(item);
   console.log(JSON.stringify({path:item.path,width:item.viewport,status:item.status,overflow:item.scrollWidth>item.width+1,nav:item.nav,errors:item.errors.length,brokenImages:item.images.length}));
  }catch(error){results.push({path:entry.path,viewport:viewport.width,error:error.message});console.log('FAIL '+entry.path+' '+error.message.slice(0,120));}
  await fs.writeFile(output+'/results.json',JSON.stringify(results,null,2));
 }
 await context.close();
}
await browser.close();
