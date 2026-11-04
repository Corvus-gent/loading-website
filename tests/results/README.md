The homepage now opens into a lantern-lit navigation realm. Visitors can play one of eight shared daily puzzles, keep an anonymous streak, share results, and browse dedicated Pidgy, games, visitor-map, music and hunt statistics.

Work is on `daily/2026-11-04`; **Gabriel merges**. Main has not been pushed or merged.

## What changed

- Minimal portal, remembered skip link, accessible illustrated realm, seven-language navigation, CV/download/LinkedIn shortcuts, and the existing two-second Gabe share redirect.
- Eight server-checked daily engines: Babel, Borders, Polyglot Wordle, Flags & Capitals, Combo, Bangle, Pingle and Lantern. Hints, first-visit instructions in seven languages, shared streak, per-type local stats, result sharing and Brussels midnight countdown.
- Signed anonymous cookie, hashed-IP rate limits, atomic Redis counters and replay protection. Lantern reveals raster tiles, not answer text. The authoring bank is excluded from the Vercel static deployment and bundled only in the server helper.
- Delegated outbound tracking preserves existing invite/campaign parameters and adds missing Corvus attribution to Pidgy links. Signup counts remain hidden unless all three future Pidgy settings exist.
- Separate public stats routes with their own metadata, copy links and shared navigation. The full visitor map moves to `/map`; overview retains a compact link. Detailed outbound links remain private.
- Active-language-only translation loading, deferred search/Spotify, visibility-aware animation pausing, reduced motion, reserved layout space, resized WebP assets, Redis pipelines and versioned script/style entrypoints.

## Decisions and scope

- Launch day is 4 November 2026: puzzle #1 is Babel, so the cycle uses `(N - 1) % 8`.
- Reuse the existing signed `mvid` cookie rather than creating a second anonymous identity. Redis is authoritative; localStorage is a convenience copy. No login is needed.
- `/api/game` and its POST routes use the existing stats function, avoiding another deployed function on the current Vercel plan.
- Pingle requires at least two distinct visitors in the same city/region/country yesterday, uses rounded city coordinates, and accepts a point within 75 km. No eligible city means a Borders fallback. It does not expose individual visits.
- Flags starts its timer after instructions close; three of five correct rounds is a win. Lantern has three guesses and counts unique revealed cells.
- Content is a starter bank: 7 written language packs, 26 country silhouettes/capitals, 7 curated music artists, and small word lists in 7 languages. Babel offers 69 language names; only the seven written packs can currently be selected as answers. Bangle uses matching tracks from `music.json`. Wordle validates five Latin letters after accent folding, without a comprehensive dictionary; Chinese uses pinyin.
- Existing fire/sticky Pidgy artwork is reused for the rotating scenes. A dedicated flying Pidgy PNG is still missing. No image-generation credits were used.
- Existing easter-egg destinations are excluded from navigation/search. The hidden terminal remains keyboard-accessible. No new links to `/402` or the private dashboard were added to the realm.

## Validation

- **8/8 Playwright tests pass**, with browser errors and console errors checked: all five requested personas, the other daily interfaces, outbound invite/campaign preservation, and Gabe share redirect.
- Recruiter: portal + CV + download + LinkedIn in 4 clicks. Founder: LinkedIn link → booking in 2 clicks. Old Android: CPU 6×, Slow 4G, completed game and copied result, no observed task over 200 ms during that interaction. iPhone: initial 25 tracks, shuffle playback and suggestion cooldown. Keyboard: portal → French → wiki → realm → French stats, using Tab/Enter.
- All eight game engines and real local API handlers tested against isolated Redis: Brussels/DST dates, repeated letters, future-day denial, cookie/origin checks, invalid guesses, concurrent replay dedupe, completion reload, timed-game start and Lantern PNG output.
- All six public stats URLs, private routing and language-preserving 308 redirects checked against the actual middleware. Generated server-bank consistency checked.
- Changed JavaScript passes `node --check`; `git diff --check` passes. Production dependency audit reports no known vulnerabilities.
- Playwright traces/screenshots are generated in ignored `test-results/`; portal and realm screenshots are committed under `tests/results/screenshots/`.

## Performance

