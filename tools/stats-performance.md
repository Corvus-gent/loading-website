# Stats performance · 5 November 2026

Measurements taken on 5 November, with dates in Europe/Brussels. Production was sampled before changing the implementation. A second comparison served the previous daily-branch revision (`71739c1`) and this revision with the same counts, catalog and synthetic dashboard user. The new endpoint read from a dedicated local Redis server. External services and the private login were fixtures in the comparison.

### What delayed the numbers

On production, fetching the Brussels overview for 2, 3 and 4 November returned HTTP 500 with `{"error":"stats error"}`. Chromium received the page HTML but the overview never displayed its visitor count. The production API gives no provider timings on failure. Its Redis region, upstream latency and serverless cold-start breakdown require production access. The private production page was tested as a signed-out visitor.

The previous overview had nine sequential HogQL queries on a cache miss, alongside separate browser requests for outbound clicks and coffee. Music fetched the complete catalog to render ten rows. The old map fetched daily stats, cities and tile configuration. The updated pages read one prepared JSON document. Map assets load at the viewport, and private detail requests start only when their corresponding section is visible.

### Results with populated snapshots

On 6× CPU and Slow 4G, warm public figures appeared in **191–299 ms**. The authenticated dashboard took **375 ms**. First visits with empty browser caches displayed data in **785–1045 ms**. Music improved from 913 ms to 191 ms on a warm visit.

Across 120 warmed localhost HTTP snapshot requests, median time to response headers was **1.36 ms**, p95 **4.48 ms**, maximum **70.6 ms**. The corresponding Redis reads had p50 **0.3 ms** and p95 **0.6 ms**. Production API TTFB and Vercel cold starts still require measurement after release.

| Page | Mobile Lighthouse before → after | New CLS | Fresh Node process → JSON (ms) | First Redis-backed handler call (ms) |
|---|---:|---:|---:|---:|
| `/` | 100 → 100 | 0.000 | 477 | 42.6 |
| `/pidgy` | 100 → 100 | 0.000 | 506 | 44.6 |
| `/games` | 100 → 100 | 0.000 | 497 | 44.4 |
| `/map` | 100 → 100 | 0.005 | 578 | 46.7 |
| `/music` | 100 → 100 | 0.000 | 504 | 46.6 |
| `/hunt` | 100 → 100 | 0.000 | 481 | 42.2 |
| `/x` | 100 → 100 | 0.000 | 475 | 55.4 |
| `/coffee` | 99 → 99 | 0.074 | 477 | 41.6 |
| `/private` | 78 → 90 | 0.000 | 439 | 39.8 |
| `/status` | — → 100 | 0.000 | 585 | 78 |

The process test starts a separate Node process per page, imports the snapshot handler and opens its first Redis connection to existing data. The outer time includes process startup. The inner time measures the handler. Both use loopback. A completely empty database needs one successful background collection before it can serve recorded numbers.

### Before → after, all pages

Each row is one Chromium navigation at 390 × 844. Cold opens a fresh browser context. Warm reloads that tab with HTTP and tab storage intact. Slow 4G uses a 150 ms network delay, 1.6 Mbps down, 0.75 Mbps up and 6× CPU throttling. The baseline status route returned 404. A dash means there was no measurement. A zero request count means the tab served the snapshot locally.

TTFB measures requestStart → responseStart. API TTFB is the slowest measured same-origin data response on that navigation. FCP and first rendered numeric metric are elapsed from navigation start and include the emulated network delay. Counts exclude map tile images and include first-load data requests. JS and CSS are total encoded resource body sizes in KiB, including cached assets when Resource Timing reports them. The new metric was inside the initial viewport on all 40 runs. The previous layout placed the overview, map and X comparison metrics below the fold. The old figures measure readiness there. Chromium applies the emulated delay to resource delivery, so local request-to-response-start values exclude some of the cost visible in FCP and displayed numbers. These are single runs. Compare the size and direction of differences, particularly on faster normal-profile visits.

<details><summary>normal · cold browser cache</summary>


