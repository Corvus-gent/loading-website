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
