import { randomUUID } from 'node:crypto';
import { safeEqual } from './_session.js';
import { redis, pipeline } from './_redis.js';
import { dailyIPHash, rateLimit } from './_privacy.js';
import { hogql } from './_posthog.js';
import { brusselsDay } from './_stats-daily.js';
import { pages, ttl, bounded, build } from './_stats-snap.js';
import { record } from './_health-history.js';
import { waitUntil } from '@vercel/functions';
const site = 'https://corvus.gent',
  stats = 'https://stats.corvus.gent';
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
class CheckError extends Error {}
export function checks({
  env = process.env,
  request = fetch,
  store = redis,
  batch = pipeline,
  query = hogql,
  now = Date.now,
  refresh = (page) => build(page, brusselsDay())
} = {}) {
  const optional = (enabled, run) => (enabled ? run : null);
  async function get(url, options = {}, statuses = [200]) {
    const r = await request(url, { redirect: 'manual', ...options, signal: AbortSignal.timeout(2900) });
    if (!statuses.includes(r.status)) throw new CheckError('HTTP ' + r.status);
    return r;
  }
  const head = async (origin, paths) =>
    Promise.all(
      paths.map(async (p) => {
        try {
          await get(origin + p, { method: 'HEAD' });
        } catch (e) {
          throw new CheckError(p + ' ' + (e instanceof CheckError ? e.message : 'unreachable'));
        }
      })
    );
  return {
    site: () =>
      head(site, [
        '/',
        '/realm/',
        '/call/',
        '/sf/',
        '/music/',
        '/games/',
        '/links/gabe',
        '/links/corvus',
        '/links/pidgy',
        '/privacy/'
      ]),
    redirects: () =>
      Promise.all(
        Object.entries(vanity).map(async ([path, destination]) => {
          const r = await get(site + path, { method: 'HEAD' }, [307, 308]);
          if (new URL(r.headers.get('location') || '/invalid', site).href !== site + destination)
            throw new CheckError('wrong destination for ' + path);
        })
      ),
    stats: () =>
      head(
        stats,
        pages.map((p) => (p === 'overview' ? '/' : '/' + p))
      ),
    snapshots: async () => {
      const day = brusselsDay(new Date(now()));
      const stalePages = async () => {
        const rows = await store(['MGET', ...pages.map((p) => 'stats:snap:' + p + ':' + day)]);
        return pages.filter((page, i) => {
          const s = JSON.parse(rows[i]);
          return !s || s.state !== 'ready' || now() - Date.parse(s.updated) > ttl(page) * 1000;
        });
      };
      const stale = await stalePages();
      if (stale.length) {
        // A quiet page can be stale by design. Give its background refresh a chance
        // inside the probe's deadline. A visitor never awaits this check.
        const work = Promise.allSettled(stale.map(refresh));
        waitUntil(work);
        await work;
        const remaining = await stalePages();
        if (remaining.length) throw new CheckError('stale or missing: ' + remaining.join(', '));
      }
    },
    redis: async () => {
      const id = randomUUID(),
        key = 'health:probe:' + id;
      const [pong, , value] = await batch([
        ['PING'],
        ['SET', key, id, 'EX', '15'],
        ['GET', key],
        ['DEL', key]
      ]);
      if (pong !== 'PONG' || value !== id) throw new CheckError('read/write mismatch');
    },
    posthog: async () => {
      if (Number((await query('SELECT 1', AbortSignal.timeout(2900)))?.[0]?.[0]) !== 1)
        throw new CheckError('unexpected query result');
    },
    resend: optional(env.RESEND_HEALTH_KEY || env.RESEND_API_KEY, async () => {
      let after = '';
      for (let i = 0; i < 10; i++) {
        const r = await get(
          'https://api.resend.com/domains?limit=100' +
            (after ? '&after=' + encodeURIComponent(after) : ''),
          { headers: { Authorization: 'Bearer ' + (env.RESEND_HEALTH_KEY || env.RESEND_API_KEY) } }
        );
        const body = await r.json(),
          found = body.data?.find((d) => d.name === 'corvus.gent');
        if (found?.status === 'verified') return;
        if (found || !body.has_more) break;
        after = body.data.at(-1)?.id;
        if (!after) break;
      }
      throw new CheckError('domain missing or unverified');
    }),
    notion: optional(env.NOTION_TOKEN && env.NOTION_XLOG_DB, () =>
      get('https://api.notion.com/v1/databases/' + encodeURIComponent(env.NOTION_XLOG_DB), {
        headers: { Authorization: 'Bearer ' + env.NOTION_TOKEN, 'Notion-Version': '2025-09-03' }
      })
    ),
    coffee: optional(env.BMC_TOKEN, () =>
      get('https://developers.buymeacoffee.com/api/v1/supporters?page=1', {
        headers: { Authorization: 'Bearer ' + env.BMC_TOKEN }
      })
    ),
    tiles: optional(env.CARTO_BASEMAPS_KEY, async () => {
      const r = await get(
        'https://basemaps.cartocdn.com/dark_nolabels/2/1/1.png?key=' +
          encodeURIComponent(env.CARTO_BASEMAPS_KEY)
      );
      if (!r.headers.get('content-type')?.startsWith('image/')) throw new CheckError('invalid tile');
    }),
    spotify: async () => {
      const r = await get(
        'https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F4cOdK2wGLETKBW3PvgPWqT'
      );
      if (!(await r.json()).html) throw new CheckError('invalid embed');
    },
    cron: async () => {
      const at = Date.parse(await store(['GET', 'stats:job:last']));
      if (!Number.isFinite(at) || now() - at > 86400000)
        throw new CheckError('no completed job in 24 hours');
    }
  };
}
export async function inspect(list, now = Date.now) {
  const results = Object.fromEntries(
    await Promise.all(
      Object.entries(list).map(async ([name, run]) => {
        if (!run) return [name, { ok: null, ms: 0, skipped: true }];
        const start = now();
        try {
          await bounded(Promise.resolve().then(run), 3000);
          return [name, { ok: true, ms: now() - start }];
        } catch (e) {
          return [
            name,
            {
              ok: false,
              ms: now() - start,
              detail:
                e instanceof CheckError
                  ? e.message
                  : e?.message === 'timeout'
                    ? 'timeout'
                    : 'service unavailable'
            }
          ];
        }
      })
    )
  );
  const failed = Object.entries(results).filter(([, r]) => r.ok === false);
  const status = !failed.length
    ? 'ok'
    : results.site?.ok === false && results.stats?.ok === false
      ? 'down'
      : 'degraded';
  return { status, checks: results, checked_at: new Date(now()).toISOString() };
}
export function publicResult(sample) {
  return {
    status: sample.status,
    checks: Object.fromEntries(
      Object.entries(sample.checks).map(([name, { ok, ms, skipped }]) => [
        name,
        { ok, ms, ...(skipped ? { skipped: true } : {}) }
      ])
    ),
    checked_at: sample.checked_at
  };
}
// Transition and reserve a delivery atomically. Unacknowledged delivery is retried
// with the same provider idempotency key. An opposite transition waits out the hour.
const reserve = `
 local s=cjson.decode(redis.call('GET',KEYS[1]) or '{}')
 local now=tonumber(ARGV[1])
 if now<(s.sample or 0) then return {} end
 if now>(s.sample or 0) then
  s.sample=now
  if ARGV[2]=='bad' then s.fail=(s.fail or 0)+1 else s.fail=0 end
 end
 local desired=nil
 if s.fail>=2 and s.sent~='down' then desired='down' end
 if s.fail==0 and s.sent=='down' then desired='up' end
 if desired and now-(s.delivered or 0)>=3600000 and now>=(s.busy or 0) then
  if s.pending~=desired then s.pending=desired;s.id=ARGV[3] end
  s.busy=now+30000
  redis.call('SET',KEYS[1],cjson.encode(s),'EX',2592000);return {desired,s.id}
 end
 redis.call('SET',KEYS[1],cjson.encode(s),'EX',2592000);return {}
`;
const ack = `local s=cjson.decode(redis.call('GET',KEYS[1]) or '{}');if s.id==ARGV[1] then s.sent=s.pending;s.pending=nil;s.id=nil;s.delivered=tonumber(ARGV[2]);s.busy=0;redis.call('SET',KEYS[1],cjson.encode(s),'EX',2592000) end;return 1`;
async function mail(name, state, id) {
  const subject = '🕯 corvus: ' + name + (state === 'down' ? ' is down' : ' is back up');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': id
    },
    body: JSON.stringify({
      from: 'corvus <login@corvus.gent>',
      to: ['gabriel@corvus.gent'],
      subject,
      text: subject + '\nhttps://stats.corvus.gent/status'
    }),
    signal: AbortSignal.timeout(5000),
    redirect: 'error'
  });
  if (!r.ok) throw Error('delivery failed');
}
export async function notify(sample, store = redis, send = mail) {
  await Promise.allSettled(
    Object.entries(sample.checks)
      .filter(([, c]) => !c.skipped)
      .map(async ([name, c]) => {
        const key = 'health:alert:' + name,
          at = String(Date.parse(sample.checked_at));
        const [state, id] = await store([
          'EVAL',
          reserve,
          '1',
          key,
          at,
          c.ok ? 'good' : 'bad',
          randomUUID()
        ]);
        if (state) {
          await send(name, state, id);
          await store(['EVAL', ack, '1', key, id, at]);
        }
      })
  );
}
let memory,
  inflight,
  windowStart = 0,
  originSamples = 0;
