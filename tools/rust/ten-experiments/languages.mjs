// Targeted follow-up: English-only readiness must not mask translation latency.
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {buildFixture} from '../../../tests/helpers/built-site.mjs';
import {createPerformanceServer,observePerformance,samplePerformance,PROFILES} from '../performance.mjs';
import {prepareVariants} from './variants.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(s=>s.split(/=(.*)/s).slice(0,2)));
const locales=(args['--locales']||'nl-BE,fr-FR').split(','),repeats=Number(args['--repeats']||3),modes=(args['--modes']||'js-control,10-combined').split(',');
assert(Number.isInteger(repeats)&&repeats>=1&&repeats<=20);
const combined=(args['--combined']||'bundle,parallel,directory,brotli,locale,predict,footer-logo,css-flat,stable-language').split(',');
const started=new Date().toISOString(),out=args['--out']||'test-results/rust/measurements/ten-languages';await mkdir(out,{recursive:true});
const fixture=await buildFixture(),variants=await prepareVariants(fixture.root,{combined}),servers={},samples=[],errors=[];
const expectedHeadings={};for(const locale of locales){const code=locale.slice(0,2);expectedHeadings[code]=code==='en'?'one man. an army of builders.':JSON.parse(await readFile(fixture.root+`/public/i18n/site.${code}.json`,'utf8'))['one man. an army of builders.'];assert(expectedHeadings[code]);}
const report={started,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),conditions:PROFILES,fixtureLatencyMs:40,locales,repeats,modes,combined,samples,errors,productionReady:false};
async function save(){await writeFile(out+'/report.pending.json',JSON.stringify(report,null,2)+'\n');await rename(out+'/report.pending.json',out+'/report.json');}
let browser;
try{
 for(const mode of modes){const v=variants.options(mode);servers[mode]=await createPerformanceServer(fixture.root,v.engine,v.server);}
 browser=await chromium.launch();report.browser=browser.version();
 for(const mode of modes)for(const locale of locales){
  const c=await browser.newContext({locale});await c.addInitScript(observePerformance);const p=await c.newPage();await samplePerformance(p,'/','cold-context',servers[mode].origin);await p.waitForLoadState('networkidle');await c.close();
 }
 for(const profile of ['mobile','desktop'])for(const locale of locales)for(let repeat=0;repeat<repeats;repeat++)for(const mode of repeat%2?[...modes].reverse():modes){
  const cfg=PROFILES[profile],c=await browser.newContext({locale,viewport:{width:cfg.width,height:cfg.height},isMobile:profile==='mobile',hasTouch:profile==='mobile',timezoneId:'Europe/Brussels',serviceWorkers:'block'});
  await c.addCookies([{name:'corvus_realm',value:'1',url:servers[mode].origin}]);await c.addInitScript(observePerformance);
  await c.addInitScript(()=>{window.__pageCopyReady=null;addEventListener('corvus-page-copy-ready',()=>{if(window.__pageCopyReady===null)window.__pageCopyReady=performance.now();});});
  const p=await c.newPage(),cdp=await c.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cfg.cpu});if(cfg.down)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:cfg.latency,downloadThroughput:cfg.down,uploadThroughput:cfg.up});
  try{for(const cache of ['cold-context','warm']){
   const s=await samplePerformance(p,'/',cache,servers[mode].origin);assert(!s.error,s.error);
   await p.waitForFunction(()=>window.__pageCopyReady!==null,{},{timeout:15000});
   const translation=await p.evaluate(()=>({pageCopyReady:window.__pageCopyReady,lang:document.documentElement.lang,heading:document.querySelector('h1').textContent}));
   assert.equal(translation.lang,locale.slice(0,2));assert.equal(translation.heading.replace(/\s+/g,' ').trim(),expectedHeadings[translation.lang]);assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
   samples.push({mode,profile,locale,repeat,cache,...s,...translation,allReady:Math.max(s.ready,translation.pageCopyReady)});console.log('LANGUAGE',JSON.stringify(samples.at(-1)));
   await p.keyboard.press('Escape');await p.waitForLoadState('networkidle');await save();
  }}catch(e){errors.push({mode,profile,locale,repeat,error:e.message});await save();}finally{await c.close();}
 }
 report.finished=new Date().toISOString();report.headAfter=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 report.assetFailures=Object.fromEntries(Object.entries(servers).map(([m,s])=>[m,[...s.failures]]));report.unknownAPIs=Object.fromEntries(Object.entries(servers).map(([m,s])=>[m,[...s.unknown]]));await save();
 console.log('REPORT',out+'/report.json');
}finally{if(browser)await browser.close();for(const s of Object.values(servers))await s.close();await fixture.close();}
