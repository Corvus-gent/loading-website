# Stats recovery: 5–6 November 2026

Forced rebuild completed on 6 November, with an independent direct PostHog comparison at 12:41 UTC / 13:41 Brussels. The production CDN was purged afterwards. Public numbers were checked again through stats.corvus.gent's API and rendered page, including a browser session seeded with an obsolete final snapshot.

| Brussels day | PostHog unique pageview identifiers | Pageviews | Outbound-click events | Snapshot comparison |
|---|---:|---:|---:|---|
| 5 Nov | 4 | 11 | 1 | visitor count and every displayed outbound host count match |
| 6 Nov, at verification | 0 | 0 | 0 | visitor count and displayed outbound host counts match |

The one outbound event on 5 November has host corvus.gent. Pidgy outbound clicks, links_click and short_link_out are zero on both days. These event types are kept separate, not added together: one interaction can have more than one analytics event.

The direct queries use the same production-host and Brussels-calendar-day definition as the page. They execute against PostHog after the rebuild; they are not reads of the Redis snapshot. The overview displays at most five outbound host rows; the comparison verifies those exact rows separately from the direct total.

## Important source coverage limit

PostHog also reports **zero project-wide pageviews on 6 November without the production-host filter**. The project's last recorded pageview was **5 November 08:00:58.370 UTC / 09:00:58 Brussels**. Therefore today's zero is already in the source; it was not caused by a stale Redis snapshot.

The deployed analytics code only loads/captures after an analytics opt-in, and honours privacy signals. These counts describe recorded events/identifiers, not a complete census of actual visitors. No consent preferences or analytics collection settings were changed. Events that were never captured cannot be recovered by rebuilding Redis.

## What was rebuilt

- 5 November: overview and hunt, the implemented historical day projections. Only their PostHog tasks were rerun; Redis-only values already present in the old snapshots were retained, not replaced with guessed historical totals.
- 6 November: all ten current page snapshots refreshed and returned ready, with no missing tasks. X/BMC can be ready-but-unconfigured and are not independent PostHog sources.
- Historical cumulative pages without trustworthy as-of source data were not fabricated. In particular, the current music ranking, game totals or current provider totals must not be labelled as historical data for 5 November.
- Existing Redis votes, catalog, leads and other source records were not reset or backfilled with inferred activity.

## Failure window, based on deployment evidence

The suspected commit time is not the production failure start:

- 89d2d3f was committed on **4 November 16:44:12 Brussels**.
- The preceding production release, 677e746, does **not** contain the strict transport gate.
- Production release 8ce5b66 does contain it. Vercel assigned production aliases on **5 November 02:16:13.277 Brussels**.
- The restoration deployment received production aliases on **6 November 12:09:26.625 Brussels**.
- Thus the supported production failure/risk interval is approximately **33 hours 53 minutes**, from 5 November 02:16 to 6 November 12:09. This is inferred from deployed code, the known plaintext configuration and alias timestamps; it is not a complete per-request error log.

## Redis-only gaps

| Data | Window (Europe/Brussels) | What was missed / whether it can be recovered |
|---|---|---|
| Language votes, music likes/poll votes/suggestions | 5 Nov 02:16 → 6 Nov 12:09 | New operations failed or controls became unavailable; they were not successfully stored. Previously stored votes/ranking survived. PostHog cannot determine the user's intended vote or recreate an unsubmitted suggestion. Missing quantity unknown. |
| CV open/download counters | Same interval | The PDF could still be served because the endpoint catches Redis errors, while its increments failed. PostHog link clicks are not an exact replacement for actual PDF opens/downloads. Missing quantity unknown. |
| curl / CLI counters | Same interval | Middleware could return the terminal/ASCII response while the Redis counter request failed. CLI clients do not execute browser analytics, so no exact PostHog backfill exists. |
| SF form leads and notification queue | Same interval, from the form's production launch | Redis failed before storing the lead/outbox record; these rejected submissions did not create a recoverable notification queue. No contact fields were reconstructed from analytics. Missing submissions unknown. |
| Game progress and global counters | Same interval | Successful state/counter writes were unavailable. Existing stored records survived; failed guesses cannot be recreated from pageviews. |
| Health samples | Collector launched 5 Nov **10:58:10 Brussels**, then no stored recovery sample until 6 Nov **12:10:04 Brussels** | The health collector was introduced later than the Redis regression. Missing service checks cannot be reconstructed from PostHog pageviews and remain no-data. After restoration, manual samples exist, but a working external five-minute monitor has still not been established; gaps in that automatic series remain a separate issue. |

These are windows where data collection could fail or actions were rejected. They do not establish a numerical count of lost legitimate interactions. No zeroes or synthetic health points were inserted to disguise missing history.

## Fixes and validation

Two cache bugs obstructed a genuine rebuild:

1. build(..., {force:true}) still skipped final snapshots. Force now bypasses that final-snapshot shortcut; normal reads keep historical snapshots sealed.
2. A final snapshot in sessionStorage could survive reloads indefinitely. A historical day now revalidates once per page visit while retaining the immediate cached first paint. Current-day fast revisits and prefetch deduplication are unchanged.

The dated rebuild route is inside the existing job handler: CRON_SECRET authentication, POST required, strict date validation, no arbitrary SQL input, aggregate-only output and no-store. The current API key stays in the Vercel function environment. Numeric verification is retained for 90 days. The first run used an unaliased maintenance deployment; the tested fixes were then deployed from the daily branch and reverified live. No main push or merge.

Validation: dedicated final/force/auth/date/comparison regression test; all eight stats-speed Playwright tests; existing Redis exception and country-stat tests; syntax checks; production API and mobile browser verification after CDN purge. Numeric results and deployment times are in tests/results/stats-rebuild-2026-11-06.json.
