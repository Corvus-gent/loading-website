# corvus.gent redesign: the arena

November 2026. A mysterious night entrance with subtle circus references, the hasan.ee composition, and fewer rooms.

> v2 (22 Nov): the cream Wintercircus skin read as too literal. The entrance is black and gold again, with the new pixel-art logo **Wing** in a circus spotlight. Wintercircus now shows up only as a whisper: a striped ring, a hanging pennant, striped dividers, velvet curtains between rooms, and Seurat's *Le Cirque* on the wall.

## v13: half the words (22 Nov)

- End card: "THE ARMY IS FORMING", then "Your seat is still empty.", "Quality seekers only." in lilac italics, the email field with "✦ join the waitlist", and "One letter, when the doors open. privacy". No "wander" line. The image credits sit behind a small ⓘ in the corner.

## v12: type your email straight away (22 Nov)

- The end card shows the email field immediately, with "✦ join the waitlist" as the send button inside the same dark pill (stacked on narrow phones). Enter sends it through the existing newsletter flow (double opt-in by email), and the note below says so. Skipping the crawl puts focus straight in the email field.

## v11: a quiet waitlist door and contributors on the map (22 Nov)

- **End card button:** the bright gold "Join the Legion" becomes a dark, mysterious "✦ join the waitlist". It has a thin gold hairline, a breathing ember mark, and on hover or focus "the doors open soon" in lilac. Clicking unfolds a quiet email field with a consent line; it signs people up through the existing newsletter flow. The same applies to the ring-story ending.
- **Contributors on the map:** /feedback contributors has "✦ view on the map", which opens `stats.corvus.gent/map?contributors=1`. Every contributor lights up as a pulsing light in their flag's biggest city: gold for verified, lilac for guests, bigger with more contributions. The map zooms to fit them.

## v10: magic, an inviting end card, and /feedback (22 Nov)

- **Magic across the site:** drifting motes of gold and plum light, a glimmer that follows the cursor, and a sprinkle when you click a link or button (`js/site/magic.js`). Fewer motes on mobile, no cursor trail on touch, paused when the tab is hidden, off with reduced motion.
- **Crawl words:** some words glow plum (CORVUS, only love, Legion, for now) and some are underlined in gold (alone, Build in public, Help each other win, earned). No dollar amounts in the crawl or the ring story.
- **End card:** Wing lands. "THE ARMY IS FORMING / Your seat in the ring is still empty." Builders, fighters, artists and quality seekers, helping each other win. Step in tonight. Earn your rank. A glowing, shimmering **Join the Legion** button, and "or wander first: Quests · Daily · Gabe".
- **/feedback:** every public page on one zoomable, draggable board, like Figma. Click a page to review it:
  - In comment mode, click any element to drop a pin with a note. On text, you can rewrite the words right there.
  - Switch to browse mode (or press C) to move through the whole site inside the frame.
  - Everything is public. People pick a public username and a flag. Signing in with the existing email link makes them a verified contributor.
  - The contributors view shows a GitHub-style contribution graph.
  - Gabe, signed in as gabriel@corvus.gent, can hide items.
  - API: `api/feedback.js`, with origin checks, rate limits, plain text only. Tests: `npm run test:feedback`. The footer on every page links to it.

## Concept: the ring tells the story (?story=ring)

An alternative to the crawl, with fewer Star Wars references and more Wintercircus: with `?story=ring`, the "what is corvus?" button makes the hall zoom in and dim, and the ring stops spinning. It then turns line by line like a rotating sign: "it is a time of noise · feeds full, rooms empty · … · its name: corvus · build in public · help each other win · no enemies · only love · one dollar to enter · every rank earned · the doors are open · for now · never stop {today}". The current line glows gold and the rest go dim. At the end the ring returns to its daily words and "Join the Legion for $1" appears with the four rooms. Esc or the button skips it. Screen readers get each line through a live region.

## v8: a bigger Wing, fewer references at once (22 Nov)

- **Wing:** about 20% bigger (23vw, at most 31vh or 276px; 58vw on mobile), sized to sit about half as wide as the CORVUS wordmark. The hero scales with the screen height, so the button stays above the fold down to 1280×720.
- **Calmer crawl:** the art drifts in one or two pieces at a time, each staying about 9s, alternating sides. None stay on the end card.

## v7: centred realm, quality seekers, a real Star Wars crawl (22 Nov)

