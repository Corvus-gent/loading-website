// Public city aggregates only. Never return identities, IPs or individual events.
import { posthogReady } from './_posthog.js';
import { redis, connected } from './_redis.js';

import { geoData } from './_geo-data.js';

export default async function handler(req, res) {
  if (req.query?.tiles === '1') return tilesHandler(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (req.query?.country === '1') {
    // Vercel supplies the coarse country code. Never return the IP or precise location.
    res.setHeader('Cache-Control', 'private, no-store');
    const code = req.headers?.['x-vercel-ip-country'];
    const countryCode = typeof code === 'string' && /^[A-Z]{2}$/.test(code) && !['XX', 'ZZ'].includes(code) ? code : null;
    const location = {};
    const text = (key) => { try { const v=decodeURIComponent(req.headers?.[key]||''); return /^[\p{L}\p{N} .’'-]{1,100}$/u.test(v) ? v : ''; } catch { return ''; } };
    const city=text('x-vercel-ip-city'), region=text('x-vercel-ip-country-region');
    if(countryCode && region)location.region=region;
    const lat=Number(req.headers?.['x-vercel-ip-latitude']), lng=Number(req.headers?.['x-vercel-ip-longitude']);
    if(countryCode && city && Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180){Object.assign(location,{city,region,lat:Math.round(lat*10)/10,lng:Math.round(lng*10)/10});}
    return res.status(200).json({ countryCode, ...location });
  }
  if (!posthogReady()) return res.status(503).json({ error: 'the lantern is out.' });
  try {
    const day = req.query?.day || 'all';
    if (typeof day !== 'string' || (day !== 'all' && !/^\d{4}-\d{2}-\d{2}$/.test(day))) return res.status(400).json({error:'invalid day'});
    let cached;
    const cacheKey = 'geo:v6:' + day;
    if (connected()) { try { cached=JSON.parse(await redis(['GET',cacheKey])); } catch {} }
    const data = cached?.geoVersion===6 ? cached : await geoData(day);
    if (!cached && connected()) { try { await redis(['SET',cacheKey,JSON.stringify(data),'EX','900']); } catch {} }
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900');
    return res.status(200).json({ ...data, tiles: Boolean(process.env.CARTO_BASEMAPS_KEY) });
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
