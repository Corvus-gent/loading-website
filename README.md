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
discovery and `node tools/openrisk-preload.mjs` for the curated signal snapshot.
PDF and XLSX attachments are decoded in the browser. The browser smoke script is `node tools/openrisk-smoke.mjs` and takes
`OPENRISK_TEST_PASSWORD` via the environment. See [DEMO.md](DEMO.md),
[DECISIONS.md](DECISIONS.md), and [RUST_PLAN.md](RUST_PLAN.md).
