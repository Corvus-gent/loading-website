# OSSMAN social demo

- `ossman-9x16.mp4`: 1080×1920, 24.000 seconds, H.264/yuv420p + AAC, 60 fps output.
- `ossman-1x1.mp4`: 1080×1080, 24.000 seconds, same codecs and output rate.
- `ossman-cover.png`: 1080×1920, exact vertical title card / first-frame thumbnail.

Both files are below 50 MB. Source footage was captured with Playwright `recordVideo` at its native 25 fps. The 60 fps delivery repeats source frames; it does not pretend to contain native 60 fps gameplay capture. Full source captures were ~25 seconds per game format, plus >4 seconds of the actual vote/reveal page.

Edit: 0–2 s original pixel-art title; 2–18 s gameplay; 18–21 s vote reveal; 21–24 s play CTA. Three actual seeded demo finishes, 1.2× punch-in cuts, matching technique banners, single-frame impact flashes, black-belt pickup, speech bubbles and blue-belt promotion. Captions stay inside safe margins. All music and sound effects are original synthesis: 140 BPM chiptune, bell, impacts, submission crunch and crowd noise. No copyrighted audio or stock clips.

`?demo=1` opts into a shortened exhibition round. Normal gameplay is unchanged; demo runs do not send plays/scores or write best scores. The fixed-step seeded run gives the same three finish events at both viewports. Promotion is earned by collecting the exhibition's tokens through the normal game routines.

Reproduce from repo root:

```sh
node tools/ossman-demo/check.mjs
node tools/ossman-demo/record.mjs
node tools/ossman-demo/art.mjs
node tools/ossman-demo/audio.mjs
node tools/ossman-demo/edit.mjs
node tools/ossman-demo/upload-demo.mjs
```

The recorder reads `tests/results/ossman-demo/vote-snapshot.json`, a read-only JSON response from `https://corvus.gent/api/name-vote` (OSSMAN won). Refresh that local snapshot before recording if desired. Generated source captures stay in ignored test results. Public download links are in `urls.json`.

Validation: ordinary game smoke checks passed on Chromium and WebKit at phone + desktop sizes (movement, tokens, black belts, finish score, death/replay, promotion, pause). Both inline scripts pass `node --check`. Demo capture has no page errors and no API calls. Exports were decoded end-to-end with ffmpeg and dimensions/duration/codecs checked with ffprobe.

The production website was not deployed or modified.
