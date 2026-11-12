# Corvus public link audit

Verified on production: 2026-11-10T00:55:20.589Z. Branch: `codex/link-discovery`; included in daily PR #18. Production: https://corvus.gent/ · directory: https://corvus.gent/map/

## Results

| Measure | Before | After |
|---|---:|---:|
| Live public pages / content views | 878 | 877 |
| Orphans (zero incoming page links) | 5 | 0 |
| Fewer than three incoming links | 24 | 0 |
| Unreachable from home | 5 | 0 |
| Minimum distinct incoming pages | 0 | 5 |
| Maximum navigations from home | unreachable; 3 among reachable pages | 2 |
| Dead public pages | 0 | 0 |

The final catalogue includes 74 general pages (including one PDF), 20 language collections, 280 hook collections, 502 registered video variants and one opted-in public soldier profile. Aliases are not counted twice. Empty language/hook collections remain accessible because these are real existing public routes, not invented video exports. The count changes because duplicate pages were consolidated and the public Senate directory was added.

## What changed

- **Off the beaten path**: six shuffled homepage cards drawn from the previously weak pages, a shuffle button, and a link to the complete map. No rotation interrupts reading.
- A generated public route catalogue powers the complete map, the untruncated search palette, section directories and contextual links. New static pages are discovered during builds. The map and search also read new public video registrations and claimed Senate profiles without waiting for a rebuild.
- Every normal page footer has three related pages and a different random gem. Dedicated links connect the Compound pages, hackathons, livestream, games and partner stories.
- Fullscreen game and embedded-demo footers stay hidden so they cannot cover controls. The transparent stream overlay and CV retain their original format. These pages still meet the incoming-link and homepage-distance targets.
- The Senate directory only lists claimed public seats. A pending invitation is never surfaced. Cardneto is a partner page, not an invented honorary rank.
- Permanent aliases preserve query strings: `/hack2 → /hack/2`, `/hack/the-feed → /hack/1/the-feed`, `/submission → /hack/play`. Submission ZIPs and assets remain untouched.
- Unintended copies of non-statistics pages on the stats subdomain now redirect to the main domain. Real statistics routes, including army stats, retain their own hostname.

## Scope, privacy and method

Rendered Chromium crawl, 1440px viewport, 879 production URLs checked after deployment. Every generated public route was also checked directly so an orphan could not disappear from the audit. A distinct referring canonical page counts once. Navigation distance is breadth-first from home; scrolling and opening a disclosure do not change the page. The complete map is always one page navigation from home, making all listed pages at most two navigations away. Hidden command-palette links do **not** contribute to inbound counts. Content identity queries (video, id, interview, game) distinguish views; tracking queries and fragments do not. Stats-domain accidental clones do not inflate counts. Download responses were separately confirmed by HEAD rather than treated as browser navigation failures.

Private account workflows, owner tools, interview submission, member access, invites, edit links and private stats are excluded from discovery. No tokens or private records are included in this report. The original scan found 25 excluded files/workflows; their private paths are intentionally omitted here.

The legacy public soldier profile was added during the final inventory cross-check. Its 200 response was checked on production; its baseline outgoing links were reconstructed from the pre-change template in commit e56a1c7. It had no incoming page links before this change. Hidden members were not enumerated. The initial crawl also found accidental stats-domain copies. The finite page audit uses the real site's canonical pages, not those duplicates. Short-link patterns are listed separately below; arbitrary future slugs are not asserted to exist.

## Verification

- Production, before and after: the original Compound page, v2 hub/language/hook/video, protected stats/links login screens, livestream, game voting, Hack #3, one video short link and one code link all returned 200 and rendered their key elements (12-route contest smoke).
- Compound impact, Legion and the owner login page were checked separately before deploy; the public owner-login password field renders after deployment.
- 390 × 844 and 1440px desktop: home, map, Quests, Daily, Legion, Senate, Live, impact, game voting and game checked; no horizontal page overflow. Shuffle, map filtering and full search worked.
- No application page errors in the full crawl. An existing third-party Twitch keyboard-permission warning is excluded from the separate UI smoke assertion.
- Vercel request logs: zero 500-class responses in the deployment's checked window.
- 759 concrete aliases / short links checked. Twenty legacy campaign routes reject HEAD but succeed on uncounted bot GET; they are not dead. External destinations are not crawled.
- Canonical 301s were tested with an attribution query; it was preserved.

Short-link HEAD checks exposed a legacy battle counter that counted crawler traffic. The handler now excludes HEAD and bot requests. The initial audit may have added at most one deduplicated click to each of its 12 campaign buckets; no human records or votes were removed.

Screenshots: `test-results/link-audit/home-strip-390.png` and `home-strip-1440.png` (production). Raw rendered crawl and smoke evidence is in the same local test-results folder.

## Complete public route table

“—” means the route was not in that catalogue or not reachable. Redirect rows inherit their canonical destination's access; retired aliases are listed as redirects, not deleted content.

