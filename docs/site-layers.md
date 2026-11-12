# Legion page access

Edit the slashless route keys in `js/site/page-tiers.js`. Routes absent from the map stay public. Each configured route serves its own built `index.html` through the existing Legion handler. Keep checkout, confirmation, sign-in and navigation public.

| Layer | How it opens | Initial pages |
| --- | --- | --- |
| Visitor | Everyone | Home, map, companies, SF LARPing and other unlisted pages |
| Email | Confirm a newsletter email or sign in with a verified Army account | Corvus namesakes |
| Soldier | Legion membership, including the $1 Tiro seat | Corvus and Pidgy wiki articles |
| Hacker | Centurio or higher | Hacker room |
| Call | Legatus or higher | Call room |

Each tier inherits the lower tiers. Returning newsletter subscribers can submit the signup form again to receive a single-use access link. Army members use the usual sign-in. The server checks current membership on protected requests.

Visitors below soldier share 242 seconds of preview time across all soldier articles. Tabs share the same budget. Hiding a tab releases its reading time. After an abrupt disconnect, a reading lease expires within 15 seconds. The server owns the clock, pins the browser’s time zone to the functional session and resets the budget at 04:02 local time. The signed, HTTP-only cookie identifies the browser. Clearing localStorage does not reset the budget. A fresh anonymous browser or clearing the session cookie starts a separate session.

Edit the SF gallery in `sf/larp/photos.json`. Put each photo in `sf/larp/photos/` and rebuild. The two entry points are the SF and Gabe pages.
