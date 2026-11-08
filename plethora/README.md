# Corvus → Plethora: official referral links

All 35 placements (plus `bio → bio-x`) use the two official URLs from Aditya. Every device gets the same 302. Only `utm_medium=corvus` and `utm_content=<canonical placement>` are appended.

- Download: `https://plethora.studio/download?utm_source=gabe`
- OSSMAN: `https://share.plethora.studio/retro/ossman?code=GABE`
- OSSMAN placements: start, gameover, promo, pause, battle, hack, celtix, compound, **game**. The explicit landing-page requirement for `game` takes precedence over the earlier download list.
- All other placements download. Legacy `store`, `noCount`, `platform`, `ios`, `from` query arguments cannot change or bypass the official route/counting.
- `/plethora`: download CTA uses bio-x; OSSMAN CTA uses game and shows Code: GABE. Desktop QR, generated locally, uses qr.

## Configuration

No App Store provider ID or Google Play configuration is needed. The obsolete store env variables are removed from the implementation; neither existed in Vercel at upgrade time. The supplied `GABE` code is fixed public configuration, not a secret.

`PLETHORA_ADMIN_KEY` and `CRON_SECRET` already exist in Production + Preview. No dashboard work is required. The admin also accepts Gabriel's authenticated session. Public stats and CSV require no key.

## Counting, retention and migration

`api/_plethora.js` retains all v1 aggregate keys and combines legacy bio counts into bio-x. One Lua operation records raw clicks on every human GET, and deduped clicks once per network + placement per 30 minutes. HEAD, bots and prefetches do not count. These are clicks, not unique people or installs.

The transient IP is HMAC-hashed with a daily rotating salt; only dedupe keys carry hashes and expire in 30 minutes. Individual records contain placement, destination, device, Vercel country and timestamp (plus a random per-click nonce). UTC raw-log buckets expire at the end of their seven-day window. Rolling deduped samples expire after 25 hours. No raw IP, persistent visitor ID or user-agent string is stored.

Daily Pacific aggregates and snapshots have no TTL. The first official-link write atomically preserves the old totals as a legacy baseline. Historical destinations/raw counts cannot be reconstructed and are explicitly unknown; no numbers are invented. The first snapshot job archives any surviving old UTC history before its former TTL expires. UTC history is not presented as Pacific data.

## Midnight Pacific snapshots

Vercel schedules `/api/stats?plethora=1&action=snapshot` at **07:00 and 08:00 UTC**. The handler only runs at **00:00 America/Los_Angeles**, choosing the correct one in summer/winter. It authenticates using CRON_SECRET. It saves `stats:plethora:YYYY-MM-DD` (preview has a separate namespace), catches up missed days from permanent daily hashes and includes late-arriving writes on the next run. Zero-click yesterday also gets a snapshot once tracking has started. This adds no function.

Admin-authorized `GET /api/plethora?action=snapshot&catchup=1` runs a catch-up outside midnight. Scheduler execution is production-only on Vercel; preview QA exercises this manually and does not pretend the next midnight already happened.

## Public reporting

`/plethora/stats` shows deduped totals + rolling 24h, raw clicks since this upgrade, destination/device splits, sorted category subtotals and a 7-day Pacific chart. Unknown history remains grey. Refresh: 30s; CDN: 15s + SWR.

`/plethora/stats.csv` exports daily aggregate rows: day_pt, placement, destination, device, country, deduped_clicks, raw_clicks. Pre-upgrade totals are `legacy` with unknown dimensions and blank raw counts. CSV contains no individual click timestamps, hashes or nonces. Permanent daily hashes and snapshots allow rebuilding exports without raw logs.

## Checks

```
node tools/plethora/verify-routes.mjs
REDIS_URL=redis://127.0.0.1:16380/7 node tools/plethora/check.mjs
REDIS_URL=redis://127.0.0.1:16380/7 PLETHORA_TEST_PREFIX=plethora:official-browser SESSION_SECRET=local-test PLETHORA_ADMIN_KEY=local-plethora-key node tools/plethora/server.mjs
node tools/plethora/v2-browser.mjs
```

The first check is also the Vercel build guard: all 36 routes × 3 devices must produce exactly their official allowlisted URL. Browser QA supports PLETHORA_TEST_URL and PLETHORA_TEST_COOKIES for protected previews. Screenshots stay in ignored tests/results.

QR encoder: qrcode-generator 2.0.4 by Kazuhiko Arase, MIT, self-hosted.