| Route | What it is | Inbound before → after | Home clicks before → after | Status |
|---|---|---:|---:|---|
| / | corvus.gent | 874 → 874 | 0 → 0 | live |
| /402 | 402 · the crow’s other door | 2 → 21 | 2 → 1 | live |
| /airbnb | Gabriel – even bellen? | 0 → 20 | — → 1 | live |
| /airbnb-call-me-pls | Gabriel – call me pls | 1 → 21 | 3 → 1 | live |
| /airbnb-filter | me vs the Airbnb filter | 3 → 18 | 2 → 2 | live |
| /battle | Codex vs Compound | 2 → 21 | 2 → 1 | live |
| /build | one man. one army. | 52 → 72 | 1 → 1 | live |
| /call | book a call | 870 → 871 | 1 → 1 | live |
| /compound | the $1,000 cut | 808 → 810 | 2 → 2 | live |
| /compound/impact | Compound impact 💎 | 870 → 871 | 1 → 1 | live |
| /compound/rules | feedback, with ground rules | 2 → 18 | 2 → 2 | live |
| /compound/v2 | 100 videos. one deadline. | 809 → 811 | 2 → 2 | live |
| /compound/v2/ar | العربية · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/ar/a | العربية · A | 14 → 18 | 4 → 2 | live |
| /compound/v2/ar/b | العربية · B | 14 → 17 | 4 → 2 | live |
| /compound/v2/ar/bjj | العربية · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/ar/c | العربية · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/comm | العربية · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/d | العربية · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/demo | العربية · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/e | العربية · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/f | العربية · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/int | العربية · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/live | العربية · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/mom | العربية · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/side | العربية · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ar/startup | العربية · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay | Aymar aru · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/ay/a | Aymar aru · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/ay/b | Aymar aru · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/ay/bjj | Aymar aru · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/ay/c | Aymar aru · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/comm | Aymar aru · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/d | Aymar aru · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/demo | Aymar aru · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/e | Aymar aru · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/f | Aymar aru · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/int | Aymar aru · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/live | Aymar aru · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/mom | Aymar aru · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/side | Aymar aru · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ay/startup | Aymar aru · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca | Català · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/ca/a | Català · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/ca/b | Català · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/ca/bjj | Català · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/ca/c | Català · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/comm | Català · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/d | Català · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/demo | Català · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/e | Català · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/f | Català · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/int | Català · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/live | Català · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/mom | Català · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/side | Català · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ca/startup | Català · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce | Нохчийн · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/ce/a | Нохчийн · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/ce/b | Нохчийн · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/ce/bjj | Нохчийн · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/ce/c | Нохчийн · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/comm | Нохчийн · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/d | Нохчийн · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/demo | Нохчийн · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/e | Нохчийн · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/f | Нохчийн · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/int | Нохчийн · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/live | Нохчийн · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/mom | Нохчийн · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/side | Нохчийн · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ce/startup | Нохчийн · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/de | Deutsch · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/de/a | Deutsch · A | 29 → 34 | 4 → 2 | live |
| /compound/v2/de/a/1?video=ig-gl-de-a1 | DE-A-1 · IG / gl | 17 → 22 | 3 → 2 | live |
| /compound/v2/de/a/1?video=li-gl-de-a1 | DE-A-1 · LI / gl | 17 → 21 | 3 → 2 | live |
| /compound/v2/de/a/1?video=x-gm-de-a1 | DE-A-1 · X / gm | 17 → 20 | 3 → 2 | live |
| /compound/v2/de/a/2?video=ig-gl-de-a2 | DE-A-2 · IG / gl | 42 → 44 | 3 → 2 | live |
| /compound/v2/de/a/2?video=li-gl-de-a2 | DE-A-2 · LI / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/de/a/2?video=tt-gm-de-a2 | DE-A-2 · TT / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/de/a/2?video=x-gm-de-a2 | DE-A-2 · X / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/de/a/3?video=ig-gl-de-a3 | DE-A-3 · IG / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/de/a/3?video=li-gl-de-a3 | DE-A-3 · LI / gl | 99 → 101 | 3 → 2 | live |
| /compound/v2/de/a/3?video=tt-gm-de-a3 | DE-A-3 · TT / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/de/a/3?video=x-gm-de-a3 | DE-A-3 · X / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/de/a/4?video=ig-gl-de-a4 | DE-A-4 · IG / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/de/a/4?video=li-gl-de-a4 | DE-A-4 · LI / gl | 45 → 47 | 3 → 2 | live |
| /compound/v2/de/a/4?video=tt-gm-de-a4 | DE-A-4 · TT / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/de/a/4?video=x-gm-de-a4 | DE-A-4 · X / gm | 74 → 76 | 3 → 2 | live |
| /compound/v2/de/b | Deutsch · B | 29 → 33 | 4 → 2 | live |
| /compound/v2/de/bjj | Deutsch · BJJ | 29 → 32 | 4 → 2 | live |
| /compound/v2/de/c | Deutsch · C | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/comm | Deutsch · Community | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/d | Deutsch · D | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/demo | Deutsch · Product demo | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/e | Deutsch · Sidequest | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/f | Deutsch · F | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/int | Deutsch · Interview | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/live | Deutsch · Live | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/mom | Deutsch · Mom | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/side | Deutsch · Sidequest | 29 → 31 | 4 → 2 | live |
| /compound/v2/de/startup | Deutsch · Startup | 29 → 31 | 4 → 2 | live |
| /compound/v2/en | English · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/en/a | English · A | 150 → 155 | 3 → 2 | live |
| /compound/v2/en/a/1?video=x-gm-en-a1 | EN-A-1 · X / gm | 17 → 22 | 3 → 2 | live |
| /compound/v2/en/a/2?video=ig-gl-en-a2 | EN-A-2 · IG / gl | 17 → 21 | 3 → 2 | live |
| /compound/v2/en/a/2?video=li-gl-en-a2 | EN-A-2 · LI / gl | 17 → 20 | 3 → 2 | live |
| /compound/v2/en/a/2?video=tt-gm-en-a2 | EN-A-2 · TT / gm | 59 → 61 | 3 → 2 | live |
| /compound/v2/en/a/2?video=x-gm-en-a2 | EN-A-2 · X / gm | 219 → 221 | 3 → 2 | live |
| /compound/v2/en/a/3?video=ig-gl-en-a3 | EN-A-3 · IG / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/en/a/3?video=li-gl-en-a3 | EN-A-3 · LI / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/en/a/3?video=tt-gm-en-a3 | EN-A-3 · TT / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/en/a/3?video=x-gm-en-a3 | EN-A-3 · X / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/en/a/4?video=ig-gl-en-a4 | EN-A-4 · IG / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/en/a/4?video=li-gl-en-a4 | EN-A-4 · LI / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/en/a/4?video=tt-gm-en-a4 | EN-A-4 · TT / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/en/a/4?video=x-gm-en-a4 | EN-A-4 · X / gm | 57 → 59 | 3 → 2 | live |
| /compound/v2/en/a/5?video=x-gm-en-a5 | EN-A-5 · X / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/en/a/6?video=x-gm-en-a6 | EN-A-6 · X / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/en/b | English · B | 150 → 154 | 3 → 2 | live |
| /compound/v2/en/b/1?video=ig-gl-en-b1 | EN-B-1 · IG / gl | 23 → 28 | 3 → 2 | live |
| /compound/v2/en/b/1?video=li-gl-en-b1 | EN-B-1 · LI / gl | 165 → 167 | 3 → 2 | live |
| /compound/v2/en/b/1?video=tt-gm-en-b1 | EN-B-1 · TT / gm | 23 → 26 | 3 → 2 | live |
| /compound/v2/en/b/1?video=x-gm-en-b1 | EN-B-1 · X / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/2?video=ig-gl-en-b2 | EN-B-2 · IG / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/2?video=li-gl-en-b2 | EN-B-2 · LI / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/2?video=tt-gm-en-b2 | EN-B-2 · TT / gm | 154 → 156 | 3 → 2 | live |
| /compound/v2/en/b/2?video=x-gm-en-b2 | EN-B-2 · X / gm | 165 → 167 | 3 → 2 | live |
| /compound/v2/en/b/3?video=ig-gl-en-b3 | EN-B-3 · IG / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/3?video=li-gl-en-b3 | EN-B-3 · LI / gl | 165 → 167 | 3 → 2 | live |
| /compound/v2/en/b/3?video=tt-gm-en-b3 | EN-B-3 · TT / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/3?video=x-gm-en-b3 | EN-B-3 · X / gm | 165 → 167 | 3 → 2 | live |
| /compound/v2/en/b/4?video=ig-gl-en-b4 | EN-B-4 · IG / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/4?video=li-gl-en-b4 | EN-B-4 · LI / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/4?video=tt-gm-en-b4 | EN-B-4 · TT / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/4?video=x-gm-en-b4 | EN-B-4 · X / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/5?video=tt-gm-en-b5 | EN-B-5 · TT / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/6?video=tt-gm-en-b6 | EN-B-6 · TT / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/7?video=tt-gm-en-b7 | EN-B-7 · TT / gm | 65 → 67 | 3 → 2 | live |
| /compound/v2/en/b/8?video=tt-gm-en-b8 | EN-B-8 · TT / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/b/8?video=x-gm-en-b8 | EN-B-8 · X / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/en/bjj | English · BJJ | 150 → 153 | 3 → 2 | live |
| /compound/v2/en/c | English · C | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/c/1?video=ig-gl-en-c1 | EN-C-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/en/c/1?video=li-gl-en-c1 | EN-C-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/en/c/1?video=tt-gm-en-c1 | EN-C-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/en/c/1?video=x-gm-en-c1 | EN-C-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/2?video=ig-gl-en-c2 | EN-C-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/2?video=li-gl-en-c2 | EN-C-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/2?video=tt-gm-en-c2 | EN-C-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/2?video=x-gm-en-c2 | EN-C-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/3?video=ig-gl-en-c3 | EN-C-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/3?video=li-gl-en-c3 | EN-C-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/3?video=tt-gm-en-c3 | EN-C-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/3?video=x-gm-en-c3 | EN-C-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/4?video=ig-gl-en-c4 | EN-C-4 · IG / gl | 185 → 187 | 3 → 2 | live |
| /compound/v2/en/c/4?video=li-gl-en-c4 | EN-C-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/4?video=tt-gm-en-c4 | EN-C-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/c/4?video=x-gm-en-c4 | EN-C-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/comm | English · Community | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/comm/1?video=tt-bjj-en-comm1 | EN-COMM-1 · TT / bjj | 6 → 11 | 3 → 2 | live |
| /compound/v2/en/comm/2?video=tt-bjj-en-comm2 | EN-COMM-2 · TT / bjj | 6 → 10 | 3 → 2 | live |
| /compound/v2/en/comm/3?video=tt-bjj-en-comm3 | EN-COMM-3 · TT / bjj | 6 → 9 | 3 → 2 | live |
| /compound/v2/en/comm/4?video=tt-bjj-en-comm4 | EN-COMM-4 · TT / bjj | 6 → 8 | 3 → 2 | live |
| /compound/v2/en/d | English · D | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/d/1?video=ig-gl-en-d1 | EN-D-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/en/d/1?video=li-gl-en-d1 | EN-D-1 · LI / gl | 185 → 187 | 3 → 2 | live |
| /compound/v2/en/d/1?video=tt-gm-en-d1 | EN-D-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/en/d/1?video=x-gm-en-d1 | EN-D-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/2?video=ig-gl-en-d2 | EN-D-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/2?video=li-gl-en-d2 | EN-D-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/2?video=tt-gm-en-d2 | EN-D-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/2?video=x-gm-en-d2 | EN-D-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/3?video=ig-gl-en-d3 | EN-D-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/3?video=li-gl-en-d3 | EN-D-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/3?video=tt-gm-en-d3 | EN-D-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/3?video=x-gm-en-d3 | EN-D-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/4?video=ig-gl-en-d4 | EN-D-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/4?video=li-gl-en-d4 | EN-D-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/d/4?video=tt-gm-en-d4 | EN-D-4 · TT / gm | 42 → 44 | 3 → 2 | live |
| /compound/v2/en/d/4?video=x-gm-en-d4 | EN-D-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/en/demo | English · Product demo | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/demo/1?video=ig-collab-en-demo1 | EN-DEMO-1 · IG / collab | 6 → 11 | 3 → 2 | live |
| /compound/v2/en/demo/1?video=li-gl-en-demo1 | EN-DEMO-1 · LI / gl | 6 → 10 | 3 → 2 | live |
| /compound/v2/en/demo/1?video=tt-gm-en-demo1 | EN-DEMO-1 · TT / gm | 6 → 9 | 3 → 2 | live |
| /compound/v2/en/demo/1?video=x-gm-en-demo1 | EN-DEMO-1 · X / gm | 6 → 8 | 3 → 2 | live |
| /compound/v2/en/e | English · Sidequest | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/e/1?video=ig-gl-en-e1 | EN-E-1 · IG / gl | 185 → 187 | 3 → 2 | live |
| /compound/v2/en/e/1?video=x-gm-en-e1 | EN-E-1 · X / gm | 10 → 14 | 3 → 2 | live |
| /compound/v2/en/e/2?video=ig-gl-en-e2 | EN-E-2 · IG / gl | 10 → 13 | 3 → 2 | live |
| /compound/v2/en/e/2?video=x-gm-en-e2 | EN-E-2 · X / gm | 10 → 12 | 3 → 2 | live |
| /compound/v2/en/e/3?video=ig-gl-en-e3 | EN-E-3 · IG / gl | 10 → 12 | 3 → 2 | live |
| /compound/v2/en/e/3?video=x-gm-en-e3 | EN-E-3 · X / gm | 10 → 12 | 3 → 2 | live |
| /compound/v2/en/e/4?video=ig-gl-en-e4 | EN-E-4 · IG / gl | 10 → 12 | 3 → 2 | live |
| /compound/v2/en/e/4?video=x-gm-en-e4 | EN-E-4 · X / gm | 10 → 12 | 3 → 2 | live |
| /compound/v2/en/f | English · F | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/f/1?video=ig-gl-en-f1 | EN-F-1 · IG / gl | 20 → 25 | 3 → 2 | live |
| /compound/v2/en/f/1?video=li-gl-en-f1 | EN-F-1 · LI / gl | 20 → 24 | 3 → 2 | live |
| /compound/v2/en/f/1?video=tt-gm-en-f1 | EN-F-1 · TT / gm | 20 → 23 | 3 → 2 | live |
| /compound/v2/en/f/1?video=x-gm-en-f1 | EN-F-1 · X / gm | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/2?video=ig-gl-en-f2 | EN-F-2 · IG / gl | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/2?video=li-gl-en-f2 | EN-F-2 · LI / gl | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/2?video=tt-gm-en-f2 | EN-F-2 · TT / gm | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/2?video=x-gm-en-f2 | EN-F-2 · X / gm | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/3?video=ig-gl-en-f3 | EN-F-3 · IG / gl | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/3?video=li-gl-en-f3 | EN-F-3 · LI / gl | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/3?video=tt-gm-en-f3 | EN-F-3 · TT / gm | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/3?video=x-gm-en-f3 | EN-F-3 · X / gm | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/4?video=ig-gl-en-f4 | EN-F-4 · IG / gl | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/4?video=li-gl-en-f4 | EN-F-4 · LI / gl | 44 → 46 | 3 → 2 | live |
| /compound/v2/en/f/4?video=tt-gm-en-f4 | EN-F-4 · TT / gm | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/4?video=x-gm-en-f4 | EN-F-4 · X / gm | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/f/5?video=x-gm-en-f5 | EN-F-5 · X / gm | 154 → 156 | 3 → 2 | live |
| /compound/v2/en/f/6?video=x-gm-en-f6 | EN-F-6 · X / gm | 20 → 22 | 3 → 2 | live |
| /compound/v2/en/int | English · Interview | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/live | English · Live | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/live/1?video=ig-gl-en-live1 | EN-LIVE-1 · IG / gl | 6 → 11 | 3 → 2 | live |
| /compound/v2/en/live/1?video=li-gl-en-live1 | EN-LIVE-1 · LI / gl | 6 → 10 | 3 → 2 | live |
| /compound/v2/en/live/1?video=tt-gm-en-live1 | EN-LIVE-1 · TT / gm | 6 → 9 | 3 → 2 | live |
| /compound/v2/en/live/1?video=x-gm-en-live1 | EN-LIVE-1 · X / gm | 6 → 8 | 3 → 2 | live |
| /compound/v2/en/mom | English · Mom | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/mom/1?video=ig-collab-en-mom1 | EN-MOM-1 · IG / collab | 19 → 24 | 3 → 2 | live |
| /compound/v2/en/mom/1?video=li-gl-en-mom1 | EN-MOM-1 · LI / gl | 19 → 23 | 3 → 2 | live |
| /compound/v2/en/mom/1?video=tt-gm-en-mom1 | EN-MOM-1 · TT / gm | 19 → 22 | 3 → 2 | live |
| /compound/v2/en/mom/1?video=x-gm-en-mom1 | EN-MOM-1 · X / gm | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/1?video=yt-gm-en-mom1 | EN-MOM-1 · YT / gm | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/2?video=ig-collab-en-mom2 | EN-MOM-2 · IG / collab | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/2?video=li-gl-en-mom2 | EN-MOM-2 · LI / gl | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/2?video=tt-gm-en-mom2 | EN-MOM-2 · TT / gm | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/2?video=x-gm-en-mom2 | EN-MOM-2 · X / gm | 43 → 45 | 3 → 2 | live |
| /compound/v2/en/mom/3?video=ig-collab-en-mom3 | EN-MOM-3 · IG / collab | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/3?video=li-gl-en-mom3 | EN-MOM-3 · LI / gl | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/3?video=tt-gm-en-mom3 | EN-MOM-3 · TT / gm | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/3?video=x-gm-en-mom3 | EN-MOM-3 · X / gm | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/4?video=ig-collab-en-mom4 | EN-MOM-4 · IG / collab | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/4?video=li-gl-en-mom4 | EN-MOM-4 · LI / gl | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/4?video=tt-gm-en-mom4 | EN-MOM-4 · TT / gm | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/mom/4?video=x-gm-en-mom4 | EN-MOM-4 · X / gm | 19 → 21 | 3 → 2 | live |
| /compound/v2/en/side | English · Sidequest | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/startup | English · Startup | 150 → 152 | 3 → 2 | live |
| /compound/v2/en/startup/1?video=li-gl-en-startup1 | EN-STARTUP-1 · LI / gl | 14 → 19 | 3 → 2 | live |
| /compound/v2/en/startup/1?video=tt-gm-en-startup1 | EN-STARTUP-1 · TT / gm | 14 → 18 | 3 → 2 | live |
| /compound/v2/en/startup/2?video=li-gl-en-startup2 | EN-STARTUP-2 · LI / gl | 14 → 17 | 3 → 2 | live |
| /compound/v2/en/startup/2?video=tt-gm-en-startup2 | EN-STARTUP-2 · TT / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/en/startup/2?video=x-gm-en-startup2 | EN-STARTUP-2 · X / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/en/startup/3?video=li-gl-en-startup3 | EN-STARTUP-3 · LI / gl | 14 → 16 | 3 → 2 | live |
| /compound/v2/en/startup/3?video=tt-gm-en-startup3 | EN-STARTUP-3 · TT / gm | 26 → 28 | 3 → 2 | live |
| /compound/v2/en/startup/4?video=li-gl-en-startup4 | EN-STARTUP-4 · LI / gl | 14 → 16 | 3 → 2 | live |
| /compound/v2/en/startup/4?video=tt-gm-en-startup4 | EN-STARTUP-4 · TT / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/en/startup/5?video=tt-gm-en-startup5 | EN-STARTUP-5 · TT / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/en/startup/6?video=tt-gm-en-startup6 | EN-STARTUP-6 · TT / gm | 67 → 69 | 3 → 2 | live |
| /compound/v2/en/startup/7?video=tt-gm-en-startup7 | EN-STARTUP-7 · TT / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/es | Español · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/es/a | Español · A | 110 → 115 | 4 → 2 | live |
| /compound/v2/es/a/1?video=ig-gl-es-a1 | ES-A-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/es/a/1?video=li-gl-es-a1 | ES-A-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/es/a/1?video=tt-bjj-es-a1 | ES-A-1 · TT / bjj | 18 → 21 | 3 → 2 | live |
| /compound/v2/es/a/1?video=x-gm-es-a1 | ES-A-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/a/2?video=ig-gl-es-a2 | ES-A-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/a/2?video=li-gl-es-a2 | ES-A-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/a/2?video=tt-bjj-es-a2 | ES-A-2 · TT / bjj | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/a/2?video=x-gm-es-a2 | ES-A-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/a/3?video=ig-gl-es-a3 | ES-A-3 · IG / gl | 179 → 181 | 3 → 2 | live |
| /compound/v2/es/a/3?video=li-gl-es-a3 | ES-A-3 · LI / gl | 107 → 109 | 3 → 2 | live |
| /compound/v2/es/a/3?video=tt-bjj-es-a3 | ES-A-3 · TT / bjj | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/a/3?video=x-gm-es-a3 | ES-A-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/a/4?video=ig-gl-es-a4 | ES-A-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/a/4?video=li-gl-es-a4 | ES-A-4 · LI / gl | 179 → 181 | 3 → 2 | live |
| /compound/v2/es/a/4?video=tt-bjj-es-a4 | ES-A-4 · TT / bjj | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/a/4?video=x-gm-es-a4 | ES-A-4 · X / gm | 58 → 60 | 3 → 2 | live |
| /compound/v2/es/b | Español · B | 110 → 114 | 4 → 2 | live |
| /compound/v2/es/bjj | Español · BJJ | 110 → 113 | 4 → 2 | live |
| /compound/v2/es/c | Español · C | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/c/1?video=ig-gl-es-c1 | ES-C-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/es/c/1?video=li-gl-es-c1 | ES-C-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/es/c/1?video=tt-gm-es-c1 | ES-C-1 · TT / gm | 146 → 148 | 3 → 2 | live |
| /compound/v2/es/c/1?video=x-gm-es-c1 | ES-C-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/2?video=ig-gl-es-c2 | ES-C-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/2?video=li-gl-es-c2 | ES-C-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/2?video=tt-gm-es-c2 | ES-C-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/2?video=x-gm-es-c2 | ES-C-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/3?video=ig-gl-es-c3 | ES-C-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/3?video=li-gl-es-c3 | ES-C-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/3?video=tt-gm-es-c3 | ES-C-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/3?video=x-gm-es-c3 | ES-C-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/4?video=ig-gl-es-c4 | ES-C-4 · IG / gl | 146 → 148 | 3 → 2 | live |
| /compound/v2/es/c/4?video=li-gl-es-c4 | ES-C-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/4?video=tt-gm-es-c4 | ES-C-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/c/4?video=x-gm-es-c4 | ES-C-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/comm | Español · Community | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/d | Español · D | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/d/1?video=ig-gl-es-d1 | ES-D-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/es/d/1?video=li-gl-es-d1 | ES-D-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/es/d/1?video=tt-gm-es-d1 | ES-D-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/es/d/1?video=x-gm-es-d1 | ES-D-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/2?video=ig-gl-es-d2 | ES-D-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/2?video=li-gl-es-d2 | ES-D-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/2?video=tt-gm-es-d2 | ES-D-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/2?video=x-gm-es-d2 | ES-D-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/3?video=ig-gl-es-d3 | ES-D-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/3?video=li-gl-es-d3 | ES-D-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/3?video=tt-gm-es-d3 | ES-D-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/3?video=x-gm-es-d3 | ES-D-3 · X / gm | 52 → 54 | 3 → 2 | live |
| /compound/v2/es/d/4?video=ig-gl-es-d4 | ES-D-4 · IG / gl | 146 → 148 | 3 → 2 | live |
| /compound/v2/es/d/4?video=li-gl-es-d4 | ES-D-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/4?video=tt-gm-es-d4 | ES-D-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/d/4?video=x-gm-es-d4 | ES-D-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/demo | Español · Product demo | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/e | Español · Sidequest | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/e/1?video=ig-gl-es-e1 | ES-E-1 · IG / gl | 138 → 140 | 3 → 2 | live |
| /compound/v2/es/e/1?video=li-gl-es-e1 | ES-E-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/es/e/1?video=tt-gm-es-e1 | ES-E-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/es/e/1?video=x-gm-es-e1 | ES-E-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/2?video=ig-gl-es-e2 | ES-E-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/2?video=li-gl-es-e2 | ES-E-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/2?video=tt-gm-es-e2 | ES-E-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/2?video=x-gm-es-e2 | ES-E-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/3?video=ig-gl-es-e3 | ES-E-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/3?video=li-gl-es-e3 | ES-E-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/3?video=tt-gm-es-e3 | ES-E-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/3?video=x-gm-es-e3 | ES-E-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/4?video=ig-gl-es-e4 | ES-E-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/4?video=li-gl-es-e4 | ES-E-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/4?video=tt-gm-es-e4 | ES-E-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/e/4?video=x-gm-es-e4 | ES-E-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f | Español · F | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/f/1?video=ig-gl-es-f1 | ES-F-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/es/f/1?video=li-gl-es-f1 | ES-F-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/es/f/1?video=tt-gm-es-f1 | ES-F-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/es/f/1?video=x-gm-es-f1 | ES-F-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/2?video=ig-gl-es-f2 | ES-F-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/2?video=li-gl-es-f2 | ES-F-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/2?video=tt-gm-es-f2 | ES-F-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/2?video=x-gm-es-f2 | ES-F-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/3?video=ig-gl-es-f3 | ES-F-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/3?video=li-gl-es-f3 | ES-F-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/3?video=tt-gm-es-f3 | ES-F-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/3?video=x-gm-es-f3 | ES-F-3 · X / gm | 85 → 87 | 3 → 2 | live |
| /compound/v2/es/f/4?video=ig-gl-es-f4 | ES-F-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/4?video=li-gl-es-f4 | ES-F-4 · LI / gl | 148 → 150 | 3 → 2 | live |
| /compound/v2/es/f/4?video=tt-gm-es-f4 | ES-F-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/f/4?video=x-gm-es-f4 | ES-F-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/int | Español · Interview | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/live | Español · Live | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/mom | Español · Mom | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/mom/1?video=ig-gl-es-mom1 | ES-MOM-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/es/mom/1?video=li-gl-es-mom1 | ES-MOM-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/es/mom/1?video=tt-gm-es-mom1 | ES-MOM-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/es/mom/1?video=x-gm-es-mom1 | ES-MOM-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/2?video=ig-gl-es-mom2 | ES-MOM-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/2?video=li-gl-es-mom2 | ES-MOM-2 · LI / gl | 152 → 154 | 3 → 2 | live |
| /compound/v2/es/mom/2?video=tt-gm-es-mom2 | ES-MOM-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/2?video=x-gm-es-mom2 | ES-MOM-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/3?video=ig-gl-es-mom3 | ES-MOM-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/3?video=li-gl-es-mom3 | ES-MOM-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/3?video=tt-gm-es-mom3 | ES-MOM-3 · TT / gm | 152 → 154 | 3 → 2 | live |
| /compound/v2/es/mom/3?video=x-gm-es-mom3 | ES-MOM-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/4?video=ig-gl-es-mom4 | ES-MOM-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/4?video=li-gl-es-mom4 | ES-MOM-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/4?video=tt-gm-es-mom4 | ES-MOM-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/es/mom/4?video=x-gm-es-mom4 | ES-MOM-4 · X / gm | 152 → 154 | 3 → 2 | live |
| /compound/v2/es/side | Español · Sidequest | 110 → 112 | 4 → 2 | live |
| /compound/v2/es/startup | Español · Startup | 110 → 112 | 4 → 2 | live |
| /compound/v2/eu | Euskara · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/eu/a | Euskara · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/eu/b | Euskara · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/eu/bjj | Euskara · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/eu/c | Euskara · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/comm | Euskara · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/d | Euskara · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/demo | Euskara · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/e | Euskara · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/f | Euskara · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/int | Euskara · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/live | Euskara · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/mom | Euskara · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/side | Euskara · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/eu/startup | Euskara · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa | فارسی · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/fa/a | فارسی · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/fa/b | فارسی · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/fa/bjj | فارسی · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/fa/c | فارسی · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/comm | فارسی · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/d | فارسی · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/demo | فارسی · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/e | فارسی · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/f | فارسی · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/int | فارسی · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/live | فارسی · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/mom | فارسی · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/side | فارسی · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/fa/startup | فارسی · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/fr | Français · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/fr/a | Français · A | 122 → 127 | 4 → 2 | live |
| /compound/v2/fr/a/2?video=ig-gl-fr-a2 | FR-A-2 · IG / gl | 14 → 19 | 3 → 2 | live |
| /compound/v2/fr/a/2?video=li-gl-fr-a2 | FR-A-2 · LI / gl | 14 → 18 | 3 → 2 | live |
| /compound/v2/fr/a/2?video=tt-gm-fr-a2 | FR-A-2 · TT / gm | 14 → 17 | 3 → 2 | live |
| /compound/v2/fr/a/2?video=x-gm-fr-a2 | FR-A-2 · X / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/a/3?video=ig-gl-fr-a3 | FR-A-3 · IG / gl | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/a/3?video=li-gl-fr-a3 | FR-A-3 · LI / gl | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/a/3?video=tt-gm-fr-a3 | FR-A-3 · TT / gm | 195 → 197 | 3 → 2 | live |
| /compound/v2/fr/a/3?video=x-gm-fr-a3 | FR-A-3 · X / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/a/4?video=ig-gl-fr-a4 | FR-A-4 · IG / gl | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/a/4?video=li-gl-fr-a4 | FR-A-4 · LI / gl | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/a/4?video=tt-gm-fr-a4 | FR-A-4 · TT / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/a/4?video=x-gm-fr-a4 | FR-A-4 · X / gm | 45 → 47 | 3 → 2 | live |
| /compound/v2/fr/b | Français · B | 122 → 126 | 4 → 2 | live |
| /compound/v2/fr/b/1?video=li-gl-fr-b1 | FR-B-1 · LI / gl | 14 → 19 | 3 → 2 | live |
| /compound/v2/fr/b/1?video=tt-gm-fr-b1 | FR-B-1 · TT / gm | 14 → 18 | 3 → 2 | live |
| /compound/v2/fr/b/1?video=x-gm-fr-b1 | FR-B-1 · X / gm | 14 → 17 | 3 → 2 | live |
| /compound/v2/fr/b/2?video=li-gl-fr-b2 | FR-B-2 · LI / gl | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/b/2?video=tt-gm-fr-b2 | FR-B-2 · TT / gm | 91 → 93 | 3 → 2 | live |
| /compound/v2/fr/b/2?video=x-gm-fr-b2 | FR-B-2 · X / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/b/3?video=li-gl-fr-b3 | FR-B-3 · LI / gl | 147 → 149 | 3 → 2 | live |
| /compound/v2/fr/b/3?video=tt-gm-fr-b3 | FR-B-3 · TT / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/b/3?video=x-gm-fr-b3 | FR-B-3 · X / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/b/4?video=li-gl-fr-b4 | FR-B-4 · LI / gl | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/b/4?video=tt-gm-fr-b4 | FR-B-4 · TT / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/b/4?video=x-gm-fr-b4 | FR-B-4 · X / gm | 14 → 16 | 3 → 2 | live |
| /compound/v2/fr/bjj | Français · BJJ | 122 → 125 | 4 → 2 | live |
| /compound/v2/fr/c | Français · C | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/c/1?video=ig-gl-fr-c1 | FR-C-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/fr/c/1?video=li-gl-fr-c1 | FR-C-1 · LI / gl | 48 → 52 | 3 → 2 | live |
| /compound/v2/fr/c/1?video=tt-gm-fr-c1 | FR-C-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/fr/c/1?video=x-gm-fr-c1 | FR-C-1 · X / gm | 158 → 160 | 3 → 2 | live |
| /compound/v2/fr/c/2?video=ig-gl-fr-c2 | FR-C-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/c/2?video=li-gl-fr-c2 | FR-C-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/c/2?video=tt-gm-fr-c2 | FR-C-2 · TT / gm | 158 → 160 | 3 → 2 | live |
| /compound/v2/fr/c/2?video=x-gm-fr-c2 | FR-C-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/c/3?video=ig-gl-fr-c3 | FR-C-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/c/3?video=li-gl-fr-c3 | FR-C-3 · LI / gl | 158 → 160 | 3 → 2 | live |
| /compound/v2/fr/c/3?video=tt-gm-fr-c3 | FR-C-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/c/3?video=x-gm-fr-c3 | FR-C-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/c/4?video=ig-gl-fr-c4 | FR-C-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/c/4?video=li-gl-fr-c4 | FR-C-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/c/4?video=tt-gm-fr-c4 | FR-C-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/c/4?video=x-gm-fr-c4 | FR-C-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/comm | Français · Community | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/comm/1?video=ig-gl-fr-comm1 | FR-COMM-1 · IG / gl | 6 → 11 | 3 → 2 | live |
| /compound/v2/fr/comm/2?video=ig-gl-fr-comm2 | FR-COMM-2 · IG / gl | 6 → 10 | 3 → 2 | live |
| /compound/v2/fr/comm/3?video=ig-gl-fr-comm3 | FR-COMM-3 · IG / gl | 6 → 9 | 3 → 2 | live |
| /compound/v2/fr/comm/4?video=ig-gl-fr-comm4 | FR-COMM-4 · IG / gl | 6 → 8 | 3 → 2 | live |
| /compound/v2/fr/d | Français · D | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/d/1?video=ig-gl-fr-d1 | FR-D-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/fr/d/1?video=li-gl-fr-d1 | FR-D-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/fr/d/1?video=tt-gm-fr-d1 | FR-D-1 · TT / gm | 55 → 57 | 3 → 2 | live |
| /compound/v2/fr/d/1?video=x-gm-fr-d1 | FR-D-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/2?video=ig-gl-fr-d2 | FR-D-2 · IG / gl | 158 → 160 | 3 → 2 | live |
| /compound/v2/fr/d/2?video=li-gl-fr-d2 | FR-D-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/2?video=tt-gm-fr-d2 | FR-D-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/2?video=x-gm-fr-d2 | FR-D-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/3?video=ig-gl-fr-d3 | FR-D-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/3?video=li-gl-fr-d3 | FR-D-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/3?video=tt-gm-fr-d3 | FR-D-3 · TT / gm | 158 → 160 | 3 → 2 | live |
| /compound/v2/fr/d/3?video=x-gm-fr-d3 | FR-D-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/4?video=ig-gl-fr-d4 | FR-D-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/4?video=li-gl-fr-d4 | FR-D-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/4?video=tt-gm-fr-d4 | FR-D-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/d/4?video=x-gm-fr-d4 | FR-D-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/demo | Français · Product demo | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/e | Français · Sidequest | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/e/1?video=ig-gl-fr-e1 | FR-E-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/fr/e/1?video=li-gl-fr-e1 | FR-E-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/fr/e/1?video=tt-gm-fr-e1 | FR-E-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/fr/e/1?video=x-gm-fr-e1 | FR-E-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/e/2?video=ig-gl-fr-e2 | FR-E-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/e/2?video=li-gl-fr-e2 | FR-E-2 · LI / gl | 150 → 152 | 3 → 2 | live |
| /compound/v2/fr/e/2?video=tt-gm-fr-e2 | FR-E-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/e/2?video=x-gm-fr-e2 | FR-E-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/e/3?video=ig-gl-fr-e3 | FR-E-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/e/3?video=li-gl-fr-e3 | FR-E-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/e/3?video=tt-gm-fr-e3 | FR-E-3 · TT / gm | 150 → 152 | 3 → 2 | live |
| /compound/v2/fr/e/3?video=x-gm-fr-e3 | FR-E-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/e/4?video=ig-gl-fr-e4 | FR-E-4 · IG / gl | 150 → 152 | 3 → 2 | live |
| /compound/v2/fr/e/4?video=li-gl-fr-e4 | FR-E-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/e/4?video=tt-gm-fr-e4 | FR-E-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/e/4?video=x-gm-fr-e4 | FR-E-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f | Français · F | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/f/1?video=ig-gl-fr-f1 | FR-F-1 · IG / gl | 21 → 26 | 3 → 2 | live |
| /compound/v2/fr/f/1?video=li-gl-fr-f1 | FR-F-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/fr/f/1?video=tt-gm-fr-f1 | FR-F-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/fr/f/1?video=x-gm-fr-f1 | FR-F-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/2?video=ig-gl-fr-f2 | FR-F-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/2?video=li-gl-fr-f2 | FR-F-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/2?video=tt-gm-fr-f2 | FR-F-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/2?video=x-gm-fr-f2 | FR-F-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/3?video=ig-gl-fr-f3 | FR-F-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/3?video=li-gl-fr-f3 | FR-F-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/3?video=tt-gm-fr-f3 | FR-F-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/3?video=x-gm-fr-f3 | FR-F-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/4?video=ig-gl-fr-f4 | FR-F-4 · IG / gl | 160 → 162 | 3 → 2 | live |
| /compound/v2/fr/f/4?video=li-gl-fr-f4 | FR-F-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/f/4?video=tt-gm-fr-f4 | FR-F-4 · TT / gm | 56 → 58 | 3 → 2 | live |
| /compound/v2/fr/f/4?video=x-gm-fr-f4 | FR-F-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/int | Français · Interview | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/live | Français · Live | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/mom | Français · Mom | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/mom/1?video=ig-gl-fr-mom1 | FR-MOM-1 · IG / gl | 76 → 81 | 3 → 2 | live |
| /compound/v2/fr/mom/1?video=li-gl-fr-mom1 | FR-MOM-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/fr/mom/1?video=tt-gm-fr-mom1 | FR-MOM-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/fr/mom/1?video=x-gm-fr-mom1 | FR-MOM-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/2?video=ig-gl-fr-mom2 | FR-MOM-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/2?video=li-gl-fr-mom2 | FR-MOM-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/2?video=tt-gm-fr-mom2 | FR-MOM-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/2?video=x-gm-fr-mom2 | FR-MOM-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/3?video=ig-gl-fr-mom3 | FR-MOM-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/3?video=li-gl-fr-mom3 | FR-MOM-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/3?video=tt-gm-fr-mom3 | FR-MOM-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/3?video=x-gm-fr-mom3 | FR-MOM-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/4?video=ig-gl-fr-mom4 | FR-MOM-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/4?video=li-gl-fr-mom4 | FR-MOM-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/4?video=tt-gm-fr-mom4 | FR-MOM-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/mom/4?video=x-gm-fr-mom4 | FR-MOM-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/fr/side | Français · Sidequest | 122 → 124 | 4 → 2 | live |
| /compound/v2/fr/startup | Français · Startup | 122 → 124 | 4 → 2 | live |
| /compound/v2/it | Italiano · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/it/a | Italiano · A | 29 → 34 | 4 → 2 | live |
| /compound/v2/it/a/1?video=ig-gl-it-a1 | IT-A-1 · IG / gl | 17 → 22 | 3 → 2 | live |
| /compound/v2/it/a/1?video=li-gl-it-a1 | IT-A-1 · LI / gl | 17 → 21 | 3 → 2 | live |
| /compound/v2/it/a/1?video=x-gm-it-a1 | IT-A-1 · X / gm | 17 → 20 | 3 → 2 | live |
| /compound/v2/it/a/2?video=ig-gl-it-a2 | IT-A-2 · IG / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/2?video=li-gl-it-a2 | IT-A-2 · LI / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/2?video=tt-gm-it-a2 | IT-A-2 · TT / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/2?video=x-gm-it-a2 | IT-A-2 · X / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/3?video=ig-gl-it-a3 | IT-A-3 · IG / gl | 88 → 90 | 3 → 2 | live |
| /compound/v2/it/a/3?video=li-gl-it-a3 | IT-A-3 · LI / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/3?video=tt-gm-it-a3 | IT-A-3 · TT / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/3?video=x-gm-it-a3 | IT-A-3 · X / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/4?video=ig-gl-it-a4 | IT-A-4 · IG / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/4?video=li-gl-it-a4 | IT-A-4 · LI / gl | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/4?video=tt-gm-it-a4 | IT-A-4 · TT / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/a/4?video=x-gm-it-a4 | IT-A-4 · X / gm | 17 → 19 | 3 → 2 | live |
| /compound/v2/it/b | Italiano · B | 29 → 33 | 4 → 2 | live |
| /compound/v2/it/bjj | Italiano · BJJ | 29 → 32 | 4 → 2 | live |
| /compound/v2/it/c | Italiano · C | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/comm | Italiano · Community | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/d | Italiano · D | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/demo | Italiano · Product demo | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/e | Italiano · Sidequest | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/f | Italiano · F | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/int | Italiano · Interview | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/live | Italiano · Live | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/mom | Italiano · Mom | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/side | Italiano · Sidequest | 29 → 31 | 4 → 2 | live |
| /compound/v2/it/startup | Italiano · Startup | 29 → 31 | 4 → 2 | live |
| /compound/v2/ln | Lingála · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/ln/a | Lingála · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/ln/b | Lingála · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/ln/bjj | Lingála · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/ln/c | Lingála · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/comm | Lingála · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/d | Lingála · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/demo | Lingála · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/e | Lingála · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/f | Lingála · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/int | Lingála · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/live | Lingála · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/mom | Lingála · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/side | Lingála · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/ln/startup | Lingála · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/nl | Nederlands · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/nl/a | Nederlands · A | 129 → 134 | 4 → 2 | live |
| /compound/v2/nl/a/1?video=ig-collab-nl-a1 | NL-A-1 · IG / collab | 16 → 21 | 3 → 2 | live |
| /compound/v2/nl/a/1?video=tt-gl-nl-a1 | NL-A-1 · TT / gl | 16 → 20 | 3 → 2 | live |
| /compound/v2/nl/a/2?video=ig-collab-nl-a2 | NL-A-2 · IG / collab | 16 → 19 | 3 → 2 | live |
| /compound/v2/nl/a/2?video=li-gl-nl-a2 | NL-A-2 · LI / gl | 16 → 18 | 3 → 2 | live |
| /compound/v2/nl/a/2?video=tt-gl-nl-a2 | NL-A-2 · TT / gl | 16 → 18 | 3 → 2 | live |
| /compound/v2/nl/a/2?video=x-gm-nl-a2 | NL-A-2 · X / gm | 16 → 18 | 3 → 2 | live |
| /compound/v2/nl/a/3?video=ig-collab-nl-a3 | NL-A-3 · IG / collab | 16 → 18 | 3 → 2 | live |
| /compound/v2/nl/a/3?video=li-gl-nl-a3 | NL-A-3 · LI / gl | 16 → 18 | 3 → 2 | live |
| /compound/v2/nl/a/3?video=tt-gl-nl-a3 | NL-A-3 · TT / gl | 59 → 61 | 3 → 2 | live |
| /compound/v2/nl/a/3?video=x-gm-nl-a3 | NL-A-3 · X / gm | 200 → 202 | 3 → 2 | live |
| /compound/v2/nl/a/4?video=ig-collab-nl-a4 | NL-A-4 · IG / collab | 16 → 18 | 3 → 2 | live |
| /compound/v2/nl/a/4?video=li-gl-nl-a4 | NL-A-4 · LI / gl | 16 → 18 | 3 → 2 | live |
| /compound/v2/nl/a/4?video=tt-gl-nl-a4 | NL-A-4 · TT / gl | 21 → 23 | 3 → 2 | live |
| /compound/v2/nl/a/4?video=x-gm-nl-a4 | NL-A-4 · X / gm | 16 → 18 | 3 → 2 | live |
| /compound/v2/nl/b | Nederlands · B | 129 → 133 | 4 → 2 | live |
| /compound/v2/nl/b/1?video=ig-gl-nl-b1 | NL-B-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/nl/b/1?video=li-gl-nl-b1 | NL-B-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/nl/b/1?video=tt-gm-nl-b1 | NL-B-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/nl/b/1?video=x-gm-nl-b1 | NL-B-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/b/2?video=ig-gl-nl-b2 | NL-B-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/b/2?video=li-gl-nl-b2 | NL-B-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/b/2?video=tt-gm-nl-b2 | NL-B-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/b/2?video=x-gm-nl-b2 | NL-B-2 · X / gm | 150 → 152 | 3 → 2 | live |
| /compound/v2/nl/b/3?video=ig-gl-nl-b3 | NL-B-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/b/3?video=li-gl-nl-b3 | NL-B-3 · LI / gl | 39 → 41 | 3 → 2 | live |
| /compound/v2/nl/b/3?video=tt-gm-nl-b3 | NL-B-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/b/3?video=x-gm-nl-b3 | NL-B-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/b/4?video=ig-gl-nl-b4 | NL-B-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/b/4?video=li-gl-nl-b4 | NL-B-4 · LI / gl | 24 → 26 | 3 → 2 | live |
| /compound/v2/nl/b/4?video=tt-gm-nl-b4 | NL-B-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/b/4?video=x-gm-nl-b4 | NL-B-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/bjj | Nederlands · BJJ | 129 → 132 | 4 → 2 | live |
| /compound/v2/nl/c | Nederlands · C | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/c/1?video=ig-gl-nl-c1 | NL-C-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/nl/c/1?video=li-gl-nl-c1 | NL-C-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/nl/c/1?video=tt-gm-nl-c1 | NL-C-1 · TT / gm | 87 → 90 | 3 → 2 | live |
| /compound/v2/nl/c/1?video=x-gm-nl-c1 | NL-C-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/2?video=ig-gl-nl-c2 | NL-C-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/2?video=li-gl-nl-c2 | NL-C-2 · LI / gl | 165 → 167 | 3 → 2 | live |
| /compound/v2/nl/c/2?video=tt-gm-nl-c2 | NL-C-2 · TT / gm | 165 → 167 | 3 → 2 | live |
| /compound/v2/nl/c/2?video=x-gm-nl-c2 | NL-C-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/3?video=ig-gl-nl-c3 | NL-C-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/3?video=li-gl-nl-c3 | NL-C-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/3?video=tt-gm-nl-c3 | NL-C-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/3?video=x-gm-nl-c3 | NL-C-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/4?video=ig-gl-nl-c4 | NL-C-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/4?video=li-gl-nl-c4 | NL-C-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/4?video=tt-gm-nl-c4 | NL-C-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/c/4?video=x-gm-nl-c4 | NL-C-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/comm | Nederlands · Community | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/d | Nederlands · D | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/d/1?video=ig-gl-nl-d1 | NL-D-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/nl/d/1?video=li-gl-nl-d1 | NL-D-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/nl/d/1?video=tt-gm-nl-d1 | NL-D-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/nl/d/1?video=x-gm-nl-d1 | NL-D-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/2?video=ig-gl-nl-d2 | NL-D-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/2?video=li-gl-nl-d2 | NL-D-2 · LI / gl | 165 → 167 | 3 → 2 | live |
| /compound/v2/nl/d/2?video=tt-gm-nl-d2 | NL-D-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/2?video=x-gm-nl-d2 | NL-D-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/3?video=ig-gl-nl-d3 | NL-D-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/3?video=li-gl-nl-d3 | NL-D-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/3?video=tt-gm-nl-d3 | NL-D-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/3?video=x-gm-nl-d3 | NL-D-3 · X / gm | 165 → 167 | 3 → 2 | live |
| /compound/v2/nl/d/4?video=ig-gl-nl-d4 | NL-D-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/4?video=li-gl-nl-d4 | NL-D-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/4?video=tt-gm-nl-d4 | NL-D-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/d/4?video=x-gm-nl-d4 | NL-D-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/demo | Nederlands · Product demo | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/e | Nederlands · Sidequest | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/e/1?video=ig-gl-nl-e1 | NL-E-1 · IG / gl | 157 → 159 | 3 → 2 | live |
| /compound/v2/nl/e/1?video=li-gl-nl-e1 | NL-E-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/nl/e/1?video=tt-gm-nl-e1 | NL-E-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/nl/e/1?video=x-gm-nl-e1 | NL-E-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/2?video=ig-gl-nl-e2 | NL-E-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/2?video=li-gl-nl-e2 | NL-E-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/2?video=tt-gm-nl-e2 | NL-E-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/2?video=x-gm-nl-e2 | NL-E-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/3?video=ig-gl-nl-e3 | NL-E-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/3?video=li-gl-nl-e3 | NL-E-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/3?video=tt-gm-nl-e3 | NL-E-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/3?video=x-gm-nl-e3 | NL-E-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/4?video=ig-gl-nl-e4 | NL-E-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/4?video=li-gl-nl-e4 | NL-E-4 · LI / gl | 157 → 159 | 3 → 2 | live |
| /compound/v2/nl/e/4?video=tt-gm-nl-e4 | NL-E-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/e/4?video=x-gm-nl-e4 | NL-E-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f | Nederlands · F | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/f/1?video=ig-gl-nl-f1 | NL-F-1 · IG / gl | 18 → 23 | 3 → 2 | live |
| /compound/v2/nl/f/1?video=li-gl-nl-f1 | NL-F-1 · LI / gl | 18 → 22 | 3 → 2 | live |
| /compound/v2/nl/f/1?video=tt-gm-nl-f1 | NL-F-1 · TT / gm | 18 → 21 | 3 → 2 | live |
| /compound/v2/nl/f/1?video=x-gm-nl-f1 | NL-F-1 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/2?video=ig-gl-nl-f2 | NL-F-2 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/2?video=li-gl-nl-f2 | NL-F-2 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/2?video=tt-gm-nl-f2 | NL-F-2 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/2?video=x-gm-nl-f2 | NL-F-2 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/3?video=ig-gl-nl-f3 | NL-F-3 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/3?video=li-gl-nl-f3 | NL-F-3 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/3?video=tt-gm-nl-f3 | NL-F-3 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/3?video=x-gm-nl-f3 | NL-F-3 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/4?video=ig-gl-nl-f4 | NL-F-4 · IG / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/4?video=li-gl-nl-f4 | NL-F-4 · LI / gl | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/4?video=tt-gm-nl-f4 | NL-F-4 · TT / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/f/4?video=x-gm-nl-f4 | NL-F-4 · X / gm | 18 → 20 | 3 → 2 | live |
| /compound/v2/nl/int | Nederlands · Interview | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/live | Nederlands · Live | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/mom | Nederlands · Mom | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/mom/1?video=ig-gl-nl-mom1 | NL-MOM-1 · IG / gl | 44 → 46 | 3 → 2 | live |
| /compound/v2/nl/mom/1?video=li-gl-nl-mom1 | NL-MOM-1 · LI / gl | 23 → 27 | 3 → 2 | live |
| /compound/v2/nl/mom/1?video=tt-gl-nl-mom1 | NL-MOM-1 · TT / gl | 23 → 26 | 3 → 2 | live |
| /compound/v2/nl/mom/1?video=x-gm-nl-mom1 | NL-MOM-1 · X / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/1?video=yt-gm-nl-mom1 | NL-MOM-1 · YT / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/2?video=ig-collab-nl-mom2 | NL-MOM-2 · IG / collab | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/2?video=ig-gl-nl-mom2 | NL-MOM-2 · IG / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/2?video=li-gl-nl-mom2 | NL-MOM-2 · LI / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/2?video=tt-gl-nl-mom2 | NL-MOM-2 · TT / gl | 166 → 168 | 3 → 2 | live |
| /compound/v2/nl/mom/2?video=x-gm-nl-mom2 | NL-MOM-2 · X / gm | 166 → 168 | 3 → 2 | live |
| /compound/v2/nl/mom/3?video=ig-gl-nl-mom3 | NL-MOM-3 · IG / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/3?video=li-gl-nl-mom3 | NL-MOM-3 · LI / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/3?video=tt-gl-nl-mom3 | NL-MOM-3 · TT / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/3?video=x-gm-nl-mom3 | NL-MOM-3 · X / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/4?video=ig-gl-nl-mom4 | NL-MOM-4 · IG / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/4?video=li-gl-nl-mom4 | NL-MOM-4 · LI / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/4?video=tt-gl-nl-mom4 | NL-MOM-4 · TT / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/4?video=x-gm-nl-mom4 | NL-MOM-4 · X / gm | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/5?video=tt-gl-nl-mom5 | NL-MOM-5 · TT / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/6?video=tt-gl-nl-mom6 | NL-MOM-6 · TT / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/mom/7?video=tt-gl-nl-mom7 | NL-MOM-7 · TT / gl | 23 → 25 | 3 → 2 | live |
| /compound/v2/nl/side | Nederlands · Sidequest | 129 → 131 | 4 → 2 | live |
| /compound/v2/nl/startup | Nederlands · Startup | 129 → 131 | 4 → 2 | live |
| /compound/v2/pl | Polski · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/pl/a | Polski · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/pl/b | Polski · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/pl/bjj | Polski · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/pl/c | Polski · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/comm | Polski · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/d | Polski · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/demo | Polski · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/e | Polski · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/f | Polski · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/int | Polski · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/live | Polski · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/mom | Polski · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/side | Polski · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/pl/startup | Polski · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/pt | Português · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/pt/a | Português · A | 31 → 36 | 4 → 2 | live |
| /compound/v2/pt/a/2?video=ig-gl-pt-a2 | PT-A-2 · IG / gl | 19 → 24 | 3 → 2 | live |
| /compound/v2/pt/a/2?video=li-gl-pt-a2 | PT-A-2 · LI / gl | 19 → 23 | 3 → 2 | live |
| /compound/v2/pt/a/2?video=x-gm-pt-a2 | PT-A-2 · X / gm | 19 → 22 | 3 → 2 | live |
| /compound/v2/pt/a/3?video=ig-gl-pt-a3 | PT-A-3 · IG / gl | 19 → 21 | 3 → 2 | live |
| /compound/v2/pt/a/3?video=li-gl-pt-a3 | PT-A-3 · LI / gl | 19 → 21 | 3 → 2 | live |
| /compound/v2/pt/a/3?video=x-gm-pt-a3 | PT-A-3 · X / gm | 19 → 21 | 3 → 2 | live |
| /compound/v2/pt/a/4?video=ig-gl-pt-a4 | PT-A-4 · IG / gl | 19 → 21 | 3 → 2 | live |
| /compound/v2/pt/a/4?video=li-gl-pt-a4 | PT-A-4 · LI / gl | 19 → 21 | 3 → 2 | live |
| /compound/v2/pt/a/4?video=x-gm-pt-a4 | PT-A-4 · X / gm | 19 → 21 | 3 → 2 | live |
| /compound/v2/pt/b | Português · B | 31 → 35 | 4 → 2 | live |
| /compound/v2/pt/bjj | Português · BJJ | 31 → 34 | 4 → 2 | live |
| /compound/v2/pt/bjj/1?video=tt-bjj-pt-bjj1 | PT-BJJ-1 · TT / bjj | 10 → 15 | 3 → 2 | live |
| /compound/v2/pt/bjj/2?video=tt-bjj-pt-bjj2 | PT-BJJ-2 · TT / bjj | 10 → 14 | 3 → 2 | live |
| /compound/v2/pt/bjj/3?video=tt-bjj-pt-bjj3 | PT-BJJ-3 · TT / bjj | 10 → 13 | 3 → 2 | live |
| /compound/v2/pt/bjj/4?video=tt-bjj-pt-bjj4 | PT-BJJ-4 · TT / bjj | 10 → 12 | 3 → 2 | live |
| /compound/v2/pt/bjj/4?video=x-gm-pt-bjj4 | PT-BJJ-4 · X / gm | 10 → 12 | 3 → 2 | live |
| /compound/v2/pt/bjj/5?video=tt-bjj-pt-bjj5 | PT-BJJ-5 · TT / bjj | 10 → 12 | 3 → 2 | live |
| /compound/v2/pt/bjj/6?video=tt-bjj-pt-bjj6 | PT-BJJ-6 · TT / bjj | 19 → 21 | 3 → 2 | live |
| /compound/v2/pt/bjj/7?video=tt-bjj-pt-bjj7 | PT-BJJ-7 · TT / bjj | 10 → 12 | 3 → 2 | live |
| /compound/v2/pt/c | Português · C | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/comm | Português · Community | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/d | Português · D | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/demo | Português · Product demo | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/e | Português · Sidequest | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/f | Português · F | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/int | Português · Interview | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/live | Português · Live | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/mom | Português · Mom | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/side | Português · Sidequest | 31 → 33 | 4 → 2 | live |
| /compound/v2/pt/startup | Português · Startup | 31 → 33 | 4 → 2 | live |
| /compound/v2/qu | Runasimi · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/qu/a | Runasimi · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/qu/b | Runasimi · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/qu/bjj | Runasimi · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/qu/c | Runasimi · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/comm | Runasimi · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/d | Runasimi · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/demo | Runasimi · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/e | Runasimi · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/f | Runasimi · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/int | Runasimi · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/live | Runasimi · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/mom | Runasimi · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/side | Runasimi · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/qu/startup | Runasimi · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/ru | Русский · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/ru/a | Русский · A | 15 → 20 | 4 → 2 | live |
| /compound/v2/ru/a/1?video=tt-gm-ru-a1 | RU-A-1 · TT / gm | 3 → 8 | 3 → 2 | live |
| /compound/v2/ru/b | Русский · B | 15 → 19 | 4 → 2 | live |
| /compound/v2/ru/bjj | Русский · BJJ | 15 → 18 | 4 → 2 | live |
| /compound/v2/ru/c | Русский · C | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/comm | Русский · Community | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/d | Русский · D | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/demo | Русский · Product demo | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/e | Русский · Sidequest | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/f | Русский · F | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/int | Русский · Interview | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/live | Русский · Live | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/mom | Русский · Mom | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/side | Русский · Sidequest | 15 → 17 | 4 → 2 | live |
| /compound/v2/ru/startup | Русский · Startup | 15 → 17 | 4 → 2 | live |
| /compound/v2/tl | Filipino · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/tl/a | Filipino · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/tl/b | Filipino · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/tl/bjj | Filipino · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/tl/c | Filipino · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/comm | Filipino · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/d | Filipino · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/demo | Filipino · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/e | Filipino · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/f | Filipino · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/int | Filipino · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/live | Filipino · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/mom | Filipino · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/side | Filipino · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/tl/startup | Filipino · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr | Türkçe · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/tr/a | Türkçe · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/tr/b | Türkçe · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/tr/bjj | Türkçe · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/tr/c | Türkçe · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/comm | Türkçe · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/d | Türkçe · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/demo | Türkçe · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/e | Türkçe · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/f | Türkçe · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/int | Türkçe · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/live | Türkçe · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/mom | Türkçe · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/side | Türkçe · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/tr/startup | Türkçe · Startup | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh | 中文 · vote the next cut | 802 → 804 | 3 → 2 | live |
| /compound/v2/zh/a | 中文 · A | 14 → 19 | 4 → 2 | live |
| /compound/v2/zh/b | 中文 · B | 14 → 18 | 4 → 2 | live |
| /compound/v2/zh/bjj | 中文 · BJJ | 14 → 17 | 4 → 2 | live |
| /compound/v2/zh/c | 中文 · C | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/comm | 中文 · Community | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/d | 中文 · D | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/demo | 中文 · Product demo | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/e | 中文 · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/f | 中文 · F | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/int | 中文 · Interview | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/live | 中文 · Live | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/mom | 中文 · Mom | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/side | 中文 · Sidequest | 14 → 16 | 4 → 2 | live |
| /compound/v2/zh/startup | 中文 · Startup | 14 → 16 | 4 → 2 | live |
| /cv | the CV | 4 → 20 | 2 → 2 | live |
| /daily | daily | 874 → 874 | 1 → 1 | live |
| /dinner | dinner in SF | 2 → 24 | 2 → 2 | live |
| /friends/cardneto | Cardneto | 870 → 871 | 1 → 1 | live |
| /gabe | gabe | 874 → 874 | 1 → 1 | live |
| /gabinho-rolls | roll or surf | 3 → 10 | 2 → 2 | live |
| /games | play today | 11 → 25 | 2 → 2 | live |
| /games/hub | the arcade | 6 → 19 | 2 → 2 | live |
| /hack | hackathons | 6 → 25 | 2 → 2 | live |
| /hack/1 | 01 / HackTheFeed | 9 → 13 | 2 → 2 | live |
| /hack/1/the-feed | try HackTheFeed | 2 → 25 | 2 → 1 | live |
| /hack/2 | 02 / OSSMAN | 5 → 16 | 2 → 2 | live |
| /hack/3 | 03 / robotics | 820 → 821 | 2 → 2 | live |
| /hack/play | OSSMAN | 8 → 18 | 2 → 2 | live |
| /hack/play/do-bronx | OSSMAN · do-Bronx edition | 0 → 17 | — → 2 | live |
| /hack/the-feed | HackTheFeed · original demo door | 1 → 25 | 2 → 1 | redirect → /hack/1/the-feed |
| /hackathons | the squads | 5 → 15 | 2 → 2 | live |
| /hackthefeed | the original hackathon log | 3 → 16 | 2 → 2 | live |
| /hackthefeed/2 | Hack #2 · original countdown | 2 → 13 | 2 → 2 | live |
| /join-the-army-now | the army is recruiting. | 874 → 874 | 1 → 1 | redirect → /legion |
| /languages | pick the next language | 23 → 38 | 2 → 1 | live |
| /legion | legion | 874 → 874 | 1 → 1 | live |
| /legion/lantern | follow the lantern. | 1 → 16 | 2 → 2 | live |
| /legion/senate | The Senate | — → 19 | — → 2 | live |
| /links/corvus | Corvus links | 2 → 10 | 2 → 2 | live |
| /links/gabe | Gabe’s links | 7 → 16 | 2 → 2 | live |
| /links/pidgy | Pidgy links | 2 → 13 | 2 → 2 | live |
| /live | live | 875 → 875 | 1 → 1 | live |
| /live/overlay | Corvus · live stream overlay | 0 → 22 | — → 2 | live |
| /map | the whole map | 870 → 871 | 1 → 1 | live |
| /music | music | 5 → 15 | 2 → 2 | live |
| /now | right now | 4 → 22 | 2 → 2 | live |
| /people | people | 3 → 10 | 2 → 2 | live |
| /people?id=gabe | Gabe · the full story | 4 → 16 | 2 → 2 | live |
| /plethora | Plethora | 870 → 871 | 1 → 1 | live |
| /plethora/stats | Plethora referrals | 2 → 14 | 2 → 1 | live |
| /privacy | privacy | 870 → 871 | 1 → 1 | live |
| /push | one video. one army. | 1 → 809 | 2 → 1 | live |
| /quests | quests | 874 → 874 | 1 → 1 | live |
| /realm | the old realm | 38 → 44 | 1 → 1 | live |
| /sf | meet in San Francisco | 3 → 14 | 2 → 2 | live |
| /sidequests | the sidequests | 4 → 20 | 2 → 2 | live |
| /soldier/santobjj | santobjj · public soldier profile | 0 → 5 | — → 2 | live |
| /submission | OSSMAN | 0 → 18 | — → 2 | redirect → /hack/play |
| /support | back the people building | 12 → 25 | 2 → 2 | live |
| /support/books | books worth keeping | 2 → 18 | 2 → 2 | live |
| /support/companies | companies worth watching | 2 → 16 | 2 → 2 | live |
| /support/founders | founders worth following | 2 → 20 | 2 → 2 | live |
| /support/people | people worth knowing | 2 → 21 | 2 → 1 | live |
| /support/philosophists | old ideas. new questions. | 3 → 17 | 2 → 2 | live |
| /support/sport-people | people who put in the rounds | 2 → 19 | 2 → 2 | live |
| /wiki | the field notes | 5 → 24 | 2 → 2 | live |
| /wiki/corvus | what is Corvus? | 6 → 17 | 2 → 2 | live |
| /wiki/corvus/namesakes | why the crow? | 2 → 14 | 2 → 2 | live |
| /wiki/pidgy | what is Pidgy? | 6 → 19 | 2 → 2 | live |
| https://stats.corvus.gent/ | the public numbers | 13 → 21 | 2 → 2 | live |
| https://stats.corvus.gent/army | the army, counted | 9 → 28 | 3 → 2 | live |
| https://stats.corvus.gent/coffee | coffee for the army | 10 → 29 | 2 → 2 | live |
| https://stats.corvus.gent/games | the daily games, counted | 10 → 23 | 2 → 2 | live |
| https://stats.corvus.gent/hack | HackTheFeed, counted | 11 → 28 | 2 → 2 | live |
| https://stats.corvus.gent/hunt | curiosity, counted | 10 → 25 | 2 → 2 | live |
| https://stats.corvus.gent/map | where the army is | 10 → 19 | 2 → 2 | live |
| https://stats.corvus.gent/music | the rotation in numbers | 10 → 21 | 2 → 2 | live |
| https://stats.corvus.gent/pidgy | Corvus → Pidgy | 10 → 26 | 2 → 2 | live |
| https://stats.corvus.gent/status | is everything awake? | 10 → 19 | 2 → 2 | live |
| https://stats.corvus.gent/x | the X log | 10 → 17 | 2 → 2 | live |

