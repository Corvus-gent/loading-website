# Codex vs Compound

One round, one winner. `battle/config.json` holds the two live USD 3 Stripe Payment Links and the exact donation disclaimer. Main and bonus videos are self-hosted in `public/battle/`, H.264/AAC, 720×1280, fast-start; all are under 1 MB. Posters and the 1200×630 social card are included.

- Public page: `/battle`; API: `/api/battle` through the existing stats function.
- Admin: `/battle/admin?key=…`, authenticated using `BATTLE_ADMIN_KEY`. The page immediately removes the key from the address bar, keeps it in sessionStorage, sends it only as a Bearer header, and loads no analytics or third-party scripts.
- Production counters use `battle:v1:*`. Preview uses `battle:preview:v1:*`; preview votes never count in the public result.
- A/B assignment is server-derived and stable for a device. No mapping is returned before a recorded vote or voting closes. This is a presentation-level blind vote: video/network inspection can still identify authors.
- Device and signed-cookie ballot markers expire after 90 days. Daily-salted IP hashes are used only for rate limits and a 30-minute shared-network duplicate guard, with TTLs; no raw addresses are stored. Aggregate votes, clicks and admin-entered public post metrics are retained.
- A user's local ballot identifier is used for voting only. Public requests show a retry message and retain the last scorecard when Redis fails. Redirects still work if storage is unavailable.
- Closing is atomic with votes and refuses a tie/zero-vote result. Reopening is an explicit admin operation. Payments do not alter votes or the winner.

## Links

All return 302 to `/battle` with `utm_medium=video&utm_campaign=battle`. Unrelated query parameters are retained. Required campaign values cannot be overridden.

| Slugs | utm_source | utm_content, respectively |
| --- | --- | --- |
| `/go/cx-tt`, `/go/cp-tt`, `/go/bio-tt` | tiktok | codex, compound, bio |
| `/go/cx-ig`, `/go/cp-ig`, `/go/bio-ig` | instagram | codex, compound, bio |
| `/go/cx-x`, `/go/cp-x`, `/go/bio-x` | x | codex, compound, bio |
| `/go/cx-li`, `/go/cp-li`, `/go/bio-li` | linkedin | codex, compound, bio |

## Validation

`node tools/battle/check.mjs` against the isolated local Redis test server checks all 12 redirects, click deduplication, video playback, mobile overflow, vote/reload/device + network deduplication, admin authorization, view edits, closure and re-opening. Screenshots stay in ignored `tests/results/battle/`. No real payment is submitted by tests.
