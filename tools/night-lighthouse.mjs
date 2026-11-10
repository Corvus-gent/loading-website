import lighthouse from 'lighthouse';
import {launch} from 'chrome-launcher';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const phase=process.argv[2]||'before',rows=[],base=process.env.QA_BASE||'http://127.0.0.1:8793';
const chrome=await launch({chromePath:chromium.executablePath(),chromeFlags:['--headless','--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const route of ['/','/hack/','/nest/','/dontpay/']){
  const {lhr}=await lighthouse(base+route,{port:chrome.port,onlyCategories:['performance','accessibility','seo'],logLevel:'error',formFactor:'mobile',screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:1,disabled:false}});
  const row={route,performance:Math.round(lhr.categories.performance.score*100),accessibility:Math.round(lhr.categories.accessibility.score*100),seo:Math.round(lhr.categories.seo.score*100),lcp:lhr.audits['largest-contentful-paint'].numericValue,cls:lhr.audits['cumulative-layout-shift'].numericValue,tbt:lhr.audits['total-blocking-time'].numericValue,issues:Object.values(lhr.audits).filter(a=>a.score!==null&&a.score<.9).map(a=>({id:a.id,title:a.title,score:a.score,displayValue:a.displayValue,details:a.details}))};rows.push(row);
  await fs.writeFile(`qa/lighthouse-${phase}.json`,JSON.stringify(rows,null,2));
  console.log(JSON.stringify({...row,issues:row.issues.map(x=>x.id)}));
 }
}finally{await chrome.kill();}
