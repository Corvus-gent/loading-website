import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';

const origin = process.env.OPENRISK_TEST_ORIGIN || 'https://corvus.gent';
const password = process.env.OPENRISK_TEST_PASSWORD || (process.env.OPENRISK_TEST_BRIEF
  ? (await readFile(process.env.OPENRISK_TEST_BRIEF,'utf8')).match(/password `([^`]+)`/)[1] : '');
const engine = process.env.OPENRISK_TEST_WEBKIT ? webkit : chromium;
const size = process.env.OPENRISK_TEST_MOBILE ? {width:390,height:844} : {width:1440,height:900};
const screens = process.env.OPENRISK_TEST_SCREENS;
const root = origin + '/project-cto';
const browser = await engine.launch({ headless:true });
const measurements = {};
const errors = [];
try {
  if (screens) await mkdir(screens,{recursive:true});
  const page = await browser.newPage({ viewport:size, reducedMotion:'reduce' });
  page.setDefaultTimeout(12000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
    if (response.status()>=500 && response.url().startsWith(origin)) console.log('Service status',response.status(),new URL(response.url()).pathname);
  });
  const shot = async name => { if(screens) await page.screenshot({path:screens+'/'+name+'.png',animations:'disabled',fullPage:true}); };
  const gate = await page.goto(root);
  assert.equal(gate.status(),401);
  assert.equal(gate.headers()['x-robots-tag'],'noindex, nofollow');
  for (const path of ['/api/bootstrap','/api/state','/workspace.js','/unknown']) assert.equal((await page.request.get(root+path)).status(),401);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Open workspace'}).click();
  await page.getByRole('heading',{name:'Ecosystem map'}).waitFor();
  await shot('01-ecosystem-map');
  async function search(name) {
    const started = Date.now();
    await page.locator('#company-search').fill(name);
    const dropdown = page.locator('#search-results');
    const profile = dropdown.getByRole('button',{name:new RegExp('^'+name)}).first();
    await profile.waitFor();
    const ready = Date.now();
    await profile.click();
    await page.getByRole('heading',{name,exact:true}).waitFor();
    measurements[name]={typeaheadMs:ready-started,profileMs:Date.now()-ready};
  }
  const explore=()=>page.locator('#top-nav').getByRole('button',{name:'Explore'}).click();
  for (const name of ['Aikido Security','Deliverect','Stripe']) {
    await search(name);
    await page.getByRole('heading',{name:'OpenRisk score'}).waitFor();
    if(name==='Aikido Security') await shot('02-aikido-dossier');
    await explore();
  }
  await page.getByRole('button',{name:'Palo Alto',exact:true}).click();
  await page.getByRole('heading',{name:/Palo Alto ·/}).waitFor();
  const started = Date.now();
  await page.locator('#company-search').fill('Hugging Face');
  await page.getByRole('button',{name:/Research Hugging Face/}).click();
  await page.getByRole('heading',{name:'Hugging Face',exact:true}).waitFor();
  measurements.coldFirstPaintMs=Date.now()-started;
  await page.waitForFunction(()=>!document.querySelector('.shimmer'));
  measurements.coldSettledMs=Date.now()-started;
  await shot('03-cold-research');
  await explore();
  await search('Aikido Security');
  await page.getByRole('button',{name:'Follow',exact:true}).click();
  await page.getByRole('button',{name:'Following',exact:true}).waitFor();
  const investorWrite = await page.request.post(root+'/api/state',{headers:{Origin:origin},data:{action:'save',company:'aikido-security',period:'2026-10',values:{cash:10},currency:'EUR'}});
  assert.equal(investorWrite.status(),403);
  await page.getByRole('button',{name:'Claim this profile'}).click();
  await page.getByRole('heading',{name:'Founder desk'}).waitFor();
  await page.getByRole('button',{name:'September investor update'}).click();
  await page.getByRole('button',{name:'Extract KPI proposals'}).click();
  await page.getByRole('heading',{name:'Review proposals'}).waitFor();
  assert.equal(await page.locator('[data-proposal]').count(),7);
  await page.getByRole('button',{name:'Confirm all'}).click();
  await page.getByText('7 KPI proposals confirmed.').waitFor();
  await page.getByRole('button',{name:'October investor update'}).click();
  await page.getByRole('button',{name:'Extract KPI proposals'}).click();
  await page.getByRole('heading',{name:'Review proposals'}).waitFor();
  await shot('04-email-proposals');
  await page.getByRole('button',{name:'Confirm all'}).click();
  await page.getByText('7 KPI proposals confirmed.').waitFor();
  await page.getByRole('button',{name:'Investor fit',exact:true}).click();
  await page.getByRole('heading',{name:'Notion Capital'}).waitFor();
  await shot('05-investor-fit');
  await page.getByLabel('View as').selectOption('Investor');
  await page.getByRole('heading',{name:'Portfolio cockpit'}).waitFor();
  await page.getByText('4.6 mo').waitFor();
  await page.getByText('11%',{exact:true}).waitFor();
  await shot('06-portfolio-cockpit');
  await explore();
  await page.getByRole('button',{name:'+ Add a startup'}).click();
  await page.getByLabel('Startup name').fill('Northstar Demo');
  await page.getByLabel('Website').fill('example.com');
  await page.getByRole('button',{name:'Submit for approval'}).click();
  await page.getByText('Submitted to the admin queue.').waitFor();
  await page.getByLabel('View as').selectOption('Admin');
  await page.getByRole('heading',{name:'Operations'}).waitFor();
  await page.getByRole('button',{name:'Approve & enrich'}).click();
  await page.getByText('Approved and added to the map.').waitFor();
  await shot('07-admin-queue');
  await explore();
  await search('Northstar Demo');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,'No page overflow');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(measurements,null,2));
} finally {
  if (errors.length) console.error(errors);
  await browser.close();
}
