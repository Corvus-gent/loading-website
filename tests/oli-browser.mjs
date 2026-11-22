import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium, devices, expect } from '@playwright/test';

const files = {
  '/bjj/oli': ['bjj/oli/index.html', 'text/html'],
  '/bjj/oli/room.js': ['bjj/oli/room.js', 'text/javascript'],
  '/bjj/oli/room.css': ['bjj/oli/room.css', 'text/css'],
  '/styles.css': ['styles.css', 'text/css']
};
const server = http.createServer(async (req, res) => {
  const file = files[req.url];
  if (!file) return res.writeHead(404).end();
  res.setHeader('Content-Type', file[1]);
  res.end(await fs.readFile(file[0]));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.OLI_TEST_CHROMIUM });
  const phone = await browser.newPage({ ...devices['iPhone 13'], defaultBrowserType: undefined });
  const errors = [];
  phone.on('pageerror', error => errors.push(error.message));
  await phone.clock.install();
  const empty = { versions: [], chat: [], jobs: [] };
  const fixture = {
    versions: [
      { label: 'v3', url: '/api/oli/media?file=mock-v3', changelog: 'Tighter opening and cleaner title.' },
      { label: 'v2', url: '/api/oli/media?file=mock-v2', changelog: 'First review cut' }
    ],
    chat: [
      { role: 'user', content: 'Could the grip sequence come in a beat earlier?', atTime: 12 },
      { role: 'assistant', content: 'I’ll tighten the lead-in to that sequence.', proposal: { id: 'mock', summary: 'Trim clip 3 by 0.5 s', status: 'proposed' } }
    ],
    jobs: [{ id: 'mock', status: 'queued' }]
  };
  let unlocked = false;
  let enChecks = 0;
  await phone.route('**/api/oli/**', async route => {
    const url = new URL(route.request().url());
    switch (url.pathname) {
      case '/api/oli/access':
        unlocked = route.request().postDataJSON().passcode === 'fixture';
        return route.fulfill({ status: unlocked ? 200 : 401, json: { ok: unlocked } });
      case '/api/oli/state':
        if (!unlocked) return route.fulfill({ status: 401, json: { error: 'Enter the review passcode.' } });
        if (url.searchParams.get('variant') === 'en') {
          if (++enChecks > 1) fixture.jobs[0].status = 'rendering';
          return route.fulfill({ json: fixture });
        }
        return route.fulfill({ json: empty });
      case '/api/oli/chat': {
        const body = route.request().postDataJSON();
        assert.equal(body.atTime, 12);
        assert.deepEqual(body.driveLinks, ['https://drive.google.com/file/d/123/view']);
        assert.equal(body.messages[0].content, 'Look at this');
        return route.fulfill({ json: fixture });
      }
      default:
        return route.fulfill({ status: 200, contentType: 'video/mp4', body: '' });
    }
  });
  await phone.goto(`http://127.0.0.1:${server.address().port}/bjj/oli`);
  await expect(phone.getByLabel('Review passcode')).toBeVisible();
  await expect(phone.getByRole('heading', { name: 'Editor' })).toBeHidden();
  assert.match(await phone.locator('meta[name=robots]').getAttribute('content'), /noindex,nofollow/);
  await phone.getByLabel('Review passcode').fill('fixture');
  await phone.getByRole('button', { name: 'Unlock' }).click();
  await expect(phone.getByLabel('Cut version')).toHaveValue('v3');
  await expect(phone.locator('.diff')).toContainText('Queued');
  await phone.clock.runFor(5100);
  await expect(phone.locator('.diff')).toContainText('Rendering');
  await phone.getByLabel('Cut version').selectOption('v2');
  await expect(phone.locator('#changelog')).toHaveText('First review cut');
  await phone.getByLabel('Cut version').selectOption('v3');
  await phone.locator('video').evaluate(video => {
    Object.defineProperty(video, 'currentTime', { value: 12 });
    video.dispatchEvent(new Event('timeupdate'));
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    const fill = ctx.createLinearGradient(0, 0, 360, 640);
    fill.addColorStop(0, '#303b4f');
    fill.addColorStop(1, '#171b28');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 360, 640);
    ctx.font = '24px system-ui';
    ctx.fillStyle = '#eef0f7';
    ctx.textAlign = 'center';
    ctx.fillText('Mock preview', 180, 320);
    video.poster = canvas.toDataURL('image/png');
    video.preload = 'none';
    video.load();
  });
  await phone.getByRole('button', { name: 'Attach current video time' }).click();
  await expect(phone.locator('#timestamp')).toHaveText('@ 0:12');
  await phone.getByLabel('Message the editor').fill('Look at this https://drive.google.com/file/d/123/view');
  await phone.getByRole('button', { name: 'Send' }).click();
  await expect(phone.getByLabel('Message the editor')).toHaveValue('');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const screenshot = process.env.OLI_SCREENSHOT || 'test-results/oli/phone.png';
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await phone.screenshot({ path: screenshot, fullPage: true });
  await phone.getByRole('button', { name: 'YouTube long-form' }).click();
  await expect(phone.getByText('In production — first cut coming')).toBeVisible();
  await expect(phone.getByLabel('Cut version')).toBeHidden();
  assert.deepEqual(errors, []);
  console.log('Oli phone view, passcode, polling, version picker, timestamp and Drive notes passed.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
