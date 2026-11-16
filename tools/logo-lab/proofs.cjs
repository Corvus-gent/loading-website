const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
const round=process.argv[2],out='design/logo-lab/rounds/'+round;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:880},deviceScaleFactor:1,reducedMotion:'reduce'});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.route('http://local.test/**',async route=>{
 const url=new URL(route.request().url());let f=url.pathname.slice(1);if(!f||f.endsWith('/'))f+='index.html';
 try{await route.fulfill({body:await fs.readFile(path.resolve(f)),contentType:({html:'text/html',css:'text/css',js:'text/javascript',svg:'image/svg+xml',png:'image/png',zip:'application/zip'})[path.extname(f).slice(1)]||'text/plain'})}catch{await route.fulfill({status:404,body:''})}
});
await page.goto('http://local.test/lab/logo/');
for(const n of ['prompt','legio','flyer','sigil','arcade']){
 await page.selectOption('#edition',n);await page.locator('#contexts img, #squint img, #hero').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 await page.locator('#contexts').screenshot({path:out+'/'+n+'-contexts.png'});
 await page.locator('#squint').screenshot({path:out+'/'+n+'-sizes.png'});
}
await page.selectOption('#edition','sigil');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:out+'/lab.png'});
await page.setViewportSize({width:390,height:844});await page.goto('http://local.test/lab/logo/?logo=flyer');
await page.locator('#hero').evaluate(i=>i.decode());if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow');
await page.screenshot({path:out+'/mobile.png'});
if(errs.length)throw Error(errs.join('; '));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

