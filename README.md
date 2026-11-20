# corvus.gent

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

Open the [vertical autoplay demo](https://corvus.gent/hackersbay/demo?format=vertical) at 1080 × 1920 or the [widescreen autoplay demo](https://corvus.gent/hackersbay/demo?format=wide) at 1920 × 1080. The timed sequence plays on load and holds the end card at 60 seconds. Press **R** to restart or **Space** to pause and resume.

For a live walkthrough on a phone:

1. **0–10s** Open [The Hackers Bay](https://corvus.gent/hackersbay) on a phone. Show the guest wall next to three people with reasons to meet.
2. **10–20s** Tap **Board the ship**, choose **Broke hacker**, and tap **Find my 3 people**. Paste a public profile if you want to show the editable crew card being drafted.
3. **20–35s** Point to the **Survival score** and tap the first gold X on the sonar. Read **Why you’d meet** and **Why they’d meet**.
4. **35–50s** Tap **Intro me**, open the fictional recipient view, and tap **Accept intro**. Show **IT’S MUTUAL ⚓** and the suggested meetup.
5. **50–60s** Flip to [Room composer](https://corvus.gent/hackersbay/host) or [Treasure report](https://corvus.gent/hackersbay/sponsor) to show what hosts and sponsors see.

The official Demo Day is invite-only. The app links to official registration, and the in-app roster, traction, scores, and introductions are fictional. Dates and suggested times use Pacific Time.

### Hackers Bay integrations

The demo works with zero new variables. Set credentials server-side in the Corvus Vercel project.

| Purpose | Environment variables |
| --- | --- |
| Public profile reader | `CONTEXT_DEV_API_KEY` |
| Standard AI persona drafting | `HACKERSBAY_OPENAI_API_KEY`, optionally `HACKERSBAY_OPENAI_MODEL` (default `gpt-4.1-mini`) |
| Confidential persona drafting | `TRUSTEDROUTER_API_KEY` or `NYTEX_TRUSTEDROUTER_API_KEY`, optionally `HACKERSBAY_TRUSTEDROUTER_MODEL` (default `trustedrouter/confidential`) |
| Live Proof of Build | `BOAT_DEV_API_KEY` or `BOAT_API_KEY`, plus `HACKERSBAY_BOAT_REPOS` (comma-separated public `owner/repo` values) |
| Shareable intro links and preview job cache | The existing Corvus Redis connection, such as `REDIS_TLS_URL` or `REDIS_URL` |

Without provider keys, profile drafting uses heuristics, Private mode shows a demo badge, and Proof of Build opens the Dockside sample. Without Redis, both intro steps work in the same browser. Live Boat previews support static sites and Vite or Next.js apps with a `dev` script. The sandbox expires after 15 minutes.

[Build log](https://corvus.gent/hackersbay/log) · [Mac app and demo clips](https://github.com/Corvus-gent/loading-website/releases/tag/hackersbay-demo-v0.1.0) · [Remotion project](video/README.md) · [Shot list](SHOTLIST.md) · [Compound edit brief](COMPOUND_PROMPT.md) · [LinkedIn drafts](LINKEDIN.md)
