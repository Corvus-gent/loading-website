# Codex: stabilise and ship /cube (cube-lab/1)

You are the slow, careful owner of this change. A working vertical slice already exists and passes its checks.
Your job is to land it in the real Corvus checkout without regressions, then harden it. Do not add features.

## 0. Set up your own worktree (do not touch Gabriel's working copy)

```bash
cd <corvus checkout>            # repo: Corvus-gent/loading-website
git status                      # note any uncommitted work; do not stash or discard it
git fetch origin
git worktree add ../corvus-cube-stable -b cube/stable origin/main
cd ../corvus-cube-stable
```

Commit as `gabe-maxxing` only (never Flypen2).

## 1. Drop in the slice

Copy from this ZIP into the worktree, preserving paths:

| file | status |
|---|---|
| `cube/index.html` | replaced (same route, same element ids as baseline + new sections) |
| `cube/style.css` | replaced (Corvus ink/violet/gold, Bodoni Moda + Instrument Sans) |
| `cube/cube.js` | replaced (baseline simulator, tree, keyboard, playback kept; proof + experiment added) |
| `cube/model.js` | **unchanged** from baseline `34a8ca2` — verify with `git diff` |
| `cube/lab.js` | new — pure search/sampling, also imported by Node |
| `cube/lab-worker.js` | new — module worker, job ids |
| `cube/lab-snapshot.json` | new — generated, see step 3 |
| `cube/assets/day-1.svg` | new — copy of `/logo/day-1.svg`; switch to the weekly logo helper if the repo has one |
| `tools/cube/test.mjs`, `experiment.mjs`, `verify.py`, `record.py` | new |

First confirm the live route still matches the audited asset: `git log -1 -- cube/` should be `34a8ca2`. If it moved, diff baseline vs. current and port any newer changes into the new `cube.js` before continuing.

## 2. Repo integration checks

- `tools/site/chrome-policy.mjs` lists `cube/` as standalone chrome. Gabriel wants the normal site header with the language bar. Decide with him before changing it; if removed, delete the custom `<header>` in `cube/index.html` and move the NL/EN strings to the site i18n (`data-i18n`, `js/i18n/*`). Until then keep standalone.
- Paths are absolute (`/cube/...`) because `/cube` is rewritten to `/cube/index.html` in `vercel.json`. Keep it that way.
- Run the repo's own build, lint and tests (`node tools/site/build-all.mjs` and whatever `package.json` defines). If lint flags the new files, fix style only, not behaviour.
- `lab.js` imports `./model.js` as ESM. Node 22 detects ESM syntax; if the repo pins an older Node, add `"type": "module"` scoping or rename tools to `.mjs` imports — do not fork the model.

## 3. Reproduce the reference numbers

```bash
node tools/cube/test.mjs                                   # 11 tests
node tools/cube/experiment.mjs --steps 2 --seed 1729 --samples 10000
node tools/cube/experiment.mjs --steps 8 --seed 1729 --samples 10000
node tools/cube/experiment.mjs --snapshot > cube/lab-snapshot.json && git diff --exit-code cube/lab-snapshot.json
```

Expected (cube-lab/1, seed 1729, n = 10 000 per generator, bins d=0..4, ≥5):

| steps | uniform | distinct faces |
|---|---|---|
| 2 | 559 · 1101 · 8340 · 0 · 0 · 0 | 0 · 0 · 10000 · 0 · 0 · 0 |
| 4 | 71 · 352 · 1777 · 2434 · 5366 · 0 | 9 · 33 · 242 · 437 · 9279 · 0 |
| 8 | 4 · 20 · 105 · 310 · 843 · 8718 | 0 · 2 · 6 · 14 · 55 · 9923 |

Exact 2-step: uniform 18/324 · 36/324 · 270/324; distinct 0 · 0 · 270/270. BFS layers 1, 18, 243, 3240, 43239.
Gabriel's separate oracle ZIP (`corvus-cube-claude.zip`, METHODS.md) was not available to Claude. If its generator definitions differ from the rules in `lab.js` (uniform = 18 independent; distinct = 15 on a different face after step 1; same seed for both), reconcile them, bump `LAB_VERSION`, regenerate the snapshot and update the table above.

## 4. Browser verification

```bash
python3 -m http.server 8770 &                              # from the repo root
python3 tools/cube/verify.py http://localhost:8770 tools/cube/evidence
```

24 checks: proof unites with exact distance 1, scrub/step, histogram = table, snapshot = oracle = live worker, exact overlay, ≥5 bins, cancel keeps last result, rerun completes, inspect → simulator → Back, keyboard-only R L R′, reset during playback, four views, tree ≡ annotation, bounded-graph labels, share link, invalid query, reduced motion, 390 px no overflow, no page errors. All must pass on `vercel dev` or a preview deployment too.

## 5. Hardening backlog (in this order, stop when time runs out)

1. Run `verify.py` against the Vercel preview URL, not just localhost.
2. Real low-power device (an older Android phone): record first load, warm run and max frame gap in `evidence.json` next to the emulated 4× numbers.
3. Worker failure path: block `lab-worker.js` (DevTools request blocking) and confirm the main-thread fallback runs and the snapshot stays visible.
4. Accessibility pass: screen reader announcement of the verdict, focus order through §1 → §2 → simulator, 44 px targets.
5. Translations beyond NL/EN via the site i18n once the header decision is made (site languages: en nl es fr pt de zh hi ta).
6. OG image for `/cube` (1200×630, the united-lanes frame) so LinkedIn/X previews look right.

Do not build a solver in this release. The bounded BFS is the scope.

## 6. Ship

Open a PR from `cube/stable` titled `cube: two-path proof + reproducible scramble experiment (cube-lab/1)` with the evidence table and the clip. After merge, confirm `https://corvus.gent/cube`, `/cube/`, and a share link `/cube/?exp=scramble&steps=8&seed=1729&n=10000&v=cube-lab%2F1#experiment` all load in production.
