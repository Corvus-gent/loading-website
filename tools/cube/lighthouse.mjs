import {mkdir, writeFile} from 'node:fs/promises';
import {launch} from 'chrome-launcher';
import {chromium} from '@playwright/test';
import lighthouse from 'lighthouse';
import {pages} from './pages.mjs';
const base = process.env.BASE || 'http://127.0.0.1:4176';
const chrome = await launch({chromePath:chromium.executablePath(),chromeFlags:['--headless','--no-sandbox','--disable-dev-shm-usage']});
try {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + chrome.port);
  const context = browser.contexts()[0];
  const response = await context.request.get(base + '/6');
  if (!response.ok()) throw Error('Public invitation failed');
  const scores = {};
  for (const [slug] of pages) {
    const url = base + '/the6cube/' + slug;
    const {lhr} = await lighthouse(url, {port:chrome.port,output:'json',logLevel:'error',onlyCategories:['performance','accessibility'],
      disableStorageReset:true, blockedUrlPatterns:['*ntfy.sh/*','*/lend-api/*']});
    if (lhr.runtimeError || lhr.mainDocumentUrl !== url || lhr.audits['http-status-code'].score !== 1 ||
        !Number.isFinite(lhr.categories.performance.score)) throw Error('Lighthouse failed on ' + slug);
    const row = scores[slug || 'portal'] = {performance:Math.round(100*lhr.categories.performance.score),
      accessibility:Math.round(100*lhr.categories.accessibility.score), lcp:lhr.audits['largest-contentful-paint'].numericValue};
    console.log(slug || 'portal', row);
    await mkdir('test-results/lighthouse',{recursive:true});
    await writeFile('test-results/lighthouse/scores.json', JSON.stringify(scores,null,2));
  }
} finally { await chrome.kill(); }
