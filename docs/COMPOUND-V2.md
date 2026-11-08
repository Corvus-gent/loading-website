# Compound v2 — the 24-hour video registry

The site is static HTML / vanilla JavaScript with Vercel functions, not Next.js. This feature follows that stack and reuses the existing Redis connection and signed `vid` anti-abuse cookie. No additional store, heavy framework, embed SDK or paid service was created.

## Routes

- `/compound/v2`: countdown to **2026-11-09 17:00 UTC = Monday 09:00 America/Los_Angeles**, social view totals, filters and code lookup.
- `/compound/v2/{lang}` and `/{lang}/{hook}`: filtered leaderboards. Arabic and Persian use RTL. All 20 language headlines live in `compound/v2/config.js`.
- `/compound/v2/{lang}/{hook}/{n}`: the cut across platform/account variants. `?video={slug}` selects the specific post; voting and attribution are per slug, not inadvertently merged across variants. An on-screen code such as NL-MOM1 opens the matching cut, then offers its other platform variants.
- `/v/{slug}`: server-side **302**, default platform source, `post` medium (`live` for Twitch), campaign `compound-v2`, content = slug. Any incoming `utm_*` attribution is preserved as a set, not mixed with defaults. The `video` selector survives analytics URL cleaning. Redirect counts are separate from site visits, so following a short link does not double-count a landing.
- `/compound/v2/stats`: password login, add video, inline metrics/post URL edits, sort, rollups, private feedback with deletion.
- `/compound/v2/links`: same login, short/full links, medium chooser, share text, client-generated QR copy/download. No external QR service.
- `/compound` remains the existing original editor and links to v2. No old video, vote or payment keys were changed.

## Owner access

Existing **COMPOUND_ADMIN_PASSWORD** works. Optionally set **COMPOUND_V2_ADMIN_PASSWORD** to give this campaign its own password (takes precedence). Passwords are never put in URLs or client bundles. The HttpOnly Secure SameSite=Strict cookie lasts four hours and is invalidated by a password change. Admin writes require same-origin + session, or an authenticated server-side bearer. Stats data and feedback are returned only by the protected API.

## Adding real posts

Open `/compound/v2/stats`, sign in, and fill in platform, account, language, hook, number, post URL and optional Compound URL/date. Slug is built automatically. Use the posted clip URL, not just the profile. Social view/like/comment/share counts are manually reported; no unauthenticated scraping is performed.

Three example records render the UI before real data arrives. They have zero social metrics, are clearly marked, and are excluded from totals and rollups. Edit their post URL, untick `example only`, then save to turn one into a real entry. Otherwise add new slugs. Examples are read-only defaults until edited, so public GETs never seed or mutate storage. Limit: 1,000 registered posts.

Naming is exact: platform `tt|ig|x|li|tw`, account `gl|bjj|gm|collab`, configured language/hook, integer `n` from 1–9999. Registry account names are the requested labels, not guesses at social profile URLs.

## Counting, privacy and retention

- Reported social views are sums of each post's platform counts, **not unique people**; CTR = site page opens / reported social views, and may exceed 100%. Shares/reloads can produce multiple site opens. No implied install, sale or verified-user metric.
- Public summary is CDN-cached 15 seconds with 120-second stale allowance; the client refreshes every 30 seconds and preserves last loaded numbers on API errors. Editing/voting does not wait on a social provider.
- Public pageview/share/outbound/code events follow the existing Compound consent policy. Without browser tracking permission, or with GPC/DNT, only aggregate counters are kept. Detailed events carry a page-session anonymous UUID; cross-page persistent identity is used only when the existing Compound journey opt-in is enabled. No new analytics device storage is added.
- Votes use the existing signed `vid` strictly for anti-abuse; the event log never receives the cookie ID. One vote per cookie per slug, atomic even with concurrent requests. Feedback uses origin checks, honeypot, length and rate limits and idempotency. Raw IPs are not stored; rate keys use the shared daily-salted hash.
- `compound:v2:videos` is the owner-entered registry; `counts:{slug}` holds nonpersonal aggregate counters. These have no expiry. Preview uses `compound:v2:preview`.
- Per-cookie vote keys, feedback/dedupe records, metric histories and daily detailed event lists expire after 90 days. Private text/handles are never in public JSON or analytics. The owner can delete feedback in stats.
- Daily event detail is capped at the latest 10,000 records to bound memory on the existing small Redis plan; aggregate counters retain all accepted events. Each metric history keeps the latest 200 updates per slug. Neither is presented as an exhaustive permanent audit trail.
- Platform posts open on their own sites only after a click, keeping initial loads fast and avoiding automatic third-party embeds/cookies.

## Optional Oriane

No ORIANE key is configured. Metrics entry is fully functional without it. Automatic Oriane synchronization is not enabled; provider access/confirmed metrics endpoints are needed first. Do not mark manually entered numbers as synced. The current Vercel Hobby cron setup cannot schedule a 15-minute cron; any later integration needs an eligible scheduler or a cached/on-demand refresh with that limitation stated.

## Validation

- `node tests/compound-v2.mjs`: isolated local Redis on 16380 DB 3, unique prefix, no flush; auth/CSRF/URLs, edits, cookie dedupe, privacy signals, attribution, TTLs, all 220 language/hook combinations and short-link fail-open behavior. Cleans its own keys.
- `node tests/compound-v2-browser.mjs`: actual local API/Redis, 390px + desktop, owner flow, inline edit, code, vote/reload, feedback XSS escaping, RTL, local QR generation. Screenshots are in ignored `test-results/compound-v2`.
- `node tools/build-compound-v2.mjs`: regenerate static shells and OG image after changing template markup. Runtime registry remains in Redis.
