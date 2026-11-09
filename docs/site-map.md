# Site map audit

## Before: baseline inventory

Baseline commit: `5eda7e462a935af0ecbe7a7ed24ee12cc3e22fcc`. This section reads the immutable baseline and remains comparable after implementation.

Read every tracked HTML file and route configuration from immutable git HEAD. Traverse anchor hrefs, meta refreshes, registered exact aliases, dynamic templates, and both first-party hosts. Do not execute client JavaScript, contact APIs, or treat noindex as access control. Hidden links are counted as source links. Queries/fragments collapse for page connectivity.

Inventoried **85 HTML documents**, including **64 public documents**. **63 HTML documents** are reached in the static homepage graph; **8 public documents** are outside it. The machine-readable inventory is `docs/site-map-before.json`.

### Proposed five-section ownership

| Section | Primary destinations and scope |
| --- | --- |
| Quests | Sidequests, hackathons and builds, OSSMAN project, Compound and Battle; retain old campaign URLs. |
| Daily | Daily games, arcade, music, languages, Plethora. The eight rotating games all use `/games/`. |
| Legion | Legion, recruitment, war room, members, wiki, realm, public soldier profiles. Account and admin screens remain out of the public directory. |
| Live | Live broadcast, build dashboard, public statistics and service status. Keep stats-host routes distinct from root routes. |
| Gabe | About, now, links, contact/coffee, SF, support, dinner, Gabinho Rolls, privacy. |

### Every baseline HTML route

“Reached” describes static source links, including hidden links. “Exception” pages stay routable but should not be promoted in the public directory.

