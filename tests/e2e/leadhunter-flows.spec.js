// Real user flows for corvus.gent/scraper/fiverr-leads.
// Runs through tools/site/leads-e2e-server.mjs: HTTPS, vercel.json routing,
// browser-sent headers (no forged Origin) and a real Redis.
import {test,expect} from '@playwright/test';

const BASE='/scraper/fiverr-leads';
const PASSWORD='local-e2e-password-123456';
const redis=async(request,up)=>expect((await request.post('/__fixture/redis',{data:{up}})).status()).toBe(204);

async function unlock(page,password=PASSWORD){
  await page.goto(BASE);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Unlock',exact:true}).click();
}
async function addContact(page,name){
  await page.getByRole('button',{name:'＋ Add warm contact'}).click();
  await page.getByLabel('Name',{exact:true}).fill(name);
  await page.getByLabel('Contact',{exact:true}).fill(`${name.toLowerCase().replace(/\W+/g,'-')}@example.com`);
  await page.getByLabel('What do they need?').fill('A business website with 5 pages and a contact form');
  await page.getByLabel('Budget min').fill('1000');
  await page.getByLabel('Budget max').fill('1500');
  await page.getByLabel('Next action').fill('Ask for a ten-minute call');
  await page.getByRole('button',{name:'Save contact',exact:true}).click();
  return page.locator('article.lead',{has:page.getByRole('heading',{name,exact:true})});
}

test.describe.configure({mode:'serial'});
test.afterEach(async({request})=>{await redis(request,true);});

test('private files stay locked without a session',async({request})=>{
  for(const p of ['data.json','app.js','style.css'])expect((await request.get(`${BASE}/${p}`)).status(),p).toBe(401);
  expect((await request.post(`${BASE}/save`,{data:{name:'x'}})).status()).toBe(401);
});

test('wrong password shows a readable message on the login page',async({page})=>{
  await unlock(page,'definitely-not-the-password');
  await expect(page.getByRole('alert')).toHaveText('That password did not match.');
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});

test('a login form on another site cannot open a session',async({page,baseURL})=>{
  // https://127.0.0.1 is a different site from https://localhost: a real cross-site form post.
  const foreign=baseURL.replace('localhost','127.0.0.1');
  await page.goto(foreign+'/__fixture/ok');
  await page.evaluate(([action,pw])=>{const f=document.createElement('form');f.method='post';f.action=action;const i=document.createElement('input');i.name='password';i.value=pw;f.append(i);document.body.append(f);f.submit();},[`${baseURL}${BASE}/login`,PASSWORD]);
  await page.waitForURL(`${baseURL}${BASE}/login`);
  await expect(page.locator('body')).toContainText('Open leadhunter from corvus.gent');
  await page.goto(BASE);
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});

test('full flow: unlock, add, change status, edit, links, draft, done, lock',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await unlock(page);
  await expect(page.getByRole('heading',{name:/one client/})).toBeVisible();
  await expect(page.locator('#updated')).not.toHaveText('Loading your pipeline…');
  await expect(page.locator('#message')).toHaveText('');

  const name=`Bakery ${info.project.name}`;
  const card=await addContact(page,name);
  await expect(card).toBeVisible();
  await expect(page.locator('#message')).toHaveText('Saved privately. Nothing sent.');

  // Status change survives a reload.
  await card.getByLabel(`Status for ${name}`).selectOption('call');
  await expect(card.getByText('Call / interest recorded. Agree scope before building.')).toBeVisible();
  await page.reload();
  await expect(card.getByLabel(`Status for ${name}`)).toHaveValue('call');

  // Edit.
  await card.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByLabel('Next action').fill('Agree the scope');
  await page.getByRole('button',{name:'Save contact',exact:true}).click();
  await expect(card.getByText('Next: Agree the scope',{exact:true})).toBeVisible();

  // Without links the draft is disabled; after saving them it opens.
  await expect(card.getByRole('link',{name:'Open offer draft'})).toHaveCount(0);
  await page.locator('#settings summary').click();
  await page.getByLabel('CAL_LINK').fill('https://cal.com/gabe/intro');
  await page.getByLabel('REVOLUT_LINK').fill('https://revolut.me/gabe');
  await page.getByRole('button',{name:'Save links'}).click();
  await expect(page.locator('#message')).toHaveText('Links saved. Drafts still require your review and send.');
  const draft=card.getByRole('link',{name:'Open offer draft'});
  await expect(draft).toHaveAttribute('href',/^mailto:/);
  expect(decodeURIComponent(await draft.getAttribute('href'))).toContain('https://revolut.me/gabe');
  await card.locator('summary',{hasText:'First-message draft'}).click();
  await expect(card.getByRole('link',{name:'Send · open draft'})).toHaveAttribute('href',/^mailto:/);

  // Done hides it from open leads, Done view shows it.
  await card.getByRole('button',{name:'Done',exact:true}).click();
  await expect(card).toHaveCount(0);
  await page.getByLabel('View').selectOption('done');
  await expect(card).toBeVisible();

  // No horizontal scroll on the phone layout.
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

  // Lock ends the session.
  await page.getByRole('button',{name:'Lock'}).click();
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  expect((await page.request.get(`${BASE}/data.json`)).status()).toBe(401);
  expect(errors).toEqual([]);
});

test('storage outage: login still works and the dashboard says what is wrong',async({page,request})=>{
  await redis(request,false);
  await unlock(page);
  await expect(page.getByRole('heading',{name:/one client/})).toBeVisible();
  await expect(page.locator('#message')).toContainText('Storage is unreachable');
  await expect(page.locator('body')).not.toContainText('{"error"');
  await redis(request,true);
  await page.getByRole('button',{name:'Refresh'}).click();
  await expect(page.locator('#message')).toHaveText('');
});
