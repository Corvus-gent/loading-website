export default {
  "title": "privacy, without the fog.",
  "intro": [
    "we don't want your data.",
    "with your permission, visits become anonymous totals, without tracking cookies.",
    "the few things we store (like a vote or a login code) are listed below, and they expire."
  ],
  "updated": "updated 4 november 2026",
  "sections": [
    [
      "who",
      "who holds the lantern?",
      "Francisco Gabriel Van Langenhove is responsible for corvus.gent and stats.corvus.gent, including music and games. questions or data requests: <a href=\"mailto:gabriel@corvus.gent\">gabriel@corvus.gent</a>."
    ],
    [
      "counts",
      "what gets counted",
      "only after you allow optional analytics: page visits, broad country/browser categories, known link destinations and simple game/music actions. PostHog EU counts without tracking cookies or personal profiles. it briefly processes your network/browser information into a daily pseudonym; only the resulting counts are anonymous. no names, emails, form contents, searches or recordings go into our analytics. public maps and pingle only use rounded city data with at least two counted visitors."
    ],
    [
      "why",
      "why, and on what basis",
      "consent: optional PostHog analytics and, separately, clicking play to enable Spotify. legitimate interest: preventing abuse and using anonymous totals. performance of your request: login emails, votes, games, access requests and bookings. close the Spotify player/page to stop playback. we do not sell visitor data. we honour browser do-not-track and global privacy control for analytics."
    ],
    [
      "storage",
      "what stays, and for how long",
      "login code: 3 minutes. session: 7 days or until logout. login/access-request records and email-linked visitor-count guesses: at most 90 days. anti-abuse limits: up to 24 hours, with a different salted IP hash each day; our app does not store raw IPs. challenges: 5 minutes. game history on the server: 48 hours after use; streaks and vote deduplication: up to one year. anonymous totals and public song suggestions may stay until removed.",
      "analytics event retention is controlled by PostHog’s project setting; our target is 90 days, with confirmation of that account setting still pending. hosting and email delivery logs/backups have their own provider retention. contact me for the current details.",
      "Resend: US storage; 30-day email/log retention on Free/Pro/Scale, 7-day backups; Enterprise may differ. <a href=\"https://resend.com/security/gdpr/\" rel=\"noreferrer\">Resend GDPR</a>."
    ],
    [
      "browser",
      "the small things in your browser",
      "necessary cookies: sess keeps you logged in; vid prevents duplicate language votes; mvid remembers music votes and daily-game progress. they are signed, secure and inaccessible to page scripts. sess expires after 7 days; vid and mvid after one year. they are never used to identify you in analytics.",
      "your analytics choice and privacy version are stored on this browser for 180 days, or until the policy changes. localStorage holds your language-vote choice, your language, realm entry preference, feathers, game results and whether game instructions were read, for up to one year after saving. clearing site data removes these preferences; it does not erase already submitted votes."
    ],
    [
      "outside",
      "when another service gets involved",
      "Spotify receives a playback request only after play, and may then set its own cookies. our server looks up song links at Spotify or Apple when you submit one. map tiles come through our server from CARTO, without forwarding your IP. Leaflet, Sortable and the PostHog library are hosted here.",
      "Buy Me a Coffee and Pidgy booking are links, not embedded forms. their privacy rules apply after you follow them. /links, /go and our campaign shortcuts only add campaign labels (UTMs) and count visits/clicks; they never collect form contents or visitor identities. (analytics only with consent)."
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
    "bookings"
  ],
  "consentInfo": "optional analytics is off until you allow it. change your choice here at any time. each site origin remembers its own choice for 180 days. declining does not limit the site; visit statistics only include people who allow counting. withdrawal stops future analytics and does not undo processing already performed."
};
