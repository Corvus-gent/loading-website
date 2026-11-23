# Five-hour performance investigation · 23 November 2026

User requested ten real attempts and a success/failure report while away. Start 01:18 UTC / 02:18 Europe/Paris; report target by 06:18 UTC / 07:18 Paris. Base `f5fa1ae9`, branch `codex/rust-migration`. Production remains unchanged. Do not count a plan, an external case-study score or a broken harness as a successful experiment.

## Planned experiments

Controls: existing browser JS and existing core Rust/WASM, identical built page, privacy refusal and fixture data.

1. **Rust size-oriented compilation:** compare `opt-level=z` with the current `s`, preserving original artifacts.
2. **Offline Brotli compression:** quality 11 instead of quality 4, precomputed before measurement, no claimed runtime/server gain.
3. **Early Rust preload:** remove the module/binary discovery waterfall without changing code or warming a visitor's cache first.
4. **Page-scoped Rust module:** keep the entry page's actual bindings and runtime support, eliminate unrelated exports, retain other-page fallback.
5. **Bundle the light interface:** same existing behavior, bundled/minified modules with no framework runtime added.
6. **Preload critical JS modules:** compare early parallel discovery without changing the module implementation.
7. **Inline the public route catalogue:** build-published public data delivered with HTML, same privacy filtering and dynamic refresh.
8. **Parallel independent directory enrichment:** preserve ordering/results/failures while avoiding serial API waits.
9. **Inline existing blocking CSS:** identical rules and layout, measure first-entry benefit against repeated-document bytes/cache tradeoffs.
10. **Combine successful changes plus bounded prediction:** use only improvements justified by 1-9, count speculative bytes, test early navigation and wrong predictions.

The first nine are independent treatments, not a cumulative ladder. Candidate 10 is explicitly a combination, compared with its components and both original controls. Framework names are inspiration, not what is being benchmarked: a full Astro/Leptos/Svelte rewrite is not necessary to test these delivery techniques.

## Measurement and acceptance

- Mobile and desktop side by side: actual controls-ready time, cold/warm state, Lighthouse score with ranges, LCP/TBT/CLS, bytes and errors. Do not replace controls-ready time with paint time.
- Same Chromium version, identical HTML/content/styles/data and explicit device/network settings; sequential timing jobs to avoid competing CPU load.
- First screen: three repetitions per condition, all samples retained. Winners get a larger follow-up, direct-entry and next-page flows, plus Chromium/WebKit functional/error tests. No deployment claim from three local runs.
- Search, language change/persistence, gate, consent and form input must remain usable. Do not hide content, skip required code or manipulate benchmark observers to improve a score.
- Preserve failed tests and hypotheses. Diagnose the intermittent WebKit `/api/army` navigation error with controls rather than suppressing it.
- The <=800 ms target is evaluated as a stated sample mean for a stated navigation scenario. No traffic-weighted site average or guaranteed worst case without that data.
- Report each approach as faster/slower/neutral/failed, its remaining limitations and a specific next variant for Gabriel to improve.

## Sources and inspiration

- Switch2's Rust/Leptos report: https://tech.switch2.co.uk/blog/rust-on-the-frontend-at-switch2
- Rust server with light Svelte browser: https://lance.hk/p/how-i-built-this-blog/
- Leptos size and lazy-route guidance: https://book.leptos.dev/deployment/binary_size.html
- Leptos selective interactive islands: https://book.leptos.dev/islands.html
- WebAssembly streaming/loading: https://web.dev/articles/loading-wasm
- Rakuten's resource splitting/loading case: https://web.dev/case-studies/rakuten
- Evil Martians/Astro case (preserve UI, reduce initial code): https://astro.build/case-studies/evil-martians/
- Astro islands architecture: https://docs.astro.build/en/concepts/islands/
- esbuild bundling API: https://esbuild.github.io/api/

These published results have different applications and test protocols; they are not Corvus measurements. The final investigation report will link the exact local evidence and commits. Keep this work as material for the requested migration blog.

## Checkpoint

01:50 UTC: first nine independent candidates plus the two controls have completed 264 cold/warm readiness samples on home and map (3 repeats, mobile/desktop). Lighthouse sequence still running, 42/66 audits so far. Evidence: `test-results/rust/measurements/ten-independent/report.json`; executable source commit `1f307ea6`. Do not mutate the ignored compiled baseline artifacts while this sequence runs. It is executing from a disposable built fixture; later uncommitted harness refinements do not affect it.

Initial home/mobile medians: JS 1,484 ms; Rust 6,571; z 6,380; Brotli 11 5,815; WASM preload 6,497; export-pruned page WASM 6,579; JS bundle 1,282; static modulepreload 1,304; inline catalogue 1,383; parallel API 1,476; inline CSS 1,567. These are exploratory local measurements, not deployment results.

44 functional runs: 26 passed, 18 recorded a WebKit navigation error. The trace points to the *previous home's* serial background refresh starting `/api/army` after its `/api/compound-v2` was cancelled during navigation. Both unchanged JS and Rust reproduce it; the parallel variant passes all four browser/device combinations. Keep the failure traces; do not suppress the errors or blame CORS without evidence. Related lifecycle reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event .

Additional finding: original `/logo.png` is 416,194 bytes, 556×553, loaded for a 28×28 footer mark. It dominates the non-WASM transfer (~509 kB total vs ~39 kB JS). A generated delivery derivative for that specific footer size is being tested without altering the original artwork or other logo uses.

Next: prepare a genuine compile-time homepage/map Rust profile using `prepare-shell.mjs` (temporary source copy, unrelated modules disabled before compilation; other routes fall back to core). Then validate and measure experiment 10 with the independently useful techniques, bundled required English locale, a footer delivery derivative, and bounded intent prefetch. `predict.mjs` downloads only fixed public JS assets, no HTML/API/redirect/private paths, max two destinations and 120 kB. Compare predictive and non-predictive versions, immediate/read-then-click/wrong/unused navigation, and Save-Data/offline behavior. None of these follow-up candidates has a performance result yet.

Baseline binary remains SHA-256 `3268504938d7b31a94992861518d4d4f15309ba12858c921429255e5fd677873`. z is `d14e6637d488e5b11d43aa557df574e61c19281d51e29709ceebb0abb027ba64`. Export-pruned profile is `3dc53e879f82a7b62ae480dddba23fb9f52e219e5721b17412117ea42753faeb`. Q4/Q11: baseline 681,962/537,163 bytes; z 638,153/504,767; export-pruned 681,533/536,067. All variants use the same immutable source and bindings unless their own intervention says otherwise.
