# Corvus Rust migration — work in progress

This is a full application migration, not a redesign. The target is Rust server code and Rust/WebAssembly browser logic. HTML, CSS, translations, photos, videos and public datasets stay assets. Minimal generated WASM bindings and third-party hosted embeds remain browser integration boundaries. A proxy around the old Node application does **not** count as a completed migration.

## Frozen baseline and rollback

- Repository baseline: `0a34babbba561abcffc1aa7e4356de4d8855adf7` (latest main when migration started).
- Production at start: `https://loading-website-i0ifimei3-corvus11.vercel.app`, deployment `dpl_CkqKcDSd8XHMPfE7JcivGUYLrFtE`.
- Branch: `codex/rust-migration`. Never push or merge main as part of migration work.
- Keep the original handlers runnable until the replacement passes all gates. No schema rename, credential rotation, counter reset or replay of side effects.
- Before any production promotion, re-read the current production deployment and fetch main. If either changed, integrate and re-run the relevant baseline tests. The start deployment alone is not a permanent rollback target.
- Rollback is a Vercel deployment rollback, not a Redis restore. Old and new handlers must understand the same records and cookie signatures. Verify rollback first in a preview using synthetic data.

## Runtime choice

Use portable Rust with Axum, Tokio and rustls. An adapter uses the **official** `vercel_runtime` 2.x, replacing the deprecated community builder. Vercel still labels its Rust runtime beta; deployment and cold-start verification are release gates, not assumptions. Keep a local native server with the same router so application logic is not coupled to the Vercel bridge.

- Official runtime: https://vercel.com/docs/functions/runtimes/rust
- Official Axum example: https://github.com/vercel/examples/tree/main/rust/axum

## Safety defaults

- `CORVUS_RUST_MODULES` is empty by default. It admits exact module names only.
- `CORVUS_RUST_WRITES` is unset by default. Storage writes are denied before network access.
- `isolated` permits writes only to a nonzero local Redis database outside production. Tests launch their own Redis process and use no real credentials.
- `production` permits writes only when `VERCEL_ENV=production`. Do not enable until parity, side-effect isolation, rollback and production-read checks pass.
- The new endpoint does not automatically receive existing traffic. Merely adding Rust does not migrate a route.
- Preview comparisons use read-only requests. Never shadow POSTs, payment webhooks, email sending, click increments or cron jobs. Use fixtures for those paths.
- No secrets or full request headers in logs. Tokens remain environment-only. Bounded upstream timeouts and request sizes; errors returned to clients are generic.
- Existing Redis transport preference, secret derivation, HMAC bytes, TTLs and Lua atomicity are compatibility contracts. Ambiguous suffix configuration fails closed and must be explicitly resolved.

## Work order

| Area | Required checks | State |
|---|---|---|
| Inventory, baseline, Cargo workspace, native/Vercel/WASM adapters | Compile; snapshot production; no changed routes | In progress |
| Storage, secrets, OTP sessions, consent, rate limiting | JS/Rust signature parity; bidirectional cookies; concurrent OTP use; denied preview writes | Initial auth tests pass locally |
| Routing, gates, tiers, language state | All route aliases; protected-page negative tests; 04:02/DST; mobile/browser parity | Layer handlers and gate/language browser parity pass locally |
| Compound/battle/interviews/impact | No lost votes; private/public field boundaries; null-vs-zero scores; code links; admin writes | Pure metrics/code rules, private live interviews, battle voting/proofs, hackathon comments and OSSMAN scores/ideas pass isolated cross-runtime tests; Compound registry/auth/import/queue/winner/reports/sync and HTTP/summary handlers verified; interview quick-add/store/photo and browser flows verified locally; interview OG pending; Impact model/storage/providers/sync/HTTP verified; Impact and Compound v2 public/admin/share Rust/WASM verified locally; original three-cut API and Stripe webhook pass isolated store/HTTP/signature contracts; original admin/statistics Rust/WASM pass real API and exact-DOM checks; latest native preview verified read-only for earlier modules; publishing browser WASM remains pending |
| Games, Plethora, support, referrals, public statistics | Game replay fixtures; atomic counters; no duplicate tracking; historical totals | Plethora and support handlers pass cross-runtime tests; other handlers pending |
| Legion, Senate, payments, email, uploads | Test invite claim/edit/revoke; webhook retries; stored identity compatibility; blob/image EXIF rules | Pending |
| Remaining APIs, research tools, build, OG, scheduled jobs | Complete file inventory; contract fixtures; single scheduled writer | Pending |
| Browser logic, Rust build pipeline | Same content/layout; translations; keyboard/mobile; games; no legacy application JS remaining | Gate, language, live banner, arrival, support/admin, battle/admin, privacy, interview admin/grid, Compound v2 hub/admin/share and Impact/admin pass browser checks; other modules pending |
| Canary → production | All release gates and actual rollback exercise | Not authorized by test results yet |

