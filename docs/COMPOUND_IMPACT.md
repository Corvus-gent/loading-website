# Compound impact

Public: `/compound/impact/`. Owner controls: `/admin/#impact-admin` and `/compound/v2/stats/#impact-admin`, using the existing respective sign-in. Media and post type are visible in both editors. Unknown metrics stay unknown.

## The only inclusion rule

The author is Gabe, `post_type` is `original`, and the post's own `media_type` is `video`. Replies (including self-thread replies), reposts, quote posts, images, GIFs, text and unverified media are excluded. There is no date, slug, approval or exclusion-flag gate. `made_with_compound`, public totals and scores are derived from that classification, not an editable yes/no flag. Old snapshots are separated by rule version (currently 3).

X API sync requests `author_id`, `attachments.media_keys`, `referenced_tweets`, and expanded media/users. Only the current post's attachments are inspected; a quoted video's media never qualifies the enclosing post. Confirmed X accounts live in `compound/impact/config.js`. Without an API key, inspect each official embedded post in a browser and record the author, own video and reference evidence; unknown evidence stays excluded. The current ten X posts were checked this way, with five former reply seeds and a text quote as negative controls. Their evidence is stored privately in Redis `compound:v2:impact:classification-evidence`. No inferred view counts: X's public embed video counter does not establish post impressions.

TikTok video URLs identify video media, but the author must still be Gabe. Instagram requires a Reel/video, never a carousel/image. LinkedIn and YouTube use explicit owner media/author classifications. Manual edits always work without external keys. Optional Oriane metrics use `ORIANE_API_KEY`, X uses `X_BEARER_TOKEN`; missing fields never replace previous reported metrics with fabricated zeros.

## Metrics and operation

`compound/impact/config.js` defines score weights: views + 3×likes + 8×comments + 10×shares + 5×saves. Shares include repost/quote counts on the original post; that does not make a quote post itself eligible. Velocity needs a real reading during the first 24 hours. Missing metrics are identified publicly; totals sum only reported metrics on eligible posts.

The Vercel scheduler checks `/api/compound-v2?impact=1&job=1` at minutes 12 and 42 with `CRON_SECRET`. Snapshots keep 90 days of half-hour measurements; per-post history keeps up to 2,000 samples for one year. No private export fields appear publicly. Existing votes are unchanged.

All Compound outbound links use `/go/compound-{placement}`; optional `to` is restricted to HTTPS compound.mov destinations. Optional `COMPOUND_REF_CODE` uses `COMPOUND_REF_PARAM` (default `ref`). Clicks use a salted IP hash for 30-minute deduplication; no raw IPs are stored. Bots, HEAD and prefetch do not count.

Test with `node tests/compound-impact.mjs` and disposable Redis on port 16380. Never re-add the five deleted reply seeds. Photo/logo credits: `compound/impact/assets/SOURCES.md`.

## Accounts and discovery (2026-11-09)

- `compound/impact/accounts.js` is the one editable handle list. Empty handles stay coming soon. Public platform/account filters persist in the URL and recompute video totals, engagements and score; referral clicks retain their separate site-wide section.
- Original problem: Oriane refreshed only already-registered post URLs, with no profile discovery; production had no Oriane/Twitch/X credentials. A successful empty refresh was not evidence of an empty account.
- `/admin` and `/compound/v2/stats/#impact-admin` show per-account ingestion/counting counts, provider errors, timestamps and platform sync buttons. LinkedIn bulk paste accepts impressions/reactions/reposts with explicit author/original and native-video confirmations. No LinkedIn scraping.
- Vercel's existing `12,42 * * * *` impact cron refreshes configured APIs and queues public TT/IG discovery. Twitch fetches recent clips, highlights/uploads; raw archive VODs are excluded unless enabled. API credentials stay server-side.
- Public browser fallback: `tools/impact/browser-worker.mjs`, installed with `node tools/impact/install-worker.mjs`. LaunchAgent `gent.corvus.impact-browser` polls the queue each minute and schedules profile discovery every 30 minutes. **This fallback requires Gabe's Mac to be awake/logged in.** Server API cron remains on Vercel. Install creates a committed code snapshot so branch changes cannot break it. No login/challenge bypass; HTTP 401/403/429 stops an account's fetches. Bounded 30 posts, sequential navigation, delays, exclusive lock. Missing counts stay unknown, not invented zeros.
- Worker credentials are in `~/.secrets/corvus-impact-worker.env` (mode 600); logs in `~/Library/Logs/Corvus/impact-browser*.log`. Last browser heartbeat is `compound:v2:impact:browser-heartbeat`. Sync-now queues are only owner-writable. The worker directly uses the same Redis store and snapshots; duplicate canonical post URLs update in place.
- Missing `ORIANE_API_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` and `X_BEARER_TOKEN` are reported without exposing secrets. TT/IG public metadata verifies actual authors and media types; images/carousels and non-author posts never enter counted totals.
