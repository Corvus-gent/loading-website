# The crow's quiet return

Default: `RE_ENGAGE_ENABLED=false`. Missing, malformed or non-production flags
also disable sending and visit writes. No environment variables are changed by this patch.
The authenticated cron still runs a read-only dry-run. No mail, unsubscribe tokens,
reservations or cursor writes happen in dry-run mode.

## Configuration

```dotenv
RE_ENGAGE_ENABLED=false
LEGION_MAIL_FROM=Corvus <crow@corvus.gent>
LEGION_MAIL_REPLY_TO=gabriel@corvus.gent
```

The existing `CRON_SECRET`, `SESSION_SECRET`, Redis and `RESEND_API_KEY` settings
are reused. From/reply-to settings apply to all Legion mail. The sender must be
verified with Resend. A future reply-to can be `gabe@corvus.army` without changing
code; these defaults do not provision or verify a domain.

## Observation and privacy

The client uses the existing HTTP-only, signed `corvus_layer` subscriber session.
It issues no identifier and sends no query string, referrer, fingerprint or IP.
Anonymous, expired, forged, pending and unsubscribed sessions create no records.
While disabled, even authenticated visit requests return without touching Redis.

While enabled, confirmed subscribers get one `lastSeen` timestamp and up to the
three curated destination IDs inside their existing subscriber record. No full
browsing history or analytics/email join is created. Record expiry is preserved.
Unsubscribe removes that record, including its activity. A separate pseudonymous
14-day delivery cooldown survives unsubscribe/re-subscribe solely to prevent
another mail within that interval; it contains only the last-attempt timestamp.

DNT, GPC and the site's analytics refusal suppress re-engagement, without updating
visit history. A later permitted visit resumes observation. Identification works
only in a browser with the existing confirmed session; returns in another browser
cannot be inferred. “Unseen” means absent from this recorded history, not from
untracked visits before launch. No email-open pixels or tracked click redirects.

Activation starts a fresh seven-day minimum observation window. A cron gap over
two days restarts it, so pausing and resuming cannot backfill an old list. Newer
confirmation/return times take precedence. Dry-run reports `observing:false`
before an observation window exists; it deliberately does not invent inactivity.

## Letters and delivery

Three templates correspond to inactivity thresholds of 7, 14 and 30 days. The
highest eligible unsent stage is chosen. With daily runs and no return, the usual
sequence is day **7, 21, 35**, respecting the stronger 14-day delivery cap. A return
resets the stages but never the cooldown. All previously seen or offered curated
pages are excluded; if none remain, send nothing. Add genuine public destinations
in `api/_legion/re-engage-config.js` as the site grows.

Every plain-text letter has exactly one content link and a separate unsubscribe
link using the existing unsubscribe flow. A fresh, expiring unsubscribe token is
minted only after an atomic send reservation. `List-Unsubscribe` is also supplied;
one-click POST support is not advertised for the existing confirmation page.

Reservations atomically check confirmation, suppression, last-seen generation,
stage, page and the cooldown. Concurrent runs are locked. A subscriber who returns
or unsubscribes before the final check is skipped. Already in-flight delivery may
finish. Failed or ambiguous provider requests keep their reservation: this can
skip a letter, but prevents duplicate attempts within 14 days.

## Cron and review

Vercel calls `GET /api/re-engage` daily at **16:23 UTC**, with
`Authorization: Bearer $CRON_SECRET`. Unauthenticated calls fail closed.
Each run reads at most 100 subscriber-index entries and attempts at most 20
letters, using four workers and the existing 80-mail daily Legion limit. Enabled
runs rotate the cursor. Large lists can take multiple daily passes. For read-only
review, follow the returned `nextOffset` using `?offset=N` until it returns zero.
Logs contain a subscriber-hash prefix, threshold and public path, never an email,
cookie or unsubscribe token. Responses contain counts only.

Run `node tests/site/re-engage.mjs`. It selects disposable local Redis DB 4 with a
random namespace, mocks all delivery, and removes its own keys. It never sends mail.
