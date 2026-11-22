# Progressive delivery experiment

User request, 22 November 2026: make the home page immediately useful, then predict likely next pages from visible links, hover, keyboard focus and touch. Test whether this helps mobile navigation rather than merely making a warm benchmark look good.

## Boundary

This is an opt-in local experiment on `codex/rust-migration`. Production, its assets, Vercel routing, server-side gates and the all-Rust performance gate are unchanged. `progressiveHtml` is never imported by the production build. Current main has additional changes; these fixtures compare treatments on the same migration revision, not against today's production deployment.

The home page is already built to HTML on the server/build machine. Putting the WASM file on another server cannot remove its transfer and initialization on a visitor's phone. A CDN can shorten delivery; rendering useful HTML before delivering optional browser code changes the critical path.

The experimental lightweight home deliberately retains the existing JavaScript for search, translations, privacy, the daily ritual and newsletter. It does not initialize WASM. Subsequent pages retain the Rust/WASM bridges, with a single shared instance per document. This is a **hybrid browser architecture candidate**, not proof that an all-Rust browser migration is finished. The server can remain Rust independently of this decision; server performance is not measured here.

## Bounded prediction

- Start only after page load and the directory is ready, then wait 800 ms.
- A public link must remain at least 65% visible for 1 second, be hovered for 180 ms, receive keyboard focus, or be touched.
- Only a fixed list of public, query-free, same-origin core pages is eligible. Never APIs, tracked redirects, login, invite/edit links, downloads or external pages.
- At most two HTML document hints and one shared core asset group per home visit. Asset Content-Length budget: 800,000 compressed bytes. HTML hints are at most two documents, separately counted by the benchmark.
- Fetch core JS/WASM with low priority into the HTTP cache, **without executing either**. No speculative votes, signup submissions, analytics events, timers or third-party embeds.
- Use document prefetch (not prerender) when supported; retain normal navigation when it is not. WebAssembly asset prefetch is independent of Speculation Rules support.
- Skip Save-Data, 2G/slow-2G, offline and hidden documents. Abort unfinished asset fetches on page exit or backgrounding. An early click always navigates immediately; it never waits for prefetch.
- Signals and diagnostic counters exist only in the current page's memory. No behavioural profile, ID, persisted scroll history or telemetry is added.

No “spiderweb” crawls recursively through pages. Only the links actually present on the current home page are considered. Deep links remain directly accessible; prefetch cannot improve a first visit that bypasses home.

## Verification

```
node tests/rust/progressive-delivery.mjs
PREDICTIVE_BROWSER=webkit node tests/rust/progressive-delivery.mjs
node tests/rust/performance-evidence.mjs
node tools/rust/progressive-benchmark.mjs --repeats=3 --profiles=mobile,desktop
```

Three treatments: Rust everywhere; lightweight JS home with Rust next page; the same lightweight home plus bounded prediction. This separates the effect of avoiding homepage WASM from the effect of prefetch.

Every journey starts with a fresh browser cache. Early click has no additional dwell after the normal readiness check; read-then-click and wrong-prediction have a fixed 5-second dwell, independent of whether prefetch succeeds. The existing readiness helper itself includes an 800 ms observation window. Actual time before clicking is recorded. Wrong prediction here goes to another core page, so shared WASM can still be useful; this must not be described as proof that unrelated feature-page speculation is free. Raw bytes before clicking and for the whole journey are retained, including speculative downloads. CDP received chunks are retained for aborted transfers; their response headers may still be undercounted. This limitation is recorded rather than treating aborted downloads as zero waste.

The existing direct-entry mobile regression and original no-regression thresholds remain visible. These experimental results cannot authorize production migration. Remaining gates include actual iOS/Android field testing, deployed caching/security-header behaviour, server API parity, rollout/rollback and full route coverage.

## Primary references

- [MDN Speculation Rules](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API): optional browser support; prefetch does not execute destination JavaScript; avoid state-changing routes and stale personalized pages.
- [Chrome prerender documentation](https://developer.chrome.com/docs/web-platform/prerender-pages): intent/viewport hints, browser resource limits and progressive enhancement. We intentionally use prefetch, not full prerender.
- [Loading WASM efficiently](https://web.dev/articles/loading-wasm): asynchronous streaming. Already enabled in the core treatment; not counted as a new improvement here.

The fixture now offers gzip when Brotli is not advertised. WebKit over local HTTP previously received the 2.1 MB uncompressed module, correctly rejected by the prediction budget. With gzip (~758 kB WASM plus bindings), the same policy fits the budget. Chromium keeps the identical Brotli payload. This fixture correction is not evidence of a production Safari problem.

## Recorded result

[22 November exploratory results](evidence/2026-11-22-aa608eb-progressive.md) retain all 54 successful journeys and raw byte accounting. Lightweight home: ~1.4–1.5 s versus Rust ~6.58 s mobile readiness. After five additional seconds of dwell (about nine seconds total on home), the next page is ~0.62 s with prediction versus ~4.45 s without. Early-click next-page latency remains ~4.31 s. Unused prediction can spend ~705 kB extra. These results support a bounded hybrid experiment, not a full migration or universal speedup.
