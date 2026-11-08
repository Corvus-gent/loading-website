# Corvus build ledger

`/build` is public. `build/config.json` defines the tracked branch, SF arrival, 50-lines/page estimate, page-title mappings and milestone source files. The default chart shows the whole repository history on a linear date axis. The 7-day multiplier compares actual source size at the cutoff with the current snapshot; it does not stretch the axis or invent points.

## What is counted

Physical lines, including blank lines and comments, in original JS/TS/HTML/CSS/Python/shell/SQL/Go/Rust/PHP/Vue/Svelte/YAML source. `tools/build-stats/source.mjs` is the reproducible filter. It excludes all JSON (including generated data), lockfiles, dependencies, vendor libraries, minified/bundled files, binary/media/public assets, archived client sites, build outputs and coverage/test outputs.

Git follows `--first-parent --diff-merges=first-parent --no-renames`: a merged change counts once, against the previous tree on the tracked branch. Commits without source changes still count as commits, but add no source lines. Files touched means distinct source paths in the selected range. Milestone dates use the first tracked commit touching the configured source path, not a claim about exact production release time. Public activity is GitHub's latest public event sample (max 300), separate from repository totals.

Successful Vercel deployments include previews and production. Initial history comes from the paginated Vercel deployments API (provider-retained history); subsequent signed `deployment.succeeded` events are stored permanently, deduplicated by deployment ID. No emails, raw IPs, tokens or event payloads are stored in these counters.

## Automatic refresh

- `.github/workflows/build-ledger.yml`: read-only repo-scoped `GITHUB_TOKEN` generated automatically by GitHub; `contents: read` and `pull-requests: read`. Full Git history is checked against `git log --shortstat` and the actual tree before publishing. Runs on main/daily/build-branch pushes and hourly once the workflow reaches main. No PAT is needed for this workflow.
- If a standalone fine-grained PAT is desired later: resource owner **Corvus-gent**, repository **loading-website only**, **Contents: Read**, **Pull requests: Read**, **Metadata: Read** (automatic). No write or organisation permissions. Supply it as `GITHUB_TOKEN`, never in client assets.
- `BUILD_INGEST_TOKEN` is configured as a sensitive Vercel env var and GitHub Actions secret. It permits only authenticated snapshot uploads to `/api/build`.
- Vercel cron `/api/build?tick=1` at minute 19 every hour (UTC) creates a durable hourly snapshot, verifies the tracked Git head, and reports a pending source refresh rather than claiming stale source is current. Protected by the existing `CRON_SECRET`.
- The Vercel project webhook sends only `deployment.succeeded` to `/api/build?deployment=1`. `BUILD_VERCEL_WEBHOOK_SECRET` verifies the original raw bytes via HMAC-SHA1 through the existing Web Request entrypoint. Replay delivery does not increment twice.
- Redis: `stats:build:latest`, `stats:build:YYYY-MM-DD-HH` (UTC), `stats:build:deployments`. Aggregate history has no TTL. Historic hours with Git changes are backfilled once; no fake samples are created for empty historical hours.
- Public reads are cached for 60 seconds with stale-while-revalidate, backed by a bundled last verified snapshot if Redis is unavailable. The page refreshes once per minute while visible and retains its last data on API errors.

## Verification and operations

```
BUILD_GIT_REF=origin/daily/2026-11-06-redis-restore BUILD_NO_PUBLISH=1 node tools/build-stats/snapshot.mjs
node tests/build-stats/verify.mjs
node tools/build-stats/publish.mjs
REDIS_URL=redis://127.0.0.1:16380/12 node tests/build-stats/api.mjs
```

The publish command uses `BUILD_INGEST_URL` and `BUILD_INGEST_TOKEN` from the environment. It must run after verification. No GitHub or Vercel credential is returned by the public API. The endpoint reuses `api/stats.js`; deployment callbacks reuse the existing raw-body BMC entrypoint without altering BMC verification.

A fresh hourly cron timestamp cannot be claimed until a scheduled run has actually occurred. The equivalent authenticated heartbeat can be tested immediately. GitHub's scheduled workflow needs the daily PR merged into main, but its branch-push trigger and the Vercel hourly heartbeat work before that.