- **Centred:** the ring, Wing in the spotlight, CORVUS, "one man, right now. an army of quality seekers, tomorrow." and the button, all on one axis. On mobile: a shorter hall, no kicker and no pennant, and no notice on the realm.
- **Crawl in Star Wars colours:** a blue opening line, an outlined yellow CORVUS flying away, yellow News Gothic-style text tilting away, and a twinkling starfield with plum nebulae. The last line is today's ring word ("Never stop …").
- **Art in the dark:** images from Gabe's inspiration book (the Anakin costume photo, Michael, the Fallen Angel, Diogenes, the ember monkey, the Creation of Adam) drift in left and right, tilted at random and tinted plum. Two show on mobile. Credits are on the end card.
- **Ending:** Wing flies across like a starship, the camera pans down to a plum planet, then "your move".

## v6: a ring that powers on, and "what is Corvus?" as a crawl (22 Nov)

- **The hall:** an iron dome lattice above the ring, a truss along its top edge, beams of light and plum drapes below it. The letters power on one by one like an LED sign warming up. Today's word breathes in gold. On desktop the ring follows the cursor a little.
- **Less text:** the hero is now the kicker, CORVUS, "one man. an army of builders." and a single button: "what is corvus?".
- **The crawl:** the button opens a full-screen starfield.
  1. "Not so long ago, in a city called Ghent…"
  2. CORVUS shrinks into the distance.
  3. "Episode I · The Realm" crawls away in perspective: builders, Gabe's banner, the laws, the $1 Legion, the four acts, "never stop".
  4. It ends on "your move": Join the Legion for $1, the four acts and contact links.
  
  Esc or "skip" jumps to the end; a second Esc closes it and focus returns to the button. With reduced motion the same story shows as still text.

## v5: the main hall ring and tiny circuses (22 Nov)

- **The ring:** at the top of the realm is a recreation of the LED ring under the roof of the Wintercircus main hall. It is a 3D cylinder of glowing panels reading "NEVER STOP …", with plum drapes hanging from it, turning slowly. The spotlight cord hangs from it.
- **One word a day:** the words live in `public/never-stop.json` and become a circular linked list (`js/site/never-stop.js`). Each day, on the Ghent calendar, the next node is today's word. It is shown in gold, and the ring continues through the next nodes. The first five words are the ones readable on the Wintercircus ring: wondering, debating, giving, shining, listening. To add a word, append it to the JSON. No rebuild is needed.
- **Circuses everywhere:** every page gets 3 to 8 small purple circus tents in the margins. One per page is a secret: click it and emojis pop and the find is saved with the other secrets.
- **Hidden emojis:** three emojis per page show only when the cursor wanders close. At the entrance, emojis and two tents hide in the dark for the lantern.

## v4: find the way in with the lantern (22 Nov)

- **Curtains:** dark Corvus plum with a thin gold hem, at the entrance and between rooms.
- **The dark:** at first only the lantern glows, over Diogenes' own lantern. Drag it with the mouse or a finger, or move it with the arrow keys. The painting, the question and the door exist only where the light falls. What you have found stays faintly visible.
- **Wing:** after about 7s, if nobody has moved the lantern, Wing flies in: "don't know how to get in? maybe use the lantern." He leaves after a few seconds, or as soon as you move the lantern.
- **The door:** a gold italic inscription with a turning star ("✦ enter the realm") hidden in the bottom right, instead of the button. "or ask Gabe's echo" waits bottom left.
- **Less on screen:**
  - No live badge, location line or terminal hint on the landing. Every key except the arrows still opens the terminal.
  - The language bar is at 28% opacity until you hover over it.
  - No privacy or tracking notice on the landing.
  - On every other page the notices are smaller and at about 40% opacity until hovered.
- **Realm contrast:** the dim text is brighter. The stripes, pennant and ring are plum and gold.
- **Keyboard:** Tab moves focus through the hidden things and the lantern follows, so nothing stays dark. Reduced motion shows everything lit and still.

## v3: the entrance as a play (22 Nov)

First visit of the day: the middleware already serves `/public/realm-entry.html` until the `corvus_realm` cookie is set (it resets daily at 04:02).

