# Privacy audit — 4 November 2026

## Current counting policy — 6 November 2026 update

This section supersedes the opt-in analytics/180-day-choice descriptions in the original audit below. Gabriel explicitly requested default cookieless measurement and the production rollout on 6 November.

- Default: self-hosted PostHog SDK, EU ingestion, `cookieless_mode: always`, memory-only persistence, no autocapture, profiles, recordings, heatmaps, raw inputs or full URLs. Only allowlisted events/properties leave the browser. Campaign labels now stay in page memory; analytics writes no cookies, localStorage or sessionStorage.
- Cookieless protocol repair: `$raw_user_agent` is synthesized from the existing browser/device categories (for example `Chrome/Desktop`), never copied from the raw user agent. PostHog requires this hash input and drops events when it is absent; raw IP and user-agent hash inputs are removed by its cookieless ingestion pipeline. Project mode 2 and discard-client-IP were confirmed; no provider setting was changed. Coarse categories can merge people sharing a network/browser type.
- PostHog still derives a daily pseudonym from transport IP/browser information. Only aggregate results are anonymous. `ip:false` does not eliminate that transient provider processing. The stated GDPR basis is legitimate interest for limited audience measurement, not the `ok` click. This is the owner's requested basis, **not a legal conclusion that cookieless hashing is exempt from Belgian ePrivacy consent rules**. The existing DPA and PostHog sources below remain relevant; a documented legitimate-interest assessment and ePrivacy review remain necessary.
- GPC, DNT, an existing unexpired refusal, or `don't count me`: no PostHog script/request. One first-party `POST /api/hit` per page load increments only a Brussels-day total and an allowlisted page category. No per-hit record, identifier, hash, IP or headers are stored by this handler. Hosting-layer request logs remain subject to Vercel's settings; the app cannot promise those do not exist.
- These unseen hits are pageviews, **not unique people**. The displayed visitor estimate adds PostHog daily visitor estimates and unseen hits and discloses that limitation. Mid-page opt-out does not add a second count for an already captured pageview. No retroactive recovery of missing visitors is possible.
- `privacy-choice` is the only new local flag: choice, notice version and whether this browser/site origin already acknowledged. Written only after an explicit `ok`/refusal; retained until changed or site data is cleared. Needed to remember that requested preference, not an analytics identifier. Previous consent/dismissal keys are removed when choosing. `ok` adds a `notice_ok` event only when PostHog is allowed and an anonymous soldier counter independently. Acknowledgements are best-effort once per browser/site origin; clearing storage or using another origin/browser can count again. They are not verified people. GPC/DNT always override `ok` for PostHog.
- Redis: `unseen:hits:<day>`, `unseen:pages:<day>`, `soldiers:ok:<day>` contain anonymous aggregates only, retained 400 days. `unseen:hits:all` and `soldiers:ok:all` are indefinite aggregate totals. `counting:limit:<minute>` is a global abuse budget, expires in 120 seconds, no IP hash. Count endpoints use origin/schema validation and no cookies; they cannot deduplicate bots/persons without identifiers.
- `report:markdown:v1`: aggregate health/report text, 60-second TTL; token-authenticated, HTTP no-store. `REPORT_TOKEN` is sensitive in Vercel; an `x-report-token` header is preferred to a query token, which can appear in hosting/browser logs. `report:errors`: last 10 sanitized application error codes/timestamps, max seven days, no messages, request inputs, emails, IDs or stack traces. This is instrumentation from this release onward, not an export of every historic Vercel runtime log.
- Snapshot health now reads stored ages and queues refresh through waitUntil. TTL is a refresh target; health fails missing/partial snapshots or ages above max(15 minutes, twice that page's TTL). Per-task build timings identify the slow source without holding health open for the build.


Scope: corvus.gent, www.corvus.gent, stats.corvus.gent, music, games, redirects,
private dashboard and the published client demos. Baseline: `2a13612`.
This inventory was written **before implementing changes**. Status is updated as
fixes and tests land. It separates repository evidence from account settings that
cannot be inferred from source code. It is not a claim of legal certification.

## Findings and work log

| ID | Finding at baseline | Required fix / status |
| --- | --- | --- |
| P01 | Rate limits use stable IP hashes; guesses use unsalted SHA-256. | **Fixed:** domain-separated daily HMAC salt, no raw IP persistence; atomic TTLs. |
| P02 | Language-voter records, lifetime IP counters, music-voter sets and poll-voter hash never expire. | **Fixed:** bounded voter retention, remove lifetime IP tracking, individually expiring poll records. |
| P03 | Login/access lists and email-keyed visitor guesses have no age limit; a sliding list TTL alone would not remove old entries. | **Fixed:** individually expiring records, max 90 days; migration for old lists. |
| P04 | OTP increment can recreate an expired key without expiry; verification is not atomic. | **Fixed:** atomic, single-use verification preserving a hard expiry. |
| P05 | Session/language signatures have predictable fallback secrets when environment is missing. | **Fixed:** fail closed without a server secret. |
| P06 | Search query, arbitrary terminal command, anchor text, paths, complete URLs and campaigns can contain personal data. | **Fixed:** explicit analytics property/event allowlist and URL reduction; protect public results from legacy values. |
| P07 | PostHog cookieless is on, but autocapture is enabled; person profiles/heatmaps/surveys are not explicitly disabled. | **Fixed:** disable optional capture, mask all inputs, no identify; exclude private pages. Account settings need verification. |
| P08 | City map exposes places with just one visitor. Pingle already has HAVING n>=2 but needs defensive validation. | **Fixed:** >=2 in query, response and cached data; coarse coordinates only. |
| P09 | Spotify API is already click-loaded on call/music, but disclosure is missing. | **Fixed:** visible note and browser regression tests, including no preclick requests. |
| P10 | Leaflet loads from unpkg; link hub image from Webflow; three client demos request Google Fonts. Sortable is already local. | **Fixed:** local assets/system fonts; retain licenses. |
| P11 | No complete privacy page, ordinary footer link or versioned informational notice. | **Fixed:** seven languages, ordinary footer links, accessible nonblocking opt-in (see P17), private/game exclusions. |
| P12 | No operator data-deletion or legacy-retention migration tool. | **Fixed:** tested CLI tools; clear private caches, include sessions and guesses. |
| P13 | Access-request endpoint lacks origin/rate controls; stored addresses are not normalized. | **Fixed:** same-origin validation, daily IP abuse limit and normalized bounded email. |
| P14 | Functional local preferences/history have no explicit retention. | **Fixed:** document each; minimise automatic writes, expire history/preferences where appropriate. Functional preferences expire after 365 days; analytics choice after 180 days/version change. |
| P16 | Remote Redis URLs could use plaintext transport. | **Fixed:** require HTTPS REST or rediss; plain Redis only on loopback for tests. Deployment must confirm TLS configuration. |
| P17 | A dismissal-only notice would imply that cookieless daily pseudonymous PostHog tracking needs no choice. | **Fixed:** no PostHog SDK, network, country enrichment or capture before affirmative consent. Equal allow/refuse choices, withdrawal on /privacy, versioned 180-day preference, GPC/DNT honoured. User explicitly authorized real opt-in if non-essential tracking remained. |
| P18 | Public music stats call the personalized music API and create an unnecessary voter cookie/seen record. | **Fixed:** public=1 returns catalogue/aggregates without a voter cookie, IP hash or personal record. |
| P19 | The tracked search index included text/base64 from a generated Playwright report and its trace viewer. | **Fixed:** explicit public-root allowlist in the generator; regenerated index contains no report/trace/internal pages and includes /privacy. Existing .vercelignore already excludes direct test-artifact deployment. Review historic published report fragments for any sensitive material and purge caches/history if needed. |
| P20 | GitHub checks revealed a second Netlify deployment/preview integration, outside the Vercel production route. | **Documented/manual:** confirm its purpose, access/log retention and DPA; disable unused deployment copies. Main corvus.gent responds from Vercel. Unknown preview/local analytics hosts remain `other`, excluded by the production REAL filter. |
| P15 | Hosting/processor logs, backups, transfers and project settings are outside the repository. | Manual verification required; see checklist. No raw-IP logging found in application code. |

## Meaning of the legal-basis labels

- **LI**: proposed legitimate interest in proportionate security and abuse prevention (GDPR 6(1)(f)); controller must record a balancing test.
  Pseudonymous identifiers are still personal data, not automatically anonymous.
- **Request**: performing the requested login, game, vote, access request or booking
  (GDPR 6(1)(b) where applicable); security also relies on LI. Necessary storage is
  limited to that requested function, not reused as an analytics identifier.
- **Consent**: explicit opt-in before optional PostHog analytics; separate informed play click before Spotify contact (GDPR 6(1)(a)/ePrivacy).
- **Aggregate/public**: counts with no visitor identifier, or published catalogue
  content; no personal visitor record. No expiry required for the count itself.

Cookieless is a technical property, **not an automatic exemption** from GDPR or
ePrivacy. Do not describe PostHog's transient daily pseudonym as fully anonymous.
The final implementation treats PostHog daily pseudonymous analytics as optional
and gates it before loading. This is the conservative implementation decision from
the Belgian DPA guidance on similar tracking technologies, not a claim that merely
setting cookieless mode establishes an exemption. The user's conditional opt-in
instruction applies. Therefore the original “anonymous visits / almost nothing is
stored / ok” text was replaced with “posthog stats? daily pseudonym, no cookies.”
and equally styled allow/no-thanks buttons plus privacy. No wall or preselected
choice. Necessary votes/login/games and map display work without analytics.

`analytics-consent.js` is shared by capture and UI. The real pinned SDK ignores
opt_out in always mode, so capture is guarded explicitly; fetch-only transport is
aborted on withdrawal (including retries), beacons and batching are disabled, and
the SDK is shut down. Events already received before withdrawal are not magically
erased. No pre-consent events are queued/replayed. GPC/DNT override a saved allow.
Choices are origin-specific; every footer uses same-origin /privacy so withdrawal
also works on stats.corvus.gent. Private/admin pages never load analytics.

## Cookies and browser storage

Receivers for first-party cookies: browser, Corvus/Vercel API; corresponding records
are held by the configured Redis provider. Local storage stays in that browser;
it is not sent to analytics. Cookie scope is host-only (not shared across subdomains).

| Name | Data / purpose / basis | Baseline retention → implemented retention |
| --- | --- | --- |
| `sess` | Signed random login ID; HttpOnly, Secure, SameSite=Strict, Path=/; Request/security LI. | 7 days, logout invalidates Redis session. |
| `vid` | Signed random language-voter ID; HttpOnly, Secure, SameSite=Strict, Path=/api; duplicate-vote protection, Request/LI. | 365 days; matching Redis deduplication also expires. |
| `mvid` | Signed random music/game ID; same flags and Path=/api; likes/poll, challenge and daily game continuity, Request/LI. | 365 days; matching state expires as below. |
| Spotify's cookies/storage | Observed after explicit play: `sp_t` and `sp_landing` on `.spotify.com`, Secure, SameSite=None; `sp_landing` HttpOnly. Spotify can use additional names/storage depending on region/login. | None before play. Observed `sp_t` lifetime ~365 days; `sp_landing` ~1 day. Vendor-controlled; other contexts may differ. Corvus cannot delete Spotify's cookies. |
| PostHog cookies/storage | `cookieless_mode: always`; no `ph_*` cookies/analytics local storage intended. | None; verified with actual local SDK after opt-in. Remote config/feature-flag loading disabled. |
| `lang` (localStorage) | Requested language, functional preference. | Unbounded → explicit selection, 365 days after saving. |
| `voted_lang` (localStorage) | Chosen language vote, so the form remembers a successful submission; functional duplicate-vote UI. | Unbounded → 365 days after successful vote; failed submissions are not saved. |
| `realm-entered` (localStorage) | Remember visitor used entry animation; functional preference. | Unbounded → 365 days after saving. |
| `feathers` (localStorage) | Found egg IDs/progress; requested discovery game. | Unbounded → 365 days after saving. |
| `daily-games` (localStorage) | Up to 400 played dates, streak and per-game results (no email); requested history. | Unbounded → 365 days after saving, prune played dates older than 365 days. |
| `game-help:<type>` (localStorage) | Instructions were read; requested game preference. | Unbounded → 365 days after saving. |
| New `analytics-consent` (localStorage) | Allow/deny, policy version and expiry; necessary to honour the choice, no visitor ID. | 180 days or policy version change. Unavailable storage falls back to this page only. Old `privacy-notice` dismissal is never consent and is removed when a choice is saved. |

Low-power hints (`deviceMemory`, `hardwareConcurrency`, reduced-motion/save-data where available) are read locally for the music performance warning; no serial numbers, no values sent to analytics or stored server-side.

No application use of sessionStorage or other cookies found at baseline. Storage
from development tooling/preview login is not a production site cookie. Third-party
destination sites may use their own storage once visitors intentionally leave Corvus.

## Redis inventory

All Redis data goes to the configured Redis service, administered by Gabriel;
private data is only returned through authenticated APIs. `_redis.js` supports REST
providers (e.g. Upstash) and a Redis URL; **actual vendor, region and backup retention
must be confirmed from the deployed integration**. Keys below are exhaustive key
families found in API source, including generated Lua keys.

| Key family | Data and purpose | Basis | Baseline retention / fix |
| --- | --- | --- | --- |
| `otp:<email hash>` | Hashed code, attempt count; email lookup hash | Request/LI | 180s; fix atomic verification/expiry race |
| `otp:rl:mail:<email hash>` | Email request count | LI | 900s; atomic expiry |
| `otp:rl:ip:<hash>` | Network request count | LI | 3600s; switch stable to daily hash |
| `sess:<random>` | Login email | Request/LI | 7 days |
| `logins` (legacy) | Email/time list, last 100 | LI/security | No TTL → migrate to per-record 90-day TTL |
| `access_requests` (legacy) | Email/time list, unlimited | Request | No TTL → per-record 90-day TTL |
| New `privacy:log:<kind>:<id>` | One email/time record | Same as old log | 90 days from original record time |
| New `privacy:log-index:<kind>` | Random record IDs/timestamps for private listing | Same | 90 days; age pruning; no email |
| New `access:rate:<daily hash>` | Access-request rate | LI | 1 hour |
| `guess:rl:<hash>` | Network guess count | LI | 24h; replace unsalted hash |
| `guesses:<day>` | Email → numeric guess/time | Request | No TTL → max 90 days, fixed deadline for that day's entries |
| `guess_days` | Day index for private guesses | Request | No TTL → prune old days, expiring index |
| `ch:<random>` | Language proof-of-work salt | LI | 300s |
| `voted:v:<vid>` | Chosen language, duplicate-vote prevention | Request/LI | No TTL → 365 days |
| `voted:ipday:<hash>` | Network vote count | LI | 24h; replace stable hash |
| `voted:iptotal:<hash>` | Lifetime network vote count | LI | No TTL → remove and purge legacy records |
| `lang_votes` | Language → count | Aggregate | Permanent |
| `music:tracks` | Owner's ordered public catalogue/notes/links | Public content | Until owner edits/deletes |
| `music:sugg` | Public song metadata, no submitter identity | Public content | Until moderated; bounded to 300 suggestions |
| `music:votes` | Track ID → count | Aggregate | Permanent |
| `music:voted:<mvid>` | Set of liked track IDs | Request/LI | No TTL → 365 days |
| `music:poll:voters` (legacy) | Voter ID → service choice | Request/LI | No TTL → migrate to individually expiring keys |
| New `music:poll:voter:<mvid>` | Service choice/deduplication | Request/LI | 365 days |
| `music:poll:counts` | Spotify/Apple vote totals | Aggregate | Permanent |
| `music:seen:<mvid>` | First seen timestamp for minimum challenge delay | LI | 3600s |
| `music:challenge:<id>` | Voter, action, salt, bits, not-before time | LI | 300s, consumed once |
| `music:challenge-rate:<hash>` | Challenge request count | LI | 60s; daily hash |
| `music:posts:<hash>` | Music POST count | LI | 24h; daily hash |
| `music:cool:v:<mvid>`, `music:cool:ip:<hash>` | Suggestion cooldown | LI | 60s; IP hash rotates daily |
| `music:suggday:<hash>` | Daily submission count | LI | 24h; daily hash |
| `game:rate:<hash>` | Game request count | LI | 60s; daily hash |
| `game:state:<day>:<mvid>` | Guesses, reveal cells, times, result/streak | Request | 48h; never public individual history |
| `game:state:<day>:<mvid>:lock` | Random concurrency token | LI | 15s |
| `game:streak:<mvid>` | Last day/current streak | Request | 400 days → align to 365 days |
| `game:city:v2:<day>` (old `game:city:<day>` ignored) | Rounded eligible city for Pingle | Aggregate | 48h; >=2 visitors, no visitor IDs |
| `games:day:<day>`, `games:all`, `games:type:<type>`, `games:best` | Plays/results/streak maximum, counts only | Aggregate | Permanent |
| `cv:open`, `cv:download`, `cv:<kind>:<day>` | CV open/download counts | Aggregate | Permanent |
| `cli:all`, `cli:<day>` | Coarse tool-name → count | Aggregate | Permanent; raw user agent not stored |
| `stats:v4:<day>` (and prior versions) | Public aggregate daily results; legacy arbitrary labels risky | Aggregate | Today 300s, history 7d; new `stats:v5:<day>`, browser URL v=5, legacy caches purged |
| `stats:section:v1:<section>:<day>` | Public section counts | Aggregate | 900s; new `stats:section:v2:…`, labels sanitized |
| `stats:private` | Private results including emails/guesses | Request/LI | new `stats:private:v2`, 600s aggregates only; emails/guesses fetched fresh; deletion purges all versions |
| `geo:all` (legacy) | City names/coarse positions/counts including singletons | LI/aggregate | 900s → `geo:all:v2`; suppress singleton cities on query, cached response and client; never per-visit points |

TTL must be applied atomically. Increasing activity must not extend a record beyond
its promised maximum age. Updating code does not erase historic data: the migration
tool and provider-side cleanup are part of deployment, not optional documentation.

## Analytics inventory

Receiver: PostHog EU (events/aggregate queries); Corvus/Vercel serves the stats.
Final basis: consent before SDK load, independent of Spotify play consent. At baseline the SDK
sent automatic browser/OS/device/screen metadata, URL/referrer/campaign
properties, library metadata, timestamp, session/distinct bookkeeping and optional
autocapture DOM properties. Cookieless processing derives a daily pseudonym from
network/browser information server-side; this is **not** a persistent account ID.
No `identify`, `alias`, email/name person properties or session replay are needed.
Account event retention is unverified; target 90 days for individual events, with
non-identifying totals retained longer. PostHog project configuration and historical
event deletion require operator verification.

| Event | Baseline explicit properties | Implemented minimisation |
| --- | --- | --- |
| `$pageview` (+ automatic page leave/autocapture) | SDK metadata + `corvus_country_code`, `links_person/source/campaign` | Disable autocapture/pageleave/heatmaps/replay/profiles; allow only bounded coarse metadata, known routes and campaign categories |
| `link_click` | `link_text`, `link_href`, `page` | Drop text, queries/fragments, mailto details, unknown paths |
| `outbound_click` | `host`, `href`, `path`, `label` | Known destination category, reduced URL; drop text |
| `short_link_out` | `url`, `source`, `medium`, `campaign`, `target`, `external` | Fixed source/target/campaign categories; no input values or destination query |
| `links_click` | `link`, `links_person`, `links_source`, `links_campaign` | Known public owner and link IDs/categories only |
| `links_qr_open`, `links_crow_click` | Same link-hub context | Same allowlist |
| `music_play` | `track`, `genre`, `artist` | Genre only; drop track ID, artist and title |
| `game_start`, `game_guess`, `game_end`, `game_share` | `type`, `day`, numeric `guesses`, boolean `solved` | Keep enumerated game/result counts; never guess text or coordinates |
| `share_click` | `what` | Known share button values only |
| `feather_found` | `id`, `total` | Known egg ID/count, not contents |
| `terminal_command` | `command` (includes arbitrary unknown words) | Known command verb only; unknown category, never arguments |
| `site_search` | Raw `q` | Count searches only; never text |
| `visitor_guess` | `day` | Valid date only; never email/guess |
| `vinyl_play` | No explicit fields | Count only |
| `language_vote` | `language` | Valid known language code only |
| `goodreads_locked_click`, `goodreads_access_request` | No explicit fields | Count only, never email |

Public endpoints must return aggregate counts with safe category labels, not raw
identifiers/URLs/free text from historical PostHog events. Private dashboard remains
session-protected. Optional `PIDGY_POSTHOG_*` queries read only aggregate signup
counts attributed to Corvus from a separate project; never return Pidgy identities.

## Network requests, processors and logs

| Recipient | Data / trigger / purpose | Basis and retention |
| --- | --- | --- |
| Vercel | HTTPS IP/UA/request path needed to deliver site/APIs; coarse country header; potential hosting/security/access logs. Application handlers do not log bodies, emails, OTPs, cookies or raw IPs. | Request/security LI. Actual account log/backup retention and log drains **unverified**; minimise/disable raw-IP retention in account. Cannot promise source code controls infrastructure logs. |
| Netlify (secondary deploy previews) | GitHub PR #11 also deployed `unique-snickerdoodle-103783`; visitors who open that separate preview contact Netlify with IP/UA/path. No request to Netlify is made by the main site. | Request/security LI for preview delivery; account access/log/backup retention and DPA unverified. Confirm whether this legacy integration is needed. |
| Configured Redis provider | Above records over TLS/REST; Vercel server connection, not browser access. | Request/LI; application TTLs above; provider backups/regions/DPA need verification. |
| PostHog EU / `eu.i.posthog.com`, `eu-assets.i.posthog.com` | Cookieless events only after analytics opt-in; SDK is now self-hosted, no eu-assets request. Network IP/UA received transiently for daily hash processing. Query API called server-side. | Consent; individual-event target 90d, actual account setting unverified. Discard IP and disable unused data capture. |
| Resend / `api.resend.com` | Requested email address, login code and mail content sent server-side. | Request; Redis code 3min. Resend publishes US storage, 30-day email/log retention on Free/Pro/Scale, 7-day backups, Enterprise-specific terms. Confirm actual plan; contact Resend for early message deletion. Sending region does not change storage region. |
| Spotify / `open.spotify.com` and Spotify-selected playback hosts | Browser IP/UA/referrer and song after play click; Spotify controls playback cookies. Server oEmbed fetch only on requested link submission/admin lookup (song ID, server IP; no visitor email/IP forwarded). | Consent for playback; Request for metadata lookup. Spotify controls its retention. |
| Apple / `itunes.apple.com` | Server lookup of submitted song ID/country; no visitor identifiers forwarded. External Apple Music link opens only on click. | Request; no local requester record in song metadata; Apple policy for their logs. |
| CARTO / `basemaps.cartocdn.com` | Tile z/x/y and server IP/key via `/api/geo?tiles=1`; browser never contacts CARTO directly. | LI/service delivery; tiles cached 24h, no visitor identity forwarded. CARTO's infrastructure logs are its policy. |
| unpkg | Leaflet 1.9.4 JS/CSS, browser IP/UA/referrer on map load at baseline. | Remove browser requests by self-hosting; BSD license retained. |
| jsDelivr | Sortable reference in vendored license/source; no live browser request found. | Already self-hosted; keep MIT license. |
| Google Fonts | Three published Aurus demos request CSS/font with browser IP/UA/referrer. | Remove requests; use system fallback. |
| Webflow `cdn.prod.website-files.com` | Link-hub Pidgy image exposes browser IP/UA/referrer. | Replace with local asset. |
| Buy Me a Coffee | Ordinary outbound links, no widget/iframe/API before click. UTM categories accompany intentional visit. | Request; destination controls payment/account data and retention. Corvus does not receive form/payment details. |
| Pidgy / `pidgy-ai.com`, `app.pidgy-ai.com` | Ordinary link to trial or booking; fixed invite/UTM/ref parameters. No booking iframe or form capture. | Request; booking info is collected by Pidgy on its own site under its policy. |
| Other external links (LinkedIn, Instagram, TikTok, X, Luma, Discord, Bandcamp, SoundCloud, MusicBrainz, articles) | Navigation after deliberate click; TikTok also has the separate click-loaded creator embed documented below. | Requested navigation; external policy applies. Strip identifying query data from Corvus event copies, not legitimate destination functionality. |

Tracking links `/links`, `/go`, `/important-call-gabe-maxxer` and
`/coffee-with-gabe` add fixed/category UTM labels; optional views/clicks are counted only with analytics consent. Anonymous CLI counters are server-only aggregate increments. They do not
collect form contents or identify a visitor. Reject/normalise arbitrary path and
query labels before analytics. Referrer policy should prevent query/fragment leakage
to third parties; no analytics on private dashboard or music administration.

## Manual deployment/account checklist (not verified by code)

- PostHog **Settings → Project → General → IP data capture**: discard client IP;
  organization defaults do not retroactively fix existing projects. Confirm
  cookieless tracking enabled under Project → Web analytics. Disable recordings,
  heatmaps/autocapture, surveys and person creation at project level too.
- Set event retention to 90 days (or shorter supported plan limit). Purge historical
  raw search/unknown command/full URL/DOM events, person profiles and any replay data;
  do not assume new capture settings clean old events. Check exports and backups.
- Vercel: verify runtime/security/access logs and drains; disable unnecessary logs,
  redact IP/query data where supported and select the shortest available retention.
  Document any unavoidable provider retention instead of claiming “IPs never stored”.
- Netlify: review the secondary deploy-preview integration, its access/log retention and DPA; disable unused public copies. Its policy link is https://www.netlify.com/privacy/. This was discovered from GitHub deployment checks, not inferred as a production processor.
- Confirm actual Redis integration vendor/EU region, encryption, DPA and backup
  expiry. Run the retention migration against production after deploying code;
  expired/deleted records can remain in provider backups until their rotation ends.
- Resend: minimise delivery/content logs, verify deletion process and retention.
- Confirm processor contracts, subprocessors and international-transfer safeguards
  (EU hosting does not itself rule out international access/transfers).
- Controller: record LI balancing assessment for abuse prevention and necessary
  storage, and retain this consent wording/version as evidence of the offered choice.
  No analytics event is sent without opt-in. Review actual processors and update all
  seven privacy translations with confirmed provider/retention details before publication.
- For a new installation, set strong dedicated signing secrets. For this existing
  deployment, pin the current values with tools/pin-redis-secrets.mjs before any
  Redis change (see the Frankfurt runbook); do not casually rotate them mid-move.
  Sessions using an old unsafe fallback may need a separate planned rotation. Require rediss:// or HTTPS REST for remote Redis;
  do not “fix” a deployment error by disabling transport encryption.
- The historic all-time PostHog queries are limited by whatever event history is
  retained. Reducing retention to 90 days changes these numbers; export only safe
  anonymous rollups if historic totals need preservation. Public maps receive no new
  IP-derived cities with GeoIP disabled; Pingle safely falls back to Borders when
  yesterday has no eligible city. Country counts continue via coarse Vercel country.
- Treat code merge, legacy Redis migration and processor cleanup as separate steps.
  This PR does not claim account settings, historic data or production are already fixed.

## Evidence and authoritative references

- [GDPR (EUR-Lex)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A02016R0679-20160504): minimisation, retention, lawful basis, rights; pseudonymous data is not necessarily anonymous.
- [Belgian DPA — cookies and other tracking technologies](https://www.gegevensbeschermingsautoriteit.be/professioneel/thema-s/cookies): necessity, consent and technologies other than cookies.
- [EDPB Guidelines 2/2023, final version](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf): technical scope of ePrivacy Article 5(3), including IP-based tracking.
- [PostHog collection controls](https://posthog.com/docs/privacy/data-collection): masking, cookieless processing, IP-discard setting and limits.
- [PostHog JavaScript configuration](https://posthog.com/docs/libraries/js/config): explicit SDK privacy controls.
- [PostHog cookieless guide](https://posthog.com/tutorials/cookieless-tracking): daily hashing and no browser persistence.

## Validation

Completed locally on 4 November 2026:

- Node syntax: 90 first-party JS/MJS files and 21 executable inline HTML scripts;
  `git diff --check` clean. Every ordinary HTML page has its privacy footer link.
  Static resource scan found no direct remote script/image/stylesheet/preconnect.
- Actual local Redis tests (`npm run test:privacy:data`): daily/scope-separated
  hashes, no raw IP in keys, atomic rate expiry repair, original-age 90-day log
  retention, dry-run/idempotent legacy migration, three concurrent wrong OTPs,
  one session from racing correct OTPs, expired/no-TTL OTP rejection, Unicode cookie
  rejection, private authentication, normalized access requests, guess expiry,
  vote/poll retention, cookie-free public music counts and per-email deletion that
  preserves other users and aggregate votes. Loopback DB 13 only.
- Eight game engines (`npm run test:games`), including DST, replay/concurrency,
  answer protection, origins/cookies, Pingle threshold/fallback. Loopback DB 15 only.
- `npm run test:geo`: SQL HAVING >=2, cached singleton suppression, rounding,
  zoom aggregation, failures and coarse country-only response.
- `npm run test:stats`: daily country totals plus hostile legacy email labels in
  countries/sources/pages/browser/terminal are reduced to safe categories.
- `node tests/routes.mjs`: stats/private routing, redirects and private game bank.
- **49 browser checks passed** across privacy, existing persona/mobile/game-picker
  and country-list suites. The full run passed 46 checks initially; two existing
  analytics tests were updated to explicitly opt in and passed on rerun. One new
  language-preference retention check also passed. Two separate live Spotify checks
  bring the total to **51**. No failing check remains.
- Actual local PostHog SDK with all ingestion intercepted: no PostHog or country
  enrichment before consent; no Spotify before play; no tracking cookies or
  analytics browser storage after opt-in. Tests cover payload stripping, attribution,
  refusal/version/expiry, GPC, withdrawal/reload/cross-tab, blocked/read-only storage,
  private/admin exclusions, hidden notice during gameplay, all seven translations,
  reduced motion, reading-position preservation, mobile fit and player clearance.
- **Live Spotify iframe checks passed on /call and /music**: no Spotify request
  before play; actual iframe/API fetched after play, embed document HTTP 200.
  Observed cookie names/flags/lifetimes only were recorded, never values: `sp_t`
  ~365 days, `sp_landing` ~1 day. This verifies loading, not audible playback or
  every Spotify region/login variation. No synthetic visit was sent to PostHog.
- Search generator boundary: 285 public entries including /privacy, no report,
  trace, private/admin, easter-egg or tracking-shortcut entries. Rebuilt after changes.

Browser tests use local static pages and controlled first-party API fixtures;
backend behavior is tested separately against real local Redis. Production provider
settings, infrastructure logs/backups and historic production data were **not**
verified or changed. The PR/preview is not a claim of a production GDPR certification.

## Deployment and data-request runbook

No production credentials were available in this checkout, and no production Redis
mutation or provider setting change was performed. Tools below were exercised only
against a dedicated loopback database with synthetic addresses. Use the deployed
secret/environment through your normal secure environment loader, never commit it.

1. Verify encrypted Redis connection and signing secret, PostHog settings and provider
   contracts/retentions above. Confirm the actual Redis processor in the public page.
2. Deploy this branch's new writers before migrating; otherwise old code can recreate
   unbounded legacy lists. Avoid rolling back to the old writers after migration.
3. Preview `node tools/apply-privacy-retention.mjs`, then apply with `--apply`.
   SCAN batches locate keys. Recent legacy log records keep their original timestamp
   and remaining 90-day TTL; older/invalid rows are removed. Migration is idempotent.
   Legacy poll voters get bounded individual keys. Stable IP counters and old stats
   caches are removed; new daily `d1:` keys are preserved. Existing shorter TTLs are
   never extended. Untimestamped legacy voter records cannot be age-reconstructed;
   their maximum remaining retention becomes 365 days from migration.
4. Purge historic sensitive PostHog events/profiles/replay and review backups/exports.
   Cache version changes stop serving pre-fix data immediately; migration deletes it.
5. For a verified email request, run
   `node tools/delete-user-data.mjs --email person@example.test --dry-run`, then the
   same command without `--dry-run`. It removes current/legacy OTP and mail-rate keys,
   all matching sessions, current/legacy login/access rows, email fields in guesses,
   index references and private caches. Output is counts only. Avoid retaining the
   actual email in shell history/process logs; use a trusted operator session.
6. Request deletion of relevant Resend delivery records and check correspondence,
   exports and provider backups separately. Anonymous votes/aggregates cannot be
   matched to an email; do not invent an identity link to delete them. Reply within
   the applicable rights-request deadline, normally one month.

## Processor policy links

[Vercel](https://vercel.com/legal/privacy-notice),
[PostHog](https://posthog.com/privacy),
[Resend](https://resend.com/legal/privacy-policy) and [retention/US storage](https://resend.com/security/gdpr/),
[Upstash (if used)](https://upstash.com/trust/privacy.pdf),
[Redis Cloud (if used)](https://redis.io/legal/privacy-policy/),
[CARTO](https://carto.com/privacy),
[Spotify](https://www.spotify.com/legal/privacy-policy/),
[Apple](https://www.apple.com/legal/privacy/),
[Buy Me a Coffee](https://buymeacoffee.com/privacy-policy),
[Pidgy](https://app.pidgy-ai.com/privacy-policy).
Pidgy's policy URL is linked by its official Chrome Web Store listing; its contents
were not retrievable here. Listing a policy is not proof of a signed processor DPA.

### Exact final analytics payload surface

All of the following share **consent** as the collection basis, PostHog EU as the
recipient and the account event retention (90-day target, not yet verified).
The transport also inevitably receives IP, User-Agent, site origin and request time
while processing the request. No raw IP is an application property; discard-client-IP
must also be enabled in the project. Request credentials are omitted and no browser
identifier is saved. A daily cookieless pseudonym can correlate events within that day.

- Envelope: `event`, `timestamp`, per-event `uuid` (SDK deduplication only),
  `properties.token` (public project token, not a visitor secret),
  `distinct_id=$posthog_cookieless`, `$cookieless_mode=true`,
  `$process_person_profile=false`, `$geoip_disable=true`.
- Coarse context: `$host` (three owned hosts or other; preview/local hosts never become production), `$pathname` (known route category),
  `$current_url` (owned known path only, no query/fragment), `$browser` (allowlist),
  `$device_type` (Desktop/Mobile/Tablet/Other), `corvus_country_code` (country code),
  `$referring_domain` (known source category or direct/other).
- Attribution when present: `utm_source`, `links_source`, `source` (source allowlist);
  `utm_campaign`, `links_campaign`, `campaign` (known campaigns or other);
  `utm_medium`, `medium` (known medium/route categories); `links_person` identifies the public
  hub (gabe, corvus or pidgy).
- Event-specific: `link_href`, `page`; `host`, `href`, `path`; `url`, `target`,
  `external`; `link`; `genre`; `type`, `guesses` (0–6), `solved` (boolean), `day`
  (date only); `language`; `command`; `id`, `total` (egg category/count); `what`.
  These are the only properties beyond the common context and attribution.
- Rejected entirely: unlisted events, names/emails, form values, search text, free
  terminal text/arguments, arbitrary URLs/UTMs, song title/artist/ID, anchor/DOM text,
  IP properties, raw UA, detailed OS/device/screen data, session/window/device IDs,
  `$set`/`$set_once`, profiles, automatic pageleave/autocapture, replay and heatmaps.

Processor queries use server secrets, never browser API keys. The personal query
credential is not returned in public responses. Application `console` logging has
no visitor-data sinks; provider request/access/error logs remain a manual account
inventory item, not something this repository can enumerate as if it knew the
actual log drains or backups.

Preview validation: Vercel reported deployment success for `89d2d3f`; the secondary Netlify preview also built successfully. Production /privacy still returned 404 as expected before merge. Provider account settings remain unverified.

## Frankfurt migration extension — 4 November 2026

This extends the same daily PR. Gabriel approved **retaining Resend temporarily as
an explicitly documented exception**: its Ireland sending region does not move
email content/logs out of US storage. The site must not claim EU-only processing.

| ID | Additional finding | Fix / remaining action |
| --- | --- | --- |
| P21 | Live functions execute in `iad1` (US), even though requests enter through `fra1`. | **Code fixed:** top-level `regions: ["fra1"]`. Dashboard setting, production deploy and uncached after-check pending. Static CDN/routing middleware remain global. |
| P22 | Current Redis provider/host/region cannot be established without deployment credentials. | **Prepared, not migrated:** binary-safe SCAN + atomic DUMP/PTTL + RESTORE ABSTTL tool, dry-run default, count/content/expiry verification, isolated local tests. Gabriel must confirm current region and create Frankfurt database if necessary. |
| P23 | Several cookie/OTP/game secrets fall back to Redis credentials; changing only the database can invalidate sessions/votes or change the daily puzzle. | **Fixed:** dedicated resolvers and a private-file pinning tool preserve each existing value before the environment changes; regression-tested across old/new credentials. Pinning in Vercel remains an operator step. |
| P24 | Legacy Marketplace REST settings took priority over `REDIS_URL`, so a URL switch alone could keep using the old database. | **Fixed:** explicit `REDIS_URL` wins; legacy-only REST precedence is unchanged. Maintenance mode rejects all adapter commands/pipelines for a controlled pause. Old deployments/jobs must separately be stopped. |
| P25 | `POSTHOG_HOST` could override the EU endpoint with a US/arbitrary host. | **Fixed:** only HTTPS `eu.posthog.com` accepted for server queries; a bad override fails closed before sending the query or key. Browser ingestion remains the existing EU host. |
| P26 | An Irish mail-sending region could be described incorrectly as EU mail storage. | **Documented exception:** all seven privacy translations distinguish Resend sending from US content/log storage; actual domain sending region/account retention still require verification. |

### Updated processor locations and transfer position

- **Vercel:** code configures application functions in Frankfurt; live migration
  not yet verified. Static delivery and routing use a global network, so request
  metadata still reaches global infrastructure. Vercel is a US company; its
  [DPA](https://vercel.com/legal/dpa) and published
  [EU–US DPF participation](https://vercel.com/security) provide transfer
  safeguards. Confirm the actual account agreement, log drains, retention, support
  access and backups; do not interpret those safeguards as EU-only storage.
- **Redis:** Frankfurt (`eu-central-1`) is the target. Current provider, effective
  host, region, replicas/backups and completed migration remain **unverified**.
  No secret or production URL was available in this working environment. Tools
  use encrypted transport and never report keys, values, email addresses or URLs.
  The operator's temporary copy is for the requested infrastructure move under
  the same underlying purposes/bases as the original records; no retention reset.
- **PostHog:** Cloud EU uses [Frankfurt](https://posthog.com/docs/privacy/data-storage).
  Browser/server endpoints are EU, but project discard-IP and retention account
  settings remain manual. Region pinning does not replace consent/minimisation.
- **Resend:** retained by Gabriel's explicit choice. Ireland (`eu-west-1`) is the
  intended sending region, pending domain/account confirmation; [sending-region
  docs](https://resend.com/docs/dashboard/domains/regions) explicitly separate
  this from US storage. Existing disclosed 30-day mail/log / 7-day backup retention
  applies to Free/Pro/Scale per [Resend GDPR](https://resend.com/security/gdpr/);
  actual plan and DPA/SCC/DPF safeguards still require account confirmation.
- **Secondary Netlify previews:** remain a separate provider/deployment check;
  Vercel's `regions` setting does not configure Netlify. Remove unused copies.

### Migration operations and retention

Follow [tools/EU_MIGRATION.md](tools/EU_MIGRATION.md) in order. Pin existing signing
values before the URL changes, restrict all writers including historical deployment
URLs, dry-run then copy with original absolute expirations, require successful
verification, switch/deploy, check product flows and execution region, and retain
the read-only old database for **7 days from the actual switch**. Then Gabriel
removes it and applicable backups. During this window data requests cover both
copies. A rollback after new writes needs reconciliation; the old copy is stale.
The migration never modifies the source or automatically deletes either database.

### Verification evidence

- [Live before report](tests/results/eu-region-before.json): **Belgium confirmed**
  by the site's coarse-country response. Five uncached samples per endpoint on
  4 November 2026: `/api/auth` median **162 ms**, p95 **1096 ms**;
  `/api/geo?country=1` median **155 ms**, p95 **235 ms**. All execution regions
  `iad1`, ingress `fra1`. Total response time, including cold connection effects;
  this is not Redis latency and no speedup is claimed yet.
- Local Redis migration tests cover binary key/value data, strings, hashes, lists,
  sets, sorted sets, streams with consumer groups, original TTL and persistence,
  no-write dry-run, same-target/non-TLS/nonempty-target/unpaused-write refusal,
  partial-copy resume, and count/value/expiry corruption detection. Source stays
  unchanged. Dedicated disposable loopback databases 11/12 only.
- Config tests cover signing-value stability, owner-only secret files outside the
  repository, no overwrite/no secret logging, explicit URL versus legacy REST
  selection, maintenance refusal, EU PostHog guard and the single fra1 region.
- Existing privacy-data, all eight daily-game engines, geo aggregation and daily
  country-stat checks pass after the refactor. Browser translation checks include
  the new processing-location section in all seven languages.
- **Not completed here:** production Redis location lookup/copy, Vercel account
  changes, Resend domain-region check, production function after-check, or an
  after-move Belgian latency comparison. These require the actual account/URLs
  and deployment; no sample or preview success substitutes for them.

## Notion X-log extension — 4 November 2026

Gabriel requested a Notion-backed X activity dashboard in this same daily PR.
The source is his manually entered log, not a crawler of other people's X posts.
No browser sends requests to Notion, and no Notion/X SDK or embed is added.

| ID | Finding / implementation constraint | Fix |
| --- | --- | --- |
| P27 | The privacy allowlist drops new X campaign names and all region-hour attribution; old hub/shortcut tagging replaces that slot. | **Fixed:** after analytics consent, load a cached catalog of owner-curated campaign slugs; retain only approved X campaigns and `eu/sf` + integer hour slots. Preserve slots through /links and /go. Unknown free-form labels are still stripped. |
| P28 | A public Notion serialization could expose reply text, target URLs or internal page IDs. | **Fixed:** explicit public aggregate projection; only `type=post` URLs for `gabe_maxxing/status/...` qualify for own-post text publication. Full rows stay session-protected/no-store. Manual sync also checks same-origin. |
| P29 | 2,000 writes at Notion's request limit exceed one server invocation; concurrent page views could duplicate writes. | **Fixed:** 350 ms request spacing, Retry-After, Redis lease, 15-minute start gate, durable cursors/checkpoints, authenticated continuation, daily backup cron. Unchanged rows are not rewritten. Every new Redis key expires. |
| P30 | Summing landing, generic link and outbound events would count the same action multiple times. Missing/shared attribution cannot identify an individual reply. | **Fixed:** Corvus landing views and canonical Pidgy actions only; exclude /go pageviews, internal links landings and generic click events. Fractional shared-key allocation is labeled an estimate. Unmatched clicks remain unassigned, visible in totals. |

### Added inventory

| Surface / key | Data and purpose | Basis / recipient / retention |
| --- | --- | --- |
| Notion source `X log` | Owner-entered posting date/hour, audience region, reply/post type, voice/lane, campaign, target/my/link URLs, text and link type; updated with counts, estimate flag and sync timestamp. | Owner-requested dashboard; LI for proportionate outreach measurement, subject to Gabriel's balancing/retention decision. Notion stores the source; source retention is controlled in that workspace and is not changed by the Corvus TTL. Confirm DPA/deletion/region. |
| Server → Notion API | Database/source/page IDs and authentication token; reads rows/schema, writes only four sync columns. | Same purpose/basis; Notion receives the server request, not the visitor's browser/IP or cookies. No credentials in code or public JSON. |
| Server → PostHog EU | Bounded aggregate query by date/campaign/region-hour/destination, paginated; no visitor-level results. | Existing optional-analytics consent for input events, LI for anonymous totals. Existing PostHog retention applies. |
| `x:public:v1`, `x:campaigns:v1` | Aggregate stats + latest 50 eligible own posts; curated public campaign slugs for the capture allowlist. | Owner-requested publication / anonymous totals. Redis and public browser/CDN; 900 s, CDN no longer than remaining Redis TTL. |
| `x:public:last:v1`, `x:result:v1:<run>` | Last public snapshot / computed snapshot for resume. | Same public data; Redis, max 24 h. Stale responses are labeled and not CDN cached. |
| `x:private:v1`, `x:rows:v1:<run>:<chunk>` | Snapshot manifest and normalized full log rows, including private reply text/target URLs. | Same limited dashboard purpose; Redis + authenticated dashboard only. Max 24 h per stored copy; previous row chunks deleted when replaced. Private response no-store, 50 rows/page. |
| `x:clicks:v1:<run>:<chunk>` | Aggregate date/campaign/slot/destination counts awaiting the join, no identities. | Anonymous computation; Redis, max 24 h, removed after writeback completes. |
| `x:job:v1` | Run/source IDs, cursors, counts, stage and retry timing; no token or personal click identifiers. | Necessary operational state; Redis, 24 h. |
| `x:lock:v1`, `x:start:v1`, `x:error:v1` | Random lease token, start gate, sanitized provider error category/time. | Necessary anti-duplication/rate protection; Redis, 270 s / 900 s / 900 s. No raw provider error body is logged or returned. |
| Added analytics properties | `utm_content` only `eu/sf` + 0–23; X `utm_campaign`/`campaign`/`links_campaign` only owner-approved slugs. | Existing affirmative consent and PostHog EU retention. Describes a public marketing slot, never a visitor. No new cookies, localStorage keys, email/name, visitor ID or raw IP. |
| Daily cron / continuations | A bearer CRON_SECRET authenticates requests to the owned production API. | Necessary background sync; Vercel functions configured Frankfurt. Secret stays in environment/headers; never in URLs, stored job state or response data. |

### Publication and attribution limits

Reply text and `target_url` never enter the public payload. The public page uses
one cached JSON, no live Notion calls; own-post links are plain links, not embeds.
Voice and campaign labels are intentionally public, so they must not contain
personal identifiers. Private table filters are server-side and not tracked.

CSV date/hour are assumed Europe/Brussels for both audience regions; this was
asked explicitly and remains the documented default pending a different answer.
The join uses click calendar date plus logged region-hour and campaign. Links do
not carry a posting-date identifier: late clicks are not reliable per-post
attribution. Shared linked rows split counts and carry `clicks_estimated`; missing
slots never get guessed. The visible rate is clicks per logged link, can exceed
100%, and is not X's impressions CTR. Refused analytics stays uncounted.

### Notion residency / data requests

Notion is an additional processor, not covered by Vercel's Frankfurt setting.
Its [residency documentation](https://www.notion.com/help/data-residency) says US
storage remains until an eligible Enterprise EU migration is confirmed, and even
EU residency has scope limits. This workspace's actual region/agreements remain
unverified. All seven privacy translations now disclose the integration and the
24-hour Corvus-copy limit; no unconditional EU-only claim is introduced.

For a data request involving an X record, Gabriel must correct/delete the source
in Notion and refresh/clear relevant 24-hour snapshots/jobs. The email-only deletion
tool cannot infer a social profile's row from an email address. Notion source
retention and backups need separate review. Follow
[tools/notion-setup.md](tools/notion-setup.md) for integration/sharing/env settings,
schema, attribution examples, first sync, failures and operational checks.

### Evidence

- Local real Redis + controlled Notion/PostHog fixtures: empty, one and 2,000 rows,
  paginated reads, resumed writes, per-row estimates, no unchanged-row writes,
  lease/throttle/expiry and API session/origin/cron boundaries.
- Real browser privacy transport tests: approved X campaign and slot preserved
  after opt-in; no catalog request before opt-in; arbitrary visitor labels stripped;
  /links and /go propagate the slot. Public responses exclude unique reply/target
  fixture markers; private rows include them only after authentication.
- New page/mobile/private browser checks pass after correcting a narrow-screen
  grid overflow and explicit filter labels. Local tests never write a real Notion
  workspace or fabricate production PostHog events.
- [Lighthouse comparison](tests/results/lighthouse-x.json): three alternating
  mobile runs, 6× CPU slowdown, cached API fixture from 2,000 rows (latest 50 own
  posts). Existing overview median **100 → 100**, new X page median **100**;
  new page CLS **0.014**, TBT **0 ms**. Local lab evidence, not field measurements.
- Live integration/sharing/env variables, actual Notion region and production
  writeback remain manual verification; credentials were not available here.

Deployment footprint: `/api/hit` retains its route and behavior through a rewrite
to the existing stats function; its helper is now `_hit.js`. This keeps the API
function count at 11 while adding X stats. Route and country-stat checks pass.

## LinkedIn company vanity links — 4 November 2026

`/enter`, `/the-crow` and `/revived` are fixed server-side 307 redirects, accepting
one trailing slash. They do not create content pages or entries in navigation,
search or a sitemap. Existing /realm, /games, /music, /call and stats routes remain
unchanged. Exact targets and local HTTP HEAD evidence are in
[tests/results/vanity-redirects.json](tests/results/vanity-redirects.json).

| ID | Finding / requirement | Fix |
| --- | --- | --- |
| P31 | Company-page campaign/content labels would be stripped by the existing analytics allowlist, while incoming tracking tags remained in the address bar. | **Fixed:** allow only the two named LinkedIn campaigns, company-page/company-post media, and button/website content for the company-page campaign. After the pageview capture call, remove all utm_* and ref query keys using replaceState, preserving functional queries, hash and history state. |

Initial UTM values are retained only in this page's module memory so delayed consent
and link-hub/short-link propagation still work. No new cookies, localStorage,
Redis records, visitor IDs or raw ref property are introduced. Without permission,
on private/non-analytics pages, or when the SDK is blocked, URL cleanup still works
without sending analytics. An SDK-load timeout also cleans the URL; memory retains
the attribution for a later successful opt-in capture. There is no claim of server
acknowledgement: URL cleanup follows the capture call, not a receipt from PostHog.

Checks: real local `curl -sI` yields the exact 307/Location for all six slash/no-slash
variants. Browser tests preserve company attribution after cleanup and delayed
consent, handle an existing opt-in, retain unrelated params/fragments/history state,
and still propagate X slots after removing them from the visible URL. No production
redirect claim is made before merge; Vercel's protected preview may intercept curl
with its own login response.

## SF trip extension · 4 November 2026

| Surface / key | Data, purpose and ground | Retention / recipient |
| --- | --- | --- |
| `/sf` form → `/api/sf` | Name/contact, work, requested activities/days, venue, optional message; arranging the visitor's requested meeting (Request), no marketing use. | Only Gabriel's exact email session can read leads. Existing Vercel Frankfurt function / configured Redis; no new public data endpoint. |
| `sf:lead:<random id>` | Only the submitted fields, creation date and done flag. | Individual 60-day expiry from creation; done updates keep TTL. |
| `sf:leads` | Random-ID/timestamp index, no names or contact fields. | 60-day TTL; stale IDs pruned on read/write. Individual record expiry prevents sliding retention. |
| Existing `vid` cookie | Reused signed anti-abuse identifier; not passed to analytics. Issued only when the form requests a challenge. | Existing Secure, HttpOnly, SameSite=Strict, /api, max one year; no new cookie name. |
| `sf:challenge:<id>` | Random salt, difficulty, minimum time and signed-voter binding; Request/security LI. | Single use, 5 minutes. |
| `sf:challenge-rate:<daily hash>` | Count, no raw IP. | 10 minutes. |
| `sf:cool:v:<voter>`, `sf:cool:ip:<daily hash>` | Abuse-prevention cooldown counts. | 60 seconds. |
| `sf:day:<daily hash>` | Accepted submission count; daily scoped HMAC, never raw IP. | Until next UTC midnight, at most 24 hours. |
| `sf:receipt:<voter>:<random request id>` | Random lead ID only, prevents duplicate submissions. | 24 hours. |
| `sf:mail:<id>`, `sf:outbox` | Pending/sent status and random-ID queue; delivery reliability. | 60 days, original lead lifetime; removed from queue on success. |
| `sf:mail-lock:<id>` | Random concurrency token, no contact contents. | 30 seconds, normally deleted immediately. |
| Resend notification / receiving mailbox | All form fields sent only to gabriel@corvus.gent; valid visitor email may be Reply-To. Request; existing disclosed Resend US-storage exception. | Existing Resend retention; receiving-mailbox 60-day deletion must be configured by Gabriel. Not enforceable by this repository. |
| `sessionStorage['sf-note:2026-11']` | Boolean shown flag, no visitor ID; display preference to prevent repeated flight. | Browser tab session; feature hidden after trip cutoff regardless of flag. |
| `sf_note_seen/open/click`, `sf_form_start/submit` | Optional consent-gated event counts and already-allowed campaign/page categories. | Existing PostHog retention; no form fields, contact, request/lead ID or cookie ID allowed in events. Private funnel only. |

`/privacy` explains this in all seven languages and the notice version is updated.
The signed `vid` reuse does not join leads to language votes in application data.
Email and direct-ID deletion helpers remove records, delivery status and indexes;
mailbox copies need separate deletion. Public replies contain no personal fields.
There is no body logging, third-party browser embed, new analytics identifier or
browser call to Resend/Redis. Static `sf.json` is owner-curated public event data.

### Coffee totals and sidequests attribution · 5 November 2026

| Data | Purpose, access and retention |
| --- | --- |
| Buy Me a Coffee v1 supporters, subscriptions and extras | Server-only bearer token. Process contribution dates, quantities, transaction IDs and available account/email fields in request memory to deduplicate and count. Names, messages, payment details and individual records are never sent to visitors, written to Redis or logged by the app. Existing providers retain their own source records. Legitimate interest in publishing aggregate support. |
| Redis `stats:coffee:v1:YYYY-MM` | Anonymous totals, estimated-count flag and latest Brussels calendar date. TTL 1,800 seconds. The Frankfurt function can keep the same aggregate in memory for up to 30 minutes when Redis is unavailable. No browser requests to the coffee provider. |
| `sessionStorage['sidequests:arrival']` | With analytics consent, this tab remembers six approved campaign categories until closed or consent is withdrawn. PostHog EU receives those categories on pageviews and subsequent events. Unknown labels are reduced to categories; no LinkedIn account or person is identified. `sidequests_cta_click` adds only home/contact/pidgy; `sidequests_share` adds native/copy/linkedin/x. The external share destination always receives the untagged canonical URL. |
| One-time home-click receipt | With analytics consent, `sessionStorage['sidequests:home']` holds a timestamp so same-tab navigation can finish sending the click. Consumed by the home page, accepted for 30 seconds and cleared on withdrawal or tab close. |
| Realm preferences | The tab stores a rotating line number in `realm:whisper`. The first deliberate reward claim saves one existing feather slot in `realm-feather` using the standard one-year preference expiry. These UI choices never enter analytics. |

### Stats snapshots and service health (5 November 2026)
- Stats pages cache the public figures for a selected Brussels day in sessionStorage under `stats:snap:v1:<page>:<day>`. They expire with the tab. The client ignores recent-day entries older than seven days and X entries older than one day. Private tables and sessions stay out of this cache.
- Redis stores daily public counts under `stats:snap:<page>:<day>` and a last-known copy. Completed historical aggregate counts are retained for comparison. X and authenticated dashboard snapshots expire within 24 hours. Personal login, access and SF records are read only through the existing authenticated routes. They keep their existing expiry rules.
- During a Redis outage, the Frankfurt function can cache allowlisted public aggregates and public service health for up to 24 hours in Vercel Runtime Cache. Empty failure results expire after 20 seconds. Private dashboard tables, sessions and personal records stay on their existing authenticated paths. [Vercel Runtime Cache](https://vercel.com/docs/caching/runtime-cache)
- Health probes use fixed service URLs. Public results contain component states, elapsed times and timestamps. Redis keeps five-minute samples for 48 hours, hourly summaries for 30 days and Brussels-day summaries and bounded incident history for 120 days. Public history responses are cached for one hour. Alert state expires after 30 days. Write probes expire after 15 seconds. Sampling leases expire after 30 seconds for visitors and four minutes for the five-minute monitor. Rate-limit buckets use the existing daily-salted address hash and expire after a minute.
- Gabriel can receive a service name and status change via Resend. The external uptime monitor reads the same public status as a visitor. No visitor details are sent in an alert. Processing serves availability and abuse prevention.

## Legion/accounts/BMC/Discord — 6 November 2026

The new handlers use the existing Frankfurt Redis connection. The temporary
plaintext exception still applies to OLD; NEW TLS was re-tested and is refused.
No migration or weakening of secureEndpoint is included in this feature.

| Data / key family | Purpose / basis | Retention / recipients |
| --- | --- | --- |
| Signed HttpOnly Secure army_id, army_session, army_ref cookies | Requested account continuity, authentication, referral attribution | 90 / 7 / 30 days; Corvus only |
| army:*:u, name, code, email-HMAC, owned, game-owner | Requested account, public handle/link/optional country, progress; private email and application reason | Anonymous 90d; unconfirmed 7d; waiting 90d from application; rejected 30d; member 365d renewed on confirmed login or active entitlement; Redis/Vercel |
| token/session/challenge/unsubscribe records | Necessary authentication, independent opt-in and unsubscribe | 30min / 7d / 5min / up to account expiry (365d); Redis |
| Daily salted rate/referral IP keys | Legitimate-interest abuse prevention; no raw IP stored | Max 24h; Redis |
| Referral receipts / weekly leaderboard | Earned recruitment progress, deduplication | Receipts max367d; weekly 9d; owned records erased on deletion |
| mail jobs, outbox, encrypted payload | Requested login/invitation; reminders only after separate confirmation | Ordinary jobs2d, claim token30min, invitation until account expiry; Resend is the documented US-storage exception |
| BMC event records | Fulfil requested payment, match verified account, expire paid tier | Unmatched30d; matched max365d clamped to account; removed on account deletion; BMC/Redis/Vercel |
| BMC receipt/payment-object HMAC | Prevent duplicate delivery/refund counting | 400d; no payer name/email/message; anonymous total remains |
| Discord user ID, owner mapping, one-use code, encrypted invite | Link approved account and grant/revoke role | Code10min; invite7d single use; mapping follows account max365d; Discord/Redis |
| Discord config/audit | Server routing and permission safety | Config persistent role/channel/approved owner IDs; audit2d; alert debounce1d |

BMC supporter email is used in memory only for a hashed lookup against an
existing verified account, then discarded. Unknown payer email, payer name and
free-form message are not stored. Only a handle is extracted from the message.
Public legion JSON contains username, tier, earned rank, country, link and join
date; no email or account IDs. Hide removes it from lists; the shared profile
remains available until deletion. Export excludes credentials and other users.
The account page removes mail tokens from the fragment before app code and does
not load analytics. No geolocation request is implemented in this base; country
is explicitly chosen. QR code generation is self-hosted and sends no request.
Discord is not connected until its token and installed-guild configuration exist.

## Earned contribution records — 6 November 2026

- Owner-confirmed help/intro: private reference, kind and approval date in `help-report:<uid>:<hash>`; at most 90 days, clamped to account expiry. Necessary requested account progress; only the owner dashboard and the account export can read the reference.
- `help-credit:<uid>:<hash>` prevents repeat awards until account expiry; only a digest and boolean. Counts remain on the account. Both keys join its deletion registry and carry TTLs.
- Pidgy trial email hashes expire after 400 days and now join the referring account’s deletion registry. Raw email is never stored. The signed trial/deduplication/rank count commit together; retries after contention cannot burn a credit.
- No payment, tier, feather, streak or old weekly-win field influences rank or admission order. The application queue is chronological. Legacy records are retained; earned rank is recomputed on read.

## HackTheFeed beta (7 November 2026)
- Squad member links: aggregate counters in `hack:members` keyed only by the public hackathon/member IDs, without retention of individual clicks or visitor IDs. PostHog `squad_member_click` allows only Gabe/Siebe IDs and a bounded hackathon number; existing GPC/DNT/refusal applies. Historical counts for hidden roster members are returned as XX. The shared daily-salted abuse bucket expires after 60 seconds.
- `/api/hack`: aggregate consent-allowed views/source/app/GitHub/share events; explicit reactions and submissions work without analytics consent. No fingerprints or user-level funnel. PostHog only runs under the existing consent policy; event metadata is allowlisted, never comment text or contact details.
- Public comments: name/text/date, 90-day individual TTL; text-only rendering. Feedback: text and optional email, private to Gabriel's authenticated dashboard session, 90-day TTL. Honeypot, same-origin JSON, bounded input, daily-salted rate-limit hashes (60 seconds), reaction dedup hashes (24 hours). Anonymous aggregate totals have no personal data. Hide a comment with `SET hack:hidden:<id> 1 EX 7776000`.
- App iframe loads the Corvus-operated the-feed.corvus.gent host. API-generated clips remain disabled without GMI_API_KEY. Generation and retry share an atomic Redis clip budget: default 20/day, six/day per daily-salted IP, keys expire after two days. Generation fails closed if storage is unavailable. API inputs can be sent to GMI only when generation is requested; Oriane discovery requires its own key. No raw IP retained.


## Compound experiment — 7 November 2026

- Public route `/compound`, redirects `/prize` and `/1000`. Aggregate view/play/watch/reaction/vote/poll/prediction/source counters have no user record and may remain. These are events, not verified unique people.
- Persistent cross-visit journey measurement is **off by default**. A fresh random page-visit ID is held only in JavaScript memory by default and links events for that visit; it is not device storage and resets on reload. GPC/DNT/site refusal disable it and leave aggregate-only measurement. Session-linked events expire by day within 90 days. `compound-journey-choice` stores the explicit preference; `compound-journey-v1` stores a random UUID, first and last allowlisted campaign fields, coarse known referrer hostname, landing time and expiry, for up to 90 days. GPC/DNT/site refusal override it. Opt-out removes the local ID. This is pseudonymous and uses consent, not a claim that localStorage analytics is anonymous. The main site’s cookieless policy remains as documented above.
- `compound-handle` is an optional user-requested functional preference. Handle is public in the top-helper list; written feedback is private to the admin/stats dashboard, not automatically public. No email field is collected.
- Necessary signed `vid` cookie is issued only on contribution/profile/prediction actions (existing shared one-year cookie). Feature-specific HMAC duplicate records, helper profile/score, text, poll and reaction dedupe keys use 90-day TTLs. Daily-salted IP rate-limit hashes expire at 60 seconds or one day; raw IPs are not stored by this feature. Public GETs create no cookie.
- `compound_auth` is a signed, HttpOnly, Secure, SameSite=Strict cookie, path `/api/compound`, four-hour expiry; separate admin/stats passwords are sensitive environment variables. Passwords never enter analytics. Private JSON is no-store and server-authenticated.
- Videos/version metadata are intentionally public. Vercel Blob store `corvus-compound-videos` is in Frankfurt, files delivered through Vercel CDN. Metadata has no personal fields and is retained as the edit history. Upload tool strips embedded file metadata.
- Stripe is contacted only after an explicit support click. Stripe processes payment/card/contact data under its privacy policy; the Corvus webhook stores only payment reference, gross euro cents, refund state and coarse source for one year. Checkout attribution lookup expires in seven days. No webhook body, card data or payer email is logged/stored here. Support is optional personal support, not a charitable/tax-deductible claim.
- Preview uses `compound-preview:*`, production `compound:*`, with test and live payment ledgers separated again. Existing Redis transport configuration is inherited, including its temporary exact-host plaintext exception; this change does not claim that Redis transport is already encrypted.
- Browser details/rights/retention appear in `/compound/rules/#privacy`. Stripe: https://stripe.com/privacy. Vercel: https://vercel.com/legal/privacy-policy. Existing processor terms and hosting log controls still apply.

### Compound three-cut extension
- Three independent video slots retain their upload histories/cutlists in public metadata; no personal data in video records. Transition votes/tags, watched-cut eligibility and battle/pick deduplication use the existing necessary voter cookie. Feature keys expire after 90 days.
- Eleven short links record aggregate clicks and carry source/medium/campaign plus `utm_term` (slug) and optional `utm_content`. First/last campaign aggregates and pseudonymous watch/engagement dedupe expire after 90 days. No original referring path/query is saved. Referrers remain a known-host allowlist.
- Stripe checkout attribution also carries the allowed page-visit ID, first/last touch and selected cut, so the signed payment event can complete that journey. Checkout references expire in seven days; the minimal payment/refund record expires in one year. No card, payer identity or email stored by this feature.
- Revolut is an external payment service; the feature stores only the public payment link and admin-confirmed aggregate euro totals before/after the deadline. The admin may attribute a correction to a campaign without entering payer details. Revolut privacy: https://www.revolut.com/legal/privacy/.


## Twitch embed — 7 November 2026
- Urgent live update: /, /hack and /hack/2 automatically load the Twitch status/player SDK unless GPC, DNT, an explicit counting opt-out or the per-tab Twitch disable preference is present. This replaces the original click-only implementation; automatic third-party requests are now an explicit exception to the site's default.
- Twitch/Amazon receives IP/browser information and embedding origin/path and may set vendor cookies/storage. This is not cookieless analytics. The page notice says so; https://www.twitch.tv/p/en/legal/privacy-notice/ describes vendor processing and retention. A disclosure alone is not a claim of visitor consent.
- A disable button removes the iframe and stores only sessionStorage twitch-disabled=1 for this tab. Existing Twitch cookies are vendor-controlled. Corvus stores no viewing history.
- The homepage never shows a player; its badge links to /hack only after a real online signal. Offline hides badge/player. Browser privacy signals retain click-to-load on the hack pages.
- Privacy page and notice cover this in seven languages.

## Arcade title vote
- localStorage corvus-name-vote-v1 holds a random device ID and chosen title solely to prevent repeat votes; it remains until browser storage is cleared. The existing necessary signed mvid voter cookie adds cross-tab deduplication (365-day max age). No analytics is loaded on the poll.
- Redis namevote:v1 (preview uses namevote:preview:v1): aggregate title counts contain no identities; HMAC device/cookie dedupe keys expire after 90 days. IP rate keys use a daily rotating hash and expire after 60 seconds. No raw IPs, names or emails are stored.

## Arcade runs, public scores and feedback
- Anonymous run IDs/HMAC device keys deduplicate starts and expire after 24 hours. Play totals/top score are aggregates. Public leaderboard names are deliberately submitted, limited to 16 characters, and entries expire after 90 days; client scores have rate/plausibility checks, not cheat-proof verification.
- Ideas are public, bug text is private. Both expire after 90 days; maximum 600 characters and five messages per IP per minute. No raw IPs or contact details. Idea votes use existing signed voter identity with 90-day dedupe; a local preference remembers which buttons were pressed.
- Story PNGs and generated sound stay in the browser. speechSynthesis uses the browser/OS speech service; voice availability and offline/network processing depend on that provider.

## Plethora referrals (8 November 2026)

- `/go/plethora-<placement>` counts a click, then sends iPhones to the App Store and other devices to the local QR page. The App Store receives a placement campaign (`ct=corvus-<placement>`), optional public affiliate `pt` and referral `ref` code only after navigation. No Apple/Plethora SDK or third-party request loads merely to show a promotion.
- Redis `plethora:v1:clicks` contains aggregate counts by the fixed placement allowlist; no identity, no expiry required. Preview counts use a separate `plethora:preview:v1` namespace.
- `plethora:*:dedupe:<placement>:d1:<hash>` is a daily-salted HMAC of the in-memory network address, scoped to this placement, with a 30-minute TTL. Raw IPs, UAs, referrers and emails are not stored. The previous day's salt is checked for the 30-minute midnight overlap; hashes cannot be linked across days.
- `plethora:*:recent:<placement>` contains only random non-identifying click sample keys and times for the rolling 24-hour sum. Records older than 24h are pruned on write; the whole set expires after 25h. No visitor-level details are exposed in the report.
- Browser preference `plethora.home.dismissed=1` remembers only a deliberate banner dismissal until cleared; it does not identify a visitor or count views. `plethora.admin` is a private access key kept in sessionStorage for the admin tab, never sent to Apple/Plethora. The admin page immediately removes `?key=` and sets `Referrer-Policy: no-referrer`; counts require the dedicated key or Gabriel's authenticated session.
- Referral codes and App Store provider IDs are public configuration. `PLETHORA_ADMIN_KEY` is a sensitive server secret, never part of the public API or committed source. The public API returns only aggregate total clicks and public referral configuration.


## Gabinho Rolls v2 — TikTok creator profile (7 November 2026)

- `/gabinho-rolls` serves the supplied logo and compressed highlight from Corvus/Vercel. The profile/medal photos will be static assets when supplied; no external player or image service is contacted for them.
- The optional official TikTok creator-profile embed contacts `www.tiktok.com` and TikTok-selected hosts **only after “Load TikTok edits” is clicked**, with a visible cookie/privacy disclosure and direct profile fallback. TikTok receives the browser connection information and controls its cookies/storage and retention. Corvus uses no additional visitor ID or local preference for this player. Initial page load makes no TikTok request.
- Existing site analytics and privacy controls are reused. There is no new API, account flow, form, email or stored personal data. Missing optional photos are omitted from the rendered page, not replaced with invented portraits.
