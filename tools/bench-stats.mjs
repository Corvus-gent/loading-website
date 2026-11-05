// Usage: node tools/bench-stats.mjs https://stats.corvus.gent output.json
// For the local fixture, use its origin (it serves the same clean host routes).
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const [base, file] = process.argv.slice(2);
if (!base || !file) throw Error('supply the stats origin and output JSON path');
const browser = await chromium.launch(),
  rows = [];
const selectors = {
  overview: '#visitors',
  pidgy: '.flight',
  games: '#section-output h2',
  map: '.country-count',
  music: '.stat-item',
  hunt: '#section-output p',
  x: '.x-metrics dd',
  coffee: '[data-total]',
  private: '#out td',
  status: '.health-check'
};
try {
  for (const profile of ['normal', 'slow4g'])
    for (const [pageName, selector] of Object.entries(selectors)) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      let apiCount = 0;
      page.on('request', (r) => {
        const u = new URL(r.url());
        if (u.pathname.startsWith('/api/') && !u.searchParams.has('z')) apiCount++;
      });
      const cdp = await context.newCDPSession(page);
      if (profile === 'slow4g') {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 150,
          downloadThroughput: 1600000 / 8,
          uploadThroughput: 750000 / 8
        });
      }
      await page.addInitScript((selector) => {
        const observer = new MutationObserver(() => {
          const ready = Array.from(document.querySelectorAll(selector)).some(
            (el) => el.getBoundingClientRect().height && /\d/.test(el.textContent)
          );
          if (!ready) return;
          observer.disconnect();
          requestAnimationFrame(() => (window.__numbers = performance.now()));
        });
        observer.observe(document, { subtree: true, childList: true, characterData: true });
      }, selector);
      for (const cache of ['cold', 'warm']) {
        const url = base.replace(/\/$/, '') + '/' + (pageName === 'overview' ? '' : pageName);
        try {
          apiCount = 0;
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForLoadState('load', { timeout: 9000 }).catch(() => {});
          if (response.status() === 200)
            await page
              .waitForFunction(
                () =>
                  window.__numbers ||
                  /cup is still empty|still counting\. come back|log is empty|storage not connected|stats not connected|the lantern is out|resting\. try again|could not|lighting the lantern|snapshots? (?:are|is) warming/i.test(
                    document.querySelector(
                      '#visitors-line,#section-output,#x-output,#visitor-map-status,[data-coffee] [role=status]'
                    )?.textContent || ''
                  ),
                {},
                { timeout: 5000 }
              )
              .catch(() => {});
          await page.waitForTimeout(250);
          const metrics = await page.evaluate(() => {
            const n = performance.getEntriesByType('navigation')[0],
              r = performance.getEntriesByType('resource');
            const timings = r.filter(
              (x) => new URL(x.name).pathname.startsWith('/api/') && !x.name.includes('&z=')
            );
            const kb = (ext) =>
              Math.round(
                r
                  .filter((x) => new URL(x.name).pathname.endsWith(ext))
                  .reduce((a, x) => a + x.encodedBodySize, 0) / 1024
              );
            return {
              ttfb: Math.round(n.responseStart - n.requestStart),
              fcp:
                Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime) || null,
              numbers: Math.round(window.__numbers) || null,
              requests: timings.length,
              api: timings.map((x) => ({
                path: new URL(x.name).pathname + new URL(x.name).search,
                ms: Math.round(x.responseStart - x.requestStart),
                status: x.responseStatus
              })),
              jsKiB: kb('.js'),
              cssKiB: kb('.css')
            };
          });
          rows.push({
            page: pageName,
            profile,
            cache,
            http: response.status(),
            ...metrics,
            requests: apiCount
          });
        } catch (error) {
          rows.push({ page: pageName, profile, cache, error: error.name });
        }
        await writeFile(file, JSON.stringify(rows, null, 2));
      }
      await context.close();
    }
} finally {
  await browser.close();
}
