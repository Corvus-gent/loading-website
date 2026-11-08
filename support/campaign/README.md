# Support / Diogenes post

- /call: 5 minutes free, 15 minutes for one $5 coffee, or meet in SF for one coffee. Paid tiers use the existing Buy Me a Coffee link and an explicit honor-system checkbox. No Stripe call payment or external calendar.
- /call/admin: private request list, new / scheduled / done, email retry. Use CALL_ADMIN_KEY or Gabriel’s existing login. The key is removed from the URL and remembered only in sessionStorage.
- /dinner: LinkedIn, Instagram and X contact links.
- /gabinho-rolls?from=support: top roll/surf invitation.
- /go/{call,bmc,dinner,roll}-{li,x}: 302, source=linkedin|x, medium=social, campaign=diogenes. Anonymous counts in the stats overview, Support (Diogenes post).

CALL_ADMIN_KEY is generated outside git and set as Sensitive in production and preview. RESEND_API_KEY is reused. LINKEDIN_PROFILE_URL is configured. X_USER_ID is optional; without it the X profile opens. BMC_URL defaults to the unchanged existing coffee link. Availability is manually edited in js/support-config.js; it is not a real-time calendar.

Booking records expire individually after 60 days; status changes do not extend their TTL. Failed emails leave the request saved with a retry in admin. Resend idempotency and a 10-minute submission key prevent duplicate messages on retries. Requests are limited to one/minute and three/hour per daily-salted IP hash. No raw IP is saved. Public statistics never include form details.

Validation: REDIS_URL=redis://127.0.0.1:16380/8 node tools/support/check.mjs
