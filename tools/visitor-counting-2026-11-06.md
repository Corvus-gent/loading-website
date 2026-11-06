# Visitor counting repair — 6 November 2026

Deployed from `daily/2026-11-06-redis-restore` to production under Gabriel's explicit emergency authorization. No push to main or merge. Production code: `f1c32de`, deployment `dpl_6cVCCvAxWXnkUt41D2HjxdTkNJd8`.

## Causes and changes

1. An explicit allow gate prevented the SDK loading for most visitors. Cookieless measurement now starts by default; GPC, DNT and refusal use a page/day-only counter instead.
2. The privacy payload filter also removed `$raw_user_agent`, a mandatory PostHog cookieless hash input. Production ingestion warnings confirmed `cookieless_missing_user_agent`. The filter now synthesizes only existing coarse categories, e.g. `Chrome/Desktop`; it never forwards the raw browser string or an IP property. `ip:false` remains. Project cookieless mode 2 and discard-client-IP were already enabled; no provider setting was changed. The protected diagnostic is read-only.
3. Snapshot health awaited expensive HogQL builds inside a three-second timeout. It now reads stored ages and queues stale builds with waitUntil. Queries explicitly bypass PostHog's query-result cache; Redis controls snapshot freshness. Cold source queries can take 5–10 seconds, but no longer block the health probe.

## Production comparison

| Check | Before | After |
| --- | --- | --- |
| Overall health | degraded | ok |
| Snapshot health | timeout at 3,000 ms | 15 ms |
| Ready snapshots | stale/partial | all 11 rebuilt, ready |
| PostHog daily visitors / pageviews | 0 / 0 | 2 / 9 |
| Soldiers today / all time | unavailable | 3 / 3 |
| Unseen page hits today | unavailable | 3 |
| Combined visitor estimate | 0 | 5 |
| Fresh snapshot vs independent HogQL | no captured visits | visitor and outbound counts match |

After values were checked at 14:41 UTC. They include our synthetic tests. Two daily pseudonymous visitors do not mean two real humans. Unseen hits cannot be deduplicated; soldiers can repeat after clearing browser data or changing origins.

Real browser pageviews from `/`, `/call/`, `/links/gabe/` appear in PostHog; `notice_ok` is also present. No new missing-user-agent warnings occurred after the repair (last old warning 14:33:00 UTC). HTTP 200 alone was not used as proof. One probe was not query-visible at 45 seconds and appeared later: the requested under-one-minute ingestion target is **not guaranteed**. Cached public figures can also lag by the configured SWR window.

GPC verification: one anonymous POST `{page,day}`, HTTP 204, zero PostHog requests, zero cookies. Soldier acknowledgement returned 204, appeared in PostHog and incremented Redis. Protected report returns 200 with a valid token and 401 without; it has a 60-second Redis cache and HTTP no-store. Its ingestion-warning section can expose future silently dropped events without exposing event payloads.

## Tests and evidence

- Ten counting Playwright tests passed, including default pageviews, GPC/DNT, acknowledgement once, refusal and 360px layout.
- Handler tests passed: origin/schema/private exclusions, aggregate counters and TTLs, nonblocking health, report authentication/cache/redaction, safe error codes.
- Protocol regression passed: required coarse hash input, no raw UA/IP, force-fresh query and read-only provider diagnostics.
- Earlier privacy, SF and stats-speed regressions passed across the initial runs and focused reruns; two external Spotify tests remain opt-in.
- Syntax and whitespace checks passed. Live browser checks reported no JavaScript errors.

Numeric evidence: `tests/results/counting-before-2026-11-06.json` and `tests/results/counting-after-2026-11-06.json`.

## Operational limits

- REPORT_TOKEN was generated and added as Sensitive to Vercel Production and Preview via CLI. Private access instructions are in `~/.secrets/corvus-report-access.txt` (0600), never this repository. Header authentication avoids putting a credential in request URLs.
- The report records instrumented application errors since this release, not every historical Vercel platform error.
- Historical missing visitors cannot be recovered. Today's drop warning is expected while comparing an outage day with full earlier days.
- The latest completed cron remains 6 Nov 11:42:43 UTC; the next scheduled run (7 Nov 02:12 UTC) has not happened. External five-minute monitoring was not established by this change.
- Redis still uses the existing exact-host plaintext exception until 20 Nov; the paid TLS migration remains outstanding. No database migration or credential switch was performed here.
- Legitimate interest is the owner's requested basis, not a legal certification. The privacy audit documents daily pseudonyms and the need for the previously identified ePrivacy review.
