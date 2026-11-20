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

The runner rebuilds WASM with the pinned lockfile, builds a disposable copy of the actual HTML/assets and compares the original browser scripts with their current native bridges. It never changes the working site's build output or calls live providers. It records code/build hashes, browser version, machine, all timing samples, asset sizes, fixture errors and conditions. The current common WASM test bundle is not the final publishing architecture.

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

## Before production

The measurement tool always returns `productionReady: false`: a browser lab alone cannot approve a migration. Required evidence remains:

1. Full route/redirect and layout parity; actual mobile/desktop navigation, translations, daily gate/DST, consent and failed/slow WASM loading. Forms must not silently lose input before hydration.
2. Signed-in and negative authorization flows; votes/dedupe, invites/claims, uploads/edit/revoke, tracking, scheduled jobs and mixed-runtime storage. Isolated payment/mail/provider fixtures must not produce real side effects.
3. Isolated deployed old/native API p50/p95/p99, error rates and genuinely observed warm/cold invocations, with matched data, cache state, region and bounded request volume. Fixture timings must not be described as Vercel production timings.
4. Complete remaining executable inventory and actual publishing pipeline; real isolated Blob lifecycle and required preview-provider checks.
5. Current main/production reconciliation, full critical-route smoke and public crawl, reversible canary with one webhook/cron writer, and a tested rollback that preserves records and cookies.
6. After an approved canary, collect consent-aware aggregate field performance without adding personal data. Keep before/after windows and error counts. Claim a speedup only for the metrics, pages and conditions that actually improved.

No release can guarantee zero bugs. Record unresolved failures and keep the old implementation available until the relevant gates pass.
