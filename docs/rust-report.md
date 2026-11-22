# Rust migration report: working instructions

The user wants a careful, evidence-based report page and an article foundation by **Wednesday 25 November 2026**, with a daily update at 09:00 Europe/Paris through that date. This is the reporting deadline, not an automatic postponement or authorization of the separate Rust cutover. The daily Codex heartbeat is `dagelijks-rust-rapport-en-artikelbasis`.

Page: `/build/rust/`. Branch: `codex/rust-migration-ledger`, based on main. Do not deploy the unfinished Rust runtime just to publish this page. Never push main. Keep the existing site style, public discovery and quiet homepage.

## Evidence update

Run from this checkout after a **committed, verified** migration checkpoint:

```sh
node tools/migration-report/collect.mjs --repo=/path/to/migration-checkout --ref=codex/rust-migration
node tools/migration-report/build.mjs
```

The collector keeps all committed browser checkpoints, uses the source ledger paired with the latest benchmark head, and does not invent a performance pass. It preserves the existing sanitized usage aggregate unless `--usage=/path/to/aggregate.json` is supplied. It never reads account credentials or calls production. The full build renders the page from committed data and makes it discoverable. A published snapshot is dated; do not label it a live billing counter.

The optional local-only usage extractor is:

```sh
python3 tools/migration-report/usage.py /path/to/local-session.jsonl --out /tmp/migration-usage.json
```

It starts at the explicit Rust request and closes at the first report request. It selects actual per-response usage records, deduplicates response IDs, and rejects inconsistent counters. It excludes raw prompts, identities, absolute source paths and account-wide balance data from output. Earlier unrelated tasks, this report build and child/provider usage are not silently billed to the migration. For later work, select a reviewed explicit migration window; do not widen the window over unrelated work. Costs of preparing the article should be kept separately.

The extractor now requires the closing marker: an unfinished attribution window must fail rather than absorbing unrelated later work. The collector and publishing build validate nested token fields, safe integer totals, timestamp order, reviewed model metadata and null billing fields. Public methodology/limitations come from source-controlled copy, never free-form local telemetry. Review newly observed models before extending the allowlist. Report facts, extraction boundaries and generated-page freshness run in the existing Feature CI workflow.

**Credits and cash remain null.** Included subscription usage, purchased-credit debits and hosting charges are different quantities. No service-tier or invoice data is present in the local telemetry. Do not multiply current API/credit prices by tokens and call that actual spend. A scenario, if requested, must show dated rates and assumptions separately. A future billing import needs attributable evidence and public-safe totals, never an invoice containing private account data.

## Daily editorial work

1. Note what changed since the last snapshot and inspect migration CI; never report an old green run as validation of a new runtime.
2. Retain bad measurements, provenance, environment, cold/warm distinctions and insufficient sample counts. Run new heavy benchmarks only for a meaningful runtime change, not for a daily status update.
3. Track code volume separately from completion: the old implementation is intentionally retained, and language formatting changes physical line counts.
4. Keep website/CDN cache, Redis/regional cache and AI prompt cache distinct.
5. Record server latency p50/p95/p99, genuinely observed cold starts, CPU, memory, throughput, cache-hit ratios, origin work and operating costs when controlled evidence exists. Until then: unmeasured.
6. Test accessibility, keyboard controls, 390px/1440px layout, no-JS/error fallback, download validity and production/preview links.
7. Update `build/rust/article.md` via its generator; clearly separate facts, potential benefits, tradeoffs and claims we cannot make.

Current result: the Rust bundle is smaller than its earlier Rust version, but first-visit mobile readiness is worse than JavaScript. Rust ownership/type contracts and the compatibility suite are reasons for the experiment. They are not proof of positive ROI or a completed migration. Vercel's Rust runtime is still Beta as of the cited documentation check.

## Confirmed blog brief · 22 November 2026

Gabriel explicitly wants the mobile-startup investigation written up as a blog at migration time. Keep collecting the actual problem, elapsed iteration history, failed measurements, source/tool commits and architectural decisions now; publish the conclusion only after the selected approach passes the migration gates. Do not describe a lengthy conversation as measured engineering hours or invent a cost allocation.

