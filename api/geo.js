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
