# LinkedIn impact: import and scoring

## Diagnosis — 10 November 2026

Production had 118 LinkedIn export records (116 ready, 2 pending), none with a published `post_url`, and zero LinkedIn records in the impact registry. The impact page only lists published, confirmed original native videos. Rendering exports as published posts would be incorrect.

The LinkedIn adapter is manual-only: it returns no updates. The scheduled impact job is configured at minutes 12 and 42; its saved LinkedIn check at `2026-11-10T19:42:22.312Z` completed in manual mode with zero found/updated. This is not a working LinkedIn discovery job. Production has a `LINKEDIN_PROFILE_URL` setting, but no LinkedIn analytics authorization. No profile scraping has been added.

The ordinary `linkedin` → `li` platform mapping and “all accounts” selection were working. No LinkedIn posts were waiting behind the verification filter. Missing metrics do not affect eligibility. Additional hardening now accepts case variants (`LinkedIn`, `LI`) and maps the export account `gl` to the configured personal LinkedIn handle.

LinkedIn does offer restricted member analytics through `r_member_postAnalytics`; this integration does not have that OAuth connection. See [LinkedIn Member Post Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics). Manual entry is the supported path here.

## Owner workflow

1. Sign in at `/admin/#impact-admin` or `/compound/v2/stats/#impact-admin`.
2. Under **LinkedIn video → add or update**, paste a full `linkedin.com/posts/...` or `linkedin.com/feed/update/urn:li:activity:...` URL. Use LinkedIn's full post link, not a profile URL or a shortened `lnkd.in` link.
3. Confirm this is Gabe's original post and contains a native uploaded video. Replies, quotes, reposts, images and text posts remain excluded.
4. Optionally enter video views **or** impressions, reactions, comments and reposts. Leave unknown figures blank. Save.
5. Use **edit** beside an existing row or paste the same URL to update it. Blank fields preserve existing numbers; explicit zero replaces a number. Public figures update within a minute.

The existing LinkedIn bulk form accepts up to 25 full post URLs, with or without metrics, one per line. Example: `URL — 100 impressions, 4 reactions, 2 comments, 1 repost`. The owner confirms original authorship and video media. URL-only imports appear immediately with unknown metrics; they are not invented analytics.

## No mystery score

`score = (video views OR impressions) × 1 + reactions × 3 + comments × 8 + reposts × 10`

The common model stores reactions as `likes`, reposts as `shares`, and the chosen reach count as `views`, retaining `view_metric` to distinguish impressions from video views. Views and impressions must never be summed. Reported saves, if available through advanced editing, retain the common `saves × 5` weight. Missing inputs remain null, are displayed as **—**, and contribute nothing to the partial score. Manual measurements say **self-reported** and keep a measurement timestamp and version history. A URL-only import is **unreported** until numbers are provided.

## Regression checks

- `node tests/impact-linkedin.mjs` — failed on the old URL-only importer; now checks missing metrics, score 138, account/case aliases and invalid input.
- `node tests/compound-impact.mjs` — disposable local Redis DB 10; owner auth, confirmations, insert/update without duplicates, preserving blank metrics, explicit zero, other-platform eligibility.
- `node tests/impact-accounts.mjs` — TikTok/Instagram extraction, Twitch, filtering and LinkedIn bulk import.
- `node tests/impact-browser.mjs` — mocked responses at 390px and 1440px; filters, retry and honest metric labels.
- `node tests/impact-linkedin-browser.mjs` — local test server only; actual owner login, save, update and public rendering at both widths. Never runs against production.

No fake LinkedIn posts or metrics are seeded into production. Published video URLs must come from the owner before those real posts can be listed.
