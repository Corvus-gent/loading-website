# Corvus × The Cube

**Corvus** — be inspired, join, and inspire many more.
**The Cube** — scratch the surface of what's possible in just one day, while being hungry with ambition.

`corvus.gent/thecube` is a Rubik's Cube you can play, prove things with, and measure. It opens with one question — *what are you looking for in chaos?* — and four doors:

| door | route | what you find |
|---|---|---|
| a pattern | `/thecube/lab/` | `R L R′` and `L` end in the same state, exactly one move from solved; a seeded scramble experiment with exact distances up to radius 4 |
| luck | `/thecube/monte-carlo/` | a casino with exact odds (enumerated in your browser) and a house that proves the law of large numbers |
| a show | `/thecube/licht/` | the cube as a light show in the round — Wintercircus, Ghent |
| the truth | `/thecube/nota/` | 65 bits of entropy, a counting proof that some states need ≥ 18 moves, mixing to E[fix] = 8 |

Plus `/thecube/stats/` (the page measures itself and benchmarks your machine) and `/thecube/ab/` (portal variants side by side).

## Every number is reproducible

```bash
node tools/cube/test.mjs                                           # 13 invariant tests
node tools/cube/experiment.mjs --steps 2 --seed 1729 --samples 10000
python3 tools/cube/verify.py http://localhost:8770 tools/cube/evidence   # 24 browser checks
```

| fact | value | how we know |
|---|---|---|
| `R L R′` = `L` | same endpoint signature `9f83dfe0`, distance 1 | production move code, test + BFS |
| P(solved after 2 uniform turns) | 1/18 exact; 559 / 10,000 sampled | enumeration + seeded sampling |
| P(solved after 2 distinct-face turns) | 0 exact | enumeration |
| BFS layers to radius 4 | 1 · 18 · 243 · 3,240 · 43,239 | breadth-first search |
| lower bound on God's number | ≥ 18 by counting | pruned-sequence count exceeds \|G\| at n = 18 |
| E[fixed stickers] of a random state | 8 | 6 + 24·(1/24) + 24·(1/24); Monte Carlo agrees |

## Fast on purpose

No framework. Every door is one HTML file with its own CSS and JS (esbuild), 12–31 kB gzip before images. The heavy maths runs in a module worker with job ids; a published snapshot paints first. Measured on an emulated phone with a 4× slower CPU: first results in 1.46 s, 10,000 × 2 samples in 212 ms, worst frame gap 33 ms.

## On the shoulders of

Stars as read from GitHub on 26 Nov 2026. None of their code is copied into the cube; they are the bar.

| project | ★ | why it matters here |
|---|---:|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | 119,443 | the web's 3D standard |
| [d3/d3](https://github.com/d3/d3) | 114,017 | the grammar of data on the web |
| [3b1b/manim](https://github.com/3b1b/manim) | 96,985 | the reason a generation wants to learn maths |
| [grafana/grafana](https://github.com/grafana/grafana) | 78,198 | observability |
| [bevyengine/bevy](https://github.com/bevyengine/bevy) | 50,018 | Rust ECS + wgpu: a model for a Rust cube |
| [pixijs/pixijs](https://github.com/pixijs/pixijs) | 48,909 | fastest 2D WebGL renderer |
| [ManimCommunity/manim](https://github.com/ManimCommunity/manim) | 42,929 | community manim |
| [PostHog/posthog](https://github.com/PostHog/posthog) | 41,140 | experiments and analytics |
| [evanw/esbuild](https://github.com/evanw/esbuild) | 40,185 | the bundler behind every page here |
| [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) | 31,209 | how "fast" gets proven |
| [BabylonJS/Babylon.js](https://github.com/BabylonJS/Babylon.js) | 26,456 | WebGPU engine |
| [processing/p5.js](https://github.com/processing/p5.js) | 24,434 | creative coding for everyone |
| [google/filament](https://github.com/google/filament) | 20,796 | physically based rendering, wasm |
| [KaTeX/KaTeX](https://github.com/KaTeX/KaTeX) | 20,543 | fast maths typesetting |
| [gfx-rs/wgpu](https://github.com/gfx-rs/wgpu) | 18,644 | Rust WebGPU |
| [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals) | 8,701 | the metrics on /thecube/stats |
| [regl-project/regl](https://github.com/regl-project/regl) | 5,604 | functional WebGL |
| [observablehq/plot](https://github.com/observablehq/plot) | 5,436 | exploratory charts |
| [hkociemba/RubiksCube-TwophaseSolver](https://github.com/hkociemba/RubiksCube-TwophaseSolver) | 766 | Kociemba's two-phase algorithm, by Kociemba |
| [muodov/kociemba](https://github.com/muodov/kociemba) | 645 | C/Python two-phase port |
| [cubing/cubing.js](https://github.com/cubing/cubing.js) | 372 | twisty puzzles on the web (Twizzle) |
| [ldez/cubejs](https://github.com/ldez/cubejs) | 358 | JS cube model and solver |
| [cs0x7f/min2phase](https://github.com/cs0x7f/min2phase) | 344 | optimised two-phase solver |
| [rokicki/cube20src](https://github.com/rokicki/cube20src) | 36 | the source behind God's number = 20 |

## Join

Found a wrong number? Open an issue with the seed. Want to build the next door? The cube is one file per idea.