His decision preference is to try the Switch2-style Rust/WASM size/compression approach first, compare a lighter browser interface if it is faster, and prioritize both actual speed and Lighthouse performance. No framework is preselected by someone else's 98/100 or 100/100 score. See `docs/rust-migration/performance.md` on `codex/rust-migration` for the controlled optimizer experiment and original source links. That branch's existing progressive-loading evidence is at `4dc8354`; it has not yet been folded into this report's historical comparison schema. Do not overwrite the existing source-paired data or silently equate the two experiments.

Required blog chapter: why a fast native server and early HTML paint did not make mobile controls ready; the cost of downloading/starting browser WASM; what compiler optimization, route splitting and predictive loading each changed; all-Rust versus Rust-server/light-browser tradeoffs; the selected solution and deployed checks. Show mobile and desktop side by side. Label direct entry, early click, read-then-click and warm reload separately. Retain the failed mobile baseline. Lighthouse is a weighted lab score, not proof that the search/form works, and cannot replace functional readiness or eventual real-device data. The user's <=800 ms average next-page target is not the same as the median of three selected runs.

Source leads checked by the migration work: Switch2's first-party Leptos account reports 100/100 but no separate mobile protocol; Lance's Rust/Svelte blog publishes mobile 98 with 1.9 s LCP and desktop 100 with 0.5 s LCP; Leptos documents interactive-island payload reduction. Attribute their results to them and avoid presenting them as Corvus results. Runtime/production remain unchanged until separately verified.

## Daily review · 21 November 2026

- First scheduled review, not a new benchmark day. Migration source remains `eb87ca9`; measured runtime remains `5d582b7`. No duplicate benchmarks or raw-session rereads were needed.
- Report PR #101's original commit `b2d307e` passed Feature CI (run `44884606725`). This validates the report branch, not a new Rust implementation or release.
- Main advanced to `b521b2b`; the recorded comparison remains explicitly aligned to `505de19`. Later upstream features must be reconciled by the migration before a final release claim. This report does not deploy or overwrite them.
- Added the same seven-row spec sheet to the page and downloadable article: browser performance, API percentiles, real cold starts, CPU/memory/throughput, caches, reliability and cost. Missing evidence has named acceptance criteria, not invented numbers.
- Regression reproduced and fixed: without an end marker, usage extraction could include subsequent unrelated work. Added nested aggregate validation and CI coverage. The existing published counts already had a valid closed window and remain unchanged.
- Actual debits and cash costs remain unverified. Wednesday 25 November is still the reporting deadline; production/cutover gates are separate.

## Daily review · 22 November 2026

- Yesterday's complete Feature workflow passed at `f776dae` (run `44887877952`), including the new report attribution/freshness checks. This is report validation, not a new migration release result.
- Local and remote migration evidence are unchanged at `eb87ca9`, with measured runtime `5d582b7`. No new migration code, benchmark samples or billable-cost evidence appeared. No heavy benchmark or raw-session reread was run.
- The page now selects either recorded benchmark with its matching device/cache comparison, dated label and immutable source links. A shared URL retains that selection. Headline totals still describe the newest recorded measurement. The downloadable article includes both original home comparisons and explains why separate builds are not a causal test of payload size.
- Keep fallback controls disabled when JavaScript or the data request is unavailable; the static verified table and downloads still work. Tests cover historical selection, reload, invalid parameters, preserved unrelated URL state/hash, keyboard order and both screen sizes. The site's existing arrival cleanup still removes tracking parameters; chart changes use the current URL rather than resurrecting old attribution.
- Merged main `a1dc27c` into the report branch, retaining its new CVs, science archive, supported-company page and Hackers Bay work. The build-file conflict was resolved by keeping both sets of build helpers. Installed the updated lockfile locally after removing only this worktree's shared node_modules symlink; the migration checkout was not modified.
- The measurement baseline remains `505de19`; later production features are not included in those performance figures. Credits/cash remain unverified, and the mobile Rust readiness regression is unresolved. Report target remains Wednesday 25 November; production remains unchanged by this task.
