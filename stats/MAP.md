# Visitor lantern map

Set `CARTO_BASEMAPS_KEY` in Vercel (Preview and Production) to a CARTO Basemaps key. CARTO now requires a key for `dark_nolabels`; without one the UI keeps the black interactive map and visitor dots, with “map background unavailable.” rather than serving API-key warning tiles. `api/geo-tiles.js` proxies only validated CARTO tile coordinates and never returns the key. Tile configuration is independent of `/api/geo`, so a visitor-data outage does not prevent basemap loading.

The existing PostHog and Redis configuration is reused. `/api/geo` caches city aggregates at `geo:all` for 900 seconds and sends `s-maxage=900`. Coordinates are rounded to one decimal; no IP addresses, distinct IDs, event records or per-visit points leave the server.

“All-time” follows `_posthog.js`'s `REAL` filter, currently starting 2026-11-02. Each city counts distinct visitors; merging sums city counts, so a person observed in multiple cities may contribute more than once to a country or region. This is not a globally deduplicated visitor total.

Checks: `node --check api/geo.js`, `node --check api/geo-tiles.js`, `node --check js/stats-map.js`, `node --check js/stats.js`, `node --experimental-vm-modules tests/geo.mjs`.
