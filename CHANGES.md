# Changes

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
## 2026-11-06 — claude/gate-unstuck

The Napoleon-gate opening could stay on screen forever when the gate.js module
failed to load (e.g. stale cached client.js/copy.js after a deploy). A tiny inline
fallback now closes it on any tap, any key, or after 5 s, independent of modules.
Root cause: /js/* is cached immutable for a year while army modules had no version,
so returning visitors mixed old and new files after each deploy. Army and i18n
scripts now revalidate (max-age=0) and every army module URL carries ?v=20261106b.

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
