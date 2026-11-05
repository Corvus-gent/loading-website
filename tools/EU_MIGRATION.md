# Frankfurt rollout — operator runbook

Target: Vercel application functions in `fra1`, managed Redis in Frankfurt
(`eu-central-1`), PostHog Cloud EU in Frankfurt. This is **not a blanket EU-only
processing promise**: Vercel's static CDN/routing middleware is global, provider
logs/support/backups need account checks, and Gabriel explicitly retains Resend as
a temporary US-storage exception. Resend's Ireland (`eu-west-1`) region controls
sending, not email/log storage. Do not claim that setting makes storage European.

## Current evidence and prerequisites

- `vercel.json` pins functions to one region, `fra1` (Hobby-compatible). Deployment
  of this change and a live execution check are still required.
- The saved [before measurement](../tests/results/eu-region-before.json), 4 November
  2026, is from Belgium (`countryCode=BE`). Every uncached API sample reports
  `fra1::iad1`: European ingress, **US function execution**. Five samples per API:
  auth median 162 ms / p95 1096 ms; country median 155 ms / p95 235 ms. These are
  total fetch times, include connection/cold-start effects, and do not measure
  Redis round-trip time (`/api/auth` without a cookie doesn't read a session).
- No production environment or Vercel account credentials are available in this
  checkout. Current Redis provider/host/region, account agreements, replicas and
  backups have **not** been verified. A hostname is only a hint, not proof.
- No production copy, environment switch or after measurement has been performed.
  Preview SSO is not evidence of function execution. Do not merge these tasks into
  a claim that the data has already moved.
- Keep secrets out of chat, Git, shell history and command-line arguments. Load
  them into the local process environment using the provider's secure workflow.
  The tools do not print credentials, key names, values, addresses or IPs.

## Ordered steps for Gabriel

1. **Confirm the source.** In Vercel Storage/Marketplace, inspect the currently
   connected database and the effective production environment. Confirm its
   provider and actual region in the provider console, including replicas/backups.
   Also check preview deployments and any other writers. If already Frankfurt,
   no copy is needed: keep that database and proceed to region/verification steps.
   If elsewhere, create a Frankfurt `eu-central-1` database. Keep it empty; match
   Redis feature/version support (`SCAN`, `EVAL`, `DUMP`, `RESTORE ABSTTL`, `PTTL`).
   Connecting Marketplace must **not overwrite active `REDIS_URL` yet**: use a
   temporary prefix/environment or collect the new TLS URL separately. Upstash
   supports DUMP/RESTORE, but verify the actual selected provider/plan. Avoid
   global replicas or backups outside the agreed region.

2. **Preserve existing signing keys before changing storage.** Load the current
   production environment, then run the following with a new private path outside
   the repository. The file is created owner-only (0600), never overwritten.

   ```sh
   node tools/pin-redis-secrets.mjs --output /private/tmp/corvus-signing.json
   ```

   Import its five values as sensitive Vercel environment variables:
   `SESSION_SECRET`, `LANGUAGE_VOTE_SECRET`, `MUSIC_VOTE_SECRET`, `GAME_SECRET`,
   `PRIVACY_SECRET`. Do not generate replacements during the move. The different
   defaults were not interchangeable: changing only `SESSION_SECRET` could break
   existing music cookies or change the daily puzzle. Deploy this PR's code with
   the pinned values and the **old** database first. Confirm existing cookies and
   game answers remain valid, then remove the local secret file. This avoids
   invalidating sessions, OTP lookup hashes, voters, privacy hashes and game seeds.

3. **Set the application region.** Settings → Functions → Function Regions →
   Frankfurt (`fra1`) in Vercel; keep the committed `regions: ["fra1"]`. Check
   Production and Preview environment scopes and redeploy. In the Resend domain
   settings, check/set Ireland for sending if available (follow Resend's domain
   recreation/DNS requirements if a region change requires them); retain US
   storage as the documented exception. Confirm PostHog uses an EU project and
   `POSTHOG_HOST=https://eu.posthog.com` or unset. A US override now fails closed.

4. **Pause writers for a consistent copy.** Set `REDIS_MAINTENANCE=1` on every
   deployment using the source and redeploy; stop local scripts/jobs. The app's
   Redis adapter rejects commands/pipelines and connected APIs return unavailable
   or their existing read-only fallback. Confirm `/api/auth` returns 503. Cached
   public pages may still display. Prevent requests to older deployment URLs from
   writing (restrict those deployments or revoke their write credential after
   issuing a migration-read credential). Drain in-flight requests for the actual
   configured maximum function duration. SCAN is **not a database-wide snapshot**;
   do not run the real copy against active writers. Retention cleanup must not run
   concurrently. Freezing traffic briefly is safer than losing a concurrent vote.

5. **Dry run, copy, verify.** Load `OLD_REDIS_URL` and `NEW_REDIS_URL` into the
   process environment (TLS `rediss://`, not REST URLs). Run:

   ```sh
   node tools/migrate-redis.mjs --dry-run
   node tools/migrate-redis.mjs --apply --source-paused
   node tools/migrate-redis.mjs --verify
   ```

   Default is dry-run: no destination writes. Apply refuses a nonempty target and
   requires the explicit paused-writer flag. It never changes the source. Binary
   DUMP/RESTORE copies all Redis types; per-key Lua captures DUMP/PTTL atomically,
   with absolute expiration passed to RESTORE so copying cannot extend retention
   or resurrect an expired login code. Persistent keys remain persistent (run the
   separate privacy-retention tool before/after the move for legacy personal keys).
   Verification compares key counts, types, values and absolute expirations;
   unordered hashes/sets compare logically when serialized bytes differ. Streams
   preserve group metadata. Provider/RDB incompatibility fails without changing
   the source. Reports contain counts and sizes only.

   Exit 0 with `verification.ok=true` is required for both apply and verify. Exit 1
   means failure; exit 2 means differences. A partial copy may be resumed using
   `--apply --source-paused --resume` **only against this same migration target,
   while all writers remain paused**; it deliberately replaces matching keys.
   It does not delete extra target keys, so verification will flag them. Natural
   expiry near a check can require rerunning `--verify`. Never switch on a failed
   comparison. Do not delete the source to resolve a mismatch.

6. **Switch and redeploy.** Set production `REDIS_URL` to the new TLS URL. Remove
   obsolete REST/legacy bindings, or ensure they also reference the new database.
   An explicit `REDIS_URL` now wins over old Marketplace REST variables; without
   it, legacy REST selection remains unchanged. Keep the five signing values
   exactly as pinned. Clear `REDIS_MAINTENANCE`, redeploy, and restrict old URLs from
   accepting writes. Also update authorised previews/jobs that should use the new
   database; don't accidentally expose production data to unrelated previews.

7. **Verify before declaring completion.** Check an existing logged-in session,
   a fresh login initiated by Gabriel, music ranking and counts, language/music
   votes and the platform poll, daily-game progress, and public/private stats.
   Use known test data/accounts for any write checks. Confirm counters continue
   from their previous values and no duplicate votes are accepted. From the same
   Belgian connection used for the baseline:

   ```sh
   node tools/check-eu-region.mjs --verify --output /private/tmp/corvus-eu-after.json --compare tests/results/eu-region-before.json
   ```

   The check exits 2 unless both region/location checks pass. The report must have `belgiumVerified=true` and `frankfurtVerified=true` on
   uncached 200 responses, with the final execution region `fra1`. A single edge
   region or a cache HIT alone is insufficient. The baseline contains 5 samples;
   timing is indicative, not a benchmark. Frankfurt compute co-located with Redis
   should reduce distance, but report measured results rather than guaranteeing a
   latency improvement. Mark actual Redis region, migration completion, function
   execution and measured after values in the audit/privacy page only once checked.

8. **Retain the old database for 7 days, then delete it.** Record the actual switch
   time and deletion deadline privately. Keep old credentials restricted and the
   database read-only; its TTLs continue running. Apply data-deletion requests to
   both copies during this window. After writes resume, the old copy is stale:
   switching back without reconciling new writes loses data. Gabriel deletes the
   old database and applicable backups at day 7, then removes obsolete credentials
   and records completion. No automatic deletion job is created by this PR.

9. **Finish provider privacy settings.** Retain/confirm Vercel's DPA and applicable
   EU–US DPF/SCC safeguards, Redis DPA/regions/backups, PostHog discard-client-IP,
   replay off, 90-day event retention, Resend plan/log retention and sending region,
   and Vercel log retention/drains. Review the secondary Netlify integration so no
   unnecessary deployment/log copies remain. Neither a DPA nor DPF certification
   implies all provider processing stays in the EU.

## References

- [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region)
- [Vercel response headers](https://vercel.com/docs/headers/response-headers)
- [Vercel DPA](https://vercel.com/legal/dpa), [security/DPF](https://vercel.com/security)
- [PostHog EU storage](https://posthog.com/docs/privacy/data-storage)
- [Resend sending regions](https://resend.com/docs/dashboard/domains/regions), [US storage and retention](https://resend.com/security/gdpr/)
- [Redis DUMP](https://redis.io/docs/latest/commands/dump/), [RESTORE/ABSTTL](https://redis.io/docs/latest/commands/restore/)
- [Upstash command support history](https://upstash.com/docs/redis/overall/changelog)
