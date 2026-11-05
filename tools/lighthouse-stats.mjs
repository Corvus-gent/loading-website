import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const [origin, target] = process.argv.slice(2);
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless', '--no-sandbox']
});
const rows = [];
try {
  for (const page of [
    '',
    'pidgy',
    'games',
    'map',
    'music',
    'hunt',
    'x',
    'coffee',
    'private',
    'status'
  ]) {
    const { lhr } = await lighthouse(origin + '/' + page, {
      port: chrome.port,
      onlyCategories: ['performance'],
      logLevel: 'error',
      formFactor: 'mobile',
      throttling: { rttMs: 150, throughputKbps: 1600, cpuSlowdownMultiplier: 6 }
    });
    rows.push({
      page: page || 'overview',
      score: Math.round(lhr.categories.performance.score * 100),
      cls: lhr.audits['cumulative-layout-shift'].numericValue
    });
    await writeFile(target, JSON.stringify(rows, null, 2));
  }
} finally {
  await chrome.kill();
}