“Not authorized by test results” means technical release criteria have not passed; it does not request new user permission. The user already authorized the migration.

## Reproduce current checks

```
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build --bins
node tools/rust/parity.mjs
node tests/rust/compound-model.mjs
node tests/rust/compound-share.mjs
node tests/rust/interview-model.mjs
node tests/rust/impact-model.mjs
node tests/rust/impact-providers.mjs
node tools/rust/routing-parity.mjs
node tests/rust/build-boundary.mjs
node tests/rust/auth-parity.mjs
tools/rust/build-browser.sh
node tests/rust/browser.mjs
node tests/rust/user-flows.mjs
node tests/rust/battle-browser.mjs
node tests/rust/compound-client.mjs
node tests/rust/compound-browser.mjs
node tests/rust/compound-admin-render.mjs
node tests/rust/compound-editor-render.mjs
node tests/rust/compound-editor-browser.mjs
node tests/rust/interviews-browser.mjs
node tests/rust/impact-browser.mjs
node tests/rust/impact-render.mjs
node tests/rust/privacy-browser.mjs
cargo check -p corvus-browser --target wasm32-unknown-unknown
```

`auth-parity.mjs` starts a fresh loopback-only Redis instance on a free port and deletes no existing database. Set `REDIS_SERVER` to the local redis-server executable if it is not on PATH. Existing JavaScript tests remain in CI throughout migration. Passing these initial checks is **not** evidence that the whole site has migrated.

## Completion gate

Do not call this migration finished while any executable application area remains legacy, any required comparison has a discrepancy, or a private/write path lacks coverage. Record the actual deployed URL, test output and rollback evidence for each cutover. Keep outstanding items explicit in `checkpoint.md`.

## Recorded compatibility corrections

- Compound v2: reject a missing Origin header instead of preserving the old undefined-origin allowlist bug. Authenticated bearer clients retain their explicit administrative exception. Cookie-only writes require an allowed origin.
- Compound metrics refresh: compare parsed records, then CAS the original Redis bytes. Equivalent JSON property ordering between runtimes is accepted; a changed owner record is never overwritten.
- Imported timestamps use ISO/RFC date formats, UTC date-only parsing and the host timezone for offset-free date/time inputs. Legacy nonstandard Date.parse-only input forms require a separate compatibility decision before this handler is promoted; existing saved timestamps are ISO strings.
- Vercel background tasks must use request-scoped `AppState::wait_until`, not a detached Tokio task. Pinned 2.4.1 documents the invocation-lifetime fix; preview verification remains required before moving provider refreshes/redirect counting. Reference: https://docs.rs/vercel_runtime/2.4.1/vercel_runtime/struct.AppState.html

Compound v2 browser coverage runs both the original JavaScript and Rust/WASM public hub, owner desk and share tools against the actual Rust API and isolated Redis. The Impact admin mount is included; its full provider workflows have separate coverage. DOM parity covers en-US/nl-BE owner forms, scores, rollups, queue and reports. Native QR generation uses pinned, dependency-free qrcodegen 1.8.0 (https://www.nayuki.io/page/qr-code-generator-library); a separate test-only decoder verifies its encoded link, copy and PNG download. QR masks may differ, while payload, byte mode, error correction, quiet zone and displayed size are preserved.

Interview photo compatibility uses native Rust `image` (orientation, dimensions and metadata removal) and the HTTP wire contract of the repository’s pinned `@vercel/blob` 2.8.2 (API version 13). Local provider fixtures verify authorization, path, cache/type headers and cleanup. Actual Blob integration in a preview-only namespace is a separate pending gate. References: https://docs.rs/image/0.25.10/image/struct.ImageReader.html and https://vercel.com/docs/vercel-blob/using-blob-sdk.

Impact migration libraries preserve canonical post hashes, account aliases, six-platform metric normalization, null/zero/unsupported distinctions, original-video eligibility, self-reported LinkedIn imports, partial scores and first-day history. The shared Redis transaction updates annotations and linked tracker metrics together. Provider CAS compares decoded public values and the transaction compares original raw records. Field observations keep official data from being downgraded by scrapers and prevent older observations from overwriting newer ones. Exact floating-point JSON round trips are enabled for stored velocity; empty totals use positive zero. Impact HTTP/provider/browser integration passes local compatibility checks. Production routing and full cutover remain pending.

The optional Impact owner/provider adapters now exist in Rust: X, TikTok Display, Instagram Graph Insights, YouTube Data/Analytics, Twitch Helix, Oriane fallback, and LinkedIn's manual status. They use fixed first-party HTTPS origins, bounded responses/timeouts, no HTTP redirects, fixture-only network in isolated mode and no provider refresh in read-only mode. No real API credentials or quota were used during compatibility tests. X errors retain status/retry information; Twitch errors deliberately omit remote response bodies and clear cached credentials on 401. Provider sync orchestration, HTTP and browser integration are verified locally. Existing scheduled jobs and production traffic still use their current implementation.
