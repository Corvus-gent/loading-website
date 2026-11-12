# Compound reporting and /push

- Production: https://corvus.gent/push and https://corvus.gent/compound/v2/stats
- Owner sign-in uses existing COMPOUND_V2_ADMIN_PASSWORD or COMPOUND_ADMIN_PASSWORD. “Make this the winner” selects a published TikTok, Instagram or X post. WINNER_POST_URL is an optional fallback; otherwise the highest reported registered post is shown until an owner selection is saved.
- The Vercel team corvus11 was verified on Pro. Cron `/api/compound-v2?reportJob=1` runs at minute 07 and 37 each hour using the existing CRON_SECRET. It continues while the Mac is asleep.
- Report reads require owner authentication. The last successful report is retained through failures. Current samples: last 48 hours (96); half-hour report history: last seven days (336); daily archives: 90 days. No new storage service or paid subscription.
- Rates use actual timestamped changes and explicitly show unavailable when there is no new metric reading. Best variant compares mean reported views per post across base/goofy/short/long and is labelled observational.
- `node tools/compound-report.mjs --refresh`: run the server job now and mirror the markdown locally.
- `node tools/compound-report.mjs`: mirror the latest report to report.md in this checkout. It is owner-only generated data, ignored by Git and excluded from site deployment. Secrets come from ~/.secrets/corvus-compound.env; never from command arguments.
- `node tools/install-compound-report-agent.mjs`: install a 30-minute macOS file mirror. Label gent.corvus.compound-report, logs in ~/.codex/logs. The local file catches up while the Mac is awake; the cloud report job is independent.
- To remove the local mirror: launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/gent.corvus.compound-report.plist
- Comments in push/config.js are editable suggestions. Nothing is posted automatically; social players load only after a click.
