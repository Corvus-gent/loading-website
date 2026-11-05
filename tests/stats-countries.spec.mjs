import {test,expect} from '@playwright/test';
const countries=[{c:'FR',n:6},{c:'BE',n:12},{c:'US',n:5},{c:'NL',n:4},{c:'DE',n:3},{c:'PT',n:2},{c:'GB',n:2},{c:'NZ',n:1},{c:'?',n:1}];
const sdk=`window.posthog={props:{},register(p){Object.assign(this.props,p)},capture(){},init(token,c){window.testAnalyticsConfig={cookieless:c.cookieless_mode};c.loaded(this);window.testPageview={...this.props};}};`;
const leaflet=`window.L={map:()=>({setView(){return this},attributionControl:{addAttribution(){}},invalidateSize(){},getZoom(){return 2},on(){}}),layerGroup:()=>({addTo(){return this},clearLayers(){}})};`;
async function setup(page,{empty=false,statsFailure=false,countryFailure=false}={}){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('lang','en');window.__phProps={links_source:'buymeacoffee'};});
  await page.route('**/js/vendor/posthog-*.min.js',route=>route.fulfill({contentType:'text/javascript',body:sdk}));
  await page.route('https://**/*',route=>{
    const url=route.request().url();
    return route.fulfill({contentType:url.endsWith('.css')?'text/css':'text/javascript',body:url.includes('/static/array.js')?sdk:url.endsWith('/leaflet.js')?leaflet:''});
  });
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels'}).format(new Date());
  await page.route('**/api/geo**',route=>{
    const u=new URL(route.request().url());
    if(u.searchParams.has('country'))return route.fulfill({status:countryFailure?503:200,json:countryFailure?{error:'unavailable'}:{countryCode:'BE'}});
    return route.fulfill({status:u.searchParams.has('tiles')?200:503,json:u.searchParams.has('tiles')?{available:false}:{error:'unavailable'}});
  });
  await page.route('**/api/stats**',route=>{
    const u=new URL(route.request().url());
    if(u.searchParams.has('section'))return route.fulfill({json:{hosts:[]}});
    if(statsFailure)return route.fulfill({status:503,json:{error:'unavailable'}});
    const day=u.searchParams.get('day')||today;
    return route.fulfill({json:{day,visitors:empty?0:36,total:90,hours:[],countries:empty?[]:day===today?countries:[{c:'BR',n:2}],sources:[],pages:[],browsers:[],cli:{day:{},all:{}},feathers:0,hunters:0,terminal:[],updated:new Date().toISOString()}});
  });
  return {errors};
}

test('overview shows all countries and daily unique counts above the hours, with a map CTA',async({page})=>{
  const {errors}=await setup(page);
  await page.goto('/stats/');
  await expect(page.locator('.country-row')).toHaveCount(9);
  await expect(page.locator('.country-name').first()).toHaveText('Belgium');
  await expect(page.locator('.country-count').first()).toHaveText('12');
  await expect(page.locator('.country-name').last()).toHaveText('unknown location');
  await expect(page.locator('#countries-period')).toContainText('today');
  expect(await page.locator('.country-section').evaluate(e=>Boolean(e.compareDocumentPosition(document.getElementById('hours'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.getByRole('link',{name:'see the all-time visitor map →'})).toHaveAttribute('href',/^https:\/\/stats\.corvus\.gent\/map/);
  await page.getByRole('button',{name:'previous day'}).click();
  await expect(page.locator('.country-row')).toHaveCount(1);
  await expect(page.locator('.country-name')).toHaveText('Brazil');
  await expect(page.locator('.country-count')).toHaveText('2');
  await expect(page.locator('#countries-period')).not.toContainText('today');
  expect(errors).toEqual([]);
});

test('map keeps today’s country list below the map even if geo data fails',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const {errors}=await setup(page);
  await page.goto('/stats/map/');
  await expect(page.locator('#visitor-map-status')).toHaveText('the lantern is out.');
  await expect(page.locator('.country-row')).toHaveCount(9);
  await expect(page.locator('.country-name').first()).toHaveText('Belgium');
  await expect(page.locator('#countries-period')).toContainText('today');
  expect(await page.locator('#visitor-map').evaluate(e=>Boolean(e.compareDocumentPosition(document.querySelector('.country-section'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.country-section').screenshot({path:'test-results/stats-countries-mobile.png'});
  expect(errors).toEqual([]);
});

test('country lists show an honest empty state',async({page})=>{
  const {errors}=await setup(page,{empty:true});
  await page.goto('/stats/');
  await expect(page.locator('#countries')).toHaveText('no visitors recorded for this day yet.');
  await expect(page.locator('.country-row')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('map country request failure stays contained to its own panel',async({page})=>{
  const {errors}=await setup(page,{statsFailure:true});
  await page.goto('/stats/map/');
  await expect(page.locator('#countries')).toHaveText('country counts are unavailable. try again shortly.');
  await expect(page.locator('#visitor-map')).toBeVisible();
  expect(errors).toEqual([]);
});

test('analytics receives the coarse country before its first pageview and keeps source attribution',async({page})=>{
  await setup(page);
  await page.goto('/stats/');
  await page.locator('#privacy-notice [data-allow]').click();
  await expect.poll(()=>page.evaluate(()=>window.testPageview)).toEqual({links_source:'buymeacoffee',corvus_country_code:'BE'});
  expect(await page.evaluate(()=>window.testAnalyticsConfig.cookieless)).toBe('always');
});

test('analytics still initializes when the country lookup fails',async({page})=>{
  const {errors}=await setup(page,{countryFailure:true});
  await page.goto('/stats/');
  await page.locator('#privacy-notice [data-allow]').click();
  await expect.poll(()=>page.evaluate(()=>window.testPageview)).toEqual({links_source:'buymeacoffee'});
  expect(errors).toEqual([]);
});
