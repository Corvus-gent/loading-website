// Public city aggregates only. Never return identities, IPs or individual events.
import { hogql, posthogReady, REAL } from './_posthog.js';
import { redis, connected } from './_redis.js';

export const GEO_QUERY = `SELECT properties.$geoip_country_code, properties.$geoip_country_name,
  properties.$geoip_subdivision_1_name, properties.$geoip_city_name,
  round(avg(toFloat(properties.$geoip_latitude)), 1),
  round(avg(toFloat(properties.$geoip_longitude)), 1),
  count(DISTINCT distinct_id)
FROM events WHERE event = '$pageview' AND ${REAL} AND properties.$geoip_latitude IS NOT NULL
GROUP BY 1,2,3,4 LIMIT 3000`;

export function cityRows(rows) {
  const name = value => typeof value === 'string' ? value.trim().slice(0, 160) : '';
  return rows.slice(0, 3000).flatMap(row => {
    const [code, country, region, city, rawLat, rawLng, rawVisitors] = row;
    if (rawLat == null || rawLng == null || rawLat === '' || rawLng === '') return [];
    const lat = Number(rawLat), lng = Number(rawLng), visitors = Number(rawVisitors);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 || !Number.isSafeInteger(visitors) || visitors < 1) return [];
    return [{ countryCode: name(code), country: name(country), region: name(region), city: name(city), lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10, visitors }];
  });
}

export default async function handler(req, res) {
  if (req.query?.tiles === '1') return tilesHandler(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!posthogReady()) return res.status(503).json({ error: 'the lantern is out.' });
  try {
    let cached;
    if (connected()) {
      try { cached = JSON.parse(await redis(['GET', 'geo:all'])); } catch { /* Query PostHog if the cache is unavailable. */ }
    }
    const data = cached && Array.isArray(cached.cities) ? cached : { cities: cityRows(await hogql(GEO_QUERY)) };
    if (!cached && connected()) {
      try { await redis(['SET', 'geo:all', JSON.stringify(data), 'EX', '900']); } catch { /* A cache outage must not hide the map. */ }
    }
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900');
    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ error: 'the lantern is out.' });
  }
}

// Keep the CARTO credential server-side; expose only a fixed, validated tile path.
async function tilesHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method not allowed' }); }
  const key = process.env.CARTO_BASEMAPS_KEY;
  const { z, x, y } = req.query || {};
  if (z === undefined && x === undefined && y === undefined) return res.status(200).json({ available: Boolean(key) });
  if (![z, x, y].every(v => typeof v === 'string' && /^\d{1,7}$/.test(v))) return res.status(400).json({ error: 'invalid tile' });
  const zoom = Number(z), col = Number(x), row = Number(y);
  if (zoom > 12 || col >= 2 ** zoom || row >= 2 ** zoom) return res.status(400).json({ error: 'invalid tile' });
  if (!key) return res.status(503).json({ error: 'map background unavailable' });
  try {
    const response = await fetch(`https://basemaps.cartocdn.com/dark_nolabels/${zoom}/${col}/${row}.png?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.includes('image/')) throw new Error('tile unavailable');
    res.setHeader('Content-Type', response.headers.get('content-type'));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(Buffer.from(await response.arrayBuffer()));
  } catch { return res.status(502).json({ error: 'map background unavailable' }); }
}
