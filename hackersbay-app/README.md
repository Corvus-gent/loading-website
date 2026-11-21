# The Hackers Bay for macOS

This Electron wrapper opens the live demo at [corvus.gent/hackersbay](https://corvus.gent/hackersbay). External HTTPS links open in the default browser. The app keeps its own browser storage.

## Build the Mac app

With Node.js 22 or later on macOS, run the following from this directory.

```sh
npm ci
npm run build:mac
```

The unsigned Apple Silicon and Intel disk images land in `dist/`. The app bundles are ad-hoc signed. macOS may require opening the app from Finder and allowing it in Privacy & Security on first launch. Run `npm start` from this directory to run the wrapper during development.
