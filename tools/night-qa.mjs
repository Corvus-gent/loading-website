// Repeatable visual/axe baseline. Local fixture server; never submits production forms.
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const phase=process.argv[2]||'before',base=process.env.QA_BASE||'http://127.0.0.1:8793';
const inventory=await fs.readFile('ROUTES.md','utf8');
const routes=[...new Set([...inventory.matchAll(/^\| `(\/[^`]*?)` \|/gm)].map(m=>m[1]).filter(r=>!r.startsWith('/api/')&&!/[:<>?]/.test(r)&&!['/cv','/cv/download','/cv/gabriel.pdf','/gabriel','/self','/gabe','/links','/arena'].includes(r)))];
const only=process.env.QA_ROUTES?.split(',');
const targets=only||routes,results=[];
const folder=path.join('qa',phase);await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch();
try{
 for(const [device,viewport] of Object.entries({mobile:{width:390,height:844},desktop:{width:1440,height:1000}})){
  for(const route of targets){
   const context=await browser.newContext({viewport,locale:'en-US',reducedMotion:'reduce'}),page=await context.newPage();
   const errors=[],failed=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});
   page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url().replace(base,''),status:r.status()});});
   await context.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==='stats.corvus.gent'){
     const target=u.pathname==='/'?'/stats/':/^\/(pidgy|games|map|music|hunt|x|coffee|private|status)\/?$/.test(u.pathname)?'/stats'+u.pathname:u.pathname;
     return r.fulfill({response:await context.request.fetch(base+target+u.search,{method:r.request().method(),data:r.request().postData()||undefined})});
    }
    // Keep a lab visit from sending analytics or making any real external writes.
    if(!['127.0.0.1','localhost'].includes(u.hostname)&&r.request().method()!=='GET')return r.fulfill({status:200,json:{}});
    if(/posthog|\/e\/?\?/.test(u.href))return r.fulfill({status:200,body:'',contentType:'text/javascript'});
    return r.continue();
   });
   await page.addInitScript(()=>{try{localStorage.setItem('lang','en');}catch{}});
   const slug=(route==='/'?'home':route.replace(/^\/|\/$/g,'').replaceAll('/','--').replaceAll('.','-'));
   const item={route,device,viewport,screenshot:`${folder}/${slug}-${device}.png`,fullScreenshot:`${folder}/${slug}-${device}-full.png`,errors,failed};
   try{
    item.status=(await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:20000}))?.status();
    await page.waitForTimeout(500);
    await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2000))]));
    item.dom=await page.evaluate(()=>({title:document.title,description:document.querySelector('meta[name="description"]')?.content||null,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+2||r.left< -2)&&getComputedStyle(e).position!=='fixed';}).slice(0,15).map(e=>({tag:e.tagName,id:e.id,class:e.className,box:{left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}})),brokenImages:[...document.images].filter(e=>e.complete&&!e.naturalWidth).map(e=>e.getAttribute('src'))}));
    await page.screenshot({path:item.screenshot,animations:'disabled'});
    await page.screenshot({path:item.fullScreenshot,fullPage:true,animations:'disabled'});
    if(process.env.QA_AXE==='1'){
     const a=await new AxeBuilder({page}).analyze();
     item.axe=a.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,help:v.help,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))}));
    }
   }catch(e){item.failure=e.message.slice(0,500);}
   results.push(item);await fs.writeFile(path.join(folder,'report.json'),JSON.stringify(results,null,2));
   console.log(`${device} ${route}: ${item.status||'error'}; overflow=${item.dom?.scrollWidth>viewport.width}; brokenImages=${item.dom?.brokenImages.length||0}; errors=${errors.length}; axe=${item.axe?.filter(x=>['serious','critical'].includes(x.impact)).length??'not run'}`);
   await context.close();
  }
 }
}finally{await browser.close();}
const counts={routes:targets.length,screens:results.length,overflow:results.filter(x=>x.dom?.scrollWidth>x.viewport.width).length,brokenImages:results.reduce((n,x)=>n+(x.dom?.brokenImages.length||0),0),serious:results.reduce((n,x)=>n+(x.axe||[]).filter(v=>['serious','critical'].includes(v.impact)).reduce((a,v)=>a+v.nodes.length,0),0),failures:results.filter(x=>x.failure).length};
await fs.writeFile(path.join(folder,'summary.json'),JSON.stringify(counts,null,2));console.log(counts);
