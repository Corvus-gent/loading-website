# OSSMAN

Pac-Man in an octagon: you're a white belt submitting meme fighters

- **Team:** Gabriel Van Langenhove
- **Live URL:** https://corvus.gent/hack/play
- **Controls:** swipe / arrows / WASD; on-screen direction buttons also work. Tap **Touch gloves** to start. Use **Sound on / Muted** to toggle synthesized effects and announcer speech.

## Run

Unzip and open `index.html` directly in a browser. No server, install, external asset, library or network connection is required for the game. `index.html` contains all game code, drawing and sound synthesis. `thumbnail.png` (1280×720) and `cover.png` (630×500) are submission artwork, not game dependencies.

## Iframe

Embed `index.html` with a viewport at least 360×640. Enable JavaScript and allow user-initiated audio. Recommended markup:

```html
<iframe src="index.html" title="OSSMAN — Corvus Arcade"
  style="width:100%;height:100dvh;border:0"
  allow="autoplay; clipboard-write; web-share"
  sandbox="allow-scripts allow-same-origin allow-downloads allow-popups"></iframe>
```

The live game response was checked and has no X-Frame-Options or CSP frame-ancestors restriction. A parent site's own iframe policy is outside the game's control.

## Offline behavior

Online counters, score submission, leaderboard and feedback are disabled and hidden in this package. Local best score uses localStorage where available and falls back without failing when storage is blocked. Story cards generate locally as 1080×1920 PNG files. Speech voices depend on the browser/OS; synthesized game effects do not require speech voices. File sharing depends on browser support; the fallback downloads the image. Public share/callout links point to the live game.

The voting winner was **OSSMAN**. The bundle keeps that name offline. All gameplay tunables are in CONFIG at the start of the inline script. No live site files were changed to create this package.
