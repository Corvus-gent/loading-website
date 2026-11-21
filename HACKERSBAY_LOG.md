# The Hackers Bay build log

Times are Paris local time. The demo is built around Boat Hackathon Demo Day in San Francisco.

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
- Decision. Corvus Redis enables shareable recipient links with a one-day lifetime. The same two-step flow works in a single browser without Redis. The requester shares the intro link directly.
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

## H7 · 2026-11-20 16:31 CET · Sponsor integrations and Proof of Build

- Shipped Context.dev Markdown reads, standard LLM drafting, and NYTEX confidential routing that falls back to the labeled private demo when unavailable.
- Shipped Boat.dev Proof of Build on the crew card. Approved repositories can run in temporary VMs, with a health check and a preview URL. The same flow opens an interactive Dockside sample without keys.
- Decision. Took the isolated VM and exposed-port pattern from luxcode, sandboxmaxxing and the Tenki cookbook. Live builds allow only configured public repos, disable account secrets and snapshots, and stop automatically after 15 minutes.
- Verified. The build and the 375px fallback flow passed. Mocked provider requests exercised the documented APIs, including private inference and Boat provisioning, status and hosting.
- Next. Publish this log, polish the Sonar experience, and package the macOS wrapper.
- **STEER ME:** Pick the first allowlisted repository for the stage preview. Choose whether private mode should start enabled.

## H8 · 2026-11-20 16:34 CET · Public log and Mac wrapper

- Shipped the public log from this Markdown file, share artwork for the landing, and a Mac download entry.
- Shipped an Electron wrapper and a repeatable build script for Apple Silicon and Intel macOS. The wrapper opens the production route, isolates the renderer, and hands external HTTPS links to the default browser.
- Decision. Use an unsigned demo release so an Apple developer account is unnecessary.
- Verified. The build passed and the local log rendered every milestone through H7. The release packaging and artifact checks are running separately.
- Next. Render portrait and landscape demo clips and write the filming and Compound briefs.
- **STEER ME:** Lead with the laptop wrapper or keep the on-stage flow entirely on a phone.

## H9 · 2026-11-20 16:44 CET · Demo motion and edit brief

- Shipped six Remotion compositions, the original audio bed, a shot list for Gabe, and the Compound handoff. The short prompt is 1,012 characters.
- Shipped the cannonball and avatar-to-sonar transition, editable card animation, three locks, explicit two-step intro, and loopable end card.
- Decision. Rendered vertical and widescreen separately to keep the phone UI readable. Use the live screen recording for the final edit where the actual controls matter.
- Verified. The build passed and both 15-second exports contain 30 fps H.264 video and AAC audio. The 30- and 60-second files are rendering for the same release.
- Next. Deliver the LinkedIn drafts and demo guide, then run final production QA.
- **STEER ME:** Open the first social cut on the cannonball or on Gabe at the dock. Use the 15-second or 30-second export as the lead.

## H10 · 2026-11-20 16:48 CET · Demo guide and final QA

- Shipped three LinkedIn drafts and the 60-second walkthrough in the repository README. The landing now credits all three sponsors beside the main action.
- Verified. The build and lint passed. Production checks covered seven routes at 320px, 375px and 1440px, all four lenses, host and sponsor controls, private demo mode, and the Boat sample. A second browser accepted the intro over production Redis. A local Redis run also verified duplicate and concurrent acceptance.
- Verified. The Mac release contains both Apple Silicon and Intel disk images. The macOS runner verified the ad-hoc app signatures and disk image checksums.
- Decision. Used the GitHub release for large binary assets so the Vercel deployment and repository stay small. Sponsor APIs were tested with mocked requests and their zero-key fallbacks.
- Verified at 16:56 CET. The final live smoke test passed and the release contains all six verified MP4s in 9:16 and 16:9, plus both verified Mac images.
- Next. Run the 60-second walkthrough at Demo Day.
- **STEER ME:** Lead the 60-second pitch with the Broke hacker or Busy builder lens. Lead the first LinkedIn post with the cannonball or the four-hour test.

