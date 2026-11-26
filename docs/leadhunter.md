# leadhunter

Private dashboard: https://corvus.gent/scraper/fiverr-leads. Login uses `LEADS_PASSWORD` (minimum 16 characters), a signed 12-hour HttpOnly/Secure cookie, origin checks and login throttling. No navigation/search links. Both HTML and generated JSON are protected; robots disallows the route. Direct access to the warm seed file and private templates is blocked at the edge.

## Use

Add a warm contact, specify budget/need and next action, review the single fixed offer. Status edits persist in existing Corvus Redis. Done/Skip are device-local. All links open drafts: no code sends outreach or starts a client build. Record a call/explicit interest before building. Pro+ requires 50% upfront. Add CAL_LINK and REVOLUT_LINK in the dashboard settings; unconfigured send links stay disabled.

## Contract

`lib/leads/schema.ts` is the exported v1 source of truth. `npm run build:leads` emits the shared Node/browser-compatible module into `api/_leads/model`; both collectors and API import that generated contract. Fields/status changes after merge require a new schema version, an explicit Redis/seed migration and compatibility fixtures. `data/warm-contacts.json` is an empty versioned seed, not a public contact database. Keep it empty in this public repository; real contacts belong only in KV. Live edits use KV, avoiding commits for every sales update. Configured offer ranges and scopes live in `config/offers.json`.

## Ranking

`lib/leads/score.ts`: pay 30, urgency 25, trust 25, fit 10, reachability 10, minus explicit red-flag deductions. Expected value = midpoint of stated EUR budget × a **heuristic, uncalibrated** close probability. Warm relationships add 30 percentage points before risk penalties; they never override critical scam flags. Final sorting is expected value, then urgency (supersedes the earlier warm-first sort). Missing budgets or stale/missing FX produce unknown expected value, not invented amounts. Account age/karma/hire history remain unknown when the source does not expose them.

FX: Frankfurter's ECB-based latest EUR rates, read through API Anything; maximum rate age seven days. Hourly estimates use 2 / 8 / 24 / 64 / 120 hours for Quick Fix / Landing / Business / Pro / Premium, explicitly labelled estimates. Scope mismatch yields a smaller clearly limited offer. Tier prices stay in EUR. Scores and offers are not guarantees of demand, conversion or delivery.

## Runner and schedule

Node 22.13+: `npm ci --ignore-scripts`, `npm run build:leads`, then `node tools/leadhunter/bin/leadhunter.mjs run` (or `npm link --ignore-scripts` once, then `leadhunter run`). Optional `--publish` uploads the generated JSON snapshot with `LEADS_INGEST_TOKEN`. The same protected snapshot is served as `data.json`; it is kept as one private Redis value rather than a publicly downloadable file. Repeated runs dedupe stable IDs; expired public requests disappear after 24 hours. Warm contacts and edited statuses are separate and cannot be overwritten by ingestion.

`.github/workflows/leadhunter-refresh.yml` runs every 15 minutes plus workflow_dispatch. GitHub scheduling is best effort. Two Places city/category queries rotate per run to bound cost; social pagination is capped and marked partial. No browser, CAPTCHA workaround or credential borrowing: API Anything 0.5.0 performs every external read at tier 1, call-only, no sharing/learning. On auth/block/rate errors stop that source and show status. Workflow failure preserves the prior snapshot; stale scans are labelled.

GitHub variables: CAL_LINK, REVOLUT_LINK, CITIES; secrets: LEADS_INGEST_TOKEN, X_BEARER_TOKEN, REDDIT_ACCESS_TOKEN, GOOGLE_PLACES_API_KEY. Production/preview Vercel: LEADS_PASSWORD and LEADS_INGEST_TOKEN. Runner examples: tools/leadhunter/.env.example. Never commit secrets or runtime snapshots.

## Source access limits

- Reddit public JSON for the six requested communities: enable `REDDIT_COMMERCIAL_APPROVED=true` only after Reddit's commercial/API approval. OAuth access can use REDDIT_ACCESS_TOKEN. Public visibility is not commercial API permission. [Reddit policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy).
- X: official recent-search read operation through API Anything, needs X_BEARER_TOKEN with search access. The bundled API Anything X module has profiles/posts, not search. Retweets are excluded in the query and normalization. No account tokens were found during setup.
- Places: official Places Text Search through API Anything with websiteUri requested. Enable only with GOOGLE_PLACES_API_KEY **and an agreement allowing persisted Places content for this use** (`PLACES_STORAGE_APPROVED=true`). No unauthorized Maps scrape or cached business list. Absence of websiteUri means “no website listed”, never “confirmed buyer”. [Places storage policies](https://developers.google.com/maps/documentation/places/web-service/policies).
- No Fiverr/Upwork scraping. Pasted “payment verified” is a user-supplied trust hint, not an API-verified fact. Fiverr off-platform requests are flagged, not encouraged.

## Verification

`npm run test:leads` compiles TypeScript and checks scoring/FX/flags, contracts, offers, auth, CSRF, replay-safe edits, source filtering and actual API Anything request shaping with fixture responses. `npm run e2e:leads` runs the real user flows (unlock, wrong password, cross-site login refused, add, status, edit, payment links, drafts, done, lock, Redis outage and recovery) in Chromium, WebKit (Safari/DuckDuckGo) and an iPhone, over HTTPS with vercel.json routing, browser-sent headers and a real local Redis (`redis-server` required). Nothing is sent. `npm run build` checks the existing site. No production demo contacts are seeded.
