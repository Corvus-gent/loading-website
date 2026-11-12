# Army build — working plan, 6 November 2026

Requested: one daily-branch PR, reviewed/merged by Gabriel. No production deploy for this expansion. Existing PR #18 and daily branch are reused so work stays in one PR. Earlier emergency fixes are already live and preserved.

## Delivery order

- [ ] Storage/security: anonymous signed identity, verified email magic links, applications, deletion/export, referrals with proof-of-work + completion, ranks/missions.
- [ ] Recruitment gate: five-second skippable opening, original SVG lantern/crow/doors, live real counters, ceremony, shareable PNG dog tag, lightweight seven-language UI.
- [ ] Profiles and war room: server OG/PNG, recruit kit QR/poster, rank insignia/celebration, accessible tree/leaderboards/country map, stats integration.
- [ ] Mail/payment/admin: independent double opt-ins, one-click unsubscribe, quota-aware batch outbox, Brussels-time daily/weekly cron, BMC matching, owner-only moderation, queued Discord invitations.
- [ ] General rebrand, public links, privacy/data inventory, search rebuild; preserve Pidgy persona and hidden eggs.
- [ ] Local integration/Playwright (five personas × three devices), screenshots, deletion and abuse tests, Lighthouse, preview, PR evidence.

## Decisions

- Real totals only; no seed/fake soldiers. Legacy `notice_ok` acknowledgements stay separate from army membership.
- A dog tag can be issued at enlistment; public profile and public handle require email verification. Admission is always Gabriel's decision. Payment/recruits only affect priority/toll waiver.
- Anonymous progress stays usable without an account. Existing game/vote cookies and game counters are preserved.
- Browser/cookie + daily IP-hash deduplication is best effort, not proof of a unique human. No cross-day IP fingerprint. Referral credit requires server-confirmed completion/enlistment and anti-abuse checks, never a pageview.
- Personal records, indexes, queues, sessions and tokens have defined retention/deletion paths; per-person Redis key registry enables exhaustive immediate erasure. Public caches never retain deleted usernames; profile/OG responses are no-store. Other platforms can retain images already shared there.
- Auth links use single-use high-entropy tokens, hashed at rest, in URL fragments consumed by POST. A GET/email scanner cannot silently authenticate or delete an account. Explicit delete confirmation after the magic-link session.
- Daily and weekly subscription consent are independent. One-click unsubscribe deletes that subscription immediately. No tracking pixels. Pending confirmations expire.
- BMC is an external checkout with its actual currency/minimum shown; do not pretend every local currency supports a one-unit card payment. Never retain payer identities/messages/card data. Unmatched payment summaries are private and short-lived.
- Stripe/Discord membership automation/hackathons are outside this brief; missions provide a tested extension point only.
- No production writes or real customer emails during tests. Redis and Resend/BMC fixtures isolated locally. Preview must use its own army namespace (never mutate current production data).

## Progress updates

First estimate: 4–6 hours at 15:47 Brussels. Short ETA updates every five minutes, with meaningful implementation updates between phases. Notify Gabriel's laptop when the reviewable PR is complete.