## H11 · 2026-11-20 19:19 CET · Autoplay demo

- Shipped a hands-free 60-second sequence at /hackersbay/demo with oversized captions, an opening cannonball, a public-link crew card, a Survival score, three sonar locks, and the mutual intro. The end card holds for recording.
- Decision. The walkthrough defaults to Broke hacker. The capture stage fits 1080 × 1920 or 1920 × 1080, plays silently, and works with the local demo roster.
- Verified. The site build passed. Chromium checked each cue, all three locks, the end-card hold, and keyboard replay and pause at both capture sizes and at 375px and 414px.
- Next. Add Sink a Luma using public event metadata and a labeled sample when the source is unavailable.
- **STEER ME:** Keep the end card on screen after 60 seconds or loop directly back to the cannonball.

## H12 · 2026-11-20 19:24 CET · Sink a Luma

- Shipped a Luma link field on the landing. The result shows the public title, date, place, host, and displayed Going count when available. It works with all four lenses and the saved persona.
- Decision. The importer reads Luma’s public event metadata and visible count badge. A fictional sample keeps the flow clear when the page is unavailable or access is restricted.
- Verified. The build and parser tests passed. The public Show Boat listing imported successfully. At 375px the form handled lens switching, invalid links, and a disconnected endpoint.
- Next. Check each Hackers Bay page and its interactive states at 375px and 414px.
- **STEER ME:** Keep the Show Boat example beside the field or feature a different public event for the stage.

## H13 · 2026-11-20 19:27 CET · Mobile QA

- Shipped larger targets for navigation, event links, organizer graph nodes, checklist rows, and the Proof of Build disclosure. Increased supporting type on the phone layout.
- Verified. Chromium in touch emulation passed ten paths at 375px and 414px, including both autoplay formats, Luma import, persona selection, both intro states, Proof of Build, host, sponsor, and the log. The audited standalone targets reached 44px, with zero horizontal overflow.
- Decision. Reserve 44px targets for standalone controls. Keep links in continuous text inline.
- Next. Measure first paint, defer the landing’s offscreen assets and motion, and strengthen the radar.
- **STEER ME:** Keep sponsor credits beside the boarding action or move them below the sonar.

## H14 · 2026-11-20 19:35 CET · First paint and radar

- Shipped a stronger sonar with bearing marks and the three Broke hacker contacts. Put Sink a Luma beside Board the ship and kept Demo Day details in the event strip.
- Decision. Inline the shared stylesheet in the generated landing at build time. The radar paints at rest, starts moving after paint when visible, and honors reduced motion. The comparison loads its portraits near the viewport.
- Verified. Five cold runs per width on a throttled connection moved median first contentful paint from 716 to 648 ms at 375px and from 724 to 628 ms at 414px. Both widths measured zero layout shift across the updated runs, with no initial portrait request. The mobile route audit passed again.
- Next. Build and check the cannonball share card for LinkedIn and X.
- **STEER ME:** Keep names beside the three sonar locks or show their reasons directly on the dial.

## H15 · 2026-11-20 19:38 CET · Cannonball share card

- Shipped an original 1200 × 630 cannonball and sonar share image. The landing and autoplay demo now carry Open Graph and X metadata with the image, dimensions, and alt text.
- Decision. Make the cannonball the first visual hook and use the same card for the landing and both recording formats.
- Verified. The build, route checks, and Luma parser tests passed. The generated landing and demo both contain the correct canonical, large-image card metadata, and JPEG dimensions.
- Production verified at 19:41 CET. The live autoplay ran through 60 seconds and held the end card. All ten mobile paths passed again at both widths. LinkedIn and X crawler user agents received the share metadata and the JPEG.
- Next. Use the capture links for rehearsal and the share card when publishing later.
- **STEER ME:** Keep the event-day credit in the artwork or give the headline more room after Demo Day.

## H16 · 2026-11-20 20:17 CET · Boat Hackathon submission

