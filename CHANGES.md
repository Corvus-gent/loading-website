## 2026-11-07 — codex/gabinho-rolls-v2

- Reposition Gabinho as a traveling BJJ competitor, replace belt artwork with the supplied unchanged Monferno logo/favicon, add registered competition cards, and preserve the five paybacks/contact CTAs.
- Host the 40-second Compound highlight at 3.81 MB (the source blocks iframes); add an opt-in official TikTok creator profile with recovery links. The supplied surf photo is the circular profile, poster and OG image. The medal-photo slot activates during build once gi-medal.jpg is supplied.

## 2026-11-07 — codex/gabinho-rolls-page

- Add /gabinho-rolls, a short English pitch for one free BJJ class, with five concrete ways Gabriel gives back and direct Instagram/email contact links.
- Match the site's monospace, black and lantern-yellow styling; add an original white-belt illustration, dedicated social preview, existing privacy/analytics/footer integration and generated search entry. No dependencies or backend changes.

## 2026-11-08 — codex/plethora · tracker v2

- Preserve originating placement through the landing page and suppress its second store-button count. Add Android/explicit-store routing, desktop-only tracked QR, bio aliases and six new placements without resetting old counts.
- Add public aggregate stats by placement/category/platform with rolling 24h and seven UTC days; show historical platform/history gaps honestly. Add live homepage/landing counters and a dedicated original pixel-art OG image.
- Keep Play Store URL, App Store provider ID and referral code empty until supplied. Missing Android URL has an honest landing fallback, never a guessed app link.

## 2026-11-08 — codex/compound

- Put the video, one-tap quick feedback and latest-five public wall first. Remove the prediction UI and both client/server watch gates; retain deduplicated cut votes and existing editing tools in a disclosure.
- Save per-version chips and boredom timestamps using the signed voter identity; allow owned text follow-ups, optional credit handles and private spam removal. Keep historical private feedback off the new public wall.
- Run the fixed-deadline clock separately from modules/data, show recovery controls on loading failure, and keep an explicit expired-deadline result. Update helper rewards to final-video credits.
- Validate Redis persistence/deduplication/auth/TTL, mobile Safari/Chrome and desktop flows, module-failure recovery, and preview with an isolated Compound data prefix. No production feedback writes or main push.

## Twitch live badge — 2026-11-07
- Shared vanilla LiveStream component on /hack and /hack/2, driven by Twitch online/offline/play events; no API keys or backend. Exact preview hostname included in parent allowlist.
- Offline player collapses fully; online badge jumps to the player. Mobile scaling, keyboard focus, blocked-embed fallback and reduced motion supported.

## TikTok account links — 2026-11-07
- /tt, /tt-bjj and /tt-g redirect to Compound with account-specific bio attribution. Queries and ?c= overrides survive; clicks use the existing aggregate logger.
- Compound’s private source table lists all three accounts separately, including link clicks and zero-count accounts.

## 2026-11-07 — Compound live Stripe setup

- Verified activated Corvus live account; created €1-minimum live payment link and signed webhook, with sensitive Vercel Production configuration. Preview remains sandbox; publication follows daily PR #18. No real payment/payout or main push.

## 2026-11-07 — codex/compound-prize

- Add /compound: countdowns, versioned Blob video, timestamped feedback, polls, helper scores, predictions and protected control/stats pages.
- Add custom-amount Stripe support with signed, idempotent payment/refund handling, separate preview data, upload/digest CLIs, and mobile/backend checks.

# Changes

## 2026-11-06 — earned ranks and phone audit

BMC grants supporter perks only. Applications are chronological, without payment, Pidgy or recruiting priority. Rank uses owner-confirmed help/intros (+25), daily missions (+10), qualified Corvus recruits and unique signed Pidgy trial referrals (+100 each); legacy cosmetic/payment bonuses no longer count. The owner dashboard records private, deduplicated help references with expiry/export/deletion. Fix duplicate social/profile links, reduce privacy realm links and add home navigation to all link hubs. All army imports/entries/locales share `20261106-earned1`.

## 2026-11-06 — PR #25 final integration

Merge Claude’s integration branch while preserving later mobile form fixes, current copy, consul/Pidgy UI and WebP artwork. All army imports, HTML entry scripts and feature-locale URLs move together to `20261106-integration25`. No blocking splash returns.

## 2026-11-06 — codex/pidgy-ui final integration

Keep the live mobile form fix, use Claude's consul tier and private war council, and remove the superseded investor extension. Hero assets are quality-78 WebP; mobile uses the 800px ceiling. Screenshots and Lighthouse evidence stay ignored locally. Remove the one-off asset publishing workflow after successful publication.

