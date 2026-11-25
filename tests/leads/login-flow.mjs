// Real user-flow login test: real HTTPS, real browser-generated Origin / Sec-Fetch-* headers (nothing injected),
// the site's global `Referrer-Policy: no-referrer` header, and DuckDuckGo mobile user agents on WebKit (iOS) and
// Chromium (Android). This is the flow that failed with {"error":"Same-origin login required"}.
// Usage: node tests/leads/login-flow.mjs [chromium,webkit]
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium, webkit, devices } from '@playwright/test';
import { createHandler } from '../../api/_leads/handler.js';
import { memory, env } from './helper.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leads-tls-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
  '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem')], { stdio: 'ignore' });

const seen = [];
const handler = createHandler({ db: memory(), env });
const server = https.createServer({ key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) }, async (req, res) => {
  const url = new URL(req.url, 'https://' + req.headers.host);
  // Like vercel.json: every response carries the global no-referrer header (applied last, as Vercel does).
  const setHeader = res.setHeader.bind(res);
  res.setHeader = (k, v) => setHeader(k, k.toLowerCase() === 'referrer-policy' ? 'no-referrer' : v);
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (url.pathname === '/evil') { // a cross-site page that tries to post the login form
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<form id=f method=post action="${url.searchParams.get('to')}"><input name=password value="${env.LEADS_PASSWORD}"></form><script>f.submit()</script>`);
  }
  if (!url.pathname.startsWith('/scraper/fiverr-leads')) { res.statusCode = 404; return res.end(); }
  let raw = ''; for await (const c of req) raw += c;
  const action = url.pathname.split('/').filter(Boolean)[2] || 'page';
  if (req.method === 'POST') seen.push({ action, origin: req.headers.origin, site: req.headers['sec-fetch-site'] });
  const adapter = {
    setHeader: (k, v) => res.setHeader(k, v),
    status: n => ((res.statusCode = n), adapter),
    json: b => { setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); },
    send: b => res.end(b),
    end: () => res.end(),
  };
  await handler({ query: { leadsAction: action }, method: req.method, headers: req.headers, body: raw }, adapter);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `https://127.0.0.1:${port}/scraper/fiverr-leads`;

const DDG_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15';
const DDG_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 DuckDuckGo/5';
const wanted = (process.argv[2] || 'chromium,webkit').split(',');
const runs = [
  wanted.includes('webkit') && { name: 'DuckDuckGo iOS (WebKit)', type: webkit, ctx: { ...devices['iPhone 13'], userAgent: DDG_IOS } },
  wanted.includes('webkit') && { name: 'Safari desktop (WebKit)', type: webkit, ctx: { viewport: { width: 1280, height: 800 } } },
  wanted.includes('chromium') && { name: 'DuckDuckGo Android (Chromium)', type: chromium, ctx: { ...devices['Pixel 7'], userAgent: DDG_ANDROID } },
  wanted.includes('chromium') && { name: 'Chrome desktop', type: chromium, ctx: { viewport: { width: 1280, height: 800 } } },
].filter(Boolean);

let failed = 0;
try {
  for (const run of runs) {
    const browser = await run.type.launch();
    try {
      const context = await browser.newContext({ ...run.ctx, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      seen.length = 0;
      await page.goto(base);
      await page.getByLabel('Password', { exact: true }).fill(env.LEADS_PASSWORD);
      await page.getByRole('button', { name: 'Unlock', exact: true }).click();
      await page.waitForLoadState('load');
      const text = await page.locator('body').innerText();
      assert.doesNotMatch(text, /Same-origin|did not match|Too many/, `${run.name}: login rejected → ${text.slice(0, 120)}`);
      await page.getByRole('button', { name: '＋ Add warm contact' }).waitFor({ timeout: 10000 });
      // A data-changing POST (save) must work too after login.
      await page.getByRole('button', { name: '＋ Add warm contact' }).click();
      await page.getByLabel('Name', { exact: true }).fill('Flow test ' + run.name);
      await page.getByLabel('Contact', { exact: true }).fill('flow@example.com');
      await page.getByLabel('What do they need?').fill('A landing page');
      await page.getByRole('button', { name: 'Save contact', exact: true }).click();
      await page.getByRole('heading', { name: 'Flow test ' + run.name }).waitFor({ timeout: 10000 });
      // A cross-site page must NOT be able to post the login form.
      const evil = await context.newPage();
      await evil.goto(`https://localhost:${port}/evil?to=${encodeURIComponent(base + '/login')}`);
      await evil.waitForLoadState('load');
      assert.match(await evil.locator('body').innerText(), /Same-origin login required/, `${run.name}: cross-site login was accepted`);
      console.log(`PASS ${run.name}: login + save ok, cross-site blocked. Headers seen: ${JSON.stringify(seen.slice(0, 2))}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${run.name}: ${e.message.split('\n')[0]} Headers seen: ${JSON.stringify(seen)}`);
    } finally { await browser.close(); }
  }
} finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
if (failed) process.exit(1);
console.log('Login flow OK on', runs.map(r => r.name).join(', '), '— no messages sent.');
