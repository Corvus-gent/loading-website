import {test,expect} from '@playwright/test';
import {aggregate} from '../api/_x-data.js';
const row={id:'1',date:'2026-11-04',hour:9,region:'eu',type:'post',voice:'dry',lane:'builders',campaign:'launch',campaign_key:'launch',target_url:'https://x.com/other/status/123',my_url:'https://x.com/gabe_maxxing/status/1234',text:'a post from gabe <script>window.bad=true</script>',link:'https://corvus.gent/call/',link_type:'corvus',valid:true,saved:{synced_at:'2026-11-04T12:00:00Z'}};
const snapshot=aggregate([{...row},{...row,id:'2',type:'reply',text:'PRIVATE REPLY TEXT'}],[['2026-11-04','launch','eu-9','corvus',6]],'2026-11-04T12:00:00Z');
async function setup(page,{data=snapshot.public,privateLog=false,fail=false}={}){
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/api/stats'){
   const name=url.searchParams.get('page'),day=url.searchParams.get('day'),now=new Date().toISOString();
   return route.fulfill({json:{page:name,day,updated:now,checked:now,state:name==='private'&&!privateLog?'login':'ready',viewer:name==='private'&&privateLog?'gabriel@corvus.gent':undefined,data:name==='private'?(privateLog?{}:null):fail?{ready:true,state:'unavailable'}:data}});
  }
  if(url.pathname==='/api/auth')return route.fulfill({json:{email:privateLog?'gabriel@corvus.gent':null}});
  if(url.pathname==='/api/sf')return route.fulfill({json:{rows:[],total:0,page:1,pages:1,funnel:{}}});
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
 expect(await page.locator('#section-output').innerText()).not.toContain('PRIVATE REPLY TEXT');expect(await page.locator('#section-output').innerHTML()).not.toContain('other/status');expect(await page.evaluate(()=>window.bad)).toBeUndefined();expect(requests.filter(url=>url.includes('/api/stats?page=x'))).toHaveLength(1);expect(requests.some(url=>url.includes('api.notion.com'))).toBe(false);expect(await context.cookies()).toEqual([]);expect(errors).toEqual([]);
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
 const {errors,requests}=await setup(page,{privateLog:true});await page.goto('/stats/private/');await page.locator('#x-log').scrollIntoViewIfNeeded();await expect(page.locator('#x-log .x-private-table tr')).toHaveCount(51);await expect(page.locator('#x-log > [role=status]')).toContainText('2000 rows');await page.getByRole('button',{name:'next →',exact:true}).click();await expect(page.locator('#x-log .x-pager')).toContainText('2 / 40');expect(requests.some(url=>url.includes('page=2'))).toBe(true);
 await page.getByLabel('voice',{exact:true}).selectOption('dry');await page.getByLabel('region',{exact:true}).selectOption('sf');await page.getByLabel('date',{exact:true}).fill('2026-11-04');await page.getByRole('button',{name:'filter',exact:true}).click();await expect(page.locator('#x-log > [role=status]')).toContainText('1 rows');await expect(page.locator('#x-log .x-private-table tr')).toHaveCount(2);expect(requests.some(url=>url.includes('region=sf')&&url.includes('voice=dry')&&url.includes('date=2026-11-04'))).toBe(true);
 await page.getByRole('button',{name:'sync now'}).click();await expect(page.locator('#x-log > [role=status]')).toContainText('next sync in 2 min');expect(errors).toEqual([]);
});
test('logged-out dashboard never requests the private X rows',async({page})=>{
 const {requests,errors}=await setup(page);await page.goto('/stats/private/');await expect(page.locator('#f-mail')).toBeVisible();await page.waitForTimeout(300);expect(requests.some(url=>url.includes('/api/x-stats'))).toBe(false);expect(errors).toEqual([]);
});
test('two city clocks work before setup and the planner crosses dates in either direction',async({page})=>{
 await page.clock.install({time:new Date('2026-11-04T12:00:00Z')});
 const {errors,requests}=await setup(page,{data:{ready:false}});await page.goto('/stats/x/');
 await expect(page.locator('.x-bx time')).toHaveText('13:00');await expect(page.locator('.x-sf time')).toHaveText('04:00');
 await expect(page.locator('.x-clock-bridge')).toHaveText('sf is 9h behind bx · same date');
 await page.getByText('plan across the pond ↔',{exact:true}).click();
 await page.getByLabel('planning time',{exact:true}).fill('08:00');await page.getByLabel('planning time',{exact:true}).blur();
 await expect(page.locator('.x-sf time')).toHaveText('23:00');await expect(page.locator('.x-sf .x-clock-date')).toHaveText('2026-11-03');
 await expect(page.locator('.x-clock-bridge')).toContainText('previous day in sf');
 await page.getByLabel('plan in',{exact:true}).selectOption('sf');
 await expect(page.getByLabel('planning date',{exact:true})).toHaveValue('2026-11-03');
 await page.getByLabel('planning date',{exact:true}).fill('2026-11-04');
 await page.getByLabel('planning time',{exact:true}).fill('09:00');await page.getByLabel('planning time',{exact:true}).blur();
 await expect(page.locator('.x-bx time')).toHaveText('18:00');await expect(page.locator('.x-clock-mode')).toHaveText('your planned moment');
 await page.getByRole('button',{name:'back to now'}).click();await expect(page.locator('.x-clock-mode')).toHaveText('live now');await expect(page.locator('.x-bx time')).toHaveText('13:00');
 await page.clock.runFor(60000);await expect(page.locator('.x-bx time')).toHaveText('13:01');await expect(page.locator('.x-sf time')).toHaveText('04:01');
 expect(requests.filter(url=>url.includes('/api/stats?page=x'))).toHaveLength(1);expect(errors).toEqual([]);
});
test('clock planner handles different DST weeks, skipped hours and repeated hours',async({page})=>{
 await setup(page);await page.goto('/stats/x/');await page.getByText('plan across the pond ↔',{exact:true}).click();
 await page.getByLabel('planning date',{exact:true}).fill('2026-10-28');await page.getByLabel('planning time',{exact:true}).fill('12:00');await page.getByLabel('planning time',{exact:true}).blur();
 await expect(page.locator('.x-clock-bridge')).toContainText('8h behind');await expect(page.locator('.x-sf time')).toHaveText('04:00');
 await page.getByLabel('plan in',{exact:true}).selectOption('sf');await page.getByLabel('planning date',{exact:true}).fill('2026-11-01');await page.getByLabel('planning time',{exact:true}).fill('01:30');await page.getByLabel('planning time',{exact:true}).blur();
 await expect(page.getByLabel('repeated hour',{exact:true})).toBeVisible();await expect(page.locator('.x-bx time')).toHaveText('09:30');
 await page.getByLabel('repeated hour',{exact:true}).selectOption('1');await expect(page.locator('.x-bx time')).toHaveText('10:30');
 await page.getByLabel('plan in',{exact:true}).selectOption('bx');await page.getByLabel('plan in',{exact:true}).selectOption('sf');await expect(page.getByLabel('repeated hour',{exact:true})).toHaveValue('1');
 await page.getByLabel('planning date',{exact:true}).fill('2026-03-08');await page.getByLabel('planning time',{exact:true}).fill('02:30');await page.getByLabel('planning time',{exact:true}).blur();
 await expect(page.locator('.x-clock-message')).toContainText('does not exist');await expect(page.locator('.x-clock-pair')).toBeHidden();
 await page.getByRole('button',{name:'back to now'}).click();await expect(page.locator('.x-clock-pair')).toBeVisible();await expect(page.locator('.x-clock-message')).toBeEmpty();
});
test('private rows show both dates and label the CSV clock and audience separately',async({page})=>{
 const {errors}=await setup(page,{privateLog:true});await page.goto('/stats/private/');await page.locator('#x-log').scrollIntoViewIfNeeded();
 const table=page.locator('.x-private-table');await expect(table.getByRole('columnheader',{name:'date · bx',exact:true})).toBeVisible();await expect(table.getByRole('columnheader',{name:'date + time · sf',exact:true})).toBeVisible();
 await expect(table.locator('tr').nth(1).locator('td').nth(2)).toHaveText('2026-11-04 00:00');await expect(page.getByText('csv + date filter: bx / brussels. sf time is shown beside every row. region chooses the audience.')).toBeVisible();expect(errors).toEqual([]);
});
test('two-clock planner stays readable on a narrow phone',async({page})=>{
 await page.setViewportSize({width:320,height:760});const {errors}=await setup(page);await page.goto('/stats/x/');await page.getByText('plan across the pond ↔',{exact:true}).click();
 await expect(page.locator('.x-bx time')).toBeVisible();await expect(page.locator('.x-sf time')).toBeVisible();await expect(page.getByLabel('planning time',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/x-clocks-mobile.png',fullPage:true});
});