| Route | Section | Reached | Audience / exception | Source |
| --- | --- | --- | --- | --- |
| `/402` | Daily | yes | public | `402/index.html` |
| `/404.html` | Gabe | no | system-template-or-redirect | `404.html` |
| `/airbnb-call-me-pls` | Gabe | yes | personal-unlisted | `airbnb-call-me-pls/index.html` |
| `/airbnb-filter` | Gabe | yes | public | `airbnb-filter/index.html` |
| `/airbnb` | Gabe | no | personal-unlisted | `airbnb/index.html` |
| `/army/access` | Legion | yes | private-admin-account-or-operator | `army/access/index.html` |
| `/army` | Legion | yes | public | `army/index.html` |
| `/battle/admin` | Quests | no | private-admin-account-or-operator | `battle/admin/index.html` |
| `/battle` | Quests | no | public | `battle/index.html` |
| `/build` | Live | yes | public | `build/index.html` |
| `/call/admin` | Gabe | no | private-admin-account-or-operator | `call/admin/index.html` |
| `/call` | Gabe | yes | public | `call/index.html` |
| `/clients/aurus/v0` | Quests | no | client-preview | `clients/aurus/v0/index.html` |
| `/clients/aurus/v1.0-more-okergeel-grijs` | Quests | no | client-preview | `clients/aurus/v1.0-more-okergeel-grijs/index.html` |
| `/clients/aurus/v1.1-diff-colorpallete` | Quests | no | client-preview | `clients/aurus/v1.1-diff-colorpallete/index.html` |
| `/compound/admin` | Quests | no | private-admin-account-or-operator | `compound/admin/index.html` |
| `/compound` | Quests | yes | public | `compound/index.html` |
| `/compound/rules` | Quests | yes | public | `compound/rules/index.html` |
| `/compound/stats` | Quests | no | private-admin-account-or-operator | `compound/stats/index.html` |
| `/compound/v2` | Quests | yes | public | `compound/v2/index.html` |
| `/compound/v2/links` | Quests | yes | private-admin-account-or-operator | `compound/v2/links/index.html` |
| `/compound/v2/stats` | Quests | yes | private-admin-account-or-operator | `compound/v2/stats/index.html` |
| `/dinner` | Gabe | no | public | `dinner/index.html` |
| `/gabe` | Gabe | no | public | `gabe/index.html` |
| `/gabinho-rolls` | Gabe | no | public | `gabinho-rolls/index.html` |
| `/games/hub` | Daily | yes | public | `games/hub/index.html` |
| `/games` | Daily | yes | public | `games/index.html` |
| `/go` | Gabe | no | system-template-or-redirect | `go/index.html` |
| `/hack/1` | Quests | yes | public | `hack/1/index.html` |
| `/hack/1/the-feed` | Quests | yes | public | `hack/1/the-feed/index.html` |
| `/hack/2` | Quests | no | public | `hack/2/index.html` |
| `/hack/3/add` | Quests | yes | private-admin-account-or-operator | `hack/3/add/index.html` |
| `/hack/3` | Quests | yes | public | `hack/3/index.html` |
| `/hack` | Quests | yes | public | `hack/index.html` |
| `/hack/play` | Quests | yes | public | `hack/play/index.html` |
| `/hack/the-feed` | Quests | no | public | `hack/the-feed/index.html` |
| `/hackathons` | Quests | yes | public | `hackathons/index.html` |
| `/hackthefeed/2` | Quests | yes | public | `hackthefeed/2/index.html` |
| `/hackthefeed` | Quests | yes | public | `hackthefeed/index.html` |
| `/` | Gabe | yes | public | `index.html` |
| `/join-the-army-now` | Legion | yes | public | `join-the-army-now/index.html` |
| `/languages` | Daily | yes | public | `languages/index.html` |
| `/legion` | Legion | yes | public | `legion/index.html` |
| `/links/corvus` | Gabe | yes | public | `links/corvus/index.html` |
| `/links` | Gabe | yes | public | `links/index.html` |
| `/links/pidgy` | Gabe | yes | public | `links/pidgy/index.html` |
| `/live` | Live | yes | public | `live/index.html` |
| `/live/overlay` | Live | no | private-admin-account-or-operator | `live/overlay/index.html` |
| `/music/admin` | Daily | yes | private-admin-account-or-operator | `music/admin/index.html` |
| `/music` | Daily | yes | public | `music/index.html` |
| `/now` | Gabe | yes | public | `now/index.html` |
| `/people` | Gabe | yes | public | `people/index.html` |
| `/plethora/admin` | Daily | no | private-admin-account-or-operator | `plethora/admin/index.html` |
| `/plethora` | Daily | no | public | `plethora/index.html` |
| `/plethora/stats` | Daily | no | public | `plethora/stats/index.html` |
| `/privacy` | Gabe | yes | public | `privacy/index.html` |
| `/push` | Quests | yes | public | `push/index.html` |
| `/realm` | Legion | yes | public | `realm/index.html` |
| `/sf` | Gabe | yes | public | `sf/index.html` |
| `/sidequests` | Quests | yes | public | `sidequests/index.html` |
| `/soldier` | Legion | no | system-template-or-redirect | `soldier/index.html` |
| `https://stats.corvus.gent/army` | Live | yes | public | `stats/army/index.html` |
| `https://stats.corvus.gent/coffee` | Live | yes | public | `stats/coffee/index.html` |
| `https://stats.corvus.gent/games` | Live | yes | public | `stats/games/index.html` |
| `https://stats.corvus.gent/hack` | Live | yes | public | `stats/hack/index.html` |
| `https://stats.corvus.gent/hunt` | Live | yes | public | `stats/hunt/index.html` |
| `https://stats.corvus.gent/` | Live | yes | public | `stats/index.html` |
| `https://stats.corvus.gent/map` | Live | yes | public | `stats/map/index.html` |
| `https://stats.corvus.gent/music` | Live | yes | public | `stats/music/index.html` |
| `https://stats.corvus.gent/pidgy` | Live | yes | public | `stats/pidgy/index.html` |
| `https://stats.corvus.gent/private` | Live | yes | private-admin-account-or-operator | `stats/private/index.html` |
| `https://stats.corvus.gent/status` | Live | yes | public | `stats/status/index.html` |
| `https://stats.corvus.gent/x` | Live | yes | public | `stats/x/index.html` |
| `/submission` | Quests | no | submission-build | `submission/index.html` |
| `/support/books` | Gabe | yes | public | `support/books/index.html` |
| `/support/companies` | Gabe | yes | public | `support/companies/index.html` |
| `/support/founders` | Gabe | yes | public | `support/founders/index.html` |
| `/support` | Gabe | yes | public | `support/index.html` |
| `/support/people` | Gabe | yes | public | `support/people/index.html` |
| `/support/philosophists` | Gabe | yes | public | `support/philosophists/index.html` |
| `/support/sport-people` | Gabe | yes | public | `support/sport-people/index.html` |
| `/wiki/corvus` | Legion | yes | public | `wiki/corvus/index.html` |
| `/wiki/corvus/namesakes` | Legion | yes | public | `wiki/corvus/namesakes/index.html` |
| `/wiki` | Legion | yes | public | `wiki/index.html` |
| `/wiki/pidgy` | Legion | yes | public | `wiki/pidgy/index.html` |