## 2026-11-06 — claude/enlist-form

Tester feedback on mobile: the link field said optional but was required and only
accepted full https:// URLs; the handle field rejected "@name" or spaces, and every
native validation error jumped back to the top. Link is now optional plain text
(scheme added for you, http upgraded), handle auto-tidies while typing (strip @,
spaces to _, lowercase), server normalises the same way. Module version → 20261106c.

## 2026-11-06 — claude/gate-unstuck

The Napoleon-gate opening could stay on screen forever when the gate.js module
failed to load (e.g. stale cached client.js/copy.js after a deploy). A tiny inline
fallback now closes it on any tap, any key, or after 5 s, independent of modules.
Root cause: /js/* is cached immutable for a year while army modules had no version,
so returning visitors mixed old and new files after each deploy. Army and i18n
scripts now revalidate (max-age=0) and every army module URL carries ?v=20261106b.
## 2026-11-06 — claude/pidgy-recruits

Pidgy trials earn waitlist priority, never approval: 1 trial ≈ tiro, 5 trials from
different emails ≈ miles. Signed webhook POST /api/pidgy-trial (HMAC-SHA256 of the raw
body in x-signature-sha256, secret PIDGY_WEBHOOK_SECRET). Body for Alkmist:
{"event_id","referral_code":"corvus-<handle>","email","started_at"}. Email is hashed
transiently for dedupe/self-referral, never stored raw. Admin list sorts by priority().
Copy keys for door iii, the private code and next rank added; UI wiring is Codex's.
## 2026-11-06 — claude/consul

New lifetime tier consul ($10,000 one-time, max 2 seats) above senator. Detected only
from an explicitly named consul BMC product of at least $10,000; a third buyer stays
unlevelled for manual review. Discord: consul role and private #war-council
(imperator + consul); consul also sees centurio-tent. Excluded from MRR. Copy keys
tierConsul/tierConsulPerk in 7 locales. BMC (37) and Discord tests pass.

## 2026-11-06 — claude/napoleon-copy

Add Napoleon-gate copy (hero, three doors, painting alt) to the seven army
locales. Copy only: paying buys priority, never automatic admission.

## 2026-11-06 — codex/legion checkpoint

Preserve the work in progress for legion accounts, recruitment, dog-tag art,
public profiles/list, BMC webhook, private moderation and mail queues.
Account browser flow and BMC domain checks pass locally; this checkpoint is not
release approval. Discord is not connected. No production deployment included.
## 2026-11-06 — codex/i18n-split

Create the main-based Codex/Claude content boundary: 21 flat feature-locale files,
lazy browser loader, locale validation and a documented ownership contract.
Legacy page locales are preserved; the legion branch wires the new consumers.

## 2026-11-06 — codex/legion account and BMC base

Wire feature-locales, passwordless accounts, public profiles and the cached legion
list. Add signed, idempotent BMC deliveries, private matching, membership expiry,
scoped data deletion and queued mail. Discord code and mocks cover permission
planning, one-use invites/linking, tier sync and daily permission audits; live
activation remains blocked on the bot credentials and installed server.

## 2026-11-06 — codex/discord-legion

Derive the existing Discord server and two owner IDs; configure seven roles, ten
channels and restricted invites. Fix equal-position role hierarchy checks, refresh
the app signing key and enable Members Intent. Signed interactions link approved
accounts; BMC changes sync roles immediately with cron retry and orphan cleanup.
The latest explicit ship instruction authorises a production Vercel deployment;
main is still untouched and all commits integrate through the daily PR.

## 2026-11-06 — Napoleon gate

- Full-bleed public-domain David hero, original crow, responsive AVIF/WebP/JPEG, eager image preload, lantern light and static reduced-motion treatment. Removed the blocking five-second opening.
- Wired Claude PR #21’s seven-language hero/door/painting keys; compact doors keep the existing enlistment, BMC and recruitment flows. Added source credit and 1200×630 social image.
- Playwright desktop/360px mobile: seven languages, dialogs, CTAs, no overflow or page errors, reduced motion. Lighthouse compressed local mobile: 99 performance / 100 accessibility, LCP 1.83 s, CLS 0 at CPU 6× + Slow 4G. Evidence: tests/results/napoleon-gate/.

Cache integration: the Napoleon gate removes the opening altogether, retains PR #24’s versioned army modules/revalidation, and loads the versioned feature-locale module directly so returning browsers cannot reuse old hero JSON. The temporary image publishing workflow is removed after its successful run.

## 2026-11-06 — Pidgy account UI

- Merge Claude #21/#22 first; keep Pidgy webhook and priority rules unchanged. Authenticated self responses alone include the owner's referral code/trial count. Account UI copies the code and shows next-tier BMC benefits; gate door iii includes the Pidgy option.
- Generate PIDGY_WEBHOOK_SECRET outside Git and install as sensitive Production/Preview env. Preview only for this feature; main unchanged.

Validation: all army store/BMC/mail/Discord/Pidgy tests, owner-only response/admin authorization tests, account end-to-end flow, seven-language 360px browser checks, general smoke and locale/link/syntax checks. The superseded investor extension was withdrawn in favour of Claude’s consul tier.

## 2026-11-06 — Consul integration and local-only test evidence

- Merge Claude #23 and preserve #26’s live mobile form fixes. Take api/_army/_discord.js byte-for-byte from Claude’s branch; remove the superseded investor toggle, action and setup helper. Next-tier UI includes consul using Claude’s locale keys.
- Run the standard Discord setup once for consul and the private war council; preserve owner-only invite rules.
- Ignore tests/results and Lighthouse output; remove previously tracked evidence from the index while keeping local files. Napoleon and social hero assets use Sharp WebP quality 78, at most 1200 px wide (under the 1600 px limit).

## 2026-11-06 — feather memory

Caught feathers render a quiet, accessible mark after reload. Existing army identities sync local catches through the existing proof worker and merge server spots on load; anonymous visitors remain local-only. Self responses keep the public numeric feather count and add private `featherSpots` for restoration. Uniform versioned eggs/i18n imports and refreshed entrypoints prevent stale or double collectors. Real local account + challenge tests cover 375px Chromium/WebKit, cleared storage and another signed-in browser context.

## 2026-11-06 — gate link destinations

The hero and first door now lead to the enlist form for new visitors, without opening the keyboard. Once enlisted, both link to the visible ceremony and use `gateAlready` in all seven army locales. Existing iOS keyboard settling remains intact. 375px Chromium/WebKit checks cover submission, reload and each language. Shared cache version: `20261106-knock1`.

## 2026-11-06 — rank versus supporter in every flow

The existing labelled badges now appear in the enlist ceremony, both dialogs, war-room leaderboards and rank-up toast. The ladder names earned ranks; dog tags/posters label rank and show supporter only when present. Senator/consul perks are labelled lifetime. Account/Discord messaging explains role access separately, welcome/claim/daily emails use the same army locale labels, and stats distinguish anonymous notice acknowledgements from accounts/ranks/supporter tiers. Seven-language copy lives in army locales; rank thresholds, points, tiers and role permissions are unchanged. Shared cache version: `20261106-ranks1`. 375px Chromium/WebKit flows and mail/art tests pass.

The production image check also exposed missing system fonts in Vercel's PNG renderer. Bundle the licensed DejaVu Sans Mono font and a server-only Fontconfig file; no browser font request or rank/tier logic changes.
## Hookjack /hack

Add a mobile-first static hackathon launch page with a configurable, click-to-load vertical video, three-step playbook, decorative unhinged dial, editable build timeline, build/community links and original 1200×630 OG artwork. No backend or database changes. Desktop Chromium and 375px Chromium/WebKit checks cover layout, keyboard use, empty video, all four media adapters, and no third-party requests before playback. This branch is based on main and is preview-only until reviewed.

Merged Claude commit `7a1ac15` without losing its live.json, 30-second feed polling, dynamic video/GitHub/X links, slider labels, analytics or privacy integration. Codex keeps the responsive design, playbook, separate four-stop timeline, OG art, safe click-to-load video adapters and LinkedIn/army CTAs. Updates now use hack/live.json on codex/hack-page.

## 2026-11-07 · HackTheFeed launch
Renamed Hookjack; retained design, OG art, video adapters and Claude's live.json polling. Added beta app frame, comments/reactions, private feedback, consent-aware aggregate source/funnel stats. Fork hosting keeps upstream feat/onboarding as an exact mirror and isolated default-branch build guards. Generation fails closed without a key/budget; no production change to corvus.gent.

## 2026-11-07 · hosted HackTheFeed iframe
Use the existing hackthefeed-six.vercel.app app directly, with full-viewport iframe, feedback bar and five-second fallback. Attribute app links and keep navigation click tracking alive. No hosting or clone.

## 2026-11-07 · evidence demo link
The full evidence placeholder, including the arrow, opens the hosted HackTheFeed onboarding in a new tab. Native accessible link, subtle gold hover and 2px arrow movement; reduced-motion respected. If a build film is later configured, its player controls remain usable.

- Compound: three independent cut slots and upload histories, cutlist transition voting, one-tap comparisons, first/last campaign attribution and eleven logged 302 links; manual Revolut plus automatic Stripe hostel totals; full-cut digest and mobile Safari/Chromium regression checks. Daily PR #18 only; no main merge.

## hackathon squads — 2026-11-07
- Add `/hackathons/` (ex-hackathon squads), starting with HackTheFeed at Oriane × Compound, SF, November 2026.
- Link the new page from the realm navigation and Support; keep the build and repository links together in the team card.
- Add `/squads` (307) with bounded campaign/short-slug attribution in existing analytics and stats. No new database or API function.
- Generate future team cards from `hackathons/teams.json` during the existing build, before generating search. Existing easter eggs remain hidden and unchanged.
## post-ready — 2026-11-07
- Replace `/hack` with the SF hackathon hub; preserve HackTheFeed at `/hack/1` and its existing comments/counters/app at `/hack/1/the-feed`.
- Add `/hack/2` with the 7 Nov 21:00 UTC solo-run countdown and an explicit after-start state.
- Retain the completed Compound implementation from this PR's daily-branch base; add all four routes to the bounded analytics payload and retain LinkedIn attribution/hack IDs before URL cleanup.
- Mobile browser QA covers the four pages, metadata/images, the countdown boundary, existing comment counts and both donation destinations. Broader restructuring and stats map work remain separate.

- Squad QA: exact HackTheFeed event/pitch/result, corrected `/hack/1` link, solo #2 card, current nav state and dedicated OG image; real-link clicks and mobile/desktop screenshots. Three team names remain unconfirmed.

## 2026-11-07 — HackTheFeed squad links
- Show exactly Gabe, Siebe Baree and XX on the squads archive, HackTheFeed build page and hub. Generate both Squad sections from one roster.
- Count member-link clicks in aggregate on HackTheFeed stats; preserve GPC/DNT and opt-outs, with allowlisted member IDs and existing abuse limits.

## 2026-11-07 — Compound V1 launch
- Publish the full first cut as a mobile-optimized 7.3 MB V1 with 17 scene-detected transitions and 18 labelled scenes. Preserve the downloaded 1080p original locally.
- Lead with the countdown, muted autoplay, first verdict and category feedback; keep V2/V3 as dropping-soon cards. Add Compound source link and frame-based social preview.
- Admin can rename scene/transition labels without changing IDs, timing or votes. Existing donation and recruitment flows remain available.
- Follow-up verification: keep cut cards visible through their full 1.5-second linger before showing scene cards; mobile flow covers muted autoplay/sound, verdict/category/transition feedback, checkout handoff, army link and LinkedIn attribution.

## 2026-11-07 — Social launch attribution
- Add account-specific Instagram/BJJ bio/story links, LinkedIn post links, DM and X/TikTok bio links; retain query parameters and support content overrides.
- Classify source as explicit UTM, in-app browser hint, referrer or unknown. Only the coarse classification is retained; raw user agents are not stored.

## 2026-11-07 — Homepage live signal
- Show a direct LIVE RN link to /hack on the portal only when Twitch reports online; enable automatic status checking on the three stream pages.
- Keep the homepage player invisible, preserve browser privacy signals/opt-outs, add a per-tab disable control and accurate Twitch cookie disclosures.

## 2026-11-07 — Arcade title vote
- Add shared title voting on /hack, /hack/2 and /hack2 with atomic Redis counts, device/cookie dedupe, daily-hashed IP rate limits and live results.
- Preserve the former hub and solo page at /hackthefeed and /hackthefeed/2. Existing HackTheFeed content and comment data remain intact.

## 2026-11-07 — WHITE BELT playable v1
- Add self-contained canvas octagon arcade game at /hack/play: buffered swipe/keyboard movement, techniques, four enemies, black-belt power, lives, promotions, local best score and sharing.
- Link beta from the title vote and redirect /whitebelt. No external game assets or libraries.

## Arcade P1 — live stats and reveal
- Count idempotent game starts and bounded run scores in Redis. Show live plays/votes/top score and the 23:15 UTC reveal; atomically reject late votes.
- Update the game title from the winner. Show animated beta social proof only from 10 plays.

## Arcade P2 — community leaderboard and story cards
- Add bounded run score submission, public top 10, named callouts and a generated 1080×1920 story card with file sharing/download.
- Add private bug/public idea storage behind the existing API, ready for the feedback controls. Names are optional and explicitly posted publicly.

## Arcade P3 — original fight-night audio and memes
- Add strike finishes, KO/sub counts, narrated callouts with no immediate repetition, synthesized bell/punch/crowd/bonus sounds and a master mute.
- Draw original pixel meme panels, add face-off tape, judges cards, championship labels and performance bonuses. Do-Bronx palette edition uses the same engine.

## Arcade P4 — feedback and bugs
- Add accessible feedback dialogs on the vote and game pages; pause play while writing. Public ideas support one upvote per signed device; bug reports are never included in public results.

## Beta play counter visibility
- Always show the live play-start total alongside the beta link, including fewer than ten plays. Keep it below the link on mobile and refresh every five seconds.

## OSSMAN Plethora submission
- Converted the offline game to a fullscreen Plethora Bit with SDK surfaces/input/loop, score records, sharing, safe-area layout and cleanup.
- Saved draft 85764f7c-5061-431d-a35b-7a0dfbd29bf9; receipt and package in submission/plethora. Mobile Chromium/WebKit adapter tests pass; native host playback and publication remain separate/unverified.
- Live site and original offline bundle unchanged.

## 2026-11-08 — codex/battle
- Add Codex vs Compound blind A/B battle, reveal, live scorecard, private admin and 12 deduplicated campaign redirects.
- Add four compressed self-hosted videos, posters, original social art and two live $3 support links; preserve exact donation disclaimer.
- Reuse the stats API and Redis; isolate preview data, enforce atomic vote/close checks, and leave `/hack` voting and game behavior unchanged.

## 2026-11-08 — battle backing copy
- Update the battle disclaimer and existing Stripe product descriptions verbatim; keep payment links, $3 prices, videos and votes unchanged.
- The next supplied Compound video will replace the current cut with the old file preserved as compound-v1.mp4; no replacement file supplied yet.
- Export a 20-second 1080×1080 LinkedIn face-off with neutral contender labels, contender 2 audio, a two-second frozen voting CTA and first-frame cover. Uses the current Compound cut pending a new supplied file.

## 2026-11-08 — new Compound cut
- Replace the main Compound contender with ufc-03-dagestan-dc, encoded H.264/AAC at 720×1280, CRF 28, veryfast; generate a new poster.
- Preserve the previous video and poster as compound-v1.mp4 / compound-v1.jpg. No voting code, keys, counts or existing bonus clips changed.
- Re-export the square neutral-label LinkedIn face-off and first-frame cover using the new main video. The supplied 60-40-A-dagestan cut remains an alternate source, not an extra voting contender.

## 2026-11-08 — hackathon roster privacy
- Replace the private teammate with XX, remove the profile link and identifying initial, regenerate team pages/search, and anonymize historical team-click identifiers in public stats.

- Add the requested lime PLAY OSSMAN button above the battle hero, with tracked destination and original pixel lettering; normal document flow prevents covering videos or votes.

## 2026-11-08 — battle verdict sharing
- Replace the single native share button with Post on X, WhatsApp and Copy. All use one shared sentence ending in exactly one full tracked URL; copy shows “Copied ✅” and supports browsers without clipboard access.

## 2026-11-08 · Plethora everywhere
- Added a dedicated iPhone/QR landing page, games catalog, 27 tracked placement IDs, private placement leaderboard, and a rolling 24h column. Tracking uses the existing Redis/API function with 30-minute network deduplication; no new external SDK.
- Added in-flow promotions across daily puzzles, OSSMAN menus, battle, legion, home, 404 and site footers. Every third catalog tile is Plethora. All eight puzzle result cards and game share flows carry their placement link. Home dismissal is remembered; no promotion covers active gameplay.

## Plethora official links · 2026-11-08
- Device-independent official download/OSSMAN redirects, fixed GABE attribution, raw + deduped counts, country/device/destination aggregates.
- Midnight-Pacific permanent snapshots, legacy preservation and public CSV; landing CTAs/QR and public stats updated.
- 108-route build guard plus Redis retention/dedupe/history tests and mobile/desktop preview QA.

## codex/support — 2026-11-08
- Replace call pricing with 5 min free / 15 min coffee / SF coffee, PARACETAMAIL and a native booking form. Redis retention, email notification and private status management.
- Add dinner, support invitation on Gabinho Rolls, eight tracked Diogenes short links and overview statistics. Existing BMC URL preserved. Retire only the newly created Stripe call links.
