# SF soft launch · 6–15 November 2026

The SF feature stays on `daily/2026-11-04` / PR #11. Nothing here deploys to main.

- `/sf/` is the outreach page, in the seven existing languages. Use
  `https://corvus.gent/sf/?utm_source=x&utm_campaign=gabe-sf-trip` or change the
  source to `linkedin`. Existing consent and clean-address-bar behavior apply.
- The homepage crow appears once per tab session, about 3 seconds after load,
  flies for 4 seconds using transforms, and opens a keyboard-accessible note.
  Reduced motion gets a stationary note. Neither note nor realm object survives
  `2026-11-16T08:00:00Z` (midnight Pacific after Sunday 15 November).
- The realm object is active from `2026-11-06T08:00:00Z` to that cutoff. The
  hidden Diogenes line instead follows **Europe/Brussels** calendar dates.
- Edit `sf.json` to add real events: `{"events":[{"date":"2026-11-07",
  "name":"event name","url":"https://example.com/event"}]}`. Empty hides it;
  invalid/out-of-trip URLs/dates are ignored. No external calendar calls.

## Before merging

1. Keep the existing `REDIS_URL`, stable voter/session secrets and
   `RESEND_API_KEY`. The verified `login@corvus.gent` sender must be allowed by
   that key. No new vendor or new Vercel function is needed: `/api/sf` is routed
   through the existing Frankfurt stats function.
2. Set/retain `CRON_SECRET`. The existing daily backup `/api/x-stats?cron=1`
   now also retries up to five queued SF notifications, even without a configured
   Notion integration. No second cron is added. Immediate sending is attempted
   on every saved lead; failed notifications stay visibly pending in the private
   table and have a retry button. Check pending notifications after an outage.
3. **Mailbox retention:** configure Gabriel's receiving mailbox to delete these
   notifications within 60 days (including trash/backups as supported). Redis
   deletion is automatic; this repository cannot enforce recipient-mailbox
   retention. Resend remains the previously accepted US-storage exception, with
   its own shorter delivery-log retention. Do not claim mailbox deletion was
   verified by the browser tests.
4. Sign in as **gabriel@corvus.gent** at `stats.corvus.gent/private` to see
   **sf trip**. Other Corvus sessions cannot read/toggle these leads. The funnel
   counts consented actions, not unique people or a joined user journey.
5. Confirm a production delivery after deploy using a clearly labeled test lead,
   then remove that test through the deletion script and from the mailbox. All
   automated tests use a mocked Resend transport and send no real notifications.

## Storage and failure behavior

`sf:leads` is a sorted index of random IDs, with 60-day TTL. Each `sf:lead:<id>`
is a separate record with **60 days from creation**, so a later lead never extends
an older record's retention. Only supplied fields, created date and the done flag
are stored in it. Marking done preserves the original TTL. Expired index entries
are pruned on reads/writes. No raw IP is persisted.

Abuse checks use the existing signed `vid` format, same-origin checks, a honeypot,
server-issued single-use challenge (5-minute TTL), 16-bit SHA-256 proof-of-work in
the existing Web Worker and a server-enforced 3-second minimum after challenge
issue. Focus starts the challenge; submission works without analytics consent.
Limits/storage are one Redis transaction: one accepted request per minute per
voter and per daily IP hash, and three per UTC calendar day per IP. A new random
request ID makes retries idempotent for 24 hours. Daily IP hashes are scoped to
SF and rotate without saving the raw address. Challenge generation is bounded.

Notification status and the ID-only retry queue expire with the lead. Resend
uses an idempotency key for duplicate delivery attempts within its 24-hour window;
no headers/content are logged. A saved lead is acknowledged even if email is
queued, so a mail outage does not discard the message. Mail retry is available
privately and via the existing protected daily cron. The receiving address/from
address are fixed; the visitor's address is used only as reply-to when valid.
Reference: [Resend send-email](https://resend.com/docs/api-reference/emails/send-email),
[idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys).

For deletion: `node tools/delete-user-data.mjs --email ...` also removes matching
SF lead records. For X handles/LinkedIn contacts, take the lead ID from the private
response and run `node tools/delete-sf-lead.mjs --id ...`. Neither script prints
personal fields. Delete the corresponding email copy separately.
