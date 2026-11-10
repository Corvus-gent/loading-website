# Muse hack / integration record

## Existing work preserved

Started from daily/2026-11-05-redis with local api/_redis.js changes and two arena commits. No stashes. Preserved Redis changes in a commit before creating muse-hack. Rebased this feature branch onto current origin/main to retain newer HackTheFeed, community and navigation work; resolved Redis/vercel routing conflicts by retaining both features. No main push or PR merge.

Open work inspected: PRs #39 (IG), #36 (hack stats), #34 (hack engagement), #32 (Oriane), #28 (search overlay), #27 (Genghis), #20 (X), #19 (docs/CV), #18 (Redis restore + Legion/account flow), #17 (Redis migration), #1 (people pages). PLAN.md contains the earlier daily-realm roadmap. These separate features were not discarded or silently merged. Production recruitment remains linked to the existing production host, not reimplemented.

## What changed

- Existing /hack field note preserved at /hack/1. /hack is now the numbered archive; /hack/2 is the Muse recap.
- /nest was generated through an actual meta/muse-ember request for this recap. Usage: 274 prompt + 5,914 completion tokens (3,478 reasoning), 6,188 total, $0.0029844. It is explicitly a recreation, not the missing original 1,755-token/$0.001 playground output. Local demo only: no claim of working automatic page deployment.
- Previous Spark Open arena/game/contender kept. No fabricated Claude/Codex contestants.
- Added Legion orientation page and public Explore directory, mobile navigation, next-step links, useful 404, ROUTES.md and repeatable static build/link audit. Existing full-screen game/feed layouts keep their own navigation.
- Copied Downloads/muse_blast.py after secret check. Consolidated duplicate tools implementation into a compatibility launcher for scripts/muse_blast.py.
- Removed stale Fivepoints 404 metadata; excluded private SF pages from public search; removed no dependencies because all declared packages have existing consumers.
- Retained unknown/unfinished experiments and all user content. No bulk deletion and no access-policy changes.

## Verification

npm run build generates navigation, photos, route/search indexes, audits every local anchor target and public reachability, then checks JavaScript syntax. npm run test:muse covers post URL safety, private search/navigation exclusion and local-only Nest behavior. Redis migration regression checked separately. Desktop/mobile browser QA covers recap, mobile menu and wish form.

## Remaining inputs / decisions

- POST_X_URL and POST_LINKEDIN_URL in hack/posts.js: actual post links still needed.
- Optional public/hack/2/floor.jpg, slide.jpg, setup.jpg; absent files show placeholders.
- Merge requires owner approval. Separate existing PRs still need their own review.
- Preview authentication is controlled by the existing Vercel project; no protection settings changed.
