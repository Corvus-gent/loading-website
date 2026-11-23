# Ten performance experiments · Corvus · 23 November 2026

Investigation requested while Gabriel sleeps, with a five-hour budget starting at 01:18 UTC. This report compares concrete delivery changes, including failed attempts. Production has not been changed. Existing application HTML, styling and behavior are retained; experimental overlays only run in disposable local builds.

**Completed within the five-hour budget:** ten approaches, 20-repeat English homepage confirmation, fresh-browser confirmation, 160 navigation journeys, Dutch/French follow-ups and their browser/Lighthouse checks. There are **1,256 timing attempts and 162 valid Lighthouse audits**, with every repetition retained. Twelve early timing failures came from the rejected incomplete Rust shell; later corrected candidates and all confirmation/journey/locale timings pass. Production remains unchanged.

[Compact numerical evidence, all repetitions, hashes and settings](2026-11-23-ten-experiments.json). Full local traces, Lighthouse JSON and screenshots remain under `test-results/rust/measurements/ten-*`; scripts reproduce them.

## What was actually measured

The repository is static HTML/vanilla JavaScript with Vercel APIs and an in-progress Rust migration, not a Next.js application. There are two controls: its existing browser JavaScript and the migrated Rust/WASM public runtime. A light browser candidate keeps existing behavior in small JavaScript bundles. This can be paired with a Rust server, but **these browser measurements use a local Node fixture and do not benchmark the Rust server**.

The comparison is pinned to this migration branch, not a fresh measurement of current production. A read-only fetch during the investigation found newer main at `22ee879b` (daily realm entrances); the branch's last integrated main is `505de19`. No merge or production-application change was made during timings. Reconcile and repeat the relevant tests before publishing this candidate on the current site.

- Same content, styles, public fixture data and 40 ms API delay. Dynamic videos/members are empty fixture collections; the static built route catalogue remains. This is not a production-sized live leaderboard/map dataset. No production requests, real submissions, external analytics or provider embeds.
- Entered daily ritual, analytics refusal. First-visit ritual is separately functionally tested over real local HTTPS.
- Mobile: 390×844, CPU 4×, 150 ms latency, 200,000 bytes/s download and 93,750 bytes/s upload. Desktop: 1440×1000, unthrottled CPU and local network.
- Apple M1 Pro; Node 20.19.1 runs x86_64, Chromium 156.0.8078.4 is a native arm64 binary. These are simulated mobile conditions, not a physical iPhone/Android result.
- **Ready** means the unchanged application directory-ready event has fired and search is usable; map also receives its public enrichment. Every timing sample then performs a real expected UI action. It is not merely first paint.
- Fresh HTTP/storage contexts for cold samples; same-context reload for warm samples. Server compression is precomputed before timings. A separate confirmation starts a fresh Chromium process for each cold/warm pair.
- Lighthouse uses its standard mobile/desktop simulation, recorded separately. Its score does not establish that search/forms are ready. Do not compare its LCP directly with readiness from a different network simulation.
- Run revisions and dirty flags are retained, including documentation/helper edits outside the already built measurement fixture. Candidate bundle/WASM hashes and flags identify the loaded artifacts; a clean current-main reproduction remains a release gate.
- All repetitions, failures, ranges and revisions are retained. Min/max are observed sample bounds, not guaranteed worst/best cases. No measured traffic mix or real-user prefetch hit rate is available.

## Ten independent approaches and their follow-ups

The first four use **Rust control = 6.571 s mobile / 0.111 s desktop**. Approaches 5–9 use **existing JS control = 1.484 s / 0.071 s**. These are independent three-repeat experiments, not a cumulative sequence. Times are homepage cold-context medians; Lighthouse columns show median and full observed range.

