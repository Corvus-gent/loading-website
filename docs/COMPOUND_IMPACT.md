# Compound impact

Public scorecard: `/compound/impact/`. Owner editor: `/compound/v2/stats/#impact-admin`, using the existing Compound v2 password/session. Paste one post URL or up to 25 bulk rows, e.g. `https://x.com/gabe_maxxing/status/2116903246925005017 — 5052 views, 54 likes`. Blank fields mean unknown. Only posts marked made with Compound enter the headline/platform/growth totals. The existing v2 registry remains canonical; impact edits update linked metrics without changing votes or private export fields.

`compound/impact/config.js` defines weights and platform labels. Score = views + 3×likes + 8×comments + 10×shares + 5×saves. X shares include reposts and quotes. Velocity uses an actual metric reading within the first 24 hours; it is unavailable without that evidence. Snapshots start when deployed, with no invented historical growth. The five supplied seed readings retain the supplied measurement date, not a fabricated time.

The existing Vercel Pro project runs `/api/compound-v2?impact=1&job=1` at minutes 12 and 42, authenticated with `CRON_SECRET`. Oriane TikTok/Instagram adapters use `ORIANE_API_KEY`; X uses `X_BEARER_TOKEN`. Missing keys use manual mode. LinkedIn/YouTube always use manual entry. Errors preserve prior measurements. Snapshot totals retain 90 days at half-hour frequency; per-post measurements retain up to 2,000 samples for one year.

All Compound anchor links use `/go/compound-{placement}`; optional `to` preserves a specific video URL. Only HTTPS compound.mov/www.compound.mov destinations are permitted. `COMPOUND_REF_CODE` is optional; `COMPOUND_REF_PARAM` defaults to `ref`. No raw IPs are stored: dedupe uses the existing salted hash per placement for 30 minutes. HEAD, bots and prefetches do not count. Raw and deduped totals are separate. The page and the main admin Partners view show attributed counts.

Run `node tests/compound-impact.mjs` with the disposable local Redis instance on port 16380. Production seeding is an owner-authenticated POST `{ "action": "seed" }` to `/api/compound-v2?impact=1`; it never replaces an existing seed record.

Photo/logo credits: `compound/impact/assets/SOURCES.md`.
