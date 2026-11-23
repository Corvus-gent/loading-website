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

01:30 UTC: inspected clean migration checkout and existing harness. Main starting cost is a ~682 kB compressed core plus module/data request waterfalls. Existing JS is already much lighter but also has a multi-module startup chain. No production changes. Preparing isolated treatments and a common sequential runner.
