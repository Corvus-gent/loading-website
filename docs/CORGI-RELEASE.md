# Corgi letter release

The exact artifact shipped first in PR #132 / merge ef202ab:
`22285c7f03afb91fd632513e30f434ddc293c1b9f5751a77ede781068602a481`, 110935 bytes.
Production `/corgi` was fetched with curl and matched that hash before upgrades began.

The original letter copy remains guarded by `node tests/corgi-copy.mjs`.
`tests/corgi.sha256` checks the current deployed source after the build.
The route stays standalone, noindex and outside public discovery.

## Performance

Local Lighthouse mobile, simulated RTT 150ms, 1600Kbps, CPU slowdown 6×:

| Version | Performance | LCP | CLS | TBT |
| --- | --- | --- | --- | --- |
| Exact artifact | 78 | 3955 ms | .01035 | 0 ms |
| Live details | 78 | 3970 ms | .01057 | 0 ms |

Both measurements used the same local server and Lighthouse configuration.
Scores vary with hardware, network and external font delivery.
No dependencies were added. Canvas work caps at 30fps, with lower rates for
portrait and grain. Hidden/offscreen animation jobs cancel their RAF and resume
without elapsed-time jumps. Reduced motion draws once and leaves Wing out.

## Verification

Playwright at 1440×900, 375×812 and reduced motion:
- Byte integrity, noindex, mail link, no page errors and horizontal overflow.
- Hero after 2.5 seconds, Courier and seal screenshots compared with the same
  source served as a reference; maximum 1% differing pixels outside canvases.
- Frozen local Roman date/time, pointer-only lantern, once-only Wing.
- Click, pointer/touch hold, Enter hold; tests replace mailto with a local hash.
- Offscreen portrait pauses, hidden rendering pauses/resumes, static reduced motion.
- Type SPQC or use the small sunlight button to discover Diogenes' note.
  Escape or its close button dismisses it; focus returns to the sunlight button.

Wing's 8-frame 96px strip is derived from `public/wing/wing-flight.webp` using
existing Sharp tooling. JS advances its sprite frames, allowing true pause and
30fps flight without autonomous animated-image playback.
