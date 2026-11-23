# Seven daily entrances

The root entrance keeps the existing HTML lantern, Diogenes/Gabe chat, Wing hint and `portal.js` cookie/door behaviour. Monday retains the painting entrance. Daily art is a decorative Canvas 2D layer; it neither submits forms nor owns navigation. No graphics dependencies were added.

| Brussels weekday | Entrance | Rendering |
| --- | --- | --- |
| Monday | Lantern | Existing painting and draggable light |
| Tuesday | Glyphs | Diogenes, ring, empty seat and Wing sampled into a plum/gold glyph field; 0.65-level hysteresis; only changed cells repainted |
| Wednesday | Ink | Seeded cell thresholds assemble Wing over 1.6s, then crossfade to the original pixel sprite over 0.6s; loop stops on completion |
| Thursday | Water | Procedural waves, sky-anchored moon and aligned reflection; 8×8 Bayer pattern indexed by world x |
| Friday | Room | Glyph dome, ring, empty seat and three doors; each door is also an ordinary HTML link |
| Saturday | Mirror | Glyph dome reflected through rippling dithered water |
| Sunday | Night | Darkness, a golden eye, lantern and a single caption; the ambient motes pause |

## Selection

The quiet top-right button opens an accessible listbox. Arrow keys, Home/End, Escape, Enter/Space and Tab work. A choice writes `corvus-entry-choice` to localStorage inside try/catch and updates `?entry=mon` through `?entry=sun`. An explicit valid URL wins over stored preference. `?entry=today` clears a manual choice in favour of the Brussels calendar; selection checks midnight every minute and on visibility/pageshow. Invalid input is ignored. Weekday selection is a civil-day calendar; the existing realm-cookie expiry ritual is unchanged.

Only the selected scene entry module loads. Canvas dimensions cap DPR at 1 on mobile and 1.5 on desktop. Pixel water uses a bounded low-resolution buffer. Animations cap at roughly 30fps, stop when hidden and dispose on scene change/pagehide. Wednesday stops after assembling. Reduced motion draws a finished static frame, with no RAF loop, while lantern input can still update the light. A runtime motion-preference change recreates the selected scene.

A missing Canvas context, context loss, image failure/timeout or module failure restores Monday without disabling the door or conversation. Failed scenes can be retried by choosing them. The static Monday HTML remains available if the optional picker module itself cannot load. No language bar or privacy notice is added to the gate.

## Sources and boundaries

Ported from the owner's `corvus-entrances-handoff_1.zip` prototypes and brief. Reuses `/public/inspiration/diogenes.webp` and `/public/wing/wing-still.png`; no duplicated image assets or remotely hosted fonts. The water is an original 2D study with a world-x Bayer pattern, not a reconstruction or claim of the reference creator's fractal 3D shader.

The handoff's prototypes continuously scheduled idle frames and could retain flame trails; this integration uses a disposable scheduler, no idle RAF in reduced motion, and the existing HTML lantern. Controls are drawn on a dark backing over high-contrast reflections. Keyboard illumination places the lantern beside the focused control so its drag target cannot block a click. The shared decorative motes now tolerate a missing Canvas context too.

## Verification

- `npm run test:entrances`: Brussels dates, both midnight offsets, DST, precedence and validation.
- `npm run test:e2e`: seven frozen weekdays, module laziness, cookie/enter flow, picker keyboard and persistence, storage denial, chat/echo, still-frame stability, midnight rollover, Canvas/context-loss fallback and hidden-tab pause/resume. Projects: 1440×900, 375×812 and reduced motion. Existing Monday launch checks remain pinned to Monday.
- `npm run build`, `npm run lint`, `npm run test:feedback`, `npm run test:diogenes`, `node tests/realm-ritual.mjs`.
- Visual browser checks at desktop/mobile: painting, glyphs, Wing, water, room links, reflection, night, picker and chat focus.

The e2e static fixture now redirects directory URLs (relative CSS/JS need the trailing slash), maps the existing `/links/:path` rewrite and returns a deterministic soldier-profile fixture for feedback-board previews. It does not call the production profile database.

This does not claim measured performance on physical phones. DPR/frame caps and bounded rendering were checked in browser tests; real-device battery/frame-time measurements remain a follow-up if the experience becomes more complex.
