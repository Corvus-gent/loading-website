# HackTheFeed /hack

Static HTML, the site's shared monospace/style tokens, a scoped CSS file and one small JS module. No new API, database, dependency or form; existing analytics are retained.

- Live updates are now owned on `codex/hack-page`: edit `hack/live.json` (`video`, `links.x`, `links.github`, `updates: [{t,text}]`); the browser refreshes it every 30 seconds without resetting an unchanged player. Existing analytics/privacy scripts are retained.
- Set `HACK_VIDEO_URL` at the top of `hack/hack.js`. Leave it empty for the “dropping soon” card.
- Supported: canonical TikTok `/@name/video/<id>`, X/Twitter `/name/status/<id>`, YouTube Shorts/watch/youtu.be, HTTPS `.mp4` (query strings allowed), or a same-site `/path.mp4`. TikTok shortened share URLs must first be expanded to their full video URL.
- Player requests begin only after a click. YouTube uses its privacy-enhanced host and origin-only referrer policy; TikTok uses its embed player. X uses its official embedded-post widget, including any attached video. Each has an original-link fallback for blocked/deleted/private media. A real film URL has not been supplied, so provider integrations are tested with mocks.
- Replace the four starter timestamps/captions in `HACK_TIMELINE` with actual build moments. Static HTML contains matching initial fallback content for no-JS visitors.
- The range input is a keyboard-accessible visual teaser; it generates nothing and sends nothing.
- Social image: original SVG composition, rendered into a 1200×630 PNG with `node tools/build-hack-og.mjs`. Production canonical/OG URLs point to `https://corvus.gent/hack`.
- Join the army links to the existing live gate at `https://corvus.gent/join-the-army-now`, also from previews. The gate is in daily PR #18 rather than this older main base. This branch contains only /hack work; merge the daily work before a main production deploy if those live fixes must be retained.
- No environment variables. Run `PORT=4196 node tools/serve.mjs`, then `node tests/hack.mjs`. Screenshots go to ignored `test-results/hack/`.

Provider references: [TikTok](https://developers.tiktok.com/docs/en/embed-player), [YouTube embedding](https://developers.google.com/youtube/player_parameters), [YouTube referrer requirement](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-player-api-client-identity), [X posts with video](https://help.x.com/en/using-x/how-to-embed-a-post).

## Pitch scope
Static HackTheFeed page: hero, upstream GitHub CTA, video adapters/placeholder, four-step product explanation, OG image, slider and live.json feed. No backend, app iframe, comments or stats in this version. Larger launch work is preserved at commit 9dfb69e and paused until “pitch done”.
