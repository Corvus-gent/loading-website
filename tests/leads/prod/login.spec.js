// Live check: a real browser unlocks https://corvus.gent/scraper/fiverr-leads
// with the real LEADS_PASSWORD, like Gabriel does in DuckDuckGo (WebKit) and Chrome.
// Read-only: it logs in, loads the pipeline and locks again. It never saves anything.
import {test,expect} from '@playwright/test';

const BASE='/scraper/fiverr-leads';
const PASSWORD=process.env.LEADS_PASSWORD||'';

test('owner can unlock leadhunter on production and see the pipeline',async({page})=>{
  expect(PASSWORD.length,'Set the LEADS_PASSWORD repository secret (same value as in Vercel)').toBeGreaterThanOrEqual(16);
  const failures=[];
  page.on('response',r=>{if(r.url().includes(BASE)&&r.status()>=400)failures.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);});

  await page.goto(BASE);
  await page.getByLabel('Password',{exact:true}).fill(PASSWORD);
  await page.getByRole('button',{name:'Unlock',exact:true}).click();

  // Any login failure (403 origin, 401 password, 429, 503 storage) lands here as readable text.
  const body=page.locator('body');
  await expect(body,'Login did not reach the dashboard').toContainText('one client.',{timeout:15000});
  await expect(body).not.toContainText('"error"');

  // The pipeline loads from storage.
  await expect(page.locator('#updated')).not.toHaveText('Loading your pipeline…',{timeout:15000});
  await expect(page.locator('#message'),'Dashboard shows an error').toHaveText('');
  const data=await page.request.get(`${BASE}/data.json`);
  expect(data.status(),'data.json after login').toBe(200);

  await page.getByRole('button',{name:'Lock'}).click();
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  expect(failures,'Failed requests during the flow').toEqual([]);
});
