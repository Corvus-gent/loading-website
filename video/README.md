# The Hackers Bay motion kit

Six Remotion compositions cover the guest wall, cannonball, crew card, interactive sonar, mutual intro, and end card. Each has an original synthesized shanty-to-phonk soundbed, cannon impact, and sonar pings.

## Render

Run from this directory with Node.js 22 or later.

```sh
npm ci
npm run studio
npm run render
npm run render -- SonarVertical15 SonarWide15
```

The 9:16 compositions are `SonarVertical15`, `SonarVertical30`, and `SonarVertical60` at 1080 × 1920. The 16:9 compositions use `SonarWide` at 1920 × 1080. All are 30 fps, and renders land in `dist/` as H.264 MP4 files. Set `HACKERSBAY_VIDEO_OUTPUT` to use a different output directory or `HACKERSBAY_CHROMIUM` to point to an installed Chromium executable.

The renderer builds its asset directory from the original fictional portraits, anchor, and fonts in the website. The animated UI uses fictional names and example links. See [Shot list](../SHOTLIST.md) for Gabe’s pickups and [Compound brief](../COMPOUND_PROMPT.md) for the edit.
