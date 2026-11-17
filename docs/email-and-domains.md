# Corvus email and domains

## TL;DR

- Zoho hosts people: five seats maximum on the chosen free plan; **verify in Zoho admin**.
- Role aliases share the two active inboxes; catch-all is off.
- App mail uses Resend on `mail.corvus.gent` and `news.corvus.gent`; receipts use Stripe.
- `corvus.gent` is the primary website and mail domain; extra domains redirect.
- Public contacts use role addresses only. The agreed Gabe marketing identity/reply-to is the explicit exception.

## People and aliases

Zoho free: one domain, up to five users, web/mobile access, no IMAP/desktop client or app SMTP in this plan: **verify all limits and regional availability in Zoho admin**. The app never sends through Zoho.

| Seat | Mailbox | Aliases on it |
| --- | --- | --- |
| 1 | `gabriel@corvus.gent` (Gabe, CEO) | `gabe@`, `founder@`, `security@`, `abuse@`, `postmaster@`, `dmarc@` |
| 2 | `hello@corvus.gent` (shared inbox) | `pay@`, `payments@`, `billing@`, `invoices@`, `info@`, `contact@`, `team@`, `legion@`, `join@`, `hack@`, `events@`, `sponsors@`, `press@`, `partners@`, `ai@` |
| 3–4 | reserved for first teammates (`firstname@`) | — |
| 5 | reserved: billing inbox when payment mail overwhelms hello | move billing aliases here then |

All abbreviated aliases are on `corvus.gent`. Catch-all **off**. Configure shared access without sharing Gabe's owner credentials; verify free-plan delegation options in Zoho admin.

| Public role | Use |
| --- | --- |
| `hello@corvus.gent` | General contact and transactional replies |
| `billing@corvus.gent` | Stripe receipts and payment questions |
| `legion@corvus.gent` | Legion |
| `hack@corvus.gent` | Hackathons |
| `press@corvus.gent` | Press |
| `security@corvus.gent` | Security reports |

## Sending streams

| Stream | From | Reply-to | Via |
| --- | --- | --- | --- |
| Transactional: login, Legion invites, tier upgrades | `Corvus <hello@mail.corvus.gent>` | `hello@corvus.gent` | Resend |
| Marketing: reminders, weekly/re-engagement mail | `Gabe <gabe@news.corvus.gent>` | `gabriel@corvus.gent` | Resend, separate verified sending domain |
| Payment receipts | Stripe, branded `billing@corvus.gent` | `billing@corvus.gent` | Stripe |

No `noreply@`. Replies are engagement. Do not send marketing through the transactional wrapper to bypass consent or suppression.

## DNS checklist

Copy records from the correct account dashboards. Values below deliberately contain no real DNS keys. Do not replace an existing working MX setup until mailboxes exist and inbound delivery is tested.

| Host / dashboard host | Type | Value / action |
| --- | --- | --- |
| `corvus.gent` | MX | `<from dashboard>` Zoho priorities and servers; check EU versus US datacenter |
| `corvus.gent` | TXT (SPF) | `<from dashboard>` Zoho SPF include for the actual datacenter |
| `<from dashboard>._domainkey.corvus.gent` | TXT (DKIM) | `<from dashboard>` Zoho selector and public record |
| `mail.corvus.gent` / return-path host beneath it | MX | `<from dashboard>` Resend host, priority and target |
| `mail.corvus.gent` / return-path host beneath it | TXT (SPF) | `<from dashboard>` Resend SPF, at its exact dashboard host |
| `<from dashboard>._domainkey.mail.corvus.gent` | TXT (DKIM) | `<from dashboard>` Resend selector/public record |
| `news.corvus.gent` / return-path host beneath it | MX | `<from dashboard>` Resend host, priority and target |
| `news.corvus.gent` / return-path host beneath it | TXT (SPF) | `<from dashboard>` Resend SPF, at its exact dashboard host |
| `<from dashboard>._domainkey.news.corvus.gent` | TXT (DKIM) | `<from dashboard>` Resend selector/public record |
| Stripe custom email domain: each host shown | CNAME | `<from dashboard>` all Stripe authentication/return-path records |
| `_dmarc.corvus.gent` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@corvus.gent` |

**One SPF record per host.** Merge authorized mechanisms if a host already has SPF; never add a second SPF TXT record. Resend's dashboard may put MX/SPF on `send.mail` / `send.news`, rather than the visible From host. Do not copy those records to the Zoho apex. Stripe CNAME hosts must not collide with existing TXT/MX records. Never commit API keys, DKIM keys/values or inbox contents, even though DNS public keys are visible in DNS.

DMARC at the apex applies to subdomains unless overridden. Check SPF/DKIM alignment for Zoho, both Resend streams and Stripe. After **2–4 clean weeks** of aggregate reports, move to `p=quarantine`, monitor, and only tighten further after reviewing all senders. Ensure the `dmarc@` alias works before enabling reports.

## Future domains

These are priorities, not availability or price guarantees. Check current registration and renewal prices before buying; no purchases are part of this PR.

| Domain | Purpose | Web behaviour | Mail | Priority |
| --- | --- | --- | --- | --- |
| `corvus.gg` | Community/gaming vibe; first acquisition if inexpensive | 301 to `https://corvus.gent`, preserving path/query; includes www | none until Zoho paid → domain alias | 1 |
| `corvus.com` | Familiar brand protection, only if affordable | same 301, includes www | none until Zoho paid → domain alias | 2, conditional |
| `corvus.ai` | Optional AI positioning | same 301, includes www | none until Zoho paid → domain alias | 3 |
| SF option (choose an available SF-flavoured name, e.g. under `.com`) | Local identity | same 301 once selected and added to the array | none until Zoho paid → domain alias | Later |