## Short links, old URLs and redirect inventory

The destinations below are server-observed where available. Tracking and external link responses are checked separately from the public page graph. A 200 client-side short-link shell resolves through the existing go-link script; its allowed internal targets (home, profile, now, sidequests, support, secret and CV) are included in the page table above.

| Route | Kind | HTTP | Destination |
|---|---|---:|---|
| /1000 | redirect | 307 | /compound |
| /bjj | tracked redirect | 302 | /compound?utm_source=instagram&utm_medium=bio&utm_campaign=compound-1000&utm_term=bjj&utm_content=gabinho_bjj |
| /bjj-story | tracked redirect | 302 | /compound?utm_source=instagram&utm_medium=story&utm_campaign=compound-1000&utm_term=bjj-story&utm_content=gabinho_bjj |
| /c/DE-A-1 | vote code | 302 | /compound/v2/de/a?c=DE-A-1&utm_source=code&utm_medium=pinned_comment&utm_content=DE-A-1 |
| /c/DE-A-2 | vote code | 302 | /compound/v2/de/a?c=DE-A-2&utm_source=code&utm_medium=pinned_comment&utm_content=DE-A-2 |
| /c/DE-A-3 | vote code | 302 | /compound/v2/de/a?c=DE-A-3&utm_source=code&utm_medium=pinned_comment&utm_content=DE-A-3 |
| /c/DE-A-4 | vote code | 302 | /compound/v2/de/a?c=DE-A-4&utm_source=code&utm_medium=pinned_comment&utm_content=DE-A-4 |
| /c/EN-A-1 | vote code | 302 | /compound/v2/en/a/1?c=EN-A-1&video=x-gm-en-a1&utm_source=code&utm_medium=pinned_comment&utm_content=x-gm-en-a1 |
| /c/EN-A-2 | vote code | 302 | /compound/v2/en/a?c=EN-A-2&utm_source=code&utm_medium=pinned_comment&utm_content=EN-A-2 |
| /c/EN-A-3 | vote code | 302 | /compound/v2/en/a?c=EN-A-3&utm_source=code&utm_medium=pinned_comment&utm_content=EN-A-3 |
| /c/EN-A-4 | vote code | 302 | /compound/v2/en/a?c=EN-A-4&utm_source=code&utm_medium=pinned_comment&utm_content=EN-A-4 |
| /c/EN-A-5 | vote code | 302 | /compound/v2/en/a/5?c=EN-A-5&video=x-gm-en-a5&utm_source=code&utm_medium=pinned_comment&utm_content=x-gm-en-a5 |
| /c/EN-A-6 | vote code | 302 | /compound/v2/en/a/6?c=EN-A-6&video=x-gm-en-a6&utm_source=code&utm_medium=pinned_comment&utm_content=x-gm-en-a6 |
| /c/EN-B-1 | vote code | 302 | /compound/v2/en/b?c=EN-B-1&utm_source=code&utm_medium=pinned_comment&utm_content=EN-B-1 |
| /c/EN-B-2 | vote code | 302 | /compound/v2/en/b?c=EN-B-2&utm_source=code&utm_medium=pinned_comment&utm_content=EN-B-2 |
| /c/EN-B-3 | vote code | 302 | /compound/v2/en/b?c=EN-B-3&utm_source=code&utm_medium=pinned_comment&utm_content=EN-B-3 |
| /c/EN-B-4 | vote code | 302 | /compound/v2/en/b?c=EN-B-4&utm_source=code&utm_medium=pinned_comment&utm_content=EN-B-4 |
| /c/EN-B-5 | vote code | 302 | /compound/v2/en/b/5?c=EN-B-5&video=tt-gm-en-b5&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gm-en-b5 |
| /c/EN-B-6 | vote code | 302 | /compound/v2/en/b/6?c=EN-B-6&video=tt-gm-en-b6&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gm-en-b6 |
| /c/EN-B-7 | vote code | 302 | /compound/v2/en/b/7?c=EN-B-7&video=tt-gm-en-b7&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gm-en-b7 |
| /c/EN-B-8 | vote code | 302 | /compound/v2/en/b?c=EN-B-8&utm_source=code&utm_medium=pinned_comment&utm_content=EN-B-8 |
| /c/EN-C-1 | vote code | 302 | /compound/v2/en/c?c=EN-C-1&utm_source=code&utm_medium=pinned_comment&utm_content=EN-C-1 |
| /c/EN-C-2 | vote code | 302 | /compound/v2/en/c?c=EN-C-2&utm_source=code&utm_medium=pinned_comment&utm_content=EN-C-2 |
| /c/EN-C-3 | vote code | 302 | /compound/v2/en/c?c=EN-C-3&utm_source=code&utm_medium=pinned_comment&utm_content=EN-C-3 |
| /c/EN-C-4 | vote code | 302 | /compound/v2/en/c?c=EN-C-4&utm_source=code&utm_medium=pinned_comment&utm_content=EN-C-4 |
| /c/EN-COMM-1 | vote code | 302 | /compound/v2/en/comm/1?c=EN-COMM-1&video=tt-bjj-en-comm1&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-en-comm1 |
| /c/EN-COMM-2 | vote code | 302 | /compound/v2/en/comm/2?c=EN-COMM-2&video=tt-bjj-en-comm2&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-en-comm2 |
| /c/EN-COMM-3 | vote code | 302 | /compound/v2/en/comm/3?c=EN-COMM-3&video=tt-bjj-en-comm3&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-en-comm3 |
| /c/EN-COMM-4 | vote code | 302 | /compound/v2/en/comm/4?c=EN-COMM-4&video=tt-bjj-en-comm4&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-en-comm4 |
| /c/EN-D-1 | vote code | 302 | /compound/v2/en/d?c=EN-D-1&utm_source=code&utm_medium=pinned_comment&utm_content=EN-D-1 |
| /c/EN-D-2 | vote code | 302 | /compound/v2/en/d?c=EN-D-2&utm_source=code&utm_medium=pinned_comment&utm_content=EN-D-2 |
| /c/EN-D-3 | vote code | 302 | /compound/v2/en/d?c=EN-D-3&utm_source=code&utm_medium=pinned_comment&utm_content=EN-D-3 |
| /c/EN-D-4 | vote code | 302 | /compound/v2/en/d?c=EN-D-4&utm_source=code&utm_medium=pinned_comment&utm_content=EN-D-4 |
| /c/EN-DEMO-1 | vote code | 302 | /compound/v2/en/demo?c=EN-DEMO-1&utm_source=code&utm_medium=pinned_comment&utm_content=EN-DEMO-1 |
| /c/EN-E-1 | vote code | 302 | /compound/v2/en/e?c=EN-E-1&utm_source=code&utm_medium=pinned_comment&utm_content=EN-E-1 |
| /c/EN-E-2 | vote code | 302 | /compound/v2/en/e?c=EN-E-2&utm_source=code&utm_medium=pinned_comment&utm_content=EN-E-2 |
| /c/EN-E-3 | vote code | 302 | /compound/v2/en/e?c=EN-E-3&utm_source=code&utm_medium=pinned_comment&utm_content=EN-E-3 |
| /c/EN-E-4 | vote code | 302 | /compound/v2/en/e?c=EN-E-4&utm_source=code&utm_medium=pinned_comment&utm_content=EN-E-4 |
| /c/EN-F-1 | vote code | 302 | /compound/v2/en/f?c=EN-F-1&utm_source=code&utm_medium=pinned_comment&utm_content=EN-F-1 |
| /c/EN-F-2 | vote code | 302 | /compound/v2/en/f?c=EN-F-2&utm_source=code&utm_medium=pinned_comment&utm_content=EN-F-2 |
| /c/EN-F-3 | vote code | 302 | /compound/v2/en/f?c=EN-F-3&utm_source=code&utm_medium=pinned_comment&utm_content=EN-F-3 |
| /c/EN-F-4 | vote code | 302 | /compound/v2/en/f?c=EN-F-4&utm_source=code&utm_medium=pinned_comment&utm_content=EN-F-4 |
| /c/EN-F-5 | vote code | 302 | /compound/v2/en/f/5?c=EN-F-5&video=x-gm-en-f5&utm_source=code&utm_medium=pinned_comment&utm_content=x-gm-en-f5 |
| /c/EN-F-6 | vote code | 302 | /compound/v2/en/f/6?c=EN-F-6&video=x-gm-en-f6&utm_source=code&utm_medium=pinned_comment&utm_content=x-gm-en-f6 |
| /c/EN-LIVE-1 | vote code | 302 | /compound/v2/en/live?c=EN-LIVE-1&utm_source=code&utm_medium=pinned_comment&utm_content=EN-LIVE-1 |
| /c/EN-MOM-1 | vote code | 302 | /compound/v2/en/mom?c=EN-MOM-1&utm_source=code&utm_medium=pinned_comment&utm_content=EN-MOM-1 |
| /c/EN-MOM-2 | vote code | 302 | /compound/v2/en/mom?c=EN-MOM-2&utm_source=code&utm_medium=pinned_comment&utm_content=EN-MOM-2 |
| /c/EN-MOM-3 | vote code | 302 | /compound/v2/en/mom?c=EN-MOM-3&utm_source=code&utm_medium=pinned_comment&utm_content=EN-MOM-3 |
| /c/EN-MOM-4 | vote code | 302 | /compound/v2/en/mom?c=EN-MOM-4&utm_source=code&utm_medium=pinned_comment&utm_content=EN-MOM-4 |
| /c/EN-STARTUP-1 | vote code | 302 | /compound/v2/en/startup?c=EN-STARTUP-1&utm_source=code&utm_medium=pinned_comment&utm_content=EN-STARTUP-1 |
| /c/EN-STARTUP-2 | vote code | 302 | /compound/v2/en/startup?c=EN-STARTUP-2&utm_source=code&utm_medium=pinned_comment&utm_content=EN-STARTUP-2 |
| /c/EN-STARTUP-3 | vote code | 302 | /compound/v2/en/startup?c=EN-STARTUP-3&utm_source=code&utm_medium=pinned_comment&utm_content=EN-STARTUP-3 |
| /c/EN-STARTUP-4 | vote code | 302 | /compound/v2/en/startup?c=EN-STARTUP-4&utm_source=code&utm_medium=pinned_comment&utm_content=EN-STARTUP-4 |
| /c/EN-STARTUP-5 | vote code | 302 | /compound/v2/en/startup/5?c=EN-STARTUP-5&video=tt-gm-en-startup5&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gm-en-startup5 |
| /c/EN-STARTUP-6 | vote code | 302 | /compound/v2/en/startup/6?c=EN-STARTUP-6&video=tt-gm-en-startup6&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gm-en-startup6 |
| /c/EN-STARTUP-7 | vote code | 302 | /compound/v2/en/startup/7?c=EN-STARTUP-7&video=tt-gm-en-startup7&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gm-en-startup7 |
| /c/ES-A-1 | vote code | 302 | /compound/v2/es/a?c=ES-A-1&utm_source=code&utm_medium=pinned_comment&utm_content=ES-A-1 |
| /c/ES-A-2 | vote code | 302 | /compound/v2/es/a?c=ES-A-2&utm_source=code&utm_medium=pinned_comment&utm_content=ES-A-2 |
| /c/ES-A-3 | vote code | 302 | /compound/v2/es/a?c=ES-A-3&utm_source=code&utm_medium=pinned_comment&utm_content=ES-A-3 |
| /c/ES-A-4 | vote code | 302 | /compound/v2/es/a?c=ES-A-4&utm_source=code&utm_medium=pinned_comment&utm_content=ES-A-4 |
| /c/ES-C-1 | vote code | 302 | /compound/v2/es/c?c=ES-C-1&utm_source=code&utm_medium=pinned_comment&utm_content=ES-C-1 |
| /c/ES-C-2 | vote code | 302 | /compound/v2/es/c?c=ES-C-2&utm_source=code&utm_medium=pinned_comment&utm_content=ES-C-2 |
| /c/ES-C-3 | vote code | 302 | /compound/v2/es/c?c=ES-C-3&utm_source=code&utm_medium=pinned_comment&utm_content=ES-C-3 |
| /c/ES-C-4 | vote code | 302 | /compound/v2/es/c?c=ES-C-4&utm_source=code&utm_medium=pinned_comment&utm_content=ES-C-4 |
| /c/ES-D-1 | vote code | 302 | /compound/v2/es/d?c=ES-D-1&utm_source=code&utm_medium=pinned_comment&utm_content=ES-D-1 |
| /c/ES-D-2 | vote code | 302 | /compound/v2/es/d?c=ES-D-2&utm_source=code&utm_medium=pinned_comment&utm_content=ES-D-2 |
| /c/ES-D-3 | vote code | 302 | /compound/v2/es/d?c=ES-D-3&utm_source=code&utm_medium=pinned_comment&utm_content=ES-D-3 |
| /c/ES-D-4 | vote code | 302 | /compound/v2/es/d?c=ES-D-4&utm_source=code&utm_medium=pinned_comment&utm_content=ES-D-4 |
| /c/ES-E-1 | vote code | 302 | /compound/v2/es/e?c=ES-E-1&utm_source=code&utm_medium=pinned_comment&utm_content=ES-E-1 |
| /c/ES-E-2 | vote code | 302 | /compound/v2/es/e?c=ES-E-2&utm_source=code&utm_medium=pinned_comment&utm_content=ES-E-2 |
| /c/ES-E-3 | vote code | 302 | /compound/v2/es/e?c=ES-E-3&utm_source=code&utm_medium=pinned_comment&utm_content=ES-E-3 |
| /c/ES-E-4 | vote code | 302 | /compound/v2/es/e?c=ES-E-4&utm_source=code&utm_medium=pinned_comment&utm_content=ES-E-4 |
| /c/ES-F-1 | vote code | 302 | /compound/v2/es/f?c=ES-F-1&utm_source=code&utm_medium=pinned_comment&utm_content=ES-F-1 |
| /c/ES-F-2 | vote code | 302 | /compound/v2/es/f?c=ES-F-2&utm_source=code&utm_medium=pinned_comment&utm_content=ES-F-2 |
| /c/ES-F-3 | vote code | 302 | /compound/v2/es/f?c=ES-F-3&utm_source=code&utm_medium=pinned_comment&utm_content=ES-F-3 |
| /c/ES-F-4 | vote code | 302 | /compound/v2/es/f?c=ES-F-4&utm_source=code&utm_medium=pinned_comment&utm_content=ES-F-4 |
| /c/ES-MOM-1 | vote code | 302 | /compound/v2/es/mom?c=ES-MOM-1&utm_source=code&utm_medium=pinned_comment&utm_content=ES-MOM-1 |
| /c/ES-MOM-2 | vote code | 302 | /compound/v2/es/mom?c=ES-MOM-2&utm_source=code&utm_medium=pinned_comment&utm_content=ES-MOM-2 |
| /c/ES-MOM-3 | vote code | 302 | /compound/v2/es/mom?c=ES-MOM-3&utm_source=code&utm_medium=pinned_comment&utm_content=ES-MOM-3 |
| /c/ES-MOM-4 | vote code | 302 | /compound/v2/es/mom?c=ES-MOM-4&utm_source=code&utm_medium=pinned_comment&utm_content=ES-MOM-4 |
| /c/FR-A-2 | vote code | 302 | /compound/v2/fr/a?c=FR-A-2&utm_source=code&utm_medium=pinned_comment&utm_content=FR-A-2 |
| /c/FR-A-3 | vote code | 302 | /compound/v2/fr/a?c=FR-A-3&utm_source=code&utm_medium=pinned_comment&utm_content=FR-A-3 |
| /c/FR-A-4 | vote code | 302 | /compound/v2/fr/a?c=FR-A-4&utm_source=code&utm_medium=pinned_comment&utm_content=FR-A-4 |
| /c/FR-B-1 | vote code | 302 | /compound/v2/fr/b?c=FR-B-1&utm_source=code&utm_medium=pinned_comment&utm_content=FR-B-1 |
| /c/FR-B-2 | vote code | 302 | /compound/v2/fr/b?c=FR-B-2&utm_source=code&utm_medium=pinned_comment&utm_content=FR-B-2 |
| /c/FR-B-3 | vote code | 302 | /compound/v2/fr/b?c=FR-B-3&utm_source=code&utm_medium=pinned_comment&utm_content=FR-B-3 |
| /c/FR-B-4 | vote code | 302 | /compound/v2/fr/b?c=FR-B-4&utm_source=code&utm_medium=pinned_comment&utm_content=FR-B-4 |
| /c/FR-C-1 | vote code | 302 | /compound/v2/fr/c?c=FR-C-1&utm_source=code&utm_medium=pinned_comment&utm_content=FR-C-1 |
| /c/FR-C-2 | vote code | 302 | /compound/v2/fr/c?c=FR-C-2&utm_source=code&utm_medium=pinned_comment&utm_content=FR-C-2 |
| /c/FR-C-3 | vote code | 302 | /compound/v2/fr/c?c=FR-C-3&utm_source=code&utm_medium=pinned_comment&utm_content=FR-C-3 |
| /c/FR-C-4 | vote code | 302 | /compound/v2/fr/c?c=FR-C-4&utm_source=code&utm_medium=pinned_comment&utm_content=FR-C-4 |
| /c/FR-COMM-1 | vote code | 302 | /compound/v2/fr/comm/1?c=FR-COMM-1&video=ig-gl-fr-comm1&utm_source=code&utm_medium=pinned_comment&utm_content=ig-gl-fr-comm1 |
| /c/FR-COMM-2 | vote code | 302 | /compound/v2/fr/comm/2?c=FR-COMM-2&video=ig-gl-fr-comm2&utm_source=code&utm_medium=pinned_comment&utm_content=ig-gl-fr-comm2 |
| /c/FR-COMM-3 | vote code | 302 | /compound/v2/fr/comm/3?c=FR-COMM-3&video=ig-gl-fr-comm3&utm_source=code&utm_medium=pinned_comment&utm_content=ig-gl-fr-comm3 |
| /c/FR-COMM-4 | vote code | 302 | /compound/v2/fr/comm/4?c=FR-COMM-4&video=ig-gl-fr-comm4&utm_source=code&utm_medium=pinned_comment&utm_content=ig-gl-fr-comm4 |
| /c/FR-D-1 | vote code | 302 | /compound/v2/fr/d?c=FR-D-1&utm_source=code&utm_medium=pinned_comment&utm_content=FR-D-1 |
| /c/FR-D-2 | vote code | 302 | /compound/v2/fr/d?c=FR-D-2&utm_source=code&utm_medium=pinned_comment&utm_content=FR-D-2 |
| /c/FR-D-3 | vote code | 302 | /compound/v2/fr/d?c=FR-D-3&utm_source=code&utm_medium=pinned_comment&utm_content=FR-D-3 |
| /c/FR-D-4 | vote code | 302 | /compound/v2/fr/d?c=FR-D-4&utm_source=code&utm_medium=pinned_comment&utm_content=FR-D-4 |
| /c/FR-E-1 | vote code | 302 | /compound/v2/fr/e?c=FR-E-1&utm_source=code&utm_medium=pinned_comment&utm_content=FR-E-1 |
| /c/FR-E-2 | vote code | 302 | /compound/v2/fr/e?c=FR-E-2&utm_source=code&utm_medium=pinned_comment&utm_content=FR-E-2 |
| /c/FR-E-3 | vote code | 302 | /compound/v2/fr/e?c=FR-E-3&utm_source=code&utm_medium=pinned_comment&utm_content=FR-E-3 |
| /c/FR-E-4 | vote code | 302 | /compound/v2/fr/e?c=FR-E-4&utm_source=code&utm_medium=pinned_comment&utm_content=FR-E-4 |
| /c/FR-F-1 | vote code | 302 | /compound/v2/fr/f?c=FR-F-1&utm_source=code&utm_medium=pinned_comment&utm_content=FR-F-1 |
| /c/FR-F-2 | vote code | 302 | /compound/v2/fr/f?c=FR-F-2&utm_source=code&utm_medium=pinned_comment&utm_content=FR-F-2 |
| /c/FR-F-3 | vote code | 302 | /compound/v2/fr/f?c=FR-F-3&utm_source=code&utm_medium=pinned_comment&utm_content=FR-F-3 |
| /c/FR-F-4 | vote code | 302 | /compound/v2/fr/f?c=FR-F-4&utm_source=code&utm_medium=pinned_comment&utm_content=FR-F-4 |
| /c/FR-MOM-1 | vote code | 302 | /compound/v2/fr/mom?c=FR-MOM-1&utm_source=code&utm_medium=pinned_comment&utm_content=FR-MOM-1 |
| /c/FR-MOM-2 | vote code | 302 | /compound/v2/fr/mom?c=FR-MOM-2&utm_source=code&utm_medium=pinned_comment&utm_content=FR-MOM-2 |
| /c/FR-MOM-3 | vote code | 302 | /compound/v2/fr/mom?c=FR-MOM-3&utm_source=code&utm_medium=pinned_comment&utm_content=FR-MOM-3 |
| /c/FR-MOM-4 | vote code | 302 | /compound/v2/fr/mom?c=FR-MOM-4&utm_source=code&utm_medium=pinned_comment&utm_content=FR-MOM-4 |
| /c/IT-A-1 | vote code | 302 | /compound/v2/it/a?c=IT-A-1&utm_source=code&utm_medium=pinned_comment&utm_content=IT-A-1 |
| /c/IT-A-2 | vote code | 302 | /compound/v2/it/a?c=IT-A-2&utm_source=code&utm_medium=pinned_comment&utm_content=IT-A-2 |
| /c/IT-A-3 | vote code | 302 | /compound/v2/it/a?c=IT-A-3&utm_source=code&utm_medium=pinned_comment&utm_content=IT-A-3 |
| /c/IT-A-4 | vote code | 302 | /compound/v2/it/a?c=IT-A-4&utm_source=code&utm_medium=pinned_comment&utm_content=IT-A-4 |
| /c/NL-A-1 | vote code | 302 | /compound/v2/nl/a?c=NL-A-1&utm_source=code&utm_medium=pinned_comment&utm_content=NL-A-1 |
| /c/NL-A-2 | vote code | 302 | /compound/v2/nl/a?c=NL-A-2&utm_source=code&utm_medium=pinned_comment&utm_content=NL-A-2 |
| /c/NL-A-3 | vote code | 302 | /compound/v2/nl/a?c=NL-A-3&utm_source=code&utm_medium=pinned_comment&utm_content=NL-A-3 |
| /c/NL-A-4 | vote code | 302 | /compound/v2/nl/a?c=NL-A-4&utm_source=code&utm_medium=pinned_comment&utm_content=NL-A-4 |
| /c/NL-B-1 | vote code | 302 | /compound/v2/nl/b?c=NL-B-1&utm_source=code&utm_medium=pinned_comment&utm_content=NL-B-1 |
| /c/NL-B-2 | vote code | 302 | /compound/v2/nl/b?c=NL-B-2&utm_source=code&utm_medium=pinned_comment&utm_content=NL-B-2 |
| /c/NL-B-3 | vote code | 302 | /compound/v2/nl/b?c=NL-B-3&utm_source=code&utm_medium=pinned_comment&utm_content=NL-B-3 |
| /c/NL-B-4 | vote code | 302 | /compound/v2/nl/b?c=NL-B-4&utm_source=code&utm_medium=pinned_comment&utm_content=NL-B-4 |
| /c/NL-C-1 | vote code | 302 | /compound/v2/nl/c?c=NL-C-1&utm_source=code&utm_medium=pinned_comment&utm_content=NL-C-1 |
| /c/NL-C-2 | vote code | 302 | /compound/v2/nl/c?c=NL-C-2&utm_source=code&utm_medium=pinned_comment&utm_content=NL-C-2 |
| /c/NL-C-3 | vote code | 302 | /compound/v2/nl/c?c=NL-C-3&utm_source=code&utm_medium=pinned_comment&utm_content=NL-C-3 |
| /c/NL-C-4 | vote code | 302 | /compound/v2/nl/c?c=NL-C-4&utm_source=code&utm_medium=pinned_comment&utm_content=NL-C-4 |
| /c/NL-D-1 | vote code | 302 | /compound/v2/nl/d?c=NL-D-1&utm_source=code&utm_medium=pinned_comment&utm_content=NL-D-1 |
| /c/NL-D-2 | vote code | 302 | /compound/v2/nl/d?c=NL-D-2&utm_source=code&utm_medium=pinned_comment&utm_content=NL-D-2 |
| /c/NL-D-3 | vote code | 302 | /compound/v2/nl/d?c=NL-D-3&utm_source=code&utm_medium=pinned_comment&utm_content=NL-D-3 |
| /c/NL-D-4 | vote code | 302 | /compound/v2/nl/d?c=NL-D-4&utm_source=code&utm_medium=pinned_comment&utm_content=NL-D-4 |
| /c/NL-E-1 | vote code | 302 | /compound/v2/nl/e?c=NL-E-1&utm_source=code&utm_medium=pinned_comment&utm_content=NL-E-1 |
| /c/NL-E-2 | vote code | 302 | /compound/v2/nl/e?c=NL-E-2&utm_source=code&utm_medium=pinned_comment&utm_content=NL-E-2 |
| /c/NL-E-3 | vote code | 302 | /compound/v2/nl/e?c=NL-E-3&utm_source=code&utm_medium=pinned_comment&utm_content=NL-E-3 |
| /c/NL-E-4 | vote code | 302 | /compound/v2/nl/e?c=NL-E-4&utm_source=code&utm_medium=pinned_comment&utm_content=NL-E-4 |
| /c/NL-F-1 | vote code | 302 | /compound/v2/nl/f?c=NL-F-1&utm_source=code&utm_medium=pinned_comment&utm_content=NL-F-1 |
| /c/NL-F-2 | vote code | 302 | /compound/v2/nl/f?c=NL-F-2&utm_source=code&utm_medium=pinned_comment&utm_content=NL-F-2 |
| /c/NL-F-3 | vote code | 302 | /compound/v2/nl/f?c=NL-F-3&utm_source=code&utm_medium=pinned_comment&utm_content=NL-F-3 |
| /c/NL-F-4 | vote code | 302 | /compound/v2/nl/f?c=NL-F-4&utm_source=code&utm_medium=pinned_comment&utm_content=NL-F-4 |
| /c/NL-MOM-1 | vote code | 302 | /compound/v2/nl/mom?c=NL-MOM-1&utm_source=code&utm_medium=pinned_comment&utm_content=NL-MOM-1 |
| /c/NL-MOM-2 | vote code | 302 | /compound/v2/nl/mom?c=NL-MOM-2&utm_source=code&utm_medium=pinned_comment&utm_content=NL-MOM-2 |
| /c/NL-MOM-3 | vote code | 302 | /compound/v2/nl/mom?c=NL-MOM-3&utm_source=code&utm_medium=pinned_comment&utm_content=NL-MOM-3 |
| /c/NL-MOM-4 | vote code | 302 | /compound/v2/nl/mom?c=NL-MOM-4&utm_source=code&utm_medium=pinned_comment&utm_content=NL-MOM-4 |
| /c/NL-MOM-5 | vote code | 302 | /compound/v2/nl/mom/5?c=NL-MOM-5&video=tt-gl-nl-mom5&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gl-nl-mom5 |
| /c/NL-MOM-6 | vote code | 302 | /compound/v2/nl/mom/6?c=NL-MOM-6&video=tt-gl-nl-mom6&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gl-nl-mom6 |
| /c/NL-MOM-7 | vote code | 302 | /compound/v2/nl/mom/7?c=NL-MOM-7&video=tt-gl-nl-mom7&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gl-nl-mom7 |
| /c/PT-A-2 | vote code | 302 | /compound/v2/pt/a?c=PT-A-2&utm_source=code&utm_medium=pinned_comment&utm_content=PT-A-2 |
| /c/PT-A-3 | vote code | 302 | /compound/v2/pt/a?c=PT-A-3&utm_source=code&utm_medium=pinned_comment&utm_content=PT-A-3 |
| /c/PT-A-4 | vote code | 302 | /compound/v2/pt/a?c=PT-A-4&utm_source=code&utm_medium=pinned_comment&utm_content=PT-A-4 |
| /c/PT-BJJ-1 | vote code | 302 | /compound/v2/pt/bjj/1?c=PT-BJJ-1&video=tt-bjj-pt-bjj1&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-pt-bjj1 |
| /c/PT-BJJ-2 | vote code | 302 | /compound/v2/pt/bjj/2?c=PT-BJJ-2&video=tt-bjj-pt-bjj2&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-pt-bjj2 |
| /c/PT-BJJ-3 | vote code | 302 | /compound/v2/pt/bjj/3?c=PT-BJJ-3&video=tt-bjj-pt-bjj3&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-pt-bjj3 |
| /c/PT-BJJ-4 | vote code | 302 | /compound/v2/pt/bjj?c=PT-BJJ-4&utm_source=code&utm_medium=pinned_comment&utm_content=PT-BJJ-4 |
| /c/PT-BJJ-5 | vote code | 302 | /compound/v2/pt/bjj/5?c=PT-BJJ-5&video=tt-bjj-pt-bjj5&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-pt-bjj5 |
| /c/PT-BJJ-6 | vote code | 302 | /compound/v2/pt/bjj/6?c=PT-BJJ-6&video=tt-bjj-pt-bjj6&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-pt-bjj6 |
| /c/PT-BJJ-7 | vote code | 302 | /compound/v2/pt/bjj/7?c=PT-BJJ-7&video=tt-bjj-pt-bjj7&utm_source=code&utm_medium=pinned_comment&utm_content=tt-bjj-pt-bjj7 |
| /c/RU-A-1 | vote code | 302 | /compound/v2/ru/a/1?c=RU-A-1&video=tt-gm-ru-a1&utm_source=code&utm_medium=pinned_comment&utm_content=tt-gm-ru-a1 |
| /cv/gabriel.pdf | redirect | 308 | /cv |
| /dc | tracked redirect | 302 | /compound?utm_source=discord&utm_medium=community&utm_campaign=compound-1000&utm_term=dc |
| /dm | tracked redirect | 302 | /compound?utm_source=dm&utm_medium=direct&utm_campaign=compound-1000&utm_term=dm |
| /gabriel | redirect | 308 | /people/?id=gabe |
| /go/bio-ig | tracked redirect | 302 | /battle?utm_source=instagram&utm_medium=video&utm_campaign=battle&utm_content=bio |
| /go/bio-li | tracked redirect | 302 | /battle?utm_source=linkedin&utm_medium=video&utm_campaign=battle&utm_content=bio |
| /go/bio-tt | tracked redirect | 302 | /battle?utm_source=tiktok&utm_medium=video&utm_campaign=battle&utm_content=bio |
| /go/bio-x | tracked redirect | 302 | /battle?utm_source=x&utm_medium=video&utm_campaign=battle&utm_content=bio |
| /go/bmc-li | tracked redirect | 302 | https://buymeacoffee.com/gabe.maxxing?utm_source=linkedin&utm_medium=social&utm_campaign=diogenes |
| /go/bmc-x | tracked redirect | 302 | https://buymeacoffee.com/gabe.maxxing?utm_source=x&utm_medium=social&utm_campaign=diogenes |
| /go/call-li | tracked redirect | 302 | /call/?utm_source=linkedin&utm_medium=social&utm_campaign=diogenes |
| /go/call-x | tracked redirect | 302 | /call/?utm_source=x&utm_medium=social&utm_campaign=diogenes |
| /go/cardneto-app | tracked redirect | 302 | https://cardneto.com/en/download |
| /go/cardneto-demo | tracked redirect | 302 | https://cardneto.com/en |
| /go/cardneto-egg | tracked redirect | 302 | /friends/cardneto/?found=card |
| /go/cardneto-li | tracked redirect | 302 | https://www.linkedin.com/in/dorian-lesnic/ |
| /go/compound-footer | tracked redirect | 302 | https://compound.mov/ |
| /go/compound-gabinho-rolls | tracked redirect | 302 | https://compound.mov/ |
| /go/compound-impact | tracked redirect | 302 | https://compound.mov/ |
| /go/compound-impact-source | tracked redirect | 302 | https://compound.mov/ |
| /go/compound-original | tracked redirect | 302 | https://compound.mov/ |
| /go/compound-support | tracked redirect | 302 | https://compound.mov/ |
| /go/cp-ig | tracked redirect | 302 | /battle?utm_source=instagram&utm_medium=video&utm_campaign=battle&utm_content=compound |
| /go/cp-li | tracked redirect | 302 | /battle?utm_source=linkedin&utm_medium=video&utm_campaign=battle&utm_content=compound |
| /go/cp-tt | tracked redirect | 302 | /battle?utm_source=tiktok&utm_medium=video&utm_campaign=battle&utm_content=compound |
| /go/cp-x | tracked redirect | 302 | /battle?utm_source=x&utm_medium=video&utm_campaign=battle&utm_content=compound |
| /go/cx-ig | tracked redirect | 302 | /battle?utm_source=instagram&utm_medium=video&utm_campaign=battle&utm_content=codex |
| /go/cx-li | tracked redirect | 302 | /battle?utm_source=linkedin&utm_medium=video&utm_campaign=battle&utm_content=codex |
| /go/cx-tt | tracked redirect | 302 | /battle?utm_source=tiktok&utm_medium=video&utm_campaign=battle&utm_content=codex |
| /go/cx-x | tracked redirect | 302 | /battle?utm_source=x&utm_medium=video&utm_campaign=battle&utm_content=codex |
| /go/dinner-li | tracked redirect | 302 | /dinner/?utm_source=linkedin&utm_medium=social&utm_campaign=diogenes |
| /go/dinner-x | tracked redirect | 302 | /dinner/?utm_source=x&utm_medium=social&utm_campaign=diogenes |
| /go/instagram | tracked redirect | 302 | https://www.instagram.com/gabe.maxxing |
| /go/plethora-404 | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=404 |
| /go/plethora-babel | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=babel |
| /go/plethora-bangle | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=bangle |
| /go/plethora-battle | tracked redirect | 302 | https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=battle |
| /go/plethora-bio | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=bio-x |
| /go/plethora-bio-ig | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=bio-ig |
| /go/plethora-bio-tt | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=bio-tt |
| /go/plethora-bio-x | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=bio-x |
| /go/plethora-borders | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=borders |
| /go/plethora-celtix | tracked redirect | 302 | https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=celtix |
| /go/plethora-combo | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=combo |
| /go/plethora-compound | tracked redirect | 302 | https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=compound |
| /go/plethora-daily | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=daily |
| /go/plethora-flags | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=flags |
| /go/plethora-footer | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=footer |
| /go/plethora-game | tracked redirect | 302 | https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=game |
| /go/plethora-gameover | tracked redirect | 302 | https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=gameover |
| /go/plethora-hack | tracked redirect | 302 | https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=hack |
| /go/plethora-home | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=home |
| /go/plethora-hub | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=hub |
| /go/plethora-ig | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=ig |
| /go/plethora-lantern | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=lantern |
| /go/plethora-legion | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=legion |
| /go/plethora-li | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=li |
| /go/plethora-pause | tracked redirect | 302 | https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=pause |
| /go/plethora-pingle | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=pingle |
| /go/plethora-promo | tracked redirect | 302 | https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=promo |
| /go/plethora-qr | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=qr |
| /go/plethora-share | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=share |
| /go/plethora-start | tracked redirect | 302 | https://share.plethora.studio/retro/ossman?code=GABE&utm_medium=corvus&utm_content=start |
| /go/plethora-story | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=story |
| /go/plethora-tt | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=tt |
| /go/plethora-twitch | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=twitch |
| /go/plethora-wa | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=wa |
| /go/plethora-wordle | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=wordle |
| /go/plethora-x | tracked redirect | 302 | https://plethora.studio/download?utm_source=gabe&utm_medium=corvus&utm_content=x |
| /go/roll-li | tracked redirect | 302 | /gabinho-rolls/?utm_source=linkedin&utm_medium=social&utm_campaign=diogenes&from=support |
| /go/roll-x | tracked redirect | 302 | /gabinho-rolls/?utm_source=x&utm_medium=social&utm_campaign=diogenes&from=support |
| /go/twitch | tracked redirect | 302 | https://www.twitch.tv/gabe_maxxing |
| /go/twitter | tracked redirect | 302 | https://x.com/gabe_maxxing |
| /hack/the-feed?utm_source=audit | canonical redirect | 301 | https://corvus.gent/hack/1/the-feed?utm_source=audit |
| /hack2?utm_source=audit | canonical redirect | 301 | https://corvus.gent/hack/2?utm_source=audit |
| /hostel | tracked redirect | 302 | /compound?utm_source=hostel&utm_medium=fundraiser&utm_campaign=compound-1000&utm_term=hostel |
| /ig | tracked redirect | 302 | /compound?utm_source=instagram&utm_medium=bio&utm_campaign=compound-1000&utm_term=ig&utm_content=gabe.maxxing |
| /ig-story | tracked redirect | 302 | /compound?utm_source=instagram&utm_medium=story&utm_campaign=compound-1000&utm_term=ig-story&utm_content=gabe.maxxing |
| /join-the-army-now?utm_source=audit | canonical redirect | 301 | https://corvus.gent/legion/?utm_source=audit |
| /li | tracked redirect | 302 | /compound?utm_source=linkedin&utm_medium=social&utm_campaign=compound-1000&utm_term=li |
| /li-1 | tracked redirect | 302 | /compound?utm_source=linkedin&utm_medium=post&utm_campaign=compound-1000&utm_term=li-1&utm_content=post-1 |
| /li-2 | tracked redirect | 302 | /compound?utm_source=linkedin&utm_medium=post&utm_campaign=compound-1000&utm_term=li-2&utm_content=post-2 |
| /links | redirect | 307 | /links/gabe |
| /livenow | redirect | 307 | /live |
| /livenow/ | redirect | 307 | /live |
| /prize | redirect | 307 | /compound |
| /qr | tracked redirect | 302 | /compound?utm_source=offline&utm_medium=qr&utm_campaign=compound-1000&utm_term=qr |
| /self | redirect | 307 | /?utm_source=self&utm_medium=share&utm_campaign=home-share |
| /simon | tracked redirect | 302 | /compound?utm_source=compound&utm_medium=partner&utm_campaign=compound-1000&utm_term=simon |
| /submission?utm_source=audit | canonical redirect | 301 | https://corvus.gent/hack/play?utm_source=audit |
| /tt | tracked redirect | 302 | /compound?utm_source=tiktok&utm_medium=bio&utm_campaign=compound-1000&utm_term=tt&utm_content=gabe.maxxing |
| /tt-bio | tracked redirect | 302 | /compound?utm_source=tiktok&utm_medium=bio&utm_campaign=compound-1000&utm_term=tt-bio&utm_content=gabe.maxxing |
| /tt-bjj | tracked redirect | 302 | /compound?utm_source=tiktok&utm_medium=bio&utm_campaign=compound-1000&utm_term=tt-bjj&utm_content=gabinho_bjj |
| /tt-g | tracked redirect | 302 | /compound?utm_source=tiktok&utm_medium=bio&utm_campaign=compound-1000&utm_term=tt-g&utm_content=gabriellvl |
| /v | tracked redirect | 302 | /compound?utm_source=video&utm_medium=video&utm_campaign=compound-1000&utm_term=v |
| /v/ig-collab-en-demo1 | short link | 302 | /compound/v2/en/demo/1?video=ig-collab-en-demo1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-en-demo1 |
| /v/ig-collab-en-mom1 | short link | 302 | /compound/v2/en/mom/1?video=ig-collab-en-mom1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-en-mom1 |
| /v/ig-collab-en-mom2 | short link | 302 | /compound/v2/en/mom/2?video=ig-collab-en-mom2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-en-mom2 |
| /v/ig-collab-en-mom3 | short link | 302 | /compound/v2/en/mom/3?video=ig-collab-en-mom3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-en-mom3 |
| /v/ig-collab-en-mom4 | short link | 302 | /compound/v2/en/mom/4?video=ig-collab-en-mom4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-en-mom4 |
| /v/ig-collab-nl-a1 | short link | 302 | /compound/v2/nl/a/1?video=ig-collab-nl-a1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-nl-a1 |
| /v/ig-collab-nl-a2 | short link | 302 | /compound/v2/nl/a/2?video=ig-collab-nl-a2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-nl-a2 |
| /v/ig-collab-nl-a3 | short link | 302 | /compound/v2/nl/a/3?video=ig-collab-nl-a3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-nl-a3 |
| /v/ig-collab-nl-a4 | short link | 302 | /compound/v2/nl/a/4?video=ig-collab-nl-a4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-nl-a4 |
| /v/ig-collab-nl-mom2 | short link | 302 | /compound/v2/nl/mom/2?video=ig-collab-nl-mom2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-collab-nl-mom2 |
| /v/ig-gl-de-a1 | short link | 302 | /compound/v2/de/a/1?video=ig-gl-de-a1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-de-a1 |
| /v/ig-gl-de-a2 | short link | 302 | /compound/v2/de/a/2?video=ig-gl-de-a2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-de-a2 |
| /v/ig-gl-de-a3 | short link | 302 | /compound/v2/de/a/3?video=ig-gl-de-a3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-de-a3 |
| /v/ig-gl-de-a4 | short link | 302 | /compound/v2/de/a/4?video=ig-gl-de-a4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-de-a4 |
| /v/ig-gl-en-a2 | short link | 302 | /compound/v2/en/a/2?video=ig-gl-en-a2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-a2 |
| /v/ig-gl-en-a3 | short link | 302 | /compound/v2/en/a/3?video=ig-gl-en-a3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-a3 |
| /v/ig-gl-en-a4 | short link | 302 | /compound/v2/en/a/4?video=ig-gl-en-a4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-a4 |
| /v/ig-gl-en-b1 | short link | 302 | /compound/v2/en/b/1?video=ig-gl-en-b1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-b1 |
| /v/ig-gl-en-b2 | short link | 302 | /compound/v2/en/b/2?video=ig-gl-en-b2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-b2 |
| /v/ig-gl-en-b3 | short link | 302 | /compound/v2/en/b/3?video=ig-gl-en-b3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-b3 |
| /v/ig-gl-en-b4 | short link | 302 | /compound/v2/en/b/4?video=ig-gl-en-b4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-b4 |
| /v/ig-gl-en-c1 | short link | 302 | /compound/v2/en/c/1?video=ig-gl-en-c1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-c1 |
| /v/ig-gl-en-c2 | short link | 302 | /compound/v2/en/c/2?video=ig-gl-en-c2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-c2 |
| /v/ig-gl-en-c3 | short link | 302 | /compound/v2/en/c/3?video=ig-gl-en-c3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-c3 |
| /v/ig-gl-en-c4 | short link | 302 | /compound/v2/en/c/4?video=ig-gl-en-c4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-c4 |
| /v/ig-gl-en-d1 | short link | 302 | /compound/v2/en/d/1?video=ig-gl-en-d1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-d1 |
| /v/ig-gl-en-d2 | short link | 302 | /compound/v2/en/d/2?video=ig-gl-en-d2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-d2 |
| /v/ig-gl-en-d3 | short link | 302 | /compound/v2/en/d/3?video=ig-gl-en-d3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-d3 |
| /v/ig-gl-en-d4 | short link | 302 | /compound/v2/en/d/4?video=ig-gl-en-d4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-d4 |
| /v/ig-gl-en-e1 | short link | 302 | /compound/v2/en/e/1?video=ig-gl-en-e1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-e1 |
| /v/ig-gl-en-e2 | short link | 302 | /compound/v2/en/e/2?video=ig-gl-en-e2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-e2 |
| /v/ig-gl-en-e3 | short link | 302 | /compound/v2/en/e/3?video=ig-gl-en-e3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-e3 |
| /v/ig-gl-en-e4 | short link | 302 | /compound/v2/en/e/4?video=ig-gl-en-e4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-e4 |
| /v/ig-gl-en-f1 | short link | 302 | /compound/v2/en/f/1?video=ig-gl-en-f1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-f1 |
| /v/ig-gl-en-f2 | short link | 302 | /compound/v2/en/f/2?video=ig-gl-en-f2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-f2 |
| /v/ig-gl-en-f3 | short link | 302 | /compound/v2/en/f/3?video=ig-gl-en-f3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-f3 |
| /v/ig-gl-en-f4 | short link | 302 | /compound/v2/en/f/4?video=ig-gl-en-f4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-f4 |
| /v/ig-gl-en-live1 | short link | 302 | /compound/v2/en/live/1?video=ig-gl-en-live1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-en-live1 |
| /v/ig-gl-es-a1 | short link | 302 | /compound/v2/es/a/1?video=ig-gl-es-a1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-a1 |
| /v/ig-gl-es-a2 | short link | 302 | /compound/v2/es/a/2?video=ig-gl-es-a2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-a2 |
| /v/ig-gl-es-a3 | short link | 302 | /compound/v2/es/a/3?video=ig-gl-es-a3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-a3 |
| /v/ig-gl-es-a4 | short link | 302 | /compound/v2/es/a/4?video=ig-gl-es-a4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-a4 |
| /v/ig-gl-es-c1 | short link | 302 | /compound/v2/es/c/1?video=ig-gl-es-c1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-c1 |
| /v/ig-gl-es-c2 | short link | 302 | /compound/v2/es/c/2?video=ig-gl-es-c2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-c2 |
| /v/ig-gl-es-c3 | short link | 302 | /compound/v2/es/c/3?video=ig-gl-es-c3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-c3 |
| /v/ig-gl-es-c4 | short link | 302 | /compound/v2/es/c/4?video=ig-gl-es-c4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-c4 |
| /v/ig-gl-es-d1 | short link | 302 | /compound/v2/es/d/1?video=ig-gl-es-d1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-d1 |
| /v/ig-gl-es-d2 | short link | 302 | /compound/v2/es/d/2?video=ig-gl-es-d2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-d2 |
| /v/ig-gl-es-d3 | short link | 302 | /compound/v2/es/d/3?video=ig-gl-es-d3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-d3 |
| /v/ig-gl-es-d4 | short link | 302 | /compound/v2/es/d/4?video=ig-gl-es-d4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-d4 |
| /v/ig-gl-es-e1 | short link | 302 | /compound/v2/es/e/1?video=ig-gl-es-e1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-e1 |
| /v/ig-gl-es-e2 | short link | 302 | /compound/v2/es/e/2?video=ig-gl-es-e2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-e2 |
| /v/ig-gl-es-e3 | short link | 302 | /compound/v2/es/e/3?video=ig-gl-es-e3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-e3 |
| /v/ig-gl-es-e4 | short link | 302 | /compound/v2/es/e/4?video=ig-gl-es-e4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-e4 |
| /v/ig-gl-es-f1 | short link | 302 | /compound/v2/es/f/1?video=ig-gl-es-f1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-f1 |
| /v/ig-gl-es-f2 | short link | 302 | /compound/v2/es/f/2?video=ig-gl-es-f2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-f2 |
| /v/ig-gl-es-f3 | short link | 302 | /compound/v2/es/f/3?video=ig-gl-es-f3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-f3 |
| /v/ig-gl-es-f4 | short link | 302 | /compound/v2/es/f/4?video=ig-gl-es-f4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-f4 |
| /v/ig-gl-es-mom1 | short link | 302 | /compound/v2/es/mom/1?video=ig-gl-es-mom1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-mom1 |
| /v/ig-gl-es-mom2 | short link | 302 | /compound/v2/es/mom/2?video=ig-gl-es-mom2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-mom2 |
| /v/ig-gl-es-mom3 | short link | 302 | /compound/v2/es/mom/3?video=ig-gl-es-mom3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-mom3 |
| /v/ig-gl-es-mom4 | short link | 302 | /compound/v2/es/mom/4?video=ig-gl-es-mom4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-es-mom4 |
| /v/ig-gl-fr-a2 | short link | 302 | /compound/v2/fr/a/2?video=ig-gl-fr-a2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-a2 |
| /v/ig-gl-fr-a3 | short link | 302 | /compound/v2/fr/a/3?video=ig-gl-fr-a3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-a3 |
| /v/ig-gl-fr-a4 | short link | 302 | /compound/v2/fr/a/4?video=ig-gl-fr-a4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-a4 |
| /v/ig-gl-fr-c1 | short link | 302 | /compound/v2/fr/c/1?video=ig-gl-fr-c1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-c1 |
| /v/ig-gl-fr-c2 | short link | 302 | /compound/v2/fr/c/2?video=ig-gl-fr-c2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-c2 |
| /v/ig-gl-fr-c3 | short link | 302 | /compound/v2/fr/c/3?video=ig-gl-fr-c3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-c3 |
| /v/ig-gl-fr-c4 | short link | 302 | /compound/v2/fr/c/4?video=ig-gl-fr-c4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-c4 |
| /v/ig-gl-fr-comm1 | short link | 302 | /compound/v2/fr/comm/1?video=ig-gl-fr-comm1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-comm1 |
| /v/ig-gl-fr-comm2 | short link | 302 | /compound/v2/fr/comm/2?video=ig-gl-fr-comm2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-comm2 |
| /v/ig-gl-fr-comm3 | short link | 302 | /compound/v2/fr/comm/3?video=ig-gl-fr-comm3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-comm3 |
| /v/ig-gl-fr-comm4 | short link | 302 | /compound/v2/fr/comm/4?video=ig-gl-fr-comm4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-comm4 |
| /v/ig-gl-fr-d1 | short link | 302 | /compound/v2/fr/d/1?video=ig-gl-fr-d1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-d1 |
| /v/ig-gl-fr-d2 | short link | 302 | /compound/v2/fr/d/2?video=ig-gl-fr-d2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-d2 |
| /v/ig-gl-fr-d3 | short link | 302 | /compound/v2/fr/d/3?video=ig-gl-fr-d3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-d3 |
| /v/ig-gl-fr-d4 | short link | 302 | /compound/v2/fr/d/4?video=ig-gl-fr-d4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-d4 |
| /v/ig-gl-fr-e1 | short link | 302 | /compound/v2/fr/e/1?video=ig-gl-fr-e1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-e1 |
| /v/ig-gl-fr-e2 | short link | 302 | /compound/v2/fr/e/2?video=ig-gl-fr-e2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-e2 |
| /v/ig-gl-fr-e3 | short link | 302 | /compound/v2/fr/e/3?video=ig-gl-fr-e3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-e3 |
| /v/ig-gl-fr-e4 | short link | 302 | /compound/v2/fr/e/4?video=ig-gl-fr-e4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-e4 |
| /v/ig-gl-fr-f1 | short link | 302 | /compound/v2/fr/f/1?video=ig-gl-fr-f1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-f1 |
| /v/ig-gl-fr-f2 | short link | 302 | /compound/v2/fr/f/2?video=ig-gl-fr-f2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-f2 |
| /v/ig-gl-fr-f3 | short link | 302 | /compound/v2/fr/f/3?video=ig-gl-fr-f3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-f3 |
| /v/ig-gl-fr-f4 | short link | 302 | /compound/v2/fr/f/4?video=ig-gl-fr-f4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-f4 |
| /v/ig-gl-fr-mom1 | short link | 302 | /compound/v2/fr/mom/1?video=ig-gl-fr-mom1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-mom1 |
| /v/ig-gl-fr-mom2 | short link | 302 | /compound/v2/fr/mom/2?video=ig-gl-fr-mom2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-mom2 |
| /v/ig-gl-fr-mom3 | short link | 302 | /compound/v2/fr/mom/3?video=ig-gl-fr-mom3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-mom3 |
| /v/ig-gl-fr-mom4 | short link | 302 | /compound/v2/fr/mom/4?video=ig-gl-fr-mom4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-fr-mom4 |
| /v/ig-gl-it-a1 | short link | 302 | /compound/v2/it/a/1?video=ig-gl-it-a1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-it-a1 |
| /v/ig-gl-it-a2 | short link | 302 | /compound/v2/it/a/2?video=ig-gl-it-a2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-it-a2 |
| /v/ig-gl-it-a3 | short link | 302 | /compound/v2/it/a/3?video=ig-gl-it-a3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-it-a3 |
| /v/ig-gl-it-a4 | short link | 302 | /compound/v2/it/a/4?video=ig-gl-it-a4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-it-a4 |
| /v/ig-gl-nl-b1 | short link | 302 | /compound/v2/nl/b/1?video=ig-gl-nl-b1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-b1 |
| /v/ig-gl-nl-b2 | short link | 302 | /compound/v2/nl/b/2?video=ig-gl-nl-b2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-b2 |
| /v/ig-gl-nl-b3 | short link | 302 | /compound/v2/nl/b/3?video=ig-gl-nl-b3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-b3 |
| /v/ig-gl-nl-b4 | short link | 302 | /compound/v2/nl/b/4?video=ig-gl-nl-b4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-b4 |
| /v/ig-gl-nl-c1 | short link | 302 | /compound/v2/nl/c/1?video=ig-gl-nl-c1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-c1 |
| /v/ig-gl-nl-c2 | short link | 302 | /compound/v2/nl/c/2?video=ig-gl-nl-c2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-c2 |
| /v/ig-gl-nl-c3 | short link | 302 | /compound/v2/nl/c/3?video=ig-gl-nl-c3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-c3 |
| /v/ig-gl-nl-c4 | short link | 302 | /compound/v2/nl/c/4?video=ig-gl-nl-c4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-c4 |
| /v/ig-gl-nl-d1 | short link | 302 | /compound/v2/nl/d/1?video=ig-gl-nl-d1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-d1 |
| /v/ig-gl-nl-d2 | short link | 302 | /compound/v2/nl/d/2?video=ig-gl-nl-d2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-d2 |
| /v/ig-gl-nl-d3 | short link | 302 | /compound/v2/nl/d/3?video=ig-gl-nl-d3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-d3 |
| /v/ig-gl-nl-d4 | short link | 302 | /compound/v2/nl/d/4?video=ig-gl-nl-d4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-d4 |
| /v/ig-gl-nl-e1 | short link | 302 | /compound/v2/nl/e/1?video=ig-gl-nl-e1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-e1 |
| /v/ig-gl-nl-e2 | short link | 302 | /compound/v2/nl/e/2?video=ig-gl-nl-e2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-e2 |
| /v/ig-gl-nl-e3 | short link | 302 | /compound/v2/nl/e/3?video=ig-gl-nl-e3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-e3 |
| /v/ig-gl-nl-e4 | short link | 302 | /compound/v2/nl/e/4?video=ig-gl-nl-e4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-e4 |
| /v/ig-gl-nl-f1 | short link | 302 | /compound/v2/nl/f/1?video=ig-gl-nl-f1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-f1 |
| /v/ig-gl-nl-f2 | short link | 302 | /compound/v2/nl/f/2?video=ig-gl-nl-f2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-f2 |
| /v/ig-gl-nl-f3 | short link | 302 | /compound/v2/nl/f/3?video=ig-gl-nl-f3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-f3 |
| /v/ig-gl-nl-f4 | short link | 302 | /compound/v2/nl/f/4?video=ig-gl-nl-f4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-f4 |
| /v/ig-gl-nl-mom1 | short link | 302 | /compound/v2/nl/mom/1?video=ig-gl-nl-mom1&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-mom1 |
| /v/ig-gl-nl-mom2 | short link | 302 | /compound/v2/nl/mom/2?video=ig-gl-nl-mom2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-mom2 |
| /v/ig-gl-nl-mom3 | short link | 302 | /compound/v2/nl/mom/3?video=ig-gl-nl-mom3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-mom3 |
| /v/ig-gl-nl-mom4 | short link | 302 | /compound/v2/nl/mom/4?video=ig-gl-nl-mom4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-nl-mom4 |
| /v/ig-gl-pt-a2 | short link | 302 | /compound/v2/pt/a/2?video=ig-gl-pt-a2&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-pt-a2 |
| /v/ig-gl-pt-a3 | short link | 302 | /compound/v2/pt/a/3?video=ig-gl-pt-a3&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-pt-a3 |
| /v/ig-gl-pt-a4 | short link | 302 | /compound/v2/pt/a/4?video=ig-gl-pt-a4&utm_source=instagram&utm_medium=post&utm_campaign=compound-v2&utm_content=ig-gl-pt-a4 |
| /v/li-gl-de-a1 | short link | 302 | /compound/v2/de/a/1?video=li-gl-de-a1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-de-a1 |
| /v/li-gl-de-a2 | short link | 302 | /compound/v2/de/a/2?video=li-gl-de-a2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-de-a2 |
| /v/li-gl-de-a3 | short link | 302 | /compound/v2/de/a/3?video=li-gl-de-a3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-de-a3 |
| /v/li-gl-de-a4 | short link | 302 | /compound/v2/de/a/4?video=li-gl-de-a4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-de-a4 |
| /v/li-gl-en-a2 | short link | 302 | /compound/v2/en/a/2?video=li-gl-en-a2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-a2 |
| /v/li-gl-en-a3 | short link | 302 | /compound/v2/en/a/3?video=li-gl-en-a3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-a3 |
| /v/li-gl-en-a4 | short link | 302 | /compound/v2/en/a/4?video=li-gl-en-a4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-a4 |
| /v/li-gl-en-b1 | short link | 302 | /compound/v2/en/b/1?video=li-gl-en-b1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-b1 |
| /v/li-gl-en-b2 | short link | 302 | /compound/v2/en/b/2?video=li-gl-en-b2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-b2 |
| /v/li-gl-en-b3 | short link | 302 | /compound/v2/en/b/3?video=li-gl-en-b3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-b3 |
| /v/li-gl-en-b4 | short link | 302 | /compound/v2/en/b/4?video=li-gl-en-b4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-b4 |
| /v/li-gl-en-c1 | short link | 302 | /compound/v2/en/c/1?video=li-gl-en-c1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-c1 |
| /v/li-gl-en-c2 | short link | 302 | /compound/v2/en/c/2?video=li-gl-en-c2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-c2 |
| /v/li-gl-en-c3 | short link | 302 | /compound/v2/en/c/3?video=li-gl-en-c3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-c3 |
| /v/li-gl-en-c4 | short link | 302 | /compound/v2/en/c/4?video=li-gl-en-c4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-c4 |
| /v/li-gl-en-d1 | short link | 302 | /compound/v2/en/d/1?video=li-gl-en-d1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-d1 |
| /v/li-gl-en-d2 | short link | 302 | /compound/v2/en/d/2?video=li-gl-en-d2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-d2 |
| /v/li-gl-en-d3 | short link | 302 | /compound/v2/en/d/3?video=li-gl-en-d3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-d3 |
| /v/li-gl-en-d4 | short link | 302 | /compound/v2/en/d/4?video=li-gl-en-d4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-d4 |
| /v/li-gl-en-demo1 | short link | 302 | /compound/v2/en/demo/1?video=li-gl-en-demo1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-demo1 |
| /v/li-gl-en-f1 | short link | 302 | /compound/v2/en/f/1?video=li-gl-en-f1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-f1 |
| /v/li-gl-en-f2 | short link | 302 | /compound/v2/en/f/2?video=li-gl-en-f2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-f2 |
| /v/li-gl-en-f3 | short link | 302 | /compound/v2/en/f/3?video=li-gl-en-f3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-f3 |
| /v/li-gl-en-f4 | short link | 302 | /compound/v2/en/f/4?video=li-gl-en-f4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-f4 |
| /v/li-gl-en-live1 | short link | 302 | /compound/v2/en/live/1?video=li-gl-en-live1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-live1 |
| /v/li-gl-en-mom1 | short link | 302 | /compound/v2/en/mom/1?video=li-gl-en-mom1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-mom1 |
| /v/li-gl-en-mom2 | short link | 302 | /compound/v2/en/mom/2?video=li-gl-en-mom2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-mom2 |
| /v/li-gl-en-mom3 | short link | 302 | /compound/v2/en/mom/3?video=li-gl-en-mom3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-mom3 |
| /v/li-gl-en-mom4 | short link | 302 | /compound/v2/en/mom/4?video=li-gl-en-mom4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-mom4 |
| /v/li-gl-en-startup1 | short link | 302 | /compound/v2/en/startup/1?video=li-gl-en-startup1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-startup1 |
| /v/li-gl-en-startup2 | short link | 302 | /compound/v2/en/startup/2?video=li-gl-en-startup2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-startup2 |
| /v/li-gl-en-startup3 | short link | 302 | /compound/v2/en/startup/3?video=li-gl-en-startup3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-startup3 |
| /v/li-gl-en-startup4 | short link | 302 | /compound/v2/en/startup/4?video=li-gl-en-startup4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-en-startup4 |
| /v/li-gl-es-a1 | short link | 302 | /compound/v2/es/a/1?video=li-gl-es-a1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-a1 |
| /v/li-gl-es-a2 | short link | 302 | /compound/v2/es/a/2?video=li-gl-es-a2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-a2 |
| /v/li-gl-es-a3 | short link | 302 | /compound/v2/es/a/3?video=li-gl-es-a3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-a3 |
| /v/li-gl-es-a4 | short link | 302 | /compound/v2/es/a/4?video=li-gl-es-a4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-a4 |
| /v/li-gl-es-c1 | short link | 302 | /compound/v2/es/c/1?video=li-gl-es-c1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-c1 |
| /v/li-gl-es-c2 | short link | 302 | /compound/v2/es/c/2?video=li-gl-es-c2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-c2 |
| /v/li-gl-es-c3 | short link | 302 | /compound/v2/es/c/3?video=li-gl-es-c3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-c3 |
| /v/li-gl-es-c4 | short link | 302 | /compound/v2/es/c/4?video=li-gl-es-c4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-c4 |
| /v/li-gl-es-d1 | short link | 302 | /compound/v2/es/d/1?video=li-gl-es-d1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-d1 |
| /v/li-gl-es-d2 | short link | 302 | /compound/v2/es/d/2?video=li-gl-es-d2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-d2 |
| /v/li-gl-es-d3 | short link | 302 | /compound/v2/es/d/3?video=li-gl-es-d3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-d3 |
| /v/li-gl-es-d4 | short link | 302 | /compound/v2/es/d/4?video=li-gl-es-d4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-d4 |
| /v/li-gl-es-e1 | short link | 302 | /compound/v2/es/e/1?video=li-gl-es-e1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-e1 |
| /v/li-gl-es-e2 | short link | 302 | /compound/v2/es/e/2?video=li-gl-es-e2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-e2 |
| /v/li-gl-es-e3 | short link | 302 | /compound/v2/es/e/3?video=li-gl-es-e3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-e3 |
| /v/li-gl-es-e4 | short link | 302 | /compound/v2/es/e/4?video=li-gl-es-e4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-e4 |
| /v/li-gl-es-f1 | short link | 302 | /compound/v2/es/f/1?video=li-gl-es-f1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-f1 |
| /v/li-gl-es-f2 | short link | 302 | /compound/v2/es/f/2?video=li-gl-es-f2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-f2 |
| /v/li-gl-es-f3 | short link | 302 | /compound/v2/es/f/3?video=li-gl-es-f3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-f3 |
| /v/li-gl-es-f4 | short link | 302 | /compound/v2/es/f/4?video=li-gl-es-f4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-f4 |
| /v/li-gl-es-mom1 | short link | 302 | /compound/v2/es/mom/1?video=li-gl-es-mom1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-mom1 |
| /v/li-gl-es-mom2 | short link | 302 | /compound/v2/es/mom/2?video=li-gl-es-mom2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-mom2 |
| /v/li-gl-es-mom3 | short link | 302 | /compound/v2/es/mom/3?video=li-gl-es-mom3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-mom3 |
| /v/li-gl-es-mom4 | short link | 302 | /compound/v2/es/mom/4?video=li-gl-es-mom4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-es-mom4 |
| /v/li-gl-fr-a2 | short link | 302 | /compound/v2/fr/a/2?video=li-gl-fr-a2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-a2 |
| /v/li-gl-fr-a3 | short link | 302 | /compound/v2/fr/a/3?video=li-gl-fr-a3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-a3 |
| /v/li-gl-fr-a4 | short link | 302 | /compound/v2/fr/a/4?video=li-gl-fr-a4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-a4 |
| /v/li-gl-fr-b1 | short link | 302 | /compound/v2/fr/b/1?video=li-gl-fr-b1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-b1 |
| /v/li-gl-fr-b2 | short link | 302 | /compound/v2/fr/b/2?video=li-gl-fr-b2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-b2 |
| /v/li-gl-fr-b3 | short link | 302 | /compound/v2/fr/b/3?video=li-gl-fr-b3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-b3 |
| /v/li-gl-fr-b4 | short link | 302 | /compound/v2/fr/b/4?video=li-gl-fr-b4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-b4 |
| /v/li-gl-fr-c1 | short link | 302 | /compound/v2/fr/c/1?video=li-gl-fr-c1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-c1 |
| /v/li-gl-fr-c2 | short link | 302 | /compound/v2/fr/c/2?video=li-gl-fr-c2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-c2 |
| /v/li-gl-fr-c3 | short link | 302 | /compound/v2/fr/c/3?video=li-gl-fr-c3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-c3 |
| /v/li-gl-fr-c4 | short link | 302 | /compound/v2/fr/c/4?video=li-gl-fr-c4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-c4 |
| /v/li-gl-fr-d1 | short link | 302 | /compound/v2/fr/d/1?video=li-gl-fr-d1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-d1 |
| /v/li-gl-fr-d2 | short link | 302 | /compound/v2/fr/d/2?video=li-gl-fr-d2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-d2 |
| /v/li-gl-fr-d3 | short link | 302 | /compound/v2/fr/d/3?video=li-gl-fr-d3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-d3 |
| /v/li-gl-fr-d4 | short link | 302 | /compound/v2/fr/d/4?video=li-gl-fr-d4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-d4 |
| /v/li-gl-fr-e1 | short link | 302 | /compound/v2/fr/e/1?video=li-gl-fr-e1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-e1 |
| /v/li-gl-fr-e2 | short link | 302 | /compound/v2/fr/e/2?video=li-gl-fr-e2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-e2 |
| /v/li-gl-fr-e3 | short link | 302 | /compound/v2/fr/e/3?video=li-gl-fr-e3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-e3 |
| /v/li-gl-fr-e4 | short link | 302 | /compound/v2/fr/e/4?video=li-gl-fr-e4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-e4 |
| /v/li-gl-fr-f1 | short link | 302 | /compound/v2/fr/f/1?video=li-gl-fr-f1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-f1 |
| /v/li-gl-fr-f2 | short link | 302 | /compound/v2/fr/f/2?video=li-gl-fr-f2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-f2 |
| /v/li-gl-fr-f3 | short link | 302 | /compound/v2/fr/f/3?video=li-gl-fr-f3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-f3 |
| /v/li-gl-fr-f4 | short link | 302 | /compound/v2/fr/f/4?video=li-gl-fr-f4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-f4 |
| /v/li-gl-fr-mom1 | short link | 302 | /compound/v2/fr/mom/1?video=li-gl-fr-mom1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-mom1 |
| /v/li-gl-fr-mom2 | short link | 302 | /compound/v2/fr/mom/2?video=li-gl-fr-mom2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-mom2 |
| /v/li-gl-fr-mom3 | short link | 302 | /compound/v2/fr/mom/3?video=li-gl-fr-mom3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-mom3 |
| /v/li-gl-fr-mom4 | short link | 302 | /compound/v2/fr/mom/4?video=li-gl-fr-mom4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-fr-mom4 |
| /v/li-gl-it-a1 | short link | 302 | /compound/v2/it/a/1?video=li-gl-it-a1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-it-a1 |
| /v/li-gl-it-a2 | short link | 302 | /compound/v2/it/a/2?video=li-gl-it-a2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-it-a2 |
| /v/li-gl-it-a3 | short link | 302 | /compound/v2/it/a/3?video=li-gl-it-a3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-it-a3 |
| /v/li-gl-it-a4 | short link | 302 | /compound/v2/it/a/4?video=li-gl-it-a4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-it-a4 |
| /v/li-gl-nl-a2 | short link | 302 | /compound/v2/nl/a/2?video=li-gl-nl-a2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-a2 |
| /v/li-gl-nl-a3 | short link | 302 | /compound/v2/nl/a/3?video=li-gl-nl-a3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-a3 |
| /v/li-gl-nl-a4 | short link | 302 | /compound/v2/nl/a/4?video=li-gl-nl-a4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-a4 |
| /v/li-gl-nl-b1 | short link | 302 | /compound/v2/nl/b/1?video=li-gl-nl-b1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-b1 |
| /v/li-gl-nl-b2 | short link | 302 | /compound/v2/nl/b/2?video=li-gl-nl-b2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-b2 |
| /v/li-gl-nl-b3 | short link | 302 | /compound/v2/nl/b/3?video=li-gl-nl-b3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-b3 |
| /v/li-gl-nl-b4 | short link | 302 | /compound/v2/nl/b/4?video=li-gl-nl-b4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-b4 |
| /v/li-gl-nl-c1 | short link | 302 | /compound/v2/nl/c/1?video=li-gl-nl-c1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-c1 |
| /v/li-gl-nl-c2 | short link | 302 | /compound/v2/nl/c/2?video=li-gl-nl-c2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-c2 |
| /v/li-gl-nl-c3 | short link | 302 | /compound/v2/nl/c/3?video=li-gl-nl-c3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-c3 |
| /v/li-gl-nl-c4 | short link | 302 | /compound/v2/nl/c/4?video=li-gl-nl-c4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-c4 |
| /v/li-gl-nl-d1 | short link | 302 | /compound/v2/nl/d/1?video=li-gl-nl-d1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-d1 |
| /v/li-gl-nl-d2 | short link | 302 | /compound/v2/nl/d/2?video=li-gl-nl-d2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-d2 |
| /v/li-gl-nl-d3 | short link | 302 | /compound/v2/nl/d/3?video=li-gl-nl-d3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-d3 |
| /v/li-gl-nl-d4 | short link | 302 | /compound/v2/nl/d/4?video=li-gl-nl-d4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-d4 |
| /v/li-gl-nl-e1 | short link | 302 | /compound/v2/nl/e/1?video=li-gl-nl-e1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-e1 |
| /v/li-gl-nl-e2 | short link | 302 | /compound/v2/nl/e/2?video=li-gl-nl-e2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-e2 |
| /v/li-gl-nl-e3 | short link | 302 | /compound/v2/nl/e/3?video=li-gl-nl-e3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-e3 |
| /v/li-gl-nl-e4 | short link | 302 | /compound/v2/nl/e/4?video=li-gl-nl-e4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-e4 |
| /v/li-gl-nl-f1 | short link | 302 | /compound/v2/nl/f/1?video=li-gl-nl-f1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-f1 |
| /v/li-gl-nl-f2 | short link | 302 | /compound/v2/nl/f/2?video=li-gl-nl-f2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-f2 |
| /v/li-gl-nl-f3 | short link | 302 | /compound/v2/nl/f/3?video=li-gl-nl-f3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-f3 |
| /v/li-gl-nl-f4 | short link | 302 | /compound/v2/nl/f/4?video=li-gl-nl-f4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-f4 |
| /v/li-gl-nl-mom1 | short link | 302 | /compound/v2/nl/mom/1?video=li-gl-nl-mom1&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-mom1 |
| /v/li-gl-nl-mom2 | short link | 302 | /compound/v2/nl/mom/2?video=li-gl-nl-mom2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-mom2 |
| /v/li-gl-nl-mom3 | short link | 302 | /compound/v2/nl/mom/3?video=li-gl-nl-mom3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-mom3 |
| /v/li-gl-nl-mom4 | short link | 302 | /compound/v2/nl/mom/4?video=li-gl-nl-mom4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-nl-mom4 |
| /v/li-gl-pt-a2 | short link | 302 | /compound/v2/pt/a/2?video=li-gl-pt-a2&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-pt-a2 |
| /v/li-gl-pt-a3 | short link | 302 | /compound/v2/pt/a/3?video=li-gl-pt-a3&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-pt-a3 |
| /v/li-gl-pt-a4 | short link | 302 | /compound/v2/pt/a/4?video=li-gl-pt-a4&utm_source=linkedin&utm_medium=post&utm_campaign=compound-v2&utm_content=li-gl-pt-a4 |
| /v/tt-bjj-en-comm1 | short link | 302 | /compound/v2/en/comm/1?video=tt-bjj-en-comm1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-en-comm1 |
| /v/tt-bjj-en-comm2 | short link | 302 | /compound/v2/en/comm/2?video=tt-bjj-en-comm2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-en-comm2 |
| /v/tt-bjj-en-comm3 | short link | 302 | /compound/v2/en/comm/3?video=tt-bjj-en-comm3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-en-comm3 |
| /v/tt-bjj-en-comm4 | short link | 302 | /compound/v2/en/comm/4?video=tt-bjj-en-comm4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-en-comm4 |
| /v/tt-bjj-es-a1 | short link | 302 | /compound/v2/es/a/1?video=tt-bjj-es-a1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-es-a1 |
| /v/tt-bjj-es-a2 | short link | 302 | /compound/v2/es/a/2?video=tt-bjj-es-a2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-es-a2 |
| /v/tt-bjj-es-a3 | short link | 302 | /compound/v2/es/a/3?video=tt-bjj-es-a3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-es-a3 |
| /v/tt-bjj-es-a4 | short link | 302 | /compound/v2/es/a/4?video=tt-bjj-es-a4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-es-a4 |
| /v/tt-bjj-pt-bjj1 | short link | 302 | /compound/v2/pt/bjj/1?video=tt-bjj-pt-bjj1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-pt-bjj1 |
| /v/tt-bjj-pt-bjj2 | short link | 302 | /compound/v2/pt/bjj/2?video=tt-bjj-pt-bjj2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-pt-bjj2 |
| /v/tt-bjj-pt-bjj3 | short link | 302 | /compound/v2/pt/bjj/3?video=tt-bjj-pt-bjj3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-pt-bjj3 |
| /v/tt-bjj-pt-bjj4 | short link | 302 | /compound/v2/pt/bjj/4?video=tt-bjj-pt-bjj4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-pt-bjj4 |
| /v/tt-bjj-pt-bjj5 | short link | 302 | /compound/v2/pt/bjj/5?video=tt-bjj-pt-bjj5&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-pt-bjj5 |
| /v/tt-bjj-pt-bjj6 | short link | 302 | /compound/v2/pt/bjj/6?video=tt-bjj-pt-bjj6&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-pt-bjj6 |
| /v/tt-bjj-pt-bjj7 | short link | 302 | /compound/v2/pt/bjj/7?video=tt-bjj-pt-bjj7&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-bjj-pt-bjj7 |
| /v/tt-gl-nl-a1 | short link | 302 | /compound/v2/nl/a/1?video=tt-gl-nl-a1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-a1 |
| /v/tt-gl-nl-a2 | short link | 302 | /compound/v2/nl/a/2?video=tt-gl-nl-a2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-a2 |
| /v/tt-gl-nl-a3 | short link | 302 | /compound/v2/nl/a/3?video=tt-gl-nl-a3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-a3 |
| /v/tt-gl-nl-a4 | short link | 302 | /compound/v2/nl/a/4?video=tt-gl-nl-a4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-a4 |
| /v/tt-gl-nl-mom1 | short link | 302 | /compound/v2/nl/mom/1?video=tt-gl-nl-mom1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-mom1 |
| /v/tt-gl-nl-mom2 | short link | 302 | /compound/v2/nl/mom/2?video=tt-gl-nl-mom2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-mom2 |
| /v/tt-gl-nl-mom3 | short link | 302 | /compound/v2/nl/mom/3?video=tt-gl-nl-mom3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-mom3 |
| /v/tt-gl-nl-mom4 | short link | 302 | /compound/v2/nl/mom/4?video=tt-gl-nl-mom4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-mom4 |
| /v/tt-gl-nl-mom5 | short link | 302 | /compound/v2/nl/mom/5?video=tt-gl-nl-mom5&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-mom5 |
| /v/tt-gl-nl-mom6 | short link | 302 | /compound/v2/nl/mom/6?video=tt-gl-nl-mom6&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-mom6 |
| /v/tt-gl-nl-mom7 | short link | 302 | /compound/v2/nl/mom/7?video=tt-gl-nl-mom7&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gl-nl-mom7 |
| /v/tt-gm-de-a2 | short link | 302 | /compound/v2/de/a/2?video=tt-gm-de-a2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-de-a2 |
| /v/tt-gm-de-a3 | short link | 302 | /compound/v2/de/a/3?video=tt-gm-de-a3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-de-a3 |
| /v/tt-gm-de-a4 | short link | 302 | /compound/v2/de/a/4?video=tt-gm-de-a4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-de-a4 |
| /v/tt-gm-en-a2 | short link | 302 | /compound/v2/en/a/2?video=tt-gm-en-a2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-a2 |
| /v/tt-gm-en-a3 | short link | 302 | /compound/v2/en/a/3?video=tt-gm-en-a3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-a3 |
| /v/tt-gm-en-a4 | short link | 302 | /compound/v2/en/a/4?video=tt-gm-en-a4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-a4 |
| /v/tt-gm-en-b1 | short link | 302 | /compound/v2/en/b/1?video=tt-gm-en-b1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-b1 |
| /v/tt-gm-en-b2 | short link | 302 | /compound/v2/en/b/2?video=tt-gm-en-b2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-b2 |
| /v/tt-gm-en-b3 | short link | 302 | /compound/v2/en/b/3?video=tt-gm-en-b3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-b3 |
| /v/tt-gm-en-b4 | short link | 302 | /compound/v2/en/b/4?video=tt-gm-en-b4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-b4 |
| /v/tt-gm-en-b5 | short link | 302 | /compound/v2/en/b/5?video=tt-gm-en-b5&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-b5 |
| /v/tt-gm-en-b6 | short link | 302 | /compound/v2/en/b/6?video=tt-gm-en-b6&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-b6 |
| /v/tt-gm-en-b7 | short link | 302 | /compound/v2/en/b/7?video=tt-gm-en-b7&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-b7 |
| /v/tt-gm-en-b8 | short link | 302 | /compound/v2/en/b/8?video=tt-gm-en-b8&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-b8 |
| /v/tt-gm-en-c1 | short link | 302 | /compound/v2/en/c/1?video=tt-gm-en-c1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-c1 |
| /v/tt-gm-en-c2 | short link | 302 | /compound/v2/en/c/2?video=tt-gm-en-c2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-c2 |
| /v/tt-gm-en-c3 | short link | 302 | /compound/v2/en/c/3?video=tt-gm-en-c3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-c3 |
| /v/tt-gm-en-c4 | short link | 302 | /compound/v2/en/c/4?video=tt-gm-en-c4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-c4 |
| /v/tt-gm-en-d1 | short link | 302 | /compound/v2/en/d/1?video=tt-gm-en-d1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-d1 |
| /v/tt-gm-en-d2 | short link | 302 | /compound/v2/en/d/2?video=tt-gm-en-d2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-d2 |
| /v/tt-gm-en-d3 | short link | 302 | /compound/v2/en/d/3?video=tt-gm-en-d3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-d3 |
| /v/tt-gm-en-d4 | short link | 302 | /compound/v2/en/d/4?video=tt-gm-en-d4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-d4 |
| /v/tt-gm-en-demo1 | short link | 302 | /compound/v2/en/demo/1?video=tt-gm-en-demo1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-demo1 |
| /v/tt-gm-en-f1 | short link | 302 | /compound/v2/en/f/1?video=tt-gm-en-f1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-f1 |
| /v/tt-gm-en-f2 | short link | 302 | /compound/v2/en/f/2?video=tt-gm-en-f2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-f2 |
| /v/tt-gm-en-f3 | short link | 302 | /compound/v2/en/f/3?video=tt-gm-en-f3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-f3 |
| /v/tt-gm-en-f4 | short link | 302 | /compound/v2/en/f/4?video=tt-gm-en-f4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-f4 |
| /v/tt-gm-en-live1 | short link | 302 | /compound/v2/en/live/1?video=tt-gm-en-live1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-live1 |
| /v/tt-gm-en-mom1 | short link | 302 | /compound/v2/en/mom/1?video=tt-gm-en-mom1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-mom1 |
| /v/tt-gm-en-mom2 | short link | 302 | /compound/v2/en/mom/2?video=tt-gm-en-mom2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-mom2 |
| /v/tt-gm-en-mom3 | short link | 302 | /compound/v2/en/mom/3?video=tt-gm-en-mom3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-mom3 |
| /v/tt-gm-en-mom4 | short link | 302 | /compound/v2/en/mom/4?video=tt-gm-en-mom4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-mom4 |
| /v/tt-gm-en-startup1 | short link | 302 | /compound/v2/en/startup/1?video=tt-gm-en-startup1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-startup1 |
| /v/tt-gm-en-startup2 | short link | 302 | /compound/v2/en/startup/2?video=tt-gm-en-startup2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-startup2 |
| /v/tt-gm-en-startup3 | short link | 302 | /compound/v2/en/startup/3?video=tt-gm-en-startup3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-startup3 |
| /v/tt-gm-en-startup4 | short link | 302 | /compound/v2/en/startup/4?video=tt-gm-en-startup4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-startup4 |
| /v/tt-gm-en-startup5 | short link | 302 | /compound/v2/en/startup/5?video=tt-gm-en-startup5&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-startup5 |
| /v/tt-gm-en-startup6 | short link | 302 | /compound/v2/en/startup/6?video=tt-gm-en-startup6&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-startup6 |
| /v/tt-gm-en-startup7 | short link | 302 | /compound/v2/en/startup/7?video=tt-gm-en-startup7&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-en-startup7 |
| /v/tt-gm-es-c1 | short link | 302 | /compound/v2/es/c/1?video=tt-gm-es-c1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-c1 |
| /v/tt-gm-es-c2 | short link | 302 | /compound/v2/es/c/2?video=tt-gm-es-c2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-c2 |
| /v/tt-gm-es-c3 | short link | 302 | /compound/v2/es/c/3?video=tt-gm-es-c3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-c3 |
| /v/tt-gm-es-c4 | short link | 302 | /compound/v2/es/c/4?video=tt-gm-es-c4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-c4 |
| /v/tt-gm-es-d1 | short link | 302 | /compound/v2/es/d/1?video=tt-gm-es-d1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-d1 |
| /v/tt-gm-es-d2 | short link | 302 | /compound/v2/es/d/2?video=tt-gm-es-d2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-d2 |
| /v/tt-gm-es-d3 | short link | 302 | /compound/v2/es/d/3?video=tt-gm-es-d3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-d3 |
| /v/tt-gm-es-d4 | short link | 302 | /compound/v2/es/d/4?video=tt-gm-es-d4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-d4 |
| /v/tt-gm-es-e1 | short link | 302 | /compound/v2/es/e/1?video=tt-gm-es-e1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-e1 |
| /v/tt-gm-es-e2 | short link | 302 | /compound/v2/es/e/2?video=tt-gm-es-e2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-e2 |
| /v/tt-gm-es-e3 | short link | 302 | /compound/v2/es/e/3?video=tt-gm-es-e3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-e3 |
| /v/tt-gm-es-e4 | short link | 302 | /compound/v2/es/e/4?video=tt-gm-es-e4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-e4 |
| /v/tt-gm-es-f1 | short link | 302 | /compound/v2/es/f/1?video=tt-gm-es-f1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-f1 |
| /v/tt-gm-es-f2 | short link | 302 | /compound/v2/es/f/2?video=tt-gm-es-f2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-f2 |
| /v/tt-gm-es-f3 | short link | 302 | /compound/v2/es/f/3?video=tt-gm-es-f3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-f3 |
| /v/tt-gm-es-f4 | short link | 302 | /compound/v2/es/f/4?video=tt-gm-es-f4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-f4 |
| /v/tt-gm-es-mom1 | short link | 302 | /compound/v2/es/mom/1?video=tt-gm-es-mom1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-mom1 |
| /v/tt-gm-es-mom2 | short link | 302 | /compound/v2/es/mom/2?video=tt-gm-es-mom2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-mom2 |
| /v/tt-gm-es-mom3 | short link | 302 | /compound/v2/es/mom/3?video=tt-gm-es-mom3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-mom3 |
| /v/tt-gm-es-mom4 | short link | 302 | /compound/v2/es/mom/4?video=tt-gm-es-mom4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-es-mom4 |
| /v/tt-gm-fr-a2 | short link | 302 | /compound/v2/fr/a/2?video=tt-gm-fr-a2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-a2 |
| /v/tt-gm-fr-a3 | short link | 302 | /compound/v2/fr/a/3?video=tt-gm-fr-a3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-a3 |
| /v/tt-gm-fr-a4 | short link | 302 | /compound/v2/fr/a/4?video=tt-gm-fr-a4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-a4 |
| /v/tt-gm-fr-b1 | short link | 302 | /compound/v2/fr/b/1?video=tt-gm-fr-b1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-b1 |
| /v/tt-gm-fr-b2 | short link | 302 | /compound/v2/fr/b/2?video=tt-gm-fr-b2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-b2 |
| /v/tt-gm-fr-b3 | short link | 302 | /compound/v2/fr/b/3?video=tt-gm-fr-b3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-b3 |
| /v/tt-gm-fr-b4 | short link | 302 | /compound/v2/fr/b/4?video=tt-gm-fr-b4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-b4 |
| /v/tt-gm-fr-c1 | short link | 302 | /compound/v2/fr/c/1?video=tt-gm-fr-c1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-c1 |
| /v/tt-gm-fr-c2 | short link | 302 | /compound/v2/fr/c/2?video=tt-gm-fr-c2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-c2 |
| /v/tt-gm-fr-c3 | short link | 302 | /compound/v2/fr/c/3?video=tt-gm-fr-c3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-c3 |
| /v/tt-gm-fr-c4 | short link | 302 | /compound/v2/fr/c/4?video=tt-gm-fr-c4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-c4 |
| /v/tt-gm-fr-d1 | short link | 302 | /compound/v2/fr/d/1?video=tt-gm-fr-d1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-d1 |
| /v/tt-gm-fr-d2 | short link | 302 | /compound/v2/fr/d/2?video=tt-gm-fr-d2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-d2 |
| /v/tt-gm-fr-d3 | short link | 302 | /compound/v2/fr/d/3?video=tt-gm-fr-d3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-d3 |
| /v/tt-gm-fr-d4 | short link | 302 | /compound/v2/fr/d/4?video=tt-gm-fr-d4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-d4 |
| /v/tt-gm-fr-e1 | short link | 302 | /compound/v2/fr/e/1?video=tt-gm-fr-e1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-e1 |
| /v/tt-gm-fr-e2 | short link | 302 | /compound/v2/fr/e/2?video=tt-gm-fr-e2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-e2 |
| /v/tt-gm-fr-e3 | short link | 302 | /compound/v2/fr/e/3?video=tt-gm-fr-e3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-e3 |
| /v/tt-gm-fr-e4 | short link | 302 | /compound/v2/fr/e/4?video=tt-gm-fr-e4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-e4 |
| /v/tt-gm-fr-f1 | short link | 302 | /compound/v2/fr/f/1?video=tt-gm-fr-f1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-f1 |
| /v/tt-gm-fr-f2 | short link | 302 | /compound/v2/fr/f/2?video=tt-gm-fr-f2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-f2 |
| /v/tt-gm-fr-f3 | short link | 302 | /compound/v2/fr/f/3?video=tt-gm-fr-f3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-f3 |
| /v/tt-gm-fr-f4 | short link | 302 | /compound/v2/fr/f/4?video=tt-gm-fr-f4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-f4 |
| /v/tt-gm-fr-mom1 | short link | 302 | /compound/v2/fr/mom/1?video=tt-gm-fr-mom1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-mom1 |
| /v/tt-gm-fr-mom2 | short link | 302 | /compound/v2/fr/mom/2?video=tt-gm-fr-mom2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-mom2 |
| /v/tt-gm-fr-mom3 | short link | 302 | /compound/v2/fr/mom/3?video=tt-gm-fr-mom3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-mom3 |
| /v/tt-gm-fr-mom4 | short link | 302 | /compound/v2/fr/mom/4?video=tt-gm-fr-mom4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-fr-mom4 |
| /v/tt-gm-it-a2 | short link | 302 | /compound/v2/it/a/2?video=tt-gm-it-a2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-it-a2 |
| /v/tt-gm-it-a3 | short link | 302 | /compound/v2/it/a/3?video=tt-gm-it-a3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-it-a3 |
| /v/tt-gm-it-a4 | short link | 302 | /compound/v2/it/a/4?video=tt-gm-it-a4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-it-a4 |
| /v/tt-gm-nl-b1 | short link | 302 | /compound/v2/nl/b/1?video=tt-gm-nl-b1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-b1 |
| /v/tt-gm-nl-b2 | short link | 302 | /compound/v2/nl/b/2?video=tt-gm-nl-b2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-b2 |
| /v/tt-gm-nl-b3 | short link | 302 | /compound/v2/nl/b/3?video=tt-gm-nl-b3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-b3 |
| /v/tt-gm-nl-b4 | short link | 302 | /compound/v2/nl/b/4?video=tt-gm-nl-b4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-b4 |
| /v/tt-gm-nl-c1 | short link | 302 | /compound/v2/nl/c/1?video=tt-gm-nl-c1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-c1 |
| /v/tt-gm-nl-c2 | short link | 302 | /compound/v2/nl/c/2?video=tt-gm-nl-c2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-c2 |
| /v/tt-gm-nl-c3 | short link | 302 | /compound/v2/nl/c/3?video=tt-gm-nl-c3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-c3 |
| /v/tt-gm-nl-c4 | short link | 302 | /compound/v2/nl/c/4?video=tt-gm-nl-c4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-c4 |
| /v/tt-gm-nl-d1 | short link | 302 | /compound/v2/nl/d/1?video=tt-gm-nl-d1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-d1 |
| /v/tt-gm-nl-d2 | short link | 302 | /compound/v2/nl/d/2?video=tt-gm-nl-d2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-d2 |
| /v/tt-gm-nl-d3 | short link | 302 | /compound/v2/nl/d/3?video=tt-gm-nl-d3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-d3 |
| /v/tt-gm-nl-d4 | short link | 302 | /compound/v2/nl/d/4?video=tt-gm-nl-d4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-d4 |
| /v/tt-gm-nl-e1 | short link | 302 | /compound/v2/nl/e/1?video=tt-gm-nl-e1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-e1 |
| /v/tt-gm-nl-e2 | short link | 302 | /compound/v2/nl/e/2?video=tt-gm-nl-e2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-e2 |
| /v/tt-gm-nl-e3 | short link | 302 | /compound/v2/nl/e/3?video=tt-gm-nl-e3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-e3 |
| /v/tt-gm-nl-e4 | short link | 302 | /compound/v2/nl/e/4?video=tt-gm-nl-e4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-e4 |
| /v/tt-gm-nl-f1 | short link | 302 | /compound/v2/nl/f/1?video=tt-gm-nl-f1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-f1 |
| /v/tt-gm-nl-f2 | short link | 302 | /compound/v2/nl/f/2?video=tt-gm-nl-f2&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-f2 |
| /v/tt-gm-nl-f3 | short link | 302 | /compound/v2/nl/f/3?video=tt-gm-nl-f3&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-f3 |
| /v/tt-gm-nl-f4 | short link | 302 | /compound/v2/nl/f/4?video=tt-gm-nl-f4&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-nl-f4 |
| /v/tt-gm-ru-a1 | short link | 302 | /compound/v2/ru/a/1?video=tt-gm-ru-a1&utm_source=tiktok&utm_medium=post&utm_campaign=compound-v2&utm_content=tt-gm-ru-a1 |
| /v/x-gm-de-a1 | short link | 302 | /compound/v2/de/a/1?video=x-gm-de-a1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-de-a1 |
| /v/x-gm-de-a2 | short link | 302 | /compound/v2/de/a/2?video=x-gm-de-a2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-de-a2 |
| /v/x-gm-de-a3 | short link | 302 | /compound/v2/de/a/3?video=x-gm-de-a3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-de-a3 |
| /v/x-gm-de-a4 | short link | 302 | /compound/v2/de/a/4?video=x-gm-de-a4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-de-a4 |
| /v/x-gm-en-a1 | short link | 302 | /compound/v2/en/a/1?video=x-gm-en-a1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-a1 |
| /v/x-gm-en-a2 | short link | 302 | /compound/v2/en/a/2?video=x-gm-en-a2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-a2 |
| /v/x-gm-en-a3 | short link | 302 | /compound/v2/en/a/3?video=x-gm-en-a3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-a3 |
| /v/x-gm-en-a4 | short link | 302 | /compound/v2/en/a/4?video=x-gm-en-a4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-a4 |
| /v/x-gm-en-a5 | short link | 302 | /compound/v2/en/a/5?video=x-gm-en-a5&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-a5 |
| /v/x-gm-en-a6 | short link | 302 | /compound/v2/en/a/6?video=x-gm-en-a6&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-a6 |
| /v/x-gm-en-b1 | short link | 302 | /compound/v2/en/b/1?video=x-gm-en-b1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-b1 |
| /v/x-gm-en-b2 | short link | 302 | /compound/v2/en/b/2?video=x-gm-en-b2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-b2 |
| /v/x-gm-en-b3 | short link | 302 | /compound/v2/en/b/3?video=x-gm-en-b3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-b3 |
| /v/x-gm-en-b4 | short link | 302 | /compound/v2/en/b/4?video=x-gm-en-b4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-b4 |
| /v/x-gm-en-b8 | short link | 302 | /compound/v2/en/b/8?video=x-gm-en-b8&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-b8 |
| /v/x-gm-en-c1 | short link | 302 | /compound/v2/en/c/1?video=x-gm-en-c1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-c1 |
| /v/x-gm-en-c2 | short link | 302 | /compound/v2/en/c/2?video=x-gm-en-c2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-c2 |
| /v/x-gm-en-c3 | short link | 302 | /compound/v2/en/c/3?video=x-gm-en-c3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-c3 |
| /v/x-gm-en-c4 | short link | 302 | /compound/v2/en/c/4?video=x-gm-en-c4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-c4 |
| /v/x-gm-en-d1 | short link | 302 | /compound/v2/en/d/1?video=x-gm-en-d1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-d1 |
| /v/x-gm-en-d2 | short link | 302 | /compound/v2/en/d/2?video=x-gm-en-d2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-d2 |
| /v/x-gm-en-d3 | short link | 302 | /compound/v2/en/d/3?video=x-gm-en-d3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-d3 |
| /v/x-gm-en-d4 | short link | 302 | /compound/v2/en/d/4?video=x-gm-en-d4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-d4 |
| /v/x-gm-en-demo1 | short link | 302 | /compound/v2/en/demo/1?video=x-gm-en-demo1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-demo1 |
| /v/x-gm-en-e1 | short link | 302 | /compound/v2/en/e/1?video=x-gm-en-e1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-e1 |
| /v/x-gm-en-e2 | short link | 302 | /compound/v2/en/e/2?video=x-gm-en-e2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-e2 |
| /v/x-gm-en-e3 | short link | 302 | /compound/v2/en/e/3?video=x-gm-en-e3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-e3 |
| /v/x-gm-en-e4 | short link | 302 | /compound/v2/en/e/4?video=x-gm-en-e4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-e4 |
| /v/x-gm-en-f1 | short link | 302 | /compound/v2/en/f/1?video=x-gm-en-f1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-f1 |
| /v/x-gm-en-f2 | short link | 302 | /compound/v2/en/f/2?video=x-gm-en-f2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-f2 |
| /v/x-gm-en-f3 | short link | 302 | /compound/v2/en/f/3?video=x-gm-en-f3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-f3 |
| /v/x-gm-en-f4 | short link | 302 | /compound/v2/en/f/4?video=x-gm-en-f4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-f4 |
| /v/x-gm-en-f5 | short link | 302 | /compound/v2/en/f/5?video=x-gm-en-f5&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-f5 |
| /v/x-gm-en-f6 | short link | 302 | /compound/v2/en/f/6?video=x-gm-en-f6&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-f6 |
| /v/x-gm-en-live1 | short link | 302 | /compound/v2/en/live/1?video=x-gm-en-live1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-live1 |
| /v/x-gm-en-mom1 | short link | 302 | /compound/v2/en/mom/1?video=x-gm-en-mom1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-mom1 |
| /v/x-gm-en-mom2 | short link | 302 | /compound/v2/en/mom/2?video=x-gm-en-mom2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-mom2 |
| /v/x-gm-en-mom3 | short link | 302 | /compound/v2/en/mom/3?video=x-gm-en-mom3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-mom3 |
| /v/x-gm-en-mom4 | short link | 302 | /compound/v2/en/mom/4?video=x-gm-en-mom4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-mom4 |
| /v/x-gm-en-startup2 | short link | 302 | /compound/v2/en/startup/2?video=x-gm-en-startup2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-en-startup2 |
| /v/x-gm-es-a1 | short link | 302 | /compound/v2/es/a/1?video=x-gm-es-a1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-a1 |
| /v/x-gm-es-a2 | short link | 302 | /compound/v2/es/a/2?video=x-gm-es-a2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-a2 |
| /v/x-gm-es-a3 | short link | 302 | /compound/v2/es/a/3?video=x-gm-es-a3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-a3 |
| /v/x-gm-es-a4 | short link | 302 | /compound/v2/es/a/4?video=x-gm-es-a4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-a4 |
| /v/x-gm-es-c1 | short link | 302 | /compound/v2/es/c/1?video=x-gm-es-c1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-c1 |
| /v/x-gm-es-c2 | short link | 302 | /compound/v2/es/c/2?video=x-gm-es-c2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-c2 |
| /v/x-gm-es-c3 | short link | 302 | /compound/v2/es/c/3?video=x-gm-es-c3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-c3 |
| /v/x-gm-es-c4 | short link | 302 | /compound/v2/es/c/4?video=x-gm-es-c4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-c4 |
| /v/x-gm-es-d1 | short link | 302 | /compound/v2/es/d/1?video=x-gm-es-d1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-d1 |
| /v/x-gm-es-d2 | short link | 302 | /compound/v2/es/d/2?video=x-gm-es-d2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-d2 |
| /v/x-gm-es-d3 | short link | 302 | /compound/v2/es/d/3?video=x-gm-es-d3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-d3 |
| /v/x-gm-es-d4 | short link | 302 | /compound/v2/es/d/4?video=x-gm-es-d4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-d4 |
| /v/x-gm-es-e1 | short link | 302 | /compound/v2/es/e/1?video=x-gm-es-e1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-e1 |
| /v/x-gm-es-e2 | short link | 302 | /compound/v2/es/e/2?video=x-gm-es-e2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-e2 |
| /v/x-gm-es-e3 | short link | 302 | /compound/v2/es/e/3?video=x-gm-es-e3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-e3 |
| /v/x-gm-es-e4 | short link | 302 | /compound/v2/es/e/4?video=x-gm-es-e4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-e4 |
| /v/x-gm-es-f1 | short link | 302 | /compound/v2/es/f/1?video=x-gm-es-f1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-f1 |
| /v/x-gm-es-f2 | short link | 302 | /compound/v2/es/f/2?video=x-gm-es-f2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-f2 |
| /v/x-gm-es-f3 | short link | 302 | /compound/v2/es/f/3?video=x-gm-es-f3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-f3 |
| /v/x-gm-es-f4 | short link | 302 | /compound/v2/es/f/4?video=x-gm-es-f4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-f4 |
| /v/x-gm-es-mom1 | short link | 302 | /compound/v2/es/mom/1?video=x-gm-es-mom1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-mom1 |
| /v/x-gm-es-mom2 | short link | 302 | /compound/v2/es/mom/2?video=x-gm-es-mom2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-mom2 |
| /v/x-gm-es-mom3 | short link | 302 | /compound/v2/es/mom/3?video=x-gm-es-mom3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-mom3 |
| /v/x-gm-es-mom4 | short link | 302 | /compound/v2/es/mom/4?video=x-gm-es-mom4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-es-mom4 |
| /v/x-gm-fr-a2 | short link | 302 | /compound/v2/fr/a/2?video=x-gm-fr-a2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-a2 |
| /v/x-gm-fr-a3 | short link | 302 | /compound/v2/fr/a/3?video=x-gm-fr-a3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-a3 |
| /v/x-gm-fr-a4 | short link | 302 | /compound/v2/fr/a/4?video=x-gm-fr-a4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-a4 |
| /v/x-gm-fr-b1 | short link | 302 | /compound/v2/fr/b/1?video=x-gm-fr-b1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-b1 |
| /v/x-gm-fr-b2 | short link | 302 | /compound/v2/fr/b/2?video=x-gm-fr-b2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-b2 |
| /v/x-gm-fr-b3 | short link | 302 | /compound/v2/fr/b/3?video=x-gm-fr-b3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-b3 |
| /v/x-gm-fr-b4 | short link | 302 | /compound/v2/fr/b/4?video=x-gm-fr-b4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-b4 |
| /v/x-gm-fr-c1 | short link | 302 | /compound/v2/fr/c/1?video=x-gm-fr-c1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-c1 |
| /v/x-gm-fr-c2 | short link | 302 | /compound/v2/fr/c/2?video=x-gm-fr-c2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-c2 |
| /v/x-gm-fr-c3 | short link | 302 | /compound/v2/fr/c/3?video=x-gm-fr-c3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-c3 |
| /v/x-gm-fr-c4 | short link | 302 | /compound/v2/fr/c/4?video=x-gm-fr-c4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-c4 |
| /v/x-gm-fr-d1 | short link | 302 | /compound/v2/fr/d/1?video=x-gm-fr-d1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-d1 |
| /v/x-gm-fr-d2 | short link | 302 | /compound/v2/fr/d/2?video=x-gm-fr-d2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-d2 |
| /v/x-gm-fr-d3 | short link | 302 | /compound/v2/fr/d/3?video=x-gm-fr-d3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-d3 |
| /v/x-gm-fr-d4 | short link | 302 | /compound/v2/fr/d/4?video=x-gm-fr-d4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-d4 |
| /v/x-gm-fr-e1 | short link | 302 | /compound/v2/fr/e/1?video=x-gm-fr-e1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-e1 |
| /v/x-gm-fr-e2 | short link | 302 | /compound/v2/fr/e/2?video=x-gm-fr-e2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-e2 |
| /v/x-gm-fr-e3 | short link | 302 | /compound/v2/fr/e/3?video=x-gm-fr-e3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-e3 |
| /v/x-gm-fr-e4 | short link | 302 | /compound/v2/fr/e/4?video=x-gm-fr-e4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-e4 |
| /v/x-gm-fr-f1 | short link | 302 | /compound/v2/fr/f/1?video=x-gm-fr-f1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-f1 |
| /v/x-gm-fr-f2 | short link | 302 | /compound/v2/fr/f/2?video=x-gm-fr-f2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-f2 |
| /v/x-gm-fr-f3 | short link | 302 | /compound/v2/fr/f/3?video=x-gm-fr-f3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-f3 |
| /v/x-gm-fr-f4 | short link | 302 | /compound/v2/fr/f/4?video=x-gm-fr-f4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-f4 |
| /v/x-gm-fr-mom1 | short link | 302 | /compound/v2/fr/mom/1?video=x-gm-fr-mom1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-mom1 |
| /v/x-gm-fr-mom2 | short link | 302 | /compound/v2/fr/mom/2?video=x-gm-fr-mom2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-mom2 |
| /v/x-gm-fr-mom3 | short link | 302 | /compound/v2/fr/mom/3?video=x-gm-fr-mom3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-mom3 |
| /v/x-gm-fr-mom4 | short link | 302 | /compound/v2/fr/mom/4?video=x-gm-fr-mom4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-fr-mom4 |
| /v/x-gm-it-a1 | short link | 302 | /compound/v2/it/a/1?video=x-gm-it-a1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-it-a1 |
| /v/x-gm-it-a2 | short link | 302 | /compound/v2/it/a/2?video=x-gm-it-a2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-it-a2 |
| /v/x-gm-it-a3 | short link | 302 | /compound/v2/it/a/3?video=x-gm-it-a3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-it-a3 |
| /v/x-gm-it-a4 | short link | 302 | /compound/v2/it/a/4?video=x-gm-it-a4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-it-a4 |
| /v/x-gm-nl-a2 | short link | 302 | /compound/v2/nl/a/2?video=x-gm-nl-a2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-a2 |
| /v/x-gm-nl-a3 | short link | 302 | /compound/v2/nl/a/3?video=x-gm-nl-a3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-a3 |
| /v/x-gm-nl-a4 | short link | 302 | /compound/v2/nl/a/4?video=x-gm-nl-a4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-a4 |
| /v/x-gm-nl-b1 | short link | 302 | /compound/v2/nl/b/1?video=x-gm-nl-b1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-b1 |
| /v/x-gm-nl-b2 | short link | 302 | /compound/v2/nl/b/2?video=x-gm-nl-b2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-b2 |
| /v/x-gm-nl-b3 | short link | 302 | /compound/v2/nl/b/3?video=x-gm-nl-b3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-b3 |
| /v/x-gm-nl-b4 | short link | 302 | /compound/v2/nl/b/4?video=x-gm-nl-b4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-b4 |
| /v/x-gm-nl-c1 | short link | 302 | /compound/v2/nl/c/1?video=x-gm-nl-c1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-c1 |
| /v/x-gm-nl-c2 | short link | 302 | /compound/v2/nl/c/2?video=x-gm-nl-c2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-c2 |
| /v/x-gm-nl-c3 | short link | 302 | /compound/v2/nl/c/3?video=x-gm-nl-c3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-c3 |
| /v/x-gm-nl-c4 | short link | 302 | /compound/v2/nl/c/4?video=x-gm-nl-c4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-c4 |
| /v/x-gm-nl-d1 | short link | 302 | /compound/v2/nl/d/1?video=x-gm-nl-d1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-d1 |
| /v/x-gm-nl-d2 | short link | 302 | /compound/v2/nl/d/2?video=x-gm-nl-d2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-d2 |
| /v/x-gm-nl-d3 | short link | 302 | /compound/v2/nl/d/3?video=x-gm-nl-d3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-d3 |
| /v/x-gm-nl-d4 | short link | 302 | /compound/v2/nl/d/4?video=x-gm-nl-d4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-d4 |
| /v/x-gm-nl-e1 | short link | 302 | /compound/v2/nl/e/1?video=x-gm-nl-e1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-e1 |
| /v/x-gm-nl-e2 | short link | 302 | /compound/v2/nl/e/2?video=x-gm-nl-e2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-e2 |
| /v/x-gm-nl-e3 | short link | 302 | /compound/v2/nl/e/3?video=x-gm-nl-e3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-e3 |
| /v/x-gm-nl-e4 | short link | 302 | /compound/v2/nl/e/4?video=x-gm-nl-e4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-e4 |
| /v/x-gm-nl-f1 | short link | 302 | /compound/v2/nl/f/1?video=x-gm-nl-f1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-f1 |
| /v/x-gm-nl-f2 | short link | 302 | /compound/v2/nl/f/2?video=x-gm-nl-f2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-f2 |
| /v/x-gm-nl-f3 | short link | 302 | /compound/v2/nl/f/3?video=x-gm-nl-f3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-f3 |
| /v/x-gm-nl-f4 | short link | 302 | /compound/v2/nl/f/4?video=x-gm-nl-f4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-f4 |
| /v/x-gm-nl-mom1 | short link | 302 | /compound/v2/nl/mom/1?video=x-gm-nl-mom1&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-mom1 |
| /v/x-gm-nl-mom2 | short link | 302 | /compound/v2/nl/mom/2?video=x-gm-nl-mom2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-mom2 |
| /v/x-gm-nl-mom3 | short link | 302 | /compound/v2/nl/mom/3?video=x-gm-nl-mom3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-mom3 |
| /v/x-gm-nl-mom4 | short link | 302 | /compound/v2/nl/mom/4?video=x-gm-nl-mom4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-nl-mom4 |
| /v/x-gm-pt-a2 | short link | 302 | /compound/v2/pt/a/2?video=x-gm-pt-a2&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-pt-a2 |
| /v/x-gm-pt-a3 | short link | 302 | /compound/v2/pt/a/3?video=x-gm-pt-a3&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-pt-a3 |
| /v/x-gm-pt-a4 | short link | 302 | /compound/v2/pt/a/4?video=x-gm-pt-a4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-pt-a4 |
| /v/x-gm-pt-bjj4 | short link | 302 | /compound/v2/pt/bjj/4?video=x-gm-pt-bjj4&utm_source=x&utm_medium=post&utm_campaign=compound-v2&utm_content=x-gm-pt-bjj4 |
| /v/yt-gm-en-mom1 | short link | 302 | /compound/v2/en/mom/1?video=yt-gm-en-mom1&utm_source=youtube&utm_medium=post&utm_campaign=compound-v2&utm_content=yt-gm-en-mom1 |
| /v/yt-gm-nl-mom1 | short link | 302 | /compound/v2/nl/mom/1?video=yt-gm-nl-mom1&utm_source=youtube&utm_medium=post&utm_campaign=compound-v2&utm_content=yt-gm-nl-mom1 |
| /wa | tracked redirect | 302 | /compound?utm_source=whatsapp&utm_medium=message&utm_campaign=compound-1000&utm_term=wa |
| /whitebelt | redirect | 307 | /hack/play |
| /x | tracked redirect | 302 | /compound?utm_source=x&utm_medium=post&utm_campaign=compound-1000&utm_term=x |
| /x-bio | tracked redirect | 302 | /compound?utm_source=x&utm_medium=bio&utm_campaign=compound-1000&utm_term=x-bio |
| https://stats.corvus.gent/compound/v2?utm_source=audit | canonical redirect | 301 | https://corvus.gent/compound/v2?utm_source=audit |

