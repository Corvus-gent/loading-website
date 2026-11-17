# Gabe’s LinkedIn statistics

Live: https://stats.corvus.gent/linkedin. The social CV includes two collapsible previews using the same chart component and data.

## Update

Read newest main before editing. Import a new aggregate LinkedIn export:

    python3 tools/import-linkedin.py /absolute/path/export.xlsx --imported-on YYYY-MM-DD

For a daily CSV, the headers must be `Date,Impressions,Engagements` with optional `New followers`. Dates accept M/D/YYYY or YYYY-MM-DD. A CSV without discovery/follower summary leaves those metrics unavailable instead of retaining older values. The importer rejects duplicate/missing dates, negative counts and XLSX daily impressions that disagree with DISCOVERY. It publishes only selected aggregate metrics, not demographics, post URLs or the original file.

`stats/linkedin/data.json` is a complete snapshot, replaced on each import rather than appended; overlapping export windows must not be added together. Keep the input file unchanged outside the repo. Source SHA-256 and source tab descriptions establish provenance. The initial input was the owner's aggregate export covering 2026-08-20 through 2026-11-17; DISCOVERY B2=140469, B3=71692, ENGAGEMENT A2:C91 daily observations, FOLLOWERS B1=1538 and A4:B93 new followers. Daily impressions reconcile exactly to DISCOVERY. The screenshot showed 140468; the more recent export takes precedence.

The source's final date is flagged as partial when it is on/after the import date. `Full export` includes it and labels it. Recent 7/28-day ranges exclude it. All daily dates use UTC. Cumulative series reset at the selected range's first date. Missing follower data stays missing. Do not infer daily follower balances from today's total and new-follower gains; unfollows are not supplied.

`stats/linkedin/profile-views.json` is separate: the export does **not** contain daily profile views. Its initial value 1627 and reported +2293% comparison for displayed 3–10 Nov 2026 come from the user's supplied LinkedIn summary. Preserve those exact displayed dates (LinkedIn labels it a seven-day window). Plot only observed snapshots, never invent/interpolate missing weeks. Ask for an updated summary with exact dates or a real profile-view series at each refresh. The screenshot's 1951 selected-window total is not a time series and isn't plotted.

First SF week means seven UTC daily rows, 6–12 Nov, compared with 30 Oct–5 Nov. 81664 / 4962 - 1 = 1545.788%, rounded to +1546%. This describes an association during the week, not a causal attribution. Profile viewers are a different reporting window and are not combined into that comparison.

## Verify

    node --experimental-vm-modules tests/linkedin-stats.mjs
    python3 tests/linkedin-import.py

Check selectors (metric, period, cumulative/daily), arrow-key/pointer readouts, profile-view provenance, 320px mobile layout, CV collapsed/expanded previews and failure text. Browser production checks must intercept CV visit/click requests so QA doesn't alter public counters. Verify https://stats.corvus.gent/linkedin stays on the stats host, both aliases redirect appropriately, and existing stats pages still load. Push main and wait for the production deploy.
