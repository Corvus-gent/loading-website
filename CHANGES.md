# Changes

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

Cache integration: the Napoleon gate removes the opening altogether, retains PR #24’s versioned army modules/revalidation, and loads the versioned feature-locale module directly so returning browsers cannot reuse old hero JSON. The temporary image publishing workflow is removed after its successful run.
