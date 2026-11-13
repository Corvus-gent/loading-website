# Curiosity Craft on Corvus

## Live app, no source syncing

`/curiosity` embeds `https://curiositycraft.fly.dev/?lang=xx` directly in an unsandboxed, full-viewport iframe. KV owns the app and its deployment at https://github.com/sudhersankv/worldcraft. The wrapper never copies his app or pins a version. A small overlay includes credits, a feature-vote link, active-player count, and the standard Corvus language bar. Hide/restore controls allow an unobstructed game. A direct-play link is always available and a larger fallback appears on load error/timeout. Cross-origin frame refusals cannot be detected reliably from parent JavaScript; direct play remains available even if a future app release forbids framing.

The Fly app currently returns no X-Frame-Options or CSP frame-ancestors restriction. Corvus sets a page-scoped Permissions-Policy delegating microphone, camera, gamepad, fullscreen, autoplay and clipboard-write, matching the iframe allow attribute. Browser consent and the child app's own policies still control actual device access. The site build skips shell injection for this full-screen wrapper.

## Feature voting and distribution

`/worldcraft` is the Curiosity Craft hub with eight feature votes. Earlier proof-of-concept and ten old demos remain reachable in a collapsed section without voting. `/hack/4` links the live app and feature hub. Old learning demos and the local text lesson experiment remain available.

API `/api/worldcraft` uses the existing multiplexed Vercel function and encrypted Redis helper, with keys under `worldcraft:features:v2` (preview is isolated). Original demo votes/comments are preserved under `worldcraft:v1` and visible only to authorized admin. No production DB reset or migration is required.

- One vote per feature per random browser visitor, deduplicated atomically in Redis with the existing localStorage ID and HttpOnly cookie.
- One comment per voted feature. One additional free-text suggestion per visitor. Comments retain their original text and language; they are not machine-translated.
- One heart per visitor/comment; top twenty comments are ordered by hearts, with recency breaking ties.
- Shares count one qualifying use per platform per visitor. Share-button clicks cannot verify a published social post. Copy counts after clipboard write succeeds.
- Unique visitors, unique game-page visitors, feature votes, comments, hearts, qualifying shares, and unique commenters/email entrants form the scoreboard. Counts poll every 10 seconds.
- Active players means wrapper visitors with a heartbeat in the past 45 seconds. A game-page load counts as a play, as requested; this does not inspect the cross-origin game's internal activity.
- Twelve randomly ordered, nonrepeating rewards per visitor: existing SF LARP photos, two SF facts, a raven badge, an arcade link and three raffle/draw entries. New feature comments or each qualifying share option unlock a reward. Durable pending entitlements allow retrying a request if reward delivery fails after its comment/share was saved.
- An optional adult/parent email is private and only for contacting selected reward entries. Visits require mutual agreement. Draws and fulfilment are manual; no posts/messages are sent automatically. The photo files are already public; rewards are an engagement interaction, not a secrecy system.

Admin is `/worldcraft/admin`, protected by `WORLDCRAFT_ADMIN_PASSWORD` or existing `ADMIN_PASSWORD`, failing closed if neither is set. It includes new feature activity, reward entries/contacts and archived original demo entries. Emails never appear in public API snapshots. Visitor IDs are browser-based, not identity verification.

## Eight languages

The standard Corvus language bar is reused and scoped on `/worldcraft`, `/curiosity` and `/hack/4` to exactly `en`, `es`, `zh` (Simplified), `fr`, `pt`, `nl`, `hi`, `ta`. Other site pages retain their original language list. Query parameter wins, then saved choice, then browser language. Explicit choices use existing preference/cookie storage. Curiosity-specific strings live in `public/worldcraft/locales/*.json`. Existing switcher CSS and placement are shared; the accompanying mini leaderboard uses Redis counters for visitors, votes and comments per language. Visitors are unique per language, so a language switch may count the same person once in each language but only once globally. Votes/comments are attributed to the selected UI language at submission. Comments keep that language flag and original text.

## Analytics and privacy