- Shipped the dashboard-ready project write-up in SUBMISSION.md with the pitch, feature links, Mac release, and a Straight talk section.
- Decision. Keep the featured-project copy centered on the event decision, the three matches, and mutual consent. Describe the sponsor calls as credential-gated and the on-stage data as fictional.
- Verified. The description is within the 150–250 word range and names each lens and sponsor. The production private-mode endpoint still returns the labeled demo.
- Next. Put the landing QR in both demo surfaces and give judges a single page with all three walkthroughs.
- **STEER ME:** Keep the opening sentence about the travel decision or lead with the mutual intro.

## H17 · 2026-11-20 20:24 CET · Judges’ page and boarding QR

- Shipped a one-screen judging brief with three product differences, three walkthrough links, and sponsor credits. Added the boarding QR and visible short URL to the demo end card and the landing footer.
- Decision. Use the same canonical landing URL in both codes. Load the footer image near the viewport and keep the end card free of playback controls.
- Verified locally. All three actions worked at 375px and 414px, including a 375 × 667 viewport. The two recording formats and both phone sizes produced decodable QR codes. The build, lint, route checks, and Luma parser tests passed.
- Next. Run the complete production smoke test on the new deployment.
- **STEER ME:** Open the stage presentation on the judging brief or go directly into the autoplay demo.

## H18 · 2026-11-20 20:26 CET · Production smoke test

- Verified the deployed judging brief fits and all three actions work at 375px and 414px. Decoded the live footer QR from both phone widths and the live demo end-card QR from both recording formats and phone widths. Both codes resolve to corvus.gent/hackersbay.
- Ran the autoplay for a full minute. It showed the Broke hacker lens, three sonar locks, and the mutual intro, then held the end card. Pause, restart, and stage bounds passed in both recording formats.
- Checked the live Luma import and its fallback, the editable profile and private-mode demo, all four event lenses, two-browser intro acceptance, the host and sponsor pages, the share image, and the published Mac downloads. The mobile sweep found no overflow or undersized standalone controls at 375px and 414px.
- Decision. Keep the end card visible after playback so viewers can scan the code. The submission describes the fictional roster and the current sponsor fallbacks.
- Next. Rehearse from the judging brief or paste the draft into the builder dashboard.
- **STEER ME:** Put the judging brief first in the submission links or lead with the live landing page.

## H19 · 2026-11-21 09:17 CET · Build your pirate

- Shipped a 48 × 48 original pirate sprite with seven customizable layers, a named shoulder parrot, a dice roll, and four classes. The parrot previews Wants and takes an occasional flight.
- Decision. Deckhand is the default class. A public profile can draft the ship’s log while keeping your chosen name, class, and kit. Raising the flag saves the pirate and opens the same event lens.
- Verified. At 375px, 414px, and 1440px the layers, dice, saved state, class handoff, private-mode fallback, and reduced-motion path passed. The build, lint, route suite, and Luma parser tests passed.
- Next. Set The Black Commit afloat and give the event crew their own pirates.
- **STEER ME:** Keep Copper Byte as the starting pirate or start with a fresh dice roll.

## H20 · 2026-11-21 09:20 CET · The Black Commit

- Shipped the original pixel sea, teal sails and bracket flag, a grey Luma rowboat, cannon impact and bubbles, and three flying parrots.
- Decision. Use a 208 × 120 poster at first paint and draw a 30 fps scene only while visible. The original poster remains visible in reduced motion. Audio starts off and only plays after opting in.
- Verified. The creator is live. The landing has no overflow at 375px, 414px, and desktop. The scene paints at rest, animates onscreen, stops offscreen, and advances through the cannon impact and sinking. The sound toggle works.
- Next. Replace the guest wall and portraits throughout the product, then connect the parrots to the spyglass and intro flow.
- **STEER ME:** Keep the moonlit opening or start in sunset colors.

## H21 · 2026-11-21 09:23 CET · Crew, Quartermaster and Merchant