### Public pages outside the static homepage graph

- `https://corvus.gent/battle` — CODEX vs COMPOUND 🥊 Submission only round
- `https://corvus.gent/dinner` — Buy me dinner in SF 🍜 | corvus
- `https://corvus.gent/gabe` — Gabe | corvus.gent
- `https://corvus.gent/gabinho-rolls` — Gabinho Rolls · competitor on the road | corvus
- `https://corvus.gent/hack/2` — Vote: name the new MMA arcade game
- `https://corvus.gent/hack/the-feed` — Try HackTheFeed · early beta
- `https://corvus.gent/plethora` — Get Plethora · games worth keeping | corvus
- `https://corvus.gent/plethora/stats` — Corvus × Plethora · live referral stats

### Existing redirects and aliases

All Vercel redirect/rewrite definitions, middleware aliases, API entry points, and dynamic route families are recorded in the JSON baseline. The inventory preserves both source and destination, rather than assuming canonical tags change navigation.

- `/livenow` → `/live` (temporary)
- `/livenow/` → `/live` (temporary)
- `/whitebelt` → `/hack/play` (temporary)
- `/prize` → `/compound` (temporary)
- `/1000` → `/compound` (temporary)
- `/gabe` → `/people/?id=gabe` (temporary)
- `/gabriel` → `/people/?id=gabe` (permanent)
- `/links` → `/links/gabe` (temporary)
- `/cv/gabriel.pdf` → `/cv` (permanent)
- `/self` → `/?utm_source=self&utm_medium=share&utm_campaign=home-share` (temporary)

Middleware also handles `/squads`, `/sidequest`, company attribution URLs, call/coffee aliases, compound campaign aliases, `/v/:slug`, `/c/:code`, and several `/go/*` families. Root `/stats/*` redirects permanently to `stats.corvus.gent/*`; the stats host rewrites its clean URLs to the corresponding `stats/` documents.

### Dynamic route families

- `/games/` — daily game state. Eight server-selected daily modes share one page; no /games/<name> routes are registered.
- `/people/?id=:person` — profile state. Gabe and other people render within the people page.
- `/music/#track=:id` — client fragment state
- `/hack/3?interview=:n` — server-rendered social metadata and client interview state
- `/live` — middleware HTML metadata rewrite
- `/compound/v2[/:lang[/:hook[/:n]]]` — middleware HTML metadata rewrite. Language/hook allowlists in compound/v2/config.js and vercel.json; n=1..9999.
- `/compound/v2?code=:code; /c/:code` — compound code redirect
- `/v/:slug` — compound video redirect
- `/go/(twitch|instagram|twitter)` — server live social redirect
- `/go/(call|bmc|dinner|roll)-(li|x)` — server support campaign redirect
- `/go/plethora-:placement` — server Plethora redirect. Placements and aliases defined in js/plethora-config.js; build guard verifies expected destinations.
- `/go/(cx|cp|bio)-(tt|ig|x|li)` — server battle redirect
- `/go/:platform[/:target[/:campaign]]` — client redirect. Catch-all rewrite remains required. TARGETS/EXTERNAL/site.json define destinations; unknown target falls back to Gabe.
- `/links/:persona[/:source[/:campaign]]` — persona template. Corvus/Pidgy have separate templates; other paths use Gabe template.
- `/r/:code[/games]` — army referral redirect
- `/soldier/:username` — public generated profile
- `/soldier/:username/(og|poster).png` — generated profile image
- `/join-the-army-now/:platform/:campaign` — campaign landing template
- `/hack/play/do-bronx` — alternate game state
- `stats.corvus.gent/(pidgy|games|map|music|hunt|x|coffee|status|hack|army)` — host-specific stats pages
- `stats.corvus.gent/private*` — private stats shell. Exclude from public navigation; backend authorization remains required.