There is no `.sf` TLD. Add the selected SF domain to `config/redirect-domains.js`. The array generates apex/www Vercel rules via `npm run build`; attach purchased domains to the same Vercel project and enable TLS. Unattached domains do nothing. The host-only redirect leaves existing query parameters intact. Canonical and OG URLs use `https://corvus.gent`, including on previews.

## Upgrade path

Leave Zoho free when any of these occurs: IMAP/desktop access is needed; a second mail domain is needed; more than five people need seats; or a tool needs SMTP. Upgrade to Zoho Mail Lite; keep app mail on Resend regardless.

Zoho's official comparison lists entry paid pricing at approximately **US$1/user/month billed annually**, checked 2026-11-16. Currency, taxes, storage, renewal and regional availability vary: **verify current pricing and all limits in Zoho admin** before upgrading. [Official plan comparison](https://www.zoho.com/mail/compare/overview.html), [pricing](https://www.zoho.com/mail/zohomail-pricing.html), [subscription limits](https://www.zoho.com/mail/help/adminconsole/subscription.html).

## Implementation and operation

This repo is static HTML with Vercel JavaScript functions, not Next.js. `lib/email/addresses.js` is the one runtime source of identities, with a typed `addresses.ts` entry point; `send.ts` exposes typed wrappers for future TS consumers. Browser modules import role constants. Static HTML/JSON contacts are normalized from these constants by `tools/email-contacts.mjs` after the normal site build. Run the build when changing addresses; commit regenerated HTML along with constants.

`sendTransactional()` / `sendMarketing()` use the Resend HTTP API without another SDK. They enforce From, Reply-to and stream tags, timeouts, and provider errors. Both sending subdomains are independently verified in Resend; the stream tag helps reporting, it is not a separate Resend account. Marketing requires an absolute `https://corvus.gent/api/army?unsubscribe=<token>` URL backed by the existing Army unsubscribe handler, adds a visible footer and RFC 8058 headers, and supports GET/one-click POST. Callers must obtain a real token from `armyAuth().unsubscribeToken()` for the recipient and confirmed subscription; a syntactically valid fabricated token cannot provide suppression. Existing Army consent checks, quotas, encrypted queue, batch idempotency and independent daily/weekly subscriptions remain in place. An uncertain legacy batch whose cached payload would change is held in `review` for the operator; do not clear its state and resend blindly. Newsletter confirmation/restore messages are transactional, not campaigns; no new campaign scheduler is introduced.

Existing OTP login stays OTP. A magic-link template is available for the existing Army link flow. Minimal dark/monospace templates cover invite, tier upgrade and magic link; existing localized Army copy remains. Stripe handles receipts separately.

Set the three `.env.example` variables in Vercel, independently per environment. Missing API keys throw in local development/production. Preview warns and skips sending; skipped queued work is not acknowledged as delivered. Do not put real secrets in `.env.example` or commit `.env.local`. Owner authorization still uses the separate `OWNER_EMAIL` constant; public contacts and notification recipients use roles. Pidgy/Alkmist are not used for mail transport or identities; unrelated site features/biographical content are outside this mail migration.

Maintain `public/.well-known/security.txt` before its expiry; the Vercel rewrite exposes it at `/.well-known/security.txt`.

## Manual steps for Gabe

- [ ] Zoho: verify datacenter/free-plan limits; create the two mailboxes and all aliases above; reserve seats; disable catch-all; test inbound and replies.
- [ ] DNS: publish dashboard MX/SPF/DKIM and initial DMARC; verify all streams; review reports for 2–4 weeks before quarantine.
- [ ] Resend: verify both subdomains, configure Vercel environment variables, send a test per stream, and test daily/weekly unsubscribe and suppression end to end.
- [ ] Stripe: set billing sender/reply-to branding, publish all custom-domain CNAMEs, verify and send a test receipt.
- [ ] Vercel/registrar: acquire selected domains only after checking prices, attach apex/www, then verify 301 path/query preservation and primary canonicals.

Provider references: [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [Resend custom headers](https://resend.com/changelog/custom-email-headers), [Vercel static configuration](https://vercel.com/docs/project-configuration/vercel-json).