| # | Attempt | Mobile ready | Desktop ready | Lighthouse mobile | Lighthouse desktop | Result |
| --- | --- | ---: | ---: | --- | --- | --- |
| 1 | Rust `opt-level=z` instead of `s` | 6.380 s | 0.116 s | 99 (78–99) | 98 (97–98) | Small win, about 3% mobile; nowhere near 0.8 s. |
| 2 | Precomputed Brotli 11 instead of 4 | 5.815 s | 0.113 s | 99 (80–99) | 99 (99–100) | Useful 12% mobile improvement. More compression alone is insufficient. |
| 3 | Preload Rust bindings and WASM | 6.497 s | 0.113 s | 78 (78–78) | 97 (96–97) | Reject alone: marginal readiness gain, worse paint score. Earlier heavy downloads can compete with visible content. |
| 4 | Remove unrelated WASM exports after linking | 6.579 s | 0.112 s | 99 (78–99) | 98 (97–99) | No gain. Too much reachable code remains. See the real compile-time split below. |
| 5 | Bundle/minify the existing light interface | 1.282 s | 0.093 s | 99 (99–100) | 100 (99–100) | Useful 14% mobile improvement; desktop did not improve in this small run. |
| 6 | Preload critical JavaScript modules | 1.304 s | 0.099 s | 99 (99–99) | 99 (99–100) | Useful 12% mobile improvement, with extra preload management. |
| 7 | Include the existing public route catalogue in HTML | 1.383 s | 0.086 s | 99 (99–99) | 100 (99–100) | Modest home gain; map improves from 2.123 to 1.771 s. Dynamic refresh and private-route filtering remain. |
| 8 | Start independent directory API reads concurrently | 1.476 s | 0.090 s | 99 (99–99) | 100 (100–100) | Neutral for home; map improves to 1.792 s. Also prevents the observed old-document WebKit fetch failure. |
| 9 | Inline the original blocking stylesheets | 1.567 s | 0.088 s | 99 (99–100) | 99 (99–100) | Mixed: earlier paint (512 vs 724 ms), slower controls. Reject as a standalone fix. |
| 10 | Combine useful delivery changes, then separately test bounded prediction | See confirmation below | See below | 100 (100–100), final three runs | 100 (100–100), final three runs | English target passes in this lab; non-English still misses. Prediction helps only the reading-then-click mobile case. |

The controls themselves reproduce a navigation failure in WebKit: a serial background refresh starts its next request after the old document is being discarded. The first matrix recorded 18 functional failures out of 44 browser/device/treatment cases. All 22 Chromium cases passed; the concurrent-request treatment passed all four Chromium/WebKit sizes. This is retained evidence, not a suppressed console warning or a claim that the server has a CORS configuration fault.

**Follow-up to #4:** export pruning was replaced with an actual temporary compile-time home/map profile. The first build mistakenly removed the live banner needed on `/map`, failed there, and was rejected. The corrected profile retains that module, removes only unrelated modules, keeps all Unicode matching semantics while disabling optional regex accelerators, and performs the independent public reads concurrently. Other routes fall back to the original core runtime.

The final smaller Rust profile is 419,049 bytes at Brotli 11 versus the original core's 681,962 bytes at Brotli 4. The original core at Brotli 11 is 537,163 bytes. These are three different comparisons: do not credit all of the reduction to splitting. Smaller Rust plus preloading, compression and the footer derivative reaches about **3.089 s** mobile home and **3.418 s** map in the final three-repeat run; all four functional browser/device cases pass. Its mobile Lighthouse score is 90, so it still misses both the 0.8 s target and the light candidate's paint result. Even 419 kB alone requires about 2.1 seconds to transfer at this test's 200 kB/s before considering other requests.

**Follow-up to #9 and combination #10:** inline CSS alone was not the answer. The final combination flattens nested CSS imports and the dynamically discovered inspiration stylesheet, keeping the same rules. It reserves the language bar's existing 36 px footprint before the unchanged renderer fills it, eliminating the measured layout shift. Bundling preserves lazy non-English locale URLs and includes the already-required English locale. A cancelled privacy locale load falls back to existing English text and recovers on a subsequent successful Dutch load.

The original logo is 416,194 bytes, rendered at 28×28 in the footer. The experiment generates an 84×84 delivery derivative for that footer mark and favicon, retaining the original file and all other uses. The final three-repeat mobile page transfer is **71,560 bytes instead of 508,985** (about 86% less); desktop is 96,914 instead of 534,339. This is total transfer in this fixture, not a statement that all the saving came from JavaScript or Rust.

## Confirmation

