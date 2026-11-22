# The Hackers Bay motion kit

Six Remotion compositions cover the sinking rowboat, crew card, sonar, and mutual intro. Each opens and closes with The Black Commit sinking the grey rowboat. Each has an original synthesized shanty-to-phonk soundbed, cannon impact, and sonar pings.

## Render

Run from this directory with Node.js 22 or later.

```sh
npm ci
npm run studio
npm run render
npm run render -- SonarVertical15 SonarWide15
```

The 9:16 compositions are `SonarVertical15`, `SonarVertical30`, and `SonarVertical60` at 1080 × 1920. The 16:9 compositions use `SonarWide` at 1920 × 1080. All are 30 fps, and renders land in `dist/` as H.264 MP4 files. Set `HACKERSBAY_VIDEO_OUTPUT` to use a different output directory or `HACKERSBAY_CHROMIUM` to point to an installed Chromium executable.

The renderer builds its asset directory from the pixel art, anchor, and fonts in the website. The animated UI uses fictional names and example links. See [Shot list](../SHOTLIST.md) for Gabe’s pickups and [Compound brief](../COMPOUND_PROMPT.md) for the edit.

## Demo Day cuts and pitch

```sh
npm run render -- CutA CutB CutC Pitch
```

A, B, and C are 60-second, 1080 × 1920 cuts. All three open and close on the sinking rowboat. A follows the full blast as the new LUMA boat splits in two. B cuts to the boat step, and C cuts to the car selfie. `Pitch` is a two-minute 1920 × 1080 cut with captions, music, and the upgraded LUMA blast. [Compare the cuts and download the pitch.](https://corvus.gent/hackersbay/cuts)

The optional raw clips go in the ignored `video/raw/` folder. Use `gabe-boat-step.mp4`, `gabe-car.mp4`, and `colin-klamath.mp4`. MOV files also work. Keep clips at least 7, 7, and 4 seconds long respectively. The renderer uses the opening of each file without its audio and crops it to the frame. Missing files produce clearly labeled footage slots.
