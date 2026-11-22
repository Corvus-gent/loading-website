// Local-only comparison: same working page, existing JS vs Rust vs wasm-opt Rust.
// Keep Lighthouse's paint score separate from verified interaction readiness.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, cp} from 'node:fs/promises';
import {brotliCompressSync, constants as z} from 'node:zlib';
import {chromium, webkit} from '@playwright/test';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import {launch} from 'chrome-launcher';
import {buildFixture} from '../../tests/helpers/built-site.mjs';
import {createPerformanceServer, observePerformance, samplePerformance, PROFILES, quantile} from './performance.mjs';

const options = Object.fromEntries(process.argv.slice(2).map(s => s.split(/=(.*)/s).slice(0, 2)));
const optimizer = options['--wasm-opt'];
const repeats = Number(options['--repeats'] || 3);
if (!optimizer || !Number.isInteger(repeats) || repeats < 1 || repeats > 20) {
  throw Error('Use --wasm-opt=/absolute/path/to/wasm-opt --repeats=3');
}
const git = (...args) => execFileSync('git', args, {encoding:'utf8'}).trim();
const head = git('rev-parse', 'HEAD'), dirty = !!git('status', '--porcelain');
const started = new Date().toISOString();
const modes = ['legacy', 'rust', 'optimized'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const packed = bytes => brotliCompressSync(bytes, {params:{[z.BROTLI_PARAM_QUALITY]:4}}).length;
execFileSync('bash', ['tools/rust/build-browser.sh', 'core'], {stdio:'inherit', timeout:600000});
const original = await readFile('rust/browser/pkg/core/corvus_browser_bg.wasm');
const variant = 'rust/browser/pkg/optimizer-experiment';
await cp('rust/browser/pkg/core', variant, {recursive:true});
const optimizerVersion = execFileSync(optimizer, ['--version'], {encoding:'utf8'}).trim();
execFileSync(optimizer, ['rust/browser/pkg/core/corvus_browser_bg.wasm', '-Oz', '-o', variant+'/corvus_browser_bg.wasm'], {stdio:'inherit', timeout:600000});
const optimized = await readFile(variant+'/corvus_browser_bg.wasm');
const imports = bytes => WebAssembly.Module.imports(new WebAssembly.Module(bytes)).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const exports = bytes => WebAssembly.Module.exports(new WebAssembly.Module(bytes)).sort((a,b) => a.name.localeCompare(b.name));
assert.deepEqual(imports(optimized), imports(original), 'optimizer must preserve the binding imports');
assert.deepEqual(exports(optimized), exports(original), 'optimizer must preserve every public binding');
const fixture = await buildFixture(), servers = {}, samples = [], audits = [], functional = [];
const out = 'test-results/rust/measurements/optimizer-'+started.replace(/[:.]/g, '-');
await mkdir(out, {recursive:true});

async function contextFor(browser, mode, profile) {
  const cfg = PROFILES[profile], s = servers[mode];
  const context = await browser.newContext({viewport:{width:cfg.width,height:cfg.height}, isMobile:profile==='mobile', hasTouch:profile==='mobile', locale:'en-US', timezoneId:'Europe/Brussels', serviceWorkers:'block'});
  await context.addCookies([{name:'corvus_realm', value:'1', url:s.origin}]);
  await context.addInitScript(observePerformance);
  return context;
}

async function audit(mode, profile, repeat) {
  // Fresh Chrome profile per audit. Seed only the agreed returning-visitor ritual
  // cookie and refused analytics; no application assets are warmed beforehand.
  const chrome = await launch({chromePath:chromium.executablePath(), chromeFlags:['--headless', '--no-sandbox']});
  let connection;
  try {
    connection = await chromium.connectOverCDP('http://127.0.0.1:'+chrome.port);
    const context = connection.contexts()[0], origin = servers[mode].origin;
    await context.addCookies([{name:'corvus_realm', value:'1', url:origin}]);
    const seed = await context.newPage();
    await seed.goto(origin+'/robots.txt');
    await seed.evaluate(() => {
      localStorage.setItem('privacy-choice', JSON.stringify({choice:'deny'}));
      sessionStorage.setItem('twitch-disabled', '1');
    });
    await seed.close();
    const result = await lighthouse(origin+'/', {port:chrome.port, onlyCategories:['performance'], logLevel:'error', disableStorageReset:true}, profile==='desktop' ? desktopConfig : undefined);
    const lhr = result.lhr;
    await writeFile(out+`/lighthouse-${profile}-${mode}-${repeat}.json`, JSON.stringify(lhr, null, 2)+'\n');
    if (lhr.runtimeError) throw Error(lhr.runtimeError.message);
    const value = name => lhr.audits[name]?.numericValue ?? null;
    const row = {mode, profile, repeat, score:lhr.categories.performance.score*100, fcp:value('first-contentful-paint'), lcp:value('largest-contentful-paint'), tbt:value('total-blocking-time'), cls:value('cumulative-layout-shift'), speedIndex:value('speed-index'), settings:lhr.configSettings, version:lhr.lighthouseVersion, warnings:lhr.runWarnings};
    if (![row.score,row.fcp,row.lcp,row.tbt,row.cls,row.speedIndex].every(Number.isFinite)) throw Error('Incomplete Lighthouse metrics');
    audits.push(row);
    console.log('LIGHTHOUSE', JSON.stringify({mode,profile,repeat,score:row.score,lcp:row.lcp,tbt:row.tbt}));
  } catch (error) {
    audits.push({mode,profile,repeat,error:error.message});
    console.log('LIGHTHOUSE FAIL', mode, profile, error.message);
  } finally {
    if (connection) await connection.close();
    await chrome.kill();
  }
}

try {
  servers.legacy = await createPerformanceServer(fixture.root, 'legacy');
  servers.rust = await createPerformanceServer(fixture.root, 'rust');
  servers.optimized = await createPerformanceServer(fixture.root, 'rust', {assetPath:p => p.replace('/rust/browser/pkg/core/', '/'+variant+'/')});
  // Functional checks are not represented by Lighthouse's aggregate score.
  for (const [name,type] of Object.entries({chromium,webkit})) {
    const browser = await type.launch();
    try {
      for (const profile of ['mobile','desktop']) {
        const context = await contextFor(browser, 'optimized', profile), p = await context.newPage(), errors = [];
        p.on('pageerror', e => errors.push(e.message));
        try {
          for (const route of ['/','/map/','/cv/tech/']) {
            const result = await samplePerformance(p, route, 'cold-context', servers.optimized.origin);
            assert(!result.error, result.error);
            await p.keyboard.press('Escape');
            // Drain background fixture requests before changing documents in
            // this functional check. CV pages need not mount a site directory.
            // This wait is outside every recorded readiness measurement.
            await p.waitForLoadState('networkidle', {timeout:15000});
          }
          await p.goto(servers.optimized.origin+'/');
          await p.waitForFunction(() => window.__corvusMeasure.ready !== null);
          await p.locator('#lang-switcher a[hreflang=nl]').click();
          await p.waitForFunction(() => document.documentElement.lang === 'nl');
          await p.locator('#lang-switcher a[hreflang=en]').click();
          await p.waitForFunction(() => document.documentElement.lang === 'en');
          await p.locator('[data-newsletter] [name=email]').fill('optimizer@example.test');
          // Home deliberately has no search button. Blur the email input before
          // using the actual keyboard shortcut, so '/' is not typed into it.
          await p.locator('[data-newsletter] [name=email]').blur();
          await p.keyboard.press('/');
          assert(await p.locator('.site-search').isVisible());
          await p.keyboard.press('Escape');
          assert.equal(await p.locator('[data-newsletter] [name=email]').inputValue(), 'optimizer@example.test');
          assert(!await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
          assert.deepEqual(errors, []);
          functional.push({browser:name,profile,passed:true});
          console.log('FUNCTIONAL PASS', name, profile);
        } catch (error) {
          functional.push({browser:name,profile,error:error.message});
          console.log('FUNCTIONAL FAIL', name, profile, error.message);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  const browser = await chromium.launch();
  try {
    for (const profile of ['mobile','desktop']) for (let repeat=-1; repeat<repeats; repeat++) {
      for (const mode of repeat%2 ? [...modes].reverse() : modes) {
        const cfg = PROFILES[profile], context = await contextFor(browser,mode,profile);
        try {
          const p = await context.newPage(), cdp = await context.newCDPSession(p);
          await cdp.send('Emulation.setCPUThrottlingRate', {rate:cfg.cpu});
          if (cfg.down) await cdp.send('Network.emulateNetworkConditions', {offline:false,latency:cfg.latency,downloadThroughput:cfg.down,uploadThroughput:cfg.up});
          for (const cache of ['cold-context','warm']) {
            const result = await samplePerformance(p,'/',cache,servers[mode].origin);
            if (repeat>=0) { samples.push({mode,profile,repeat,cache,...result}); console.log('READINESS',JSON.stringify({mode,profile,repeat,cache,ready:result.ready,error:result.error})); }
          }
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
  // Sequential audits: never compete for CPU/network with another measurement.
  for (const profile of ['mobile','desktop']) for (let repeat=0; repeat<repeats; repeat++) {
    for (const mode of repeat%2 ? [...modes].reverse() : modes) await audit(mode,profile,repeat);
  }
  const summary = [];
  for (const profile of ['mobile','desktop']) for (const mode of modes) {
    const timing = samples.filter(s => s.profile===profile && s.mode===mode && s.cache==='cold-context');
    const scoring = audits.filter(s => s.profile===profile && s.mode===mode);
    summary.push({profile,mode,readyMedianMs:quantile(timing.map(s=>s.ready),.5),lighthouseMedian:quantile(scoring.map(s=>s.score),.5),lcpMedianMs:quantile(scoring.map(s=>s.lcp),.5),tbtMedianMs:quantile(scoring.map(s=>s.tbt),.5)});
  }
  const report = {version:1,head,headAfter:git('rev-parse','HEAD'),workingTreeDirty:dirty||!!git('status','--porcelain'),started,finished:new Date().toISOString(),productionReady:false,optimizer:{version:optimizerVersion,flags:['-Oz']},bundles:{rust:{sha256:sha(original),raw:original.length,brotli:packed(original)},optimized:{sha256:sha(optimized),raw:optimized.length,brotli:packed(optimized)}},originalChanged:sha(original)!==sha(await readFile('rust/browser/pkg/core/corvus_browser_bg.wasm')),conditions:PROFILES,repeats,summary,functional,samples,audits,unknown:Object.fromEntries(Object.entries(servers).map(([k,s])=>[k,[...s.unknown]])),assetFailures:Object.fromEntries(Object.entries(servers).map(([k,s])=>[k,[...s.failures]])),method:'Same disposable built HTML, CSS, content and 40 ms fixture APIs. No prediction. Same returning-visitor ritual cookie and analytics refusal. Functional readiness uses existing real search action. Sequential alternating paired samples plus one unrecorded timing warmup. Lighthouse uses its installed standard mobile/desktop simulation profiles (settings retained), fresh Chrome profile per audit; its scores are separate from the readiness protocol. Rust optimized treatment differs only by Binaryen -Oz on a separate artifact. All failures retained.',limitations:['Three runs are exploratory, not a release decision or field percentiles.','Lighthouse runs localhost with APIs/third parties isolated, not deployed user traffic.','Only home is performance-audited; other pages have scoped functional checks.','No real iPhone or Android measurements; WebKit is functional desktop-engine emulation.','Static content may score well while search/form controls still wait for WASM.','The legacy comparator is the existing lightweight JS, not a newly built Svelte app.']};
  await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log('REPORT',out+'/report.json');
  console.log(JSON.stringify(summary,null,2));
  if (functional.some(s=>s.error)||samples.some(s=>s.error)||audits.some(s=>s.error)||report.originalChanged||report.head!==report.headAfter||Object.values(report.unknown).some(a=>a.length)||Object.values(report.assetFailures).some(a=>a.length)) process.exitCode=1;
} finally {
  for (const s of Object.values(servers)) await s.close();
  await fixture.close();
}
