# Architecture

This describes the combined code from PRs #70–#81, including their integration fixes.
Corvus is static HTML with browser ES modules, Vercel middleware/functions and Redis.
There is no SPA router. `vercel.json` sets the build command and URL rules;
production branch tracking is a Vercel project setting.

## Folder map

| Path | Purpose |
| --- | --- |
| `index.html`, page folders such as `realm/`, `daily/`, `wiki/` | Static pages; some are build outputs. |
| `public/` | Gate HTML, photos, video and other assets, referenced with `/public/...` URLs. |
| `img/`, `css/`, `js/` | Shared images, styles and browser code. |
| `js/site/` | Shell, discovery, actions, Legion UI, reading timer and daily retention. |
| `js/i18n/`, `js/locales/` | Shared UI additions, translation engine and older locale dictionaries. |
| `stats/` | Pages/assets served on `stats.corvus.gent`. |
| `api/` | Function entry points, feature handlers and Redis helpers. |
| `api/_legion/`, `api/_army/` | Legion features and the underlying account/perk store. |
| `data/`, feature JSON files | Public content snapshots and hand-maintained content/configuration. |
| `tools/`, `tools/site/`, `tools/templates/` | Generators, audits and local test server. |
| `tests/`, `.github/workflows/` | Automated checks and GitHub jobs. |

## Build pipeline and source ownership

Vercel runs `node tools/site/build-all.mjs`, in this exact order:

1. `tools/plethora/verify-routes.mjs`: verify official Plethora destinations.
2. `tools/build-gabinho-rolls.mjs`: fill photo/video slots in `gabinho-rolls/index.html`.
3. `tools/build-battle.mjs`: generate `battle/media.json` from available video files.
4. `tools/build-hackathons.mjs`: use `hackathons/teams.json` and
   `tools/templates/hackathons.html.tmpl`; also update the squad slot in `hack/1/index.html`.
5. `tools/build-plethora.mjs`: update the generated game catalogue in `games/index.html`.
6. `tools/site/build.mjs`: generate hubs/pages, public directory and shared page chrome.
7. `tools/site/seo.mjs`: apply main-page metadata/noindex and generate per-host sitemaps/robots.
8. `tools/build-search.py`: generate `search-index.json` from page sources.
9. `tools/site/performance.mjs`: generate small logo/favicon and responsive photo assets;
   patch image attributes in the selected home/gate, Realm, Legion, Gabe, Daily and SF pages.

Keep this order: site generation must precede SEO, and image rewriting runs last.
`sharp` is an existing dependency used by SEO/image processing.

Edit source templates/data rather than generated copies:

- `tools/site/build.mjs` owns the portal `index.html`, `gabe/index.html`,
  `daily/index.html`, `quests/index.html`, `map/index.html`, `sf/larp/index.html`
  and the two Legion reading-room pages. SF photo content comes from `sf/larp/photos.json`.
- Other HTML, including the flyer and generals articles, is hand-written, but the builder
  adds/replaces marked shell, navigation, footer and directory blocks. It also transforms
  parts of the existing Legion page and adds action links to `public/realm-entry.html`.
- `js/site/routes.js` contains hand-written `SECTIONS` and `CURATED_ROUTES`.
  Its exported `ROUTES` comes from generated `js/site/routes.generated.js`.
- `tools/site/link-inventory.mjs` discovers HTML plus public video/profile records from
  `data/site-public-content.json`. `tools/site/generate-directory.mjs` writes
  `site-directory.json` and `js/site/routes.generated.js`.
- `search-index.json`, root/stats `sitemap.xml` and `robots.txt`, and `img/performance/`
  are build outputs. Original images remain available for share previews.
- `data/daily-changelog.json` is hand-maintained, with real publication dates,
  translation keys and local destinations. Keep its list to 3–5 recent changes.

Builds modify many tracked HTML files. Review source changes separately from generated churn.

## URLs, gate and reading access

`vercel.json` handles static aliases and function rewrites. `middleware.js` adds
host routing, canonical redirects, the entry gate, reading access and noindex headers.
`api/stats.js` dispatches multiplexed feature requests; for example `/api/legion`
rewrites to `/api/stats?legion=1`, then `api/_legion/handler.js`.

For normal browser GET/HEAD requests to `/`, middleware checks `corvus_realm=1`:
without it, serve `public/realm-entry.html`; with it, serve the generated portal.
`js/portal.js` writes this Secure, SameSite cookie when entering, expiring at the
next visitor-local 04:02 using `js/realm-reset.js`. It also handles history restores.
The entry cookie is a presentation gate, not proof of membership.

Reading access is separate. `js/site/page-tiers.js` lists protected canonical paths;
unlisted pages are public. Middleware sends listed paths to the Legion layer handler.
`api/_legion/layers.js` validates signed HttpOnly `corvus_layer` sessions and current
account/subscriber status. Hiding a browser control does not enforce access.

