# Lightweight home and predictive navigation: exploratory results

Measured revision `aa608ebd817050e3de35c18e8227ceb43f4c0042`. 2026-11-22T14:00:13.654Z.

54/54 measured journeys passed, three repetitions per condition, plus unrecorded warmups. Fixed code/WASM hashes, clean tree, no missing assets or unknown API fixtures. **Production unchanged; not a release approval or a completed all-Rust browser migration.**

The home page in the two light treatments retains existing JavaScript. Next pages use Rust/WASM. This isolates the startup architecture from speculative loading. Every journey begins with a fresh cache. Mobile is Chromium at 390×844, 4× CPU throttle, 150 ms latency and 1.6 Mbit/s download; desktop is unthrottled.

| Device / scenario | Treatment | Home ready, median ms | Next page ready, median ms | Bytes before click | Whole journey bytes |
|---|---|---:|---:|---:|---:|
| mobile / early-click | Rust/WASM everywhere | 6582 | 645 | 1,162,144 | 1,195,545 |
| mobile / early-click | Light JS home → Rust | 1484 | 4459 | 509,481 | 1,241,153 |
| mobile / early-click | Light JS home + prediction → Rust | 1410 | 4310 | 512,066 | 1,246,899 |
| mobile / read-then-click | Rust/WASM everywhere | 6578 | 637 | 1,162,833 | 1,195,795 |
| mobile / read-then-click | Light JS home → Rust | 1493 | 4455 | 509,924 | 1,241,403 |
| mobile / read-then-click | Light JS home + prediction → Rust | 1402 | 619 | 1,214,744 | 1,249,934 |
| mobile / wrong-prediction | Rust/WASM everywhere | 6563 | 1358 | 1,162,833 | 1,201,635 |
| mobile / wrong-prediction | Light JS home → Rust | 1493 | 5084 | 509,924 | 1,247,243 |
| mobile / wrong-prediction | Light JS home + prediction → Rust | 1410 | 1394 | 1,214,744 | 1,255,774 |
| desktop / early-click | Rust/WASM everywhere | 107 | 46 | 1,187,708 | 1,195,545 |
| desktop / early-click | Light JS home → Rust | 65 | 74 | 534,799 | 1,241,153 |
| desktop / early-click | Light JS home + prediction → Rust | 62 | 74 | 537,630 | 1,233,081 |
| desktop / read-then-click | Rust/WASM everywhere | 114 | 62 | 1,188,151 | 1,195,795 |
| desktop / read-then-click | Light JS home → Rust | 62 | 89 | 535,242 | 1,241,403 |
| desktop / read-then-click | Light JS home + prediction → Rust | 72 | 84 | 1,240,062 | 1,249,934 |
| desktop / wrong-prediction | Rust/WASM everywhere | 121 | 260 | 1,188,151 | 1,208,110 |
| desktop / wrong-prediction | Light JS home → Rust | 67 | 278 | 535,242 | 1,253,718 |
| desktop / wrong-prediction | Light JS home + prediction → Rust | 63 | 286 | 1,240,062 | 1,262,249 |

## Interpretation

- The lighter homepage moves mobile functional readiness from about 6.58 seconds to about 1.4–1.5 seconds. This benefit is primarily from retaining a lightweight initial UI, not from making Rust execute faster.
- With a fixed **five additional seconds of dwell after the readiness helper**, predictive loading reduces the next Gabe page from 4.455 seconds to 0.619 seconds. The helper also waits for load/fonts and an 800 ms observation window. Actual total time on home before this click is about 9.0 seconds without prediction and 9.25 seconds with it; the 5 seconds are not total time since navigation.
- With no additional dwell, next-page readiness is still 4.31 seconds with prediction versus 4.46 seconds without. Early navigation is never delayed to finish a prefetch. This does not solve every first-click latency.
- The already-loaded Rust control reaches the next page in ~0.64 seconds, but only after paying its slower homepage startup. Keep both parts of the journey visible.
- Reading without clicking costs **704,820 additional bytes** with prediction compared with the lightweight no-prediction home. After completing the same journey, the incremental prediction overhead is **8,531 bytes**, because the core bundle was needed at the destination anyway. It is not free when the visitor leaves.
- The wrong-prediction route is `/map/`, which shares the same core module. It benefits from those cached bytes even when its HTML was not the selected destination. This is not proof that arbitrary wrong predictions or feature pages are free.
- Desktop next-page medians are not consistently improved: ~89 → 84 ms for read-then-click, ~279 → 286 ms for the map detour. These tiny samples do not establish a universal desktop gain.
- All direct-entry subpages still need their own cold-load optimization. Existing all-Rust direct-load regressions and release thresholds are unchanged.

## Checks

- Chromium and WebKit: 390px and 1440px, normal search/navigation, EN/NL language switching, no horizontal overflow and newsletter input retained.
- Chromium cache evidence: destination WASM transferred 0 new bytes after completed prefetch. WebKit functional fallback verified; not a physical iPhone test.
- Save-Data, 2G, offline and unsupported Speculation Rules fallbacks pass. Only allowlisted public pages/core assets are warmed; private routes, tracking links and external URLs are excluded.
- Existing performance-evidence and browser-profile assertions pass. Lint: 764 JavaScript modules and locale contracts passed.
- Fixture gzip fallback fixed WebKit-over-HTTP receiving raw WASM; Chromium retains the same Brotli payload. This was a local fixture limitation, not a diagnosed production Safari failure.

[All raw samples](2026-11-22-aa608eb-progressive.json) · [Architecture, limits and reproduction](../progressive-delivery.md)
