# Corvus: five doors, one Legion

## Release

Started 9 November 2026 at 13:41 UTC. Phase 1 deployed to production at about 14:50 UTC, after all 12 protected-contest smoke checks passed. Feature branch: `codex/site-legion-refresh`; integrated into `daily/2026-11-06-redis-restore`, daily PR #18. Main was not pushed or merged.

Phase 2 adds the fixes found during the route/flow audit. Its final deployment and post-deploy checks are recorded below once complete.

## What changed

- One persistent five-section navigation: Quests, Daily, Legion, Live, Gabe. Desktop top bar; mobile bottom bar. Existing stream and game controls retain their own space.
- Five hubs, contextual section labels, a clear next action and direct call access. The public map and command palette use `js/site/routes.js`, with 67 directory entries. The existing text search also indexes the new public pages, excluding admin and invitation screens.
- Homepage explains Corvus, gives five doors, keeps the crow/portal character and adds optional double-opt-in email capture.
- One Legion entrance: $1 once via Stripe makes a Tiro. Application, a decoding challenge, a call or an owner invitation grant higher ranks. Existing supporter perks and existing members are retained; no higher rank is sold.
- Seven invitation ranks, owner dashboard, searchable/sortable members, rank changes and CSV, invitation create/copy/DM/revoke, application/claim review, and partner click reporting.
- Cardneto page, three tracked outbound actions, a hidden NFC card on home and Daily, a real aggregate counter and footer placement. Public claims are attributed to Dorian; no invented click count.
- Home, Daily and Legion share the same opt-in form. Five draft transmissions are in `docs/transmissions.md`. No marketing send or re-engagement cron is enabled.

## Homepage decision

Kept the portal with the five cards. Compared it with a flat variant that removes the crow artwork and uses a single-line title. On both 390×844 and 1440×900, both layouts reached every section in **one action** and Hack #3 in **two**. The portal therefore keeps the established identity without an extra entrance click. The old realm is optional, not a compulsory gate.

This is an automated navigation/action-count comparison, not a human A/B study or a claim of measured conversion improvement. Screenshots: `test-results/site-homepage/{portal,flat}-{390,1440}.png`; full results: `comparison.json` in that folder.

## User flows

Action counts exclude typing, scrolling, field focus and operating-system/payment authentication. Screenshots are local, ignored by git and never published with personal/admin data.

| Flow | 390×844 | 1440×900 | Actions | Evidence |
| --- | --- | --- | --- | --- |
| Home → Quests → Hack #3 → back | pass | pass | 2 to project; 3 including return | `site-flows/*home.png`, `*quests.png`, `*hack3.png`, `*back-to-quests.png` |
| TikTok short link → vote → Legion | pass | pass | 2 | `site-flows/{390,1440}-tiktok-{arrival,vote}.png`, `*-vote-to-legion.png` |
| Legion → Tiro checkout → paid | real Stripe test-card pass | same responsive form checked | 3 buttons from Legion, including Stripe Pay | `site-flows/stripe-test-{checkout,filled,admitted}.png` |
| Invitation → claim → visible in admin | pass | pass | 1 submit after email | `site-flows/*invite-open.png`, `*invite-claimed.png`, `*admin-member.png`; protected-preview owner verification |
| Any ordinary page → Gabe → call form | pass | pass | 2; footer shortcut 1 | `site-flows/universal-call-{390,1440}.png`; checked from home, Legion, game and Live |
| Hidden NFC card → digital card → admin click count | pass | pass | 1 to reveal; 2 to an outbound CTA | `site-flows/*card-secret.png`; protected-preview dedupe/count check |
| Find Battle via / | pass | pass | 1 result selection | `site-flows/*battle-search.png`, `*battle.png` |

The real Stripe checkout used a **test-mode** $1 price and test card, then the real signed webhook on a Vercel preview. No real card was charged. Production uses the separately verified live payment link and live webhook. The public wall refreshes without CDN delay immediately after payment.

## Route and layout audit