## Parameterized routes

These patterns describe families rather than invented public records. Only concrete existing content is published. Private handler patterns are intentionally omitted.

| Pattern | Resolution |
|---|---|
| /legion/senate/:slug | /legion/senate/index.html |
| /compound/v2/:lang(nl\|en\|fr\|pt\|es\|de\|it\|ca\|eu\|tl\|zh\|tr\|ar\|ru\|ce\|pl\|fa\|ln\|ay\|qu) | /compound/v2/index.html |
| /compound/v2/:lang(nl\|en\|fr\|pt\|es\|de\|it\|ca\|eu\|tl\|zh\|tr\|ar\|ru\|ce\|pl\|fa\|ln\|ay\|qu)/ | /compound/v2/index.html |
| /compound/v2/:lang(nl\|en\|fr\|pt\|es\|de\|it\|ca\|eu\|tl\|zh\|tr\|ar\|ru\|ce\|pl\|fa\|ln\|ay\|qu)/:hook(a\|b\|c\|d\|f\|mom\|bjj\|startup\|side\|comm\|int) | /compound/v2/index.html |
| /compound/v2/:lang(nl\|en\|fr\|pt\|es\|de\|it\|ca\|eu\|tl\|zh\|tr\|ar\|ru\|ce\|pl\|fa\|ln\|ay\|qu)/:hook(a\|b\|c\|d\|f\|mom\|bjj\|startup\|side\|comm\|int)/ | /compound/v2/index.html |
| /compound/v2/:lang(nl\|en\|fr\|pt\|es\|de\|it\|ca\|eu\|tl\|zh\|tr\|ar\|ru\|ce\|pl\|fa\|ln\|ay\|qu)/:hook(a\|b\|c\|d\|f\|mom\|bjj\|startup\|side\|comm\|int)/:n([1-9][0-9]{0,3}) | /compound/v2/index.html |
| /compound/v2/:lang(nl\|en\|fr\|pt\|es\|de\|it\|ca\|eu\|tl\|zh\|tr\|ar\|ru\|ce\|pl\|fa\|ln\|ay\|qu)/:hook(a\|b\|c\|d\|f\|mom\|bjj\|startup\|side\|comm\|int)/:n([1-9][0-9]{0,3})/ | /compound/v2/index.html |
| /plethora/stats.csv | /api/stats?plethora=1&action=csv |
| /hack/play/do-bronx | /hack/play/index.html |
| /hack/play/do-bronx/ | /hack/play/index.html |
| /hack/2 | /hack/index.html |
| /hack/2/ | /hack/index.html |
| /hack2 | /hack/index.html |
| /hack2/ | /hack/index.html |
| /r/:code/games | /api/army?ref=:code&to=games |
| /r/:code | /api/army?ref=:code |
| /soldier/:username/og.png | /api/army?profile=:username&image=1 |
| /soldier/:username/poster.png | /api/army?profile=:username&image=1&poster=1 |
| /soldier/:username | /api/army?profile=:username&html=1 |
| /games/data/:path* | /404.html |
| /cv/ | /api/cv |
| /cv | /api/cv |
| /cv/download | /api/cv?dl=1 |
| /go/:path* | /go/index.html |
| /links/corvus/:path* | /links/corvus/index.html |
| /links/pidgy/:path* | /links/pidgy/index.html |

Generic `/go/{platform}/{target}/{campaign?}` supports ig, li, tt, x, luma, dc, wa, mail, qr and bmc; targets me, home, now, sidequests, support, 402 and cv resolve internally. Pidgy, X, booking and coffee resolve to their configured external destinations. The script keeps unknown targets on the public profile fallback.
