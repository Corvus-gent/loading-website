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

### 02:20 UTC follow-up checkpoint

The independent matrix is complete (264 timing samples, 66 Lighthouse audits); the first combination is complete (96 samples, 24 audits) at `test-results/rust/measurements/ten-combined`. The combination passed the original Chromium/WebKit checks but a broader fast-navigation flow found an uncaught cancelled `/js/privacy-locales/nl.js` import. The experimental combination now retains the English privacy content when that chunk is unavailable. The original source remains unchanged. A first fallback assertion was incorrect because the separate page-copy dictionary still translated the English fallback into Dutch; the revised fixture deliberately blocks both Dutch translation transports to verify the fallback and subsequent recovery.

`ten-refined` measured a smaller Rust homepage/map profile, original controls and a combination with inline CSS plus reserved language-bar space. Cold mobile homepage medians: JS 1,475 ms; Rust 6,562 ms; smaller Rust with Q11/preload/footer derivative 3,103 ms; combination 702 ms. Map: 2,119 / 7,213 / 3,737 / 935 ms. Still only 3 repeats, not the final confirmation. Lighthouse is variable despite good medians; preserve its full ranges. Late-discovered language/art styles are being flattened in the next combined candidate, retaining the exact rules.

The first compile-time shell omitted the live banner required on `/map`; its failed result is preserved. Corrected profiles are `shell-fixed` (br4 635,201 B), `shell-small` (525,666 B; all Unicode semantics retained, only optional regex matching accelerators removed), and `shell-parallel` (527,028 B; same ordered directory merge, independent requests start together to avoid the observed WebKit old-document fetch). All are temporary source-copy builds, not production changes. `shell-parallel` SHA-256 `2a69e8214bf551af138ee06fe7839f34ec185baa873af79c20b1f51b5e114102`; five core unit tests passed with this dependency configuration.

Next: finish `tests/rust/ten-flows.mjs` (log `/tmp/corvus-ten-flows-flat-v2.log`), then final functional/timing/Lighthouse matrix using `--page-wasm=shell-parallel --rust-best=1 --combined=bundle,parallel,directory,brotli,locale,predict,footer-logo,css-flat,stable-language`. Follow with 20 timing repetitions, an additional fresh-browser-process check, and early/reading/wrong/unused journeys. Do not run CPU-heavy work alongside timing. All artifacts and failures remain local; production still unchanged.

Additional primary references used: [regex feature trade-offs](https://docs.rs/regex/latest/regex/#crate-features), [Terra's bounded prefetch approach](https://web.dev/case-studies/terra-prefetching-case-study), [LCP lab/field distinction](https://web.dev/articles/optimize-lcp). These motivate experiments; their gains are not claimed for Corvus.

### 02:50 UTC confirmation checkpoint

`ten-final` is complete at source `8566aad6`: 96 readiness samples and 24 Lighthouse audits, no missing assets or unknown API fixtures. Final combination mobile/home median 715.6 ms (mean 712.8); desktop 53.5 ms; map 881.9 / 96.1 ms. Lighthouse performance 100 in all three mobile and all three desktop audits. Smaller Rust shell-parallel + Q11/preload/footer derivative is 3,089.6 ms mobile/home and 3,417.7 ms map, Lighthouse 90 mobile / 99 desktop. Both candidates pass all four functional browser/device cases; unchanged controls retain known WebKit navigation failures.

`ten-flows-flat-final` passed all broader Chromium/WebKit mobile/desktop checks, including newsletter error/retry, locale fallback/recovery and privacy refusal. `ten-layout` passed 28 checks (seven routes, two browsers, two widths) with zero measured primary-box geometry difference from JS control. `ten-gate` passed all four real local HTTPS cookie flows, including actual HTTP returning/expired responses. Earlier virtual-routing cookie and WebKit cookie-inspection test failures are preserved in `/tmp/corvus-ten-gate*.log`; they were fixed by testing actual local HTTPS and browser-set expiry. No application source change for these fixture corrections. `npm run lint` passed 777 modules and locale contracts; overlay unit tests passed.

Sequential ongoing command started at `5e3393e9`: first 20-repeat homepage timing matrix (`ten-confirmation`), then 5 repeats with `--fresh-process=1` (`ten-fresh`), then 5 repeats of four navigation scenarios (`ten-journeys`). All use the final css-flat/stable-language combination. Do not start another browser/CPU-heavy job until this sequence ends. The 20 mobile cold-context means are already complete: JS 1,478.305 ms; original Rust 6,563.445; corrected smaller Rust 3,090.425; light combination 712.375 (range 707.8–717.3). Desktop confirmation is still running.

Uncommitted report draft: `docs/rust-migration/evidence/2026-11-23-ten-experiments.md`. Fill the confirmation/journey blocks from finished reports, then run `tools/rust/ten-experiments/summarize.mjs` to produce compact numerical evidence with all samples, hashes, audit settings and failure counts. Report helper currently has uncommitted completeness/size improvements, but the executable measurement/variant source and built fixtures are unchanged. No push yet; remote draft PR87 remains `f5fa1ae9`.

A read-only fetch found newer main `22ee879b` (daily realm entrances). Last integrated main in this migration branch is `505de19`; do not call these tests current-production measurements. Current-main reconciliation and migration release gates remain separate. No production writes or runtime cutover.

### 03:21 UTC completed measurements

All ten experiments and follow-ups are complete: 1,256 timing attempts (12 failures in the rejected first compile-time shell retained) and 162 Lighthouse audits. The final 20-repeat English home means are JS 1.478 s / 0.058 s, Rust 6.563 / 0.106, smaller Rust 3.090 / 0.101, light combination 0.712 / 0.053 (mobile / desktop). The English combination's performance score is 100 in all three audits per device; five fresh-process repeats confirm ~0.713 s mobile. All 160 early/reading/wrong/unused journeys pass. Bounded prediction saves ~230 ms on the reading-then-Gabe mobile scenario but costs 47,097 prefetched bytes when unused or wrong; ordinary immediate navigation works without it.

Important additional finding: fully translated Dutch/French remain slower than English. Base combination 1.528/1.541 s mobile. Optional early selected-language hints reuse the actual preference policy and reduce those to 1.060/1.070 s. Chromium/WebKit broad flows pass; Lighthouse is 99–100 mobile, 100 desktop for NL/FR (three per locale/device), while English remains 100. This does not meet the 0.8 s translated-page target. Cold map also remains ~0.882 s. Do not generalize the English win.

Final report and all-sample compact evidence: `docs/rust-migration/evidence/2026-11-23-ten-experiments.md` and `.json`. Recommendation: pursue a Rust server with a lightweight browser, with prediction optional; do not claim a measured native-server improvement or completed cutover. Current-main reconciliation, real data/phone/CDN checks and original release gates remain. Production unchanged. Next: final syntax/diff checks, commit/push only this feature branch, update draft PR87 and inspect CI.
