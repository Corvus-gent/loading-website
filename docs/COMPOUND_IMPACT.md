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
