# Earned ranks / Claude copy handoff

## Contract

- Buy Me a Coffee tiers grant perks only. Payment, supporter tier and Pidgy activity never move an application up the waiting list or approve it. Default review order is application timestamp, oldest first.
- Earned points: **25** for a help/intro report confirmed by Gabe, **10** for a completed daily game mission (one credit per Brussels day), **100** per qualified Corvus recruit, **100** per unique signed Pidgy trial referral. Pidgy referrals are recruiting work, not paid support. Existing thresholds stay unchanged.
- Help signal now: the owner-only private dashboard records the contributor's username, help/intro kind and a concrete report reference. Reusing the same reference for that person cannot add points, even with a different kind. The reference is private for up to 90 days; its dedupe receipt follows account expiry. Export and deletion include both. No Discord kudos handler is being claimed or added.
- Corvus recruitment still requires a server-confirmed game completion or confirmed application, with its existing self-referral, duplicate and daily limits. Pidgy only accepts the provider-signed callback and distinct normalized trial emails; no credit for self-referrals or retries.
- Existing data stays intact. Points/ranks recompute on read; payment, feathers, streak/best and historical weekly-bonus fields no longer contribute. Feather collection/easter eggs and visible streaks keep working. An old rank may decrease when those old bonuses are removed.
- Admission remains Gabe's explicit decision. Supporter tiers and earned ranks remain separate even when their Roman names overlap. BMC/Discord perks still work for approved linked accounts.

## Stable army locale keys (all seven languages)

New: `rankHelp`, `rankMission`, `rankRecruit`, `rankPidgyRecruit` (the four rank-table row labels).

Updated to match the code: `pidgyDoor`, `tollDoor`, `stripesDoor`, `bringThreeTitle`, `currencyHonesty`, `toll`, `tier`, `nextRank`, `gateDoorStripes`.

`nextRank` retains its key for compatibility, but its visible text explicitly says **next supporter tier**, with the existing `{tier}` and `{perk}` placeholders. `pidgyDoor` describes recruiting points, never tiro/miles priority. No three-recruit payment waiver or guaranteed admission is implied.

Claude can refine these values in `js/i18n/army.<lang>.json`, preserving the keys, placeholders and the behavioral claims above. Every locale edit must ship with a shared version bump across all army imports, HTML entry scripts and feature loader/JSON URLs. Current release: `20261106-earned1`.

## Phone UX

Link hubs retain one social set: Gabe's text row, Corvus/Pidgy's icon row. All hubs have static ⌂ home and gold ⚑ navigation. Privacy has the corner home plus one realm wordmark. People profiles retain in-prose links and suppress duplicate list destinations, including grouped social links.
