# Migration checkpoint

Started 20 November 2026 on codex/rust-migration from 0a34bab. Draft PR: https://github.com/Corvus-gent/loading-website/pull/87

Production unchanged. No production data was written. Full rewrite remains in progress.

Implemented: Cargo workspace; official Vercel Rust adapter and native server; read-only-by-default Redis TCP/REST adapter; compatible HMAC secrets/cookies; OTP login/verify/logout; daily layer handlers; shared Rust/WASM Plethora destinations, page-tier paths, Compound codes and impact score/eligibility rules. Rust live status includes cached Twitch credentials, manual fallback, redirects/counters and private interview requests. Plethora tracking, public/admin reports, CSV and Pacific daily snapshots are ported with batched Redis access and original keys/Lua; old and new handlers match in an isolated shared database. REDIS_TLS_URL preserves priority without changing the signature identity seed. Rust/WASM now implements the gate, language switcher and live banner, preserving original assets/copy. These browser modules are not injected into production yet.

Verified locally: 646 JS/Rust fixtures; native unit tests; isolated login/session/layer tests including concurrent OTP consumption; live API tests including token cache/error handling; sixteen concurrent interview requests across old/new handlers produce exactly one record. Interview owner checks, retention and shared click dedupe pass. Browser tests pass at 390px and 1440px: ritual/DST, cookies, language on home + 3 subpages, banner/dismissal/new session/reduced motion/blocked storage.

Preview https://loading-website-3e08lvs65-corvus11.vercel.app (commit 285a92d) responds on /api/rust with runtime=rust and writeMode=disabled. /compound, /compound/v2, /compound/impact, /live, /hack, /hack/3, /legion and /admin return 200. Rust source, Cargo files and fixtures now return 404. Initial preview dlczhhx78 exposed source build inputs and must not be promoted.

CI from the first commit exposed a third-party Twitch iframe error in the browser test. The isolated parity harness now disables Twitch loading using its existing preference and blocks remote content. A separate pre-existing site smoke assertion expects a global banner on standalone bjj/gabe/index.html; this assertion fails before the migration changes and has not been silently skipped or the page redesigned. An offline/error Twitch badge can overlap the gate language bar; track this during full frontend migration.

CI for 674d0b1: Rust parity passed on GitHub Actions; original Feature checks still fail at the baseline standalone-page banner assertion.

Next: verify a read-only preview with the new modules enabled, then port routing and the remaining API/browser subsystems. See README completion gate. No production cutover until the full required compatibility checks and rollback exercise pass.
