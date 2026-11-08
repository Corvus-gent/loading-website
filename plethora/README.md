# Corvus → Plethora

`/plethora` is the public landing page. `/plethora/admin` is the private click report; `/games/hub` lists OSSMAN and the eight rotating daily puzzles. `/api/plethora` is dispatched through the existing stats function, and middleware handles `/go/plethora-<id>`.

## Configuration

- `PLETHORA_ADMIN_KEY`: generated locally outside Git and configured as a sensitive Vercel Production + Preview variable. Gabriel's existing signed session also works. The private access link is stored at `~/.secrets/corvus-plethora-admin.md`; don't publish it in PRs.
- `PLETHORA_PT`: optional numeric public App Store provider ID. Omitted unless supplied; no placeholder is sent to Apple.
- `PLETHORA_REFERRAL_CODE`: optional public code. Shown beside every promotion CTA and sent as `ref` (the requested provisional parameter; Plethora's actual redemption format still needs confirmation). Empty means no code or `ref` parameter.
- Redeploy after changing env configuration. Public configuration is cached for 60 seconds at the CDN.

All placements live in `js/plethora-config.js`. Every ID is automatically included in the admin report, including zero-count rows. Counts reflect referral clicks, **not installs or distinct people**. Dedupe is per network + placement for 30 minutes; a shared network can undercount. HEAD, link-preview bots and prefetches do not increment counts. No raw IPs are stored.

On iPhone/iPad, tracked links return 302 directly to Apple with `ct=corvus-<placement>`. Desktop/Android get `/plethora/?placement=<placement>#get`. The QR preserves the original placement. The landing page's deliberate App Store action uses `?store=1` to avoid a desktop redirect loop. `?ios=1` handles iPadOS desktop user agents detected by the browser. These flags only change destination; both use the same tracker and dedupe.

The footer/banner build is idempotent: `node tools/build-plethora.mjs`. It adds marked slots to published site HTML after the existing generators. Offline submission bundles, tests, recordings and assets are excluded. The public submission download page and client demo pages also receive a footer. OSSMAN's footer stays inside its existing menu, hidden during gameplay. The shared stylesheet also puts the existing home Twitch status in normal flow so it cannot cover the dismiss control.

## Validation

```
REDIS_URL=redis://127.0.0.1:16380/7 node tools/plethora/check.mjs
node tools/plethora/browser.mjs
node tools/plethora/admin-check.mjs
```

The browser checks use the isolated server in `tools/plethora/server.mjs` on port 4394 or `PLETHORA_TEST_URL`, with an optional Netscape cookie file (`PLETHORA_TEST_COOKIES`) for a protected Vercel preview. Keep all screenshots under ignored `tests/results/plethora`.

Self-hosted QR encoder: qrcode-generator 2.0.4 by Kazuhiko Arase, MIT, copyright/license attribution retained in qrcode.mjs. No third-party QR service receives the links.