The before/after route inventory is in `docs/site-map.md`; its immutable baseline is `docs/site-map-before.json`. Opened all 67 listed destinations plus home at both viewport sizes (136 checks), including the separate stats host. The audit found a dead trailing-slash CV URL and fixed it. No broken image elements, application-script exceptions or horizontal document overflow were found in the remaining public pages.

Additional authenticated/fullscreen fixes:

- Admin tables scroll within their own container; they no longer push the phone page to 700px. Existing legacy rank labels remain visible until Gabe explicitly changes them.
- OSSMAN keeps its movement/pause controls inside the viewport. The shared nav never covers the controls.
- HackTheFeed iframe and feedback bar reserve separate space above the mobile nav. Its old demo door now returns to the actual HackTheFeed page.
- Footer actions on Live, the call page and the daily game target the relevant section instead of reloading the same page; Hack #3 leads to Live.
- Stats-host search/navigation goes to the correct main-site host. The visitor map remains untouched.
- Partner dates are labelled honestly: Pacific by default, Brussels for the existing support tracker, UTC for battle/live. Unrecorded history is shown as —, not invented zeroes. Generic short-link history begins on this release.

Standalone exceptions: PDFs, client previews, offline game submission and transparent stream overlay keep their existing format. The playable game and embedded app use their native bottom actions rather than an extra scrolling page footer.

## Redirects

| Old URL | Result |
| --- | --- |
| /enlist and nested/trailing forms | 301 → /legion/, query preserved |
| /join-the-army-now and nested/trailing forms | 301 → /legion/, query preserved |
| Same old gates on stats host | 301 → canonical corvus.gent/legion/, query preserved |
| /gabe | New Gabe hub; former profile remains /people/?id=gabe |
| /cv/ | Existing PDF handler, matching /cv |

The contest routes, /v and /c redirects, video registry, votes and campaign data are retained.

## Security, privacy and operational checks

- 32 random bytes per invitation, base64url; only SHA-256 stored. Expiry, revocation and maximum-use claim are enforced atomically. Repeated concurrent claims cannot reuse a one-use invite.
- An invite cannot take over an existing email account: the existing signed army session is required. A payment credits an existing member without issuing their login session.
- Admin session is opaque, hashed in Redis, HttpOnly/Secure/SameSite=Strict, eight-hour lifetime; password rotation invalidates it. Same-origin writes, login and request rate limits, honeypots, bounded input and text-only rendering. CSV guards against spreadsheet formulas.
- Stripe signature/body-size, test/live mode, expected payment link, exact currency/amount, paid state and payment-intent replay tests passed. Replayed payment creates one member.
- Double opt-in and unsubscribe lifecycle passed against disposable local Redis. A production confirmation request to Gabe was accepted; inbox delivery was not independently inspected because the exported mail credential is protected. Marketing remains off.
- Public membership output has no email or private application fields. Partner tracking stores aggregate counts and short-lived salted dedupe hashes, never raw IPs. Privacy page and `PRIVACY_AUDIT.md` updated.
- Existing army rank/tier and earned-rank regression suites passed. Full repository build and new-module syntax checks passed. No new dependency or top-level Vercel function was added.

## Owner access and handoff

- Admin: corvus.gent/admin/. Password env: `ADMIN_PASSWORD`; stored privately in `~/.secrets/corvus-site-admin.env`. It is never in the browser bundle or repository.
- Seven unused production test invites, one per rank: `~/.secrets/corvus-legion-test-invites.md`. One use each, 30-day expiry. These are bearer invitations: share only with the intended claimant.
- Daily PR: #18. Review branch: `codex/site-legion-refresh`.
- Screenshots and reports: `test-results/site-flows/`, `test-results/site-homepage/`, `test-results/site-routes/`, `test-results/site-contest/`.

## Deliberately not activated

The optional 3/7/14-day marketing cron is not enabled. Gabe must approve the five drafts first. Historic per-day click counts absent from older trackers cannot be reconstructed. No unrelated video rendering, social publishing, main-branch merge or brand/support artwork changes were performed.