Visitors below the soldier tier get a shared 242-second active-reading allowance
on soldier pages. Redis meters the union of active tabs, with short leases;
`js/site/taste-zone.js` establishes the timezone and `js/site/taste.js` updates the clock.
The server pins the timezone and resets the allowance at local 04:02.
Exhaustion returns real HTTP 402. Other unmet layers return 403 with a next step.
The decorative `/402/` page is separate from this server response.

There are several clocks; do not silently substitute one for another:

- Realm entry: browser-local 04:02 (`js/realm-reset.js`).
- Reading allowance: server-pinned visitor timezone, 04:02 (`api/_legion/layers.js`).
- Daily retention card: local 04:02 (`js/site/daily-state.js`).
- Puzzle rotation: Brussels calendar midnight (`api/_game.js`, `dateKey`).

`js/site/indexing.js` defines noindex rules for private/admin/account workflows,
protected reading paths and sensitive query parameters. Middleware emits
`X-Robots-Tag`; the SEO build also writes HTML directives and excludes these URLs
from sitemaps. Noindex is not authentication. Robots files allow crawlers to read directives.

On `stats.corvus.gent`, `/` and supported clean section URLs rewrite into `stats/`.
File-form `index.html` links redirect to clean URLs. Main-host `/stats/...` redirects
onto the stats host; unrelated page paths on the stats host redirect to the main host.
Stats has its own generated robots/sitemap files. See `middleware.js` and `tests/routes.mjs`.

## Tiers, ranks and accounts

Tiers are access levels: `visitor`, `email`, `soldier`, `hacker`, `call`.
`js/site/page-tiers.js` maps namesakes to email, Corvus/Pidgy articles to soldier,
Hacker Room to hacker and Call Room to call.

Ranks live in `js/site/legion-config.js`: tiro, miles, centurio, legatus, praetor,
senator, consul, imperator. `api/_legion/store.js` grants/stores them through the
army account store. `api/_legion/layers.js` maps member ranks to access:
centurio gets hacker; legatus/praetor and higher get call; other members get soldier.
Confirmed subscribers and verified non-member accounts can get email access.

Tiro starts with the verified $1 payment. Higher ranks are earned/granted by Gabe;
praetor means meeting in person. Supporter perks and Legion ranks are separate concepts.
Changing descriptive tier text alone does not change server authorization.

## Translation and shared UI

`js/i18n/language.js` chooses `?lang=`, saved preference, then browser language.
`js/storage.js` persists the choice in the language cookie and functional localStorage.
The engine merges `js/locales/<lang>.js` with `js/i18n/site-copy.js` additions.
`js/i18n/bar.js` moves/creates the shared language control and loads its CSS.

To add shared copy, add one row to `site-copy.js`, in this exact column order:
`en`, `nl`, `es`, `fr`, `pt`, `de`, `zh`. Keep values plain text and names/brands intact.
Use `data-i18n="feature.key"`, `data-i18n-placeholder` or `data-i18n-aria-label`.
For `{count}`-style tokens, provide `data-i18n-count`; keep token names in every language.
For client-created text, use `t(key)` and refresh on `corvus-language-change`.

`js/i18n/page-copy.js` binds exact English text to runtime hooks on its listed page
families, including `/now`. Its observer handles later copy changes without replacing
links/forms. It deliberately excludes tier contents. Prefer explicit hooks for new markup;
late-created UI outside these roots must arrange its own initial translation/refresh.
`tests/site/site-copy.mjs` checks all seven columns, plain text and matching tokens.

`js/site/discovery.js` loads the public catalogue for navigation/search and refreshes
public records. It conditionally loads `js/site/calm-pages.js` for Quests, the map and
three Support directories; disclosures preserve links and open search matches.

## Actions, payment and daily retention

`js/site/action-config.js` supplies shared Enlist/Book a call links and `PAYMENT_URL`.
An empty `PAYMENT_URL` preserves environment-based checkout. A nonempty value overrides
only LIVE checkout; it must be an HTTPS Stripe Payment Link on `buy.stripe.com`.

`api/_legion/payments.js` defaults to LIVE only for `VERCEL_ENV=production`, otherwise
TEST; `LEGION_STRIPE_MODE` can select explicitly. Configure matching variables:
`LEGION_PAYMENT_LINK_LIVE`, `LEGION_PAYMENT_LINK_TEST`,
`LEGION_PAYMENT_LINK_ID_LIVE`, `LEGION_PAYMENT_LINK_ID_TEST`,
`LEGION_STRIPE_WEBHOOK_SECRET_LIVE`, `LEGION_STRIPE_WEBHOOK_SECRET_TEST`.
The `/api/legion/stripe` rewrite enters `api/bmc-webhook.js` and the Stripe verifier.
Admission requires a valid signature, matching mode/link, paid USD 100 cents and a
stored checkout reference. A browser return URL alone never grants Tiro.

