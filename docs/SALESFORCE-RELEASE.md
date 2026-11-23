# Salesforce release

- Countdown target: 2026-11-23T20:17:32Z (21:17:32 Gent).
- Exact artifact PR #135 merged at 20:17:41Z; Vercel Ready at **20:18:26Z**.
- Production curl SHA matched the supplied artifact before upgrades:
  `c1920b5c321bade9125440e3023a16cc35a427b4717af14e93d61b63dc02bc1f`.
- The live-age counter keeps that first Vercel Ready timestamp across releases.
- `/shark` redirects to `/salesforce`; standalone, noindex and outside discovery.

## Measured mobile performance

Same local server and Lighthouse settings: 150ms RTT, 1600Kbps, 6× CPU slowdown.

| Version | Performance | LCP | CLS | TBT |
| --- | --- | --- | --- | --- |
| Original artifact | 100 | 757ms | 0 | 0ms |
| Shark details | 100 | 932ms | 0 | 6.5ms |

Measurements vary with device/load. No dependencies, fonts, frameworks or branded
Salesforce assets were added. The shark is the provided original Canvas geometry,
with its own smile, glyph shading and wake.

## Checks

24 Playwright cases at 375×812, 1440×900 and reduced motion:
source byte hash; original story-copy fingerprint and links; no page errors or
horizontal overflow; tonight story first; bio stats; terminal; sticky contact
splash with local test destinations; actual release-clock math; static reduced
motion even after resize; hidden rendering; no-canvas content fallback.

The typing display has a complete static screen-reader copy. Header glyphs dim
by half behind text; the lead/contact/clock have dark backing for readability.
The render loop caps at 30fps and cancels RAF when hidden; the terminal also
pauses offscreen. The original story and facts remain unchanged. The four proof
lines are supplied facts; the current main Git history had 735 commits when checked.

CI focuses browser tests only when every changed file belongs to the Salesforce
page, its dedicated tests, checksum or this release note. Shared changes keep the
full browser suite. Basic checks remain mandatory in both cases.
