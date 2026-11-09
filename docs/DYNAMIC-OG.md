# Dynamic social cards

This repo is static HTML + Vercel Node functions, not Next.js. Cards use Vercel's standalone `ImageResponse` from `@vercel/og`, the equivalent API for this stack: https://vercel.com/docs/og-image-generation/examples . No framework migration or new top-level function was added.

- `/api/og?kind=live`: live headline, Gabe's existing photo, `/live`.
- `/api/og?kind=hack3`: newest published interview; honest robotics fallback when empty/unavailable.
- `/api/og?kind=interview&n=N`: builder, project, description, optional approved interview photo.
- `/api/og?kind=compound&lang=nl&hook=mom&n=1&video=tt-gl-nl-mom1`: code, localized hook, call to vote, deadline/time left.

Middleware serves complete OG/Twitter tags in the initial HTML on `/live`, `/hack/3`, Compound v2 hub and language/hook/video pages. `/v/SLUG` still sends a 302 with existing attribution to that HTML. Private stats, links and interview editor routes are untouched.

Fragments never reach HTTP servers. Share interviews as `/hack/3?interview=N#int-N` (already used by quick-add). Bare `#int-N` still scrolls to the interview but inherits the generic `/hack/3` preview.

Set an optional **hook line** in `/compound/v2/stats` (add form or each existing row). It should be in that video's language. Without it, the existing localized campaign sentence is used; unprovided video scripts are never invented. All 20 languages are covered by local Noto fonts. Arabic/Persian text is shaped with Pango before composition in ImageResponse.

Cards are 1200×630 PNGs; tags include `twitter:card=summary_large_image`, title, description, absolute image URL, alt, dimensions and PNG MIME. CDN cache: 60 seconds; bounded process cache and concurrent-render deduplication. Countdown is a snapshot at render time, not a live animation in social apps; the absolute Mon 9 Nov 2026 09:00 PT deadline is always shown. After the deadline it reads “challenge ended”. Platforms can cache previews longer than our CDN.

Only the repo's Gabe photo and validated interview-upload Blob URLs can be read. No arbitrary URL/image/text API. Remote photo reads have time/byte limits and no redirects; invalid/unavailable photos fall back to readable text. SVG/HTML markup in names or hooks stays text. Cached metadata is public only and contains no admin/session data.

Validation: `node tests/dynamic-og.mjs` generates 20 language samples, verifies dimensions, shared metadata and redirect behavior with X/LinkedIn/Discord/WhatsApp crawler agents. It checks safe image sources, expired countdown, missing IDs and private-route exclusions. Screenshots/images remain in ignored `test-results/og/`. These are HTTP/crawler-format tests, not a promise that each platform refreshes an already-cached post immediately.
