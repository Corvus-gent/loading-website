// Run against an empty, disposable local Redis database (never production).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
const target = new URL(process.env.STATS_TEST_REDIS);
assert.equal(target.hostname, '127.0.0.1');
assert(Number(target.pathname.slice(1)) >= 1);
Object.assign(process.env, {
  REDIS_URL: target.href,
  VERCEL_ENV: 'test',
  POSTHOG_PERSONAL_API_KEY: 'fixture',
  SESSION_SECRET: 'fixture-local',
  HEALTH_TOKEN: 'private-token'
});
const { redis, pipeline } = await import('../api/_redis.js');
assert.equal(await redis(['DBSIZE']), 0, 'choose an empty local test DB');
const { build, serve, pages } = await import('../api/_stats-snap.js');
const { inspect, checks, publicResult, notify, default: health } = await import('../api/_health.js');
const { record, history } = await import('../api/_health-history.js');
const now = Date.now(),
  today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(now);
const req = (page, day = today) => ({ method: 'GET', headers: {}, query: { page, day } });
const res = () => ({
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(code) {
    this.code = code;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  }
});
const future = [];
const opts = {
  enqueue: (promise) => future.push(promise),
  session: async () => null,
  refresh: async () => {}
};
const request = async (page, day, extra) => serve(req(page, day), res(), { ...opts, ...extra });
try {
  // Compare against the actual prior overview handler, including Redis counters. The
  // fixture answers the same SQL on both revisions and differs by Brussels day.
  const { REAL } = await import('../api/_posthog.js'),
    policy = await import('../js/analytics-policy.js');
  const runQuery = async (sql) => {
    const d = Number((sql.match(/toDate\('(\d{4}-\d{2}-(\d+))'\)/) || [])[2] || 2);
    if (sql.includes('geoip_country_name'))
      return [
        ['BE', d + 8],
        ['FR', d]
      ];
    if (sql.includes('properties.command c')) return [['help', d]];
    if (sql.includes('properties.$pathname p')) return [['/music/', d]];
    if (sql.includes('coalesce(properties.$browser')) return [['Chrome', d]];
    if (sql.includes('multiIf(')) return [['linkedin', d]];
    if (sql.includes('toHour(')) return [[11, d]];
    if (sql.startsWith('SELECT count(),')) return [[d * 2, d]];
    if (sql.includes('properties.host, count()')) return [['pidgy-ai.com', d]];
    return [[d * 10]];
  };
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).hostname, 'eu.posthog.com', 'only mock PostHog here');
    return Response.json({ results: await runQuery(JSON.parse(init.body).query.query) });
  };
  // The screenshot showed 4 November stuck warming while Redis was unreachable.
  const offlineStore=async()=>{throw Error('secret-host and credentials');};
  const background=[];
  const offline={store:offlineStore,enqueue:p=>background.push(p)};
  const cold=await request('overview','2026-11-04',offline);
  assert.equal(cold.body.reason,'storage');assert.equal(cold.body.state,'warming');
  await Promise.all(background);
  const rescued=await request('overview','2026-11-04',offline);
  assert.equal(rescued.body.data.visitors,40);assert.equal(rescued.body.state,'partial');
  assert.equal(rescued.body.data.cv,undefined);
  assert(!JSON.stringify(rescued.body).includes('secret-host'));
  const noGames=await request('games',today,offline);
  assert.equal(noGames.body.state,'unavailable');assert.equal(noGames.body.reason,'storage');
  const absent=await request('map','2026-11-04',offline);
  assert.equal(absent.body.data,null);
  const noPrivate=await request('private',today,{...offline,session:async()=>({email:'reader@corvus.gent'})});
  assert.equal(noPrivate.body.state,'unavailable');assert.match(noPrivate.headers['Cache-Control'],/no-store/);
  const { recover }=await import('../api/_stats-recovery.js');
  const memory=new Map(), options={cache:memory,tasks:()=>({visitors:()=>Promise.reject(Error('token'))})};
  const recovering=await recover('overview','2026-11-03',p=>background.push(p),options);
  assert.equal(recovering.state,'warming');await Promise.all(background);
  const failed=await recover('overview','2026-11-03',()=>assert.fail('negative cache'),options);
  assert.equal(failed.state,'unavailable');assert.equal(failed.reason,'storage-and-source');
  const context = vm.createContext({}),
    mod = (data) =>
      new vm.SyntheticModule(
        Object.keys(data),
        function () {
          for (const [k, v] of Object.entries(data)) this.setExport(k, v);
        },
        { context }
      );
  const previous = new vm.SourceTextModule(
    execFileSync('git', ['show', '71739c1:api/stats.js'], { encoding: 'utf8' }),
    { context }
  );
  const imports = {
    '../js/analytics-policy.js': mod(policy),
    './_stats-sections.js': mod({ default: () => {} }),
    './_redis.js': mod({ redis, connected: () => true }),
    './_posthog.js': mod({ hogql: runQuery, posthogReady: () => true, REAL })
  };
  await previous.link((name) => imports[name]);
  await previous.evaluate();
  for (const day of ['2026-11-02', '2026-11-03', '2026-11-04']) {
    await redis(['SET', 'cv:open:' + day, day.slice(-1)]);
    const old = res();
    old.send = (s) => {
      old.body = JSON.parse(s);
      return old;
    };
    await previous.namespace.default(req(undefined, day), old);
    await build('overview', day);
    const current = await request('overview', day);
    for (const k of [
      'visitors',
      'total',
      'hours',
      'countries',
      'sources',
      'browsers',
      'pages',
      'feathers',
      'hunters',
      'terminal',
      'cv',
      'cli'
    ])
      assert.deepEqual(current.body.data[k], old.body[k], day + ' ' + k);
    assert.match(current.headers['Cache-Control'], /31536000, immutable/);
  }
  let finishSlow;
  const held = new Promise((resolve) => {
    finishSlow = resolve;
  });
  const running = build('pidgy', today, {
    makeTasks: () => ({ fast: async () => ({ clicks: 9 }), slow: () => held })
  });
  let intermediate;
  for (let i = 0; i < 50 && !intermediate; i++) {
    await new Promise((r) => setTimeout(r, 20));
    intermediate = JSON.parse(await redis(['GET', 'stats:snap:pidgy:' + today]));
  }
  assert.equal(intermediate.state, 'partial');
  assert.equal(intermediate.data.clicks, 9);
  finishSlow({ signups: 4 });
  await running;
  assert.equal((await request('pidgy')).body.state, 'ready');
  const makeTasks = () => ({
    fast: async () => ({ visitors: 12 }),
    slow: async () => ({ feathers: 4 })
  });
  await build('overview', today, { makeTasks });
  await build('overview', today, {
    force: true,
    makeTasks: () => ({
      fast: async () => ({ visitors: 14 }),
      slow: async () => {
        throw Error('offline');
      }
    })
  });
  const partial = (await request('overview')).body;
  assert.equal(partial.data.visitors, 14);
  assert.equal(partial.data.feathers, 4);
  assert.deepEqual(partial.missing, ['slow']);
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const k = 'stats:snap:overview:' + today;
  const raw = JSON.parse(await redis(['GET', k]));
  raw.checked = '2020-01-01T00:00:00Z';
  await redis(['SET', k, JSON.stringify(raw)]);
  const hit = await request('overview', today, { refresh: () => gate });
  assert(hit.body.stale);
  assert.equal(hit.body.data.visitors, 14);
  release();
  const fresh = await request('games');
  assert.equal(fresh.body.state, 'warming');
  assert.match(fresh.headers['Cache-Control'], /no-store/);
  await build('private', today, {
    makeTasks: () => ({ internal: () => ({ pages: [['/', 12, 9]], funnelSF: { sf_note_seen: 4 } }) })
  });
  const offlineSession=await request('private',today,{session:async()=>{throw Error('offline');}});
  assert.equal(offlineSession.body.state,'unavailable');
  assert.equal(offlineSession.body.data,null);
  const anon = await request('private');
  assert.equal(anon.body.data, null);
  assert.match(anon.headers['Cache-Control'], /private, no-store/);
  const member = await request('private', today, { session: async () => ({ email: 'a@corvus.gent' }) });
  assert(!Object.hasOwn(member.body.data, 'funnelSF'));
  assert.deepEqual(member.body.data.tables, ['pages']);
  assert.equal(member.body.data.pages, undefined);
  const tableRequest = req('private');
  tableRequest.query.part = 'pages';
  const memberTable = await serve(tableRequest, res(), {
    ...opts,
    session: async () => ({ email: 'a@corvus.gent' })
  });
  assert.equal(memberTable.body.data.pages.length, 1);
  assert.equal((await serve(tableRequest, res(), opts)).body.data, null);
  assert.equal((await request('overview', '2026-11-31')).code, 400);
  assert.equal((await request('__proto__')).code, 400);
  const vanity = {
    '/enter':
      '/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=button',
    '/the-crow':
      '/?utm_source=linkedin&utm_medium=company-page&utm_campaign=gabe-corvus-page&utm_content=website',
    '/revived': '/?utm_source=linkedin&utm_medium=company-post&utm_campaign=gabe-corvus-revival',
    '/important-call-gabe-maxxer':
      '/call/?utm_source=linkedin&utm_medium=post&utm_campaign=gabe-important-call',
    '/coffee-with-gabe':
      '/links/gabe/bmc/coffee-bio?utm_source=buymeacoffee&utm_medium=bio&utm_campaign=gabe-coffee-bio',
    '/self': '/?utm_source=self&utm_medium=share&utm_campaign=home-share'
  };
  const env = Object.fromEntries(
    ['RESEND_API_KEY', 'BMC_TOKEN', 'CARTO_BASEMAPS_KEY', 'NOTION_TOKEN', 'NOTION_XLOG_DB'].map((k) => [
      k,
      'private-token'
    ])
  );
  const mocked = {
    env,
    now: () => now,
    refresh: async () => {},
    query: async () => [[1]],
    batch: pipeline,
    store: async (cmd) =>
      cmd[0] === 'MGET'
        ? pages.map(() => JSON.stringify({ state: 'ready', updated: new Date(now).toISOString() }))
        : new Date(now).toISOString(),
    request: async (url) => {
      const u = new URL(url);
      if (vanity[u.pathname])
        return new Response(null, { status: 307, headers: { location: vanity[u.pathname] } });
      if (u.hostname === 'api.resend.com')
        return Response.json({ data: [{ name: 'corvus.gent', status: 'verified' }] });
      if (u.hostname === 'open.spotify.com') return Response.json({ html: '<iframe></iframe>' });
      return new Response(null, { status: 200, headers: { 'content-type': 'image/png' } });
    }
  };
  const good = await inspect(checks(mocked));
  assert.equal(good.status, 'ok');
  const bad = await inspect(
    checks({
      ...mocked,
      store: async (cmd) => (cmd[0] === 'MGET' ? pages.map(() => null) : null),
      batch: async () => [],
      query: async () => [[0]],
      request: async () => {
        throw Error('private-token Bearer SECRET at stack');
      }
    })
  );
  assert.equal(bad.status, 'down');
  for (const [name, c] of Object.entries(bad.checks)) assert.equal(c.ok, false, name);
  assert.doesNotMatch(JSON.stringify(publicResult(bad)), /detail|Bearer|private-token|stack/i);
  const skipped = await inspect(checks({ ...mocked, env: {} }));
  assert.equal(skipped.status, 'ok');
  assert(skipped.checks.notion.skipped);
  const degraded = await inspect({
    site: async () => {},
    redis: async () => {
      throw Error('credentials');
    }
  });
  assert.equal(degraded.status, 'degraded');
  const invalid = await health(
    { method: 'GET', query: { deep: '1' }, headers: { 'x-health-token': 'wrong' } },
    res()
  );
  assert.equal(invalid.code, 401);
  assert.match(invalid.headers['Cache-Control'], /no-store/);
  const recent = publicResult(good);
  await redis(['SET', 'health:last', JSON.stringify(recent), 'EX', '30']);
  const external = await health({ method: 'GET', query: {}, headers: {} }, res());
  assert.equal(external.body.status, 'ok');
  assert.match(external.headers['Cache-Control'], /s-maxage=30/);
  const send = [],
    sample = (t, ok) => ({
      checked_at: new Date(now + t).toISOString(),
      status: ok ? 'ok' : 'degraded',
      checks: { redis: { ok, ms: 10 } }
    });
  const sendMock = (...args) => send.push(args);
  await notify(sample(0, false), redis, sendMock);
  assert.equal(send.length, 0);
  await Promise.all(Array.from({ length: 4 }, () => notify(sample(1000, false), redis, sendMock)));
  assert.equal(send.length, 1);
  await notify(sample(2000, false), redis, sendMock);
  await notify(sample(3000, true), redis, sendMock);
  assert.equal(send.length, 1);
  await notify(sample(3602000, true), redis, sendMock);
  assert.deepEqual(
    send.map((row) => row.slice(0, 2)),
    [
      ['redis', 'down'],
      ['redis', 'up']
    ]
  );
  for (const [age, ok] of [
    [31, false],
    [29, true],
    [6, false],
    [0.25, true]
  ])
    await record(sample(-age * 86400000, ok));
  await record(sample(0, true));
  const h = await history(now);
  const check = h.checks.find((c) => c.name === 'redis');
  assert.deepEqual(check.uptime, [100, 200 / 3, 75, 60]);
  assert.equal(check.days.length, 90);
  assert.equal(check.days.at(-1)[2], 10);
  assert.equal(await redis(['ZCARD', 'health:v2:raw']), 2);
  assert((await redis(['TTL', 'health:v2:raw'])) <= 172800);
  // Exercise the protected endpoint itself. Every network dependency is mocked.
  for (const name of pages)
    await redis([
      'SET',
      'stats:snap:' + name + ':' + today,
      JSON.stringify({ state: 'ready', updated: new Date().toISOString() })
    ]);
  await redis(['SET', 'stats:job:last', new Date().toISOString()]);
  globalThis.fetch = async (url, init) => {
    if (new URL(url).hostname === 'eu.posthog.com') return Response.json({ results: [[1]] });
    if (new URL(url).hostname === 'open.spotify.com') return new Response(null, { status: 429 });
    return mocked.request(url, init);
  };
  const deep = await health(
    { method: 'GET', query: { deep: '1' }, headers: { 'x-health-token': 'private-token' } },
    res()
  );
  assert.equal(deep.body.status, 'degraded');
  assert.equal(deep.body.checks.spotify.detail, 'HTTP 429');
  assert.match(deep.headers['Cache-Control'], /no-store/);
  assert.doesNotMatch(JSON.stringify(deep.body), /private-token|stack|Bearer/);
  const shallow = await health({ method: 'GET', query: {}, headers: {} }, res());
  assert.equal(shallow.body.status, 'degraded');
  assert.doesNotMatch(JSON.stringify(shallow.body), /HTTP 429|detail|private-token|stack/);
  // External monitors bypass visitor and CDN caches, but rapid retries share a lease.
  const monitorReq={method:'GET',query:{monitor:'1'},headers:{'x-forwarded-for':'192.0.2.12'}};
  const monitored=await health(monitorReq,res());
  assert.match(monitored.headers['Cache-Control'],/no-store/);
  assert.equal(monitored.body.checks.spotify.ok,false);
  assert(!monitored.body.checks.spotify.detail);
  assert(await redis(['EXISTS','health:monitor:sampling']));
  assert.equal((await health(monitorReq,res())).body.checked_at,monitored.body.checked_at);
  const {default:historyEndpoint}=await import('../api/_health-history.js');
  process.env.REDIS_MAINTENANCE='1';
  try {
    const offline=await historyEndpoint({method:'GET',query:{range:'7d'}},res());
    assert(offline.body.historyUnavailable);
    assert.equal(offline.body.status,'degraded');
    assert.equal(offline.body.checks.find(c=>c.name==='redis').state,3);
    assert(offline.body.uptime.every(p=>p===null));
    assert.doesNotMatch(JSON.stringify(offline.body),/HTTP 429|private-token|stack/);
  }finally{delete process.env.REDIS_MAINTENANCE;}
  let limited;
  for (let i = 0; i < 31; i++)
    limited = await health(
      { method: 'GET', query: {}, headers: { 'x-forwarded-for': '192.0.2.11' } },
      res()
    );
  assert.equal(limited.code, 429);
  assert.equal(limited.headers['Retry-After'], '60');
  console.log(
    'Passed: prior-release parity on 3 days, SWR/partial/immutable/private, every probe, public redaction, alert concurrency and 30-day history.'
  );
} finally {
  await redis(['FLUSHDB']);
}
process.exit(0);
