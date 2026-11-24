# Was the Corvus Rust rewrite worth it?

Working evidence pack · 24 Nov 2026, 10:08 Paris time

## Current answer

The migration is in progress. Production has not switched. Functional-check status: passed at 5d582b70951a0cdc310806a8839a8d54819eeb19, while the all-WASM browser remains slower than JavaScript. The separate 23 November light-browser experiment has a measured local gain; it is not a production or native-server result. Cost and ROI are not established. Do not publish an unqualified speedup or completion claim.

## 23 November: ten performance approaches

The combined light browser reaches 0.712 s on mobile (0.708 s–0.717 s), about 52% faster than its paired JavaScript control. This is an English homepage lab result, not a live-site speedup or a Rust-server benchmark.

| Browser candidate | Mobile ready, mean | Desktop ready, mean | Lighthouse mobile | Lighthouse desktop |
|---|---|---|---|---|
| Existing JavaScript | 1.478 s | 0.058 s | 99 | 99–100 |
| Original Rust browser | 6.563 s | 0.106 s | 99 | 97–99 |
| Smaller Rust + delivery changes | 3.090 s | 0.101 s | 90 | 99 |
| Combined light browser | 0.712 s | 0.053 s | 100 | 100 |

Twenty cold-context repetitions per candidate/device; existing controls must work. Lighthouse performance is a separate three-run audit using its own standard simulation; ranges are shown, not an all-category score. Mobile: 390×844, CPU 4×, 150 ms latency and 200 kB/s. Desktop: 1440×1000, unthrottled local network. The daily gate was already entered; analytics were refused. Dynamic collections were empty fixtures with 40 ms API delay. These are not physical-phone, full-production-data or serverless-cold results.

The smaller Rust/WASM browser still misses the target. Cold map takes 0.882 s mobile. Fully translated Dutch/French also remain above 0.8 s, even with earlier selected-language loading. English Lighthouse 100 does not certify every locale or route. A Rust-server/light-browser architecture is a recommendation to evaluate; the migration is not complete.

| Fully translated home | Mobile JS control | Mobile candidate | Desktop candidate | Lighthouse mobile / desktop |
|---|---|---|---|---|
| Dutch | 2.794 s | 1.060 s | 0.072 s | 99–100 / 100 |
| French | 2.845 s | 1.070 s | 0.074 s | 99–100 / 100 |

### Every attempt

Attempts 1–4 compare with the original Rust browser; 5–9 compare with existing JavaScript. These are independent three-run medians. Attempt 10 uses the 20-run confirmation median. Do not add the gains together. Later compile-time splitting and CSS refinements are described in the outcomes and linked report.

| Attempt | Mobile ready | Desktop ready | Lighthouse mobile | Lighthouse desktop | Outcome |
|---|---|---|---|---|---|
| 1. Compile Rust for size | 6.380 s | 0.116 s | 78–99 | 97–98 | Small improvement; insufficient for the mobile target. |
| 2. Precompute stronger compression | 5.815 s | 0.113 s | 80–99 | 99–100 | Useful improvement; keep compression off the request path. |
| 3. Preload WASM | 6.497 s | 0.113 s | 78 | 96–97 | Little readiness gain and worse paint scores; rejected alone. |
| 4. Split the Rust browser | 6.579 s | 0.112 s | 78–99 | 97–99 | Export pruning failed; a later compile-time split helps, but remains too slow. |
| 5. Bundle the existing browser scripts | 1.282 s | 0.093 s | 99–100 | 99–100 | Useful mobile improvement without a new framework. |
| 6. Discover critical modules earlier | 1.304 s | 0.099 s | 99 | 99–100 | Useful mobile improvement. |
| 7. Include the public page catalogue | 1.383 s | 0.086 s | 99 | 99–100 | Modest home gain; the map benefits more. |
| 8. Run independent API reads together | 1.476 s | 0.090 s | 99 | 100 | Map improves; fixes the observed old-document refresh failure. |
| 9. Inline existing CSS | 1.567 s | 0.088 s | 99–100 | 99–100 | Earlier paint, later controls; rejected alone and refined in the combination. |
| 10. Combine the useful changes | 0.712 s | 0.053 s | 100 | 100 | English homepage target passes locally; map and full translations still miss it. |