1. **Curtains:** closed red velvet curtains with a gold seam. They open slowly (1.9s). This is the Wintercircus opening.
2. **The lantern:** in the dark, a flickering lantern light finds Diogenes (Gérôme's study) in his barrel. The dogs stay in the shadows.
3. **The question:** after about 3s it types itself into the text bar. There is one question per day, for example "What would you make if nobody was watching?".
4. **Three ways on:**
   - Answer Diogenes: an LLM fed only with public corvus.gent facts (`api/diogenes.js`).
   - Switch to "Gabe's echo": the same, in Gabe's voice, clearly labelled as AI.
   - "Enter the realm".
5. **CORVUS:** the wordmark fades in at about 6s.
6. **Wing:** at about 8s Wing flies in, circles the lantern and lands with "psst. this way →". Clicking Wing also enters the realm. Wing comes back after two chat replies. Leaving closes the curtains.
7. **The realm (`/`):** Wing lands in the spotlight. Then the lines arrive one by one: "the realm · gent", CORVUS (out of a blur), "one man. an army of builders.", "Corvus is a community…", the routes. Tapping Wing hurries the next line and Wing says something. The programme acts and the poster appear as you scroll.

Accessibility: Tab reveals everything at once. Reduced motion shows the whole scene at once (no curtains, still Wing). Without JS a CSS failsafe shows everything after 10s, and the entrance has a noscript link.

Diogenes API: `POST /api/diogenes {persona, messages}`.
- Origin-checked, 30 messages per hour per daily IP hash, 3000 per day in total.
- Messages are capped at 500 characters and the last 10 are kept. Nothing is stored or logged.
- `DIOGENES_OPENAI_API_KEY` or `OPENAI_API_KEY`; the model is set with `DIOGENES_MODEL` (default `gpt-4.1-mini`).
- Without a key or Redis it answers with scripted Diogenes lines. Tests: `npm run test:diogenes`.

## 1. Audit: what confused visitors

The site had 913 public routes (806 of them Compound video cuts) behind five equal home cards: Quests, Daily, Legion, Live and Gabe.

| Where visitors had to guess or jump | Why |
| --- | --- |
| Home page | Five equal cards with insider labels. No sentence saying where to start and no single main action. |
| Gabe's story | Split over `/gabe` (link list), `/whoami` (the actual story), `/people?id=gabe`, `/sidequests` (out of date), `/support` and `/links/gabe`. |
| Corvus story and joining | Spread over home, `/legion`, `/join-the-army-now`, `/realm`, `/army`, `/people` ("population: 1") and `/build`. |
| Hackathon run | `/quests`, `/hack`, `/hack/1-4`, `/hackthefeed` (stale "next: 7 Nov"), `/hackathons`, `/battle`, `/compound`, `/push`. |
| Live and Daily | Two sections for "what's happening today": `/live` + `/now` + `/stats` sat apart from `/daily`. |
| Chrome | Four bars before content on deep pages (language bar, nav, breadcrumb, a second search button). The Quests room opened with the Hack #4 poster before saying what the room is. |

## 2. Page decisions

| Page | Decision | Reason to exist / destination |
| --- | --- | --- |
| `/` | Keep, rebuilt | Says what Corvus is, one main action, the four rooms. |
| `/legion` | Keep (room 01) | join the waitlist, ranks, the wall. Main conversion. |
| `/quests` | Keep (room 02) | Everything built, hackathon by hackathon. |
| `/daily` | Keep (room 03), absorbs Live | Reasons to come back: puzzle, music, live and now. |
| `/gabe` | Keep (room 04), absorbs whoami | Who is behind it, how to meet him, who he vouches for. |
| `/map` | Keep | Every door, so no link is lost. |
| `/whoami` | Merge → `/gabe/` | Same story as the Gabe room. |
| `/sidequests` | Merge → `/gabe/` | Out of date; "beyond work" now lives in the Gabe story. |
| `/support` | Merge → `/gabe/#vouch` | Index only; subpages stay. |
| `/people` | Merge → `/legion/#wall` | The people of Corvus are the Legion wall. |
| `/hackthefeed` | Merge → `/quests/#run` | Archived doorway with stale dates. |
| `/live` | Keep as a deep page, out of the nav | Functional stream page; reached from Daily. |
| `/join-the-army-now`, `/realm`, `/dinner`, `/sf`, `/hack/*`, `/compound/*`, `/support/*`, `/links/*` | Keep | Campaign landings, mysteries, functional or shared URLs. |

Redirects are temporary (307) so they can be reversed. Merged paths are listed as aliases and leave the map.

## 3. References

| Site | What I saw | What it means for Corvus |
| --- | --- | --- |
| [hasan.ee](https://hasan.ee/) | Right-aligned block with about 20vw of empty space on the right and centred on mobile. Climate Crisis heading in brick red, Host Grotesk body in grey. Links sit inside one sentence ("work, writings and get in touch"). "Get in touch" is a button that fades four icons in, 6px upwards with staggered delays, in space that is already reserved. Subpages end with "← hasan.ee". | Asymmetric hero, prose routes, reserved-space contact reveal with `aria-expanded`, "← corvus" back link on every page. |
| [wintercircus.be](https://www.wintercircus.be/en) | Cream paper (#f4f2e3), near-black ink, circus red and blue as spot colours. A huge uppercase display wordmark. A photo of the arena's circular LED ring with a text motto running round it. "A place for wonderers". | Cream, ink and one red, poster-style uppercase type, and a slowly turning text ring round the crow ("build in public ✦ help each other win ✦ only love"). |
| [maggieappleton.com](https://maggieappleton.com/) | Three top items (The Garden, Now, About). The Garden menu holds eight content types, each with a one-line description. | Few rooms, with a one-line promise under each room name. |
| [pudding.cool](https://pudding.cool/) | A numbered issue index (#229, #228…) and mood filters (Our faves, Popular, Updating, Your input) over hundreds of essays. | Numbered acts (01–04) on the home programme. Hackathons already use 001–004. |
| [rauno.me](https://rauno.me/) | The intro is one sentence with work links inside it. Email copies on click. A manifesto list ("Make it fast… Make it.") | Identity and routes in the same sentence. A short credo as atmosphere. |
| [experimentaljetset.nl](https://www.experimentaljetset.nl/) | Decades of work behind three words in a 2×2 grid ("thing / time / space") and a live CET clock. | A huge archive can still have three or four big doors; the archive lives one level down. |
| [worksinprogress.co](https://worksinprogress.co/) | A magazine with a slim Topics / Issues bar and the archive behind it. | Keep the map and search as the archive; keep the nav slim. |

## 4. Two directions

**A. De Piste (the ring). Chosen.**
- First view: cream page, the crow inside a turning text ring on the left, a huge poster headline on the right ("One man. An army of builders."), then one human sentence.
- Navigation: the routes are words in the sentence, and the red "joining the Legion for $1" is the only accent. Below that is a numbered programme of four rooms, then the map and search for everything else.
- Type is Big Shoulders Display 900 (poster) with Instrument Sans for reading. Colour is cream, ink and one red. The only imagery is the logo. Motion is the ring turning once per 90s and the contact reveal, and both stop with reduced motion.

**B. Het Programmaboekje (the flyer).**
- First view: a Trader Joe's Fearless Flyer / circus-programme spread with dense columns, hand-drawn arrows, inline icons and many acts at once.
- Navigation: you scroll the programme and every act is a card.
- Type is a condensed serif plus handwriting, colour is several spot colours, imagery is photos and doodles, and motion is a scroll-driven reveal.
- Why not: very characterful, but it brings back the "everything at once" feeling. Its numbered acts were kept in A.

A wins because the crow, the ring and the red make it feel like Corvus, and a newcomer gets one sentence, one action and four doors.

## 5. Sitemap

```
/            the arena: what Corvus is + the programme
├─ /legion   01 join the waitlist, ranks, the wall        (+ /people)
├─ /quests   02 the work, hackathon by hackathon     (+ /hackthefeed) → /hack/*, /compound/*, /battle, /build
├─ /daily    03 puzzle, music, live & now            → /games, /music, /live, /now, stats
├─ /gabe     04 story, meet, vouch, elsewhere        (+ /whoami, /sidequests, /support) → /call, /cv, /support/*
└─ /map      every other door; "/" opens search everywhere
```

## 6. Home page, section by section (v2)

1. **Quiet nav:** gold serif CORVUS mark · Legion · Quests · Daily · Gabe · / search. The language bar stays.
2. **Stage (left):** a thin spotlight cord. Wing (animated, transparent) carries his lantern into a warm spotlight above a red and black striped circus ring. On reduced motion he is still.
3. **Words (right), arriving after the light:** "gent · the doors open at dusk". The gold Bodoni **CORVUS** wordmark. "one man. an army of builders." The Archangel Michael and Diogenes rails stay.
4. **Opening line + routes:** as in v1. The gold "joining the Legion for $1" is the only accent. "Get in touch" reveals the contact links.
5. **Pennant:** a red and ivory striped ribbon hanging from the top of the tent.
6. **Tonight's programme:** acts I–IV, under a diagonal striped divider.
7. **Poster:** Seurat's *Le Cirque*, sepia and barely lit, with "No enemies. Only love." beside it.
8. **Newsletter and footer:** striped dividers. The footer icon is Wing.
9. **Curtains:** red velvet curtains close when you leave a room and open when you arrive. On a first visit they open slowly. They are off with reduced motion.

## 7. Tested

Tested with Playwright on desktop (1440×900) and mobile (390×844):

- The headline is above the fold and the main action is red.
- Tab order is: languages → nav → the three prose links → "get in touch".
- Enter opens the contact links and focus moves to "email". Esc closes them and returns focus. While closed the links are inert.
- Opening the contact links moves the page by 0px.
- With reduced motion, the ring animation is `none`.
- Back links: rooms → "← corvus", `/hack/3` → "← quests", `/call` and `/support/companies` → "← gabe", `/live` → "← daily".
- `npm run lint` passes.

v2 checks: curtains close on click and open on arrival. Reduced motion shows the still Wing, no spotlight animation and no curtains. Not yet checked: redirects on a Vercel preview, and a skip link past the language bar.
