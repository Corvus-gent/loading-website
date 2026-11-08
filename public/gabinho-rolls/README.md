# Gabinho Rolls media

## Still required

- `profile.jpg`: Gabriel's surf photo. Used for the circular hero portrait, video poster and Open Graph/Twitter image. **The social preview image cannot load until this file is supplied.**
- `gi-medal.jpg`: Gabriel's Grappling Industries bronze-medal photo, in the about section.

Add the originals at these exact paths and run the normal Vercel build/redeploy. `tools/build-gabinho-rolls.mjs` includes available photos automatically; missing photos never render broken image boxes. No replacement portraits have been generated.

## Included

- `monferno.png`: the user's first supplied PNG, copied unchanged from `pasted-618e1c0d15ea9e5a941e33cbc89cd8722fa2e40ad8a96c924dc97ea90a42fa23.png`. Used at the top and as this page's favicon. The other two reference images are not used.
- `brand-partner.mp4`: the user's 40.02-second clip from https://compound.mov/v/1ECAgHYbaGpGjZGsimJRiQ, downloaded from its `og:video` URL and compressed to H.264/AAC, 720×1280, 30 fps, faststart, 3,807,255 bytes. The Compound page sends `frame-ancestors 'none'`, so an iframe cannot work.

Compression: `ffmpeg -i ORIGINAL.mp4 -map_metadata -1 -vf 'scale=720:-2,fps=30' -c:v libx264 -preset veryfast -crf 26 -maxrate 1600k -bufsize 3200k -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart brand-partner.mp4`.

TikTok uses its creator-profile document (`https://www.tiktok.com/embed/@gabinho_bjj`) for `gabinho_bjj`, loaded only after the visitor clicks. New edits come from TikTok automatically; no copied list or API key.

Provider verification: the documented embed.js loaded, but its CSS/JS dependencies returned 404 from TikTok’s CDN. The direct creator document returns the real profile and recent videos; the automated browser was rate-limited by TikTok. The page always offers a direct profile link and a blocked/slow-embed notice. No TikTok content is scraped, cached or proxied by Corvus.