<!-- confirmation -->
All **320 timings** in the 20-repeat confirmation and **80** in the fresh-browser confirmation completed their expected interactions, with no timing failures, missing assets or unknown fixture endpoints. Mean time, followed by full observed min–max, is shown below. Lighthouse is the separate final three-repeat run, not twenty Lighthouse repetitions.

| Candidate | Mobile ready: mean (range) | Desktop ready: mean (range) | Lighthouse mobile | Lighthouse desktop |
| --- | ---: | ---: | ---: | ---: |
| Existing JS control | 1.478 s (1.467–1.489) | 0.058 s (0.057–0.063) | 99 (99–99) | 99 (99–100) |
| Original Rust browser | 6.563 s (6.553–6.586) | 0.106 s (0.103–0.108) | 99 (99–99) | 98 (97–99) |
| Smaller Rust + delivery changes | 3.090 s (3.081–3.106) | 0.101 s (0.096–0.105) | 90 (90–90) | 99 (99–99) |
| Combined light browser | 0.712 s (0.708–0.717) | 0.053 s (0.052–0.057) | 100 (100–100) | 100 (100–100) |

The combination is about **52% faster than the JS control** and **89% faster than the original Rust browser** for mobile homepage readiness in this lab. The smaller Rust treatment improves its control by about 53%, but still fails the 0.8 s cold-home target. The combined homepage passes the stated sample-mean target; this is not a traffic-weighted site average or a bound on future runs.

A fresh Chromium process per pair gives the light candidate **0.713 s (0.707–0.725) mobile**, **0.054 s (0.053–0.055) desktop** across five repetitions. The gain therefore persists when the browser process is restarted. This is still a warmed local server with static representations prepared in advance, not a serverless cold invocation.

Warm reloads (20 repeats; same browser HTTP cache and storage):

| Candidate | Mobile mean (range) | Desktop mean (range) |
| --- | ---: | ---: |
| Existing JS control | 0.376 s (0.365–0.384) | 0.016 s (0.015–0.017) |
| Original Rust browser | 0.447 s (0.440–0.454) | 0.037 s (0.036–0.039) |
| Smaller Rust + delivery changes | 0.438 s (0.420–0.455) | 0.033 s (0.030–0.035) |
| Combined light browser | 0.337 s (0.330–0.344) | 0.018 s (0.016–0.020) |

Map has three-repeat cold means of **0.882 s mobile / 0.096 s desktop** for the combination versus **2.107 s / 0.223 s** for JS and **7.208 s / 0.294 s** for original Rust. Its mobile result remains above 0.8 s; the homepage result must not be generalized to every route.
<!-- /confirmation -->

## Prediction and wrong turns

Only fixed, content-hashed JavaScript assets for four allowlisted public destinations may be predicted. No document execution, HTML/API requests, redirects, auth/invite/edit paths or persisted behavior profiles. Start after load, real readiness and settling, then require sustained visibility or hover/focus/touch. Maximum two destinations and 120,000 compressed bytes; reserve the larger Brotli/gzip size. Skip Save-Data, slow 2G, offline and hidden documents. Abort unfinished work on page exit. Browsers without the relevant optional network/priority signals retain ordinary navigation and the hard budget.

The older 22 November prototype warmed a much larger Rust asset group and could waste about 705 kB. That is historical evidence, not the design or budget tested here. This follow-up independently compares no prediction with bounded prediction on the *same* combined candidate, plus both original controls.

<!-- journeys -->
All **160 journeys** passed (four candidates × two profiles × four scenarios × five repetitions). Below are mean next-page readiness timings, measured from navigation start. Home must first become ready, then the script waits 150 ms for the early scenario or 2.5 s for the others. This is not predictive loading before a visitor's first homepage load.

| Journey | Mobile, no prediction | Mobile, bounded prediction | Desktop, no prediction | Desktop, bounded prediction |
| --- | ---: | ---: | ---: | ---: |
| Immediate click to Gabe | 0.588 s | 0.590 s | 0.032 s | 0.034 s |
| Read, then click predicted Gabe | 0.587 s | 0.357 s | 0.034 s | 0.036 s |
| Read, then choose unpredicted map | 0.843 s | 0.842 s | 0.122 s | 0.116 s |

The useful mobile case saves **230 ms, about 39%**, after reading. Prediction does not improve the immediate click and has no meaningful desktop benefit in this small local sample. The map still needs its dynamic enrichment.

