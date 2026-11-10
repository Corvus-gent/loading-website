# Corvus public link audit

Work in progress: baseline crawl completed 9 November 2026 (San Francisco). Production verification and complete route tables are appended after deployment.

The initial catalogue contains 876 public routes, including language/hook collections and individual registered video variants. Four live pages had no incoming page links. Twenty-three had fewer than three. The homepage could not reach four routes; another was three page navigations away. The CV is a downloadable PDF, checked separately.

## Publication boundary

Directories and search exclude admin, member-access, private stats, interview submission, invite and edit workflows. No invite or edit tokens are published. Senate profiles only appear after being returned by the public claimed-profile API. Cardneto remains a partner page, not an invented honorary member.

## Changes

- One generated public catalogue drives `/map`, search, the section directories, contextual footer links, and shuffled homepage cards.
- Every ordinary page has three related links plus a random public gem. Fullscreen games, embedded demos and the transparent stream overlay retain their controls/layout; they remain reachable through the map, their section and contextual links.
- Old `/hack2`, `/hack/the-feed` and `/submission` page aliases permanently redirect, preserving query strings. Submission downloads are untouched.
- Non-statistics HTML paths accidentally served on the stats subdomain redirect to the main domain. The actual statistics pages stay on their own host.
- The public Senate directory lists claimed seats only and gives a useful empty state until then.
- Private paths and query tokens are rejected by the catalogue and browser directory.

## Method

Rendered Chromium crawl, desktop viewport, distinct canonical referring pages, breadth-first distances from home. Hidden command-palette links do not count towards inbound metrics. Query parameters that identify actual content (video, id, interview, game) distinguish pages; attribution parameters and fragments do not. Duplicate aliases collapse to their final destination. Stats-domain accidental clones do not inflate counts. Short links are checked separately, without following external destinations.

Short-link HEAD requests exposed a legacy battle counter that counted crawler traffic. That handler now excludes HEAD and bot requests; the baseline audit may have added at most one deduplicated click to each of its 12 campaign buckets. No human activity or votes were changed.
