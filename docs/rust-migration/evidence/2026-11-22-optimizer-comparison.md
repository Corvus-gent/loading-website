# Smaller raw WASM did not mean a faster mobile page

Exploratory local homepage comparison, 22 November 2026. **No production change or release pass.** The user's priorities are actual speed and Lighthouse performance, with the investigation retained for the migration blog.

## Result

All numbers below are medians of three measurements per treatment/device. Readiness means the existing search/directory interaction actually works. The readiness lab and Lighthouse have separate conditions; their milliseconds must not be interchanged.

| Browser implementation | Mobile controls ready | Desktop controls ready | Mobile Lighthouse | Desktop Lighthouse |
|---|---:|---:|---:|---:|
| Existing lightweight JavaScript | 1.483 s | 0.071 s | 99 | 100 |
| Current Rust core | 6.597 s | 0.120 s | 99 | 97 |
| Same Rust core + Binaryen `-Oz` | 6.686 s | 0.123 s | 99 | 98 |

Retain the variation, not just these medians: mobile Lighthouse ranges were JS **99-100**, Rust **78-99**, optimized **99-99**; desktop **99-100**, **97-99**, **98-98** respectively. The Rust mobile outlier is not discarded or attributed to a cause without further evidence. Three measurements cannot establish stable field performance. Arithmetic mean cold-entry readiness was mobile JS 1.486 s / Rust 6.604 s / optimized 6.690 s; desktop 0.072 / 0.120 / 0.124 s. These are sample means, not a traffic-weighted site average.

The optimized Rust download grew from **681,962 to 697,638 Brotli bytes** (+2.3%), even though the raw WASM shrank from 2,108,863 to 1,927,865 bytes (-8.6%). Public imports and exports remained identical. The optimizer was Binaryen version 133, official arm64 macOS archive, verified SHA-256 `ad66da82ac13f163e424b1643f16c6dfcccc98b5966296b43e52d3cab04f84a8`.

**Decision:** do not adopt this additional compiler pass. Preserve the original Rust artifact. The existing light browser interface wins this homepage comparison, including Lighthouse, so a Rust-server/light-browser architecture is the preferred candidate for further evaluation. This does not require installing Svelte or Astro to reproduce someone else's score. Further Rust client splitting can still be tested against the same lightweight comparator. This result cannot select an architecture for every route or prove native-server speed.

The striking result for the blog is that **all three mobile treatments scored 99**, while mobile controls in the two Rust treatments remained about 4.5 times slower to become usable. An early painted page and a high aggregate score do not prove usable application controls. The user's <=800 ms average next-navigation target is still unproven; these measurements concern first entry, not a weighted real-user navigation average.

## Evidence and provenance

- [Readiness and first complete Lighthouse pass, 7b8fab3](2026-11-22-7b8fab3-optimizer-timing.json): 36/36 cold/warm timing samples succeeded. Four optimized-runtime functional scenarios passed: Chromium/WebKit, mobile/desktop; home/map/CV actions, language switching and input preservation. Lighthouse audits completed, but the harness also recorded a setup-only `/favicon.ico` 404 on all treatments. That diagnostic remains visible and is not a clean overall pass.
- [Corrected Lighthouse setup, f7010bc](2026-11-22-f7010bc-optimizer-lighthouse.json): 18/18 audits completed, no missing assets, no unknown API fixtures. Repeated only the audit suite after replacing the text bootstrap with a minimal HTML bootstrap declaring a data favicon. No application code changed. The same baseline and optimized WASM hashes were verified across both reports. Readiness is deliberately null in this audit-only run; the table above uses the earlier separate readiness measurements.
- [Earlier failed audit setup, 9db7281](2026-11-22-9db7281-optimizer-failed.json): Chrome treated the text bootstrap as a download because the local fixture lacked a text MIME type. All audit failures are retained. Its timing samples are not substituted for the comparison above. Interrupted development runs produced no completed measurement set and are not presented as evidence.

Full per-audit Lighthouse JSON/screenshots remain in the ignored local `test-results/rust/measurements/optimizer-2026-11-22T17-15-10-953Z/` directory; the committed report retains all scores, metrics, versions, settings, warnings and failures. The experiment command in `performance.md` reproduces the raw artifacts. The mobile homepage screenshot was inspected: the real five-door homepage renders, with the daily gate correctly skipped for the seeded returning visitor.

## Conditions and remaining failure

Readiness: actual built HTML/assets; 390x844 mobile, 4x CPU slowdown, 150 ms latency, 1.6 Mbps download; desktop 1440x1000 unthrottled. Same local 40 ms API fixtures, refused analytics and returning-visitor gate cookie; fresh contexts and separately recorded warm reloads. Paired alternating treatment order and one unrecorded warmup. No predictive download. Lighthouse: its installed standard mobile/desktop simulation profiles, fresh Chrome profile for every audit, all settings retained. Third parties and production provider APIs were excluded in both protocols. This is a browser comparison, not a benchmark of the native Rust server.

The audit-only rerun reproduced an intermittent **WebKit desktop navigation/fetch error** for `/api/army?view=legion` in the optimized functional check. The preceding full run passed that scenario. It is **not resolved**: waiting for fixture network idle did not eliminate it, and it has not yet been attributed to the optimizer, original Rust runtime or test/browser lifecycle. Do not claim a clean all-browser pass or suppress the error to improve the report. The runner correctly exits nonzero. Diagnose with old/optimized controls and request/navigation traces before considering that runtime for release.

No real iPhone/Android, production CDN, field INP, full-site route or backend latency claim follows from this test. Three repetitions and localhost scores are exploratory. Source optimization/compression was inspired by [Switch2's report](https://tech.switch2.co.uk/blog/rust-on-the-frontend-at-switch2); the light-browser alternative resembles the architectural separation in [Lance's Rust/Svelte site](https://lance.hk/p/how-i-built-this-blog/). These external results are not substituted for the Corvus measurements.
