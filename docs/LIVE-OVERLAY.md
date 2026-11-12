# Live overlay

- OBS browser source: https://corvus.gent/live/overlay , width **1920**, height **1080**. Transparent background; fixed safe margins. Scales uniformly for smaller 16:9 sources.
- Chroma key / screen share: https://corvus.gent/live/overlay?bg=green . Background is exactly #00ff00; apply a green chroma-key filter in the broadcast tool.
- Smaller panels: ?compact=1, or ?bg=green&compact=1.
- QR is generated locally using the existing QR library, with a white quiet zone. Destination: https://corvus.gent/live?utm_source=stream&utm_medium=qr .
- Countdown reuses Compound v2's deadline: 9 Nov 2026, 09:00 Los Angeles / 17:00 UTC. At zero: “challenge ended”.
- /api/compound/summary is a read-only, public JSON endpoint routed through the existing stats function. Totals come from the same v2 report. Leader follows the hub: reported social views, then site votes, stable slug tie-break; no leader is invented when all counts are zero.
- Latest three successful **anonymous votes** are broadcast, from this release onward. The existing feedback inbox is private and is deliberately excluded. No handles, emails, identities, referrers, raw event logs or admin fields are returned.
- The anonymous vote feed is updated atomically with the existing deduplicated vote, capped at 50 entries, with a 24-hour TTL and per-entry age filtering. Repeated votes do not produce another ticker item.
- Refresh every 15 seconds, without reload, cookies, device storage, analytics, remote fonts or platform embeds. Last visible totals remain if a request fails; a status label marks stale/reconnecting data. CDN and process cache are 15 seconds.
- No nav, privacy notice or shared banner is inserted into this broadcast composition. It is noindex and not in the public search index.
- For StreamYard, share the tab; apply chroma key if available. Browser-tab capture alone cannot preserve page alpha. OBS browser sources preserve transparency.
