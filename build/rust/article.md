# Was the Corvus Rust rewrite worth it?

Working evidence pack · 21 Nov 2026, 09:13 Paris time

## Current answer

The migration is in progress. Production has not switched. Functional-check status: passed at 5d582b70951a0cdc310806a8839a8d54819eeb19, but mobile interaction readiness is worse than the existing JavaScript client. Cost and ROI are not established. Do not publish an unqualified speedup or completion claim.

## The real starting stack

Static HTML, JavaScript application code and Vercel APIs, not an all-Next.js app. Target: native Rust APIs and Rust/WebAssembly browser logic. HTML, CSS, translations, content and media remain assets.

## Measured changes

Aligned main baseline: 505de1997d79db19b7f61f335856b1cb8882d38a. Measured migration: 5d582b70951a0cdc310806a8839a8d54819eeb19. Later upstream changes are outside this comparison.

- Source: +52733/−61 physical lines across 301 counted files; 59 branch-only commits.
- Old app is retained for parity and rollback; additions do not equal replaced lines or percent complete.
- Compressed Rust bundle: 1265266 → 681962 bytes, 46.1% smaller than the earlier Rust bundle. This is not a website speedup.
- 9621 route comparisons; 72/72 measured interactions succeeded.

## Mobile first-visit readiness (median ms)

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

These are separate exploratory builds, each with its own JavaScript comparator. The newer Rust build improves on the earlier Rust build but still takes longer than its paired JavaScript baseline. This is not an isolated causal test of bundle size, a production speedup or a new measurement today. The page lets readers select either recorded checkpoint, including its original evidence links.

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
| Browser readiness & paint | Measured locally | Paired JS/Rust samples, same pages and fixtures; the current mobile readiness result is a regression. | At least 20 paired runs per condition for a release comparison; field data after a controlled rollout. |
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
- [Raw benchmark](https://github.com/Corvus-gent/loading-website/blob/eb87ca9f1cba9b177f9a42cc168691a5d0ec5ef0/docs/rust-migration/evidence/2026-11-21-5d582b7-browser.json)
- [Per-file source ledger](https://github.com/Corvus-gent/loading-website/blob/eb87ca9f1cba9b177f9a42cc168691a5d0ec5ef0/docs/rust-migration/evidence/2026-11-21-5d582b7-source.json)
