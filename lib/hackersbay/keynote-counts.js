import { redis, connected } from '../../api/_redis.js';
import { ORIGINS } from '../../api/_privacy.js';

import { readCrewCounts } from './crew.js';
import { readRaceActivity } from './race.js';

const prefix = 'hackersbay:keynote';
const repo = 'https://api.github.com/repos/Corvus-gent/the-hackers-bay';
const metrics = new Set(['visit', 'video', 'github']);
const increment = `
 local n = redis.call('INCR', KEYS[1])
 if n == 1 then redis.call('EXPIRE', KEYS[1], 120) end
 if n > 6000 then return 0 end
 redis.call('HINCRBY', KEYS[2], ARGV[1], 1)
 if ARGV[2] == 'x' then redis.call('HINCRBY', KEYS[2], 'x:' .. ARGV[1], 1) end
 return 1`;

async function stars() {
  const key = prefix + ':stars';
  const cached = connected() ? await redis(['GET', key]).catch(() => null) : null;
  if (cached !== null) return Number(cached);
  const response = await fetch(repo, { signal: AbortSignal.timeout(4500) });
  if (!response.ok) return null;
  const { stargazers_count: count } = await response.json();
  if (!Number.isInteger(count)) return null;
  if (connected()) await redis(['SET', key, count, 'EX', 300]).catch(() => {});
  return count;
}

export async function handleKeynoteCounts(req, res) {
  if (req.method === 'GET') {
    const [counts, totalStars, crew, race] = await Promise.all([
      connected()
        ? redis(['HMGET', prefix + ':totals', 'visit', 'video', 'github', 'x:visit']).catch(() => null)
        : null,
      stars().catch(() => null),
      readCrewCounts().catch(() => null),
      readRaceActivity().catch(() => null)
    ]);
    return res.json({
      visits: counts ? Number(counts[0] || 0) : null,
      videoPlays: counts ? Number(counts[1] || 0) : null,
      githubClicks: counts ? Number(counts[2] || 0) : null,
      xVisits: counts ? Number(counts[3] || 0) : null,
      stars: totalStars,
      parrots: crew?.available ? crew.pirates : null,
      races: race?.races ?? null,
      feathers: race?.feathers ?? null
    });
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!ORIGINS.includes(req.headers.origin || '')) return res.status(403).end();
  const { event, source } = req.body || {};
  if (!metrics.has(event) || !['x', 'other'].includes(source)) return res.status(400).end();
  if (!connected()) return res.status(503).end();
  try {
    const bucket = prefix + ':limit:' + Math.floor(Date.now() / 60000);
    const counted = await redis(['EVAL', increment, '2', bucket, prefix + ':totals', event, source]);
    return res.status(counted ? 204 : 429).end();
  } catch {
    return res.status(503).end();
  }
}