| Page | HTML TTFB ms | FCP ms | Numbers ms | API requests | API TTFB ms | JS KiB | CSS KiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 12 → 8 | 60 → 128 | 84 → 147 | 3 → 1 | 2 → 7 | 29 → 30 | 9 → 9 |
| `/pidgy` | 2 → 2 | 24 → 24 | 52 → 57 | 1 → 1 | 2 → 3 | 25 → 27 | 9 → 9 |
| `/games` | 2 → 1 | 24 → 24 | 49 → 42 | 1 → 1 | 1 → 3 | 25 → 26 | 9 → 9 |
| `/map` | 4 → 1 | 32 → 48 | 61 → 57 | 3 → 1 | 1 → 5 | 70 → 71 | 13 → 13 |
| `/music` | 2 → 2 | 28 → 24 | 58 → 61 | 2 → 1 | 2 → 8 | 25 → 26 | 9 → 9 |
| `/hunt` | 15 → 1 | 36 → 20 | 62 → 40 | 1 → 1 | 1 → 2 | 25 → 26 | 9 → 9 |
| `/x` | 3 → 1 | 24 → 60 | 74 → 74 | 1 → 1 | 1 → 2 | 28 → 31 | 10 → 11 |
| `/coffee` | 2 → 2 | 36 → 48 | 64 → 66 | 1 → 1 | 1 → 3 | 26 → 26 | 9 → 9 |
| `/private` | 2 → 2 | 32 → 28 | 59 → 57 | 3 → 1 | 2 → 3 | 12 → 8 | 10 → 12 |
| `/status` | — → 1 | — → 24 | — → 40 | — → 1 | — → 3 | — → 27 | — → 9 |


</details>

<details><summary>normal · warm browser cache</summary>


| Page | HTML TTFB ms | FCP ms | Numbers ms | API requests | API TTFB ms | JS KiB | CSS KiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 3 → 3 | 16 → 20 | 26 → 16 | 3 → 0 | 2 → — | 29 → 30 | 9 → 9 |
| `/pidgy` | 2 → 3 | 12 → 16 | 29 → 27 | 1 → 0 | 1 → — | 25 → 27 | 9 → 9 |
| `/games` | 2 → 3 | 12 → 20 | 25 → 29 | 1 → 0 | 1 → — | 25 → 26 | 9 → 9 |
| `/map` | 1 → 1 | 12 → 12 | 23 → 24 | 3 → 0 | 2 → — | 70 → 71 | 13 → 13 |
| `/music` | 2 → 2 | 16 → 20 | 31 → 28 | 2 → 0 | 2 → — | 25 → 26 | 9 → 9 |
| `/hunt` | 2 → 2 | 12 → 16 | 27 → 30 | 1 → 0 | 1 → — | 25 → 26 | 9 → 9 |
| `/x` | 1 → 1 | 16 → 20 | 27 → 13 | 1 → 0 | 1 → — | 28 → 31 | 10 → 11 |
| `/coffee` | 1 → 4 | 20 → 20 | 28 → 32 | 1 → 0 | 1 → — | 26 → 26 | 9 → 9 |
| `/private` | 2 → 2 | 16 → 16 | 30 → 44 | 3 → 1 | 1 → 6 | 12 → 8 | 10 → 12 |
| `/status` | — → 2 | — → 16 | — → 12 | — → 0 | — → — | — → 27 | — → 9 |


</details>

<details><summary>slow4g · cold browser cache</summary>


| Page | HTML TTFB ms | FCP ms | Numbers ms | API requests | API TTFB ms | JS KiB | CSS KiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 1 → 1 | 488 → 484 | 792 → 795 | 3 → 1 | 1 → 2 | 29 → 30 | 9 → 9 |
| `/pidgy` | 1 → 3 | 468 → 468 | 1139 → 788 | 1 → 1 | 1 → 2 | 25 → 25 | 9 → 9 |
| `/games` | 2 → 2 | 472 → 492 | 1120 → 827 | 1 → 1 | 1 → 2 | 25 → 26 | 9 → 9 |
| `/map` | 1 → 1 | 480 → 468 | 1112 → 900 | 3 → 1 | 1 → 2 | 68 → 29 | 13 → 13 |
| `/music` | 4 → 3 | 476 → 544 | 1689 → 850 | 2 → 1 | 2 → 7 | 25 → 25 | 9 → 9 |
| `/hunt` | 1 → 2 | 464 → 472 | 1140 → 806 | 1 → 1 | 1 → 2 | 25 → 25 | 9 → 9 |
| `/x` | 2 → 2 | 468 → 468 | 1208 → 806 | 1 → 1 | 1 → 2 | 28 → 31 | 10 → 11 |
| `/coffee` | 2 → 1 | 456 → 452 | 1181 → 1045 | 1 → 1 | 1 → 2 | 26 → 26 | 9 → 9 |
| `/private` | 1 → 1 | 512 → 528 | 1192 → 807 | 3 → 1 | 1 → 2 | 12 → 8 | 10 → 12 |
| `/status` | — → 1 | — → 464 | — → 785 | — → 1 | — → 6 | — → 25 | — → 9 |


</details>

<details><summary>slow4g · warm browser cache</summary>


