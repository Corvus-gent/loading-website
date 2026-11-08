import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {serve} from './server.mjs';
const out='tests/results/ossman-demo';await fs.mkdir(out,{recursive:true});
const site=await serve(),browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try{await Promise.all([{name:'9x16',width:1080,height:1920},{name:'1x1',width:1080,height:1080}].map(async format=>{
 const context=await browser.newContext({viewport:{width:format.width,height:format.height},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:format.width,height:format.height}}});
 const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push({url:r.url(),method:r.method()});});
 await page.goto(site.url+'/hack/play/?demo=1');await page.waitForFunction(()=>demoClock>=1);const box=await page.locator('#canvas').boundingBox();
 await page.waitForFunction(()=>demoClock>=10.4,{},{timeout:30000});await page.screenshot({path:out+'/'+format.name+'-finish.png'});
 await page.waitForFunction(()=>demoClock>=14.2,{},{timeout:15000});await page.screenshot({path:out+'/'+format.name+'-promotion.png'});
 await page.waitForFunction(()=>demoClock>=25,{},{timeout:20000});const data=await page.evaluate(()=>({events:demoEvents,clock:demoClock,score,kills,lives,round,state}));const raw=page.video();await context.close();await raw.saveAs(out+'/'+format.name+'-game.webm');
 await fs.writeFile(out+'/'+format.name+'-events.json',JSON.stringify({format,box,...data,errors,requests},null,2));console.log(format.name+' game recorded; '+data.kills+' finishes; errors '+errors.length+'; API calls '+requests.length);
 const votes=await browser.newContext({viewport:{width:format.width,height:format.height},recordVideo:{dir:out,size:{width:format.width,height:format.height}}});const vp=await votes.newPage();await vp.goto(site.url+'/hack/');await vp.locator('#winner').waitFor({state:'visible'});
 await vp.addStyleTag({content:`main{max-width:1000px;padding:36px 40px}nav{font-size:19px;margin-bottom:16px}.live-line{font-size:19px}.reveal{padding:20px;margin-bottom:22px}.reveal small{font-size:20px}#winner{font-size:80px}h1{font-size:72px;margin-bottom:20px}.intro{font-size:24px;line-height:1.5}.label{font-size:17px}.vote{min-height:82px}.vote .name{font-size:34px}.vote .meta{font-size:21px}.vote .number{font-size:19px}#status{font-size:20px}.arcade-feedback-open{display:none}`});
 await vp.screenshot({path:out+'/'+format.name+'-vote.png'});await vp.waitForTimeout(4200);const vv=vp.video();await votes.close();await vv.saveAs(out+'/'+format.name+'-vote.webm');console.log(format.name+' vote recorded');
}));}finally{await browser.close();site.close();}