`/call/` uses the existing support booking flow (`js/support.js`, `api/_support.js`).
Letters signup is the optional email path, not a second booking/payment system.

`js/games.js` records a retention marker in the existing `daily-games` preference
when a completed puzzle is observed. `js/site/daily-retention.js`, loaded by
`js/site/daily.js`, shows the streak/teaser below the surf note, reads the static
changelog and stores `daily-last-visit` locally. The latest unseen change gets a link.
The reminder opens the existing `#signup` form. No new analytics event or email job is added.

## Letters and staged re-engagement

`api/_legion/newsletter.js` stores pending/confirmed subscribers in Redis with hashed
token lookups, confirmation/restore links and unsubscribe tokens. No confirmation means
no regular transmissions. `js/site/letters.js` handles confirmation/unsubscribe screens.
`api/_legion/mail.js` uses Resend (`RESEND_API_KEY`), idempotency keys and an 80/day cap;
`LEGION_TEST_MAIL=1` mocks delivery. In this baseline the From address is hard-coded
as `Corvus <crow@corvus.gent>`; configurable reply-to is not yet merged.

Re-engagement is staged separately on `claude/re-engage`, outside #70–#81.
Its `api/_legion/re-engage-config.js` defaults `RE_ENGAGE_ENABLED=false`;
enabling requires production plus the explicit environment flag. The proposed cron
route (`api/re-engage.js`) authenticates with `CRON_SECRET` and dry-runs while off.
It targets confirmed subscribers after 7/14/30 days, caps mail at one per 14 days,
and includes unsubscribe links. Planned identity settings are `LEGION_MAIL_FROM`
and `LEGION_MAIL_REPLY_TO`. That branch's `docs/RE-ENGAGEMENT.md` covers setup.
This merged baseline has no re-engagement route, cron or loaded client beacon;
the separately prepared client flag/confirmed-subscriber wiring must also land before use.

## Tests and CI

Use Node 20 (as CI does), Python 3 and `npm ci`. Browser tests need
`npx playwright install chromium`; Linux may also need Playwright system dependencies.
For a focused local check after source edits:

```sh
node tools/site/build-all.mjs
node tools/check-locales.mjs
node tests/routes.mjs
node tests/realm-ritual.mjs
node tests/site/payment-url.mjs
node tests/site/site-copy.mjs
node tests/site/daily-retention.mjs
node tests/site/seo.mjs
node tests/site/performance.mjs
```

SEO/performance tests rewrite build outputs. Retention tests use Node only, including DST.
For server/browser flows, use disposable Redis at `127.0.0.1:16380`; tests can clear
numbered test databases. In one terminal:

```sh
REDIS_URL=redis://127.0.0.1:16380/4 SITE_TEST_PORT=4477 node tools/site/server.mjs
```

In another terminal:

```sh
REDIS_URL=redis://127.0.0.1:16380/4 SITE_TEST_ORIGIN=http://127.0.0.1:4477 node tests/site/layers.mjs
SITE_TEST_ORIGIN=http://127.0.0.1:4477 node tests/site/browser.mjs
npm run test:games
```

The server is a test harness with mocked mail/test payments and partial routing,
not a Vercel middleware emulator. `tests/realm-ritual.mjs` exercises middleware directly.
`.github/workflows/checks.yml` runs on PRs and codex/claude/daily branch pushes:
syntax, feature locales, routes, realm, payment URL, Redis-backed feature/account checks,
Playwright feature flows, the DB-4 layer test, link checks and search-index generation.
It does not currently run the full build or the SEO, performance, site-copy or retention tests;
run those explicitly. `build-ledger.yml` verifies/publishes ledger snapshots on its push,
hourly and manual triggers; `location.yml` manually commits `location.json` updates.

## Add a page

1. Choose hand-written `<folder>/index.html` or a generator/template owner above.
2. Give the page a canonical route. Add curated metadata/section in `js/site/routes.js`
   where useful; add `vercel.json`/middleware rules only for aliases or dynamic routes.
3. Add explicit seven-language UI hooks/rows. Preserve names, links and form controls.
4. Set unique title, description, canonical and share metadata. For a new main page,
   add a row to `tools/site/seo.mjs`; other pages keep hand-written head metadata.
5. Add reading restrictions in `page-tiers.js` only when intended. For private workflows,
   check both inventory `PRIVATE` and `indexing.js` rules, plus actual authentication.
6. Run the build. Confirm discovery in `site-directory.json`, the map and search;
   never hand-edit `routes.generated.js`, generated map HTML or the search index.
7. Supply image dimensions, lazy-load below-fold media and version changed CSS/JS URLs.
8. Run focused tests and inspect seven languages at 390/1440px, keyboard navigation,
   console errors and links. Add a regression test for meaningful new behavior.
9. If announcing the change, update `data/daily-changelog.json`, its seven-language
   keys and retention test expectations, keeping 3–5 real entries.