| Page | HTML TTFB ms | FCP ms | Numbers ms | API requests | API TTFB ms | JS KiB | CSS KiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 1 → 2 | 212 → 200 | 375 → 215 | 3 → 0 | 1 → — | 29 → 30 | 9 → 9 |
| `/pidgy` | 1 → 1 | 204 → 200 | 381 → 221 | 1 → 0 | 1 → — | 25 → 27 | 9 → 9 |
| `/games` | 2 → 2 | 196 → 196 | 376 → 233 | 1 → 0 | 1 → — | 25 → 26 | 9 → 9 |
| `/map` | 1 → 6 | 196 → 252 | 382 → 299 | 3 → 0 | 1 → — | 70 → 29 | 13 → 13 |
| `/music` | 1 → 1 | 200 → 196 | 913 → 191 | 2 → 0 | 1 → — | 25 → 26 | 9 → 9 |
| `/hunt` | 1 → 1 | 188 → 188 | 369 → 210 | 1 → 0 | 1 → — | 25 → 26 | 9 → 9 |
| `/x` | 1 → 1 | 196 → 240 | 389 → 228 | 1 → 0 | 1 → — | 28 → 31 | 10 → 11 |
| `/coffee` | 1 → 3 | 196 → 196 | 372 → 264 | 1 → 0 | 1 → — | 26 → 26 | 9 → 9 |
| `/private` | 1 → 1 | 188 → 200 | 535 → 375 | 3 → 1 | 1 → 2 | 12 → 8 | 10 → 12 |
| `/status` | — → 1 | — → 200 | — → 219 | — → 0 | — → — | — → 27 | — → 9 |


</details>

### Production baseline

The numbers column stayed empty for every sample. Coffee and status returned 404, X displayed its unconfigured state, and the private route displayed login. The remaining page panels did not render measured figures during the observation window. The following compact cells are HTML TTFB / FCP in ms, data requests, then encoded JS / CSS in KiB.

| Page | HTTP | Normal cold | Normal warm | Slow 4G cold | Slow 4G warm |
|---|---:|---|---|---|---|
| `/` | 200 | 107/848 · 2 · 27/9 | 22/104 · 2 · 8/7 | 20/596 · 2 · 27/9 | 18/360 · 2 · 8/7 |
| `/pidgy` | 200 | 19/192 · 1 · 24/9 | 87/164 · 1 · 5/7 | 106/560 · 1 · 24/9 | 18/412 · 1 · 5/7 |
| `/games` | 200 | 20/152 · 1 · 24/9 | 22/168 · 1 · 5/7 | 19/568 · 1 · 24/9 | 18/360 · 1 · 5/7 |
| `/map` | 200 | 21/180 · 3 · 71/14 | 51/124 · 3 · 53/12 | 21/648 · 3 · 70/14 | 25/372 · 3 · 53/12 |
| `/music` | 200 | 19/228 · 2 · 24/9 | 18/124 · 2 · 5/7 | 20/620 · 2 · 24/9 | 18/356 · 2 · 5/7 |
| `/hunt` | 200 | 19/220 · 1 · 24/9 | 18/92 · 1 · 5/7 | 109/552 · 1 · 24/9 | 19/364 · 1 · 5/7 |
| `/x` | 200 | 22/236 · 1 · 27/11 | 18/96 · 1 · 6/9 | 107/772 · 1 · 27/11 | 38/348 · 1 · 6/9 |
| `/coffee` | 404 | 18/152 · 0 · 5/8 | 18/92 · 0 · 1/6 | 19/540 · 0 · 5/8 | 150/384 · 0 · 1/6 |
| `/private` | 200 | 104/252 · 1 · 13/11 | 19/92 · 1 · 3/8 | 19/580 · 1 · 13/11 | 103/356 · 1 · 3/8 |
| `/status` | 404 | 19/228 · 0 · 5/8 | 22/100 · 0 · 1/6 | 21/544 · 0 · 5/8 | 18/372 · 0 · 1/6 |

### Reproduction and parity

Run the browser harness as `node tools/bench-stats.mjs <origin> <output.json>`. For Lighthouse use `node tools/lighthouse-stats.mjs <origin> <output.json>`. The local fixture accepts `node tools/stats-fixture.mjs <checkout> <port>`. To exercise Redis on the new version, set `STATS_FIXTURE_REDIS` to a disposable numbered local database. Start the baseline fixture with a checkout of `71739c1`. The private fixture provides a synthetic session with loopback-only access. Browser comparisons use synthetic nonempty figures on every existing page.

Using a separate empty loopback Redis database, run `STATS_TEST_REDIS=<local-test-url> node --experimental-vm-modules tests/stats-health.mjs`. It executes the previous release’s real overview handler and the new builder against identical day-dependent HogQL responses and Redis counters. For 2–4 November visitors, totals, hours, countries, sources, browsers, pages, feathers, hunters, terminal, CV and CLI match field by field. It also checks partial publication while a provider is blocked, previous values during outages, immutable days, private access, every health probe, protected error detail and concurrent alert debounce.