The reading, wrong-turn and unused cases each prefetch **47,097 response bytes**. Total measured bytes for a correct mobile journey rise from **150,373 to 176,209**; the asset used by Gabe is reused from cache, while the other predicted destination remains extra work. A wrong turn rises from **154,557 to 203,919**; leaving without another navigation rises from **69,171 to 118,533**. The latter differences also include the 2,265-byte predictor, not just its asset payload. Aborted responses can omit headers from CDP accounting.

The harness also retains `clickToReady`: an automation-clock measure including locator/action polling and navigation initiation. For the mobile reading case it is **0.915 s without / 0.684 s with prediction**. It is not real-user INP, and must not be substituted for the navigation-start timings above. The early JS-control click is especially affected by a still-downloading large logo and the automation wait; it is retained rather than cherry-picked away.

**Decision:** the fast base works without prediction. Keep prediction optional and bounded; do not ship aggressive preloading or describe a cache hit as the cold homepage result. Real-user click probabilities and actual mobile network costs still need measurement.
<!-- /journeys -->

## Translation follow-up: the English win is not universal

The original ten-candidate matrix uses English. That is insufficient for Corvus, so an additional 48 cold/warm measurements checked Dutch and French. `allReady` is the later of usable controls and the existing page-copy-ready event, with the translated heading and selected language asserted. No new or earlier ready marker was added.

The base combination still discovers the selected UI locale and full public text catalogue late. An optional follow-up reuses the **original** query/cookie/browser/route language-selection code to issue early hints for that selected locale only. English makes no extra request; no other languages or private data are downloaded. All ten selection/expiry/unsafe-input unit cases pass. The actual application translation logic, dictionaries and fallback remain unchanged.

Each row below uses three cold repetitions per profile, with full samples retained in `ten-languages` and `ten-language-hints`. These are not the 20-repeat English confirmation.

| Fully translated homepage | Mobile control | Mobile combined base | Mobile + selected-language hint | Desktop control | Desktop + hint |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dutch | 2.794 s | 1.528 s | 1.060 s | 0.075 s | 0.072 s |
| French | 2.845 s | 1.541 s | 1.070 s | 0.075 s | 0.074 s |

Control values are from the paired hint run; base-combination values are from the preceding same-protocol run. The two controls remain close (Dutch 2.782 / 2.794 s; French 2.845 / 2.845 s).

The hint saves about **31% against the combined base** and **62% against the paired JS control**, but **does not reach 0.8 s**. Controls alone become ready around 0.830 s Dutch / 0.824 s French; reporting only those numbers would hide unfinished translation. Translation still changes text geometry after paint, especially French. The English Lighthouse 100 result does not certify other locales.

Next candidate: generate/cache translated page HTML and an accurately scoped page dictionary, with language-cookie/query precedence, cache separation, dynamic text, fallback and no private-data leakage tested. Merely dropping untranslated keys or delaying necessary translations would be a false win; no such shortcut was used here.

<!-- localized-audits -->
The hint candidate passes all four Chromium/WebKit device cases and all eight broader flow/fallback checks. No missing local assets, unknown API fixtures or timing failures. The original JS control still reproduces the documented WebKit background-refresh failure in one case.

| Hint candidate: Lighthouse performance | Mobile, median (range) | Desktop, median (range) |
| --- | ---: | ---: |
| English | 100 (100–100) | 100 (100–100) |
| Dutch | 99 (99–100) | 100 (100–100) |
| French | 99 (99–100) | 100 (100–100) |

Three audits per locale/profile. Dutch paired JS control: mobile 98 (94–98), desktop 98 (98–99). No paired French Lighthouse control was run; its measured hint scores are reported without inventing a before/after gain. These are **performance-category** scores, not an assertion of 100 in all Lighthouse categories.
<!-- /localized-audits -->

## Functional verification and mistakes retained

