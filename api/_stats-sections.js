import { hostCategory, category, GENRES } from '../js/analytics-policy.js';
import { redis, connected, pipeline } from './_redis.js';
import { hogql, posthogReady, REAL } from './_posthog.js';
const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
const obj = (raw) =>
  Object.fromEntries(
    Array.from({ length: (raw || []).length / 2 }, (_, i) => [raw[i * 2], Number(raw[i * 2 + 1])])
  );
const signupReady = () =>
  ['PIDGY_POSTHOG_KEY', 'PIDGY_POSTHOG_PROJECT', 'PIDGY_SIGNUP_EVENT'].every((k) => process.env[k]);
export async function signups() {
  if (!signupReady()) return null;
  const project = process.env.PIDGY_POSTHOG_PROJECT;
  if (!/^\d+$/.test(project)) throw Error('project');
  const event = process.env.PIDGY_SIGNUP_EVENT.replace(/'/g, "''");
  const r = await fetch(`https://eu.posthog.com/api/projects/${project}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PIDGY_POSTHOG_KEY}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: `SELECT count(DISTINCT distinct_id), count(DISTINCT if(toDate(toTimeZone(timestamp,'Europe/Brussels'))=today('Europe/Brussels'),distinct_id,NULL)) FROM events WHERE event='${event}' AND (person.properties.$initial_utm_source='corvus' OR extractURLParameter(toString(person.properties.$initial_current_url),'ref')='corvus')`
      }
    })
  });
  if (!r.ok) throw Error('signup query');
  const [[all, today]] = (await r.json()).results;
  return { all, today };
}

export function sectionTasks(section, date = day()) {
  const today = `toDate(toTimeZone(timestamp,'Europe/Brussels'))=toDate('${date}')`;
  if (section === 'pidgy')
    return {
      crossings: async () => {
        const [[v, c, clicks, vt, ct, clickst]] = await hogql(
          `SELECT count(DISTINCT if(event='$pageview',distinct_id,NULL)), count(DISTINCT if(event='outbound_click' AND properties.host IN ('pidgy-ai.com','app.pidgy-ai.com'),distinct_id,NULL)), countIf(event='outbound_click' AND properties.host IN ('pidgy-ai.com','app.pidgy-ai.com')), count(DISTINCT if(event='$pageview' AND ${today},distinct_id,NULL)), count(DISTINCT if(event='outbound_click' AND properties.host IN ('pidgy-ai.com','app.pidgy-ai.com') AND ${today},distinct_id,NULL)), countIf(event='outbound_click' AND properties.host IN ('pidgy-ai.com','app.pidgy-ai.com') AND ${today}) FROM events WHERE ${REAL}`
        );
        return {
          all: { visitors: v, clickers: c, clicks },
          today: { visitors: vt, clickers: ct, clicks: clickst },
          scene: Math.floor((Date.parse(date) - Date.parse('2026-11-04')) / 86400000) % 3,
          variant: Math.floor(Date.parse(date) / 86400000) % 2
        };
      },
      signups: async () => ({ signups: await signups() })
    };
  if (section === 'outbound')
    return {
      outbound: async () => ({
        hosts: (
          await hogql(
            `SELECT properties.host, count() n FROM events WHERE event='outbound_click' AND ${REAL} AND ${today} GROUP BY 1 ORDER BY n DESC LIMIT 5`
          )
        ).map(([h, n]) => [hostCategory(h), n])
      })
    };
  if (section === 'music')
    return {
      genres: async () => ({
        genres: (
          await hogql(
            `SELECT properties.genre, count() n FROM events WHERE event='music_play' AND ${REAL} GROUP BY 1 ORDER BY n DESC LIMIT 20`
          )
        ).map(([g, n]) => [category(g, GENRES), n])
      })
    };
  if (section === 'games')
    return {
      games: async () => {
        const types = ['babel', 'borders', 'wordle', 'flags', 'combo', 'bangle', 'pingle', 'lantern'];
        const rows = (
          await pipeline(
            [`games:day:${date}`, 'games:all', ...types.map((t) => `games:type:${t}`)].map((k) => [
              'HGETALL',
              k
            ])
          )
        ).map(obj);
        return {
          today: rows[0],
          all: rows[1],
          types: types.map((type, i) => ({ type, ...rows[i + 2] })),
          best: Number((await redis(['GET', 'games:best'])) || 0)
        };
      }
    };
  throw Error('unknown section');
}
export default async function sections(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  const section = req.query.section;
  if (!['pidgy', 'games', 'music', 'outbound'].includes(section)) return res.status(404).end();
  try {
    const key = `stats:section:v2:${section}:${day()}`;
    const cache = connected() ? await redis(['GET', key]) : null;
    if (cache) {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=60');
      return res.json(JSON.parse(cache));
    }
    let data;
    data = Object.assign(
      {},
      ...(await Promise.all(Object.values(sectionTasks(section)).map((task) => task())))
    );
    if (connected()) await redis(['SET', key, JSON.stringify(data), 'EX', '900']);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=60');
    return res.json(data);
  } catch {
    return res.status(503).json({ error: 'the crow is still counting. try again soon.' });
  }
}
