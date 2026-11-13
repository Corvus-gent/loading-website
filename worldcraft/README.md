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