- Across the five general functional matrices, 65 of 100 cases passed and 35 earlier/control failures are retained. These are repeated cases across successive candidates, not 35 unresolved failures in the chosen candidate.
- Final combination and corrected smaller Rust: Chromium/WebKit, 390 px/1440 px, home/map/CV interactions, language switch/reload, retained newsletter input and no horizontal overflow pass.
- Broader light-candidate flows: email/consent validation, failed submission with retained input, successful retry, language persistence on home/Gabe/Daily/privacy, search/private-path exclusion, privacy refusal, interrupted translation fallback and later recovery pass. All submissions are local fixtures.
- English final geometry: 28 checks (seven pages × two browsers × two widths). Compared visible primary headings, cards, controls, language bar and footer styles/boxes/text match; maximum measured box difference is 0 px. Screenshots reviewed. The smaller logo encoding is intentionally different; this is not a claim of identical image bytes.
- Ritual: four real local HTTPS checks, correct Secure/SameSite/Path cookie, next local 04:02 expiry, refresh, returning HTML with no gate, and gate returning after actual browser expiry. Separate unit coverage includes DST/year boundaries. An initial virtual HTTPS routing fixture did not reliably carry WebKit cookies; its failure was kept, then the test moved to real HTTPS. WebKit's cookie-inspection API was also unsuitable for detecting expiry, so the test verifies the real HTTP response after browser-set expiry instead.
- Final lint: 780 JavaScript modules and locale contracts pass. Overlay tests preserve API ordering/failure semantics, conditional request counts, private-route exclusions and network fallback. Small-profile core tests retain Unicode and pass all five existing core unit tests.
- Predictor checks pass in Chromium/WebKit, including real HTTP-cache reuse in Chromium, gzip/Brotli accounting, no private speculation, Save-Data/slow-network/offline skip and input/navigation/language behavior.
- Initial compile-time profile failed map because it omitted the required live banner. Initial predictive gzip accounting failed WebKit. Fast navigation uncovered a real uncaught privacy-locale import cancellation. All are recorded and corrected in the experimental candidate; none was dismissed to obtain a nicer score.
- Additional cancelled-request logs caused by navigating away remain in raw output. They are distinguished from application exceptions. The original controls still have the recorded background-refresh issue; production source was not silently rewritten as part of a benchmark.

## Sources that informed the attempts

