# I DON'T PAY

Run `npm run build` after changing `dontpay/config.json`. The generator writes the overview and each published `/dontpay/<slug>/index.html`. `episode-template/` is a clearly labelled, noindex format preview, not Episode 1.

## Hours

Set `hours.hackathons`, `hours.streams`, `hours.videos` to actual completed hours, and `hours.updated` to an ISO date. `null` means not yet logged; zero means measured zero. Avoid double-counting overlapping sessions. No browser timer or artificial growth. The public page is rendered from the config at build time.

## An episode

Add this shape to `episodes` only after filming and permission. Use `published: false` while preparing; drafts are not built. Never store personal consent records in this public config.

```json
{
  "slug": "first-lahmacun",
  "published": false,
  "title": "Replace with the real episode title",
  "shop": "Confirmed shop name",
  "neighborhood": "Confirmed neighborhood and city",
  "shopURL": "https://example.com/",
  "videoURL": "https://www.youtube.com/watch?v=VIDEO_ID",
  "deal": "The exact trade that was agreed, or what happened when it was declined.",
  "language": "Turkish",
  "foodScore": 7,
  "dealAgreed": true
}
```

Those values are illustrative, not a publishable real episode. Published entries require every field, a safe unique slug, HTTPS links, a 0–10 score and a boolean deal outcome. YouTube and Vimeo use click-to-load embeds; other providers get an original-video link. Episodes follow config order. If retiring a previously generated episode, remove its generated directory deliberately so it is not left live; the build never deletes arbitrary existing content.

## Suggestions

`POST /api/dontpay` forwards through the existing stats function to `_dontpay.js`. JSON body: UUID v4 `id`, `shop`, `neighborhood`, optional `link`, `language`, `note`, `consent: true`; `website` is a honeypot. Allowed origins include production and Vercel preview aliases. Five new suggestions per daily-hashed sender per hour, and 100 total per hour. No raw IP is stored. Individual records expire after 90 days. Retry IDs are idempotent so uncertain network outcomes cannot create duplicates.

Suggestions are not public. The signed-in existing owner can read `GET /api/dontpay?private=1`; unauthenticated access is rejected. Production keys use `dontpay:v1:`, previews use `dontpay:preview:v1:`. No new secrets or paid services are needed.

If sending fails, the visitor can explicitly save up to 10 suggestions in localStorage. The UI says they are **not sent**. Retry is manual, stops on the first error, and removes only confirmed deliveries. Clear-device is available. Expired records are excluded and cleaned on the next visit; browser storage cannot run a timer when the site is closed. Storage-blocked browsers keep the entered text and explain how to recover it.

Draft posts and filming plans live in `content/`, excluded from Vercel uploads. Nothing is posted automatically.
