# Migration checkpoint

Started 20 November 2026 on codex/rust-migration from 0a34bab. Draft PR: https://github.com/Corvus-gent/loading-website/pull/87

Production unchanged. No production data was written. Full rewrite remains in progress.

Implemented: Cargo workspace; official Vercel Rust adapter and native server; read-only-by-default Redis TCP/REST adapter; compatible HMAC secrets/cookies; OTP login/verify/logout; daily layer handlers; shared Rust/WASM Plethora destinations, page-tier paths, Compound codes and impact score/eligibility rules. Rust live status includes cached Twitch credentials, manual fallback, redirects/counters and private interview requests. Plethora tracking, public/admin reports, CSV and Pacific daily snapshots are ported with batched Redis access and original keys/Lua; old and new handlers match in an isolated shared database. REDIS_TLS_URL preserves priority without changing the signature identity seed. Rust/WASM now implements the gate, language switcher and live banner, preserving original assets/copy. These browser modules are not injected into production yet.

Verified locally: 646 JS/Rust fixtures; native unit tests; isolated login/session/layer tests including concurrent OTP consumption; live API tests including token cache/error handling; sixteen concurrent interview requests across old/new handlers produce exactly one record. Interview owner checks, retention and shared click dedupe pass. Browser tests pass at 390px and 1440px: ritual/DST, cookies, language on home + 3 subpages, banner/dismissal/new session/reduced motion/blocked storage.

Preview https://loading-website-3e08lvs65-corvus11.vercel.app (commit 285a92d) responds on /api/rust with runtime=rust and writeMode=disabled. /compound, /compound/v2, /compound/impact, /live, /hack, /hack/3, /legion and /admin return 200. Rust source, Cargo files and fixtures now return 404. Initial preview dlczhhx78 exposed source build inputs and must not be promoted.

CI from the first commit exposed a third-party Twitch iframe error in the browser test. The isolated parity harness now disables Twitch loading using its existing preference and blocks remote content. A separate pre-existing site smoke assertion expects a global banner on standalone bjj/gabe/index.html; this assertion fails before the migration changes and has not been silently skipped or the page redesigned. An offline/error Twitch badge can overlap the gate language bar; track this during full frontend migration.

CI for 674d0b1: Rust parity passed on GitHub Actions; original Feature checks still fail at the baseline standalone-page banner assertion.

Read-only enabled preview https://loading-website-l5kbhsnyf-corvus11.vercel.app (07a332f): live and Plethora modules respond, writes stay disabled, and the Rust Plethora report equals the legacy report (64 preview-environment clicks, not production counts). Rust CI for 07a332f passed.

Middleware decisions now match 9,324 cases across the complete catalogue, three hosts, aliases, OG metadata, gates, UTF-8 queries, private source paths and CLI analytics. Routing decisions are not wired to production traffic yet. The actual publishing build passes in a disposable copy: Rust HTML fragments remain unchanged, and Rust/target inputs never enter the directory or search.

Support bookings/referrals now preserve the three tiers, owner/key administration, status edits with original TTLs, raw and unique counters, form challenges and email payloads. A 16-request JS/Rust race creates one booking. Tests cover shared rate limits, CSRF, private/public separation and email denial before external I/O in read-only mode. 776 pure contracts pass. No actual emails sent.

Battle voting and shared voter security are ported: 12 redirects, blind device order/media, old/new voter-cookie interoperability, ten simultaneous votes count once, tie/close/reopen, admin validation, original 90-day vote retention and cross-runtime single-use proof-of-work challenges. 910 pure contracts and 9,324 routing decisions pass. No production vote or email was sent.

Merged upstream f2a5ed3 (tattoo/inspiration) without changing its content. Routing tests now discover current sources instead of trusting a stale generated catalogue: 9,468 decisions pass. The pre-existing banner test now checks the actual publishing artifact and preserves standalone canvases, the Sonar form and game admin; mobile/desktop checks pass locally. Full Feature CI must still be rerun. Support CI passed on GitHub Actions at cd79e66.

Rust/WASM now also implements arrival attribution, the booking form and its private admin interface. Browser checks pass at 390px and 1440px, including lost-network retries, stable request IDs, required coffee confirmation, escaped admin text and failed-save rollback. A separate end-to-end test uses the actual Rust API and an ephemeral Redis instance: form → validated storage → private admin → status edit → reload. All browser traffic is intercepted locally; no production request or email is sent. The upstream hack browser test now opens its existing archive disclosures before checking the archived robotics/game content, and mocks the newer Worldcraft hero API. No product markup changed.

GitHub Rust checks passed for d06b920. The full Feature workflow still needs another run after the archive-fixture correction.

Next: continue browser/API migration, starting with battle browser behavior. Most application areas remain pending. See README completion gate. No production cutover until the full required compatibility checks and rollback exercise pass.
