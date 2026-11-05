// Browser/lab server. Fixed public and authenticated test data, no external services.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
const root = path.resolve(process.argv[2] || '.'),
  port = Number(process.argv[3] || 4211);
const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());
const updated = new Date().toISOString(),
  country = [{ c: 'BE', n: 12 }];
const stats = {
  visitors: 12,
  total: 49,
  hours: [{ h: 10, n: 5 }],
  countries: country,
  sources: [],
  pages: [],
  browsers: [],
  cv: { open: 1, download: 2, openTotal: 12, downloadTotal: 4 },
  cli: { day: { curl: 2 }, all: { curl: 8 } },
  feathers: 7,
  hunters: 3,
  terminal: [{ c: 'help', n: 1 }],
  updated
};
const coffee = { ready: true, total: 29, supporters: 13, month: 5, latest: day };
const outbound = { hosts: [['pidgy-ai.com', 12]] },
  metric = { visitors: 12, clickers: 4, clicks: 9 };
const pidgy = { today: metric, all: metric, signups: null, scene: 1, variant: 0 };
const games = {
  today: { played: 3 },
  all: { played: 22 },
  best: 3,
  types: [{ type: 'babel', played: 3 }]
};
const tracks = JSON.parse(await fs.readFile(path.join(root, 'music.json'))).tracks;
const music = { tracks, votes: {}, suggestions: [], genres: [['classics', 14]] };
const fields = { replies: 2, posts: 1, links: 3, clicks: 6, clicksPidgy: 1, ctr: 2 };
const x = {
  ready: true,
  today: fields,
  all: fields,
  voices: [],
  regions: [],
  hours: [],
  posts: [],
  campaigns: [],
  updated
};
const cities = [
  {
    countryCode: 'BE',
    country: 'Belgium',
    city: 'Ghent',
    region: 'Flanders',
    lat: 51.1,
    lng: 3.7,
    visitors: 12
  }
];
const priv = { outbound: [['/', 'pidgy-ai.com', '/', 12]], pages: [['/', 12, 9]], updated };
const status = {
  status: 'ok',
  uptime: 100,
  checks: [
    {
      name: 'site',
      days: Array(30).fill('ok'),
      uptime: [100, 100, 100],
      average: 24,
      lastIncident: null
    }
  ]
};
const byPage = {
  overview: { ...stats, outbound, coffee, uptime: 100 },
  hunt: stats,
  map: { cities, countries: country, tiles: false },
  music: { genres: music.genres, loved: [['fixture song', 2]], suggestions: [] },
  pidgy,
  games,
  x,
  coffee,
  private: priv,
  status
};
// A dedicated local Redis instance can exercise the actual new read endpoint.
let serve;
if (process.env.STATS_FIXTURE_REDIS) {
  const url = new URL(process.env.STATS_FIXTURE_REDIS);
  if (url.hostname !== '127.0.0.1') throw Error('local test Redis required');
  process.env.REDIS_URL = url.href;
  const { redis } = await import('../api/_redis.js');
  ({ serve } = await import('../api/_stats-snap.js'));
  for (const [page, data] of Object.entries(byPage))
    await redis([
      'SET',
      'stats:snap:' + page + ':' + day,
      JSON.stringify({
        page,
        day,
        data,
        checked: updated,
        updated,
        state: 'ready',
        dates: {},
        missing: [],
        final: false
      }),
      'EX',
      '86400'
    ]);
}
http
  .createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost'),
        p = u.pathname,
        q = u.searchParams;
      if (p.startsWith('/api/')) {
        const name = q.get('page'),
          section = q.get('section');
        if (serve && p === '/api/stats' && name) {
          req.query = Object.fromEntries(q);
          const writer = {
            setHeader: (...args) => res.setHeader(...args),
            status(code) {
              res.statusCode = code;
              return this;
            },
            json(data) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            }
          };
          return await serve(req, writer, {
            session: async () => ({ email: 'tester@corvus.gent' }),
            enqueue: () => {},
            refresh: async () => {}
          });
        }
        const payload =
          p === '/api/stats' && name
            ? {
                page: name,
                day: q.get('day') || day,
                updated,
                data: byPage[name],
                missing: [],
                ...(name === 'private' ? { viewer: 'tester@corvus.gent' } : {}),
                state: 'ready'
              }
            : p === '/api/stats'
              ? { coffee, outbound, pidgy, games, music }[section] || stats
              : p === '/api/x-stats'
                ? q.has('private')
                  ? { ready: false }
                  : x
                : p === '/api/auth'
                  ? { email: 'tester@corvus.gent' }
                  : p === '/api/private-stats'
                    ? priv
                    : p === '/api/music'
                      ? music
                      : p === '/api/geo'
                        ? q.has('tiles')
                          ? { available: false }
                          : { cities }
                        : {};
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
        return;
      }
      let target = p;
      if (p === '/' || /^\/(pidgy|games|map|music|hunt|x|coffee|private|status)\/?$/.test(p))
        target = '/stats/' + p.slice(1).replace(/\/$/, '');
      let file = path.resolve(root, '.' + target);
      if (!file.startsWith(root + path.sep)) throw Error();
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const body = await fs.readFile(file);
      res.setHeader(
        'Content-Type',
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.json': 'application/json',
          '.png': 'image/png'
        }[path.extname(file)] || 'application/octet-stream'
      );
      res.setHeader('Cache-Control', p.includes('.') ? 'public,max-age=3600' : 'no-cache');
      res.setHeader('Content-Encoding', 'gzip');
      res.end(gzipSync(body));
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(port, '127.0.0.1');
