# Live landing and hackathon 003

`/live` is the QR/bio destination; `/livenow` redirects there with the query preserved. The existing name-voting/game routes are unchanged. `/hack` now lists the three hackathons, newest first.

## Accounts and manual status

Edit **live/socials.js**: `url`, `handle`, `label`, `isLive`. Set `isLive: true` only while that platform is actually live. Keep missing URLs empty; they render non-clickable coming-soon cards. `node tools/build-live.mjs` regenerates static HTML and OG artwork. Commit and deploy both the config and generated page.

Twitch can additionally be detected with `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`: the server uses the existing cached Helix client, with manual `isLive` fallback on missing credentials/errors. No tokens or players load in the browser. Instagram/X live flags are manual. The global site banner remains separately controlled by `live.config.js`; this feature does not turn it on.

Known handles were reused from personas.json and the existing BJJ/attribution pages. TODO: YouTube, Instagram account 3 and 4, X account 2. The requested public/gabe.jpg was absent; add it and regenerate to replace the initial placeholder (no unrelated photo substituted).

## Interview clips

Edit `hack/3/interviews.json`:

```json
{"interviews":[{"title":"A robot that dances","builder":"Builder name","project":"Project name","url":"https://example.com/clip"}]}
```

The grid refreshes every 30 seconds while visible. Only HTTPS URLs and complete entries are shown. Text is rendered with textContent. Empty state is intentional until real clips arrive. Public editorial clips never come from private form submissions automatically.

## Private interview requests

The existing owner login (gabriel@corvus.gent) protects `GET /api/live?interviews=1`. Open that URL on corvus.gent after logging in; it returns the latest 200 unexpired requests. Anonymous visitors get 401. No new key or dashboard setup is needed.

Public submission: `GET /api/live?form=interview` obtains a signed 3-second challenge, then `POST` sends `{name,project,handle,website,token}`. The honeypot must stay empty. One per minute / three per hour per daily-salted IP hash, signed-token idempotency, strict same-origin checks, length limits and 60-day per-record expiration. No raw IPs or public personal data. Redis failure displays a retry/DM fallback rather than claiming success.

## Compound target

There was no `/compound/v2` route. Until a separate campaign is built, it temporarily redirects to the existing working `/compound` editor, with query parameters retained. This does not create new cuts or reset any votes.

## Verification

`node tests/live-page.mjs` needs local Redis at 127.0.0.1:16380, uses DB 4 and a unique test prefix, and cleans only its own keys. Chromium screenshots go into ignored test-results/live-page. The test covers real storage/TTL/rate limits, private denial, mobile submission and account attribution. Also run `node tests/live-banner-api.mjs` and `python3 tools/check-links.py`.