Local lab measurements, **not production field measurements**. Baseline is `fa7dff3`. CPU 6× and Slow 4G (150 ms, 1.6 Mbps) were used. The static measurement server has no production API credentials, so these measure page shells/fallbacks; functional persona tests use controlled API fixtures. Real backend behavior is tested separately against local Redis. Third-party network responses can vary between runs.

Lighthouse mobile, latest full run:

| Page | Score before → after | LCP before → after (ms) | CLS after | TBT after (ms) |
|---|---:|---:|---:|---:|
| `/` | 97 → 100 | 2174 → 1374 | 0.009 | 52 |
| `/realm/` | new → 84 | — → 4505 | 0.000 | 76 |
| `/music/` | 95 → 99 | 2590 → 2112 | 0.025 | 80 |
| `/call/` | 81 → 91 | 4061 → 3528 | 0.000 | 41 |
| `/games/` | new → 99 | — → 1210 | 0.017 | 92 |
| `/stats/` | 95 → 100 | 2770 → 1510 | 0.000 | 79 |
| `/stats/pidgy/` | new → 100 | — → 1357 | 0.000 | 88 |
| `/stats/games/` | new → 100 | — → 1507 | 0.000 | 85 |
| `/stats/map/` | new → 99 | — → 1506 | 0.000 | 82 |
| `/stats/music/` | new → 100 | — → 1505 | 0.000 | 75 |
| `/stats/hunt/` | new → 100 | — → 1357 | 0.000 | 86 |

Direct Chrome DevTools throttling, latest full run:

| Page | LCP before → after (ms) | CLS after | Longest observed task after (ms) |
|---|---:|---:|---:|
| `/` | 948 → 644 | 0.000 | 81 |
| `/realm/` | new → 520 | 0.000 | 64 |
| `/music/` | 2444 → 2060 | 0.019 | 68 |
| `/call/` | 1408 → 756 | 0.000 | 67 |
| `/games/` | new → 580 | 0.021 | 85 |
| `/stats/` | 1048 → 1560 | 0.000 | 70 |
| `/stats/pidgy/` | new → 572 | 0.000 | 66 |
| `/stats/games/` | new → 568 | 0.000 | 66 |
| `/stats/map/` | new → 780 | 0.000 | 66 |
| `/stats/music/` | new → 564 | 0.000 | 66 |
| `/stats/hunt/` | new → 572 | 0.000 | 68 |

All direct-throttle LCP results are under 2.5 seconds, CLS is under 0.05, and observed page-load tasks are below 200 ms. Lighthouse scores for existing pages improved. **Remaining gap:** Lighthouse's simulated LCP is 3.53 s on `/call` and 4.50 s on the new `/realm`, despite faster direct-throttle results. A focused repeat of `/realm` without code changes scored **98**, with LCP **1.58 s**, CLS **0**, and TBT **142 ms**; its LCP element is the introductory text. Both runs are retained rather than replacing the outlier. This demonstrates lab/network variability, not a guaranteed loading time. This does not establish field INP below 200 ms or guarantee 60 fps on physical low-end phones; the Android interaction test is narrower evidence. Asset delivery, real API latency and physical-device scroll performance still need production observation. Function/Redis region co-location was not changed without verified deployment-region information.

## Deployment and later inputs

- Vercel preview build passed before the final validation commit; final build status is recorded on this PR. The protected Vercel preview has not been runtime-tested with production credentials. This PR does not claim a live production rollout.
- Existing Redis/PostHog settings are reused. Optional `GAME_SECRET` can pin puzzle selection; it otherwise uses existing server-side secret configuration. Do not rotate it mid-day, because the selected puzzle can change.
- Later artwork: a flying Pidgy PNG. Later signup integration: `PIDGY_POSTHOG_KEY`, `PIDGY_POSTHOG_PROJECT`, `PIDGY_SIGNUP_EVENT`. Signup tracking is intentionally postponed, and its first-touch query has not been verified against that future project's schema.
- Reproduce with `npm run test:games`, `node tests/routes.mjs`, `npm run test:personas`, `npm run test:performance`, and `npm run test:lighthouse`. Browser tests expect `tools/serve.mjs` on port 4176 and isolated Redis on port 16380. After editing content, run `node tools/build-game-data.mjs`; after asset changes, run `python3 tools/version-assets.py` and `python3 tools/build-search.py`.