- Shipped 30 original named pirates with distinct pixel sprites and named parrots. The comparison uses sixteen identical grey guest circles opposite the crew on deck. The app and the Remotion source now use pixels or circles for people.
- Shipped touch and mouse drag aboard in Room composer, plus a parchment map and chests in Treasure report.
- Decision. Keep the seed IDs so saved drafts and old intro links still resolve. On phones a dock appears during a drag. The existing Add to room button also works by keyboard.
- Verified. All 30 sprite renders and parrot names were distinct. Deck drag, keyboard add, graph updates, comparison, report filters, and the build passed.
- Next. Send the player’s parrot to all three spyglass matches and animate mutual consent.
- **STEER ME:** Use the three preview pirates as recurring demo characters or rotate the preview by class.

## H22 · 2026-11-21 09:27 CET · Spyglass and mutual intros

- Shipped the pixel spyglass. Your own parrot lands on three match masts and squawks the reason for each. The numbered locks still jump to the corresponding pirate.
- Shipped the two-parrot beak bump, gold coin burst, and Walk the plank decline. The meetup still requires two yeses. Shared intro links carry only two visual parrot settings alongside the existing intro data.
- Decision. Use the same browser demo when the intro service is absent. Acceptance or decline is final for each request. Reduced motion shows the perched bird and text.
- Verified. A custom cyber parrot visited all three masts at 375px. Accepted and declined intros both reached the sender with the expected result. The 414px reduced-motion view passed.
- Next. Retell the timed demo around pirate building and the parrot’s flight.
- **STEER ME:** Keep the automatic spyglass flyover or start it from the first mast tap.

## H23 · 2026-11-21 09:32 CET · A new 60-second demo

- Shipped the eight-beat autoplay. The Black Commit fires in the opening seconds, Copper Byte builds a pirate and names Patch, the Deckhand checks the event, and the parrot explains three matches. Double opt-in ends with the beak bump, coins, and the retained QR end card.
- Decision. Keep the Broke hacker lens as Deckhand and keep both recording formats clean. Space pauses, R replays, and M enables sound.
- Verified. All scenes and captions fit at 1080 × 1920, 1920 × 1080, 375px, and 414px. The QR decoded in both recording formats. Pause, replay, and reduced motion passed.
- Next. Fly the parrot Jolly Roger and publish a matching social card.
- **STEER ME:** Keep Copper Byte and Patch as the named demo pair or cast an original Merchant in a later cut.

## H24 · 2026-11-21 09:34 CET · Fly the parrot flag

- Shipped the original tricorn parrot, the Silkscreen wordmark and headings, and a new 1200 × 630 share card featuring The Black Commit at cannon impact. The landing and both recording formats use the new share card.
- Decision. The Recraft art directory was empty on disk and on production main. The hero, logo, and share card use the original procedural art.
- Verified. The share card dimensions, route suite, Remotion asset preparation, and build passed. The judges' brief still fits at 375 × 667, and the footer and demo QR codes scan.
- Next. Update the stage notes and run the final production smoke across phone widths and both capture formats.
- **STEER ME:** Keep the cannon impact as the share image or feature a close-up of Copper Byte and Patch.

## H25 · 2026-11-21 09:36 CET · Deck polish

- Shipped the daylight pass, clearer pixel parrots in flight, and a live hero that renders on the browser’s frame clock. Updated the screenshot and share art with the sharper sprites.
- Decision. Keep the initial night scene as the static poster. The live animation cycles through daylight only while visible. The README and 209-word submission now reflect the pirate-first walkthrough.
- Verified. Eleven mobile paths passed at 375px and 414px with zero horizontal overflow or undersized standalone controls. The sea renderer measured 5.2 ms at the 95th percentile under a 4× CPU throttle at 375px.
- Next. Confirm the production deployment, then test the complete flow and the one-minute capture against the live domain.
- **STEER ME:** Keep the daylight pass after the cannon shot or open in daylight for the next event.

## H26 · 2026-11-21 09:39 CET · Phase 4 production verification

