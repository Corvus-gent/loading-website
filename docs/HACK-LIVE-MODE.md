# /hack stream-first switch

The one deadline is `LIVE_MODE_UNTIL` in `hack/live-mode-config.js`: **2026-11-09T17:00:00Z**, Monday 9 November 09:00 America/Los_Angeles. It controls presentation, not whether a stream is actually online.

Vercel environment override **HACK_LIVE_MODE** (redeploy after changing):
- `auto` or absent: live layout before the deadline; original game layout afterward.
- `on`: force the stream-first layout even after the deadline.
- `off`: original game layout immediately.

The existing `/api/live?landing=1` returns the effective mode and existing Twitch/manual social status. Polling is every 60 seconds while visible. An open tab checks the deadline every second and on return to the tab, so no redeploy is required at the deadline. A failed status check keeps the last known override; a fresh browser falls back to the dated config. Live pulse and LIVE NOW badge only appear when the shared status says a platform is live; otherwise the bar/card say next stream soon.

`/hack/2` and `/hack2` keep the game layout. `/hack/3` gets the sticky status bar and larger primary watch button; `/live` links to the robots below the plan. Social URLs are read from `live/socials.js` with `utm_medium=hack_page`. Interviews reuse `hack/3/interviews.json`: optional `published_at`/`date` determines newest first; without dates, append newer entries at the end of the array. Invalid/non-HTTPS links are ignored. No submitted private interview requests are exposed.

No game API, votes, counters, leaderboard, ideas or storage logic changed. The live layout moves the existing Plethora card below the game; when disabled, that same node is restored to its original position. The game's reveal script targets its own heading, so it cannot overwrite the stream hero.

Events `hack_live_click`, `hack_robots_click`, `hack_compound_click` use the existing PostHog queue/consent checks and strict property allowlist (`hack_id`, bounded placement/platform only). No new tracking storage.

Validation: `node tests/hack-live-mode.mjs` covers expiry at the exact boundary, both env overrides, mobile/desktop, online/offline status, latest-three interviews, safe links, UTMs, game/reveal integrity, automatic restoration and linked pages. Existing `tests/live-banner-api.mjs` and `tests/live-page.mjs` remain green.