### Duplicate and legacy routes

- Byte-identical HTML: `clients/aurus/v1.0-more-okergeel-grijs/index.html`, `clients/aurus/v1.1-diff-colorpallete/index.html`
- `/hack/2` and `/hack2` rewrite to `/hack/index.html`; the separate `/hack/2/index.html` document remains in the repository.
- `/gabe` redirects to `/people/?id=gabe`; its HTML also contains a refresh fallback. `/links` redirects to the Gabe persona hub.
- `/hackthefeed/2` declares `/hack/2` as canonical but remains a separately served old page. Canonical metadata alone does not consolidate it.

- `/hack/the-feed` is a legacy near-duplicate of `/hack/1/the-feed`. Its back-link points to `/hack`, which is now the MMA arcade, and it omits `data-hack-id="1"`.

### Unresolved static references

No unresolved same-site anchor or asset paths were found in tracked HTML after applying deployment host rules and the middleware extension exclusions. Fragment IDs are reported separately in the JSON because JavaScript may create them.


### Build and maintenance boundaries

`node tools/plethora/verify-routes.mjs && node tools/build-gabinho-rolls.mjs && node tools/build-battle.mjs && node tools/build-hackathons.mjs && node tools/build-plethora.mjs && python3 tools/build-search.py`

Build generation modifies named media slots in the Gabinho Rolls page, `battle/media.json`, the hackathon page and squad block, Plethora placements across pages, then the search index. Shared navigation must survive these generators and their templates. Persona pages have a separate manual generator. `tools/build-search.py` uses an explicit root allowlist and excludes most admin/private screens; new directory roots need deliberate inclusion.

The Plethora generator relies on exact HTML insertion anchors including `<body class="portal">`, `<div class="wrap games">`, `<!-- HUB_INTRO_END -->`, and `<div class="legion-filters`. Preserve or update these along with any redesigned page.

### Caveats

- Root /map does not exist at baseline. stats.corvus.gent/map is the visitor map and must retain its host-specific meaning.
- Static unreachable does not prove a page is inaccessible: JavaScript, search, authenticated controls, campaign links, and direct visits can expose it.
- Canonical tags do not redirect a browser; multiple legacy pages remain live despite declaring other canonical URLs.
- The local tools/serve.mjs server does not implement all deployment middleware and redirects.
- All tracked HTML pages are inventoried, including private/admin/operator shells; noindex is not access control.
- Ignore unrelated untracked public/brand and public/support artifacts.

- The 8 unreachable public HTML source routes include 2 aliases (`/gabe` and `/hack/2`) whose active destinations are reachable. There are 6 primary public pages outside the baseline static graph: `/battle`, `/dinner`, `/gabinho-rolls`, `/hack/the-feed`, `/plethora`, and `/plethora/stats`.

## After: one public directory, five doors

Source of truth: `js/site/routes.js`. The generated map and command palette expose 67 entries, including the formerly unreachable public pages. Runtime member/video/interview routes remain data-driven; their hubs are listed. Admin, account, confirmation and single-use invitation pages are intentionally excluded from discovery. Offline submissions, client demos and the transparent stream overlay keep their standalone layout.

