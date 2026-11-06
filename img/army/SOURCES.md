# Army art

## Napoleon hero

- **Jacques-Louis David, Napoleon Crossing the Alps**, second version, May 1801; Charlottenburg Palace, Berlin.
- [Wikimedia Commons file, source and licensing](https://commons.wikimedia.org/wiki/File:Jacques-Louis_David_-_Napoleon_Crossing_the_Alps_-_Schloss_Charlottenburg.jpg).
- [Original 2024 × 2380 scan](https://upload.wikimedia.org/wikipedia/commons/3/3a/Jacques-Louis_David_-_Napoleon_Crossing_the_Alps_-_Schloss_Charlottenburg.jpg), downloaded 6 November 2026.
- Public-domain painting and faithful reproduction, Commons **PD-Art (Yorck Project)**. Scan from The Yorck Project; colour/luminosity correction by Commons contributor Kirtap. No attribution requirement for this public-domain reproduction; credit retained on the page.
- Corvus modifications: desaturation, exposure adjustment, responsive resizing, dark gradients and original crow drawing. The painting is not AI-generated.
- `napoleon-crow.svg`: original hand-written Corvus vector drawing, 2026.
- `napoleon-{480,800,1200}.webp` and `gate-napoleon-og.webp` are generated with `node tools/build-napoleon-art.mjs /path/to/downloaded-original.jpg`. Sharp encodes WebP at quality 78; all outputs are at most 1200 px wide (below the 1600 px limit). The original download stays outside the repository.

The earlier `crow.svg`, `diogenes.svg`, `gate.svg` and `gate-og.png` are original Corvus illustrations retained for existing references.

## Share-card type

Server-rendered dog tags/posters bundle DejaVu Sans Mono (subset of the local distribution for Latin text, punctuation and arrows used by English share cards) because the function runtime has no system fonts. Bitstream Vera/DejaVu license: https://dejavu-fonts.github.io/License.html ; upstream notice is in `fonts/LICENSE.txt`. It is loaded server-side only, not requested by the browser.
