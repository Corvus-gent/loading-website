import {test, expect} from '@playwright/test';

const languages=['Afrikaans','Arabic','Chinese','Dutch','English','French','Frisian','German','Greek','Japanese','Korean','Spanish'];
async function openGame(page, type='babel') {
  const posted=[], errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/js/vendor/posthog-*.min.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.addInitScript(type=>{
    localStorage.setItem('lang','en');
    localStorage.setItem(`game-help:${type}`,'1');
    window.posthog={init(){},capture(){}};
  },type);
  await page.route('https://**/*',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.route('**/api/geo?country=1',route=>route.fulfill({json:{countryCode:'BE'}}));
  await page.route('**/api/game**',route=>{
    if(route.request().method()==='POST')posted.push(route.request().postDataJSON());
    return route.fulfill({json:{day:'2026-11-04',n:1,type,rotation:['babel','borders','wordle'],tomorrow:'borders',
      hint:type==='borders'?[[[0,0],[1,0],[1,1],[0,0]]]:['bonjour, le monde.'],
      options:type==='wordle'?[]:type==='borders'?['France','Spain']:languages,
      history:posted.map(p=>({guess:p.value,feedback:'🟨',stage:0})),done:false,solved:false,cells:[],light:0,max:6}});
  });
  await page.goto('/games/');
  await expect(page.locator('#game-title')).toHaveText(type);
  return {posted,errors};
}

test('Babel filters languages, supports arrow keys, and selects before submitting',async({page})=>{
  const {posted,errors}=await openGame(page);
  const input=page.getByRole('combobox',{name:'your guess'});
  await input.fill('Fr');
  await expect(page.getByRole('option')).toHaveText(['French','Frisian','Afrikaans']);
  await expect(input).toHaveAttribute('aria-expanded','true');
  await input.press('ArrowDown');
  await expect(page.getByRole('option',{name:'French',exact:true})).toHaveAttribute('aria-selected','true');
  await input.press('ArrowDown');
  await expect(page.getByRole('option',{name:'Frisian',exact:true})).toHaveAttribute('aria-selected','true');
  await input.press('ArrowUp');
  await input.press('Enter');
  await expect(input).toHaveValue('French');
  await expect(page.getByRole('listbox')).toBeHidden();
  expect(posted).toHaveLength(0);
  await page.getByRole('button',{name:'guess →',exact:true}).click();
  await expect(page.locator('#attempts li')).toHaveText(['French: 🟨']);
  expect(posted.map(p=>p.value)).toEqual(['French']);
  await input.click();
  await expect(page.getByRole('option')).toHaveCount(languages.length);
  expect(errors).toEqual([]);
});

test('Babel shows empty results and closes with Escape, Tab or an outside click',async({page})=>{
  const {posted,errors}=await openGame(page);
  const input=page.getByRole('combobox');
  await input.fill('zzzzzz');
  await expect(page.getByText('no matching choices',{exact:true})).toBeVisible();
  await input.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded','false');
  await input.fill('');
  await expect(page.getByRole('option')).toHaveCount(languages.length);
  await input.press('Tab');
  await expect(page.getByRole('listbox')).toBeHidden();
  await page.getByRole('button',{name:'show choices'}).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('button',{name:'show choices'}).click();
  await expect(page.getByRole('listbox')).toBeHidden();
  await input.click();
  await page.locator('#game-title').click();
  await expect(page.getByRole('listbox')).toBeHidden();
  expect(posted).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('Borders uses the same filtered country picker',async({page})=>{
  const {posted,errors}=await openGame(page,'borders');
  const input=page.getByRole('combobox');
  await input.fill('fra');
  await expect(page.getByRole('option')).toHaveText(['France']);
  await page.getByRole('option',{name:'France'}).click();
  await page.getByRole('button',{name:'guess →',exact:true}).click();
  await expect(page.locator('#attempts li')).toHaveText(['France: 🟨']);
  expect(posted[0].value).toBe('France');
  expect(errors).toEqual([]);
});

test('Wordle keeps plain text input and Enter submits its guess',async({page})=>{
  const {posted,errors}=await openGame(page,'wordle');
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'show choices'})).toBeHidden();
  await page.getByLabel('your guess',{exact:true}).fill('hello');
  await page.getByLabel('your guess',{exact:true}).press('Enter');
  await expect(page.locator('#attempts li')).toHaveText(['hello: 🟨']);
  expect(posted[0].value).toBe('hello');
  expect(errors).toEqual([]);
});

test.describe('touchscreen',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  test('Babel opens above the field when space below is limited',async({page})=>{
    await page.setViewportSize({width:390,height:500});
    await openGame(page);
    const input=page.getByRole('combobox');
    await input.evaluate(element=>element.scrollIntoView({block:'end'}));
    await input.fill('fr');
    await expect(page.locator('#guess-picker')).toHaveClass(/opens-above/);
    const field=await input.boundingBox(),list=await page.getByRole('listbox').boundingBox();
    expect(list.y).toBeGreaterThanOrEqual(0);
    expect(list.y+list.height).toBeLessThanOrEqual(field.y);
    await page.getByRole('option',{name:'French',exact:true}).tap();
    await expect(input).toHaveValue('French');
  });
  test('Babel opens, filters and selects by touch without submitting early',async({page})=>{
    const {posted,errors}=await openGame(page);
    await page.getByRole('button',{name:'show choices'}).tap();
    await expect(page.getByRole('option')).toHaveCount(languages.length);
    const list=page.getByRole('listbox');
    expect(await list.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
    const input=page.getByRole('combobox');
    await input.fill('fren');
    await expect(page.getByRole('option')).toHaveText(['French']);
    await page.screenshot({path:'test-results/babel-dropdown-mobile.png',fullPage:true});
    const box=await page.getByRole('option',{name:'French'}).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x+box.width).toBeLessThanOrEqual(390);
    await page.getByRole('option',{name:'French'}).tap();
    await expect(input).toHaveValue('French');
    await expect(list).toBeHidden();
    expect(posted).toHaveLength(0);
    await page.getByRole('button',{name:'guess →',exact:true}).tap();
    await expect(page.locator('#attempts li')).toHaveText(['French: 🟨']);
    expect(posted.map(p=>p.value)).toEqual(['French']);
    expect(errors).toEqual([]);
  });
});
