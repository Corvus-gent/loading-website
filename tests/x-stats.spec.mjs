import {test,expect} from '@playwright/test';
import {aggregate} from '../api/_x-data.js';
const row={id:'1',date:'2026-11-04',hour:9,region:'eu',type:'post',voice:'dry',lane:'builders',campaign:'launch',campaign_key:'launch',target_url:'https://x.com/other/status/123',my_url:'https://x.com/gabe_maxxing/status/1234',text:'a post from gabe <script>window.bad=true</script>',link:'https://corvus.gent/call/',link_type:'corvus',valid:true,saved:{synced_at:'2026-11-04T12:00:00Z'}};
const snapshot=aggregate([{...row},{...row,id:'2',type:'reply',text:'PRIVATE REPLY TEXT'}],[['2026-11-04','launch','eu-9','corvus',6]],'2026-11-04T12:00:00Z');
async function setup(page,{data=snapshot.public,privateLog=false,fail=false}={}){
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/api/auth')return route.fulfill({json:{email:privateLog?'gabriel@corvus.gent':null}});
  if(url.pathname==='/api/private-stats')return route.fulfill({json:{updated:'2026-11-04T12:00:00Z'}});
  if(url.pathname==='/api/x-stats'){
   if(fail)return route.fulfill({status:200,json:{ready:true,state:'unavailable'}});
   if(req.method()==='POST')return route.fulfill({status:202,json:{ready:true,state:'cooldown',retryAfter:120}});
   if(url.searchParams.has('private')){
    const pageNumber=Number(url.searchParams.get('page'))||1,filtered=url.searchParams.get('voice')==='dry';
    return route.fulfill({json:{ready:true,rows:Array.from({length:filtered?1:50},(_,i)=>({...snapshot.rows[i%2],id:String(i),synced_at:'2026-11-04T12:00:00Z'})),total:filtered?1:2000,page:pageNumber,pages:filtered?1:40,voices:['dry','warm'],state:'idle',updated:'2026-11-04T12:00:00Z'}});
   }
   return route.fulfill({json:data});
  }
  return route.fulfill({json:{}});
 });
 return {errors,requests};
}
test('public X page uses one aggregate request and never exposes reply data',async({page,context})=>{
 const {errors,requests}=await setup(page);await page.goto('/stats/x/');await expect(page.getByRole('heading',{name:'today · brussels'})).toBeVisible();await expect(page.locator('.x-heat span')).toHaveCount(24);await expect(page.getByRole('link',{name:'read the post ↗'})).toHaveAttribute('href','https://x.com/gabe_maxxing/status/1234');
 expect(await page.locator('#section-output').innerText()).not.toContain('PRIVATE REPLY TEXT');expect(await page.locator('#section-output').innerHTML()).not.toContain('other/status');expect(await page.evaluate(()=>window.bad)).toBeUndefined();expect(requests.filter(url=>url.includes('/api/x-stats'))).toHaveLength(1);expect(requests.some(url=>url.includes('api.notion.com'))).toBe(false);expect(await context.cookies()).toEqual([]);expect(errors).toEqual([]);
});
test('empty or unconfigured log stays readable',async({page})=>{
 const {errors}=await setup(page,{data:{ready:false}});await page.goto('/stats/x/');await expect(page.locator('#section-output')).toHaveText('the log is empty for now');expect(errors).toEqual([]);
});
test('configured empty database has honest zero totals and no invented winner',async({page})=>{
 const {errors}=await setup(page,{data:aggregate([],[],'2026-11-04T12:00:00Z').public});await page.goto('/stats/x/');await expect(page.getByText('best voice this week: waiting for a click.')).toBeVisible();await expect(page.getByText('no own posts logged yet.')).toBeVisible();expect(errors).toEqual([]);
});
test('provider failure has a quiet retry state',async({page})=>{
 const {errors}=await setup(page,{fail:true});await page.goto('/stats/x/');await expect(page.getByText('the log is resting. try again soon.')).toBeVisible();await page.getByRole('button',{name:'refresh',exact:true}).click();expect(errors).toEqual([]);
});
test('mobile public page fits without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:360,height:800});const {errors}=await setup(page);await page.goto('/stats/x/');await expect(page.locator('.x-heat')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByText('hourly numbers',{exact:true}).click();await expect(page.locator('details table')).toBeVisible();expect(errors).toEqual([]);
});
test('private 2,000-row table paginates, filters and guards sync feedback',async({page})=>{
 const {errors,requests}=await setup(page,{privateLog:true});await page.goto('/stats/private/');await expect(page.locator('#x-log .x-private-table tr')).toHaveCount(51);await expect(page.locator('#x-log [role=status]')).toContainText('2000 rows');await page.getByRole('button',{name:'next →',exact:true}).click();await expect(page.locator('.x-pager')).toContainText('2 / 40');expect(requests.some(url=>url.includes('page=2'))).toBe(true);
 await page.getByLabel('voice',{exact:true}).selectOption('dry');await page.getByLabel('region',{exact:true}).selectOption('sf');await page.getByLabel('date',{exact:true}).fill('2026-11-04');await page.getByRole('button',{name:'filter',exact:true}).click();await expect(page.locator('#x-log [role=status]')).toContainText('1 rows');await expect(page.locator('#x-log .x-private-table tr')).toHaveCount(2);expect(requests.some(url=>url.includes('region=sf')&&url.includes('voice=dry')&&url.includes('date=2026-11-04'))).toBe(true);
 await page.getByRole('button',{name:'sync now'}).click();await expect(page.locator('#x-log [role=status]')).toContainText('next sync in 2 min');expect(errors).toEqual([]);
});
test('logged-out dashboard never requests the private X rows',async({page})=>{
 const {requests,errors}=await setup(page);await page.goto('/stats/private/');await expect(page.locator('#f-mail')).toBeVisible();await page.waitForTimeout(300);expect(requests.some(url=>url.includes('/api/x-stats'))).toBe(false);expect(errors).toEqual([]);
});
