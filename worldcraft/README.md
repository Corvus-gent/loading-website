# WorldCraft launch

Static Vercel site: no Next.js or framework migration needed. `public/worldcraft/engine.js` is shared by ten HTML + JSON configs. New routes are narrow, additive Vercel rewrites. `/hack/4` describes the event and links all demos. `/hack` retains all old content and links, with one new event link.

## Deploy

Push this branch to main (or merge a PR). The existing Vercel Git integration should run `node tools/site/build-all.mjs`. No new dependencies. Existing encrypted Redis connection variables and SESSION_SECRET/PRIVACY_SECRET are reused. Set `WORLDCRAFT_ADMIN_PASSWORD` in Vercel; existing `ADMIN_PASSWORD` also works. Missing admin configuration fails closed. Confirm `/api/worldcraft`, `/worldcraft`, `/hack/4` and all demo links after the deployment becomes Ready.

## Routes

- `/hack/4`: event and distribution checklist (no posts or messages were sent).
- `/worldcraft`: public live vote counts, ten demo cards, one vote per visitor, public comments, private optional adult/parent raffle email and photo reveal.
- `/worldcraft/admin`: password-protected API access to counts, anonymous vote records, comments and emails. No password or email is embedded in the HTML. Admin returns up to the latest 1,000 comments/raffle entries.
- `/worldcraft/custom`: local plain-text lesson experiment. Uses sessionStorage and generates fill-in recall configs; no AI service, external upload or PDF parsing.
- `/worldcraft/{teach-the-village,bloom-quest,leaf-commander,storyrealm,fraction-kingdom,space-station,reef-rescue,boss-battle,teach-the-robot,memory-palace}`.

## Tests

Use a dedicated local Redis database, not production. The browser tests use `/usr/bin/chromium` (adjust if needed).

```
SESSION_SECRET=worldcraft-local-only WORLDCRAFT_ADMIN_PASSWORD=worldcraft-test-password REDIS_URL=redis://127.0.0.1:16380/10 node tests/worldcraft-server.mjs
node tests/worldcraft.mjs
node tests/worldcraft-voting.mjs
node tools/site/build-all.mjs
```

`worldcraft-voting.mjs` flushes local Redis database 10 before and after its tests. It tests actual Lua atomic vote/comment dedupe, origin checks, email consent, public email exclusion, admin authorization, mobile voting and reload behavior. Completion tests type rubric-matching answers and walk to each NPC, including intentional wrong answers and hints. Voice features are optional progressive enhancements; physical microphone/gamepad hardware has not been tested.

## Prototype limits

All demos share the engine; they are small experiments, not full RTS or commercial games. Fixed keyword rubrics can accept incomplete explanations and reject valid paraphrases. Reports explicitly identify that limitation and calculate scores from logged pre-check and recall events. The engine sends no learning answers to the server. Memory Palace has ten rooms and ten free-recall stops.

Votes use random localStorage IDs plus an HttpOnly cookie and Redis atomic deduplication. This is one vote per browser visitor, not identity verification; clearing browser data or switching browsers can bypass it. Public comments reject common contact details/URLs and use textContent to prevent script injection. Optional email entry requires adult/parent consent; no marketing signup. Raffle fulfilment is manual and any visit requires mutual agreement.

The reveal reuses `/sf/larp/photos/giant-duck.webp`, not a placeholder; it links to `/sf/larp`. The image is already public and the reveal is an incentive interaction, not an access-control system.

## Curiosity Craft pivot

`public/worldcraft/curiosity.html` and `curiosity.js` provide the blocky beach, a real 30-second free-roam timer, skippable Wonder Board (B), six topic starters, drawing canvas, typed/voice why chains, material float tests, local journal and parent report. The first hub card links to `/worldcraft/curiosity`; `/worldcraft/curiosity.html` is also supported. Curiosity is an additional valid vote ID; existing votes are preserved.

All explanations are in the small built-in fact sheet in `curiosity.js`. After the fact sheet ends, Sam explicitly says so and asks about experiments rather than inventing deeper explanations. Journal/report data stays in the current tab; it resets on reload. Speech recognition is an optional browser feature.

Optional drawing classification uses `/api/worldcraft/curiosity-vision`, routed through the existing Vercel stats function to `api/_curiosity-vision.js`. Set `OPENAI_API_KEY` to enable it; optional `CURIOSITY_VISION_MODEL` defaults to `gpt-4o-mini`. Only a drawing PNG is sent on explicit button press; no open-web tools or free-form science generation are used. Classification is constrained to beach topics, and three hand-authored questions are returned. Existing Redis rate-limits requests; missing key, Redis outage, unknown drawing, or provider error leaves the typed/starter fallback usable. The API key stays server-side. The repo is static HTML + Vercel Functions, so no Next.js migration or build dependency was added.

Typing/mobile integration: `node tests/curiosity.mjs` (server port 4181 by default; override `CURIOSITY_TEST_BASE`). Optional vision contract: `node --experimental-vm-modules tests/curiosity-vision.mjs` (model mocked; no real API call). Tests cover the actual 30-second timer, B reopening, typed why chain, stone failure, wood/foam success, journal/report metrics, drawing fallback and mobile fit.