- Verified all eleven Hackers Bay paths at 375px and 414px. The live character creator, four lenses, 30 distinct crew sprites, touch and mouse dragging, Treasure report, public Luma import, and both intro decisions passed.
- Verified a new two-browser intro through the shared store, including the consent gate and suggested meetup. The autoplay reached the QR after 54.4 seconds, held past one minute, and passed in both capture sizes. The QR also scans from the landing footer.
- Decision. Keep the 60-second story as a browser capture with a silent default. Six cold local runs at the two phone widths recorded zero layout shift and no initial roster fetch.
- Next. Use the browser demo or the judging brief for Demo Day rehearsal.
- **STEER ME:** Start the live pitch on the cannon shot or hand the phone over at the pirate builder.

## H27 · 2026-11-21 15:00 CET · Captain Squawk and the wardrobe

- Rebasing on main brought in all eight Recraft uploads. Shipped transparent WebP and PNG sprites for the six poses, four classes, and 20 wearables, plus the mascot, icon, ship, and mutual art.
- Shipped the parrot-pirate creator, class presets, live apparel layers, dice and reset, Captain Squawk’s Wants bubble, and a local gold counter. The new icon is wired into the browser, web app manifest, and Mac package.
- Decision. Keep the exact Recraft class art for the preset kits. Custom outfits use the uploaded item layers on a color-matched parrot body. Gold starts at zero and the first flag earns three coins.
- Verified. The build passed. The 375px, 414px, and desktop creator tests passed for all classes, apparel, import fallback, and persistence.
- Next. Animate the Recraft ship and put the Captain in the matching flow, demo, and error states.
- **STEER ME:** Keep gold as a demo score or give it a cosmetic use later.

## H28 · 2026-11-21 15:05 CET · The Captain takes the helm

- Shipped the Recraft hero with a separated rowboat, moving sky and waves, a cannon hit, shake, bubbles, and Captain Squawk’s flyover. The original upload is the static and reduced-motion poster.
- Captain Squawk now calls out spyglass reasons and appears in loading, empty, and missing-page states. The mutual intro reveals the Recraft beak bump and awards five local coins.
- Decision. Keep the 404 within Hackers Bay and return HTTP 404. Keep the coin rewards local and award each mutual intro once per browser.
- Verified. Ship effects and offscreen pause passed at 375px, 414px, and desktop. The Hackers Bay 404 returned the correct status locally. The Mac workflow verified and published both new-icon disk images.
- Next. Give the Captain a speaking part in the autoplay and build the mascot-and-ship social preview.
- **STEER ME:** Keep the Captain’s landing line short or have it change after the cannon hit.

## H29 · 2026-11-21 15:09 CET · Captain Squawk hosts the demo

- Shipped the Recraft ship, class art, wearable layers, and beak bump in both autoplay formats. The Captain narrates all eight beats in speech bubbles and changes poses as the story moves.
- Shipped the new 1200 × 630 preview for the landing and autoplay, with Captain Squawk, The Black Commit, and the original hook.
- Decision. Keep audio opt-in and preserve the existing recording dimensions, keyboard controls, and QR end card.
- Verified. All eight scenes fit at 1080 × 1920, 1920 × 1080, 375px, and 414px. All 40 WebP and PNG pairs matched on their visible pixels. The mobile route sweep, selector fallbacks, routes, and Luma tests passed locally.
- Next. Verify the exact deployment on the public domain, then remove the eight raw uploads from main.
- **STEER ME:** Keep the Captain’s parchment speech bubbles or use a darker radio-panel style next time.

## H30 · 2026-11-21 15:12 CET · Production verification and art cleanup

- Verified eleven live routes at 375px and 414px and the branded 404 at 375px. The creator, ship, public event import, empty states, shared intro, gold rewards, Mac links, QR codes, and crawler previews passed.
- Watched the complete production autoplay. Captain Squawk reached the QR after 54.4 seconds and the end card held beyond one minute. Both capture formats passed.
- Reserved space for the coin counter. Six throttled cold local runs at 375px and 414px recorded zero layout shift and no initial roster fetch.
- Removed the eight raw uploads after verifying the served art. Decision. Keep the upload commit f1ada0e in Git history for anyone who wants to regenerate the crops.
- Next. Use the live demo for both capture formats and the new Mac download for desktop.
- **STEER ME:** Lead with the cannon shot or open on the Captain’s wardrobe for the next recording.
