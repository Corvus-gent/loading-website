# Migration measurement and release evidence

The migration must preserve the site's behavior and show measured performance, not assume that Rust is faster. Code volume is not progress, correctness or speed. No production improvement has been established yet. Production continues to use the existing implementation.

## Code change ledger

Run from the repository root:

```sh
node tests/rust/measure-source.mjs
node tools/rust/measure-source.mjs
```

The JSON and readable Markdown go to `test-results/rust/measurements/source-{commit}.json` and `.md`. CI uploads them as the `rust-source-ledger-{commit}` artifact. The ledger records the full commit IDs and every counted file, with additions, deletions, net lines and total physical source lines. It uses the existing `/build` source policy: comments and blank lines count; lockfiles, JSON, public assets, binaries, vendored/minified code and build output do not. Application code, verification/tooling and generated compatibility templates are reported separately.

Two comparisons are kept. The frozen migration-start comparison includes subsequent upstream features. The aligned comparison uses the merge base with current `origin/main`, separating changes belonging to this branch. Neither includes uncommitted edits. A fixture checks reconciliation against Git trees and `git diff --shortstat`, including upstream merges and unusual file names. Old JavaScript remains during parity work, so additions are not presented as lines already replaced or a percentage complete.

## Browser lab

```sh
node tests/rust/performance-evidence.mjs
node tools/rust/performance.mjs --repeats=3
node tools/rust/performance-report.mjs test-results/rust/measurements/browser-TIMESTAMP.json
```

Three repetitions are an exploratory diagnostic. Before a release comparison, run `--repeats=20` from a clean committed tree, then use the report command with `--require-pass`. A pass applies only to the recorded routes and scenarios. Keep raw JSON, Markdown and `.gate.json`, including failures and regressions. Do not select only favorable runs.

The runner rebuilds WASM with the pinned lockfile, builds a disposable copy of the actual HTML/assets and compares the original browser scripts with their current native bridges. It never changes the working site's build output or calls live providers. It records code/build hashes, browser version, machine, all timing samples, asset sizes, fixture errors and conditions. Known public pages now select the smaller core profile with one early import map; the report records that profile and its hash. Unknown and feature pages keep the full runtime. This fixture selection is not yet the production publishing architecture.

Conditions:

- Home, map and CV interaction flows; desktop 1440×1000 and mobile 390×844.
- Mobile: 4× CPU throttle, 150 ms network latency, 1.6 Mbps download and 0.75 Mbps upload. Desktop uses the same machine without throttling.
- Alternating engine order, one unrecorded warmup per route/profile/engine, fresh HTTP/storage contexts and warm reloads. Fresh context does not mean a fresh browser process or a serverless cold start.
- Identical fixture data and 40 ms API delay; Brotli quality 4, real browser HTTP cache, no Playwright request interception. Third-party analytics/embeds are blocked; functional interactions and consent refusal are preserved.
- FCP, LCP, layout shift, longest/total long tasks, usable-interaction readiness, TTFB, transferred bytes and JS/WASM bytes. The action-to-two-frames measurement is synthetic, **not field INP**. LCP/CLS observations end at the recorded interaction; these are not real-user percentiles.

Nearest-rank p50 and p95 are retained. Every sample must render and perform its expected action. Missing metrics, missing assets, unknown API fixtures, changed revisions and duplicate/missing samples fail the comparison. For p50 and p95, the temporary internal no-regression budgets allow the larger of relative or absolute tolerance: readiness/FCP/LCP +10% or 50 ms; synthetic action +10% or 16 ms; longest task +15% or 50 ms; transfer +5% or 16 KiB. CLS must be at most the larger of 0.1 or baseline +0.01. These are ceilings, not promised improvements. Tighten them when production requirements justify it; never relax them just to publish a claimed gain.

## First diagnostic: a blocker, not a win

The initial combined client bundle at `501cf282a96028a14d33d3b3739f9e5b4801d3c6` was 4,300,759 raw bytes and 1,265,266 Brotli bytes. In three exploratory mobile CV samples, median interaction readiness was about 800 ms for the original client and 7,245 ms for the native bridge. The common bundle dominates this network profile. The home action in that first diagnostic had an invalid synthetic event target and failed on the legacy client; those failed samples remain in its report and cannot support a comparison. The harness now sends the event from the body, matching the browser's actual target shape, and checks both engines again.

