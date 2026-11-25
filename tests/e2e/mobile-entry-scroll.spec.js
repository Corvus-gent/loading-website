import {test,expect} from '@playwright/test';
test.beforeEach(async({page,baseURL})=>{await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'}));});
for(const day of ['mon','tue','wed','thu','fri','sat','sun'])test(`${day}: touch scrolling reaches the door with browser bars`,async({page})=>{
  test.skip(page.viewportSize().width>760,'Mobile entrance regression');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?entry='+day,{waitUntil:'domcontentloaded'});await expect(page.locator('body')).toHaveAttribute('data-entry-ready','true');
  const door=page.getByRole('link',{name:'enter the realm',exact:true});await expect(door).toHaveCSS('opacity','1');
  expect(await page.locator('#entry').evaluate(el=>getComputedStyle(el).touchAction)).toBe('pan-y');
  // Scroll the real document, rather than focus the invisible door as older tests did.
  await page.evaluate(()=>window.scrollTo(0,550));await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  await door.scrollIntoViewIfNeeded();const box=await door.boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(640);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await door.tap();await expect(page.locator('body')).not.toHaveClass(/entry-page/);expect(errors).toEqual([]);
});
test('Small viewport and keyboard resize keep the CTA reachable',async({page})=>{test.skip(page.viewportSize().width>760,'Mobile entrance regression');await page.goto('/?entry=mon',{waitUntil:'domcontentloaded'});await page.setViewportSize({width:375,height:420});await page.locator('#dio-input').fill('I build things');const door=page.getByRole('link',{name:'enter the realm',exact:true});await door.scrollIntoViewIfNeeded();await door.tap();await expect(page.locator('body')).not.toHaveClass(/entry-page/);});
test('A native touch swipe scrolls the entrance instead of dragging its background',async({page,browserName})=>{
  test.skip(browserName!=='chromium'||page.viewportSize().width>760,'Chromium touch gesture protocol');
  await page.goto('/?entry=mon');await expect(page.locator('body')).toHaveAttribute('data-entry-ready','true');
  const session=await page.context().newCDPSession(page);
  await session.send('Input.synthesizeScrollGesture',{x:50,y:400,yDistance:-300,gestureSourceType:'touch',speed:500});
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  const lantern=page.locator('#lantern'),b=await lantern.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y:y+45}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const moved=await lantern.boundingBox();expect(Math.abs(moved.x+moved.width/2-(x+35))).toBeLessThan(3);expect(Math.abs(moved.y+moved.height/2-(y+45))).toBeLessThan(3);
  await session.detach();
});