[Switch2's Rust/Leptos production account](https://tech.switch2.co.uk/blog/rust-on-the-frontend-at-switch2) identifies WASM download size and optimization/compression as practical issues and reports Lighthouse 100. It does not provide an equivalent Corvus mobile controls-ready protocol. It motivated attempts 1–4; this investigation does not install Leptos or claim their score as ours.

[Astro's Evil Martians case study](https://astro.build/case-studies/evil-martians/) describes keeping existing UI components while reducing initial code and overly aggressive prefetch. It informed attempts 5 and 10. Corvus's existing small JavaScript is reused here; this is not an Astro migration or a deferred-search trick that makes the controls-readiness test easier.

[Terra's prefetch study](https://web.dev/case-studies/terra-prefetching-case-study) motivates visibility/intent, idle delivery and network-aware bounds rather than downloading everything. Our stricter no-HTML/no-API policy and byte accounting are specific to Corvus. Their business/field results are not claimed for this lab.

Additional implementation references: [WASM streaming](https://web.dev/articles/loading-wasm), [Leptos binary-size guidance](https://book.leptos.dev/deployment/binary_size.html), [regex feature trade-offs](https://docs.rs/regex/latest/regex/#crate-features), [LCP phases and lab/field interpretation](https://web.dev/articles/optimize-lcp). Existing streaming compilation was already enabled, so it is not counted as a new win.

## Next variant for each attempt

| Attempt | Sensible next variant |
| --- | --- |
| 1 | Keep only if size/parse measurements justify it on actual phones; compiler flags cannot remove required payload. |
| 2 | Publish precompressed immutable assets and verify actual CDN Content-Encoding/cache behavior; never compress Q11 on a visitor's request path. |
| 3 | Test lower-priority or post-paint WASM discovery; do not let a large preload delay visible CSS/content. |
| 4 | True route-specific dependency boundaries, potentially browser-native URL primitives with full policy parity; retain shared consent/language state and fallback routes. |
| 5 | Production build integration with explicit script-order and lazy-language contracts, then cache-sharing between routes. |
| 6 | Prefer build-generated hints for required modules; compare against the simpler bundle rather than adding both blindly. |
| 7 | Version the public catalogue and define freshness at build/deploy; dynamic members/videos still refresh with original privacy filters. |
| 8 | Add cancellation and stale-response tests on real deployed endpoints; preserve ordered merge and failure retention. |
| 9 | Keep only measured critical CSS, test repeated-navigation bytes and real mobile wrapping; ensure no visual rules disappear. |
| 10 | Start with the fast non-predictive base; enable prediction only where measured click latency is worth its extra bytes. Validate with real phones and a reversible preview/canary. |

## Reproduction and release boundary

Source starts at `f5fa1ae9`; independent experiments at `1f307ea6`; final measured combination at `8566aad6`; confirmation harness at `5e3393e9`; language baseline at `d5f7e55c`, early hints at `e784eed0`, and hint audits at `ac8e6530`. Compiled artifact hashes and exact flags are retained in the machine-readable evidence. Experimental code is under `tools/rust/ten-experiments/`; it is not imported by the publishing pipeline. Baseline compiled artifacts remain unchanged.

```sh
# Separate pinned build-only tool, no application dependency:
npm install --prefix /tmp/corvus-perf-tools esbuild@0.28.2
# Prepare the independent variants with verified Binaryen 133; retain the manifest:
node tools/rust/ten-experiments/prepare-wasm.mjs --metadce=/absolute/path/to/binaryen-version_133/bin/wasm-metadce
node tools/rust/ten-experiments/prepare-shell.mjs --profile=shell-parallel --test-core=1
node tools/rust/ten-experiments/run.mjs --suite=all --repeats=3 --modes=js-control,rust-control,04-page-wasm,10-combined --page-wasm=shell-parallel --rust-best=1 --combined=bundle,parallel,directory,brotli,locale,predict,footer-logo,css-flat,stable-language
node tools/rust/ten-experiments/run.mjs --suite=timing --repeats=20 --routes=/ --modes=js-control,rust-control,04-page-wasm,10-combined --page-wasm=shell-parallel --rust-best=1 --combined=bundle,parallel,directory,brotli,locale,predict,footer-logo,css-flat,stable-language
node tools/rust/ten-experiments/run.mjs --suite=timing --repeats=5 --routes=/ --fresh-process=1 --modes=js-control,rust-control,04-page-wasm,10-combined --page-wasm=shell-parallel --rust-best=1 --combined=bundle,parallel,directory,brotli,locale,predict,footer-logo,css-flat,stable-language
node tools/rust/ten-experiments/journeys.mjs --repeats=5 --combined=bundle,parallel,directory,brotli,locale,predict,footer-logo,css-flat,stable-language
node tools/rust/ten-experiments/languages.mjs --out=test-results/rust/measurements/ten-languages
node tools/rust/ten-experiments/languages.mjs --combined=bundle,parallel,directory,brotli,locale,predict,footer-logo,css-flat,stable-language,locale-hints --out=test-results/rust/measurements/ten-language-hints
node tools/rust/ten-experiments/run.mjs --suite=lighthouse --modes=10-combined --repeats=3 '--audit-route=/?lang=fr' --combined=bundle,parallel,directory,brotli,locale,predict,footer-logo,css-flat,stable-language,locale-hints
# Default requires all named evidence runs; --runs= can select completed runs.
node tools/rust/ten-experiments/summarize.mjs
```

**Decision from these ten trials:** prioritize a Rust server with a small browser interface, based on the measured light-client result. This is an architecture recommendation, not a measured Rust-server gain or a completed switch. A strict all-Rust/WASM browser is still a mobile release blocker in this branch, even after a successful payload reduction. Keep the fast base independent of prediction; retain the language hint as a separate measured improvement with its own remaining limits.

The 0.8 s sample-mean goal is achieved for the entered English homepage and for a normal next-page Gabe navigation; it is **not achieved for cold map or a completely translated Dutch/French homepage**. No traffic-weighted average has been established. A 100 Lighthouse performance score is not proof that every feature, locale or first visit is ready in 0.8 s.

Browser lab success does not complete native API parity, current-main reconciliation, provider/Blob checks, field iOS/Android behavior, CDN/edge headers, server cold starts or reversible canary/rollback. Existing no-regression gates remain unchanged. No promise of zero bugs, no production speedup or credit-cost claim from these experiments.