After 2.5 s of reading, mobile next-page readiness improves from 0.587 s to 0.357 s with bounded prediction. An early click is 0.588 s / 0.590 s without/with prediction. A wrong turn is 0.843 s / 0.842 s. Unused or wrong predictions download 47,097 extra asset bytes, plus predictor overhead. The cold-home win does not depend on warming another page. No real-user hit rate is known.

1,256 timing attempts and 162 Lighthouse audits are retained. 12 early timing failures belong to the rejected incomplete Rust shell. Earlier functional failures remain in the source report; the corrected candidate passed Chromium/WebKit mobile and desktop flows. Final source commit, test outcomes and all failed attempts remain auditable.

The source-code ledger below remains paired with its original measured commit. These new browser experiments do not measure additional billed cost or native-server performance.

[Full experiment report](https://github.com/Corvus-gent/loading-website/blob/01739b7142fdbc2f78836685470d887f57657828/docs/rust-migration/evidence/2026-11-23-ten-experiments.md) · [All samples and settings](https://github.com/Corvus-gent/loading-website/blob/01739b7142fdbc2f78836685470d887f57657828/docs/rust-migration/evidence/2026-11-23-ten-experiments.json)

## The real starting stack

Static HTML, JavaScript application code and Vercel APIs, not an all-Next.js app. Target: native Rust APIs and Rust/WebAssembly browser logic. HTML, CSS, translations, content and media remain assets.

## Measured changes

Aligned main baseline: 505de1997d79db19b7f61f335856b1cb8882d38a. Measured migration: 5d582b70951a0cdc310806a8839a8d54819eeb19. Later upstream changes are outside this comparison.

- Source: +52733/−61 physical lines across 301 counted files; 59 branch-only commits.
- Old app is retained for parity and rollback; additions do not equal replaced lines or percent complete.
- Compressed Rust bundle: 1265266 → 681962 bytes, 46.1% smaller than the earlier Rust bundle. This is not a website speedup.
- 9621 route comparisons; 72/72 measured interactions succeeded.

## Earlier paired mobile readiness (median ms)

| Page | Current JS | Rust |
|---|---:|---:|
| Home | 1468 | 6553 |
| Map | 2088 | 7181 |
| CV | 784 | 4291 |

Three repeats, 390×844, CPU4×,150ms latency,1.6Mbps download, fixed40ms API fixtures. Static paint is separate. No production speed gain has been measured. See raw data for warm cache, desktop, p95, long tasks and all limitations.

## Recorded checkpoints

| Checkpoint | Rust bundle, Brotli bytes | Home JS readiness, ms | Home Rust readiness, ms |
|---|---:|---:|---:|
| 20 Nov 2026 · full · d47c48b | 1,265,266 | 1,475 | 9,531 |
| 21 Nov 2026 · core · 5d582b7 | 681,962 | 1,468 | 6,553 |

These are separate exploratory builds, each with its own JavaScript comparator. The newer Rust build improves on the earlier Rust build but still takes longer than its paired JavaScript baseline. This is not an isolated causal test of bundle size, a production speedup. The separate dated architecture experiment above must not be confused with this earlier code-ledger comparison. The page lets readers select either recorded checkpoint, including its original evidence links.

## Usage and money

Recorded root-chat migration window: 2026-11-20T01:08:28.426Z to 2026-11-21T01:46:29.744Z. 1521 unique response records. Uncached input 4088183; cached input 259673216; output 1394433, including 328372 reasoning tokens (not extra). Cached input is 98.45% of all input. Earlier tasks and this report build are excluded.

Credits charged: unverified. Cash paid: unverified. Included subscription allowance, service-tier rates and other providers are not reconciled. A token-rate scenario is not an invoice. Needed: attributable usage export, credit debits, subscription allocation policy and hosting before/after cost windows.

## Why the experiment may be valuable

Ownership and explicit types can make contracts clearer; native APIs may reduce CPU/memory overhead. Shared Rust models can reduce duplicated application rules. Existing comparisons, failure tests and rollback design are concrete engineering work. JavaScript also manages memory; Rust does not eliminate business bugs, auth mistakes or operational risk. Vercel Rust remains Beta.

## Caching

Browser warm-cache results, AI prompt cache and application/CDN caching are separate. The first two have data here. Redis TTL/key compatibility is being preserved; regional recovery transport, cache hit ratios, invalidation, origin-load and production savings still need evidence.

## Spec sheet and acceptance evidence

| Spec | Status | What we know | Evidence still needed |
|---|---|---|---|
| Browser readiness & paint | Measured locally | The all-WASM browser regresses. The 23 November light-browser candidate improves English home locally; full translations and cold map still miss 0.8 s. | Twenty English-home repetitions now exist for the separate candidate comparison. Current-main, real-data and physical-phone checks, other routes and a controlled rollout remain. |
| API latency: p50 / p95 / p99 | Not measured | The browser lab uses fixed 40 ms API fixtures, not deployed server latency. | Identical requests, payloads, region and load; report sample count, errors and cached versus uncached paths. |
| Function cold starts | Not measured | A fresh browser context is not a cold Vercel function. | Record genuinely observed cold invocations separately from warm ones. |
| CPU, memory & throughput | Not measured | Native Rust may help; this project has no comparative measurements yet. | Same workload and resource allocation; CPU time, peak memory, successful requests/second and errors. |
| Cache effectiveness | Not measured | Browser asset reuse is measured; CDN/application hit rates and savings are not. | Hits, misses, TTLs, invalidation, origin requests and stale/error recovery for matching traffic windows. |
| Release reliability | Incomplete | Functional CI is scoped to the recorded commit; performance and migration completion gates remain open. | Complete route/flow checks, isolated integrations, canary monitoring and a timed rollback rehearsal. |
| Credits, cash & operating cost | Unverified | Local token records are usage evidence, not attributable credit debits or invoices. | Reconcile actual debits and hosting windows; state subscription allocation separately. |

## Proposed story structure

1. One builder wants a stricter foundation.
2. Inventory the actual stack and preserve the working site.
3. Show source changes and the honest usage/cost ledger.
4. Show the mobile regression before the optimisation.
5. Explain the smaller runtime and what still loses against JavaScript.
6. Publish deployed latency/cache/cost and rollback results when they exist.
7. Decide whether the engineering benefit repaid the effort.

## Claims we can make now

- Rust core download is 46.1% smaller than our first Rust bundle.
- The measured user actions and functional CI passed at the recorded commit.
- We kept failed performance checks visible instead of promoting a slower browser runtime.

## Claims we cannot make yet

- The full site is migrated or faster in production.
- Rust improved cache hit rates or hosting cost.
- The rewrite cost exactly N credits or dollars, or has positive ROI.
- Zero bugs, or “godspeed.”

## Missing evidence

- Mobile interaction readiness must match or beat the existing app.
- Complete remaining runtime modules, publishing, hydration and failure behavior.
- Verify real isolated uploads, provider access and regional recovery.
- Measure deployed API p50/p95/p99, cold starts, CPU, memory, cache hit rates and cost.
- Reconcile production, crawl every route, test protected flows and rehearse rollback.

## Sources

- [Rust ownership and compile-time memory checks](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)
- [Vercel Rust runtime (Beta)](https://vercel.com/docs/functions/runtimes/rust)
- [Vercel Runtime Cache: regional cache, TTLs and tags](https://vercel.com/docs/runtime-cache)
- [OpenAI usage and credit pricing](https://learn.chatgpt.com/docs/pricing)
- [Raw benchmark](https://github.com/Corvus-gent/loading-website/blob/01739b7142fdbc2f78836685470d887f57657828/docs/rust-migration/evidence/2026-11-21-5d582b7-browser.json)
- [Per-file source ledger](https://github.com/Corvus-gent/loading-website/blob/01739b7142fdbc2f78836685470d887f57657828/docs/rust-migration/evidence/2026-11-21-5d582b7-source.json)
