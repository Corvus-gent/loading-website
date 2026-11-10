# Hack archive

- `/hack/`: archive. `/hack/1/`: preserved HackTheFeed note. `/hack/2/`: Meta Muse recap.
- `/nest/`: Muse-generated local prototype; provenance in ARENA_LOG.md.
- Social post URLs: `hack/posts.js`. Photos: `public/hack/2/{floor,slide,setup}.jpg`.
- `npm run build` regenerates optional photos, shared navigation, route inventory and search.

## HackTheFeed /hack/1

Static HTML, the site's shared monospace/style tokens, a scoped CSS file and one small JS module. No new API, database, dependency or form; existing analytics are retained.

- Live updates are now owned on `codex/hack-page`: edit `hack/live.json` (`video`, `links.x`, `links.github`, `updates: [{t,text}]`); the browser refreshes it every 30 seconds without resetting an unchanged player. Existing analytics/privacy scripts are retained.
- Set `HACK_VIDEO_URL` at the top of `hack/hack.js`. Leave it empty for the “dropping soon” card.
- Supported: canonical TikTok `/@name/video/<id>`, X/Twitter `/name/status/<id>`, YouTube Shorts/watch/youtu.be, HTTPS `.mp4` (query strings allowed), or a same-site `/path.mp4`. TikTok shortened share URLs must first be expanded to their full video URL.
- Player requests begin only after a click. YouTube uses its privacy-enhanced host and origin-only referrer policy; TikTok uses its embed player. X uses its official embedded-post widget, including any attached video. Each has an original-link fallback for blocked/deleted/private media. A real film URL has not been supplied, so provider integrations are tested with mocks.
- Replace the four starter timestamps/captions in `HACK_TIMELINE` with actual build moments. Static HTML contains matching initial fallback content for no-JS visitors.
- The range input is a keyboard-accessible visual teaser; it generates nothing and sends nothing.
- Social image: original SVG composition, rendered into a 1200×630 PNG with `node tools/build-hack-og.mjs`. The original note canonical/OG URLs now point to `https://corvus.gent/hack/1/`.
- Join the army links to the existing live gate at `https://corvus.gent/join-the-army-now`, also from previews. The gate is in daily PR #18 rather than this older main base. This branch contains only /hack work; merge the daily work before a main production deploy if those live fixes must be retained.
- No environment variables. Run `PORT=4196 node tools/serve.mjs`, then `node tests/hack.mjs`. Screenshots go to ignored `test-results/hack/`.

Provider references: [TikTok](https://developers.tiktok.com/docs/en/embed-player), [YouTube embedding](https://developers.google.com/youtube/player_parameters), [YouTube referrer requirement](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-player-api-client-identity), [X posts with video](https://help.x.com/en/using-x/how-to-embed-a-post).

## Live controls
`video:` changes live.json.video; `update:` appends a build update; `github:` changes live.json.links.github. The main source CTA always points to the upstream onboarding branch. `key:` configures GMI_API_KEY on the separate hackthefeed Vercel project; `cap:` configures HACK_DAILY_CAP there (requires redeploy).
Comments and feedback API: /api/hack, public aggregates plus public comment text; feedback only with Gabriel's existing session at ?private=1. Moderation hide key: hack:hidden:<id>. Individual records expire after 90 days. Counts respect current analytics consent and are not unique-person counts.
