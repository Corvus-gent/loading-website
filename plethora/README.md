# Corvus → Plethora

`/plethora` is the public landing page. `/plethora/stats` exposes aggregate referral statistics without a key; `/plethora/admin` retains the private access flow. The existing stats function handles `/api/plethora`, and middleware routes `/go/plethora-<id>`.

## Configuration (empty until supplied)

- `PLETHORA_PT`: optional numeric App Store provider ID; omitted until supplied.
- `PLETHORA_PLAY_URL`: official `https://play.google.com/store/apps/details?id=…` URL. No package ID is guessed. Until supplied, Android visitors land on `/plethora?from=<id>&platform=android`, and the Play button clearly says the direct link is coming soon. Once set, Android redirects directly to Google Play with an encoded `referrer=utm_source=corvus&utm_campaign=<id>` payload.
- `PLETHORA_REFERRAL_CODE`: public code displayed beside CTAs once supplied. The provisional `ref` parameter remains pending Plethora's confirmation of its redemption format.
- `PLETHORA_ADMIN_KEY`: existing sensitive Production + Preview value, outside Git. Gabriel's signed session also grants admin access. The private access link remains in `~/.secrets/corvus-plethora-admin.md`.

Redeploy after configuring values. The same-origin public response is CDN-cached for 15 seconds; visible counters and the stats page refresh every 30 seconds.

## Attribution and counting

`js/plethora-config.js` defines 35 canonical placements, their four categories and the legacy `bio → bio-x` alias. Historical `bio` totals and last-24h samples are combined into the bio-x row, without rewriting or dropping records. Both aliases use the same dedupe identity, including pre-upgrade keys.

- iOS → Apple with `ct=corvus-<placement>` and optional `pt`.
- Android → configured Google Play URL with encoded campaign referrer.
- Desktop → `/plethora?from=<placement>`.
- Landing-page store CTAs preserve the placement and use `?store=1&noCount=1`. The initial redirect is the only counted click, even if the later store click occurs after 30 minutes or on a different network. Explicit `platform=ios|android` selects a store on desktop.
- Direct landing-page visitors, without a valid `from` or legacy `placement`, use bio-x and count their first store CTA normally.
- The desktop-only, self-hosted QR points to `https://corvus.gent/go/plethora-qr?store=1`. A scan is a separate mobile entry, attributed to qr.
- `ios=1` supports iPadOS desktop user agents. No analytics identifier or raw IP is sent to either store.

The headline uses Gabe's requested “people sent” copy; the measure is **referral clicks, not unique people or installs**. Dedupe is network + placement for 30 minutes, so shared networks can undercount. Daily salted hashes expire after 30 minutes; rolling anonymous samples expire after 25 hours. HEAD, bots/link previews and prefetches do not increment counters. `noCount=1` intentionally suppresses counting; these are informational, not billing metrics.

## Public statistics

The public JSON only contains aggregates, static labels, public store configuration and the update time. It exposes no network hash, IP, sample identifier, email or session. Lifetime counts are retained in the v1 keys. Platform totals and UTC daily aggregates begin with v2; earlier clicks appear as “no platform recorded” and earlier chart days remain grey/no-data. History is never invented. Daily aggregate keys expire after nine days, covering the displayed seven days. Last 24h remains an exact rolling window, independent of midnight/DST.

The homepage live counter pauses when hidden/dismissed. Other pages still make only the existing initial config request; gameplay gets no polling overlay. Generated placement/footer slots are rebuilt idempotently by `node tools/build-plethora.mjs`; offline game packages remain untouched. `tools/plethora/og.mjs` generates the original 1200×630 pixel-art PNG without external assets or services.

## Validation

```
REDIS_URL=redis://127.0.0.1:16380/7 node tools/plethora/check.mjs
REDIS_URL=redis://127.0.0.1:16380/7 PLETHORA_TEST_PREFIX=plethora:v2-browser SESSION_SECRET=local-test PLETHORA_ADMIN_KEY=local-plethora-key node tools/plethora/server.mjs
node tools/plethora/v2-browser.mjs
node tools/plethora/browser.mjs
node tools/plethora/admin-check.mjs
```

For protected previews, set `PLETHORA_TEST_URL` and `PLETHORA_TEST_COOKIES` (a private Netscape cookie jar). Screenshots remain in ignored `tests/results/plethora-v2/`. The real redirect checker only writes test clicks when the hostname is a Vercel preview; production checks use HEAD.

Self-hosted QR encoder: qrcode-generator 2.0.4 by Kazuhiko Arase, MIT; attribution retained in qrcode.mjs. No third-party QR service receives links.
