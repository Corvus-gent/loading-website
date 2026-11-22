# corvus.gent

one man, right now. an army of quality seekers, tomorrow.

Gabriel’s personal site brings together daily browser games, a community music ranking and a public dashboard for traffic and service health. The frontend uses plain HTML, CSS and JavaScript. Vercel Functions handle the APIs, Redis stores game and voting data, and PostHog supplies traffic statistics.

- [Visit corvus.gent](https://corvus.gent)
- [Explore the public stats](https://stats.corvus.gent)
- [Check service health](https://stats.corvus.gent/status)

For a local preview of the static pages, run `node tools/serve.mjs` and open `http://127.0.0.1:4176`. The API routes run on Vercel.

## OpenRisk private prototype

OpenRisk runs in the existing Corvus Vercel project. The protected route reads
`OPENRISK_PASSWORD` and `OPENRISK_SESSION_KEY` on the server and reuses the
existing Redis connection for demo workspaces. The offline catalog is bundled
with the function. Run `node tools/openrisk-discover.mjs` for public directory
discovery, `node tools/openrisk-wikidata.mjs` for Wikidata city seeds, and
`node tools/openrisk-preload.mjs` for the curated signal snapshot and prior sweep.
PDF and XLSX attachments are decoded in the browser. The browser smoke script is `node tools/openrisk-smoke.mjs` and takes
`OPENRISK_TEST_PASSWORD` via the environment. See [DEMO.md](DEMO.md),
[DECISIONS.md](DECISIONS.md), and [RUST_PLAN.md](RUST_PLAN.md).

Refresh the public company detail snapshot with `node tools/openrisk-enrich-catalog.mjs`.
Then run `node tools/openrisk-import-logos.mjs` to cache missing logos.

## How to demo in 60 seconds

Open the [vertical autoplay demo](https://corvus.gent/hackersbay/demo?format=vertical) at 1080 × 1920 or the [widescreen autoplay demo](https://corvus.gent/hackersbay/demo?format=wide) at 1920 × 1080. The timed sequence plays on load and holds the end card at 60 seconds. Press **R** to restart, **Space** to pause or resume, or **M** to toggle sound.

For Demo Day, [play or download the two-minute pitch and compare the three vertical cuts](https://corvus.gent/hackersbay/cuts). The [live talk track](SHOTLIST.md#two-minute-live-talk-track) follows the widescreen pitch.

For a live walkthrough on a phone:

1. **0–10s** Open [The Hackers Bay](https://corvus.gent/hackersbay) on a phone. Show The Black Commit firing at the grey rowboat.
2. **10–20s** Tap **Board the ship**, choose **Deckhand**, roll a new outfit, and tap **Raise the flag**. Captain Squawk can read a public link to draft Builds, Wants, and Offers.
3. **20–35s** Point to the **Survival score** and Captain Squawk flying between the three spyglass masts. Tap a gold X for both sides of the match.
4. **35–50s** Tap **Intro me**, open the fictional recipient view, and tap **Accept intro**. Show **IT’S MUTUAL ⚓**, the parrots’ beak bump, and the suggested meetup.
5. **50–60s** Flip to [Room composer](https://corvus.gent/hackersbay/host) or [Treasure report](https://corvus.gent/hackersbay/sponsor) to show what hosts and sponsors see.

The official Demo Day is invite-only. The app links to official registration, and the in-app roster, traction, scores, and introductions are fictional. Dates and suggested times use Pacific Time.

### Hackers Bay integrations

The demo works with zero new variables. Set credentials server-side in the Corvus Vercel project.

| Purpose | Environment variables |
| --- | --- |
| Public profile reader | `CONTEXT_DEV_API_KEY` |
| Standard AI persona drafting | `HACKERSBAY_OPENAI_API_KEY`, optionally `HACKERSBAY_OPENAI_MODEL` (default `gpt-4.1-mini`) |
| Confidential persona drafting | `TRUSTEDROUTER_API_KEY` or `NYTEX_TRUSTEDROUTER_API_KEY`, optionally `HACKERSBAY_TRUSTEDROUTER_MODEL` (default `nyte/trusted`) |
| Parrot race sandbox | `HACKERSBAY_RACE_PROVIDER=boat`, `BOAT_DEV_API_KEY` or `BOAT_API_KEY`, plus Redis for the race budget |
| Live Proof of Build | `BOAT_DEV_API_KEY` or `BOAT_API_KEY`, plus `HACKERSBAY_BOAT_REPOS` (comma-separated public `owner/repo` values) |
| Shareable intros, organizer rosters, live crew counts, and preview job cache | The existing Corvus Redis connection, such as `REDIS_TLS_URL` or `REDIS_URL` |

### Straight talk

- Private Parrot mode sends the public-profile excerpt through our server over HTTPS to NYTEX TrustedRouter’s confidential inference route. The creator checks the signed receipt for the original draft with TrustedRouter’s SDK. A verified receipt establishes origin and integrity. [TrustedRouter receipt docs](https://trustedrouter.com/docs/receipts)
- With no TrustedRouter key, Private Parrot makes a local suggestion from the link. Standard scouting uses Context.dev to read a public page, then runs a fixed excerpt-processing job in a short-lived Boat.dev VM. Live scouting uses the Redis-backed budget. The parrot log identifies provider results and demo runs.
- Proof of Boat runs approved repos with credentials or opens a sample sandbox preview. With Redis, mutual intros can span browsers. The event details are public and the suggested crewmates, match reasons, and meetup times are staged.

[Build log](https://corvus.gent/hackersbay/log) · [Parrot race](https://corvus.gent/hackersbay/race) · [Earlier demo clips](https://github.com/Corvus-gent/loading-website/releases/tag/hackersbay-demo-v0.1.0) · [Remotion project](video/README.md) · [Shot list](SHOTLIST.md) · [Compound edit brief](COMPOUND_PROMPT.md) · [LinkedIn drafts](LINKEDIN.md)

Native Mac app: in the repo ([apps/macos](apps/macos/)), launching later.

## First launch on macOS

In Finder, right-click **HackersBay.app** and choose **Open**. If Gatekeeper blocks it, try launching once, then go to **System Settings → Privacy & Security → Open Anyway**. The builds use ad hoc signing and ship without Apple notarization.

## For terminal pirates

Curl, wget, and HTTPie get Captain Squawk and The Black Commit in ANSI art over HTTPS. Use `curl -L` with a bare hostname to follow the edge redirect. The API returns plain text by default. Add `?json` or `&json` to get structured output. Add `?color=0` to disable ANSI art.

```sh
curl -L corvus.gent/hackersbay
curl 'https://corvus.gent/hackersbay/api/pirate?class=deckhand&json'
curl https://corvus.gent/hackersbay/api/crew
curl 'https://corvus.gent/hackersbay/api/event/boat-hackathon?lens=navigator'
curl 'https://corvus.gent/hackersbay/api/match?me=deckhand'
curl -L corvus.gent/hackersbay/squawk
curl -LN corvus.gent/hackersbay/sink/luma
curl -L corvus.gent/hackersbay/ayay
curl -L corvus.gent/hackersbay/race
```

`me` accepts a class or nickname. To choose a lens for a nickname, send `class` as well. Match reasons come from the fictional Demo Day roster. The crew API reports the same live Redis counters as the website.

The zero-dependency `hackersbay` CLI is ready to package. It has not been published to npm. Run it from the checkout with Node.js 20 or later.

```sh
npx --package ./apps/cli hackersbay
npx --package ./apps/cli hackersbay --class deckhand --name "Copper Byte" --quick
```

Use the arrow keys to change the class and kit. Press Enter for your matches and a share link that opens the exact kit in the browser. The CLI falls back to the bundled Demo Day roster offline.

The browser has hidden cues. Type **ayay** to get a salute from Captain Squawk, an **AYE AYE!** from the crew, and a burst of confetti. Use **↑ ↑ ↓ ↓ ← → ← → B A** for parrot rain, type **ahoy** for a one-shot sea shanty, or open the [creator with Captain Trav’s hat](https://corvus.gent/hackersbay/board?captain=trav). The [Historic Klamath’s hidden ship log](https://corvus.gent/hackersbay/klamath) traces the ferry’s history at Pier 9.

The [native SwiftUI Mac app](apps/macos/) adds menu-bar Captain Squawk, mutual intro notifications, and a **Sink Luma** replay.
