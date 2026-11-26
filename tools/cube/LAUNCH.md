# Launch and distribution: corvus.gent/cube

Goal: the people who hire quant developers and forward-deployed / research engineers (Jane Street, Optiver, IMC, Jump, HRT, Citadel, Apple) see one clip, understand it in 3 seconds, and can verify every number in one click. Rigor is the hook; spectacle is just the delivery.

All numbers below come from `node tools/cube/experiment.mjs` and `tools/cube/evidence/evidence.json` (cube-lab/1, seed 1729).

## The one idea every post repeats

**Two different move sequences, one identical cube. And one tiny rule wipes out an entire outcome.**
- `R L R′` and `L` end in the same state (signature `9f83dfe0`), exactly 1 move from solved.
- After 2 random turns, a cube is solved again 1 in 18 times (5.59% in 10,000 seeded samples; exact 5.56%). Forbid turning the same face twice in a row and it is exactly 0.
- After 8 turns: 87.2% vs 99.2% of samples lie beyond the exact search radius of 4.

## Assets

- `cube-launch-1080x1920.mp4`: 28 s, 9:16, real interactions only (TikTok, Reels, Shorts, LinkedIn mobile).
- Make a 1:1 or 4:5 crop for the LinkedIn feed: `ffmpeg -i cube-launch-1080x1920.mp4 -vf "crop=1080:1350:0:120" -c:v libx264 -preset veryfast -crf 20 cube-4x5.mp4`
- Still for the link preview: the united-lanes frame (`evidence/desktop-proof-done.png`).
- Captions: burn in on TikTok/Reels (most people watch muted). Use the on-screen text in the script below.

## Shot list / on-screen text (matches the recording)

| t | on screen | caption |
|---|---|---|
| 0–1 s | two lanes, `R L R′` vs `L` | "These are different moves." |
| 1–4 s | both animate | "Same cube?" |
| 4–7 s | lanes merge, `3 vs 1`, distance `1` | "Identical. 1 move from solved." |
| 8–12 s | 2-step histograms, gold exact ticks | "2 random turns: solved 1 in 18" |
| 12–14 s | distinct faces column | "One rule → exactly 0" |
| 14–18 s | 8 steps, ≥5 bars | "Reproduce it: seed 1729" |
| 18–28 s | tree, `R L R′ ≡ L`, bounded graph | "corvus.gent/cube" |

## Copy

### LinkedIn (main channel, for recruiters). Post natively with the 4:5 video; link in the first comment.

> Two different move sequences. One identical Rubik's Cube.
>
> R L R′ and L end in exactly the same state, one move from solved. Opposite faces commute, so the first R and the last R′ cancel out.
>
> So I asked a follow-up question and measured it instead of guessing. Take 2 random turns. How often are you solved again?
> → 1 in 18 (5.59% across 10,000 seeded samples; exact value 5.56%).
> Add one rule, "never turn the same face twice in a row," and it drops to exactly 0.
>
> At 8 turns, 87.2% of uniform walks and 99.2% of constrained walks end beyond an exact breadth-first search radius of 4 (46,741 states).
>
> Everything runs in the browser: a web worker, a seeded PRNG, a CSV export, and a one-line Node command that reproduces the counts. 11 invariant tests and 24 browser checks, including at 390 px and on an emulated low-power phone.
>
> Play it, break the intuition, rerun with your own seed: corvus.gent/cube
>
> I'm a law student in Leuven who builds things like this. I'm looking for quant developer, research or forward-deployed engineering roles in London or New York.

First comment: `https://corvus.gent/cube/?exp=scramble&steps=2&seed=1729&n=10000&v=cube-lab%2F1#experiment`

### X / Twitter (math and quant crowd). Thread, video on tweet 1.

1. R L R′ and L are the same Rubik's Cube. Exactly. (video)
2. Opposite faces commute: R L = L R, so R L R′ = L R R′ = L. Three scripted turns, distance one. History length ≠ distance.
3. Follow-up: 2 uniformly random turns → solved with p = 1/18. Forbid repeating a face → p = 0. Measured: 559/10,000 vs 0/10,000, seed 1729.
4. Exact BFS to radius 4 (1 · 18 · 243 · 3,240 · 43,239 states), everything beyond it reported as a lower bound, never a guess. Reproduce: `node tools/cube/experiment.mjs --steps 2 --seed 1729 --samples 10000`
5. Play it in the browser: corvus.gent/cube

### TikTok / Instagram Reels / YouTube Shorts. The 9:16 clip with burned-in captions.

Hook (on screen, first second): **"These two scrambles are the same cube."**
Caption: `R L R′ = L. Then I measured something weirder: 2 random turns → solved 1 in 18. One rule → never. Seed 1729, try it: corvus.gent/cube #rubikscube #math #probability #cubing #quant`
Pin a comment with the explanation (opposite faces commute). Reply to the first 20 comments with a short video reply if one asks "why".

### Hacker News: Show HN (a Tuesday–Thursday morning US Eastern time)

Title: `Show HN: Two Rubik's Cube paths, one endpoint – and a reproducible scramble experiment`
Body: three lines, link, plus how distances are exact up to radius 4 and lower-bounded beyond it. Stay in the comments for the first 2 hours.

### Reddit

- r/Cubers: the clip + "R L R′ = L, and a 1/18 fact about two random turns." Ask what they would measure next.
- r/math or r/probabilitytheory: only as a discussion question ("why is P(solved after 2 uniform turns) = 1/18?"), link as a source. Read each sub's self-promotion rules first.

## Timing

- Day 0, 13:30 London / 08:30 New York (both markets awake): LinkedIn + X thread.
- Day 0 evening: TikTok + Reels + Shorts (same clip, native upload each, no watermarks from other apps).
- Day 1 morning US: Show HN. Day 1–2: Reddit.
- Day 3: a second LinkedIn post with one new chart (e.g. 4 steps: distinct faces solved 9/10,000 via R L R′ L′). Recurring "one experiment per week" posts turn this into a series.

## Getting recruiter DMs (what actually moves the needle)

- **Say what you want.** The last line of every post says the role and the cities. Recruiters act on explicit intent.
- **LinkedIn profile:** headline "Builds reproducible math tools · quant / research engineering · London · NYC"; Featured = the clip + corvus.gent/cube; Open to Work (recruiters only).
- **Direct, not spray:** after posting, send 10–20 short notes to engineers or recruiters at the target firms with the link and one sentence ("I built a reproducible experiment on the Rubik's Cube group; I'd love feedback"). Don't tag companies in the post; it reads as spam.
- **Jane Street** publishes a monthly puzzle. Solving and submitting it, then mentioning this project, is a more credible route than a viral post.
- **Interview-proof:** be ready to derive 1/18 on a whiteboard, explain why the distinct-faces walk can still return to solved at 4 steps (R L R′ L′), and say why the BFS stops at radius 4 (46,741 states vs memory on a phone).

Realistic expectation: a clip like this can travel, but nobody can promise virality or a particular offer. What you control is that every claim survives scrutiny, so the people who do click are impressed.
