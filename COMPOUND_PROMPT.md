# Compound edit brief

## Paste-ready prompt

```text
Cut The Hackers Bay demo as 9:16 and 16:9 exports, 15/30/60s each. Rank hooks: (1) “Luma is sinking” over a cannonball hitting the guest wall, (2) “Three people are worth crossing the deck for”, (3) “Would you spend four hours on this room?”, (4) “One link. Three people. Both sides opt in”, (5) “We built a dating app for hackathon intros.” Land the hook by 1.5s. Cut every 0.6–1.2s early. Cannon boom, avatars shatter into radar dots, paste one public link, type Builds/Wants/Offers, lock 3 gold crosses with sonar pings. Hard cut and briefly strip the music at 40%. Show Intro me, pending, recipient Accept, then drop sea-shanty into phonk exactly on “IT’S MUTUAL ⚓”. Hold the meetup beat. Bold teal captions, dark navy, clean phone UI. 15s core only; 30s add lens change and host/sponsor; 60s add private-mode and Proof of Build. Label fictional roster and sample previews. Close “Luma is sinking. The Hackers Bay is coming.” + corvus.gent/hackersbay. Match the end-ring sweep to the opener for a clean loop.
```

## Long brief

**Goal** Show why an event is worth an individual’s time, then show exactly who to meet and why the other person might say yes. The promise is “RSVP to people, not places.”

**Source order** Use Gabe’s dock footage for place and voice, his actual screen recording for product actions, and the Remotion footage for the cannonball, radar and end card. Use the live site’s original navy and teal UI. Label the people and numbers as fictional wherever they appear. The real event is invite-only and actual registration goes through the organizers.

### Hook ranking

| Rank | First 1.5 seconds | Cut and sound |
| --- | --- | --- |
| 1 | “Luma is sinking.” Guest wall front and center. | Launch at 0.2s, cannon hit at about 0.8s. |
| 2 | “Three people are worth crossing the deck for.” | Cold cut from the pier to crossed radar locks with a ping. |
| 3 | “Would you spend four hours on this room?” | Thumb scrolling through faces, then freeze on one face. |
| 4 | “One link. Three people. Both sides opt in.” | Match cuts between paste, third sonar lock, and consent check. |
| 5 | “We built a dating app for hackathon intros.” | Start on the mutual screen and reverse straight into the pending state. |

### Cut map

| Beat | 15s | 30s | 60s |
| --- | --- | --- | --- |
| Hook, cannon and guest-wall problem | 00–03 | 00–05 | 00–08 |
| One link, crew card, Builds / Wants / Offers | 03–06 | 05–12 | 08–18 |
| Extra persona detail | — | Show one lens switch within 05–12 | 18–24, compare survival and worth-it scores |
| Pattern interrupt | 06s | 12s | 24s |
| Radar and three concrete reasons | 06–09 | 12–17 | 24–33 |
| Request, pending, explicit acceptance, drop on mutual | 09–12 | 17–22 | 33–43 |
| Organizer, sponsor, integrations | — | 22–26, one host action and one sponsor filter | 43–53, add organizer, sponsor, private mode and preview |
| End card and loop | 12–15 | 26–30 | 53–60 |

Open with 0.6–1.2s cuts between water, the guest wall and cannon impact. At about 40%, drop the shanty for a breath and hard-cut to a wide sweep on the sonar. Add three pings, one per gold X. Give the pending state a beat so a second action is legible. Put the first phonk kick on the reveal of **IT’S MUTUAL ⚓**, then show **14:15 PT · near the conference center entrance**.

Build with original music or cleared tracks. Use a dry cannon boom with a short low tail, narrow pings above the mix, and preserve space for Gabe’s voice. The provided Remotion renders contain an original synthesized soundbed. Place large teal captions above app controls and inside each format’s safe area. Keep the URL visible on the final card. End on the sonar pulse with a short audio fade so the loop lands back on the guest wall.

# Compound handoff · The Journey + Demo

Import the keepers under `video/raw/journey/` and the two captioned reference cuts from `video/out/`. In Compound, resolve media by imported filename or its actual path relative to the current Compound project root. The local Mac paths are just for finding the clips before import.

## Paste-ready prompt

Make two edits from the imported Hackers Bay assets. Resolve the source videos by filename in this Compound project’s Media Bin: journey_vertical.mp4 and demo_60s_vertical.mp4. Deliver a 72s Journey and a 60s Demo in 9:16 and 16:9. Journey: inbound Gabe → SF night and an earlier hackathon → anonymous guest wall → Klamath/Pier 9 and crew → live pirate builder → real departure terminal → back in Europe → blast the Luma hull → Captain Squawk’s radar, mutual intro, QR. Demo: start mid-cannon, three 1s travel/boat flashes, live Board → Parrot Race → three matches → both say yes → beak bump → Sink-a-Luma and terminal → QR. Preserve the original site’s character art and use actual UI. Hold one match reason long enough to read. Use original shanty (“RSVP to people, not places!”) into phonk at the hull split in Journey or beak bump in Demo. Let the real Gabe VO breathe at Journey 00:08. Keep captions short, high-contrast and safe from native overlays. Use the Klamath still for the missing boat step and the platform parrot plus Ghent footage for the missing car take. Use footage chronology from VIDEO_LOG.md. Finish with a three-second QR/URL hold and a cannon cue to loop. Export captioned and clean with SRT.

## Cut references

| Beat | Reference |
| --- | --- |
| Inbound and SF nights | `inbound-selfie.jpg`, `inbound-seat.jpg`, `sf-golden-gate.jpg`, `sf-walk.mov`, `sf-night.mov` |
| First hackathon and Gabe audio | `sf-hackathon.mov` at 00:11–00:14, `sf-selfie.mov` at 00:01.64–00:04.49, `hack-room.mov`, `hack-stage.jpg` |
| Real boat | `klamath.png`, `boat-room.jpeg`, `boat-crew.jpeg` |
| Building the platform | `sf-laptop.mov`, `product/board-v.webm` or `board-w.webm`. The rolling dice portion is approximately 00:08–00:13. |
| Leaving and Europe | `departure.mov` at 00:00.4, 00:09.1 and 00:17.3. `europe-table.mov` at 00:01.2. |
| Parrot Race | `product/race-action-v.webm` or `race-action-w.webm`. Show the actual demo race and clearly retain its demo context. |
| Cannon, classes, radar, intro and end | `product/demo-v.webm` or `demo-w.webm`. Browser capture leads product time by about 3.5s. Product timestamps are 00:00 cannon, 00:18 classes, 00:31 radar, 00:43 consent, 00:48 mutual, 00:54 QR. |
| Sink-a-Luma | `product/sink-v.webm` or `sink-w.webm` plus `product/sink-terminal.ansi`. Exact command: `curl -L corvus.gent/hackersbay/sink/luma`. |

Use the six `*_hook_*_vertical.mp4` files as A/B references. Journey defaults to the inbound selfie. Demo defaults to the explosion. For a Journey remix, test the boat exterior before the cabin flashback. For a Demo remix, hit the first class art by 00:03 and reserve the longest hold for the beak bump and QR. Keep the two edits independent so each has its own opening and payoff.
