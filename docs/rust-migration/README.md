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
| Compound/battle/interviews/impact | No lost votes; private/public field boundaries; null-vs-zero scores; code links; admin writes | Pure metrics/code rules, private live interviews, battle voting/proofs, hackathon comments and OSSMAN scores/ideas pass isolated cross-runtime tests; Compound registry/auth/import/queue/winner/reports/sync and HTTP/summary handlers verified; interview quick-add/store/photo and browser flows verified locally; native interview/live/Compound/Curiosity OG verified locally; Impact model/storage/providers/sync/HTTP verified; Impact and Compound v2 public/admin/share Rust/WASM verified locally; original three-cut API and Stripe webhook pass isolated store/HTTP/signature contracts; original public/admin/statistics Rust/WASM pass real media/API and exact-DOM checks; latest native preview verified read-only for earlier modules; publishing browser WASM remains pending |
| Games, Plethora, support, referrals, public statistics | Game replay fixtures; atomic counters; no duplicate tracking; historical totals | Plethora and support handlers pass cross-runtime tests; other handlers pending |
| Legion, Senate, payments, email, uploads | Test invite claim/edit/revoke; webhook retries; stored identity compatibility; blob/image EXIF rules | Native shared membership/admission/Stripe/applications/newsletter/Senate APIs and Rust/WASM public/private/admin flows pass isolated tests; read-only preview verified. Army account/provider/public/service/jobs/HTTP libraries pass isolated contracts; native artwork/profile metadata and Army Rust/WASM browser pass isolated contracts; actual Blob integration and durable cleanup pending |
| Remaining APIs, research tools, build, OG, scheduled jobs | Complete file inventory; contract fixtures; single scheduled writer | Native OG model/render/HTTP pass isolated tests; other remaining APIs pending |
| Browser logic, Rust build pipeline | Same content/layout; translations; keyboard/mobile; games; no legacy application JS remaining | Gate, language, live banner, arrival, support/admin, battle/admin, privacy, interview admin/grid, Compound v2 hub/admin/share, original Compound public/admin/stats, Legion/Senate visitor/admin/editor/letters Army account/gate/public/owner interfaces and Impact/admin pass browser checks; other modules pending |
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
node tests/rust/compound-editor-public-render.mjs
node tests/rust/compound-editor-public-browser.mjs
node tests/rust/interviews-browser.mjs
node tests/rust/legion-model.mjs
node tests/rust/army-model.mjs
node tests/rust/army-store.mjs
node tests/rust/army-auth.mjs
node tests/rust/army-payments.mjs
node tests/rust/army-capacity.mjs
node tests/rust/army-discord.mjs
node tests/rust/army-mail.mjs
node tests/rust/legion-store.mjs
node tests/rust/legion-admission.mjs
node tests/rust/legion-newsletter.mjs
node tests/rust/legion-payments.mjs
node tests/rust/legion-photos.mjs
node tests/rust/legion-upload.mjs
node tests/rust/legion-render.mjs
node tests/rust/legion-browser.mjs
node tests/rust/legion-letters.mjs
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

Army payment compatibility corrections: settle limited Consul seats under a shared lease with a fenced account CAS, surface capacity refusals for owner review, and apply a matching lifetime-product refund even without repeated product titles. Tests reproduce the old oversell and reject stale/expired-lock writes; no real payment is created, refunded or modified.

### Native social cards

`og` opts into Rust selection/metadata and 1200×630 PNG rendering for live, hack/interview, Compound and Curiosity cards. Interview page/card aliases are also native. 1,790 model contracts preserve canonical/image URLs, metadata escaping and hook/version selection; rendering covers ten language scripts, long text and broken-photo fallback. The original bundled fonts are reused with resvg and its already-pinned HarfRust shaper. No SVG can load a filesystem or network resource.

Remote interview photos are limited to the existing public Blob namespace, HTTPS without credentials/redirects, 2.2 seconds and 2.5 MB; decoding caps input at 20M pixels. Two rendering workers hold their permits through cancellation and cache at most 48 cards/16 MB. Gabe's known portrait is the original renderer's prepared attention crop, bundled as `rust/migration/og-gabe.jpg`; remote portraits use a centered native crop. Rasterization/font metrics differ slightly from Satori/Pango, with side-by-side phone-size visual review recorded under `test-results/rust/og-*`. No copy, card dimensions, colors or destination URLs change. The HTTP suite covers HTML/PNG/HEAD/404/405, Curiosity totals, escaped interviews and concurrent cached requests against disposable Redis.

Read-only preview for Army server/browser source checkpoint a220972: https://loading-website-174q1q3uu-corvus11.vercel.app (`dpl_EYaay66F2sPei39uU13QVzz7vZ2X`). Public original/v2/Impact/Legion/Senate/partner JSON parity, critical HTML and source boundaries pass. This preview still serves the existing JS browser scripts; neither production nor the final WASM publishing/cutover has changed.

### Shared browser shell

The command palette, public directory/search, dynamic Senate/video/soldier discovery, anonymous newsletter form, Cardneto secret, tracked Compound links, inspiration rails/mobile reference and daily detail anchors now have opt-in Rust/WASM implementations. Source template/data freshness checks preserve the original markup and art. 3,735 pure URL/discovery/attribution comparisons pass; encoded private paths, credentials, non-HTTPS URLs and internal source paths are explicitly excluded from the catalogue.

Legacy/native behavior matches at 390px/1440px for search keyboard/mouse/modal paths, dynamic rows, private-row removal, retrying newsletter submission with fields preserved, functional preference retention, attributed links added after load, nested details and artwork placement. Published HTML also passes home → map → home, five home doors, language/newsletter, real map search, standalone new CV pages and overflow/console checks. The unrelated original Compound mobile action overlap is corrected with a scoped CSS offset; both old/new complete video/editor flows now activate the share control by a real pointer click. Army and Legion render suites remain green after shell replacement. Final production WASM publishing and hydration/failure guards still remain gates.

## Realm, terminal and remaining shared browser controls

The opt-in WASM client now implements the original terminal commands, keyboard/dialog safeguards, delayed hints/navigation, realm lighting/touch tour/focus/reduced-motion/visibility behavior, time-bound SF door, share clipboard, local feather collection and existing-identity-only proof-bound sync. Functional preferences and retained catches survive provider failures; no anonymous account is enrolled. Legacy corner navigation/search, feature-language caches/concurrent reads/English fallback, motion suspension and expiring storage notice are also Rust. Original content/templates/data remain assets with freshness checks. A mobile-only CSS offset keeps the existing peeking Pidgy above the shared navigation.

`realm-browser.mjs` compares old/new terminal output and real interactions at 390/1440px, checks local-only collection, one existing-identity retry after failure, clipboard and the SF boundary. `realm-motion-browser.mjs` checks both mouse and touch, focused lights, sequential tour, reduced motion and hidden tabs. `site-legacy-browser.mjs` checks search excerpts and escaping, language controls, 21 feature locales, concurrent/fallback cache behavior and visibility/expiry state. The daily gate/language, shared shell, Army three-locale and Senate two-locale regressions pass. Timer callback ownership preserves the full browser handle, also supporting instrumented clocks, and releases canceled closures.
