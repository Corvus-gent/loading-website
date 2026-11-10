# corvus.gent

Gabriel’s personal site brings together daily browser games, a community music ranking and a public dashboard for traffic and service health. The frontend uses plain HTML, CSS and JavaScript. Vercel Functions handle the APIs, Redis stores game and voting data, and PostHog supplies traffic statistics.

- [Visit corvus.gent](https://corvus.gent)
- [Explore the public stats](https://stats.corvus.gent)
- [Check service health](https://stats.corvus.gent/status)

For a local preview of the static pages, run `node tools/serve.mjs` and open `http://127.0.0.1:4176`. The API routes run on Vercel.

## Muse branch setup

Use Node 22.12+ and Python 3. Install with `npm install`, then `npm run build`.
The build regenerates navigation, routes, sharing cards, search and the bundled
HTML sanitizer. Serve static pages with the command above; `npx vercel dev`
runs the Vercel APIs with your local environment. Never commit `.env*`.

### Services and environment

- `REDIS_URL`: encrypted Redis connection; existing REST Redis configuration also works.
- `SESSION_SECRET`: dedicated signing secret; existing secure credential derivation is retained.
- `OPENROUTER_API_KEY`: server-only. The Nest only calls `meta/muse-ember`, at most 6,000 tokens.
- `NEST_BUDGET_USD`: cumulative reserved/spent fund, default **3**, not an automatic daily refill.
- `NEST_NAMESPACE`: optional isolated test namespace. Preview and production are separate by default.
- `ADMIN_KEY`: Legion administration and Nest daily-limit bypass. The bypass never ignores the fund.
  Existing `ADMIN_PASSWORD` remains supported for Legion administration.
- `LEGION_PAYMENT_LINK_TEST`, `LEGION_PAYMENT_LINK_ID_TEST`,
  `LEGION_STRIPE_WEBHOOK_SECRET_TEST`: all required for preview checkout.
  Production uses the corresponding `_LIVE` variables. Webhook: `/api/legion-payment`.
  Configure Stripe's return link as `/legion/?paid={CHECKOUT_SESSION_ID}` on the appropriate host.
- `RESEND_API_KEY`: existing mail delivery for reviewed Legion applications.

`api/stats.js` routes Nest, Legion and I Don't Pay requests to shared handlers.
Nest reservations are atomic Redis transactions, counted before an API call.
Unknown provider costs retain the worst-case reservation. A 402 pauses calls for
one hour without retries. Saved pages expire after 90 days and render only inside
a static sandbox: no scripts, forms, third-party assets or parent access.

The original Muse-generated experiment lives at `/nest/v0/`. The new interface
and safety layer were integrated by Codex; generated live pages come from Muse.
The three new game frontends are **not shipped**. `api/_nest/games.js` is preserved
unfinished work and is deliberately not wired into the API.

### Verification

- `npm run test:muse` and `npm run test:dontpay` cover existing pages and the series.
- `node tests/legion-night.mjs` and `node tests/nest-night.mjs` use disposable
  namespaces on local Redis at `127.0.0.1:16380`; they never call paid models.
- Start `QA_ALL_ROUTES=1 node tools/stats-fixture.mjs . 8793`, then use
  `npm run qa:routes`, `npm run qa:links` and `npm run qa:lighthouse`.
- Browser integration: with that fixture running, start
  `NIGHT_MOCK_AI=1 node tools/night-server.mjs`, then run
  `node tests/legion-night-browser.mjs` and `node tests/nest-night-browser.mjs`.
- `tools/nest-smoke.mjs` makes **one paid** Ember call when explicitly invoked;
  it never retries. It requires the existing key in the shell.

See [ROUTES.md](ROUTES.md) for the page map and [NIGHT_LOG.md](NIGHT_LOG.md)
for measured results, limitations and the unfinished backlog.
