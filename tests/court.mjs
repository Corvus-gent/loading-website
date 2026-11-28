// Run with node --experimental-vm-modules tests/court.mjs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import vm from 'node:vm';
import {chromium} from 'playwright';
import middleware, {config} from '../middleware.js';

const assetPath = '/api/_court/art/corvus.png';
assert.ok(config.matcher.includes('/api/_court/:path*'));
assert.equal((await middleware(new Request('https://corvus.gent' + assetPath))).status, 404);

const handlerURL = new URL('../api/_court/handler.js', import.meta.url);
const context = vm.createContext({URL, URLSearchParams, encodeURIComponent, process: {env: {VERCEL_ENV: 'test'}}});
const held = new Set();
let offline = false;
let failNextRead = false;
async function redis([command, key, name]) {
  assert.equal(key, 'court:held:v1:test');
  if (offline || (command === 'SMEMBERS' && failNextRead)) {
    failNextRead = false;
    throw new Error('Storage unavailable');
  }
  if (command === 'SMEMBERS') return [...held];
  if (command === 'SADD') return held.add(name);
  if (command === 'SREM') return held.delete(name);
  assert.fail(command);
}
const deps = {
  '../_session.js': {getSession: req => ({email: req.headers['test-session']})},
  '../_redis.js': {redis}, 'node:fs/promises': {readFile}
};
const mod = new vm.SourceTextModule(await readFile(handlerURL, 'utf8'), {
  context, initializeImportMeta(meta) { meta.url = handlerURL.href; }
});
await mod.link(spec => new vm.SyntheticModule(Object.keys(deps[spec]), function () {
  for (const [name, fn] of Object.entries(deps[spec])) this.setExport(name, fn);
}, {context}));
await mod.evaluate();
const handler = mod.namespace.default;
const server = createServer(async (req, res) => {
  if (req.url === '/court/style.css') {
    res.setHeader('Content-Type', 'text/css');
    return res.end(await readFile(new URL('../court/style.css', import.meta.url)));
  }
  const url = new URL(req.url, 'http://localhost');
  req.query = {court: url.pathname === '/court/manage' ? 'manage' : 'gallery'};
  let body = '';
  for await (const chunk of req) body += chunk;
  req.body = body;
  res.status = code => { res.statusCode = code; return res; };
  res.send = value => res.end(value);
  await handler(req, res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const host = '127.0.0.1:' + server.address().port;
const base = 'http://' + host;
let browser;
try {
  const entry = await fetch(base + '/court?acknowledge=court-2026-11-28');
  assert.equal(entry.status, 200);
  assert.equal(entry.headers.get('set-cookie'), null);
  assert.match(entry.headers.get('cache-control'), /no-store/);
  assert.doesNotMatch(await entry.text(), /data:image\/png/);
  const post = (url, fields, headers) => fetch(base + url, {
    method: 'POST', body: new URLSearchParams(fields), headers, redirect: 'manual'
  });
  assert.equal((await post('/court', {})).status, 400);
  const manage = (action, figure, origin = 'https://' + host) => post('/court/manage', {action, figure}, {'test-session':'gabriel@corvus.gent', origin});
  assert.equal((await post('/court/manage',{action:'hold',figure:'Corvus'})).status, 403);
  assert.equal((await manage('hold','Corvus','https://elsewhere.invalid')).status, 403);
  assert.equal((await manage('hold','Unknown')).status, 400);
  browser = await chromium.launch(process.env.COURT_CHROME_CHANNEL ? {channel:process.env.COURT_CHROME_CHANNEL} : {});
  const page = await browser.newPage({javaScriptEnabled:false, viewport:{width:390,height:844}});
  await page.goto(base + '/court');
  await page.getByRole('button', {name:'Enter the gallery'}).click();
  assert.equal(await page.locator('img').count(), 0);
  await page.getByRole('checkbox').check();
  await Promise.all([page.waitForNavigation(),page.getByRole('button', {name:'Enter the gallery'}).click()]);
  assert.equal(await page.locator('li img').count(), 16);
  assert.equal(await page.locator('li img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const report = await page.getByRole('link',{name:'Report a rights concern about Jester'}).getAttribute('href');
  assert.match(decodeURIComponent(report), /mailto:hello@corvus.gent.*court#jester/s);
  assert.equal((await page.context().cookies()).length, 0);
  for (const action of ['hold', 'hold', 'restore', 'restore']) {
    assert.equal((await manage(action,'Corvus')).status, 303);
    const response = await post('/court', {acknowledge:'court-2026-11-28'});
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.equal(html.includes('<li id="corvus">'), action === 'restore');
    assert.equal(html.match(/data:image\/png;base64/g).length, action === 'restore' ? 16 : 15);
  }
  failNextRead = true;
  assert.equal((await post('/court', {acknowledge:'court-2026-11-28'})).status, 200);
  offline = true;
  const closed = await post('/court',{acknowledge:'court-2026-11-28'});
  assert.equal(closed.status, 503);
  assert.doesNotMatch(await closed.text(), /data:image\/png/);
  console.log('Passed mobile entry without JavaScript, all 16 images, report links, owner holds, restores and storage outage handling.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