| Public route | Section | Label | Status |
| --- | --- | --- | --- |
| `/friends/cardneto/` | quests | Cardneto | open |
| `/map/` | gabe | the whole map | open |
| `/gabe/` | gabe | gabe | open |
| `/live/` | live | live | open |
| `/legion/` | legion | legion | open |
| `/daily/` | daily | daily | open |
| `/quests/` | quests | quests | open |
| `/airbnb-filter` | gabe | Me vs. the Airbnb filter | open |
| `/army` | legion | war room | members |
| `/battle` | quests | Codex vs Compound | vote |
| `/build` | quests | one man. one army. | live stats |
| `/call` | gabe | book a call | open |
| `/compound` | quests | the $1,000 cut | open |
| `/compound/rules` | quests | The useful chaos: rules — Corvus | open |
| `/compound/v2` | quests | 100 videos. one deadline. | contest |
| `/dinner` | gabe | dinner in SF | open |
| `/gabinho-rolls` | gabe | roll or surf | open |
| `/games/hub` | daily | the arcade | playable |
| `/games` | daily | play today | daily |
| `/hack/1` | quests | 01 / HackTheFeed | pitched |
| `/hack/1/the-feed` | quests | Try HackTheFeed · early beta | open |
| `/hack/3` | quests | 03 / robotics | live project |
| `/hack` | quests | hackathons | ongoing |
| `/hack/play` | daily | OSSMAN | playable |
| `/hackathons` | quests | the squads | archive |
| `/hackthefeed` | quests | Gabe's hackathon run, SF 2026 | open |
| `/languages` | daily | Languages | open |
| `/links/corvus` | gabe | Corvus | open |
| `/links/pidgy` | gabe | Pidgy | open |
| `/music` | daily | music | community |
| `/now` | daily | right now | journal |
| `/people` | gabe | people | directory |
| `/plethora` | daily | Plethora | friend |
| `/plethora/stats` | daily | Corvus × Plethora · live referral stats | open |
| `/privacy` | gabe | privacy | plain English |
| `/push` | quests | One video. One army. · Corvus | open |
| `/realm` | gabe | the old realm | wander |
| `/sf` | gabe | meet in San Francisco | in SF |
| `/sidequests` | quests | Sidequests — Gabriel | open |
| `https://stats.corvus.gent/army` | live | the army, counted | open |
| `https://stats.corvus.gent/coffee` | live | coffees bought for gabe | open |
| `https://stats.corvus.gent/games` | live | daily games | open |
| `https://stats.corvus.gent/hack` | live | HackTheFeed · corvus stats | open |
| `https://stats.corvus.gent/hunt` | live | curiosity, counted | open |
| `https://stats.corvus.gent/` | live | Stats | open |
| `https://stats.corvus.gent/map` | live | every ping, ever | open |
| `https://stats.corvus.gent/music` | live | the rotation in numbers | open |
| `https://stats.corvus.gent/pidgy` | live | corvus → pidgy | open |
| `https://stats.corvus.gent/status` | live | service status | open |
| `https://stats.corvus.gent/x` | live | the x log | open |
| `/support/books` | gabe | Books | open |
| `/support/companies` | gabe | Companies | open |
| `/support/founders` | gabe | Founders | open |
| `/support` | gabe | Support | open |
| `/support/people` | gabe | People | open |
| `/support/philosophists` | gabe | Philosophists | open |
| `/support/sport-people` | gabe | Sport people | open |
| `/wiki/corvus` | legion | Corvus | open |
| `/wiki/corvus/namesakes` | legion | The many meanings of Corvus | open |
| `/wiki` | legion | Main page | open |
| `/wiki/pidgy` | legion | Pidgy | open |
| `/hack/2` | quests | 02 / OSSMAN | shipped |
| `/cv/` | gabe | the CV | read |
| `/links/gabe` | gabe | Gabe’s links | connect |
| `/402/` | gabe | 402 · the crow’s other door | secret |
| `/hack/the-feed/` | quests | HackTheFeed · original demo door | archive |
| `/hackthefeed/2/` | quests | Hack #2 · original countdown | archive |

### Redirects and preserved host behavior

- `/enlist` and `/join-the-army-now` (including trailing/nested paths) → HTTP 301 `/legion/`, query retained. The stats host redirects these paths to the canonical main host too.
- `/gabe` is now the five-section Gabe hub; the former about profile remains at `/people/?id=gabe`.
- Root `/map` is the public directory; `stats.corvus.gent/map` remains the visitor map. Search from the stats host explicitly targets the main host for ordinary site routes.
- Contest routes, short-code redirects, voting data, old HackTheFeed archives and public soldier profiles remain intact.
- The Plethora generator removes/rebuilds only its own slots before the shared chrome generator runs; both are idempotent.