Next browser work must split/lazily load route-specific modules, preserve shared language/auth/consent state, and avoid making static content depend on downloading all administration/game code. Re-measure after implementation. Do not switch production browser loading with this known regression.

The corrected clean-commit diagnostic at `d47c48bc4826f7931cb2b4c38a8733c3fdb8da7d` contains 72 measured runs: all expected actions succeeded, no local assets or fixture endpoints were missing, and code/WASM hashes stayed fixed. It is still exploratory (three repetitions per condition). Mobile cold-context median readiness is 1,475 → 9,531 ms on home, 2,116 → 10,146 ms on map, and 800 → 7,233 ms on CV. The report fails the no-regression gate; `--require-pass` exits 1. Static LCP is recorded separately and must not be confused with interaction readiness.

- [Full browser comparison](evidence/2026-11-20-d47c48b-browser.md), [raw samples](evidence/2026-11-20-d47c48b-browser.json), [gate result](evidence/2026-11-20-d47c48b-browser.gate.json).
- [Code ledger](evidence/2026-11-20-d47c48b-source.md) and [per-file source evidence](evidence/2026-11-20-d47c48b-source.json). Physical-line differences across languages also reflect formatting conventions; they are not a productivity measure.

## Before production

The clean `5d582b70951a0cdc310806a8839a8d54819eeb19` follow-up uses the core profile, browser-specific size optimization and current main `505de19`. All 72 measured interactions passed, with no missing assets, unknown fixture endpoints, dirty files or revision drift. The core download is 681,962 bytes with Brotli quality 4, versus the previous combined bundle's 1,265,266 bytes (46% smaller). This is payload reduction, not a production speedup.

Mobile cold-context readiness medians remain **1,468 → 6,553 ms** on home, **2,088 → 7,181 ms** on map and **784 → 4,291 ms** on CV, comparing the legacy and Rust clients in the same run. Home LCP is 708 ms in both, so an early static paint must not be confused with working controls. Warm readiness and every remaining metric are included in the report. The smaller runtime improves on the earlier diagnostic but still fails the no-regression gate. Three repetitions remain exploratory; increasing sample count cannot excuse the observed regression.

- [Core browser comparison](evidence/2026-11-21-5d582b7-browser.md), [all raw samples](evidence/2026-11-21-5d582b7-browser.json), [gate result](evidence/2026-11-21-5d582b7-browser.gate.json).
- [Updated code ledger](evidence/2026-11-21-5d582b7-source.md) and [per-file additions/deletions](evidence/2026-11-21-5d582b7-source.json): application +48,486/−10, verification/tooling +4,233/−51, generated compatibility +14/−0 relative to aligned main. Old implementations remain available for comparison and rollback; this is not completed replacement percentage.

The measurement tool always returns `productionReady: false`: a browser lab alone cannot approve a migration. Required evidence remains:

1. Full route/redirect and layout parity; actual mobile/desktop navigation, translations, daily gate/DST, consent and failed/slow WASM loading. Forms must not silently lose input before hydration.
2. Signed-in and negative authorization flows; votes/dedupe, invites/claims, uploads/edit/revoke, tracking, scheduled jobs and mixed-runtime storage. Isolated payment/mail/provider fixtures must not produce real side effects.
3. Isolated deployed old/native API p50/p95/p99, error rates and genuinely observed warm/cold invocations, with matched data, cache state, region and bounded request volume. Fixture timings must not be described as Vercel production timings.
4. Complete remaining executable inventory and actual publishing pipeline; real isolated Blob lifecycle and required preview-provider checks.
5. Current main/production reconciliation, full critical-route smoke and public crawl, reversible canary with one webhook/cron writer, and a tested rollback that preserves records and cookies.
6. After an approved canary, collect consent-aware aggregate field performance without adding personal data. Keep before/after windows and error counts. Claim a speedup only for the metrics, pages and conditions that actually improved.

No release can guarantee zero bugs. Record unresolved failures and keep the old implementation available until the relevant gates pass.
