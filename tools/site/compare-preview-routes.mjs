import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {COMPOUND_LINKS} from '../../js/compound-links.js';
import {PLETHORA_PLACEMENTS, PLETHORA_ALIASES} from '../../js/plethora-config.js';
import {SUPPORT_LINKS} from '../../js/support-config.js';
import {PARTNERS} from '../../js/site/legion-config.js';
import {voteCode} from '../../compound/v2/config.js';

const folder = 'test-results/preview-routes';
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const save = (name, value) => writeFile(folder + '/' + name + '.json', JSON.stringify(value, null, 2));
const synthetic = 'route-check-placeholder';

async function collect() {
  const rows = new Map();
  const ref = execFileSync('git', ['rev-parse', '--verify', (process.env.PREVIEW_BASE_REF || 'HEAD') + '^{commit}'], {encoding: 'utf8'}).trim();
  const tracked = execFileSync('git', ['ls-tree', '-rz', '--name-only', ref], {encoding: 'utf8'}).split('\0').filter(Boolean);
  const source = file => execFileSync('git', ['show', ref + ':' + file], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  const directory = JSON.parse(source('site-directory.json'));
  const config = JSON.parse(source('vercel.json'));
  const history = JSON.parse(source('docs/site-map-before.json'));
  function add(value, source, base = 'https://corvus.gent/') {
    if (!value || value.startsWith('#') || value.includes('${')) return;
    let url;
    try { url = new URL(value.replaceAll('&amp;', '&'), base); } catch { return; }
    if (!['corvus.gent', 'www.corvus.gent', 'stats.corvus.gent'].includes(url.hostname)) return;
    if (url.username || url.password || /(?:^|\/)(?:api|games\/data)(?:\/|$)/.test(url.pathname)) return;
    if ([...url.searchParams.keys()].some(key => /token|password|key|email|ticket|session|secret/i.test(key))) return;
    // Plain markup reads only. Never visit a live referral, edit link, invitation, or subscription token.
    if (/^\/r\//.test(url.pathname) && !url.pathname.includes(synthetic)) return;
    if (/^\/(?:legion\/(?:edit|join)|letters\/(?:confirm|unsubscribe))\/(?!index\.html$)[^/]+/.test(url.pathname) && !url.pathname.includes(synthetic)) return;
    if (/\.[a-z\d]{1,8}$/i.test(url.pathname) && !/\.(?:html|pdf|csv)$/i.test(url.pathname) && !/^\/soldier\/[\w-]+\/(?:og|poster)\.png$/.test(url.pathname)) return;
    // Tracking permutations and fragments share the same page. Preserve public content identifiers.
    for (const key of [...url.searchParams.keys()]) {
      if (!['id', 'video', 'code', 'game', 'interview'].includes(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    const pathname = (url.hostname === 'stats.corvus.gent' ? '/stats' : '') + url.pathname;
    const path = pathname + url.search;
    const tracker = /^\/(?:go|v|c|r)\//.test(pathname) || Object.hasOwn(COMPOUND_LINKS, pathname.replace(/^\/|\/$/g, '')) || url.searchParams.has('code');
    if (!rows.has(path)) rows.set(path, {path, method: tracker ? 'HEAD' : 'GET', sources: []});
    const sources = rows.get(path).sources;
    if (!sources.includes(source)) sources.push(source);
  }
  const files = tracked.filter(file => file.endsWith('.html'));
  for (const r of directory.routes) add(r.path, 'public catalogue');
  for (const key of Object.keys(directory.aliases)) add(key, 'directory alias');
  for (const r of [...config.redirects, ...config.rewrites]) if (!r.source.includes(':')) add(r.source, 'hosting rule');
  for (const r of history.middlewareRedirects) if (!r.source.startsWith('https://stats.')) add(r.source, 'middleware alias');
  for (const r of history.observedDynamicLinks) add(r.href, 'documented link', r.from);
  for (const file of files) {
    const base = 'https://corvus.gent/' + file;
    add(base, 'static file');
    if (file.endsWith('index.html')) {
      add(base.replace(/index\.html$/, ''), 'directory URL');
      add(base.replace(/\/index\.html$/, ''), 'directory URL');
    }
    const markup = source(file);
    const publicBase = file.startsWith('stats/') ? 'https://stats.corvus.gent/' + file.slice(6) : base;
    for (const match of markup.matchAll(/<a\s[^>]*?\bhref\s*=\s*(["'])(.*?)\1/gis)) add(match[2], 'linked page', publicBase);
  }
  const content = JSON.parse(source('data/site-public-content.json'));
  for (const v of content.videos.filter(v => !v.is_example)) {
    add('/compound/v2/' + v.lang + '/' + v.hook + '/' + v.n, 'numbered video URL');
    add('/v/' + v.slug, 'video short link');
    add('/c/' + voteCode(v), 'vote-code alias');
    add('/compound/v2?code=' + voteCode(v), 'vote-code alias');
  }
  for (const soldier of content.soldiers) {
    for (const image of ['og.png', 'poster.png']) add('/soldier/' + soldier.username + '/' + image, 'public profile image');
  }
  for (const p of JSON.parse(source('people/people.json')).members) add('/people/?id=' + encodeURIComponent(p.id), 'person profile');
  for (const p of Object.keys(JSON.parse(source('personas.json')))) add('/links/' + p + '/ig/bio', 'persona link');
  for (const id of [...Object.keys(PLETHORA_PLACEMENTS), ...Object.keys(PLETHORA_ALIASES)]) add('/go/plethora-' + id, 'partner link');
  for (const id of [...Object.keys(SUPPORT_LINKS), ...Object.keys(PARTNERS), 'twitch', 'instagram', 'twitter']) add('/go/' + id, 'partner link');
  for (const kind of ['cx', 'cp', 'bio']) for (const platform of ['tt', 'ig', 'x', 'li']) add('/go/' + kind + '-' + platform, 'battle alias');
  for (const route of ['/enlist', '/join-the-army-now/ig/bio', '/enlist/ig/bio', '/go/ig', '/go/li/home/402',
    '/go/tt/pidgy', '/go/corvus/coffee/coffee-stats', '/links/gabe/self', '/links/gabe/bmc/coffee-bio',
    '/squads', '/sidequest', '/important-call-gabe-maxxer', '/coffee-with-gabe',
    '/legion/edit/' + synthetic, '/legion/join/' + synthetic, '/legion/senate/' + synthetic,
    '/r/' + synthetic, '/r/' + synthetic + '/games']) add(route, 'route family');
  for (const file of tracked.filter(file => /^(?:papers|cv)\/.*\.pdf$/.test(file))) add('/' + file, 'public document');
  return {ref, routes: [...rows.values()].sort((a,b) => a.path.localeCompare(b.path)),
    families: config.rewrites.filter(r => !r.source.startsWith('/api') && r.source.includes(':')).map(r => r.source),
    statsFiles: files.filter(file => file.startsWith('stats/'))};
}

async function capture(label, origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || !/^loading-website-[a-z\d-]+-corvus11\.vercel\.app$/.test(url.hostname) ||
      url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Use a project deployment URL.');
  const secretPath = process.env.PREVIEW_BYPASS_FILE;
  const headers = {'user-agent': 'Mozilla/5.0 (compatible; CorvusRouteAuditBot/1.0)', DNT: '1', 'Sec-GPC': '1'};
  if (secretPath) headers['x-vercel-protection-bypass'] = (await readFile(secretPath, 'utf8')).trim();
  const list = label === 'before' ? await collect() : await json(folder + '/inventory.json');
  if (label === 'before') await save('inventory', list);
  const results = new Map();
  async function probe(row, extraHeaders = {}) {
    try {
      const address = new URL(row.path, origin);
      if (address.origin !== url.origin) throw Error('Cross-origin probe rejected');
      const response = await fetch(address, {method: row.method, headers: {...headers, ...extraHeaders}, redirect: 'manual', signal: AbortSignal.timeout(25000)});
      const type = response.headers.get('content-type') || '';
      const redirect = response.headers.get('location');
      let location = null;
      if (redirect) {
        const u = new URL(redirect, origin);
        // Internal comparison ignores this deployment's domain. Never request a redirect destination.
        location = (u.origin === url.origin ? '' : u.origin) + u.pathname + u.search + u.hash;
      }
      let soft404 = false;
      if (row.method === 'GET' && type.includes('text/html')) {
        const body = await response.text();
        const title = (body.match(/<title\b[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
        soft404 = /^(?:404\b|page not found\b)/i.test(title) && row.path !== '/404.html';
      } else await response.body?.cancel();
      return {path: row.path, method: row.method, status: response.status, type, location, soft404};
    } catch (error) { return {path: row.path, method: row.method, error: error.name}; }
  }
  async function sweep(rows) {
    let cursor = 0;
    async function worker() {
      while (cursor < rows.length) {
        const row = rows[cursor++];
        results.set(row.path, await probe(row));
      }
    }
    await Promise.all(Array.from({length: 12}, worker));
  }
  console.log('Checking', list.routes.length, 'preview URLs', label);
  await sweep(list.routes);
  const retry = list.routes.filter(r => {const v = results.get(r.path); return v.error || v.status === 429 || v.status >= 500;});
  if (retry.length) await sweep(retry);
  const rows = list.routes.map(r => results.get(r.path));
  // The /stats public URLs redirect to a production subdomain. Read the files on this deployment
  // through an encoded path as well, so the login shell and other stats pages are compared locally.
  const statsFiles = await Promise.all(list.statsFiles.map(file => probe({path: '/' + file.replace(/^stats/, '%73tats'), method:'GET'})));
  const enteredHome = await probe({path: '/', method: 'GET'}, {cookie:'corvus_realm=1'});
  await save(label, {origin: url.origin, time: new Date().toISOString(), rows, statsFiles, enteredHome});
  console.log(label, rows.reduce((totals, row) => {const key = row.error || row.status; totals[key] = (totals[key] || 0) + 1; return totals;}, {}));
  if (rows.every(r => r.status === 401 || r.status === 403)) throw Error('Preview access was denied.');
}

async function compare() {
  const baseline = await json(folder + '/before.json');
  const candidate = await json(folder + '/after.json');
  const observations = value => [...value.rows, ...value.statsFiles, {...value.enteredHome, path: '/ (entered)'}];
  const before = observations(baseline);
  const after = new Map(observations(candidate).map(r => [r.path, r]));
  const changes = [], new404s = [], failures = [], expectedAccessChanges = [];
  const expectedGates = new Set((process.env.PREVIEW_EXPECTED_403 || '').split(',').filter(Boolean));
  const missing = row => row.status === 404 || row.soft404;
  for (const first of before) {
    const second = after.get(first.path);
    if (!second) throw Error('Missing comparison row: ' + first.path);
    if (first.status !== second.status || first.location !== second.location || first.soft404 !== second.soft404 || first.error || second.error) {
      const change = {path: first.path, before: first, after: second};
      changes.push(change);
      if (missing(second) && !missing(first)) new404s.push(change);
      const pagePath = first.path.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
      if (first.status < 400 && second.status === 403 && expectedGates.has(pagePath)) expectedAccessChanges.push(change);
      else if (second.error || second.status >= 500 || (first.status < 400 && second.status >= 400)) failures.push(change);
    }
  }
  await save('comparison', {count: before.length, changes, expectedAccessChanges, new404s, failures});
  console.log(before.length, 'compared;', changes.length, 'changes;', new404s.length, 'new 404s;', failures.length, 'failures.');
  if (new404s.length || failures.length) process.exitCode = 1;
}

await mkdir(folder, {recursive: true});
const [mode, deployment] = process.argv.slice(2);
if (mode === 'compare') await compare();
else if (['before', 'after'].includes(mode)) await capture(mode, deployment);
else throw Error('Use before URL, after URL, or compare. Set PREVIEW_BYPASS_FILE for a protected deployment.');
