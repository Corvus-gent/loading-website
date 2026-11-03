// Keep the CARTO credential server-side; expose only a fixed, validated tile path.
export default async function handler(req, res) {
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
