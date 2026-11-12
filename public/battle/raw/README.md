# OSSMAN — raw battle footage

All clips are 1080×1920 H.264/yuv420p, captured with Playwright's 25 fps recorder and encoded with `-preset veryfast`. No soundtrack, music, editorial captions, or watermarks were added. The game itself displays a DEMO / EXHIBITION label.

- `raw-gameplay-full.mp4` — 30 s uninterrupted seeded exhibition gameplay; black belt at ~9 s, three finishes at ~10.2 / 11.5 / 12.7 s, promotion at ~13.7 s; speech bubbles visible.
- `raw-fighters.mp4` — 12 s, original sprites/names/CONFIG quotes, four ~3 s close-ups using a capture-only focus view.
- `raw-finishes.mp4` — 6 s, three 2 s gameplay excerpts, hard cuts only.
- `raw-gameover.mp4` — ~5 s of the actual game-over UI, reached by collisions in the local demonstration run.
- `raw-code.mp4` — 15 s of a read-only browser source viewer styled like a dark editor; actual CONFIG/enemy definitions followed by actual `git log --oneline` output. No terminal or editor credentials/settings shown.
- `raw-vote.mp4` — 5 s of the vote/reveal page using a read-only production snapshot (OSSMAN won; 7 votes, 11 plays at capture).
- `raw-all.zip` — the six MP4 files.

Public download locations are in `urls.json`. The live site was not deployed or modified. Demo mode skips score/play submissions and storage changes. The exhibition is deliberately shortened for recording; normal rounds stay unchanged.

Rebuild locally from the repository root:

```sh
node tools/ossman-demo/battle.mjs
node tools/ossman-demo/battle-encode.mjs
node tools/ossman-demo/upload-battle.mjs
```

Upload uses the existing private `~/.secrets/corvus-compound.env`; no credentials are committed.