export default async function health(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  const deep = req.query?.deep === '1';
  if (
    deep &&
    (!process.env.HEALTH_TOKEN ||
      !safeEqual(req.headers['x-health-token'] || '', process.env.HEALTH_TOKEN))
  )
    return res.status(401).json({ error: 'unauthorized' });
  if (!deep) res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
  const respond = (s) => res.status(s.status === 'down' ? 503 : 200).json(deep ? s : publicResult(s));
  try {
    if (
      !(await bounded(rateLimit('health:limit:' + dailyIPHash(req, 'health'), deep ? 12 : 30, 60), 500))
    ) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'rate limited' });
    }
    // A global sampling lease limits upstream fan-out across all source addresses.
    if (!deep && memory && Date.now() - Date.parse(memory.checked_at) < 30000) return respond(memory);
    const cached = JSON.parse(await bounded(redis(['GET', 'health:last']), 500));
    if (!deep && cached && Date.now() - Date.parse(cached.checked_at) < 30000) return respond(cached);
    if (!deep && !(await bounded(redis(['SET', 'health:sampling', '1', 'NX', 'EX', '30']), 500))) {
      if (cached) return respond(cached);
      if (inflight) return respond(await inflight);
      return res.status(503).json({
        status: 'degraded',
        checks: { sampling: { ok: false, ms: 0 } },
        checked_at: new Date().toISOString()
      });
    }
  } catch {
    /* Keep the external monitor useful during a storage outage. */
  }
  if (!inflight || deep) {
    if (Date.now() - windowStart >= 60000) {
      windowStart = Date.now();
      originSamples = 0;
    }
    if (++originSamples > 15) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'rate limited' });
    }
    const work = inspect(checks()).then(async (sample) => {
      const safe = publicResult(sample);
      memory = safe;
      try {
        await bounded(
          Promise.all([
            record(safe),
            redis(['SET', 'health:last', JSON.stringify(safe), 'EX', '2592000'])
          ]),
          1000
        );
        if (process.env.VERCEL_ENV === 'production' && process.env.RESEND_API_KEY)
          waitUntil(notify(safe));
      } catch {
        /* External monitoring remains independent of Redis/Resend. */
      }
      return sample;
    });
    if (deep) return respond(await work);
    inflight = work.finally(() => {
      inflight = null;
    });
  }
  return respond(await inflight);
}
