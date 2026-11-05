# corvus.gent

Gabriel’s personal site brings together daily browser games, a community music ranking and a public dashboard for traffic and service health. The frontend uses plain HTML, CSS and JavaScript. Vercel Functions handle the APIs, Redis stores game and voting data, and PostHog supplies traffic statistics.

- [Visit corvus.gent](https://corvus.gent)
- [Explore the public stats](https://stats.corvus.gent)
- [Check service health](https://stats.corvus.gent/status)

For a local preview of the static pages, run `node tools/serve.mjs` and open `http://127.0.0.1:4176`. The API routes run on Vercel.
