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
