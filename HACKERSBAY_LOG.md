# The Hackers Bay build log

Times are Paris local time. The release starts with the public Boat Hackathon Demo Day.

## H1 · 2026-11-20 16:11 CET · Landing and design system

- Shipped the sonar landing, guest-wall comparison, sponsor credits, and a responsive dark navy and teal design.
- Decision. The production repo is Corvus-gent/loading-website. Its runtime is static HTML, JavaScript, Vercel Functions, and Redis. The new Vercel rewrites and standalone assets keep the existing routes and shared chrome untouched.
- Decision. The portraits are generated for fictional attendees. The guest-wall comparison uses an original layout.
- Next. Let visitors pick one of four lenses or build a persona from one public link.
- **STEER ME:** Keep the direct Luma headline or lead with “RSVP to people, not places.” Keep the gold radar locks or give the first lock a stronger teal accent.
- Verified. The site build passed and Chromium loaded the landing at 375px and 1440px without horizontal overflow. The existing lockfile failed npm 11's clean install, so local checks used npm install without writing the lockfile.

## H2 · 2026-11-20 16:15 CET · Persona onboarding

- Shipped four persona presets, a one-link draft, editable Builds / Wants / Offers, and browser-local persistence.
- Decision. Profile inputs are public HTTPS URLs. The reader pins public DNS addresses, skips redirects, and has a strict time and size budget. Browser heuristics work even if the endpoint is unreachable.
- Verified. The site build passed and the 375px onboarding flow produced a card with the API disconnected.
- Next. Build the Demo Day event page and four lens scorecards.
- **STEER ME:** Keep cards editable before the event or jump to the radar as soon as a lens is picked.

## H3 · 2026-11-20 16:19 CET · Event page and lenses

- Shipped Boat Hackathon Demo Day on November 21 at the Historic Klamath, with official RSVP, public judge titles, and four distinct lens scorecards.
- Shipped 30 fictional attendees, public event facts from the organizer and Partiful, and deterministic two-way reasons for each of three suggested meetings.
- Decision. Food, cash prize pool, overnight lodging, and cash payout were not stated in the public listings. The Survival score displays that uncertainty.
- Verified. The build passed. At 375px, each lens showed a distinct trio and fit the viewport.
- Next. Put the three matches on the sonar and require both participants to accept an intro.
- **STEER ME:** Add published food or payout details when the organizers confirm them. Choose whether to use Busy builder or Broke hacker as the default walk-through.

## H4 · 2026-11-20 16:23 CET · Room sonar and mutual intros

- Shipped a radar for the 30-person demo room. Three interactive locks jump to match cards with separate reasons for each side.
- Shipped pending and mutual states. The requester opts in first, the fictional recipient explicitly accepts, then both see a suggested time and place within the published 1–5 PM window.
- Decision. Corvus Redis enables shareable recipient links with a one-day lifetime. The same two-step flow works in a single browser without Redis. No email or invitations are sent.
- Verified. The build passed. Chromium completed the full flow at 375px without environment variables and with two isolated browser sessions over Redis 7.
- Next. Deploy the core to Corvus production and run the flow against the live domain.
- **STEER ME:** Lead the pitch with the interactive radar or with the moment the second person opts in.

## H5 · 2026-11-20 16:25 CET · Core live on Corvus

- Deployed the verified core by fast-forwarding main. Vercel finished and the production routes returned the new pages after alias propagation.
- Verified. Chromium completed landing → boarding → radar → intro → separate recipient acceptance → suggested meetup at 375px on corvus.gent. The production API drafted a persona without a configured inference provider.
- Decision. Kept the production site on its existing Vercel project and reused its Redis for shared intro state.
- Next. Add the organizer Room composer and the sponsor Treasure report.
- **STEER ME:** Show the organizer build first or keep the investor report as the next beat after the mutual intro.

## H6 · 2026-11-20 16:27 CET · Host and sponsor views

- Shipped Room composer with a saved draft, applicant search, contribution ranking, and a match graph that recalculates as people move in and out.
- Shipped the sponsor Treasure report with six fictional projects, thesis filters, and a qualified-intro → pilot → follow-through measurement plan.
- Decision. Used Moonbase’s shared roster concept and Luma Clone’s event cover, date tile, and short registration path as references. The Corvus implementation shares one fictional roster across views and uses its own Sonar design.
- Verified. The site build passed. Chromium at 375px checked room changes, persistence, graph selection, and thesis filtering.
- Next. Add Context.dev, NYTEX private mode, and Boat.dev Proof of Build with offline fallbacks.
- **STEER ME:** Start the host with a four-person sample or an empty draft. Lead the sponsor report with private inference or sandbox tooling.