The existing consent-aware, cookieless PostHog pipeline accepts `visit`, `play`, `vote`, `comment`, `like`, `share`, `reward_revealed` from these pages. Only fixed experience/feature/platform/reward-kind categories are allowlisted. No email, visitor ID, comment text, drawing, or child question is included in analytics. Existing consent/DNT rules continue to apply; Redis functional counters are independent of optional PostHog capture.

## Local validation

Use a dedicated local Redis DB, never production. The integration test flushes local database 10 before/after its run.

```
WORLDCRAFT_TEST_PORT=4186 SESSION_SECRET=local-only WORLDCRAFT_ADMIN_PASSWORD=worldcraft-test-password REDIS_URL=redis://127.0.0.1:16380/10 node tests/worldcraft-server.mjs
WORLDCRAFT_TEST_BASE=http://127.0.0.1:4186 node tests/worldcraft-distribution.mjs
node tools/site/build-all.mjs
```

The test uses Chromium and checks actual Redis deduplication, language stats, original-language comments, nonrepeating rewards, private email exclusion/admin, likes/ranking, shares, active players, mobile layout, all eight language choices and saved preference, plus the real Fly app loading within the iframe. Original PoC typing tests and original ten config-driven demos remain in `tests/curiosity.mjs` and `tests/worldcraft.mjs`.

The older PoC's optional drawing classifier (`api/_curiosity-vision.js`) still works with `OPENAI_API_KEY`; it does not change KV's live app. No Next.js migration or new production dependencies were introduced: this repo is static HTML and Vercel Functions.

## Curious Creature drops

Production environment variable: **RECRAFT_API_KEY**. Add it to the existing Vercel project and redeploy; the key is read only inside `api/_curious-creature.js`. No other new credentials are needed. Official API reference consulted: https://www.recraft.ai/docs/api-reference/endpoints and https://www.recraft.ai/docs/api-reference/image-inputs-and-results.

The existing stats function routes `/api/worldcraft/creature` to the server-side helper. Comments create an atomic, private generation seed only after the comment is accepted. The browser sends only its existing visitor ID to the creature route. The prompt includes an allowlisted feature and a maximum-120-character summary assembled entirely from fixed concept labels; no raw comment words, contact details, names, links, or arbitrary instructions are sent to Recraft. Recraft V3 is called for one raster PNG with digital-illustration style, the Curiosity palette, no-text controls and a negative prompt excluding people/human likenesses.

Redis atomically reserves one provider attempt per visitor and at most 200 attempts per rolling hour. Successful images keep a stable number, a generated funny name and the provider's image URL. Failed provider attempts are cached too, avoiding repeated billing after errors. Missing key / exhausted hourly budget does not consume a provider attempt, and the UI quietly uses the existing reward. Gallery shows the last twelve successful images and no visitor identifiers or comments. A same-origin download endpoint returns an attachment. Recraft CDN URLs are stored as returned, not mirrored into object storage.

Creature ownership, numbering and rate limits persist in Redis; names/images in the public gallery are deliberately public. After a creature is awarded, the share copy includes its number, and the next reward reveals an existing SF LARP photo. No messages or posts are sent automatically.

Tests: `tests/curious-creature.mjs` uses real local Redis and a mocked provider to check the contract, sanitization, concurrency, caching, cap, gallery and download. `tests/curious-creature-ui.mjs` checks the 390×844 card/download/share/second-reward/reload flow with mocked generated images and real comment/share Redis actions. The normal chat test also passes without a Recraft key. No real paid Recraft generation was performed in this session.

## Canonical product URLs

Feedback: `/curiositycraft`; game: `/curiositycraft/play`; projector: `/curiositycraft/qr`. The three source HTML files now live under `curiositycraft/`. Exact legacy page URLs (`/worldcraft`, `/worldcraft/qr`, `/curiosity`, including their trailing-slash/index variants) permanently redirect with query strings preserved. Old `/worldcraft/*.html` experiments, assets, API endpoints, admin URL, Redis namespaces, cookie path, visitor ID storage and credentials remain unchanged. No data migration or reset is performed. Both distributed QR SVGs and default client-generated projector codes encode `https://corvus.gent/curiositycraft`.
