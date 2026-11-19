# Feedback forms

This repository serves static HTML and Vercel Node functions. `/forms/:slug` uses
one shared Sonar page; it does not migrate the rest of Corvus to Next.js.

## Add a form

1. Copy `hackers-bay.ts`, with a unique `slug` and stable question IDs.
2. Keep the default export as a JSON object `satisfies FeedbackForm`.
3. Run `node tools/forms/build.mjs`. This validates configs and generates
   `generated.js`; every form uses the same view and API.

The form builder runs last in the production build so the site-wide navigation
cannot change the reference design. `tools/forms/page.html` is the shell source.

## Environment

- `SMTP_USER`: Zoho mailbox username and sender address.
- `SMTP_PASS`: Zoho app password, stored only in private env storage.
- `SMTP_HOST`: optional; defaults to `smtp.zoho.eu`. TLS port 465 is fixed.
- `ADMIN_TOKEN`: independent random secret for the CSV export.
- `CRON_SECRET`: existing Vercel cron authentication secret.
- Existing Redis configuration; no new `DATABASE_URL` is needed.

Do not put SMTP credentials or export tokens into the form config, public JS,
Git, screenshots or public URLs. The authenticated export URL is
`/api/forms/export?slug=hackers-bay&token=YOUR_ADMIN_TOKEN`.

## Local verification

- `node tests/forms-service.mjs`
- `node tests/forms-api.mjs`
- `FORMS_TEST_MODE=1 node tools/forms/dev.mjs` (isolated memory store + mail adapter)
- For real SMTP/storage, load the private environment before importing the dev
  server. Bind localhost:3000 only.

Each session has one Redis row, indexed by server receipt time. Client update
versions prevent older autosaves overwriting a final beacon. Email hashes and
per-session leases deduplicate repeat flushes. An SMTP failure leaves the hash
unchanged for retry. The client saves immediately to localStorage, waits 800ms
before POST, retries failures and resubmits restored drafts.

The safety-net cron runs at 18:00 and 19:00 UTC; the handler only sends at
20:00 Europe/Brussels and guards the Brussels date, covering summer/winter time.
The digest includes sessions changed in the last 24h whose current answers
have not been emailed (including new changes to a previously emailed session).
Completely empty sessions never send mail.

SMTP acceptance is not proof of inbox arrival. Verify the received test message
in the mailbox before declaring email delivery complete. As with SMTP generally,
a process crash after acceptance but before recording the email hash can cause
one duplicate on retry; leases prevent normal concurrent duplicate sends.
