export default {
  "title": "privacy, without the fog.",
  "intro": [
    "we don't want your data.",
    "visits become anonymous totals, without tracking cookies.",
    "the few things we store (like a vote or a login code) are listed below, and they expire."
  ],
  "updated": "2026-11-06",
  "sections": [
    [
      "who",
      "who holds the lantern?",
      "Francisco Gabriel Van Langenhove is responsible for corvus.gent and stats.corvus.gent, including music and games. questions or data requests: <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "what gets counted",
      "page visits and allowlisted actions are counted by default through PostHog EU, without cookies, device storage, profiles or recordings. PostHog temporarily derives a daily pseudonym from network/browser information; only the totals are anonymous. names, emails and form contents are excluded. GPC, DNT or ‘don't count me’ prevent PostHog from loading: only a page/day counter is incremented, with no ID, hash or stored headers. those unseen hits cannot identify unique people."
    ],
    [
      "why",
      "why, and on what basis",
      "legitimate interest is the stated basis for basic cookieless audience measurement and abuse prevention. Spotify playback requires your click. login emails, votes and bookings fulfil your request. you can object to PostHog counting here; only an anonymous hit remains. we do not sell data."
    ],
    [
      "storage",
      "what stays, and for how long",
      "login code: 3 minutes. session: 7 days or until logout. login/access-request records and email-linked visitor-count guesses: at most 90 days. anti-abuse limits: up to 24 hours, with a different salted IP hash each day; our app does not store raw IPs. challenges: 5 minutes. game history on the server: 48 hours after use; streaks and vote deduplication: up to one year. anonymous totals and public song suggestions may stay until removed.",
      "analytics event retention is controlled by PostHog’s project setting; our target is 90 days, with confirmation of that account setting still pending. hosting and email delivery logs/backups have their own provider retention. contact me for the current details.",
      "Resend: US storage; 30-day email/log retention on Free/Pro/Scale, 7-day backups; Enterprise may differ. <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "sf",
      "sf trip messages",
      "if you send the sf form, only gabe can view its name, contact, work, meeting choices, dates, place and message in the private dashboard. we use them to arrange the meeting you requested (performance of your request), not for marketing. each form record is automatically deleted from Redis 60 days after submission; marking it done does not extend this.",
      "a copy is emailed to gabriel@corvus.gent through Resend, the documented US-storage exception. Resend has its own delivery-log retention; gabe must delete the notification from his mailbox within the same 60 days. contact gabe to request earlier deletion, including if you gave an x handle or linkedin profile instead of email.",
      "the signed vid cookie is reused only for form abuse prevention; challenges expire after 5 minutes, rate-limit hashes change daily and expire within a day, and retry receipts expire after 24 hours. the homepage note uses sessionStorage (sf-note:2026-11) to appear once per browser tab session. optional analytics records only note/form action counts, never your fields."
    ],
    [
      "browser",
      "the small things in your browser",
      "necessary cookies: sess keeps you logged in; vid prevents duplicate language votes; mvid remembers music votes and daily-game progress. they are signed, secure and inaccessible to page scripts. sess expires after 7 days; vid and mvid after one year. they are never used to identify you in analytics.",
      "one local privacy-choice flag remembers ‘ok’ or ‘don't count me’. ‘ok’ also adds one soldier acknowledgement per browser/site origin; clearing site data can allow another. this flag is not sent to PostHog. analytics and campaign attribution stay in memory and do not use browser storage."
    ],
    [
      "outside",
      "when another service gets involved",
      "Spotify receives a playback request only after play, and may then set its own cookies. our server looks up song links at Spotify or Apple when you submit one. map tiles come through our server from CARTO, without forwarding your IP. Leaflet, Sortable and the PostHog library are hosted here.",
      "Buy Me a Coffee and Pidgy booking are links, not embedded forms. their privacy rules apply after you follow them. /links, /go and our campaign shortcuts only add campaign labels (UTMs) and count visits/clicks; they never collect form contents or visitor identities.",
      "Notion holds my manually entered X log. public stats show totals, public campaign/voice labels and my own posts; reply text and target URLs stay behind login. approved campaign labels and region-hour slots accompany optional analytics. Corvus copies expire within 24 hours; source records follow my Notion retention. the workspace region still needs confirmation, so EU-only storage is not promised.",
      "to count coffees, our server briefly reads Buy Me a Coffee records and recognises repeat supporters using account or email fields when available. only totals and the latest coffee date are cached for 30 minutes.",
      "page visits and allowlisted actions are counted by default through PostHog EU, without cookies, device storage, profiles or recordings. PostHog temporarily derives a daily pseudonym from network/browser information; only the totals are anonymous. names, emails and form contents are excluded. GPC, DNT or ‘don't count me’ prevent PostHog from loading: only a page/day counter is incremented, with no ID, hash or stored headers. those unseen hits cannot identify unique people."
    ],
    [
      "where",
      "where the data travels",
      "our Vercel functions are configured for Frankfurt (fra1). static files and request routing use a global network. PostHog EU is in Frankfurt. Frankfurt is also the Redis migration target; the current database region and the completed move still need verification.",
      "Resend stays as a temporary exception: Ireland is the intended sending region, pending account verification, but email contents and logs are stored in the US. an Irish sending region does not change that. <a href=\"https://resend.com/docs/dashboard/domains/regions\" rel=\"noreferrer\">Resend</a>.",
      "Vercel is a US company. its <a href=\"https://vercel.com/legal/dpa\" rel=\"noreferrer\">Vercel DPA</a> and <a href=\"https://vercel.com/security\" rel=\"noreferrer\">EU–US Data Privacy Framework</a> provide transfer safeguards; they do not mean all provider logs, support access or backups stay in the EU. we still need to confirm our account settings and applicable agreements."
    ],
    [
      "rights",
      "your data, your call",
      "email me to request access, correction, deletion, restriction or portability, or to object to processing based on legitimate interest. you can withdraw playback consent by closing the player/page; Spotify controls cookies it already set. we normally respond within one month. we may need proportionate proof that a request concerns your data, and cannot trace anonymous totals back to you.",
      "you can complain to the Belgian Data Protection Authority: <a href=\"https://www.gegevensbeschermingsautoriteit.be/\" rel=\"noreferrer\">gegevensbeschermingsautoriteit.be</a>."
    ]
  ],
  "providersTitle": "who helps run this",
  "providersNote": "Vercel hosts the site, PostHog EU handles counts, Resend sends login emails and a managed Redis service stores the expiring records. the deployed Redis provider and its region still need confirmation; ask me for the current details. external services may process data outside the EEA under their contracts and transfer safeguards. their policies also explain logs and backups.",
  "roles": [
    "hosting",
    "analytics",
    "login email",
    "Redis provider, if Upstash",
    "Redis provider, if Redis Cloud",
    "map tiles",
    "playback",
    "song lookup",
    "support payments",
    "bookings",
    "manual x log"
  ],
  "consentInfo": "counting starts by default. ‘ok’ dismisses the notice and counts one soldier acknowledgement; it is not analytics consent. ‘don't count me’, GPC and DNT switch to anonymous page-hit totals only. your choice stays until you change it or clear site data. a refusal is kept when this notice changes."
};
